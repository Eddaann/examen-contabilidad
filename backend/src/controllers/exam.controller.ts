import type { Request, Response } from "express";
import { getExamById } from "../services/exam.service";

export async function getExam(
  req: Request,
  res: Response
): Promise<void> {
  const examId = req.params.examId;

  if (
    typeof examId !== "string" ||
    !/^[1-9]\d*$/.test(examId) ||
    BigInt(examId) > 9223372036854775807n
  ) {
    res.status(400).json({
      message: "Identificador de examen inválido",
    });
    return;
  }

  try {
    const exam = await getExamById(examId);

    if (!exam) {
      res.status(404).json({
        message: "Examen no encontrado",
      });
      return;
    }

    res.status(200).json(exam);
  } catch (error) {
    console.error("Error al consultar examen:");

    res.status(500).json({
      message: "Error interno del servidor",
    });
  }
}
