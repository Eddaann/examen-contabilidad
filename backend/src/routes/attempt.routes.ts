import { Router } from "express";

import {
  getStudentAttemptStatus,
  getStudentExamResult,
} from "../controllers/attempt.controller";

import { requireStudentSession } from "../middlewares/student-session.middleware";
import { requirePermission } from "../middlewares/permission.middleware";

const router = Router();

router.get(
  "/me/exams/:examId/status",
  requireStudentSession,
  requirePermission("result:read:own"),
  getStudentAttemptStatus
);

router.get(
  "/me/exams/:examId/result",
  requireStudentSession,
  requirePermission("result:read:own"),
  getStudentExamResult
);

export default router;
