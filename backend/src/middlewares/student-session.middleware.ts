import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

interface StudentToken {
  sub: string;
  type: "student-demo";
}

export function requireStudentSession(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const token = req.cookies?.student_session;
  const secret = process.env.JWT_SECRET;

  if (typeof token !== "string" || !secret) {
    res.status(401).json({
      message: "Sesión no válida",
    });
    return;
  }

  try {
    const decoded = jwt.verify(token, secret);

    if (
      typeof decoded === "string" ||
      decoded.type !== "student-demo" ||
      typeof decoded.sub !== "string"
    ) {
      res.status(401).json({
        message: "Sesión no válida",
      });
      return;
    }

    const student: StudentToken = {
      sub: decoded.sub,
      type: "student-demo",
    };

    res.locals.studentId = student.sub;

    next();
  } catch {
    res.status(401).json({
      message: "Sesión expirada o inválida",
    });
  }
}
