import { Router } from "express";
import { studentAccess } from "../controllers/student.controller";

const router = Router();

router.post("/access", studentAccess);

export default router;
