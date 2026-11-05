import type {
  Request,
  Response,
  NextFunction,
} from "express";
import { readSessionToken } from "../services/session.service";

import {
  findUserById,
  type AuthenticatedUser,
} from "../repositories/auth.repository";

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const token: unknown = req.cookies?.auth_session;

  if (typeof token !== "string") {
    res.status(401).json({
      message: "Sesión no válida",
    });
    return;
  }

  try {
    const identity = readSessionToken(token);
    if (!identity) {
      res.status(401).json({ message: "Sesión no válida o expirada" });
      return;
    }
    const user = await findUserById(identity.userId, identity.sessionId);

    if (!user) {
      res.status(401).json({
        message: "Usuario no autorizado",
      });
      return;
    }

    res.locals.authUser = user satisfies AuthenticatedUser;

    next();
  } catch (error) {
    console.error("Error al validar sesión:");

    res.status(500).json({
      message: "Error interno del servidor",
    });
  }
}
