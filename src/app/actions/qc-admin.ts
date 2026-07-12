"use server";
import type { Workflow } from "@/lib/commission";
import { db, query } from "@/lib/db";
import { requireRole } from "@/lib/guard";
import { ROLES, type Role } from "@/lib/roles";
import { revalidatePath } from "next/cache";
import { z } from "zod";

/**
 * ຕັ້ງລາຍການກວດຮັບຄຸນນະພາບ ແລະ ກຳນົດວ່າ **ໃຜກວດໄດ້** — ຜູ້ຈັດການເທົ່ານັ້ນ.
 *
 * ຢູ່ໄຟລ໌ຄົນລະອັນກັບ actions/qc.ts ໂດຍເຈດຕະນາ: ອັນນັ້ນເປັນຂອງ "ຜູ້ກວດ"
 * (ໃຜກໍ່ໄດ້ທີ່ຖືກກຳນົດ) ອັນນີ້ເປັນຂອງ "ຜູ້ຕັ້ງກົດ" (ຜູ້ຈັດການ) ⇒ ດ່ານກວດສິດຄົນລະຊັ້ນ
 * ຈຶ່ງບໍ່ຄວນປົນຢູ່ໄຟລ໌ດຽວກັນ.
 */
export type QcAdminState = { error?: string; ok?: string };

const MANAGER: Role[] = ["manager"];
const NO_RIGHT = "ຜູ້ຈັດການເທົ່ານັ້ນທີ່ຕັ້ງລາຍການກວດຮັບໄດ້";

export type QcItemRow = {
  id: number;
  workflow: Workflow;
  category_code: string | null;
  name: string;
  sort_order: number;
  require_photo: boolean;
  is_active: boolean;
  /** ໃຊ້ໄປແລ້ວຈັກງານ — ມີຜົນກວດແລ້ວ ຈຶ່ງລົບບໍ່ໄດ້ (ໄດ້ແຕ່ປິດ) */
  used: number;
};

export async function qcItems(): Promise<QcItemRow[]> {
  const guard = await requireRole(MANAGER, NO_RIGHT);
  if (!guard.ok) return [];
  return (
    await query<QcItemRow>(
      `select i.id, i.workflow, i.category_code, i.name, i.sort_order, i.require_photo, i.is_active,
          (select count(*)::int from ods_qc_result r where r.item_id = i.id) as used
        from ods_qc_item i
       order by i.workflow, i.sort_order, i.id`,
    )
  ).rows;
}

/** ໃຜກວດໄດ້ — ຄູ່ (workflow, role) ທີ່ເປີດຢູ່ */
export async function qcRoles(): Promise<{ workflow: Workflow; role: Role }[]> {
  const guard = await requireRole(MANAGER, NO_RIGHT);
  if (!guard.ok) return [];
  return (await query<{ workflow: Workflow; role: Role }>("select workflow, role from ods_qc_role")).rows;
}

const itemSchema = z.object({
  id: z.coerce.number().int().optional(),
  workflow: z.enum(["repair", "install"]),
  category_code: z.string().optional(),
  name: z.string().min(1, "ຕ້ອງໃສ່ຊື່ລາຍການ"),
  sort_order: z.coerce.number().int().min(0).max(999),
  require_photo: z.coerce.boolean(),
});

