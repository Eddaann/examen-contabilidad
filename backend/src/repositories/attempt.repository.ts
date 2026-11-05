
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

export interface GradedAnswer {
  questionNumber: number;
  selectedOption: string;
  correctOption: string;
  isCorrect: boolean;
}

// Guardar el intento y su corrección histórica en la misma transacción
export async function saveExamAttempt(
  client: PoolClient,
  studentId: string,
  examId: string,
  answers: GradedAnswer[],
  score: number,
  total: number
): Promise<void> {
  // Registrar el intento
  await client.query(
    `INSERT INTO exam_attempts (
      user_id,
      exam_id,
      score,
      total_questions
    )
    VALUES ($1, $2, $3, $4)`,
    [studentId, examId, score, total]
  );

  // Registrar cada respuesta seleccionada
  for (const answer of answers) {
    await client.query(
      `INSERT INTO attempt_answers (
        user_id,
        exam_id,
        question_number,
        option_code,
        correct_option_code,
        is_correct
      )
      VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        studentId,
        examId,
        answer.questionNumber,
        answer.selectedOption,
        answer.correctOption,
        answer.isCorrect,
      ]
    );
  }
}


interface AttemptResultRow {
  submitted_at: Date;
  score: number;
  total_questions: number;
}

export interface SavedAnswerRow {
  question_number: number;
  selected_option: string;
  correct_option: string;
  is_correct: boolean;
}

export async function findAttemptResult(
  studentId: string,
  examId: string
) {
  // Recuperar el intento y su fecha
  const attemptResult = await pool.query<AttemptResultRow>(
    `SELECT submitted_at, score, total_questions
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
       a.correct_option_code AS correct_option,
       a.is_correct
     FROM attempt_answers a
     WHERE a.user_id = $1
       AND a.exam_id = $2
     ORDER BY a.question_number`,
    [studentId, examId]
  );

  return {
    submittedAt: attemptResult.rows[0].submitted_at,
    score: attemptResult.rows[0].score,
    total: attemptResult.rows[0].total_questions,
    answers: answersResult.rows,
  };
}

