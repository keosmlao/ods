/**
 * **ກະຈາຍການແຈ້ງເຕືອນ — ຫ້ອງສະໝຸດຝັ່ງ server (ບໍ່ແມ່ນ server action).**
 *
 * ── ⚠️ ເປັນຫຍັງບໍ່ຢູ່ໃນ actions/notification.ts ອີກ ──
 * ໄຟລ໌ `"use server"` ເຮັດໃຫ້**ທຸກ export ກາຍເປັນ endpoint ສາທາລະນະ** ທີ່ຜູ້ໃດກໍ່
 * ຍິງໃສ່ໄດ້ຈາກພາຍນອກ. `notify()` ບໍ່ໄດ້ກວດ session ແລະ ຮັບ `actor` ຈາກຜູ້ເອີ້ນ
 * ⇒ ຄົນນອກຍິງແຈ້ງເຕືອນຫາໃຜກໍ່ໄດ້ ໂດຍ**ປອມຊື່ຜູ້ລົງມື**. ມັນຖືກເອີ້ນຈາກ server
 * ເທົ່ານັ້ນ ⇒ ຍ້າຍມາເປັນ lib ທຳມະດາ = ບໍ່ມີ endpoint ໃຫ້ຍິງອີກຕໍ່ໄປ.
 */
import { getSession } from "@/lib/auth";
import type { Notification } from "@/lib/chatter";
import { query, queryOdg } from "@/lib/db";
import { listEmployeeOverrides, type EmployeeOverride } from "@/lib/employee-role";
import { ERP_IDENTITY_SQL, ERP_ROLE_CASE } from "@/lib/erp-auth";
import { ROLES } from "@/lib/roles";
import { SETTING, settingEnabled } from "@/lib/settings";

const NOW = "localtimestamp(0)";
const SYSTEM = "ລະບົບ";

/** ຜູ້ຮັບເພີ່ມນອກເໜືອຈາກຜູ້ຕິດຕາມ */
export type NotifyTargets = {
  /** ຊື່ຜູ້ໃຊ້ໂດຍກົງ — ເຊັ່ນ ຊ່າງທີ່ຖືກມອບງານ */
  users?: string[];
  /**
   * ກຸ່ມ role ທີ່ຕ້ອງລົງມືຕໍ່ — ໃຊ້ ROLE_WAREHOUSE / ROLE_APPROVER ຈາກ lib/chatter.
   * ຄົ້ນຫາຄົນທັງຈາກ users ຂອງ ODS ແລະ ພະແນກຂອງ odg_employee (ERP) — ເບິ່ງ recipientsForRoles
   */
  roles?: string[];
  /** ຜູ້ລົງມື ຖ້າບໍ່ແມ່ນຄົນທີ່ login (ເຊັ່ນ ລູກຄ້າຕອບແບບສອບຖາມ) */
  actor?: string;
};

/**
 * ຄົນທັງໝົດທີ່ຢູ່ໃນກຸ່ມ role ນີ້ — ຈາກ 2 ແຫຼ່ງ ເພາະ login ມີ 2 ທາງ:
 *
 *   1. ຕາຕະລາງ users ຂອງ ODS (users.roles) — ຜູ້ໃຊ້ເກົ່າ
 *   2. odg_employee ຂອງ ERP — ພະນັກງານສ່ວນຫຼາຍດຽວນີ້ login ທາງນີ້ ແລະ
 *      app_role ເປັນ NULL ໝົດ ⇒ ຕັດສິນຈາກພະແນກ (ສາງ = 501)
 *
 * ກ່ອນໜ້ານີ້ຄົ້ນຫາແຕ່ຕາຕະລາງ users ⇒ ພະນັກງານສາງທີ່ login ຜ່ານ ERP
 * ບໍ່ເຄີຍໄດ້ຮັບການແຈ້ງເຕືອນ "ມີໃບຂໍເບີກ" ເລີຍ.
 *
 * ຕົວຕົນ (username) ຕ້ອງເປັນຄ່າດຽວກັບທີ່ session ໃຊ້ = ຊື່ຫຼິ້ນ (nickname)
 * ຕາມສູດດຽວກັບ erp-master.getErpTechnicians / actions/auth ERP_SQL.
 * ຜູ້ໃຊ້ ODS ບາງຄົນເກັບ username ເປັນລະຫັດພະນັກງານ (ເຊັ່ນ 25009) — ຄົນດຽວກັນ
 * ແຕ່ຄົນລະຊື່ ⇒ ຈຶ່ງເອົາຕົວຕົນ ERP ຂອງເຂົາມາເພີ່ມນຳ ບໍ່ດັ່ງນັ້ນຈະຕົກຫຼົ່ນ.
 */
