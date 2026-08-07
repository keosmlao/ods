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
import { linkedEmployeeCodes, sessionIdentity } from "@/lib/session-identity";
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
  select ${ERP_IDENTITY_SQL} as identity, e.employee_code
    from odg_employee e
   where e.employment_status = 'ACTIVE'
     and lower(e.employee_code) <> all($4::text[])
     and ( lower(e.employee_code) = any($3::text[])
        or (${ERP_ROLE_CASE}) = any($1::text[])
        or lower(e.employee_code) = any($2::text[])
        or lower(coalesce(e.nickname,'')) = any($2::text[])
        or lower(coalesce(e.fullname_lo,'')) = any($2::text[]) )`;

export async function recipientsForRoles(roles: string[]): Promise<string[]> {
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
      await queryOdg<{ identity: string | null; employee_code: string }>(ERP_ROLE_SQL, [
        roles,
        aliases,
        include.map((row) => row.employee_code.toLowerCase()),
        [...excludeNames],
      ])
    ).rows;

    /**
     * ── ⚠️ ຕົວຕົນຕ້ອງ **ຕົງກັບ session.username** (08-08-2026) ──
     * ແຕ່ກ່ອນຄືນ **ຊື່ຫຼິ້ນ** ສະເໝີ ('ແກ້ວ') ແຕ່ຄົນທີ່ເຊື່ອມແລ້ວ login ເປັນ **ລະຫັດ ERP**
     * ('22020') ⇒ ແຖວແຈ້ງເຕືອນ ແລະ push ໄປໃສ່ຊື່ທີ່**ບໍ່ມີໃຜ login ດ້ວຍ** = ຫາຍງຽບ.
     * ກົດເຕັມ + ເປັນຫຍັງຫ້າມແກ້ດ້ວຍການໄລ່ຫາຊື່ອື່ນ: ເບິ່ງ lib/session-identity.
     */
    const linked = await linkedEmployeeCodes(rows.map((row) => row.employee_code));
    for (const row of rows) {
      const name = sessionIdentity(row.employee_code, row.identity, linked);
      if (name) found.add(name);
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
 * ໂໝດປົກກະຕິບໍ່ແຈ້ງກັບຄືນຫາຄົນທີ່ລົງມືເອງ (ຄື Odoo).
 * ແຕ່ໂໝດ audit feed ຕ້ອງລວມຜູ້ລົງມືນຳ ເພາະກະດິ່ງນີ້ແມ່ນປະຫວັດ
 * “ທຸກການເຄື່ອນໄຫວ” ບໍ່ແມ່ນພຽງກ່ອງວຽກຂາເຂົ້າ.
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
     * ລວມທັງການທີ່ຕົນເອງລົງມື ເພື່ອໃຫ້ກະດິ່ງເປັນ audit feed ທີ່ຄົບຖ້ວນ.
     * ປິດແລ້ວ: ຄືເກົ່າ — ແຈ້ງແຕ່ຄົນຕິດຕາມ + role ທີ່ລະບຸ.
     */
    const notifyAll = await settingEnabled(SETTING.NOTIFY_ALL);
    /**
     * **ຜູ້ຈັດການຮັບທຸກການເຄື່ອນໄຫວສະເໝີ** (24-07-2026) — ບໍ່ຕ້ອງເປັນຜູ້ຕິດຕາມເອກະສານກ່ອນ.
     * ແຕ່ກ່ອນຜູ້ຈັດການເຫັນສະເພາະໃບທີ່ຕົນເຄີຍແຕະ (ກາຍເປັນ follower) ຫຼື ຕ້ອງເປີດສະວິດ
     * NOTIFY_ALL ທີ່ສົ່ງໃຫ້ **ທຸກ role** (ດັງເກີນໄປ). ນີ້ຄືທາງກາງ: ຜູ້ຈັດການເຫັນໝົດ
     * ໂດຍທີ່ພະນັກງານຄົນອື່ນຍັງໄດ້ຮັບແຕ່ເລື່ອງຂອງຕົນ.
     */
    const targetRoles = notifyAll
      ? [...new Set([...roles, ...ROLES])]
      : [...new Set([...roles, "manager"])];

    // ຜູ້ຮັບໂດຍກົງ + ກຸ່ມຕາມ role (ODS + ERP) — ຊ້ຳກັນຕັດອອກ
    // ຄົນທີ່ຖືກປິດການໃຊ້ງານ ບໍ່ໄດ້ຮັບແຈ້ງເຕືອນ ເຖິງຈະຖືກມອບໝາຍໂດຍກົງກໍ່ຕາມ
    const blocked = await blockedNames();
    const users = [...new Set([...direct, ...(await recipientsForRoles(targetRoles))])].filter(
      (name) => !blocked.has(name.trim().toLowerCase()),
    );

    const inserted = await query(
      `insert into ods_notification(username, model, res_id, kind, body, actor, created_at)
       select distinct target.username, $1, $2, $3, $4, $5, ${NOW}
         from (
           select username from ods_chatter_follower where model=$1 and res_id=$2
           union
           select unnest($6::varchar[])
         ) target(username)
        where coalesce(trim(target.username),'') <> ''
          and ($8::boolean or lower(trim(target.username)) <> lower(trim($5)))
          and lower(trim(target.username)) <> all($7::text[])`,
      [model, resId, kind, body, actor, users, [...blocked], notifyAll],
    );
    if ((inserted.rowCount ?? 0) > 0) {
      await query("select pg_notify('ods_notification_events', $1)", [JSON.stringify({ model, resId })]);
    }

    /**
     * ── ສົ່ງເຂົ້າມືຖືນຳ (24-07-2026) ──
     * ແຕ່ກ່ອນ notify() ຂຽນລົງ `ods_notification` ຢ່າງດຽວ = **ກະດິ່ງຢູ່ເວັບເທົ່ານັ້ນ**;
     * FCM ຍິງສະເພາະບ່ອນທີ່ເອີ້ນ pushToUser() ເອງ (ມີພຽງບາງຈຸດ) ⇒ ການເຄື່ອນໄຫວສ່ວນໃຫຍ່
     * (ລວມ **ການລຶບເອກະສານ**) ບໍ່ເຂົ້າແອັບຈັກເທື່ອ.
     * ດຽວນີ້ຍິງໃຫ້ຜູ້ຮັບທຸກຄົນຈາກຈຸດກາງນີ້ ⇒ ບ່ອນໃດທີ່ແຈ້ງເຕືອນເວັບໄດ້ ແອັບກໍ່ໄດ້ນຳ.
     *
     * ຄົນທີ່ລົງມືເອງບໍ່ຕ້ອງເຕືອນຕົນເອງ · ຄົນທີ່ບໍ່ມີ token ⇒ pushToUser ອອກເອງ (ບໍ່ເສຍຫຍັງ).
     * ຫໍ່ດ້ວຍ try ຕ່າງຫາກ: push ລົ້ມ **ຫ້າມ** ເຮັດໃຫ້ການແຈ້ງເຕືອນເວັບລົ້ມຕາມ.
     */
    try {
      const { pushToUser, digestPush } = await import("@/lib/push");
      const me = actor.trim().toLowerCase();
      const notMe = (name: string) => name.trim().toLowerCase() !== me;
      /**
       * ── ແຍກ 2 ຊັ້ນ (07-08-2026) ──
       * ① **ຄົນທີ່ຖືກລະບຸໂດຍກົງ** (ຊ່າງທີ່ຖືກມອບງານ · ຄົນທີ່ຖືກເອີ້ນ) ⇒ ຍິງທັນທີຕໍ່ເຫດການ
       *    — ເປັນວຽກຂອງລາວເອງ ແລະ ມີບໍ່ຫຼາຍ.
       * ② **ຄົນທີ່ໄດ້ຮັບຍ້ອນ role/ຕິດຕາມ** (ຜູ້ຈັດການໄດ້ຮັບ**ທຸກ**ການເຄື່ອນໄຫວ) ⇒ ຮວບເປັນ
       *    **ສະຫຼຸບ** ຢ່າງໜ້ອຍ 15 ນາທີ/ຄັ້ງ. ວັດຈິງ 579 ເຫດການ/ມື້ ⇒ ຍິງທຸກເຫດການ
       *    = ມືຖືສັ່ນທຸກນາທີ ⇒ ຄົນປິດແຈ້ງເຕືອນ ແລ້ວກາຍເປັນ "ບໍ່ເຫັນຫຍັງເລີຍ".
       *    ⚠️ ແຖວໃນກ່ອງແຈ້ງເຕືອນ **ຍັງຄົບທຸກແຖວ** — ຫຍໍ້ແຕ່ສຽງເອີ້ນເທົ່ານັ້ນ.
       */
      const direct = (targets.users ?? []).map((name) => name.trim()).filter(Boolean).filter(notMe);
      const directSet = new Set(direct.map((name) => name.toLowerCase()));
      const broadcast = users.filter(notMe).filter((name) => !directSet.has(name.trim().toLowerCase()));
      const where =
        model === "ods_tb_install" ? "ງານຕິດຕັ້ງ" : model === "ods_tb_maintenance" ? "ງານບຳລຸງຮັກສາ" : "ໃບງານ";
      await Promise.all([
        ...direct.map((name) => pushToUser(name, body.slice(0, 80), `${where} ${resId}`, { model, resId })),
        digestPush(broadcast),
      ]);
    } catch (error) {
      console.error("notify push failed", error);
    }
  } catch (error) {
    console.error("notify failed", error);
  }
}
