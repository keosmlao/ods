"use server";
import { query } from "@/lib/db";
import { requirePermission, runAction } from "@/lib/guard";
import {
  erpItem,
  erpItemUnits,
  findInstallKitType,
  INSTALL_KIT_MENU,
  isSafeKitCode,
} from "@/lib/install-kit";
import { revalidatePath } from "next/cache";

/**
 * ── ແກ້ຊຸດອາໄຫຼ່ມາດຕະຖານ (`used_spare_install`) + ໝວດຂອງມັນ (`install_kit_type`) ──
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

/**
 * ຫົວໜ່ວຍທີ່ຟອມສົ່ງມາຕ້ອງ **ຢູ່ໃນລາຍການທີ່ ERP ອະນຸຍາດ** ຂອງສິນຄ້ານັ້ນ (ic_unit_use)
 * — ບໍ່ແມ່ນຮັບຄ່າພິມມືເໝືອນເກົ່າ. ຄ່າຫວ່າງ = ໃຊ້ຫົວໜ່ວຍມາດຕະຖານຂອງສິນຄ້າ.
 * ERP ລົ້ມ/ບໍ່ມີແຖວ ⇒ ຍອມຮັບຄ່າທີ່ສົ່ງມາ (ຢ່າໃຫ້ໜ້າຈັດການໃຊ້ບໍ່ໄດ້ຍ້ອນ ERP).
 */
async function pickUnit(
  itemCode: string,
  requested: string,
  fallback: string | null,
): Promise<string> {
  const want = requested.trim();
  if (!want) return fallback ?? "";
  let units: string[] = [];
  try {
    units = await erpItemUnits(itemCode);
  } catch (error) {
    console.error("pickUnit: unit lookup failed", error);
    return want;
  }
  if (!units.length || units.includes(want)) return want;
  return fallback ?? "";
}

/* ══════════════════ ໝວດຊຸດ (install_kit_type) ══════════════════ */

/**
 * ── ສ້າງໝວດໃໝ່ ──
 * ລະຫັດໝວດຄົນຕັ້ງເອງ (ຮູບແບບເກົ່າ 9900-00xx) ແຕ່ບໍ່ບັງຄັບຮູບແບບນັ້ນ — ບັງຄັບແຕ່
 * ຕົວອັກສອນທີ່ປອດໄພ (isSafeKitCode) ເພາະຄ່ານີ້ຖືກຕໍ່ເຂົ້າ `case ... end` ຂອງ SQL ບິນ.
 */
