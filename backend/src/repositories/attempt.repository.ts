
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


interface AttemptResultRow {
  submitted_at: Date;
}

export interface SavedAnswerRow {
  question_number: number;
  selected_option: string;
  correct_option: string;
}

export async function findAttemptResult(
  studentId: string,
  examId: string
) {
  // Recuperar el intento y su fecha
  const attemptResult = await pool.query<AttemptResultRow>(
    `SELECT submitted_at
     FROM exam_attempts
     WHERE user_id = $1 AND exam_id = $2`,
    [studentId, examId]
  );

  if (attemptResult.rows.length === 0) {
    return null;
  }

  // Recuperar las respuestas del alumno y las correctas
  const answersResult = await pool.query<SavedAnswerRow>(
    `SELECT
       a.question_number,
       a.option_code AS selected_option,
       o.code AS correct_option
     FROM attempt_answers a
     JOIN options o
       ON o.exam_id = a.exam_id
       AND o.question_number = a.question_number
       AND o.is_correct = TRUE
     WHERE a.user_id = $1
       AND a.exam_id = $2
     ORDER BY a.question_number`,
    [studentId, examId]
  );

  return {
    submittedAt: attemptResult.rows[0].submitted_at,
    answers: answersResult.rows,
  };
}

