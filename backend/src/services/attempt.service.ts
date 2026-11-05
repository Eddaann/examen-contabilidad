import { pool } from "../config/database";

import {
  findAttempt,
  findAttemptResult,
  saveExamAttempt,
  type SubmittedAnswer,
} from "../repositories/attempt.repository";

interface CorrectAnswerRow {
  number: number;
  code: string | null;
}

interface OptionRow {
  question_number: number;
  code: string;
}

export class AttemptError extends Error {
  constructor(
    message: string,
    public statusCode: number
  ) {
    super(message);
    this.name = "AttemptError";
  }
}

// Consultar si el estudiante ya presentó el examen
export async function getAttemptStatus(
  studentId: string,
  examId: string
) {
  const studentResult = await pool.query(
    `SELECT u.id
     FROM users u
     JOIN user_roles ur ON ur.user_id = u.id
     JOIN roles r ON r.id = ur.role_id
     WHERE u.id = $1
       AND r.code = 'STUDENT'`,
    [studentId]
  );

  if (studentResult.rowCount === 0) {
    return null;
  }

  const examResult = await pool.query(
    `SELECT id FROM exams WHERE id = $1`,
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

// Enviar el examen y calcular la calificación
export async function submitExam(
  studentId: string,
  examId: string,
  answers: SubmittedAnswer[]
) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Verificar el rol del estudiante
    const studentResult = await client.query(
      `SELECT 1
       FROM user_roles ur
       JOIN roles r ON r.id = ur.role_id
       WHERE ur.user_id = $1
         AND r.code = 'STUDENT'`,
      [studentId]
    );

    if (studentResult.rowCount === 0) {
      throw new AttemptError(
        "Estudiante no autorizado",
        403
      );
    }

    // Verificar que el examen esté activo
    const examResult = await client.query(
      `SELECT id
       FROM exams
       WHERE id = $1
         AND is_active = TRUE
       FOR SHARE`,
      [examId]
    );

    if (examResult.rowCount === 0) {
      throw new AttemptError(
        "Examen no disponible",
        404
      );
    }

    // Verificar si ya existe un intento
    const previousAttempt = await client.query(
      `SELECT 1
       FROM exam_attempts
       WHERE user_id = $1
         AND exam_id = $2`,
      [studentId, examId]
    );

    if ((previousAttempt.rowCount ?? 0) > 0) {
      throw new AttemptError(
        "El examen ya fue presentado",
        409
      );
    }

    // Consultar todas las preguntas y su respuesta correcta
    const correctResult = await client.query<CorrectAnswerRow>(
      `SELECT
         q.number,
         o.code
       FROM questions q
       LEFT JOIN options o
         ON o.exam_id = q.exam_id
         AND o.question_number = q.number
         AND o.is_correct = TRUE
       WHERE q.exam_id = $1
       ORDER BY q.number`,
      [examId]
    );

    const correctAnswers = correctResult.rows;

    // Comprobar que el examen esté configurado
    if (
      correctAnswers.length === 0 ||
      correctAnswers.some((answer) => answer.code === null)
    ) {
      throw new AttemptError(
        "Examen mal configurado",
        409
      );
    }

    // Comprobar que todas las preguntas estén respondidas
    if (answers.length !== correctAnswers.length) {
      throw new AttemptError(
        "Debes responder todas las preguntas",
        400
      );
    }

    // Detectar preguntas duplicadas o inexistentes
    const questionNumbers = answers.map(
      (answer) => answer.questionNumber
    );

    const validQuestions = new Set(
      correctAnswers.map((answer) => answer.number)
    );

    if (
      new Set(questionNumbers).size !== answers.length ||
      questionNumbers.some(
        (number) => !validQuestions.has(number)
      )
    ) {
      throw new AttemptError(
        "Preguntas inválidas",
        400
      );
    }

    // Consultar las opciones válidas
    const optionsResult = await client.query<OptionRow>(
      `SELECT question_number, code
       FROM options
       WHERE exam_id = $1`,
      [examId]
    );

    // Comprobar que cada opción exista
    const invalidOption = answers.some(
      (answer) =>
        !optionsResult.rows.some(
          (option) =>
            option.question_number === answer.questionNumber &&
            option.code === answer.optionCode
        )
    );

    if (invalidOption) {
      throw new AttemptError(
        "Opciones inválidas",
        400
      );
    }

    // Guardar intento y respuestas en la misma transacción
    await saveExamAttempt(
      client,
      studentId,
      examId,
      answers
    );

    // Calcular los aciertos
    const details = correctAnswers.map((correct) => {
      const selected = answers.find(
        (answer) => answer.questionNumber === correct.number
      );

      return {
        questionNumber: correct.number,
        selectedOption: selected!.optionCode,
        correctOption: correct.code,
        isCorrect: selected!.optionCode === correct.code,
      };
    });

    const score = details.filter(
      (answer) => answer.isCorrect
    ).length;

    await client.query("COMMIT");

    return {
      score,
      total: correctAnswers.length,
      grade: `${score}/${correctAnswers.length}`,
      details,
    };
  } catch (error) {
    await client.query("ROLLBACK");

    // PostgreSQL: violación de clave única
    if (
      error !== null &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "23505"
    ) {
      throw new AttemptError(
        "El examen ya fue presentado",
        409
      );
    }

    throw error;
  } finally {
    client.release();
  }
}


export async function getStudentResult(
  studentId: string,
  examId: string
) {
  const attempt = await findAttemptResult(
    studentId,
    examId
  );

  if (!attempt) {
    return null;
  }

  const details = attempt.answers.map((answer) => ({
    questionNumber: answer.question_number,
    selectedOption: answer.selected_option,
    correctOption: answer.correct_option,
    isCorrect:
      answer.selected_option === answer.correct_option,
  }));

  const score = details.filter(
    (answer) => answer.isCorrect
  ).length;

  const total = details.length;

  return {
    examId,
    submittedAt: attempt.submittedAt,
    score,
    total,
    grade: `${score}/${total}`,
    details,
  };
}
