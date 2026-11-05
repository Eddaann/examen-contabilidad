import type { Request } from "express";
import { rateLimit, ipKeyGenerator } from "express-rate-limit";
import { PostgresRateLimitStore } from "../repositories/rate-limit.repository";

interface LimitPolicy {
  windowMs: number;
  ipLimit: number;
  accountLimit: number;
}

const defaultPolicies = {
  login: { windowMs: 15 * 60 * 1000, ipLimit: 30, accountLimit: 10 },
  register: { windowMs: 60 * 60 * 1000, ipLimit: 10, accountLimit: 3 },
};

export function createAuthRateLimits(policies: {
  login: LimitPolicy;
  register: LimitPolicy;
} = defaultPolicies) {
  function limits(action: "login" | "register") {
    const policy = policies[action];
    const common = {
      windowMs: policy.windowMs,
      standardHeaders: "draft-7" as const,
      legacyHeaders: false,
      // Fallar de forma cerrada: un error de almacenamiento no permite Argon2.
      passOnStoreError: false,
      message: { message: "Demasiadas solicitudes. Intenta de nuevo más tarde" },
    };
    return [
      rateLimit({
        ...common,
        limit: policy.ipLimit,
        store: new PostgresRateLimitStore(`${action}:ip`, policy.windowMs),
        keyGenerator: (req: Request) => ipKeyGenerator(req.ip ?? req.socket.remoteAddress ?? "unknown"),
      }),
      rateLimit({
        ...common,
        limit: policy.accountLimit,
        store: new PostgresRateLimitStore(`${action}:account`, policy.windowMs),
        // No se consulta si la cuenta existe: la respuesta no lo revela.
        keyGenerator: (req: Request) => typeof req.body?.email === "string"
          ? req.body.email.trim().toLowerCase()
          : "invalid-account",
      }),
    ];
  }
  return { login: limits("login"), register: limits("register") };
}
