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

    // Migrar un intento antiguo con respuestas correctas e incorrectas.
    await database.query(`INSERT INTO exam_attempts (user_id, exam_id) VALUES (1, 1)`);
    await database.query(`INSERT INTO attempt_answers
      (user_id, exam_id, question_number, option_code)
      SELECT 1, 1, number, 'B' FROM questions WHERE exam_id = 1`);
    await database.query(fs.readFileSync('../database/migrations/004_preserve_attempt_results.sql', 'utf8'));
    const migrated = await database.query('SELECT score, total_questions FROM exam_attempts');
    assert.deepEqual(migrated.rows, [{ score: 2, total_questions: 5 }]);
    const migratedAnswers = await database.query('SELECT correct_option_code, is_correct FROM attempt_answers ORDER BY question_number');
    assert.deepEqual(migratedAnswers.rows.map(row => row.correct_option_code), ['A', 'B', 'A', 'B', 'A']);
    assert.deepEqual(migratedAnswers.rows.map(row => row.is_correct), [false, true, false, true, false]);
    await database.query('DELETE FROM attempt_answers; DELETE FROM exam_attempts');
    await database.query(fs.readFileSync('../database/migrations/005_create_auth_sessions.sql', 'utf8'));
    await database.query(fs.readFileSync('../database/migrations/006_create_auth_rate_limits.sql', 'utf8'));

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
      assert.equal((await call('GET', '/api/auth/me', null, login.cookie)).status, 401);
      assert.equal((await call('GET', statusPath, null, login.cookie)).status, 401);
    }
    const teacher = await call('POST', '/api/auth/login', { email: 'profesor1@ejemplo.com', password: process.env.TEST_TEACHER_PASSWORD });
    assert.equal(teacher.status, 200);
    assert.equal((await call('GET', '/api/teacher/students', null, teacher.cookie)).status, 200);
    assert.equal((await call('GET', '/api/teacher/results', null, teacher.cookie)).status, 200);
    assert.equal((await call('GET', statusPath, null, teacher.cookie)).status, 403);
    assert.equal((await call('GET', '/api/exams/1', null, teacher.cookie)).status, 403);

    // El arranque no debe restaurar roles retirados de cuentas existentes.
    await database.query(`DELETE FROM user_roles
      WHERE user_id = (SELECT id FROM users WHERE email = 'profesor1@ejemplo.com')`);
    assert.equal((await call('GET', '/api/teacher/students', null, teacher.cookie)).status, 403);
    seed();
    assert.equal((await call('GET', '/api/teacher/students', null, teacher.cookie)).status, 403);
    assert.equal((await call('GET', '/api/teacher/results', null, teacher.cookie)).status, 403);
    const existingTeacherRoles = await database.query(`SELECT 1 FROM user_roles
      WHERE user_id = (SELECT id FROM users WHERE email = 'profesor1@ejemplo.com')`);
    assert.equal(existingTeacherRoles.rowCount, 0);
    const hashesAfterRoleRemoval = await database.query('SELECT id, password_hash FROM users ORDER BY id');
    assert.ok(after.rows.every((row, i) => row.password_hash === hashesAfterRoleRemoval.rows[i].password_hash));

    // Restauración explícita de la fixture para las comprobaciones históricas.
    await database.query(`INSERT INTO user_roles (user_id, role_id)
      SELECT u.id, r.id FROM users u CROSS JOIN roles r
      WHERE u.email = 'profesor1@ejemplo.com' AND r.code = 'TEACHER'`);


    const student = await call('POST', '/api/auth/login', {
      email: 'alumno1@ejemplo.com', password: process.env.TEST_STUDENT_PASSWORD,
    });
    const historical = await call('GET', '/api/students/me/exams/1/result', null, student.cookie);
    const teacherHistorical = await call('GET', '/api/teacher/results', null, teacher.cookie);
    await database.query(`UPDATE options SET is_correct = FALSE WHERE exam_id = 1 AND question_number = 1;
      UPDATE options SET is_correct = TRUE WHERE exam_id = 1 AND question_number = 1 AND code = 'B';
      INSERT INTO questions (exam_id, number, statement) VALUES (1, 6, 'Pregunta agregada después del envío');
      INSERT INTO options (exam_id, question_number, code, text, is_correct) VALUES (1, 6, 'A', 'Nueva opción', TRUE)`);
    const unchanged = await call('GET', '/api/students/me/exams/1/result', null, student.cookie);
    assert.equal(unchanged.status, 200);
    assert.deepEqual(unchanged.data, historical.data);
    assert.equal(unchanged.data.grade, '5/5');
    assert.equal(unchanged.data.details[0].correctOption, 'A');
    assert.equal(unchanged.data.details[0].isCorrect, true);
    assert.deepEqual((await call('GET', '/api/teacher/results', null, teacher.cookie)).data, teacherHistorical.data);

    // Los envíos nuevos sí usan la clave y el total actualizados.
    assert.equal((await call('POST', '/api/auth/register', {
      email: 'nuevo@ejemplo.com', password: process.env.TEST_STUDENT_PASSWORD,
    })).status, 201);
    const newStudent = await call('POST', '/api/auth/login', {
      email: 'nuevo@ejemplo.com', password: process.env.TEST_STUDENT_PASSWORD,
    });
    const newAnswers = [1, 2, 3, 4, 5, 6].map(n => ({
      questionNumber: n, optionCode: n === 6 || n % 2 ? 'A' : 'B',
    }));
    const newResult = await call('POST', '/api/exams/1/submit', { answers: newAnswers }, newStudent.cookie);
    assert.equal(newResult.status, 201);
    assert.equal(newResult.data.result.grade, '5/6');
    assert.equal(newResult.data.result.details[0].correctOption, 'B');
    assert.equal(newResult.data.result.details[0].isCorrect, false);
    assert.equal((await call('GET', '/api/students/me/exams/1/result', null, newStudent.cookie)).data.grade, '5/6');

    // Cada login tiene su propia sesión y logout solo revoca la presentada.
    const secondSession = await call('POST', '/api/auth/login', {
      email: 'nuevo@ejemplo.com', password: process.env.TEST_STUDENT_PASSWORD,
    });
    assert.ok(secondSession.cookie !== newStudent.cookie);
    assert.equal((await call('POST', '/api/auth/logout', null, newStudent.cookie)).status, 200);
    assert.equal((await call('GET', '/api/auth/me', null, newStudent.cookie)).status, 401);
    assert.equal((await call('GET', '/api/auth/me', null, secondSession.cookie)).status, 200);
    assert.equal((await call('POST', '/api/auth/logout', null, newStudent.cookie)).status, 200);
    assert.equal((await call('POST', '/api/auth/logout', null, 'auth_session=invalid')).status, 200);
    assert.equal((await call('POST', '/api/auth/logout')).status, 200);

    // Firma válida sin sesión registrada o con dueño distinto no autoriza.
    const forged = jwt.sign({ sub: '1', type: 'authenticated', jti: crypto.randomUUID() },
      process.env.JWT_SECRET, { expiresIn: '2h' });
    assert.equal((await call('GET', '/api/auth/me', null, `auth_session=${forged}`)).status, 401);
    const secondIdentity = jwt.decode(secondSession.cookie.slice('auth_session='.length));
    const wrongOwner = jwt.sign({ sub: '1', type: 'authenticated', jti: secondIdentity.jti },
      process.env.JWT_SECRET, { expiresIn: '2h' });
    assert.equal((await call('GET', '/api/auth/me', null, `auth_session=${wrongOwner}`)).status, 401);
    const expiredJwt = jwt.sign({ sub: secondIdentity.sub, type: 'authenticated', jti: secondIdentity.jti },
      process.env.JWT_SECRET, { expiresIn: -1 });
    assert.equal((await call('GET', '/api/auth/me', null, `auth_session=${expiredJwt}`)).status, 401);

    // Cambiar la contraseña invalida todas las sesiones y la contraseña anterior.
    const thirdSession = await call('POST', '/api/auth/login', {
      email: 'nuevo@ejemplo.com', password: process.env.TEST_STUDENT_PASSWORD,
    });
    const originalHash = (await database.query(
      "SELECT password_hash FROM users WHERE email = 'nuevo@ejemplo.com'"
    )).rows[0].password_hash;
    const changedPassword = crypto.randomBytes(24).toString('hex');
    const changedHash = await require('argon2').hash(changedPassword);
    await database.query("UPDATE users SET password_hash = $1 WHERE email = 'nuevo@ejemplo.com'", [changedHash]);
    for (const active of [secondSession, thirdSession]) {
      assert.equal((await call('GET', '/api/auth/me', null, active.cookie)).status, 401);
    }
    assert.equal((await call('POST', '/api/auth/login', {
      email: 'nuevo@ejemplo.com', password: process.env.TEST_STUDENT_PASSWORD,
    })).status, 401);
    const renewed = await call('POST', '/api/auth/login', {
      email: 'nuevo@ejemplo.com', password: changedPassword,
    });
    assert.equal(renewed.status, 200);
    assert.equal((await call('GET', '/api/auth/me', null, renewed.cookie)).status, 200);
    // Incluso restaurar el hash previo no vuelve a activar sesiones antiguas.
    await database.query("UPDATE users SET password_hash = $1 WHERE email = 'nuevo@ejemplo.com'", [originalHash]);
    assert.equal((await call('GET', '/api/auth/me', null, secondSession.cookie)).status, 401);
    assert.equal((await call('GET', '/api/auth/me', null, renewed.cookie)).status, 401);

    const databaseExpired = await call('POST', '/api/auth/login', {
      email: 'nuevo@ejemplo.com', password: process.env.TEST_STUDENT_PASSWORD,
    });
    const expiredIdentity = jwt.decode(databaseExpired.cookie.slice('auth_session='.length));
    await database.query(`UPDATE auth_sessions SET created_at = NOW() - INTERVAL '2 hours',
      expires_at = NOW() - INTERVAL '1 second' WHERE id = $1`, [expiredIdentity.jti]);
    assert.equal((await call('GET', '/api/auth/me', null, databaseExpired.cookie)).status, 401);


  } finally {
    if (server) await new Promise(resolve => server.close(resolve));
    if (pool) await pool.end();
    if (database) await database.end();
    if (created) await admin.query(`DROP DATABASE "${name}" WITH (FORCE)`);
    await admin.end();
  }
});
