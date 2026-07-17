import { query, queryOdg } from "@/lib/db";
import { listEmployeeOverrides } from "@/lib/employee-role";
import { ERP_IDENTITY_SQL, ERP_ROLE_CASE } from "@/lib/erp-auth";
import { ROLE_LABEL, type Role } from "@/lib/roles";

/**
 * **Live chat — ນິຍາມຫ້ອງ ແລະ ການອ່ານ ຢູ່ບ່ອນດຽວ.**
 *
 * ── ຫ້ອງເປັນພຽງ "ກຸນແຈຂໍ້ຄວາມ" ບໍ່ແມ່ນແຖວໃນຖານ ──
 * `dm:a|b` (ຮຽງ a→z) · `team:<role>` · `all` ⇒ ຫ້ອງເກີດເອງເມື່ອມີຂໍ້ຄວາມທຳອິດ
 * ແລະ ບໍ່ມີແຖວຫ້ອງຜີໃຫ້ດູແລ. ການຮຽງຊື່ຄູ່ **ຕ້ອງເຮັດບ່ອນດຽວ** (dmRoom) ບໍ່ດັ່ງນັ້ນ
 * keo→stk ກັບ stk→keo ຈະກາຍເປັນສອງຫ້ອງ ແລ້ວຂໍ້ຄວາມຂາດເຄິ່ງ.
 *
 * ── ໃຜເຫັນຫ້ອງໃດ ──
 * dm: ສະເພາະສອງຄົນນັ້ນ · team:<role>: ຄົນທີ່ຢູ່ role ນັ້ນ · all: ທຸກຄົນ.
 * ບັງຄັບຢູ່ **server** (canJoin) ບໍ່ແມ່ນທີ່ໜ້າຈໍ — ເອີ້ນ action ໂດຍກົງກໍ່ຜ່ານບໍ່ໄດ້.
 */

export const ALL_ROOM = "all";

/** ຫ້ອງກຸ່ມຕາມໜ້າວຽກ — ບໍ່ເອົາ "user" (ຄົນນອກຝ່າຍບໍລິການ) ແລະ "sales" ບໍ່ມີວຽກສ້ອມ */
export const TEAM_ROLES: Role[] = ["manager", "headtechnical", "technical", "stock", "admin"];

export const dmRoom = (a: string, b: string) => `dm:${[a.trim(), b.trim()].sort().join("|")}`;
export const teamRoom = (role: Role) => `team:${role}`;

export const roomLabel = (room: string, me: string): string => {
  if (room === ALL_ROOM) return "ທຸກຄົນໃນບໍລິສັດ";
  if (room.startsWith("team:")) return `ທີມ ${ROLE_LABEL[room.slice(5) as Role] ?? room.slice(5)}`;
  const other = room.slice(3).split("|").find((name) => name !== me);
  return other ?? room;
};

/** ຄູ່ສົນທະນາຂອງຫ້ອງ dm (ໃຊ້ຫາຊື່ຈິງ / ສົ່ງ push) — ຫ້ອງກຸ່ມຄືນ null */
export const dmPeer = (room: string, me: string): string | null =>
  room.startsWith("dm:") ? (room.slice(3).split("|").find((name) => name !== me) ?? null) : null;

/**
 * ເຂົ້າຫ້ອງນີ້ໄດ້ບໍ — **ດ່ານດຽວຂອງລະບົບ** (ໜ້າຈໍ ແລະ action ໃຊ້ອັນນີ້ຮ່ວມກັນ).
 * ຜູ້ຈັດການ**ບໍ່**ໄດ້ອ່ານ dm ຂອງຄົນອື່ນ — ຂໍ້ຄວາມສ່ວນຕົວຄືສ່ວນຕົວ.
 */
export function canJoin(room: string, me: string, role: Role): boolean {
  if (room === ALL_ROOM) return true;
  if (room.startsWith("team:")) return TEAM_ROLES.includes(room.slice(5) as Role) && room.slice(5) === role;
  if (room.startsWith("dm:")) return room.slice(3).split("|").includes(me);
  return false;
}

