import { Router } from "express";
import { getCurrentExam, getExam } from "../controllers/exam.controller";
import { submitStudentExam } from "../controllers/attempt.controller";
import { requireStudentSession } from "../middlewares/student-session.middleware";

import { requireAuth } from "../middlewares/auth.middleware";
import { requirePermission } from "../middlewares/permission.middleware";

const router = Router();

router.get("/current", requireAuth, requirePermission("exam:read"), getCurrentExam);

router.get("/:examId", requireAuth, requirePermission("exam:read"), getExam);

router.post(
  "/:examId/submit",
  requireStudentSession,
  requirePermission("exam:submit"),
  submitStudentExam
);

export default router;
