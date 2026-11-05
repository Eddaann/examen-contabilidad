import type { Request, Response } from "express";
import { findAllStudents } from "../repositories/teacher.repository";

export async function getStudents(
  _req: Request,
  res: Response
): Promise<void> {
  try {
    const students = await findAllStudents();

    res.status(200).json({ students });
  } catch (error) {
    console.error("Error al consultar estudiantes:", error);

    res.status(500).json({
      message: "Error interno del servidor",
    });
  }
}