/** ຫ້ອງທີ່ຄົນນີ້ຢູ່ — ໃຊ້ນັບຂໍ້ຄວາມທີ່ຍັງບໍ່ໄດ້ອ່ານ */
export const roomsOf = (me: string, role: Role): string[] => [
  ALL_ROOM,
  ...(TEAM_ROLES.includes(role) ? [teamRoom(role)] : []),
];

export type ChatMessage = {
  id: string;
  room: string;
  author: string;
  author_name: string | null;
  body: string;
  created_at: string;
  at_iso: string;
};

/** ຂໍ້ຄວາມຂອງຫ້ອງ — ຮຽງເກົ່າ→ໃໝ່ (ອ່ານຈາກເທິງລົງລຸ່ມຄືແອັບແຊັດ) */
export async function messagesOf(room: string, limit = 100): Promise<ChatMessage[]> {
  return (
    await query<ChatMessage>(
      `select m.id::text, m.room, m.author,
          (select coalesce(nullif(u.name_1,''), u.username) from users u where u.username = m.author limit 1) author_name,
          m.body, to_char(m.created_at,'DD-MM HH24:MI') created_at,
          to_char(m.created_at,'YYYY-MM-DD"T"HH24:MI:SS') at_iso
        from (
          select * from ods_chat_message where room = $1 order by id desc limit $2
        ) m order by m.id`,
      [room, limit],
    )
  ).rows;
}

export type Contact = {
  username: string;
  name: string;
  role: string;
  role_label: string;
  room: string;
  unread: number;
  last_body: string | null;
  last_at: string | null;
};

/**
 * ລາຍຊື່ຄົນທີ່ລົມນຳໄດ້ + ຂໍ້ຄວາມຫຼ້າສຸດ + ຈຳນວນທີ່ຍັງບໍ່ໄດ້ອ່ານ.
 *
 * ── ⚠️ ຕ້ອງດຶງຄົນຈາກ **2 ແຫຼ່ງ** ເພາະທາງເຂົ້າມີ 2 ທາງ ──
 *   ① ຕາຕະລາງ `users` ຂອງ ODS — ຜູ້ໃຊ້ເກົ່າ (42 ຄົນ)
 *   ② `odg_employee` ຂອງ ERP — ພະນັກງານສ່ວນຫຼາຍດຽວນີ້ login ທາງນີ້ (242 ຄົນ)
 * ຮອບກ່ອນຂຽນເອົາແຕ່ ① ⇒ ແຊັດເຫັນພຽງ 42/242 ຄົນ: ຊ່າງທີ່ login ຜ່ານ ERP
 * ບໍ່ຂຶ້ນໃນລາຍຊື່ຂອງໃຜເລີຍ ແລະ **ບໍ່ມີໃຜແຊັດຫາເຂົາໄດ້** — ບັກອັນດຽວກັນທີ່ເຄີຍ
 * ເຮັດໃຫ້ພະນັກງານສາງບໍ່ເຄີຍໄດ້ຮັບການແຈ້ງເຕືອນ (ເບິ່ງ recipientsForRoles ຢູ່ lib/notify).
 *
 * ຕົວຕົນ (username) ຕ້ອງເປັນຄ່າດຽວກັບທີ່ session ໃຊ້ ⇒ ໃຊ້ ERP_IDENTITY_SQL
 * ສູດດຽວກັນກັບຕອນ login. ຄົນທີ່ຢູ່ທັງສອງແຫຼ່ງ = ຄົນດຽວ ⇒ ຕັດຊ້ຳດ້ວຍຊື່ (ບໍ່ສົນໂຕພິມ).
 * join ຂ້າມຖານບໍ່ໄດ້ ⇒ ດຶງແຍກ ແລ້ວລວມຢູ່ Node.
 *
 * ນັບ unread ດ້ວຍ **id** (ບໍ່ແມ່ນເວລາ): `id > last_read_id` ⇒ ບໍ່ຫຼົ້ນເມື່ອສອງຂໍ້ຄວາມ
 * ມາວິນາທີດຽວກັນ ແລະ ບໍ່ຂຶ້ນກັບໂມງຂອງເຄື່ອງໃດ.
 */
