import type { Request, Response, NextFunction } from "express";
import { requireAuth } from "./auth.middleware";
import type { AuthenticatedUser } from "../repositories/auth.repository";

export async function requireStudentSession(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  await requireAuth(req, res, () => {
    const user = res.locals.authUser as AuthenticatedUser;

    if (!user.roles.includes("STUDENT")) {
      res.status(403).json({ message: "Estudiante no autorizado" });
      return;
    }

    res.locals.studentId = user.id;
    next();
  });
}
