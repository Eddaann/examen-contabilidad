import type { Request, Response } from "express";
import { getAttemptStatus } from "../services/attempt.service";

const MAX_BIGINT = 9223372036854775807n;

function isValidId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[1-9]\d*$/.test(value) &&
    BigInt(value) <= MAX_BIGINT
  );
}

export async function getStudentAttemptStatus(
  req: Request,
  res: Response
): Promise<void> {
  // Obtener el estudiante desde la sesión
  const studentId: unknown = res.locals.studentId;

  // Obtener el examen desde la URL
  const { examId } = req.params;

  if (!isValidId(studentId) || !isValidId(examId)) {
    res.status(400).json({
      message: "Identificador inválido",
    });
    return;
  }

  try {
    const status = await getAttemptStatus(studentId, examId);

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
