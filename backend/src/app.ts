import express from "express";
import cors from "cors";
import { pool } from "./config/database";

import studentRoutes from "./routes/student.routes";
import examRoutes from "./routes/exam.routes";
import attemptRoutes from "./routes/attempt.routes";

const app = express();

app.use(cors());
app.use(express.json());

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
    console.error("Error de conexión:", error);

    res.status(500).json({
      status: "error",
      message: "No se pudo conectar a PostgreSQL",
    });
  }
});

app.use("/api/students", studentRoutes);
app.use("/api/exams", examRoutes);
app.use("/api/students", attemptRoutes);

export default app;
