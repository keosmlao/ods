"use server";
import { logChange } from "@/lib/chatter-log";
import { query, queryOdg } from "@/lib/db";
import { requireRole } from "@/lib/guard";
import { revalidatePath } from "next/cache";
import { z } from "zod";

/**
 * **ນິຍາມອາໄຫຼ່ມາດຕະຖານຂອງງານຕິດຕັ້ງ** (ods_install_spare_standard) — ຜູ້ຈັດການຕັ້ງເອງ.
 *
 * ຄີ = ໝວດສິນຄ້າ (+ຂະໜາດ, ຫວ່າງ = ທຸກຂະໜາດ). ບໍ່ແມ່ນຕໍ່ລະຫັດສິນຄ້າ —
 * ສິນຄ້າ 376 ລະຫັດ/ປີ ດູແລບໍ່ໄຫວ ແລະ ອາໄຫຼ່ຕິດຕັ້ງຂຶ້ນກັບ **ປະເພດ/ຂະໜາດ** ຢູ່ແລ້ວ.
 * ເບິ່ງເຫດຜົນຄົບຢູ່ migrations/2026-07-31-install-standard.sql ແລະ lib/install-standard.
 */

export type StandardState = { error?: string; ok?: string };

const lineSchema = z.object({
  pro_type_code: z.string().trim().min(1, "ເລືອກໝວດສິນຄ້າ"),
  pro_size: z.string().trim().max(50).optional().default(""),
  item_code: z.string().trim().min(1, "ເລືອກອາໄຫຼ່"),
  qty: z.coerce.number().positive("ຈຳນວນຕ້ອງຫຼາຍກວ່າ 0"),
});

/** ຜູ້ຈັດການເທົ່ານັ້ນ — ນີ້ຄືກົດເກນຂອງທັງບໍລິສັດ ບໍ່ແມ່ນຄ່າຂອງງານໃດງານນຶ່ງ */
const MANAGER = ["manager"] as const;

export async function addStandardLine(_: StandardState, formData: FormData): Promise<StandardState> {
  const guard = await requireRole([...MANAGER], "ບໍ່ມີສິດຕັ້ງອາໄຫຼ່ມາດຕະຖານ");
  if (!guard.ok) return { error: guard.error };

  const parsed = lineSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "ຂໍ້ມູນບໍ່ຄົບ" };
  const d = parsed.data;

  // ຊື່/ຫົວໜ່ວຍເອົາຈາກ ERP ຝັ່ງ server — ບໍ່ເຊື່ອສິ່ງທີ່ browser ສົ່ງມາ
  let item: { name_1: string; unit_code: string | null } | undefined;
  try {
    item = (
      await queryOdg<{ name_1: string; unit_code: string | null }>(
        "select name_1, unit_standard as unit_code from ic_inventory where code = $1 limit 1",
        [d.item_code],
      )
    ).rows[0];
  } catch (error) {
    console.error("addStandardLine ERP lookup failed", error);
    return { error: "ຄົ້ນຫາລາຍການໃນ ERP ບໍ່ສຳເລັດ" };
  }
  if (!item) return { error: `ບໍ່ພົບອາໄຫຼ່ ${d.item_code} ໃນ ERP` };

  try {
    await query(
      `insert into ods_install_spare_standard(pro_type_code,pro_size,item_code,item_name,unit_code,qty,updated_by)
       values($1,$2,$3,$4,$5,$6,$7)
       on conflict (pro_type_code,pro_size,item_code)
       do update set qty=excluded.qty, item_name=excluded.item_name, unit_code=excluded.unit_code,
                     updated_by=excluded.updated_by, updated_at=localtimestamp(0)`,
      [d.pro_type_code, d.pro_size, d.item_code, item.name_1, item.unit_code, d.qty, guard.session.username],
    );
  } catch (error) {
    console.error("addStandardLine failed", error);
    return { error: "ບັນທຶກບໍ່ສຳເລັດ" };
  }

  await logChange(
    "ods_install_spare_standard",
    `${d.pro_type_code}${d.pro_size ? `/${d.pro_size}` : ""}`,
    `ຕັ້ງອາໄຫຼ່ມາດຕະຖານ: ${item.name_1} (${d.item_code}) × ${d.qty}`,
    { roles: ["manager"] },
  );
  revalidatePath("/manage/install-standard");
  return { ok: "ບັນທຶກແລ້ວ" };
}

export async function removeStandardLine(id: number): Promise<StandardState> {
  const guard = await requireRole([...MANAGER], "ບໍ່ມີສິດຕັ້ງອາໄຫຼ່ມາດຕະຖານ");
  if (!guard.ok) return { error: guard.error };

  const removed = await query<{ pro_type_code: string; pro_size: string; item_name: string }>(
    "delete from ods_install_spare_standard where id=$1 returning pro_type_code, pro_size, item_name",
    [id],
  );
  const row = removed.rows[0];
  if (!row) return { error: "ບໍ່ພົບລາຍການ" };

  await logChange(
    "ods_install_spare_standard",
    `${row.pro_type_code}${row.pro_size ? `/${row.pro_size}` : ""}`,
    `ຖອດອາໄຫຼ່ມາດຕະຖານ: ${row.item_name}`,
    { roles: ["manager"] },
  );
  revalidatePath("/manage/install-standard");
  return { ok: "ຖອດແລ້ວ" };
}
