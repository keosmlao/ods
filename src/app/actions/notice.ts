"use server";
import { logChange } from "@/app/actions/chatter";
import { query } from "@/lib/db";
import { requireRole } from "@/lib/guard";
import { SERVICE_SIDE } from "@/lib/roles";
import { revalidatePath } from "next/cache";

/**
 * ລຶບ **ຄຳແຈ້ງສ້ອມຂອງລູກຄ້າ** (tb_product_notice).
 *
 * ── ອັນນີ້ບໍ່ແມ່ນ "ງານ" ──
 * ການລຶບ **ງານ** (tb_product / ods_tb_install) ຍັງ **ຫ້າມເດັດຂາດ** ຕາມນະໂຍບາຍ
 * (deleteService/deleteInstall ຖືກຖອດອອກໄປແລ້ວ — ມັນເຄີຍລຶບໃບສະເໜີລາຄາ, ໃບເບີກ
 * ແລະ ໃບຮັບເງິນຕິດໄປນຳ ໂດຍທີ່ສະຕັອກ ERP ຖືກຕັດໄປແລ້ວ).
 *
 * ຄຳແຈ້ງ ຄື "ລູກຄ້າໂທມາແຈ້ງວ່າເຄື່ອງເສຍ" — ຍັງບໍ່ມີເອກະສານ, ບໍ່ມີສະຕັອກ, ບໍ່ມີເງິນ
 * ຜູກຢູ່ນຳ ⇒ ລຶບຖິ້ມໄດ້ (ຄຳແຈ້ງທົດລອງ/ຊ້ຳ/ຜິດ).
 *
 * ── ດ່ານດຽວທີ່ຕ້ອງມີ ──
 * ຄຳແຈ້ງທີ່ **ເປີດງານໄປແລ້ວ** ລຶບບໍ່ໄດ້ — ໃບຮັບເຄື່ອງອ້າງອີງມັນຢູ່ (tb_product.ref_notice)
 * ຖ້າລຶບ ໃບນັ້ນຈະຊີ້ໄປຫາຄຳແຈ້ງທີ່ບໍ່ມີຕົວຕົນ ແລະ ຕົ້ນທາງຂອງງານຈະຫາຍ.
 */
export type NoticeState = { error?: string; ok?: string };

export async function deleteNotice(code: string): Promise<NoticeState> {
  const guard = await requireRole(SERVICE_SIDE, "ພະນັກງານບໍລິການເທົ່ານັ້ນທີ່ລຶບຄຳແຈ້ງໄດ້");
  if (!guard.ok) return { error: guard.error };

  // ເປີດງານໄປແລ້ວ = ມີໃບຮັບເຄື່ອງອ້າງອີງຢູ່ ⇒ ລຶບບໍ່ໄດ້ (ເງື່ອນໄຂຢູ່ໃນ WHERE)
  const removed = await query<{ code: string; name_1: string | null; issue: string | null }>(
    `delete from tb_product_notice a
      where a.code = $1
        and not exists (select 1 from tb_product p where p.ref_notice = a.code)
      returning a.code, a.name_1, a.issue`,
    [code],
  );

  if (!removed.rowCount) {
    const opened = await query<{ code: string }>("select code from tb_product where ref_notice = $1 limit 1", [code]);
    return {
      error: opened.rowCount
        ? `ລຶບບໍ່ໄດ້ — ຄຳແຈ້ງນີ້ເປີດເປັນໃບຮັບເຄື່ອງ #${opened.rows[0].code} ໄປແລ້ວ`
        : "ບໍ່ພົບຄຳແຈ້ງນີ້",
    };
  }

  const row = removed.rows[0];
  // ຫຼັກຖານວ່າໃຜລຶບ ເມື່ອໃດ — ຕົວຄຳແຈ້ງຫາຍໄປແລ້ວ ຈຶ່ງບັນທຶກໃສ່ລູກຄ້າ… ບໍ່ມີລູກຄ້າແນ່ນອນ
  // ⇒ ບັນທຶກເປັນກິດຈະກຳຂອງຕົວຄຳແຈ້ງເອງ (ອ່ານໄດ້ຢູ່ໜ້າ "ກິດຈະກຳ")
  await logChange("tb_product_notice", code, `ລຶບຄຳແຈ້ງສ້ອມ: ${row.name_1 ?? "-"} · ${row.issue ?? "-"}`);

  revalidatePath("/service/notices");
  return { ok: `ລຶບຄຳແຈ້ງ ${code} ແລ້ວ` };
}