export async function addInstallKitType(_: KitState, formData: FormData): Promise<KitState> {
  return runAction("addInstallKitType", async () => {
    const guard = await requirePermission(INSTALL_KIT_MENU, "create", MANAGER_ONLY);
    if (!guard.ok) return { error: guard.error };

    const code = String(formData.get("install_type") ?? "").trim();
    if (!code) return { error: "ກະລຸນາລະບຸລະຫັດໝວດ" };
    if (!isSafeKitCode(code))
      return { error: "ລະຫັດໝວດໃຊ້ໄດ້ແຕ່ ຕົວອັກສອນ, ເລກ ແລະ ຂີດ (-) ຍາວບໍ່ເກີນ 25" };

    const name = String(formData.get("name_1") ?? "").trim();
    if (!name) return { error: "ກະລຸນາລະບຸຊື່ໝວດ (ຕົວຢ່າງ: 20,000-29,999 btu.)" };

    const size = String(formData.get("ic_size") ?? "").trim();
    if (size && !isSafeKitCode(size)) return { error: "ລະຫັດຂະໜາດ (ic_size) ບໍ່ຖືກຕ້ອງ" };

    const sort = Number(String(formData.get("sort_order") ?? "0"));

    if (await findInstallKitType(code)) return { error: `ມີໝວດ ${code} ຢູ່ແລ້ວ` };

    /**
     * ຂະໜາດດຽວກັນຖືກໝວດອື່ນ**ທີ່ເປີດໃຊ້ຢູ່**ຈອງໄປແລ້ວ ⇒ ປະຕິເສດພ້ອມບອກວ່າໝວດໃດຈອງ.
     * ຖ້າປ່ອຍໃຫ້ຊ້ຳ `case ... end` ຈະຈັບອັນທຳອິດ ⇒ ໝວດໃໝ່ບໍ່ມີວັນຖືກໃຊ້ ແລະ ຄົນຕັ້ງຄ່າ
     * ຫາສາເຫດບໍ່ພົບ (unique index ຂອງຖານກັນໄວ້ນຳ ແຕ່ຢູ່ນີ້ໄດ້ຂໍ້ຄວາມທີ່ອ່ານຮູ້).
     */
    if (size) {
      const taken = await query<{ install_type: string }>(
        "select install_type from install_kit_type where ic_size=$1 and coalesce(active,1)=1 limit 1",
        [size],
      );
      if (taken.rows[0])
        return { error: `ຂະໜາດນີ້ຖືກໝວດ ${taken.rows[0].install_type} ໃຊ້ຢູ່ແລ້ວ` };
    }

    await query(
      `insert into install_kit_type(install_type, name_1, ic_size, sort_order, active, create_date_time_now)
       values ($1, $2, nullif($3,''), $4, 1, localtimestamp(0))`,
      [code, name, size, Number.isFinite(sort) ? Math.trunc(sort) : 0],
    );
    revalidatePath(INSTALL_KIT_MENU);
    return { ok: `ສ້າງໝວດ ${code} ແລ້ວ — ຕໍ່ໄປໃສ່ລາຍການອາໄຫຼ່ໃຫ້ມັນ` };
  });
}

/** ແກ້ຊື່ / ຂະໜາດທີ່ຜູກ / ລຳດັບ / ເປີດ-ປິດ ຂອງໝວດ */
export async function updateInstallKitType(_: KitState, formData: FormData): Promise<KitState> {
  return runAction("updateInstallKitType", async () => {
    const guard = await requirePermission(INSTALL_KIT_MENU, "update", MANAGER_ONLY);
    if (!guard.ok) return { error: guard.error };

    const code = String(formData.get("install_type") ?? "").trim();
    const current = await findInstallKitType(code);
    if (!current) return { error: "ບໍ່ພົບໝວດນີ້" };

    const name = String(formData.get("name_1") ?? "").trim();
    if (!name) return { error: "ກະລຸນາລະບຸຊື່ໝວດ" };

    const size = String(formData.get("ic_size") ?? "").trim();
    if (size && !isSafeKitCode(size)) return { error: "ລະຫັດຂະໜາດ (ic_size) ບໍ່ຖືກຕ້ອງ" };

    const sort = Number(String(formData.get("sort_order") ?? "0"));
    const active = String(formData.get("active") ?? "") === "1";

    if (size && active) {
      const taken = await query<{ install_type: string }>(
        `select install_type from install_kit_type
          where ic_size=$1 and coalesce(active,1)=1 and install_type <> $2 limit 1`,
        [size, code],
      );
      if (taken.rows[0])
        return { error: `ຂະໜາດນີ້ຖືກໝວດ ${taken.rows[0].install_type} ໃຊ້ຢູ່ແລ້ວ` };
    }

    await query(
      `update install_kit_type set name_1=$2, ic_size=nullif($3,''), sort_order=$4, active=$5
        where install_type=$1`,
      [code, name, size, Number.isFinite(sort) ? Math.trunc(sort) : 0, active ? 1 : 0],
    );
    revalidatePath(INSTALL_KIT_MENU);
    return { ok: "ບັນທຶກໝວດແລ້ວ" };
  });
}

