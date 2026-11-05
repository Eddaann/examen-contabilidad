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
         ON CONFLICT (LOWER(email)) DO NOTHING
         RETURNING id`,
        [user.email, hash]
      );
      const createdUser = result.rows[0];

      if (!createdUser) {
        // Compatibilidad con alumnos iniciales creados por el SQL sin contraseña.
        // No modificar sus roles ni una contraseña ya configurada.
        await client.query(
          `UPDATE users SET password_hash = $2
           WHERE email = $1 AND password_hash IS NULL`,
          [user.email, hash]
        );
        continue;
      }

      const role = await client.query(
        `INSERT INTO user_roles (user_id, role_id)
         SELECT $1, id FROM roles WHERE code = $2`,
        [createdUser.id, user.role]
      );
      if (role.rowCount !== 1) {
        throw new Error("Falta un rol requerido para las cuentas de prueba");
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
