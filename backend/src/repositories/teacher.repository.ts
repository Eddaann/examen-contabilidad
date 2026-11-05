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

export interface StudentResultRow {
  studentId: string;
  email: string;
  examId: string;
  examTitle: string;
  submittedAt: Date;
  score: number;
  total: number;
}

export async function findAllResults(): Promise<StudentResultRow[]> {
  const result = await pool.query<StudentResultRow>(
    `SELECT
       a.user_id AS "studentId",
       u.email,
       a.exam_id AS "examId",
       e.title AS "examTitle",
       a.submitted_at AS "submittedAt",

       a.score,
       a.total_questions AS total

     FROM exam_attempts a
     JOIN users u ON u.id = a.user_id
     JOIN exams e ON e.id = a.exam_id
     ORDER BY a.submitted_at DESC`
  );

  return result.rows;
}
