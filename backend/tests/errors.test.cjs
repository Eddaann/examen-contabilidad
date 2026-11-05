const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { errorHandler } = require('../dist/middlewares/error.middleware');
const app = require('../dist/app').default;
const { pool } = require('../dist/config/database');

test.after(() => pool.end());

for (const environment of ['development', 'production']) {
  test(`errores HTTP sin datos sensibles en ${environment}`, async () => {
    const previousEnvironment = process.env.NODE_ENV;
    process.env.NODE_ENV = environment;
    const logs = [];
    const originalError = console.error;
    const originalWrite = process.stderr.write;
    console.error = (...args) => logs.push(args);
    process.stderr.write = function (chunk, ...args) {
      logs.push(String(chunk));
      const callback = args.find(arg => typeof arg === 'function');
      if (callback) callback();
      return true;
    };
    const server = app.listen(0);
    const failureApp = express();
    failureApp.get('/failure', (_req, _res, next) => {
      const error = new Error('FAKE_PRIVATE_MESSAGE');
      error.body = { password: 'FAKE_PRIVATE_BODY' };
      error.detail = 'FAKE_PRIVATE_DATABASE_DETAIL';
      next(error);
    });
    failureApp.use(errorHandler);
    const failureServer = failureApp.listen(0);
    try {
      await Promise.all([server, failureServer].map(s => new Promise(resolve => s.once('listening', resolve))));
      const base = `http://127.0.0.1:${server.address().port}`;
      const invalid = await fetch(`${base}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: 'auth_session=FAKE_PRIVATE_COOKIE' },
        body: '{"password":"FAKE_PRIVATE_PASSWORD",',
      });
      assert.equal(invalid.status, 400);
      assert.match(invalid.headers.get('content-type'), /application\/json/);
      assert.deepEqual(await invalid.json(), { message: 'JSON inválido' });

      const large = await fetch(`${base}/api/auth/register`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: 'FAKE_PRIVATE_LARGE' + 'x'.repeat(110000) }),
      });
      assert.equal(large.status, 413);
      assert.deepEqual(await large.json(), { message: 'La petición supera el tamaño permitido' });

      const unsupported = await fetch(`${base}/api/auth/login`, {
        method: 'POST', headers: { 'Content-Type': 'application/json; charset=iso-8859-1' },
        body: '{"password":"FAKE_PRIVATE_CHARSET"}',
      });
      assert.equal(unsupported.status, 415);
      assert.deepEqual(await unsupported.json(), { message: 'Codificación no admitida' });

      const internal = await fetch(`http://127.0.0.1:${failureServer.address().port}/failure`);
      assert.equal(internal.status, 500);
      assert.deepEqual(await internal.json(), { message: 'Error interno del servidor' });
      await new Promise(resolve => setImmediate(resolve));
      // Solo se registra un evento fijo, sin los errores originales.
      assert.deepEqual(logs, [['Error interno de API', { statusCode: 500 }]]);
    } finally {
      await Promise.all([server, failureServer].map(s => new Promise(resolve => s.close(resolve))));
      console.error = originalError;
      process.stderr.write = originalWrite;
      if (previousEnvironment === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = previousEnvironment;
    }
  });
}
