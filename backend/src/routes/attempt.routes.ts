import { Router } from "express";
import { getStudentAttemptStatus } from "../controllers/attempt.controller";

const router = Router();

router.get(
  "/:studentId/exams/:examId/status",
  getStudentAttemptStatus
);

export default router;