import app from "./app";
import { pool } from "./config/database";
import { SchemaError, validateSchema } from "./config/schema";

const PORT = Number(process.env.PORT ?? 3000);

async function start(): Promise<void> {
  await validateSchema();
  app.listen(PORT, () => {
    console.log(`Servidor iniciado en http://localhost:${PORT}`);
  });
}

start().catch(async (error: unknown) => {
  console.error(error instanceof SchemaError
    ? error.message
    : "No se pudo iniciar el backend. Revisa la conexión y los permisos de PostgreSQL.");
  process.exitCode = 1;
  await pool.end();
});
