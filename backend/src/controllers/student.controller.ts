import type { Request, Response } from "express";
import jwt from "jsonwebtoken";
import { validateStudentAccess } from "../services/student.service";

export async function studentAccess(
  req: Request,
  res: Response
): Promise<void> {
  const { email } = req.body ?? {};

  // Validar el formato del correo
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
    // Buscar al estudiante en PostgreSQL
    const student = await validateStudentAccess(email);

    if (!student) {
      res.status(404).json({
        message: "Estudiante no registrado",
      });
      return;
    }

    // Verificar que exista la clave de firma
    const secret = process.env.JWT_SECRET;

    if (!secret) {
      throw new Error("JWT_SECRET no configurada");
    }

    // Generar token de sesión
    const token = jwt.sign(
      {
        sub: student.id,
        type: "student-demo",
      },
      secret,
      {
        expiresIn: "2h",
      }
    );

    // Guardar el token en una cookie HTTP-only
    res.cookie("student_session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 2 * 60 * 60 * 1000,
    });

    // Responder al frontend
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
