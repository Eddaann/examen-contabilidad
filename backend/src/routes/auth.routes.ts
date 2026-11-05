import { Router } from "express";

import {
  register,
  login,
  getCurrentUser,
  logout,
} from "../controllers/auth.controller";

import { requireAuth } from "../middlewares/auth.middleware";

const router = Router();

// Rutas públicas
router.post("/register", register);
router.post("/login", login);

// Rutas protegidas
router.get("/me", requireAuth, getCurrentUser);

router.post("/logout", logout);

export default router;
