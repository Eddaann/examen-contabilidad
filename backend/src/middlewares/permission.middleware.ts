import type {
  Request,
  Response,
  NextFunction,
} from "express";

import { findUserPermissions } from "../repositories/permission.repository";
import type { AuthenticatedUser } from "../repositories/auth.repository";

export function requirePermission(permission: string) {
  return async (
    _req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    const user = res.locals.authUser as
      | AuthenticatedUser
      | undefined;

    if (!user) {
      res.status(401).json({
        message: "Sesión no válida",
      });
      return;
    }

    try {
      const permissions = await findUserPermissions(user.id);

      if (!permissions.includes(permission)) {
        res.status(403).json({
          message: "No tienes permiso para realizar esta acción",
        });
        return;
      }

      next();
    } catch (error) {
      console.error("Error al verificar permisos:");

      res.status(500).json({
        message: "Error interno del servidor",
      });
    }
  };
}
