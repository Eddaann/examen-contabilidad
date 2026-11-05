import { Router } from "express";
import { getExam } from "../controllers/exam.controller";
import { submitStudentExam } from "../controllers/attempt.controller";
import { requireStudentSession } from "../middlewares/student-session.middleware";

const router = Router();

router.get("/:examId", getExam);

router.post(
  "/:examId/submit",
  requireStudentSession,
  submitStudentExam
);

export default router;