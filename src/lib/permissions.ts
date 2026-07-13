import "server-only";

import type { Session } from "@/lib/auth";
import { query } from "@/lib/db";
import {
  actionForPath,
  type CrudPermission,
  type PermissionAction,
  resourceForPath,
} from "@/lib/permission-catalog";
import { canAccess, roleOf } from "@/lib/roles";

type PermissionRow = {
  resource: string;
  can_read: boolean;
  can_create: boolean;
  can_update: boolean;
  can_delete: boolean;
};

const EMPTY: CrudPermission = { read: false, create: false, update: false, delete: false };

function toCrud(row: PermissionRow): CrudPermission {
  return {
    read: row.can_read,
    create: row.can_create,
    update: row.can_update,
    delete: row.can_delete,
  };
}

function missingTable(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "42P01";
}

/**
 * session.username ສ່ວນໃຫຍ່ເປັນ employee_code; ຍັງຮອງຮັບຊື່ເກົ່າຜ່ານ
 * ods_user_employee ແລະ identity ຂອງ ods_employee_role.
 */
export async function permissionOverrides(username: string): Promise<Map<string, CrudPermission>> {
  try {
    const rows = (
      await query<PermissionRow>(
        `select p.resource, p.can_read, p.can_create, p.can_update, p.can_delete
           from ods_user_menu_permission p
          where lower(p.employee_code) = lower($1)
             or p.employee_code in (
                  select employee_code from ods_user_employee
                   where lower(user_code) = lower($1) or lower(employee_code) = lower($1)
                )
             or p.employee_code in (
                  select employee_code from ods_employee_role
                   where lower(identity) = lower($1) or lower(employee_code) = lower($1)
                )`,
        [username],
      )
    ).rows;
    return new Map(rows.map((row) => [row.resource, toCrud(row)]));
  } catch (error) {
    // ຊ່ວງ deploy code ກ່ອນ migration: ຮັກສາ role ເກົ່າໄວ້ ບໍ່ໃຫ້ທັງລະບົບລົ້ມ.
    if (missingTable(error)) return new Map();
    throw error;
  }
}

export async function employeePermissionOverrides(employeeCode: string): Promise<Map<string, CrudPermission>> {
  try {
    const rows = (
      await query<PermissionRow>(
        `select resource, can_read, can_create, can_update, can_delete
           from ods_user_menu_permission
          where employee_code = $1`,
        [employeeCode],
      )
    ).rows;
    return new Map(rows.map((row) => [row.resource, toCrud(row)]));
  } catch (error) {
    if (missingTable(error)) return new Map();
    throw error;
  }
}

export function permissionFromOverrides(
  session: Session,
  resource: string,
  overrides: ReadonlyMap<string, CrudPermission>,
): CrudPermission {
  // ສິດຄຸ້ມຄອງ permission ບໍ່ໃຫ້ delegate/ປິດຈົນລະບົບ lock out.
  if (resource === "/manage/employees") {
    const allowed = roleOf(session) === "manager";
    return { read: allowed, create: allowed, update: allowed, delete: allowed };
  }

  const assigned = overrides.get(resource);
  if (assigned) return assigned;

  const read = canAccess(roleOf(session), resource);
  return read ? { read: true, create: true, update: true, delete: true } : EMPTY;
}

export async function permissionFor(session: Session, resource: string): Promise<CrudPermission> {
  return permissionFromOverrides(session, resource, await permissionOverrides(session.username));
}

export async function canUser(
  session: Session,
  resourceOrPath: string,
  action?: PermissionAction,
): Promise<boolean> {
  const resource = resourceForPath(resourceOrPath) ?? resourceOrPath;
  const operation = action ?? actionForPath(resourceOrPath);
  const permission = await permissionFor(session, resource);
  return permission.read && permission[operation];
}

/** ກັ່ນ sidebar ດ້ວຍ read ຈາກ permission override ຫຼື role ເກົ່າ. */
export async function readableResources(session: Session): Promise<string[]> {
  const overrides = await permissionOverrides(session.username);
  const resources = new Set<string>();
  const { PERMISSION_RESOURCES } = await import("@/lib/permission-catalog");
  for (const item of PERMISSION_RESOURCES) {
    if (permissionFromOverrides(session, item.resource, overrides).read) resources.add(item.resource);
  }
  return [...resources];
}
