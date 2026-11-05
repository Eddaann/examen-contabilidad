import { Router } from "express";
import { requireAuth } from "../middlewares/auth.middleware";
import { requirePermission } from "../middlewares/permission.middleware";
import {
  getStudents,
  getResults,
} from "../controllers/teacher.controller";

const router = Router();

router.use(requireAuth);

router.get(
  "/students",
  requirePermission("student:read:all"),
  getStudents
);

router.get(
  "/results",
  requirePermission("result:read:all"),
  getResults
);

export default router;
