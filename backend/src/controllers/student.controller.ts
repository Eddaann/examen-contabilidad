import type { Request, Response } from "express";
import { validateStudentAccess } from "../services/student.service";

export async function studentAccess(
  req: Request,
  res: Response
): Promise<void> {
  const { email } = req.body;

  if (
    typeof email !== "string" ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
  ) {
    res.status(400).json({
      message: "Correo electrónico inválido",
    });
    return;
  }

  try {
    const student = await validateStudentAccess(email);

    if (!student) {
      res.status(404).json({
        message: "Estudiante no registrado",
      });
      return;
    }

    res.status(200).json({
      message: "Estudiante encontrado",
      student,
    });
  } catch (error) {
    console.error("Error al validar estudiante:", error);

    res.status(500).json({
      message: "Error interno del servidor",
    });
  }
}
