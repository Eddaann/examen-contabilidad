import { Router } from "express";
import { getExam } from "../controllers/exam.controller";
import { submitStudentExam } from "../controllers/attempt.controller";
import { requireStudentSession } from "../middlewares/student-session.middleware";

import { requireAuth } from "../middlewares/auth.middleware";

const router = Router();

router.get("/:examId", requireAuth, getExam);

router.post(
  "/:examId/submit",
  requireStudentSession,
  submitStudentExam
);

export default router;