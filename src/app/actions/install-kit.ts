"use server";
import { query } from "@/lib/db";
import { requirePermission, runAction } from "@/lib/guard";
import { erpItem, INSTALL_KIT_MENU, isInstallKitType } from "@/lib/install-kit";
import { revalidatePath } from "next/cache";

/**
 * ── ແກ້ຊຸດອາໄຫຼ່ມາດຕະຖານ (`used_spare_install`) ──
 *
 * ດ່ານສິດໃຊ້ `requirePermission` ⇒ **ສິດລາຍຄົນຊະນະ role** (lib/permissions):
 * ມີແຖວໃນ ods_user_menu_permission ຂອງ /manage/install-kits → ໃຊ້ C/U/D ທີ່ຕິກ ·
 * ບໍ່ມີແຖວ → ຜູ້ຈັດການເທົ່ານັ້ນ (ຄືກັບ /manage/* ອື່ນ).
 *
 * ⚠️ ແກ້ຢູ່ນີ້ **ບໍ່ແຕະງານທີ່ເປີດໄປແລ້ວ** — createInstall ກ໋ອບຊຸດລົງກະຕ່າຂອງງານ
 * ຕອນເປີດງານເທື່ອດຽວ. ງານໃໝ່ເທົ່ານັ້ນທີ່ໄດ້ຊຸດຮຸ່ນໃໝ່.
 */

export type KitState = { error?: string; ok?: string };

const MANAGER_ONLY = ["manager"] as const;

/** ອ່ານຈຳນວນຈາກຟອມ — ຕ້ອງເປັນເລກບວກ (0 = ໃຫ້ໃຊ້ປຸ່ມລົບແທນ ຈະໄດ້ບໍ່ມີແຖວຂີ້ເຫຍື້ອ) */
function readQty(formData: FormData): number | null {
  const qty = Number(String(formData.get("qty") ?? "").trim());
  return Number.isFinite(qty) && qty > 0 ? Math.round(qty * 100) / 100 : null;
}

/** ເພີ່ມ 1 ລາຍການເຂົ້າຊຸດ — ຊື່/ຫົວໜ່ວຍເອົາຈາກ ERP ບໍ່ແມ່ນຈາກຟອມ */
export async function addInstallKitLine(_: KitState, formData: FormData): Promise<KitState> {
  return runAction("addInstallKitLine", async () => {
    const guard = await requirePermission(INSTALL_KIT_MENU, "create", MANAGER_ONLY);
    if (!guard.ok) return { error: guard.error };

    const installType = String(formData.get("install_type") ?? "").trim();
    if (!isInstallKitType(installType)) return { error: "ບໍ່ຮູ້ຈັກຊຸດຕິດຕັ້ງນີ້" };

    const itemCode = String(formData.get("ic_code") ?? "").trim();
    if (!itemCode) return { error: "ກະລຸນາລະບຸລະຫັດອາໄຫຼ່" };

    const qty = readQty(formData);
    if (qty === null) return { error: "ຈຳນວນຕ້ອງຫຼາຍກວ່າ 0" };

    let item: Awaited<ReturnType<typeof erpItem>>;
    try {
      item = await erpItem(itemCode);
    } catch (error) {
      console.error("addInstallKitLine ERP lookup failed", error);
      return { error: "ຄົ້ນຫາລາຍການໃນ ERP ບໍ່ສຳເລັດ" };
    }
    if (!item) return { error: `ບໍ່ພົບ ${itemCode} ໃນລາຍການສິນຄ້າຂອງ ERP` };

    // ຫົວໜ່ວຍທີ່ພິມມາເອງມາກ່ອນ (ຊຸດຕິດຕັ້ງໃຊ້ "ຕົວ" ຂະນະທີ່ ERP ຂາຍເປັນ "ກິໂລ")
    const unit = String(formData.get("unit_code") ?? "").trim() || item.unit_code;

    /**
     * ຢູ່ໃນຊຸດແລ້ວ ⇒ ບວກຈຳນວນທັບແທນການໃສ່ແຖວຊ້ຳ. ຊຸດເກົ່າມີແຖວຊ້ຳຢູ່ (9900-0018
     * ນ໋ອດລະເບີດ 4+1) ແລະ getStandardKitLines ກໍ່ sum ໃຫ້ຢູ່ແລ້ວ — ແຕ່ຢ່າສ້າງເພີ່ມ.
     */
    const existing = await query<{ roworder: number }>(
      "select roworder from used_spare_install where install_type=$1 and ic_code=$2 order by line_number limit 1",
      [installType, item.code],
    );
    if (existing.rows[0]) {
      await query("update used_spare_install set qty = coalesce(qty,0) + $1 where roworder=$2", [
        qty,
        existing.rows[0].roworder,
      ]);
      revalidatePath(INSTALL_KIT_MENU);
      return { ok: `ມີ ${item.code} ຢູ່ໃນຊຸດແລ້ວ — ບວກຈຳນວນເພີ່ມໃຫ້` };
    }

    await query(
      `insert into used_spare_install(install_type, line_number, ic_code, name_1, qty, unit_code, create_date_time_now)
       select $1, coalesce(max(line_number),0) + 1, $2, $3, $4, nullif($5,''), localtimestamp(0)
         from used_spare_install where install_type = $1`,
      [installType, item.code, item.name_1, qty, unit ?? ""],
    );
    revalidatePath(INSTALL_KIT_MENU);
    return { ok: `ເພີ່ມ ${item.code} ເຂົ້າຊຸດແລ້ວ` };
  });
}

/** ແກ້ຈຳນວນ / ຫົວໜ່ວຍ ຂອງ 1 ແຖວ */
export async function updateInstallKitLine(_: KitState, formData: FormData): Promise<KitState> {
  return runAction("updateInstallKitLine", async () => {
    const guard = await requirePermission(INSTALL_KIT_MENU, "update", MANAGER_ONLY);
    if (!guard.ok) return { error: guard.error };

    const roworder = Number(String(formData.get("roworder") ?? ""));
    if (!Number.isInteger(roworder)) return { error: "ບໍ່ພົບແຖວທີ່ຈະແກ້" };

    const qty = readQty(formData);
    if (qty === null) return { error: "ຈຳນວນຕ້ອງຫຼາຍກວ່າ 0" };

    const unit = String(formData.get("unit_code") ?? "").trim();
    const updated = await query(
      "update used_spare_install set qty=$1, unit_code=nullif($2,'') where roworder=$3",
      [qty, unit, roworder],
    );
    if (!updated.rowCount) return { error: "ບໍ່ພົບແຖວທີ່ຈະແກ້ (ອາດຖືກລົບໄປແລ້ວ)" };

    revalidatePath(INSTALL_KIT_MENU);
    return { ok: "ບັນທຶກແລ້ວ" };
  });
}

/** ຖອດ 1 ລາຍການອອກຈາກຊຸດ */
export async function deleteInstallKitLine(roworder: number): Promise<KitState> {
  return runAction("deleteInstallKitLine", async () => {
    const guard = await requirePermission(INSTALL_KIT_MENU, "delete", MANAGER_ONLY);
    if (!guard.ok) return { error: guard.error };
    if (!Number.isInteger(roworder)) return { error: "ບໍ່ພົບແຖວທີ່ຈະລົບ" };

    const removed = await query("delete from used_spare_install where roworder=$1", [roworder]);
    if (!removed.rowCount) return { error: "ບໍ່ພົບແຖວທີ່ຈະລົບ (ອາດຖືກລົບໄປແລ້ວ)" };

    revalidatePath(INSTALL_KIT_MENU);
    return { ok: "ລົບແລ້ວ" };
  });
}
