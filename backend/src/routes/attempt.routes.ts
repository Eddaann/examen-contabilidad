import { Router } from "express";

import {
  getStudentAttemptStatus,
  getStudentExamResult,
} from "../controllers/attempt.controller";

import { requireStudentSession } from "../middlewares/student-session.middleware";

const router = Router();

router.get(
  "/me/exams/:examId/status",
  requireStudentSession,
  getStudentAttemptStatus
);

router.get(
  "/me/exams/:examId/result",
  requireStudentSession,
  getStudentExamResult
);

export default router;