
import type { PoolClient } from "pg";
import { pool } from "../config/database";

export interface SubmittedAnswer {
  questionNumber: number;
  optionCode: string;
}

// Consultar si el estudiante ya presentó el examen
export async function findAttempt(
  studentId: string,
  examId: string,
  client?: PoolClient
): Promise<boolean> {
  const result = await (client ?? pool).query(
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
  statement: string;
  selectedOptionText: string;
  correctOptionText: string;
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
        is_correct,
        statement,
        selected_option_text,
        correct_option_text
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        studentId,
        examId,
        answer.questionNumber,
        answer.selectedOption,
        answer.correctOption,
        answer.isCorrect,
        answer.statement,
        answer.selectedOptionText,
        answer.correctOptionText,
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
  statement: string;
  selected_option_text: string;
  correct_option_text: string;
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
       a.is_correct,
       a.statement,
       a.selected_option_text,
       a.correct_option_text
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

export interface CorrectAnswerRow {
  number: number;
  code: string | null;
  statement: string;
  correct_text: string | null;
}

export interface OptionRow {
  question_number: number;
  code: string;
  text: string;
}

export async function isStudent(studentId: string, client?: PoolClient) {
  const studentResult = await (client ?? pool).query(
    `SELECT u.id
     FROM users u
     JOIN user_roles ur ON ur.user_id = u.id
     JOIN roles r ON r.id = ur.role_id
     WHERE u.id = $1
       AND r.code = 'STUDENT'`,
    [studentId]
  );

  return (studentResult.rowCount ?? 0) > 0;
}

export async function doesExamExist(examId: string) {
  const examResult = await pool.query(
    `SELECT id FROM exams WHERE id = $1`,
    [examId]
  );

  return (examResult.rowCount ?? 0) > 0;
}

export async function lockActiveExam(examId: string, client: PoolClient) {
  const examResult = await client.query(
    `SELECT id
     FROM exams
     WHERE id = $1
       AND is_active = TRUE
     FOR SHARE`,
    [examId]
  );

  return (examResult.rowCount ?? 0) > 0;
}

export async function findCorrectAnswers(examId: string, client: PoolClient) {
  const correctResult = await client.query<CorrectAnswerRow>(
    `SELECT
       q.number,
       q.statement,
       o.code,
       o.text AS correct_text
     FROM questions q
     LEFT JOIN options o
       ON o.exam_id = q.exam_id
       AND o.question_number = q.number
       AND o.is_correct = TRUE
     WHERE q.exam_id = $1
     ORDER BY q.number`,
    [examId]
  );

  return correctResult.rows;
}

export async function findExamOptions(examId: string, client: PoolClient) {
  const optionsResult = await client.query<OptionRow>(
    `SELECT question_number, code, text
     FROM options
     WHERE exam_id = $1`,
    [examId]
  );

  return optionsResult.rows;
}
