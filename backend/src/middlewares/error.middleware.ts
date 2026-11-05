import type { ErrorRequestHandler } from "express";

export const errorHandler: ErrorRequestHandler = (
  error: unknown,
  _req,
  res,
  next
): void => {
  // Nunca propagar el error original: puede contener el cuerpo o credenciales.
  if (res.headersSent) {
    next(new Error("Error interno del servidor"));
    return;
  }

  const type = error !== null && typeof error === "object" && "type" in error
    ? error.type
    : undefined;

  switch (type) {
    case "entity.parse.failed":
      res.status(400).json({ message: "JSON inválido" });
      return;
    case "entity.too.large":
      res.status(413).json({ message: "La petición supera el tamaño permitido" });
      return;
    case "charset.unsupported":
    case "encoding.unsupported":
      res.status(415).json({ message: "Codificación no admitida" });
      return;
    case "request.aborted":
    case "request.size.invalid":
      res.status(400).json({ message: "Petición inválida" });
      return;
    default:
      // Campos fijos: sin cuerpo, cookies, cabeceras, URL, mensaje ni stack.
      console.error("Error interno de API", { statusCode: 500 });
      res.status(500).json({ message: "Error interno del servidor" });
  }
};
