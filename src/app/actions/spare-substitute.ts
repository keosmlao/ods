"use server";
import { db, query } from "@/lib/db";
import { requirePermission, runAction } from "@/lib/guard";
import { erpItem, INSTALL_KIT_MENU, isSafeKitCode } from "@/lib/install-kit";
import { revalidatePath } from "next/cache";

/**
 * ── ຈັດການ **ກຸ່ມອາໄຫຼ່ທົດແທນກັນ** (`spare_sub_group` / `spare_sub_item`) ──
 *
 * ໃຊ້ສິດເມນູອັນດຽວກັບຊຸດອາໄຫຼ່ມາດຕະຖານ (/manage/install-kits) — ເປັນເລື່ອງດຽວກັນ
 * ໃນສາຍຕາຜູ້ໃຊ້ ("ຊຸດຕ້ອງໃຊ້ຫຍັງ ແລະ ຫຍັງແທນກັນໄດ້") ⇒ ບໍ່ຄວນຕັ້ງສິດແຍກໃຫ້ຈື່ສອງບ່ອນ.
 */

export type SubState = { error?: string; ok?: string };

const MANAGER_ONLY = ["manager"] as const;

/** ອ່ານລາຍການລະຫັດຈາກຟອມ (ຫຼາຍຄ່າ) — ກອງຄ່າຫວ່າງ/ຊ້ຳ ແລະ ກວດຮູບແບບ */
function readCodes(values: string[]): { codes: string[]; bad: string[] } {
  const codes = [...new Set(values.map((value) => String(value ?? "").trim()).filter(Boolean))];
  return { codes, bad: codes.filter((code) => !isSafeKitCode(code)) };
}

/**
 * ── ດ່ານ "ສິນຄ້າຢູ່ກຸ່ມອື່ນແລ້ວ" ──
 * 1 ສິນຄ້າ = 1 ກຸ່ມ (uq_spare_sub_item_code ຢູ່ຖານກັນນຳ) ⇒ ຢູ່ນີ້ບອກໃຫ້ອ່ານຮູ້ວ່າ
 * ຕົວໃດຊ້ຳ ແລະ ຊ້ຳກັບກຸ່ມໃດ ບໍ່ແມ່ນປ່ອຍໃຫ້ຖານຖິ້ມ error ດິບໆ.
 */
async function claimedElsewhere(
  codes: string[],
  exceptGroup: number | null,
): Promise<string | null> {
  if (!codes.length) return null;
  const rows = await query<{ ic_code: string; group_id: number; name_1: string }>(
    `select i.ic_code, i.group_id, coalesce(g.name_1,'') name_1
       from spare_sub_item i
       join spare_sub_group g on g.group_id = i.group_id
      where i.ic_code = any($1::varchar[])
        and ($2::int is null or i.group_id <> $2::int)
      limit 5`,
    [codes, exceptGroup],
  );
  if (!rows.rows.length) return null;
  const list = rows.rows
    .map((row) => `${row.ic_code} (ກຸ່ມ #${row.group_id} ${row.name_1})`)
    .join(" · ");
  return `ລາຍການນີ້ຢູ່ໃນກຸ່ມອື່ນແລ້ວ: ${list}`;
}

/** ຢືນຢັນວ່າທຸກລະຫັດມີຈິງໃນ ERP — ບໍ່ດັ່ງນັ້ນກຸ່ມຈະມີລະຫັດຜີ ທີ່ບໍ່ມີວັນຖືກໃຊ້ */
async function missingInErp(codes: string[]): Promise<string | null> {
  const missing: string[] = [];
  for (const code of codes) {
    try {
      if (!(await erpItem(code))) missing.push(code);
    } catch (error) {
      console.error("missingInErp lookup failed", error);
      return "ຄົ້ນຫາລາຍການໃນ ERP ບໍ່ສຳເລັດ";
    }
  }
  return missing.length ? `ບໍ່ພົບໃນ ERP: ${missing.join(", ")}` : null;
}

