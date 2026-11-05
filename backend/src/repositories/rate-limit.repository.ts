import { createHmac } from "node:crypto";
import type { Store, IncrementResponse } from "express-rate-limit";
import { pool } from "../config/database";

// Contadores compartidos entre procesos y conservados tras un reinicio.
// Solo se persisten HMAC: sin correos, IP ni contraseñas en texto.
export class PostgresRateLimitStore implements Store {
  readonly localKeys = false;
  readonly prefix: string;

  constructor(private readonly scope: string, private readonly windowMs: number) {
    this.prefix = `${scope}:`;
  }

  private hashKey(key: string): string {
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error("JWT_SECRET no configurada");
    return createHmac("sha256", secret).update(`${this.scope}:${key}`).digest("hex");
  }

  async increment(key: string): Promise<IncrementResponse> {
    const result = await pool.query<{ hits: number; expires_at: Date }>(
      `INSERT INTO auth_rate_limits (scope, key_hash, hits, expires_at)
       VALUES ($1, $2, 1, NOW() + $3 * INTERVAL '1 millisecond')
       ON CONFLICT (scope, key_hash) DO UPDATE SET
         hits = CASE WHEN auth_rate_limits.expires_at <= NOW() THEN 1
           ELSE LEAST(auth_rate_limits.hits, 2147483646) + 1 END,
         expires_at = CASE WHEN auth_rate_limits.expires_at <= NOW()
           THEN NOW() + $3 * INTERVAL '1 millisecond' ELSE auth_rate_limits.expires_at END
       RETURNING hits, expires_at`,
      [this.scope, this.hashKey(key), this.windowMs]
    );
    const row = result.rows[0]!;
    return { totalHits: row.hits, resetTime: row.expires_at };
  }

  async decrement(key: string): Promise<void> {
    await pool.query(
      `UPDATE auth_rate_limits SET hits = GREATEST(hits - 1, 0)
       WHERE scope = $1 AND key_hash = $2`,
      [this.scope, this.hashKey(key)]
    );
  }

  async resetKey(key: string): Promise<void> {
    await pool.query(`DELETE FROM auth_rate_limits WHERE scope = $1 AND key_hash = $2`,
      [this.scope, this.hashKey(key)]);
  }
}
