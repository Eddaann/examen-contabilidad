const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const express = require('express');
const { Pool } = require('pg');

test('límites persistidos por IP y cuenta antes del controlador', async t => {
  const config = {
    host: process.env.DB_HOST, port: Number(process.env.DB_PORT),
    user: process.env.POSTGRES_USER, password: process.env.POSTGRES_PASSWORD,
    database: process.env.POSTGRES_DB,
  };
  const admin = new Pool(config);
  const name = `limits_test_${Date.now()}`;
  let created = false, database, pool;
  const servers = [];
  try {
    await admin.query(`CREATE DATABASE "${name}"`);
    created = true;
    process.env.POSTGRES_DB = name;
    process.env.JWT_SECRET = crypto.randomBytes(32).toString('hex');
    database = new Pool({ ...config, database: name });
    await database.query(fs.readFileSync('../database/migrations/006_create_auth_rate_limits.sql', 'utf8'));
    const { createAuthRateLimits } = require('../dist/middlewares/auth-rate-limit.middleware');
    const { errorHandler } = require('../dist/middlewares/error.middleware');
    pool = require('../dist/config/database').pool;
    const policies = {
      login: { windowMs: 60000, ipLimit: 3, accountLimit: 2 },
      register: { windowMs: 60000, ipLimit: 3, accountLimit: 1 },
    };
    async function harness(trustProxy = 1) {
      let calls = 0;
      const app = express();
      app.set('trust proxy', trustProxy);
      app.use(express.json());
      const limits = createAuthRateLimits(policies);
      for (const route of ['login', 'register']) {
        app.post(`/${route}`, ...limits[route], (_req, res) => {
          calls++;
          res.status(200).json({ message: 'Controlador alcanzado' });
        });
      }
      app.use(errorHandler);
      const server = app.listen(0);
      servers.push(server);
      await new Promise(resolve => server.once('listening', resolve));
      return {
        calls: () => calls,
        async request(email, ip = '192.0.2.1', route = 'login') {
          const response = await fetch(`http://127.0.0.1:${server.address().port}/${route}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': ip, Cookie: 'auth_session=FAKE_COOKIE' },
            body: JSON.stringify({ email, password: 'FAKE_PRIVATE_PASSWORD' }),
          });
          return { status: response.status, data: await response.json(), retry: response.headers.get('retry-after') };
        },
      };
    }
    const reset = () => database.query('TRUNCATE auth_rate_limits');

    await t.test('la IP limita aunque se cambie de cuenta', async () => {
      await reset();
      const app = await harness();
      for (let n = 0; n < 3; n++) assert.equal((await app.request(`account${n}@example.com`)).status, 200);
      const blocked = await app.request('different@example.com');
      assert.equal(blocked.status, 429);
      assert.ok(Number(blocked.retry) > 0);
      assert.deepEqual(blocked.data, { message: 'Demasiadas solicitudes. Intenta de nuevo más tarde' });
      assert.equal(app.calls(), 3);
    });

    await t.test('la cuenta normalizada limita aunque cambie la IP; registro y login independientes', async () => {
      await reset();
      const app = await harness();
      assert.equal((await app.request(' Account@Example.com ', '192.0.2.1')).status, 200);
      assert.equal((await app.request('account@example.com', '192.0.2.2')).status, 200);
      assert.equal((await app.request('ACCOUNT@EXAMPLE.COM', '192.0.2.3')).status, 429);
      assert.equal((await app.request('other@example.com', '192.0.2.4')).status, 200);
      assert.equal((await app.request('account@example.com', '192.0.2.5', 'register')).status, 200);
      assert.equal((await app.request(' ACCOUNT@example.com ', '192.0.2.6', 'register')).status, 429);
    });

    await t.test('los contadores sobreviven otra instancia y se restablecen al vencer', async () => {
      await reset();
      const first = await harness();
      await first.request('persistent@example.com');
      await first.request('persistent@example.com');
      const second = await harness();
      assert.equal((await second.request('persistent@example.com')).status, 429);
      await database.query("UPDATE auth_rate_limits SET expires_at = NOW() - INTERVAL '1 second'");
      assert.equal((await second.request('persistent@example.com')).status, 200);
    });

    await t.test('los incrementos simultáneos son atómicos', async () => {
      await reset();
      const app = await harness();
      const attempts = await Promise.all(Array.from({ length: 8 }, (_, n) =>
        app.request('parallel@example.com', `192.0.2.${n + 1}`)));
      assert.equal(attempts.filter(r => r.status === 200).length, 2);
      assert.equal(attempts.filter(r => r.status === 429).length, 6);
      assert.equal(app.calls(), 2);
    });

    await t.test('IPv6 agrupa la subred y la ejecución directa ignora X-Forwarded-For', async () => {
      await reset();
      const proxied = await harness();
      for (let n = 1; n <= 3; n++) {
        assert.equal((await proxied.request(`ipv6-${n}@example.com`, `2001:db8:abcd:12::${n}`)).status, 200);
      }
      assert.equal((await proxied.request('ipv6-other@example.com', '2001:db8:abcd:12::99')).status, 429);
      await reset();
      const direct = await harness(false);
      for (let n = 1; n <= 3; n++) assert.equal((await direct.request(`direct-${n}@example.com`, `192.0.2.${n}`)).status, 200);
      assert.equal((await direct.request('direct-other@example.com', '192.0.2.99')).status, 429);
    });

    await t.test('no almacena datos en claro ni registra datos de petición; fallo de base bloquea controlador', async () => {
      await reset();
      const logs = [];
      const originalError = console.error;
      console.error = (...args) => logs.push(args);
      try {
        const app = await harness();
        await app.request('private@example.com');
        await app.request('private@example.com');
        assert.equal((await app.request('PRIVATE@example.com')).status, 429);
        assert.deepEqual(logs, []);
        const rows = await database.query('SELECT * FROM auth_rate_limits');
        assert.ok(rows.rows.every(row => /^[a-f0-9]{64}$/.test(row.key_hash)));
        assert.equal(JSON.stringify(rows.rows).includes('private@example.com'), false);
        assert.equal(JSON.stringify(rows.rows).includes('FAKE_PRIVATE_PASSWORD'), false);
        assert.equal(JSON.stringify(rows.rows).includes('192.0.2.1'), false);
        const previousCalls = app.calls();
        await database.query('ALTER TABLE auth_rate_limits RENAME TO unavailable_rate_limits');
        assert.equal((await app.request('other@example.com')).status, 500);
        assert.equal(app.calls(), previousCalls);
        assert.deepEqual(logs, [['Error interno de API', { statusCode: 500 }]]);
      } finally {
        console.error = originalError;
      }
    });
  } finally {
    await Promise.all(servers.map(server => new Promise(resolve => server.close(resolve))));
    if (pool) await pool.end();
    if (database) await database.end();
    if (created) await admin.query(`DROP DATABASE "${name}"`);
    await admin.end();
  }
});
