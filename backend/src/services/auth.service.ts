import argon2 from "argon2";

import {
  createStudent,
  findUserByEmail,
  findUserCredentials,
} from "../repositories/auth.repository";

export class AuthError extends Error {
  constructor(
    message: string,
    public statusCode: number
  ) {
    super(message);
    this.name = "AuthError";
  }
}

export async function registerStudent(
  email: string,
  password: string
) {
  const normalizedEmail = email.trim().toLowerCase();

  // Validar correo electrónico
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (
    normalizedEmail.length > 255 ||
    !emailRegex.test(normalizedEmail)
  ) {
    throw new AuthError(
      "Correo electrónico inválido",
      400
    );
  }

  // Validar longitud de contraseña
  if (
    password.length < 12 ||
    password.length > 128
  ) {
    throw new AuthError(
      "La contraseña debe tener entre 12 y 128 caracteres",
      400
    );
  }

  // Comprobar si el correo ya existe
  const existingUser = await findUserByEmail(
    normalizedEmail
  );

  if (existingUser) {
    throw new AuthError(
      "El correo ya está registrado",
      409
    );
  }

  // Generar hash seguro
  const passwordHash = await argon2.hash(password, {
    type: argon2.argon2id,
  });

  try {
    const user = await createStudent(
      normalizedEmail,
      passwordHash
    );

    return user;
  } catch (error) {
    // Evitar registros duplicados en peticiones simultáneas
    if (
      error !== null &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "23505"
    ) {
      throw new AuthError(
        "El correo ya está registrado",
        409
      );
    }

    throw error;
  }
}

export async function loginUser(
  email: string,
  password: string
) {
  const normalizedEmail = email.trim().toLowerCase();

  const user = await findUserCredentials(
    normalizedEmail
  );

  // Mismo error para correo desconocido y contraseña incorrecta
  if (!user || !user.password_hash) {
    throw new AuthError(
      "Credenciales incorrectas",
      401
    );
  }

  const validPassword = await argon2.verify(
    user.password_hash,
    password
  );

  if (!validPassword) {
    throw new AuthError(
      "Credenciales incorrectas",
      401
    );
  }

  return {
    id: user.id,
    email: user.email,
    roles: user.roles ?? [],
    sessionVersion: user.session_version,
  };
}