type Person = { username: string; name: string; role: string };

/**
 * ── ⚠️ ຕົວຕົນເກົ່າທີ່ຕາຍແລ້ວ ──
 * ODS ມີ 42 ແຖວ ແຕ່ **14 ແຖວຊື່ເປັນລະຫັດພະນັກງານ** ('24015', '14006' …) — ຄົນເຫຼົ່ານີ້
 * ດຽວນີ້ login ຜ່ານ ERP ແລ້ວ session ຂອງເຂົາເປັນ**ຊື່ຫຼິ້ນ** ບໍ່ແມ່ນລະຫັດ ⇒ ແຖວເກົ່າ
 * ເປັນຄົນດຽວກັນແຕ່ຄົນລະຊື່. ຖ້າປະໄວ້: ລາຍຊື່ຂຶ້ນເລກແປກໆ ແລະ **ແຊັດຫາໄປກໍ່ບໍ່ມີໃຜເຫັນ**
 * ເພາະບໍ່ມີໃຜ login ດ້ວຍຕົວຕົນນັ້ນອີກແລ້ວ ⇒ ຕັດແຖວທີ່ຈັບຄູ່ກັບພະນັກງານ ERP ອອກ.
 */
async function odsPeople(erpCodes: Set<string>): Promise<Person[]> {
  const rows = (
    await query<Person & { code: string | null; linked: string | null }>(
      `select u.username, coalesce(nullif(u.name_1,''), u.username) as name, u.roles as role,
          u.code,
          (select e.employee_code from ods_user_employee e
            where lower(e.user_code) = lower(u.username) limit 1) as linked
         from users u where coalesce(trim(u.username),'') <> ''`,
    )
  ).rows;

  return rows
    .filter((row) => {
      const aliases = [row.username, row.code ?? "", row.linked ?? ""].map((value) => value.trim().toLowerCase());
      return !aliases.some((alias) => alias && erpCodes.has(alias));
    })
    .map((row) => ({ username: row.username, name: row.name, role: row.role }));
}

async function erpPeople(): Promise<{ people: Person[]; codes: Set<string> }> {
  try {
    const rows = (
      await queryOdg<Person & { employee_code: string }>(
        `select e.employee_code, ${ERP_IDENTITY_SQL} as name, ${ERP_IDENTITY_SQL} as username,
            (${ERP_ROLE_CASE}) as role
           from odg_employee e
          where e.employment_status = 'ACTIVE'`,
      )
    ).rows;

    // ສິດ/ສະຖານະທີ່ຜູ້ຈັດການກຳນົດເອງຊະນະພະແນກ ERP ສະເໝີ — ຄືກັນກັບຕອນ login
    const overrides = new Map((await listEmployeeOverrides()).map((row) => [row.employee_code, row]));
    const people = rows
      .filter((row) => overrides.get(row.employee_code)?.active !== false)
      .map((row) => ({ ...row, role: overrides.get(row.employee_code)?.app_role || row.role }));
    // ລະຫັດ ERP ທັງໝົດ (ລວມຄົນນອກແນກບໍລິການ) — ໃຊ້ຕັດຕົວຕົນເກົ່າຂອງ ODS ອອກ
    return { people, codes: new Set(rows.map((row) => row.employee_code.trim().toLowerCase())) };
  } catch (error) {
    // ຖານ ERP ບໍ່ພ້ອມ ⇒ ຍັງແຊັດກັບຜູ້ໃຊ້ເກົ່າໄດ້ຢູ່ ບໍ່ໃຫ້ລົ້ມທັງໜ້າ
    console.error("chat: odg_employee failed", error);
    return { people: [], codes: new Set<string>() };
  }
}

