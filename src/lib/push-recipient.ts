import { query, queryOdg } from "@/lib/db";
import { ERP_IDENTITY_SQL, ERP_ROLE_CASE } from "@/lib/erp-auth";
import type { PushChoice, PushKind, PushPerson } from "@/lib/push-recipient-shared";
import { ROLE_LABEL, normalizeRole } from "@/lib/roles";
import { linkedEmployeeCodes, sessionIdentity } from "@/lib/session-identity";

/**
 * **ກຳນົດຜູ້ຮັບແຈ້ງເຕືອນເຂົ້າມືຖື (push)** — ຈັດການທີ່ /manage/push-recipients.
 * ນິຍາມປະເພດ (ບໍ່ແຕະຖານ ⇒ client ໃຊ້ໄດ້) ຢູ່ lib/push-recipient-shared.
 *
 * ── ກົດ (ດຽວກັນກັບ ods_setting) ──
 * **ບໍ່ມີແຖວ = ບໍ່ໄດ້ກຳນົດ ⇒ ຕາມ role ຄືເກົ່າ** (ບໍ່ແມ່ນ "ບໍ່ສົ່ງໃຜ").
 * ຜົນຈິງ = (ຄ່າຕັ້ງຕົ້ນຕາມ role ∪ ຄົນທີ່ເປີດ) − ຄົນທີ່ປິດ ⇒ ຜູ້ຈັດການ**ຕື່ມ**ຄົນນອກ role ໄດ້
 * ແລະ **ຕັດ**ຄົນໃນ role ອອກໄດ້ ໂດຍບໍ່ຕ້ອງໄປແກ້ role ຂອງລາວ (role ກະທົບສິດເຂົ້າໜ້າອື່ນນຳ).
 */
export * from "@/lib/push-recipient-shared";

/**
 * ── ຄົນທີ່ເລືອກໄດ້ = **ຄົນທີ່ມີເຄື່ອງຈິງ ຫຼື ເຄີຍ login ແອັບ** (08-08-2026 ຕາມຄຳສັ່ງ) ──
 * ບໍ່ເອົາລາຍຊື່ພະນັກງານທັງ 242 ຄົນມາໃຫ້ເລືອກ: ຄົນທີ່ບໍ່ເຄີຍແຕະແອັບເລີຍ ເລືອກໄປກໍ່ບໍ່ມີຜົນ
 * (ບໍ່ມີ token = ບໍ່ມີບ່ອນຍິງ). ດຶງຈາກ 3 ບ່ອນ:
 *   ① `ods_push_token`  — ມີເຄື່ອງລົງທະບຽນແລ້ວ = ຍິງຮອດແນ່ນອນ
 *   ② `ods_login_log`   — login ແອັບແລ້ວແຕ່ຍັງບໍ່ມີ token = **ຍັງບໍ່ໄດ້ກົດອະນຸຍາດແຈ້ງເຕືອນ**
 *   ③ `extra`           — ຄົນທີ່ເຄີຍຖືກເລືອກໄວ້ (ຜູ້ເອີ້ນສົ່ງມາຈາກ listPushChoices)
 *                         ຮັບເປັນ argument ບໍ່ແມ່ນ join ໃສ່ `ods_push_recipient` ໂດຍກົງ —
 *                         ຖ້າ deploy ກ່ອນແລ່ນ migration ໜ້ານີ້ຕ້ອງຍັງເປີດໄດ້.
 */
export async function pushAudience(extra: string[] = []): Promise<PushPerson[]> {
  const rows = (
    await query<{ username: string; devices: number; platform: string | null; last_login: string | null }>(
      `with app_user as (
         select user_code as username from ods_push_token
         union
         select username from ods_login_log where source = 'mobile'
         union
         select unnest($1::text[])
       )
       select u.username,
              coalesce(d.n, 0)::int as devices,
              d.platform,
              to_char(l.last_at, 'DD-MM-YYYY HH24:MI') as last_login
         from app_user u
         left join (
           select lower(user_code) as username, count(*)::int n, min(platform) platform
             from ods_push_token group by 1
         ) d on d.username = lower(u.username)
         left join (
           select lower(username) as username, max(logged_at) last_at
             from ods_login_log where source = 'mobile' group by 1
         ) l on l.username = lower(u.username)
        where coalesce(trim(u.username), '') <> ''`,
      [extra.map((name) => name.trim()).filter(Boolean)],
    )
  ).rows;

  /**
   * ຄົນດຽວອາດປາກົດຫຼາຍຊື່: ຂຽນຄົນລະຮູບ ('Mee'/'mee') ຫຼື **ເຄີຍ login ດ້ວຍຊື່ຫຼິ້ນກ່ອນຖືກເຊື່ອມ**
   * ('ພວງ' ໃນ log ເກົ່າ ແຕ່ດຽວນີ້ login ເປັນ '25041') ⇒ ຍຸບເຂົ້າ**ຊື່ທີ່ໃຊ້ຢູ່ດຽວນີ້** ຕາມກົດ
   * lib/session-identity ບໍ່ດັ່ງນັ້ນຕາຕະລາງຈະມີຄົນດຽວກັນສອງແຖວ ແລ້ວຕິດຜິດແຖວ.
   */
  const bridge = new Map<string, string>();
  try {
    for (const row of (
      await query<{ user_code: string; employee_code: string }>(
        "select user_code, employee_code from ods_user_employee",
      )
    ).rows) {
      bridge.set(row.user_code.trim().toLowerCase(), row.employee_code.trim());
    }
  } catch (error) {
    console.error("pushAudience: ods_user_employee failed", error);
  }

  const people = new Map<string, PushPerson>();
  for (const row of rows) {
    const current = bridge.get(row.username.trim().toLowerCase()) ?? row.username.trim();
    row.username = current;
    const key = current.toLowerCase();
    const found = people.get(key);
    if (found) {
      found.devices = Math.max(found.devices, row.devices);
      found.platform ??= row.platform;
      found.last_login ??= row.last_login;
      continue;
    }
    people.set(key, {
      username: row.username.trim(),
      name: row.username.trim(),
      role: "",
      devices: row.devices,
      platform: row.platform,
      last_login: row.last_login,
    });
  }

  await describe(people);
  return [...people.values()].sort(
    (a, b) => b.devices - a.devices || a.name.localeCompare(b.name, "lo"),
  );
}

