import { pool } from "../config/database";

interface PermissionRow {
  code: string;
}

export async function findUserPermissions(
  userId: string
): Promise<string[]> {
  const result = await pool.query<PermissionRow>(
    `SELECT DISTINCT p.code
     FROM permissions p
     JOIN role_permissions rp
       ON rp.permission_id = p.id
     JOIN user_roles ur
       ON ur.role_id = rp.role_id
     WHERE ur.user_id = $1`,
    [userId]
  );

  return result.rows.map((permission) => permission.code);
}