export async function contactsFor(me: string): Promise<Contact[]> {
  const erp = await erpPeople();
  const ods = await odsPeople(erp.codes);

  const people = new Map<string, Person>();
  for (const person of [...erp.people, ...ods]) {
    // **ສະເພາະແນກບໍລິການ** — ພະນັກງານກຸ່ມບໍລິສັດອີກ 149 ຄົນ (role 'user') ບໍ່ມີວຽກຮ່ວມກັນ
    // ຢູ່ລະບົບນີ້ ⇒ ບໍ່ເອົາເຂົ້າລາຍຊື່ (ຄືກັນກັບຫ້ອງທີມ ທີ່ບໍ່ເອົາ 'user' ຢູ່ແລ້ວ)
    if (!TEAM_ROLES.includes(person.role as Role)) continue;
    const username = (person.username ?? "").trim();
    // ຄົນດຽວກັນທີ່ຢູ່ທັງສອງແຫຼ່ງ: ໃຫ້ ODS ຊະນະ (users.roles ຮູ້ຈັກ "ຜູ້ຈັດການ"/"ຫົວໜ້າຊ່າງ" ຊຶ່ງ ERP ບໍ່ຮູ້)
    if (username && username.toLowerCase() !== me.trim().toLowerCase()) {
      people.set(username.toLowerCase(), { ...person, username, name: person.name || username });
    }
  }
  const names = [...people.values()].map((person) => person.username);
  if (!names.length) return [];

  /** ສະຖິຕິຂອງແຕ່ລະຫ້ອງ dm — ຄິດຢູ່ SQL ຮອບດຽວ ບໍ່ແມ່ນຖາມເທື່ອລະຄົນ (242 ຄົນ = 242 query) */
  const stats = (
    await query<{ peer: string; unread: number; last_body: string | null; last_at: string | null }>(
      `select p.peer,
          coalesce((select count(*) from ods_chat_message m
                     where m.room = r.room and m.author <> $1
                       and m.id > coalesce((select last_read_id from ods_chat_read
                                             where room = r.room and username = $1), 0)),0)::int as unread,
          (select m.body from ods_chat_message m where m.room = r.room order by m.id desc limit 1) as last_body,
          (select to_char(m.created_at,'DD-MM HH24:MI') from ods_chat_message m
            where m.room = r.room order by m.id desc limit 1) as last_at
        from unnest($2::text[]) as p(peer)
        cross join lateral (select 'dm:' || array_to_string(array(select unnest(array[$1, p.peer]) order by 1), '|') as room) r
       order by (select max(m.id) from ods_chat_message m where m.room = r.room) desc nulls last`,
      [me, names],
    )
  ).rows;

  const byPeer = new Map(stats.map((row) => [row.peer, row]));
  return [...people.values()]
    .map((person) => {
      const stat = byPeer.get(person.username);
      return {
        username: person.username,
        name: person.name,
        role: person.role,
        role_label: ROLE_LABEL[person.role as Role] ?? person.role,
        room: dmRoom(me, person.username),
        unread: stat?.unread ?? 0,
        last_body: stat?.last_body ?? null,
        last_at: stat?.last_at ?? null,
      };
    })
    // ຄົນທີ່ຫາກໍ່ລົມນຳຂຶ້ນກ່ອນ ແລ້ວຈຶ່ງຮຽງຕາມຊື່ (ຄືແອັບແຊັດທົ່ວໄປ)
    .sort((a, b) => {
      const order = stats.findIndex((row) => row.peer === a.username) - stats.findIndex((row) => row.peer === b.username);
      if (a.last_at && !b.last_at) return -1;
      if (!a.last_at && b.last_at) return 1;
      if (a.last_at && b.last_at) return order;
      return a.name.localeCompare(b.name);
    });
}

/** ຈຳນວນຂໍ້ຄວາມທີ່ຍັງບໍ່ໄດ້ອ່ານທັງໝົດ — ປ້າຍຕົວເລກຢູ່ເມນູ */
export async function unreadTotal(me: string, role: Role): Promise<number> {
  const rooms = roomsOf(me, role);
  const row = (
    await query<{ n: number }>(
      `select count(*)::int n from ods_chat_message m
        where m.author <> $1
          and (m.room = any($2::text[]) or (m.room like 'dm:%' and $1 = any(string_to_array(substring(m.room from 4), '|'))))
          and m.id > coalesce((select last_read_id from ods_chat_read r where r.room = m.room and r.username = $1), 0)`,
      [me, rooms],
    )
  ).rows[0];
  return row?.n ?? 0;
}
