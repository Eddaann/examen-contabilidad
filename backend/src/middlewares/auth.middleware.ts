import type {
  Request,
  Response,
  NextFunction,
} from "express";
import jwt from "jsonwebtoken";

import {
  findUserById,
  type AuthenticatedUser,
} from "../repositories/auth.repository";

interface SessionPayload extends jwt.JwtPayload {
  sub: string;
  type: "authenticated";
}

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
    const secret = process.env.JWT_SECRET;

    if (!secret) {
      throw new Error("JWT_SECRET no configurada");
    }

    const decoded = jwt.verify(token, secret, {
      algorithms: ["HS256"],
    });

    if (
      typeof decoded === "string" ||
      decoded.type !== "authenticated" ||
      typeof decoded.sub !== "string" ||
      !/^[1-9]\d*$/.test(decoded.sub) ||
      BigInt(decoded.sub) > 9223372036854775807n
    ) {
      res.status(401).json({
        message: "Sesión no válida",
      });
      return;
    }

    const payload = decoded as SessionPayload;

    const user = await findUserById(payload.sub);

    if (!user) {
      res.status(401).json({
        message: "Usuario no autorizado",
      });
      return;
    }

    res.locals.authUser = user satisfies AuthenticatedUser;

    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      res.status(401).json({
        message: "Sesión no válida o expirada",
      });
      return;
    }

    console.error("Error al validar sesión:", error);

    res.status(500).json({
      message: "Error interno del servidor",
    });
  }
}