export async function saveQcItem(_: QcAdminState, formData: FormData): Promise<QcAdminState> {
  const guard = await requireRole(MANAGER, NO_RIGHT);
  if (!guard.ok) return { error: guard.error };

  const parsed = itemSchema.safeParse({
    id: formData.get("id") || undefined,
    workflow: formData.get("workflow"),
    category_code: formData.get("category_code") ?? "",
    name: formData.get("name"),
    sort_order: formData.get("sort_order") || 0,
    require_photo: formData.get("require_photo") === "on",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "ຂໍ້ມູນບໍ່ຖືກຕ້ອງ" };
  const item = parsed.data;

  const params = [
    item.workflow,
    item.category_code?.trim() || "",
    item.name.trim(),
    item.sort_order,
    item.require_photo,
    guard.session.username,
  ];

  if (item.id) {
    await query(
      `update ods_qc_item
          set workflow=$1, category_code=nullif($2,''), name=$3, sort_order=$4, require_photo=$5,
              updated_by=$6, updated_at=localtimestamp(0)
        where id=$7`,
      [...params, item.id],
    );
  } else {
    await query(
      `insert into ods_qc_item(workflow, category_code, name, sort_order, require_photo, updated_by)
       values($1,nullif($2,''),$3,$4,$5,$6)`,
      params,
    );
  }

  revalidatePath("/manage/qc-checklist");
  return { ok: "ບັນທຶກແລ້ວ" };
}

/**
 * ເປີດ/ປິດ ລາຍການ — **ບໍ່ມີການລົບ**.
 * ຜົນກວດເກົ່າ (ods_qc_result) ອ້າງ item_id ຢູ່ ⇒ ລົບແລ້ວປະຫວັດການກວດຂາດ.
 */
export async function toggleQcItem(id: number, active: boolean): Promise<QcAdminState> {
  const guard = await requireRole(MANAGER, NO_RIGHT);
  if (!guard.ok) return { error: guard.error };

  await query(
    "update ods_qc_item set is_active=$2, updated_by=$3, updated_at=localtimestamp(0) where id=$1",
    [id, active, guard.session.username],
  );
  revalidatePath("/manage/qc-checklist");
  return { ok: active ? "ເປີດໃຊ້ແລ້ວ" : "ປິດແລ້ວ" };
}

/**
 * ກຳນົດວ່າ role ໃດກວດ QC ໄດ້ — ຂຽນທັບທັງຊຸດໃນ transaction ດຽວ.
 *
 * ຫ້າມປະຫວ່າງທັງສາຍງານ: ບໍ່ມີໃຜກວດໄດ້ = ງານທຸກງານຄ້າງຢູ່ຂັ້ນ QC ຕະຫຼອດການ
 * (ຕິດຕັ້ງປິດງານບໍ່ໄດ້ · ສ້ອມອອກໃບຮັບເງິນບໍ່ໄດ້) ⇒ ລະບົບຢຸດທັງໝົດຢ່າງງຽບໆ.
 */
export async function saveQcRoles(pairs: { workflow: Workflow; role: Role }[]): Promise<QcAdminState> {
  const guard = await requireRole(MANAGER, NO_RIGHT);
  if (!guard.ok) return { error: guard.error };
  if (!db) return { error: "ບໍ່ພົບ DATABASE_URL" };

  const clean = pairs.filter(
    (pair) => (pair.workflow === "install" || pair.workflow === "repair") && (ROLES as readonly string[]).includes(pair.role),
  );
  for (const workflow of ["install", "repair"] as const) {
    if (!clean.some((pair) => pair.workflow === workflow)) {
      return { error: `ຕ້ອງມີຢ່າງໜ້ອຍ 1 ຕຳແໜ່ງທີ່ກວດ QC ຂອງສາຍງານ "${workflow === "install" ? "ຕິດຕັ້ງ" : "ສ້ອມແປງ"}" ໄດ້` };
    }
  }

  const client = await db.connect();
  try {
    await client.query("begin");
    await client.query("delete from ods_qc_role");
    for (const pair of clean) {
      await client.query("insert into ods_qc_role(workflow, role) values($1,$2) on conflict do nothing", [
        pair.workflow,
        pair.role,
      ]);
    }
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    console.error("saveQcRoles failed", error);
    return { error: "ບັນທຶກບໍ່ສຳເລັດ" };
  } finally {
    client.release();
  }

  revalidatePath("/manage/qc-checklist");
  return { ok: "ບັນທຶກຜູ້ມີສິດກວດແລ້ວ" };
}
