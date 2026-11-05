import { randomUUID } from "node:crypto";
import jwt from "jsonwebtoken";
import { createSession, deleteSession } from "../repositories/session.repository";
import { AuthError } from "./auth.service";

const SESSION_SECONDS = 2 * 60 * 60;

interface SessionIdentity {
  userId: string;
  sessionId: string;
}

export function readSessionToken(token: unknown): SessionIdentity | null {
  if (typeof token !== "string") return null;
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET no configurada");

  try {
    const decoded = jwt.verify(token, secret, { algorithms: ["HS256"] });
    if (
      typeof decoded === "string" ||
      decoded.type !== "authenticated" ||
      typeof decoded.sub !== "string" ||
      !/^[1-9]\d*$/.test(decoded.sub) ||
      BigInt(decoded.sub) > 9223372036854775807n ||
      typeof decoded.jti !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(decoded.jti) ||
      typeof decoded.exp !== "number"
    ) return null;
    return { userId: decoded.sub, sessionId: decoded.jti };
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) return null;
    throw error;
  }
}

export async function issueSession(userId: string, sessionVersion: number): Promise<string> {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET no configurada");
  const sessionId = randomUUID();
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = now + SESSION_SECONDS;
  const token = jwt.sign(
    { sub: userId, type: "authenticated", jti: sessionId, iat: now, exp: expiresAt },
    secret,
    { algorithm: "HS256" }
  );
  const created = await createSession(sessionId, userId, sessionVersion, new Date(expiresAt * 1000));
  if (!created) throw new AuthError("Las credenciales cambiaron; inicia sesión de nuevo", 401);
  return token;
}

export async function revokeSession(token: unknown): Promise<void> {
  const identity = readSessionToken(token);
  if (identity) await deleteSession(identity.sessionId, identity.userId);
}
