import { Router } from "express";
import { getStudentAttemptStatus } from "../controllers/attempt.controller";
import { requireStudentSession } from "../middlewares/student-session.middleware";

const router = Router();

router.get(
  "/me/exams/:examId/status",
  requireStudentSession,
  getStudentAttemptStatus
);

export default router;