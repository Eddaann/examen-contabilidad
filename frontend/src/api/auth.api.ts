import { ApiError, apiRequest } from "./client";

export interface AuthUser {
  id: string;
  email: string;
  roles: string[];
}

export async function login(email: string, password: string): Promise<AuthUser> {
  const data = await apiRequest("/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
    statusMessages: { 401: "Correo o contraseña incorrectos" },
  });

  return parseUser(data);
}

function parseUser(data: unknown): AuthUser {
  const user = data !== null && typeof data === "object" && "user" in data ? data.user : null;
  if (
    user === null || typeof user !== "object" ||
    !("id" in user) || typeof user.id !== "string" ||
    !("email" in user) || typeof user.email !== "string" ||
    !("roles" in user) || !Array.isArray(user.roles) ||
    !user.roles.every((role: unknown) => typeof role === "string")
  ) {
    throw new ApiError("El servidor devolvió una respuesta inválida. Inténtalo de nuevo.");
  }

  return { id: user.id, email: user.email, roles: user.roles };
}

export async function logout(): Promise<void> {
  await apiRequest("/auth/logout", { method: "POST" });
}

export async function getCurrentUser(): Promise<AuthUser> {
  return parseUser(await apiRequest("/auth/me"));
}
