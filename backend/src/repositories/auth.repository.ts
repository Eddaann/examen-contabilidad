import type { PoolClient } from "pg";
import { pool } from "../config/database";

export interface AuthUser {
  id: string;
  email: string;
}

// Buscar un usuario por correo
export async function findUserByEmail(
  email: string
): Promise<AuthUser | null> {
  const result = await pool.query<AuthUser>(
    `SELECT id, email
     FROM users
     WHERE email = $1`,
    [email]
  );

  return result.rows[0] ?? null;
}

// Crear un estudiante y asignarle su rol
export async function createStudent(
  email: string,
  passwordHash: string
): Promise<AuthUser> {
  const client: PoolClient = await pool.connect();

  try {
    await client.query("BEGIN");

    const userResult = await client.query<AuthUser>(
      `INSERT INTO users (email, password_hash)
       VALUES ($1, $2)
       RETURNING id, email`,
      [email, passwordHash]
    );

    const user = userResult.rows[0];

    if (!user) {
      throw new Error("No se pudo crear el usuario");
    }

    const roleResult = await client.query(
      `INSERT INTO user_roles (user_id, role_id)
       SELECT $1, id
       FROM roles
       WHERE code = 'STUDENT'`,
      [user.id]
    );

    if (roleResult.rowCount !== 1) {
      throw new Error("No existe el rol STUDENT");
    }

    await client.query("COMMIT");

    return user;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
