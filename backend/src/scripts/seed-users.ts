import argon2 from "argon2";
import { pool } from "../config/database";

async function seedUsers(): Promise<void> {
  const studentPassword = process.env.TEST_STUDENT_PASSWORD;
  const teacherPassword = process.env.TEST_TEACHER_PASSWORD;

  if ([studentPassword, teacherPassword].some(
    (value) => !value || value.length < 12 || value.length > 128
  )) {
    throw new Error("Configura las contraseñas de prueba con entre 12 y 128 caracteres");
  }

  const users = [
    { email: "alumno1@ejemplo.com", role: "STUDENT", password: studentPassword! },
    { email: "alumno2@ejemplo.com", role: "STUDENT", password: studentPassword! },
    { email: "alumno3@ejemplo.com", role: "STUDENT", password: studentPassword! },
    { email: "profesor1@ejemplo.com", role: "TEACHER", password: teacherPassword! },
  ];

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const user of users) {
      const hash = await argon2.hash(user.password, { type: argon2.argon2id });
      const result = await client.query<{ id: string }>(
        `INSERT INTO users (email, password_hash) VALUES ($1, $2)
         ON CONFLICT (LOWER(email)) DO UPDATE
         SET password_hash = COALESCE(users.password_hash, EXCLUDED.password_hash)
         RETURNING id`,
        [user.email, hash]
      );
      const role = await client.query(
        `INSERT INTO user_roles (user_id, role_id)
         SELECT $1, id FROM roles WHERE code = $2
         ON CONFLICT DO NOTHING`,
        [result.rows[0]!.id, user.role]
      );
      if (!role.rowCount) {
        const existing = await client.query(
          `SELECT 1 FROM user_roles ur JOIN roles r ON r.id = ur.role_id
           WHERE ur.user_id = $1 AND r.code = $2`,
          [result.rows[0]!.id, user.role]
        );
        if (!existing.rowCount) throw new Error("Falta un rol requerido para las cuentas de prueba");
      }
    }
    await client.query("COMMIT");
    console.log("Cuentas de prueba preparadas; contraseñas y hashes ocultos");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

seedUsers().catch(() => {
  console.error("No se pudieron preparar las cuentas de prueba. Revisa la configuración y las migraciones.");
  process.exitCode = 1;
}).finally(() => pool.end());