/** ຕື່ມຊື່ອ່ານງ່າຍ + role ໃສ່ໃຫ້ — ຫາບໍ່ພົບກໍ່ຍັງໃຊ້ໄດ້ (ສະແດງຊື່ຜູ້ໃຊ້ດິບ) */
async function describe(people: Map<string, PushPerson>): Promise<void> {
  const names = [...people.keys()];
  if (!names.length) return;

  try {
    const rows = (
      await queryOdg<{ employee_code: string; identity: string | null; fullname_lo: string | null; role: string }>(
        `select e.employee_code, ${ERP_IDENTITY_SQL} as identity, e.fullname_lo, (${ERP_ROLE_CASE}) as role
           from odg_employee e
          where e.employment_status = 'ACTIVE'
            and ( lower(e.employee_code) = any($1::text[])
               or lower(coalesce(e.nickname,'')) = any($1::text[])
               or lower(coalesce(e.fullname_lo,'')) = any($1::text[]) )`,
        [names],
      )
    ).rows;
    const linked = await linkedEmployeeCodes(rows.map((row) => row.employee_code));
    for (const row of rows) {
      // ຈັບຄູ່ດ້ວຍ**ຊື່ຕອນ login** ເທົ່ານັ້ນ — ຄົນເຊື່ອມແລ້ວ login ດ້ວຍລະຫັດ ຈຶ່ງບໍ່ຊົນກັບຄົນຊື່ຫຼິ້ນຄືກັນ
      const person = people.get(sessionIdentity(row.employee_code, row.identity, linked).toLowerCase());
      if (!person || person.role) continue;
      person.name = (row.identity || row.fullname_lo || row.employee_code).trim();
      person.role = ROLE_LABEL[normalizeRole(row.role)];
    }
  } catch (error) {
    console.error("pushAudience: odg_employee failed", error);
  }

  try {
    const rows = (await query<{ username: string; roles: string }>(`select username, roles from users`)).rows;
    for (const row of rows) {
      const person = people.get(row.username.trim().toLowerCase());
      if (person && !person.role) person.role = ROLE_LABEL[normalizeRole(row.roles)];
    }
  } catch (error) {
    console.error("pushAudience: users failed", error);
  }
}

export async function listPushChoices(): Promise<PushChoice[]> {
  try {
    return (
      await query<PushChoice>(
        `select kind, username, active, updated_by from ods_push_recipient order by kind, username`,
      )
    ).rows;
  } catch (error) {
    // ຍັງບໍ່ໄດ້ແລ່ນ migration ⇒ ຖືວ່າຍັງບໍ່ໄດ້ກຳນົດ (ໜ້າຍັງເປີດເບິ່ງໄດ້)
    console.error("listPushChoices failed", error);
    return [];
  }
}

/**
 * ຜູ້ຮັບຈິງຂອງ push ປະເພດນຶ່ງ = (ຄ່າຕັ້ງຕົ້ນຕາມ role ∪ ຄົນທີ່ເປີດ) − ຄົນທີ່ປິດ.
 * ຖາມຖານບໍ່ໄດ້ ⇒ ຄືນຄ່າຕັ້ງຕົ້ນ **ບໍ່ແມ່ນລາຍການວ່າງ** — ຖານລົ້ມບໍ່ຄວນເຮັດໃຫ້ແຈ້ງເຕືອນຫາຍງຽບ.
 */
export async function applyPushChoice(kind: PushKind, byRole: string[]): Promise<string[]> {
  let rows: { username: string; active: boolean }[] = [];
  try {
    rows = (
      await query<{ username: string; active: boolean }>(
        `select username, active from ods_push_recipient where kind = $1`,
        [kind],
      )
    ).rows;
  } catch (error) {
    console.error(`applyPushChoice(${kind}) failed`, error);
    return byRole;
  }
  if (!rows.length) return byRole; // ຍັງບໍ່ໄດ້ກຳນົດ = ຕາມ role ຄືເກົ່າ

  const chosen = new Map<string, string>();
  for (const name of byRole) chosen.set(name.trim().toLowerCase(), name.trim());
  for (const row of rows.filter((row) => row.active)) chosen.set(row.username.trim().toLowerCase(), row.username.trim());
  for (const row of rows.filter((row) => !row.active)) chosen.delete(row.username.trim().toLowerCase());
  return [...chosen.values()].filter(Boolean);
}
