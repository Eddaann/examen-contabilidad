import type { Request, Response } from "express";

import {
  AuthError,
  registerStudent,
  loginUser,
} from "../services/auth.service";
import jwt from "jsonwebtoken";

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

export async function login(
  req: Request,
  res: Response
): Promise<void> {
  const { email, password } = req.body ?? {};

  if (
    typeof email !== "string" ||
    typeof password !== "string" ||
    !email.trim() ||
    !password
  ) {
    res.status(400).json({
      message: "Correo y contraseña son obligatorios",
    });
    return;
  }

  try {
    const user = await loginUser(email, password);

    const secret = process.env.JWT_SECRET;

    if (!secret) {
      throw new Error("JWT_SECRET no configurada");
    }

    const token = jwt.sign(
      {
        sub: user.id,
        type: "authenticated",
      },
      secret,
      {
        expiresIn: "2h",
      }
    );

    res.cookie("auth_session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 2 * 60 * 60 * 1000,
    });

    res.status(200).json({
      message: "Sesión iniciada correctamente",
      user,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      res.status(error.statusCode).json({
        message: error.message,
      });
      return;
    }

    console.error("Error al iniciar sesión:", error);

    res.status(500).json({
      message: "Error interno del servidor",
    });
  }
}
