"use server";

import { db } from "@/lib/db";
import { requireRole } from "@/lib/guard";
import { PERMISSION_RESOURCES } from "@/lib/permission-catalog";
import { employeePermissionProfile } from "@/lib/permissions";
import { revalidatePath } from "next/cache";
import { z } from "zod";

export type PermissionActionState = { ok?: string; error?: string };

const resourceMap = new Map(PERMISSION_RESOURCES.map((item) => [item.resource, item]));
const entrySchema = z.object({
  resource: z.string().max(120),
  inherit: z.boolean(),
  read: z.boolean(),
  create: z.boolean(),
  update: z.boolean(),
  delete: z.boolean(),
});
const inputSchema = z.object({
  employeeCode: z.string().trim().min(1).max(32),
  entries: z.array(entrySchema).max(PERMISSION_RESOURCES.length),
});

export type PermissionInput = z.input<typeof inputSchema>;

export async function saveEmployeePermissions(input: PermissionInput): Promise<PermissionActionState> {
  const guard = await requireRole(["manager"], "ຜູ້ຈັດການເທົ່ານັ້ນທີ່ກຳນົດສິດໄດ້");
  if (!guard.ok) return { error: guard.error };

  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return { error: "ຂໍ້ມູນສິດບໍ່ຖືກຕ້ອງ" };
  if (!(await employeePermissionProfile(parsed.data.employeeCode))) return { error: "ບໍ່ພົບພະນັກງານໃນ ERP" };

  const seen = new Set<string>();
  for (const entry of parsed.data.entries) {
    const resource = resourceMap.get(entry.resource);
    if (!resource || resource.protected || seen.has(entry.resource)) return { error: "ພົບເມນູທີ່ບໍ່ອະນຸຍາດ" };
    seen.add(entry.resource);
    if (!entry.read && (entry.create || entry.update || entry.delete)) {
      return { error: "ຕ້ອງມີສິດອ່ານກ່ອນສິດສ້າງ/ແກ້ໄຂ/ລົບ" };
    }
    const allowedActions = new Set(resource.actions ?? ["read", "create", "update", "delete"]);
    if (
      (!allowedActions.has("create") && entry.create) ||
      (!allowedActions.has("update") && entry.update) ||
      (!allowedActions.has("delete") && entry.delete)
    ) {
      return { error: `ສິດຂອງເມນູ ${resource.label} ບໍ່ຖືກຕ້ອງ` };
    }
  }

  if (!db) return { error: "DATABASE_URL is not configured" };
  const client = await db.connect();
  try {
    await client.query("begin");
    for (const entry of parsed.data.entries) {
      if (entry.inherit) {
        await client.query(
          "delete from ods_user_menu_permission where employee_code = $1 and resource = $2",
          [parsed.data.employeeCode, entry.resource],
        );
        continue;
      }
      await client.query(
        `insert into ods_user_menu_permission(
           employee_code, resource, can_read, can_create, can_update, can_delete, updated_by, updated_at
         ) values ($1,$2,$3,$4,$5,$6,$7,localtimestamp(0))
         on conflict (employee_code, resource) do update set
           can_read = excluded.can_read,
           can_create = excluded.can_create,
           can_update = excluded.can_update,
           can_delete = excluded.can_delete,
           updated_by = excluded.updated_by,
           updated_at = excluded.updated_at`,
        [
          parsed.data.employeeCode,
          entry.resource,
          entry.read,
          entry.create,
          entry.update,
          entry.delete,
          guard.session.username,
        ],
      );
    }
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    console.error("saveEmployeePermissions failed", error);
    return { error: "ບັນທຶກສິດບໍ່ສຳເລັດ" };
  } finally {
    client.release();
  }

  revalidatePath(`/manage/employees/${parsed.data.employeeCode}/permissions`);
  revalidatePath("/", "layout");
  return { ok: "ບັນທຶກສິດເມນູ ແລະ CRUD ແລ້ວ" };
}
