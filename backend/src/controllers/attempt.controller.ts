
import type { Request, Response } from "express";
import {
  getAttemptStatus,
  submitExam,
  AttemptError,
} from "../services/attempt.service";

const MAX_BIGINT = 9223372036854775807n;

function isValidId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[1-9]\d*$/.test(value) &&
    BigInt(value) <= MAX_BIGINT
  );
}

// Consultar el estado de un examen
export async function getStudentAttemptStatus(
  req: Request,
  res: Response
): Promise<void> {
  const studentId: unknown = res.locals.studentId;
  const { examId } = req.params;

  if (!isValidId(studentId) || !isValidId(examId)) {
    res.status(400).json({
      message: "Identificador inválido",
    });
    return;
  }

  try {
    const status = await getAttemptStatus(
      studentId,
      examId
    );

    if (!status) {
      res.status(404).json({
        message: "Estudiante o examen no encontrado",
      });
      return;
    }

    res.status(200).json(status);
  } catch (error) {
    console.error("Error al consultar intento:", error);

    res.status(500).json({
      message: "Error interno del servidor",
    });
  }
}

// Enviar las respuestas del examen
export async function submitStudentExam(
  req: Request,
  res: Response
): Promise<void> {
  const studentId: unknown = res.locals.studentId;
  const { examId } = req.params;
  const { answers } = req.body ?? {};

  // Validar identificadores
  if (!isValidId(studentId) || !isValidId(examId)) {
    res.status(400).json({
      message: "Identificador inválido",
    });
    return;
  }

  // Validar estructura de las respuestas
  if (
    !Array.isArray(answers) ||
    !answers.every(
      (answer) =>
        answer !== null &&
        typeof answer === "object" &&
        Number.isInteger(answer.questionNumber) &&
        answer.questionNumber > 0 &&
        typeof answer.optionCode === "string" &&
        answer.optionCode.length > 0
    )
  ) {
    res.status(400).json({
      message: "Formato de respuestas inválido",
    });
    return;
  }

  try {
    const result = await submitExam(
      studentId,
      examId,
      answers
    );

    res.status(201).json({
      message: "Examen enviado correctamente",
      result,
    });
  } catch (error) {
    if (error instanceof AttemptError) {
      res.status(error.statusCode).json({
        message: error.message,
      });
      return;
    }

    console.error("Error al enviar examen:", error);

    res.status(500).json({
      message: "Error interno del servidor",
    });
  }
}
