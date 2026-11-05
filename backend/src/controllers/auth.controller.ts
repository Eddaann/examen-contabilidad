import type { Request, Response } from "express";

import {
  AuthError,
  registerStudent,
} from "../services/auth.service";

export async function register(
  req: Request,
  res: Response
): Promise<void> {
  const { email, password } = req.body ?? {};

  // Comprobar el tipo de datos recibidos
  if (
    typeof email !== "string" ||
    typeof password !== "string"
  ) {
    res.status(400).json({
      message: "Correo y contraseña son obligatorios",
    });
    return;
  }

  try {
    const user = await registerStudent(
      email,
      password
    );

    res.status(201).json({
      message: "Usuario registrado correctamente",
      user,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      res.status(error.statusCode).json({
        message: error.message,
      });
      return;
    }

    console.error("Error al registrar usuario:", error);

    res.status(500).json({
      message: "Error interno del servidor",
    });
  }
}
