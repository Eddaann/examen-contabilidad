import { pool } from "./database";

// Consultas sin filas: PostgreSQL valida tablas y columnas sin leer datos.
const requiredTables = {
  users: "id, email, password_hash, session_version",
  roles: "id, code, name",
  permissions: "id, code, description",
  user_roles: "user_id, role_id",
  role_permissions: "role_id, permission_id",
  exams: "id, title, description, is_active",
  questions: "exam_id, number, statement",
  options: "exam_id, question_number, code, text, is_correct",
  exam_attempts: "user_id, exam_id, submitted_at, score, total_questions",
  attempt_answers: "user_id, exam_id, question_number, option_code, correct_option_code, is_correct, statement, selected_option_text, correct_option_text",
  auth_sessions: "id, user_id, session_version, created_at, expires_at",
  auth_rate_limits: "scope, key_hash, hits, expires_at",
};

export class SchemaError extends Error {}

export async function validateSchema(): Promise<void> {
  for (const [table, columns] of Object.entries(requiredTables)) {
    try {
      await pool.query(`SELECT ${columns} FROM ${table} LIMIT 0`);
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (code === "42P01" || code === "42703") {
        throw new SchemaError(
          `Esquema incompleto: revisa la tabla ${table}. Aplica las migraciones pendientes de database/migrations en orden antes de iniciar el backend.`
        );
      }
      throw error;
    }
  }
}
