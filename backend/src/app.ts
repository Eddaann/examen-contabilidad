import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { errorHandler } from "./middlewares/error.middleware";

import { pool } from "./config/database";

import authRoutes from "./routes/auth.routes";
import teacherRoutes from "./routes/teacher.routes";
import examRoutes from "./routes/exam.routes";
import attemptRoutes from "./routes/attempt.routes";

const app = express();

// Docker publica únicamente Nginx: se confía en ese único salto.
// En ejecución directa se ignoran las cabeceras de proxy del cliente.
app.set("trust proxy", process.env.TRUST_PROXY === "1" ? 1 : false);

// Middlewares
app.use(cors({
  origin: "http://localhost:5173",
  credentials: true,
}));

app.use(express.json());
app.use(cookieParser());

// Health checks
app.get("/api/health", (_req, res) => {
  res.status(200).json({
    status: "ok",
    message: "API funcionando correctamente",
  });
});

app.get("/api/health/db", async (_req, res) => {
  try {
    const result = await pool.query("SELECT NOW() AS fecha");

    res.status(200).json({
      status: "ok",
      database: "connected",
      fecha: result.rows[0].fecha,
    });
  } catch (error) {
    console.error("Error de conexión:");

    res.status(500).json({
      status: "error",
      message: "No se pudo conectar a PostgreSQL",
    });
  }
});

// Rutas de la API
app.use("/api/auth", authRoutes);
app.use("/api/teacher", teacherRoutes);
app.use("/api/exams", examRoutes);
app.use("/api/students", attemptRoutes);

// Debe ir después de los parsers y de todas las rutas.
app.use(errorHandler);

export default app;