/**
 * ຄົນໃນ ERP ທີ່ຢູ່ໃນ role ທີ່ຕ້ອງການ — ຄິດ role ດ້ວຍ ERP_ROLE_CASE (ຕຳແໜ່ງ + ພະແນກ)
 * ເຊິ່ງເປັນສູດດຽວກັນກັບຕອນ login ຈຶ່ງບໍ່ມີທາງຄິດຄົນລະຢ່າງ.
 *
 * $3 = ລະຫັດພະນັກງານທີ່ຜູ້ຈັດການກຳນົດສິດເອງໃຫ້ຢູ່ໃນ role ນີ້ (ຕ້ອງໄດ້ຮັບແຈ້ງ ເຖິງພະແນກຈະບໍ່ຕົງ)
 * $4 = ລະຫັດພະນັກງານທີ່ຕ້ອງຕັດອອກ (ຖືກປິດການໃຊ້ງານ ຫຼື ຖືກກຳນົດເປັນ role ອື່ນ)
 *      ⇒ ສິດທີ່ກຳນົດເອງຊະນະສິດຕາມຕຳແໜ່ງສະເໝີ, ຄືກັນກັບຕອນ login.
 */
const ERP_ROLE_SQL = `
  select ${ERP_IDENTITY_SQL} as identity
    from odg_employee e
   where e.employment_status = 'ACTIVE'
     and lower(e.employee_code) <> all($4::text[])
     and ( lower(e.employee_code) = any($3::text[])
        or (${ERP_ROLE_CASE}) = any($1::text[])
        or lower(e.employee_code) = any($2::text[])
        or lower(coalesce(e.nickname,'')) = any($2::text[])
        or lower(coalesce(e.fullname_lo,'')) = any($2::text[]) )`;

async function recipientsForRoles(roles: string[]): Promise<string[]> {
  if (!roles.length) return [];
  const found = new Set<string>();

  // 0) ສິດທີ່ຜູ້ຈັດການກຳນົດເອງ (ods_employee_role) — ຕັດສິນກ່ອນຂໍ້ອື່ນທັງໝົດ
  let overrides: EmployeeOverride[] = [];
  try {
    overrides = await listEmployeeOverrides();
  } catch (error) {
    console.error("recipientsForRoles: ods_employee_role failed", error);
  }
  // ຢູ່ໃນ role ນີ້ເພາະຖືກກຳນົດເອງ · ຕ້ອງຕັດອອກ (ຖືກປິດ ຫຼື ຖືກກຳນົດເປັນ role ອື່ນ)
  const include = overrides.filter((row) => row.active && row.app_role && roles.includes(row.app_role));
  const exclude = overrides.filter(
    (row) => !row.active || (row.app_role !== "" && !roles.includes(row.app_role)),
  );
  const excludeNames = new Set(
    exclude.flatMap((row) => [row.employee_code.toLowerCase(), (row.identity ?? "").trim().toLowerCase()]).filter(Boolean),
  );

  // 1) ຜູ້ໃຊ້ເກົ່າໃນ ODS
  let legacy: string[] = [];
  try {
    const rows = (await query<{ username: string }>(`select username from users where roles = any($1::text[])`, [roles]))
      .rows;
    legacy = rows.map((row) => (row.username ?? "").trim()).filter(Boolean);
    for (const name of legacy) found.add(name);
  } catch (error) {
    console.error("recipientsForRoles: users failed", error);
  }

  // 2) ພະນັກງານ ERP — ຕາມພະແນກ, ບວກກັບຄົນເກົ່າຂ້າງເທິງທີ່ມີຕົວຕົນ ERP ຢູ່ນຳ
  try {
    // ສົ່ງ role ໄປໃຫ້ SQL ຄິດເອງ (ຕຳແໜ່ງ + ພະແນກ) ບໍ່ຕ້ອງແປງເປັນລາຍການພະແນກອີກ
    const aliases = legacy.map((name) => name.toLowerCase());
    const rows = (
      await queryOdg<{ identity: string | null }>(ERP_ROLE_SQL, [
        roles,
        aliases,
        include.map((row) => row.employee_code.toLowerCase()),
        [...excludeNames],
      ])
    ).rows;
    for (const row of rows) {
      const identity = (row.identity ?? "").trim();
      if (identity) found.add(identity);
    }
  } catch (error) {
    // ຖານ ERP ບໍ່ພ້ອມ → ຍັງແຈ້ງຫາຜູ້ໃຊ້ເກົ່າໄດ້ຢູ່ ບໍ່ໃຫ້ລົ້ມທັງໜ້າ
    console.error("recipientsForRoles: odg_employee failed", error);
  }

  // 3) ຕັດຄົນທີ່ຖືກປິດ / ຖືກກຳນົດເປັນ role ອື່ນ ອອກຈາກຜົນຂອງຂໍ້ 1 ນຳ (ຊື່ຜູ້ໃຊ້ເກົ່າ)
  for (const name of found) if (excludeNames.has(name.trim().toLowerCase())) found.delete(name);

  return [...found];
}

