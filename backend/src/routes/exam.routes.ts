import { Router } from "express";
import { getExam } from "../controllers/exam.controller";

const router = Router();

router.get("/:examId", getExam);

export default router;