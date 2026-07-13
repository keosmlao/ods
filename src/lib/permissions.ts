import "server-only";

import type { Session } from "@/lib/auth";
import { query, queryOdg } from "@/lib/db";
import { getEmployeeOverride } from "@/lib/employee-role";
import { ERP_IDENTITY_SQL, roleFromErp } from "@/lib/erp-auth";
import {
  actionForPath,
  type CrudPermission,
  type PermissionAction,
  resourceForPath,
} from "@/lib/permission-catalog";
import { canAccess, normalizeRole, roleOf, type Role } from "@/lib/roles";

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

export type EmployeePermissionProfile = {
  employeeCode: string;
  identity: string;
  fullname: string;
  role: Role;
};

/** profile + effective role ດ້ວຍລຳດັບດຽວກັບຕອນ login. */
export async function employeePermissionProfile(employeeCode: string): Promise<EmployeePermissionProfile | null> {
  const employee = (
    await queryOdg<{
      identity: string | null;
      fullname_lo: string | null;
      app_role: string | null;
      position_code: string | null;
      department_code: string | null;
    }>(
      `select ${ERP_IDENTITY_SQL} as identity, e.fullname_lo, e.app_role, e.position_code, e.department_code
         from odg_employee e
        where e.employee_code = $1 and e.employment_status = 'ACTIVE'
        limit 1`,
      [employeeCode],
    )
  ).rows[0];
  if (!employee) return null;

  const identity = (employee.identity ?? "").trim() || (employee.fullname_lo ?? "").trim() || employeeCode;
  const [override, legacy] = await Promise.all([
    getEmployeeOverride(employeeCode),
    query<{ roles: string }>(
      `select roles from users
        where lower(username) in (lower($1), lower($2), lower($3))
        order by case roles when 'manager' then 1 when 'headtechnical' then 2 else 3 end
        limit 1`,
      [employeeCode, identity, (employee.fullname_lo ?? "").trim()],
    ),
  ]);

  const role = override?.app_role
    ? normalizeRole(override.app_role)
    : legacy.rows[0]?.roles
      ? normalizeRole(legacy.rows[0].roles)
      : normalizeRole(roleFromErp(employee.app_role, employee.position_code, employee.department_code));

  return {
    employeeCode,
    identity,
    fullname: (employee.fullname_lo ?? "").trim() || "-",
    role,
  };
}