/**
 * ── ລົບໝວດ ──
 * ລົບບໍ່ໄດ້ຖ້າ **ມີໃບງານອ້າງອີງຢູ່** (`ods_tb_install.install_type`): ລົບແລ້ວໜ້າຈັດການ
 * ຈະບໍ່ຮູ້ຈັກຄ່ານັ້ນອີກ ແຕ່ໃບງານຍັງຖືມັນໄວ້ ⇒ getStandardKitLines ຄືນຫວ່າງ ແລະ
 * "ອາໄຫຼ່ຕາມມາດຕະຖານ" ຂອງງານເກົ່າຫາຍໄປ. ໃຫ້**ປິດ** (active=0) ແທນ.
 * ລາຍການໃນຊຸດ (used_spare_install) ຖືກລົບໄປພ້ອມ — ບໍ່ດັ່ງນັ້ນເປັນແຖວກຳພ້າ.
 */
export async function deleteInstallKitType(code: string): Promise<KitState> {
  return runAction("deleteInstallKitType", async () => {
    const guard = await requirePermission(INSTALL_KIT_MENU, "delete", MANAGER_ONLY);
    if (!guard.ok) return { error: guard.error };

    const current = await findInstallKitType(code);
    if (!current) return { error: "ບໍ່ພົບໝວດນີ້" };

    const used = await query<{ n: number }>(
      "select count(*)::int n from ods_tb_install where install_type=$1",
      [code],
    );
    const jobs = used.rows[0]?.n ?? 0;
    if (jobs > 0)
      return {
        error: `ລົບບໍ່ໄດ້ — ມີ ${jobs} ໃບງານໃຊ້ໝວດນີ້ຢູ່. ໃຫ້ປິດການໃຊ້ງານແທນ`,
      };

    await query("delete from used_spare_install where install_type=$1", [code]);
    await query("delete from install_kit_type where install_type=$1", [code]);
    revalidatePath(INSTALL_KIT_MENU);
    return { ok: `ລົບໝວດ ${code} ແລ້ວ` };
  });
}

/* ══════════════════ ລາຍການໃນຊຸດ (used_spare_install) ══════════════════ */

/** ເພີ່ມ 1 ລາຍການເຂົ້າຊຸດ — ຊື່/ຫົວໜ່ວຍເອົາຈາກ ERP ບໍ່ແມ່ນຈາກຟອມ */
export async function addInstallKitLine(_: KitState, formData: FormData): Promise<KitState> {
  return runAction("addInstallKitLine", async () => {
    const guard = await requirePermission(INSTALL_KIT_MENU, "create", MANAGER_ONLY);
    if (!guard.ok) return { error: guard.error };

    const installType = String(formData.get("install_type") ?? "").trim();
    if (!(await findInstallKitType(installType))) return { error: "ບໍ່ຮູ້ຈັກຊຸດຕິດຕັ້ງນີ້" };

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

    // ຫົວໜ່ວຍທີ່ເລືອກຕ້ອງເປັນອັນທີ່ ERP ອະນຸຍາດ (ic_unit_use) — ເບິ່ງ pickUnit
    const unit = await pickUnit(item.code, String(formData.get("unit_code") ?? ""), item.unit_code);

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
      [installType, item.code, item.name_1, qty, unit],
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

    /**
     * ຫົວໜ່ວຍຕ້ອງກວດກັບ **ສິນຄ້າຂອງແຖວນັ້ນ** ⇒ ຕ້ອງອ່ານ ic_code ຂອງແຖວກ່ອນ
     * (ຟອມສົ່ງມາແຕ່ roworder — ເຊື່ອ ic_code ຈາກຟອມບໍ່ໄດ້).
     */
    const line = await query<{ ic_code: string; unit_code: string | null }>(
      "select coalesce(ic_code,'') ic_code, nullif(unit_code,'') unit_code from used_spare_install where roworder=$1",
      [roworder],
    );
    const row = line.rows[0];
    if (!row) return { error: "ບໍ່ພົບແຖວທີ່ຈະແກ້ (ອາດຖືກລົບໄປແລ້ວ)" };

    const unit = await pickUnit(row.ic_code, String(formData.get("unit_code") ?? ""), row.unit_code);
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
