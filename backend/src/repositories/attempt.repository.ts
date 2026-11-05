
import type { PoolClient } from "pg";
import { pool } from "../config/database";

export interface SubmittedAnswer {
  questionNumber: number;
  optionCode: string;
}

// Consultar si el estudiante ya presentó el examen
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

// Guardar el intento y sus respuestas
export async function saveExamAttempt(
  client: PoolClient,
  studentId: string,
  examId: string,
  answers: SubmittedAnswer[]
): Promise<void> {
  // Registrar el intento
  await client.query(
    `INSERT INTO exam_attempts (
      user_id,
      exam_id
    )
    VALUES ($1, $2)`,
    [studentId, examId]
  );

  // Registrar cada respuesta seleccionada
  for (const answer of answers) {
    await client.query(
      `INSERT INTO attempt_answers (
        user_id,
        exam_id,
        question_number,
        option_code
      )
      VALUES ($1, $2, $3, $4)`,
      [
        studentId,
        examId,
        answer.questionNumber,
        answer.optionCode,
      ]
    );
  }
}
