import { pool } from "../config/database";

export async function createSession(
  sessionId: string,
  userId: string,
  sessionVersion: number,
  expiresAt: Date
): Promise<boolean> {
  const result = await pool.query(
    `INSERT INTO auth_sessions (id, user_id, session_version, expires_at)
     SELECT $1, id, session_version, $4 FROM users
     WHERE id = $2 AND session_version = $3 AND password_hash IS NOT NULL
     RETURNING id`,
    [sessionId, userId, sessionVersion, expiresAt]
  );
  return result.rowCount === 1;
}

export async function deleteSession(sessionId: string, userId: string): Promise<void> {
  await pool.query(
    `DELETE FROM auth_sessions WHERE id = $1 AND user_id = $2`,
    [sessionId, userId]
  );
}
