import type { Request, Response } from "express";
import {
  AuthError,
  registerStudent,
  loginUser,
} from "../services/auth.service";
import { issueSession, revokeSession } from "../services/session.service";
import type { AuthenticatedUser } from "../repositories/auth.repository";

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

    console.error("Error al registrar usuario:");

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
    const { sessionVersion, ...user } = await loginUser(email, password);
    const token = await issueSession(user.id, sessionVersion);

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

    console.error("Error al iniciar sesión:");

    res.status(500).json({
      message: "Error interno del servidor",
    });
  }
}

export function getCurrentUser(
  _req: Request,
  res: Response
): void {
  const user: AuthenticatedUser = res.locals.authUser;

  res.status(200).json({
    user,
  });
}

export async function logout(
  req: Request,
  res: Response
): Promise<void> {
  try {
    await revokeSession(req.cookies?.auth_session);
    res.clearCookie("auth_session", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    });
    res.status(200).json({ message: "Sesión cerrada correctamente" });
  } catch {
    console.error("Error al revocar sesión");
    res.status(500).json({ message: "No se pudo revocar la sesión" });
  }
}
