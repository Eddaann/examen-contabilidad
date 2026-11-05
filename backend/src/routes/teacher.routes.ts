import { Router } from "express";

import { requireAuth } from "../middlewares/auth.middleware";
import { requirePermission } from "../middlewares/permission.middleware";
import { getStudents } from "../controllers/teacher.controller";

const router = Router();

router.use(requireAuth);

router.get(
  "/students",
  requirePermission("student:read:all"),
  getStudents
);

export default router;
