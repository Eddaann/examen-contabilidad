const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');

test('autenticación, cuentas de prueba y permisos efectivos del estudiante', async () => {
  // Requiere una base local y permiso CREATE DATABASE; nunca cambia sus datos.
  const config = {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
    database: process.env.POSTGRES_DB,
  };
  const admin = new Pool(config);
  const name = `auth_test_${Date.now()}`;
  let created = false;
  let database, pool, server;
  try {
    await admin.query(`CREATE DATABASE "${name}"`);
    created = true;
    process.env.POSTGRES_DB = name;
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = crypto.randomBytes(32).toString('hex');
    process.env.TEST_STUDENT_PASSWORD = crypto.randomBytes(24).toString('hex');
    process.env.TEST_TEACHER_PASSWORD = crypto.randomBytes(24).toString('hex');
    database = new Pool({ ...config, database: name });
    for (const file of [
      'migrations/001_create_identity.sql', 'migrations/002_create_exams.sql',
      'migrations/003_create_attempts.sql', 'seeds/001_roles_permissions.sql',
      'seeds/002_test_data.sql',
    ]) await database.query(fs.readFileSync(`../database/${file}`, 'utf8'));

    const seed = () => execFileSync(process.execPath, ['dist/scripts/seed-users.js'], {
      env: process.env, stdio: 'ignore',
    });
    seed();
    // Repetir la carga no debe duplicar usuarios ni reemplazar contraseñas.
    const before = await database.query('SELECT id, password_hash FROM users ORDER BY id');
    seed();
    const after = await database.query('SELECT id, password_hash FROM users ORDER BY id');
    assert.equal(after.rowCount, 4);
    assert.ok(after.rows.every(row => row.password_hash?.startsWith('$argon2id$')));
    assert.ok(before.rows.every((row, i) => row.password_hash === after.rows[i].password_hash));

    const app = require('../dist/app').default;
    pool = require('../dist/config/database').pool;
    server = app.listen(0);
    await new Promise(resolve => server.once('listening', resolve));
    const base = `http://127.0.0.1:${server.address().port}`;
    async function call(method, path, body, cookie) {
      const response = await fetch(base + path, {
        method,
        headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      return {
        status: response.status,
        cookie: response.headers.get('set-cookie')?.split(';')[0],
        data: response.headers.get('content-type')?.includes('application/json')
          ? await response.json() : null,
      };
    }
    async function setStudentPermission(permission, enabled) {
      if (enabled) {
        await database.query(
          `INSERT INTO role_permissions (role_id, permission_id)
           SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
           WHERE r.code = 'STUDENT' AND p.code = $1
           ON CONFLICT DO NOTHING`, [permission]
        );
      } else {
        await database.query(
          `DELETE FROM role_permissions
           WHERE role_id = (SELECT id FROM roles WHERE code = 'STUDENT')
             AND permission_id = (SELECT id FROM permissions WHERE code = $1)`,
          [permission]
        );
      }
    }
    const statusPath = '/api/students/me/exams/1/status';
    assert.equal((await call('POST', '/api/students/access', { email: 'alumno1@ejemplo.com' })).status, 404);
    assert.equal((await call('POST', '/api/auth/login', { email: 'alumno1@ejemplo.com' })).status, 400);
    assert.equal((await call('POST', '/api/auth/login', { email: 'alumno1@ejemplo.com', password: 'wrong' })).status, 401);
    assert.equal((await call('GET', '/api/exams/1')).status, 401);
    const legacyToken = jwt.sign({ sub: '1', type: 'student-demo' }, process.env.JWT_SECRET);
    assert.equal((await call('GET', statusPath, null, `auth_session=${legacyToken}`)).status, 401);
    assert.equal((await call('GET', statusPath, null, `student_session=${legacyToken}`)).status, 401);

    for (const email of ['alumno1@ejemplo.com', 'alumno2@ejemplo.com', 'alumno3@ejemplo.com']) {
      const login = await call('POST', '/api/auth/login', { email, password: process.env.TEST_STUDENT_PASSWORD });
      assert.equal(login.status, 200);
      assert.ok(login.cookie?.startsWith('auth_session='));
      assert.equal((await call('GET', statusPath, null, login.cookie)).status, 200);
      assert.equal((await call('GET', '/api/teacher/students', null, login.cookie)).status, 403);
      const answers = [1, 2, 3, 4, 5].map(n => ({ questionNumber: n, optionCode: n % 2 ? 'A' : 'B' }));
      assert.equal((await call('GET', '/api/exams/1', null, login.cookie)).status, 200);
      if (email === 'alumno1@ejemplo.com') {
        // Los permisos se retiran y restituyen manteniendo la misma sesión.
        await setStudentPermission('exam:read', false);
        assert.equal((await call('GET', '/api/exams/1', null, login.cookie)).status, 403);
        assert.equal((await call('GET', statusPath, null, login.cookie)).status, 200);
        await setStudentPermission('exam:read', true);
        assert.equal((await call('GET', '/api/exams/1', null, login.cookie)).status, 200);

        await setStudentPermission('exam:submit', false);
        assert.equal((await call('POST', '/api/exams/1/submit', { answers }, login.cookie)).status, 403);
        assert.equal((await database.query('SELECT count(*)::int AS n FROM exam_attempts')).rows[0].n, 0);
        assert.equal((await database.query('SELECT count(*)::int AS n FROM attempt_answers')).rows[0].n, 0);
        assert.equal((await call('GET', '/api/exams/1', null, login.cookie)).status, 200);
        await setStudentPermission('exam:submit', true);
      }
      assert.equal((await call('POST', '/api/exams/1/submit', { answers }, login.cookie)).status, 201);
      assert.equal((await call('GET', '/api/students/me/exams/1/result', null, login.cookie)).data.grade, '5/5');
      if (email === 'alumno1@ejemplo.com') {
        await setStudentPermission('result:read:own', false);
        assert.equal((await call('GET', statusPath, null, login.cookie)).status, 403);
        assert.equal((await call('GET', '/api/students/me/exams/1/result', null, login.cookie)).status, 403);
        assert.equal((await call('GET', '/api/exams/1', null, login.cookie)).status, 200);
        await setStudentPermission('result:read:own', true);
        assert.equal((await call('GET', statusPath, null, login.cookie)).status, 200);
        assert.equal((await call('GET', '/api/students/me/exams/1/result', null, login.cookie)).data.grade, '5/5');
      }
      assert.equal((await call('POST', '/api/exams/1/submit', { answers }, login.cookie)).status, 409);
      assert.equal((await call('POST', '/api/auth/logout', null, login.cookie)).cookie, 'auth_session=');
    }
    const teacher = await call('POST', '/api/auth/login', { email: 'profesor1@ejemplo.com', password: process.env.TEST_TEACHER_PASSWORD });
    assert.equal(teacher.status, 200);
    assert.equal((await call('GET', '/api/teacher/students', null, teacher.cookie)).status, 200);
    assert.equal((await call('GET', '/api/teacher/results', null, teacher.cookie)).status, 200);
    assert.equal((await call('GET', statusPath, null, teacher.cookie)).status, 403);
    assert.equal((await call('GET', '/api/exams/1', null, teacher.cookie)).status, 403);
  } finally {
    if (server) await new Promise(resolve => server.close(resolve));
    if (pool) await pool.end();
    if (database) await database.end();
    if (created) await admin.query(`DROP DATABASE "${name}" WITH (FORCE)`);
    await admin.end();
  }
});
