import { pool } from "../config/database";

interface StudentRow {
  id: string;
  email: string;
}

export async function findAllStudents(): Promise<StudentRow[]> {
  const result = await pool.query<StudentRow>(
    `SELECT DISTINCT u.id, u.email
     FROM users u
     JOIN user_roles ur ON ur.user_id = u.id
     JOIN roles r ON r.id = ur.role_id
     WHERE r.code = 'STUDENT'
     ORDER BY u.id`
  );

  return result.rows;
}
