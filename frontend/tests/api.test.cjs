const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const ts = require('typescript');

const compiled = fs.mkdtempSync(path.join(os.tmpdir(), 'examen-api-'));
for (const name of ['client', 'auth.api']) {
  const source = fs.readFileSync(path.join(__dirname, '../src/api', `${name}.ts`), 'utf8');
  const result = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  fs.writeFileSync(path.join(compiled, `${name}.js`), result.outputText);
}
const { apiRequest, ApiError, errorMessage } = require(path.join(compiled, 'client.js'));
const { login, getCurrentUser, logout } = require(path.join(compiled, 'auth.api.js'));
test.after(() => fs.rmSync(compiled, { recursive: true, force: true }));

const user = { id: '1', email: 'test@example.com', roles: ['STUDENT'] };
const json = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), {
  status, headers: { 'Content-Type': 'application/json', ...headers },
});

test('login y recuperación usan cookies; logout llama al servidor', async t => {
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    calls.push({ url, options });
    return json({ user });
  });
  assert.deepEqual(await login('test@example.com', 'FAKE_PASSWORD'), user);
  assert.deepEqual(await getCurrentUser(), user);
  await logout();
  assert.deepEqual(calls.map(c => c.url), ['/api/auth/login', '/api/auth/me', '/api/auth/logout']);
  assert.ok(calls.every(c => c.options.credentials === 'include'));
  assert.equal(calls[2].options.method, 'POST');
});

test('401 distingue credenciales incorrectas de sesión vencida', async t => {
  t.mock.method(globalThis, 'fetch', async () => json({ detail: 'PRIVATE' }, 401));
  await assert.rejects(login('test@example.com', 'FAKE_PASSWORD'), e =>
    e instanceof ApiError && e.status === 401 && e.message === 'Correo o contraseña incorrectos');
  await assert.rejects(getCurrentUser(), e =>
    e instanceof ApiError && e.status === 401 && e.message.includes('sesión venció'));
});

test('429 respeta Retry-After sin mostrar el cuerpo de error', async t => {
  t.mock.method(globalThis, 'fetch', async () => json({ password: 'PRIVATE' }, 429, { 'Retry-After': '120' }));
  await assert.rejects(apiRequest('/auth/login'), e =>
    e.status === 429 && e.retryAfterSeconds === 120 && e.message.includes('2 min.') && !e.message.includes('PRIVATE'));
});

test('errores HTTP y respuestas HTML muestran mensajes seguros', async t => {
  const mock = t.mock.method(globalThis, 'fetch', async () => new Response('PRIVATE_STACK', { status: 502 }));
  await assert.rejects(apiRequest('/auth/me'), e => e.status === 502 && !e.message.includes('PRIVATE'));
  mock.mock.mockImplementation(async () => new Response('<html>PRIVATE</html>', { status: 200 }));
  await assert.rejects(getCurrentUser(), e => e.message.includes('respuesta inválida') && !e.message.includes('PRIVATE'));
  mock.mock.mockImplementation(async () => json({ user: { id: 1, email: 'bad', roles: null } }));
  await assert.rejects(getCurrentUser(), e => e.message.includes('respuesta inválida'));
});

test('fallos de red y timeout permiten reintentar', async t => {
  const mock = t.mock.method(globalThis, 'fetch', async () => { throw new TypeError('PRIVATE_URL'); });
  await assert.rejects(apiRequest('/auth/me'), e => e.message.includes('conectar') && !e.message.includes('PRIVATE'));
  mock.mock.mockImplementation((_url, options) => new Promise((_resolve, reject) => {
    options.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
  }));
  await assert.rejects(apiRequest('/auth/me', { timeoutMs: 5 }), e => e.message.includes('tardó demasiado'));
});

test('errores desconocidos no exponen detalles internos', () => {
  assert.equal(errorMessage(new Error('PRIVATE_STACK')), 'Ocurrió un error inesperado. Inténtalo de nuevo.');
});
