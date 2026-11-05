import { pool } from "../config/database";
import { findAttempt } from "../repositories/attempt.repository";

export async function getAttemptStatus(
  studentId: string,
  examId: string
) {
  const userResult = await pool.query(
    `SELECT u.id
     FROM users u
     JOIN user_roles ur ON ur.user_id = u.id
     JOIN roles r ON r.id = ur.role_id
     WHERE u.id = $1
       AND r.code = 'STUDENT'`,
    [studentId]
  );

  if (userResult.rowCount === 0) {
    return null;
  }

  const examResult = await pool.query(
    "SELECT id FROM exams WHERE id = $1",
    [examId]
  );

  if (examResult.rowCount === 0) {
    return null;
  }

  const submitted = await findAttempt(studentId, examId);

  return {
    studentId,
    examId,
    submitted,
  };
}