/** ຊື່ (ລະຫັດພະນັກງານ + ຊື່ເຂົ້າລະບົບ) ຂອງຄົນທີ່ຖືກປິດການໃຊ້ງານ — ຫ້າມແຈ້ງເຕືອນຫາ */
async function blockedNames(): Promise<Set<string>> {
  try {
    const rows = await listEmployeeOverrides();
    return new Set(
      rows
        .filter((row) => !row.active)
        .flatMap((row) => [row.employee_code.toLowerCase(), (row.identity ?? "").trim().toLowerCase()])
        .filter(Boolean),
    );
  } catch (error) {
    console.error("blockedNames failed", error);
    return new Set<string>();
  }
}

/**
 * ກະຈາຍການແຈ້ງເຕືອນ 1 ແຖວຕໍ່ຜູ້ຮັບ 1 ຄົນ.
 * ບໍ່ແຈ້ງກັບຄືນຫາຄົນທີ່ລົງມືເອງ (ຄື Odoo).
 */
export async function notify(
  model: string,
  resId: string,
  body: string,
  kind: Notification["kind"] = "log",
  targets: NotifyTargets = {},
) {
  try {
    if (!model || !resId || !body.trim()) return;
    const session = await getSession();
    const actor = targets.actor ?? session?.username ?? SYSTEM;
    const direct = (targets.users ?? []).map((name) => name.trim()).filter(Boolean);
    const roles = (targets.roles ?? []).filter(Boolean);

    /**
     * ── ແຈ້ງທຸກຄົນ (audit feed) — ຄວບຄຸມດ້ວຍສະວິດ /manage/settings ──
     * ເປີດແລ້ວ: **ທຸກ role** ກາຍເປັນຜູ້ຮັບ ⇒ ພະນັກງານທຸກຄົນເຫັນທຸກການເຄື່ອນໄຫວ.
     * (ຄົນທີ່ລົງມືເອງ ຍັງຖືກຕັດອອກ ຢູ່ SQL ດ້ວຍ `target.username <> actor` — ບໍ່ແຈ້ງກັບຄືນ)
     * ປິດແລ້ວ: ຄືເກົ່າ — ແຈ້ງແຕ່ຄົນຕິດຕາມ + role ທີ່ລະບຸ.
     */
    const notifyAll = await settingEnabled(SETTING.NOTIFY_ALL);
    const targetRoles = notifyAll ? [...new Set([...roles, ...ROLES])] : roles;

    // ຜູ້ຮັບໂດຍກົງ + ກຸ່ມຕາມ role (ODS + ERP) — ຊ້ຳກັນຕັດອອກ
    // ຄົນທີ່ຖືກປິດການໃຊ້ງານ ບໍ່ໄດ້ຮັບແຈ້ງເຕືອນ ເຖິງຈະຖືກມອບໝາຍໂດຍກົງກໍ່ຕາມ
    const blocked = await blockedNames();
    const users = [...new Set([...direct, ...(await recipientsForRoles(targetRoles))])].filter(
      (name) => !blocked.has(name.trim().toLowerCase()),
    );

    await query(
      `insert into ods_notification(username, model, res_id, kind, body, actor, created_at)
       select distinct target.username, $1, $2, $3, $4, $5, ${NOW}
         from (
           select username from ods_chatter_follower where model=$1 and res_id=$2
           union
           select unnest($6::varchar[])
         ) target(username)
        where coalesce(trim(target.username),'') <> '' and target.username <> $5
          and lower(trim(target.username)) <> all($7::text[])`,
      [model, resId, kind, body, actor, users, [...blocked]],
    );
  } catch (error) {
    console.error("notify failed", error);
  }
}

