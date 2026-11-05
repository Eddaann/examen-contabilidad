export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

interface RequestOptions extends Omit<RequestInit, "signal"> {
  timeoutMs?: number;
  statusMessages?: Partial<Record<number, string>>;
}

function retryAfter(value: string | null): number | undefined {
  if (!value) return undefined;
  const seconds = /^\d+$/.test(value) ? Number(value) : (Date.parse(value) - Date.now()) / 1000;
  return Number.isFinite(seconds) && seconds > 0 ? Math.ceil(seconds) : undefined;
}

export async function apiRequest(path: string, options: RequestOptions = {}): Promise<unknown> {
  const { timeoutMs = 15000, statusMessages, ...requestOptions } = options;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`/api${path}`, {
      ...requestOptions,
      credentials: "include",
      signal: controller.signal,
    });

    if (!response.ok) {
      const seconds = retryAfter(response.headers.get("Retry-After"));
      const messages: Record<number, string> = {
        400: "Revisa los datos e inténtalo de nuevo.",
        401: "Tu sesión venció. Inicia sesión nuevamente.",
        403: "No tienes permiso para realizar esta acción.",
        404: "No se encontró la información solicitada.",
        409: "La operación no está disponible en el estado actual.",
        429: seconds
          ? `Demasiadas solicitudes. Inténtalo de nuevo en ${Math.ceil(seconds / 60)} min.`
          : "Demasiadas solicitudes. Inténtalo más tarde.",
      };
      // No mostrar cuerpos del servidor
      throw new ApiError(
        statusMessages?.[response.status] ?? messages[response.status]
          ?? "El servicio no está disponible. Inténtalo más tarde.",
        response.status,
        seconds,
      );
    }

    if (response.status === 204) return null;
    try {
      return await response.json();
    } catch {
      if (controller.signal.aborted) throw new ApiError("La solicitud tardó demasiado. Inténtalo de nuevo.");
      throw new ApiError("El servidor devolvió una respuesta inválida. Inténtalo de nuevo.");
    }
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (controller.signal.aborted) {
      throw new ApiError("La solicitud tardó demasiado. Inténtalo de nuevo.");
    }
    throw new ApiError("No se pudo conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.");
  } finally {
    clearTimeout(timer);
  }
}

export function errorMessage(error: unknown): string {
  return error instanceof ApiError
    ? error.message
    : "Ocurrió un error inesperado. Inténtalo de nuevo.";
}
