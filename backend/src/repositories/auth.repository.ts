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


export interface UserCredentials {
  id: string;
  email: string;
  password_hash: string | null;
  session_version: number;
  roles: string[];
}

export async function findUserCredentials(
  email: string
): Promise<UserCredentials | null> {
  const result = await pool.query<UserCredentials>(
    `SELECT
       u.id,
       u.email,
       u.password_hash,
       u.session_version,
       ARRAY_AGG(r.code) FILTER (
         WHERE r.code IS NOT NULL
       ) AS roles
     FROM users u
     LEFT JOIN user_roles ur
       ON ur.user_id = u.id
     LEFT JOIN roles r
       ON r.id = ur.role_id
     WHERE u.email = $1
     GROUP BY u.id, u.email, u.password_hash`,
    [email]
  );

  return result.rows[0] ?? null;
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  roles: string[];
}

export async function findUserById(
  userId: string,
  sessionId: string
): Promise<AuthenticatedUser | null> {
  const result = await pool.query<{
    id: string;
    email: string;
    roles: string[];
  }>(
    `SELECT
       u.id,
       u.email,
       COALESCE(
         ARRAY_AGG(r.code) FILTER (
           WHERE r.code IS NOT NULL
         ),
         ARRAY[]::VARCHAR[]
       ) AS roles
     FROM users u
     JOIN auth_sessions s ON s.user_id = u.id
       AND s.session_version = u.session_version
       AND s.expires_at > NOW()
       AND s.id = $2
     LEFT JOIN user_roles ur
       ON ur.user_id = u.id
     LEFT JOIN roles r
       ON r.id = ur.role_id
     WHERE u.id = $1
       AND u.password_hash IS NOT NULL
     GROUP BY u.id, u.email`,
    [userId, sessionId]
  );

  return result.rows[0] ?? null;
}

