import { pool } from "../config/database";

import {
  findAttempt,
  findAttemptResult,
  saveExamAttempt,
  isStudent,
  doesExamExist,
  lockActiveExam,
  findCorrectAnswers,
  findExamOptions,
  type SubmittedAnswer,
} from "../repositories/attempt.repository";

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
  const studentExists = await isStudent(studentId);

  if (!studentExists) {
    return null;
  }

  const examExists = await doesExamExist(examId);

  if (!examExists) {
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
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ");

    // Verificar el rol del estudiante
    const studentExists = await isStudent(studentId, client);

    if (!studentExists) {
      throw new AttemptError(
        "Estudiante no autorizado",
        403
      );
    }

    // Verificar que el examen esté activo
    const examAvailable = await lockActiveExam(examId, client);

    if (!examAvailable) {
      throw new AttemptError(
        "Examen no disponible",
        404
      );
    }

    // Verificar si ya existe un intento
    const previousAttempt = await findAttempt(studentId, examId, client);

    if (previousAttempt) {
      throw new AttemptError(
        "El examen ya fue presentado",
        409
      );
    }

    // Consultar todas las preguntas y su respuesta correcta
    const correctAnswers = await findCorrectAnswers(examId, client);

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
    const options = await findExamOptions(examId, client);

    // Comprobar que cada opción exista
    const invalidOption = answers.some(
      (answer) =>
        !options.some(
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

    // Calcular los aciertos
    const details = correctAnswers.map((correct) => {
      const selected = answers.find(
        (answer) => answer.questionNumber === correct.number
      );

      return {
        questionNumber: correct.number,
        statement: correct.statement,
        selectedOptionText: options.find(option =>
          option.question_number === correct.number && option.code === selected!.optionCode)!.text,
        correctOptionText: correct.correct_text ?? correct.code!,
        selectedOption: selected!.optionCode,
        correctOption: correct.code!,
        isCorrect: selected!.optionCode === correct.code,
      };
    });

    const score = details.filter(
      (answer) => answer.isCorrect
    ).length;

    await saveExamAttempt(
      client, studentId, examId, details, score, correctAnswers.length
    );

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
    statement: answer.statement,
    selectedOptionText: answer.selected_option_text,
    correctOptionText: answer.correct_option_text ?? answer.correct_option,
    selectedOption: answer.selected_option,
    correctOption: answer.correct_option,
    isCorrect: answer.is_correct,
  }));

  const { score, total } = attempt;

  return {
    examId,
    submittedAt: attempt.submittedAt,
    score,
    total,
    grade: `${score}/${total}`,
    details,
  };
}