/** ສ້າງກຸ່ມໃໝ່ພ້ອມສະມາຊິກ (ຕ້ອງມີ 2 ຕົວຂຶ້ນໄປ ຈຶ່ງມີຄວາມໝາຍ) */
export async function createSubstituteGroup(
  name: string,
  items: string[],
): Promise<SubState> {
  return runAction("createSubstituteGroup", async () => {
    const guard = await requirePermission(INSTALL_KIT_MENU, "create", MANAGER_ONLY);
    if (!guard.ok) return { error: guard.error };

    const label = String(name ?? "").trim();
    if (!label) return { error: "ກະລຸນາລະບຸຊື່ກຸ່ມ" };

    const { codes, bad } = readCodes(items);
    if (bad.length) return { error: `ລະຫັດບໍ່ຖືກຕ້ອງ: ${bad.join(", ")}` };
    // ກຸ່ມທີ່ມີຕົວດຽວ "ແທນກັນ" ກັບໃຜບໍ່ໄດ້ ⇒ ກັນໄວ້ ບໍ່ໃຫ້ມີກຸ່ມທີ່ບໍ່ມີຜົນ
    if (codes.length < 2) return { error: "ຕ້ອງມີຢ່າງໜ້ອຍ 2 ລາຍການທີ່ແທນກັນໄດ້" };

    const erpError = await missingInErp(codes);
    if (erpError) return { error: erpError };
    const clash = await claimedElsewhere(codes, null);
    if (clash) return { error: clash };

    if (!db) return { error: "ບໍ່ພົບ DATABASE_URL" };
    const client = await db.connect();
    try {
      await client.query("begin");
      const created = await client.query<{ group_id: number }>(
        `insert into spare_sub_group(name_1, create_date_time_now)
         values ($1, localtimestamp(0)) returning group_id`,
        [label],
      );
      const groupId = created.rows[0].group_id;
      await client.query(
        `insert into spare_sub_item(group_id, ic_code)
         select $1, c from unnest($2::varchar[]) c`,
        [groupId, codes],
      );
      await client.query("commit");
    } catch (error) {
      await client.query("rollback");
      console.error("createSubstituteGroup failed", error);
      return { error: "ສ້າງກຸ່ມບໍ່ສຳເລັດ" };
    } finally {
      client.release();
    }

    revalidatePath(INSTALL_KIT_MENU);
    return { ok: `ສ້າງກຸ່ມ "${label}" ພ້ອມ ${codes.length} ລາຍການແລ້ວ` };
  });
}

/** ແກ້ຊື່ + ສະມາຊິກ (replace ທັງຊຸດ ຄືກັບ setInstallKitDesigns) */
export async function updateSubstituteGroup(
  groupId: number,
  name: string,
  items: string[],
): Promise<SubState> {
  return runAction("updateSubstituteGroup", async () => {
    const guard = await requirePermission(INSTALL_KIT_MENU, "update", MANAGER_ONLY);
    if (!guard.ok) return { error: guard.error };
    if (!Number.isInteger(groupId)) return { error: "ບໍ່ພົບກຸ່ມ" };

    const label = String(name ?? "").trim();
    if (!label) return { error: "ກະລຸນາລະບຸຊື່ກຸ່ມ" };

    const { codes, bad } = readCodes(items);
    if (bad.length) return { error: `ລະຫັດບໍ່ຖືກຕ້ອງ: ${bad.join(", ")}` };
    if (codes.length < 2) return { error: "ຕ້ອງມີຢ່າງໜ້ອຍ 2 ລາຍການ (ຫຼືລົບກຸ່ມນີ້ອອກ)" };

    const exists = await query("select 1 from spare_sub_group where group_id=$1", [groupId]);
    if (!exists.rowCount) return { error: "ບໍ່ພົບກຸ່ມນີ້ (ອາດຖືກລົບໄປແລ້ວ)" };

    const erpError = await missingInErp(codes);
    if (erpError) return { error: erpError };
    const clash = await claimedElsewhere(codes, groupId);
    if (clash) return { error: clash };

    if (!db) return { error: "ບໍ່ພົບ DATABASE_URL" };
    const client = await db.connect();
    try {
      await client.query("begin");
      await client.query("update spare_sub_group set name_1=$2 where group_id=$1", [groupId, label]);
      await client.query("delete from spare_sub_item where group_id=$1", [groupId]);
      await client.query(
        `insert into spare_sub_item(group_id, ic_code)
         select $1, c from unnest($2::varchar[]) c`,
        [groupId, codes],
      );
      await client.query("commit");
    } catch (error) {
      await client.query("rollback");
      console.error("updateSubstituteGroup failed", error);
      return { error: "ບັນທຶກກຸ່ມບໍ່ສຳເລັດ" };
    } finally {
      client.release();
    }

    revalidatePath(INSTALL_KIT_MENU);
    return { ok: "ບັນທຶກກຸ່ມແລ້ວ" };
  });
}

/**
 * ລົບກຸ່ມ — ສະມາຊິກຫຼົ່ນໄປພ້ອມ (FK on delete cascade).
 * ບໍ່ກະທົບຂໍ້ມູນງານ: ກຸ່ມນີ້ໃຊ້ຕອນ**ເລືອກ**ອາໄຫຼ່ເທົ່ານັ້ນ ແຖວທີ່ເລືອກໄປແລ້ວຢູ່
 * `tb_used_spare` ຄືເກົ່າ (ບໍ່ໄດ້ອ້າງອີງກຸ່ມ).
 */
export async function deleteSubstituteGroup(groupId: number): Promise<SubState> {
  return runAction("deleteSubstituteGroup", async () => {
    const guard = await requirePermission(INSTALL_KIT_MENU, "delete", MANAGER_ONLY);
    if (!guard.ok) return { error: guard.error };
    if (!Number.isInteger(groupId)) return { error: "ບໍ່ພົບກຸ່ມ" };

    const removed = await query("delete from spare_sub_group where group_id=$1", [groupId]);
    if (!removed.rowCount) return { error: "ບໍ່ພົບກຸ່ມນີ້ (ອາດຖືກລົບໄປແລ້ວ)" };

    revalidatePath(INSTALL_KIT_MENU);
    return { ok: "ລົບກຸ່ມແລ້ວ" };
  });
}
