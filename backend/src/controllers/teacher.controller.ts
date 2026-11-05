import type { Request, Response } from "express";
import { findAllStudents } from "../repositories/teacher.repository";
import { getAllStudentResults } from "../services/teacher.service";

export async function getStudents(
  _req: Request,
  res: Response
): Promise<void> {
  try {
    const students = await findAllStudents();

    res.status(200).json({ students });
  } catch (error) {
    console.error("Error al consultar estudiantes:");

    res.status(500).json({
      message: "Error interno del servidor",
    });
  }
}

export async function getResults(
  _req: Request,
  res: Response
): Promise<void> {
  try {
    const results = await getAllStudentResults();

    res.status(200).json({ results });
  } catch (error) {
    console.error("Error al consultar calificaciones:");

    res.status(500).json({
      message: "Error interno del servidor",
    });
  }
}
