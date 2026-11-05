import { Router } from "express";
import { getExam } from "../controllers/exam.controller";
import { submitStudentExam } from "../controllers/attempt.controller";
import { requireStudentSession } from "../middlewares/student-session.middleware";

import { requireAuth } from "../middlewares/auth.middleware";
import { requirePermission } from "../middlewares/permission.middleware";

const router = Router();

router.get("/:examId", requireAuth, requirePermission("exam:read"), getExam);

router.post(
  "/:examId/submit",
  requireStudentSession,
  requirePermission("exam:submit"),
  submitStudentExam
);

export default router;
