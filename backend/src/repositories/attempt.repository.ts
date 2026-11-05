import { pool } from "../config/database";

export async function findAttempt(
  studentId: string,
  examId: string
): Promise<boolean> {
  const result = await pool.query(
    `SELECT 1
     FROM exam_attempts
     WHERE user_id = $1
       AND exam_id = $2`,
    [studentId, examId]
  );

  return (result.rowCount ?? 0) > 0;
}
