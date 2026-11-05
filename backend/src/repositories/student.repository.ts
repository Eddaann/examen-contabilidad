import { pool } from "../config/database";

export interface Student {
  id: string;
  email: string;
}

export async function findStudentByEmail(
  email: string
): Promise<Student | null> {
  const result = await pool.query<Student>(
    `SELECT u.id, u.email
     FROM users u
     JOIN user_roles ur ON ur.user_id = u.id
     JOIN roles r ON r.id = ur.role_id
     WHERE u.email = $1
       AND r.code = 'STUDENT'`,
    [email]
  );

  return result.rows[0] ?? null;
}
