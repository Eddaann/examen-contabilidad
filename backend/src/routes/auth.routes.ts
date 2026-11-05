import { Router } from "express";

import {
  register,
  login,
  getCurrentUser,
  logout,
} from "../controllers/auth.controller";

import { requireAuth } from "../middlewares/auth.middleware";
import { createAuthRateLimits } from "../middlewares/auth-rate-limit.middleware";

const router = Router();
const limits = createAuthRateLimits();

// Rutas públicas
router.post("/register", ...limits.register, register);
router.post("/login", ...limits.login, login);

// Rutas protegidas
router.get("/me", requireAuth, getCurrentUser);

router.post("/logout", logout);

export default router;
