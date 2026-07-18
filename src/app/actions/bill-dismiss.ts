"use server";
import { logChange } from "@/lib/chatter-log";
import { query } from "@/lib/db";
import { requireRole } from "@/lib/guard";
import { PENDING_BILL_COUNT_TAG } from "@/lib/nav-counts";
import { SERVICE_SIDE } from "@/lib/roles";
import { revalidatePath, updateTag } from "next/cache";

/**
 * **ໝາຍວ່າບິນນີ້ຄົບແລ້ວ** — ບໍ່ໃຫ້ຂຶ້ນຄິວ "ບິນຄ້າງອອກໃບງານ" ອີກ.
 *
 * ຄິວນັ້ນນັບຈາກ **ຄ່າຕິດຕັ້ງໃນບິນ ERP** ທຽບກັບ **ໃບງານ ODS** ⇒ ບາງບິນຄ້າງຕະຫຼອດໄປ
 * ໂດຍບໍ່ມີໃຜຜິດ (ລູກຄ້າຍົກເລີກ · ຕິດເອງ · ບິນເກົ່າທີ່ຕິດໄປແລ້ວແຕ່ບໍ່ໄດ້ເປີດໃບງານ)
 * ⇒ ຄິວທີ່ **ປິດບໍ່ໄດ້** ຄືຄິວທີ່ຄົນຈະເລີກເບິ່ງ.
 *
 * ⚠️ ບໍ່ແມ່ນການລຶບ — ບິນຍັງຢູ່ ERP ຄືເກົ່າ. ບັນທຶກ **ເຫດຜົນ + ຜູ້ໝາຍ** ໄວ້ເປັນຫຼັກຖານ
 * ແລະ **ຍົກເລີກການໝາຍໄດ້** (ບິນກັບຂຶ້ນຄິວຄືເກົ່າ).
 */
export type DismissState = { error?: string; ok?: string };

export async function dismissBill(docNo: string, reason: string): Promise<DismissState> {
  const guard = await requireRole(SERVICE_SIDE, "ບໍ່ມີສິດໝາຍບິນ");
  if (!guard.ok) return { error: guard.error };

  const clean = reason.trim();
  if (!docNo.trim()) return { error: "ບໍ່ພົບເລກບິນ" };
  // ບັງຄັບໃສ່ເຫດຜົນ — ບໍ່ດັ່ງນັ້ນມື້ໜ້າບໍ່ມີໃຜຮູ້ວ່າເປັນຫຍັງບິນນີ້ບໍ່ມີໃບງານ
  if (clean.length < 3) return { error: "ກະລຸນາໃສ່ເຫດຜົນ (ເປັນຫຼັກຖານ)" };

  await query(
    `insert into ods_bill_dismissed(doc_no, reason, dismissed_by)
     values($1,$2,$3)
     on conflict (doc_no) do update
        set reason = excluded.reason, dismissed_by = excluded.dismissed_by,
            dismissed_at = localtimestamp(0)`,
    [docNo.trim(), clean, guard.session.username],
  );

  await logChange("ic_trans", docNo.trim(), `ໝາຍບິນ ${docNo} ວ່າບໍ່ຕ້ອງເປີດໃບງານ · ເຫດຜົນ: ${clean}`);

  revalidatePath("/installations/pending-bills");
  updateTag(PENDING_BILL_COUNT_TAG);
  return { ok: `ໝາຍ ${docNo} ວ່າຄົບແລ້ວ` };
}

/** ຍົກເລີກການໝາຍ — ບິນກັບຂຶ້ນຄິວຄືເກົ່າ */
export async function restoreBill(docNo: string): Promise<DismissState> {
  const guard = await requireRole(SERVICE_SIDE, "ບໍ່ມີສິດແກ້ໄຂ");
  if (!guard.ok) return { error: guard.error };

  await query("delete from ods_bill_dismissed where doc_no = $1", [docNo]);
  await logChange("ic_trans", docNo, `ຍົກເລີກການໝາຍບິນ ${docNo} — ກັບຂຶ້ນຄິວຄ້າງອອກໃບງານ`);

  revalidatePath("/installations/pending-bills");
  updateTag(PENDING_BILL_COUNT_TAG);
  return { ok: "ຍົກເລີກການໝາຍແລ້ວ" };
}
