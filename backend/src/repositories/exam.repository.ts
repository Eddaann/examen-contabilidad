import { pool } from "../config/database";

export interface ExamRow {
  exam_id: string;
  title: string;
  description: string | null;
  question_number: number;
  statement: string;
  option_code: string;
  option_text: string;
}

export async function findExamById(
  examId: string
): Promise<ExamRow[]> {
  const result = await pool.query<ExamRow>(
    `SELECT
       e.id AS exam_id,
       e.title,
       e.description,
       q.number AS question_number,
       q.statement,
       o.code AS option_code,
       o.text AS option_text
     FROM exams e
     JOIN questions q ON q.exam_id = e.id
     JOIN options o
       ON o.exam_id = q.exam_id
       AND o.question_number = q.number
     WHERE e.id = $1
       AND e.is_active = TRUE
     ORDER BY q.number, o.code`,
    [examId]
  );

  return result.rows;
}
