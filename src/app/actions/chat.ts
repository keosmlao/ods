"use server";
import { getSession } from "@/lib/auth";
import { ALL_ROOM, canJoin, contactsFor, dmPeer, messagesOf, roomLabel, TEAM_ROLES, teamRoom, type ChatMessage, type Contact } from "@/lib/chat";
import { query } from "@/lib/db";
import { pushToUser } from "@/lib/push";
import { roleOf } from "@/lib/roles";
import { revalidatePath } from "next/cache";

/**
 * **Live chat — ສົ່ງ / ດຶງ / ໝາຍວ່າອ່ານແລ້ວ.**
 *
 * ── "Live" ດ້ວຍວິທີໃດ ──
 * ໃຊ້ **polling** (ໜ້າຈໍຖາມທຸກ 3 ວິນາທີ ດ້ວຍ `sinceId`) ບໍ່ແມ່ນ WebSocket ເພາະ:
 *   ① Next.js ແລ່ນເປັນ server ດຽວ ບໍ່ມີ socket server ⇒ WebSocket ຕ້ອງເພີ່ມບໍລິການໃໝ່
 *   ② ຄົນໃຊ້ 42 ຄົນ · ຖາມເທື່ອລະ "ມີຫຍັງໃໝ່ຫຼັງ id ນີ້ບໍ" = index scan ນ້ອຍໆ
 *   ③ ບໍ່ມີຫຍັງໃໝ່ ⇒ ຄືນ array ຫວ່າງ (ບໍ່ດຶງຂໍ້ຄວາມທັງໝົດຄືນທຸກຮອບ)
 * ຖ້າມື້ໜ້າຄົນຫຼາຍຂຶ້ນຈົນ polling ໜັກ ຈຶ່ງຄ່ອຍປ່ຽນເປັນ SSE — ໂຄງນີ້ບໍ່ຂວາງ.
 *
 * ດ່ານເຂົ້າຫ້ອງ (`canJoin`) ບັງຄັບ**ທຸກ action** — ບໍ່ແມ່ນແຕ່ຢູ່ໜ້າຈໍ.
 */

export type ChatState = { error?: string };

const MAX = 2000;

/** ສົ່ງຂໍ້ຄວາມ — ບັນທຶກ + ດັນມືຖືໃຫ້ຄູ່ສົນທະນາ (ຫ້ອງກຸ່ມບໍ່ດັນ ກັນລົບກວນ 17 ຄົນພ້ອມກັນ) */
export async function sendChatMessage(_: ChatState, formData: FormData): Promise<ChatState> {
  const session = await getSession();
  if (!session) return { error: "Session ໝົດອາຍຸ" };

  const room = String(formData.get("room") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim().slice(0, MAX);
  if (!room || !body) return {};
  if (!canJoin(room, session.username, roleOf(session))) return { error: "ບໍ່ມີສິດສົ່ງໃນຫ້ອງນີ້" };

  const row = (
    await query<{ id: string }>(
      `insert into ods_chat_message(room, author, body) values($1,$2,$3) returning id::text`,
      [room, session.username, body],
    )
  ).rows[0];

  // ຄົນສົ່ງ = ອ່ານແລ້ວ (ບໍ່ດັ່ງນັ້ນຂໍ້ຄວາມຕົນເອງຈະນັບເປັນ "ຍັງບໍ່ອ່ານ" ຂອງຕົນ)
  await markRoomRead(room, row?.id ?? "0", session.username);

  const peer = dmPeer(room, session.username);
  if (peer) {
    await pushToUser(peer, session.username, body.slice(0, 120), { room });
  }
  revalidatePath("/chat");
  return {};
}

/** ດຶງສະເພາະຂໍ້ຄວາມ**ໃໝ່ກວ່າ** id ທີ່ໜ້າຈໍມີແລ້ວ — ຫົວໃຈຂອງ polling */
export async function pollChat(room: string, sinceId: string): Promise<ChatMessage[]> {
  const session = await getSession();
  if (!session) return [];
  if (!canJoin(room, session.username, roleOf(session))) return [];

  const since = /^\d+$/.test(sinceId) ? sinceId : "0";
  const rows = (
    await query<ChatMessage>(
      `select m.id::text, m.room, m.author,
          (select coalesce(nullif(u.name_1,''), u.username) from users u where u.username = m.author limit 1) author_name,
          m.body, to_char(m.created_at,'DD-MM HH24:MI') created_at,
          to_char(m.created_at,'YYYY-MM-DD"T"HH24:MI:SS') at_iso
        from ods_chat_message m
       where m.room = $1 and m.id > $2::bigint
       order by m.id limit 200`,
      [room, since],
    )
  ).rows;

  // ເຫັນຂໍ້ຄວາມແລ້ວ = ອ່ານແລ້ວ (ໜ້າຈໍເປີດຢູ່) ⇒ ປ້າຍຕົວເລກລຸດເອງ
  if (rows.length) await markRoomRead(room, rows[rows.length - 1].id, session.username);
  return rows;
}

/** ໂຫຼດຫ້ອງເທື່ອທຳອິດ (ຫຼື ຕອນປ່ຽນຫ້ອງ) */
export async function loadRoom(room: string): Promise<ChatMessage[]> {
  const session = await getSession();
  if (!session) return [];
  if (!canJoin(room, session.username, roleOf(session))) return [];
  const rows = await messagesOf(room);
  if (rows.length) await markRoomRead(room, rows[rows.length - 1].id, session.username);
  return rows;
}

/** ບຸກມາກການອ່ານ — ຂຽນທັບສະເພາະເມື່ອ id ໃໝ່ກວ່າ (ກັນຖອຍຫຼັງເມື່ອສອງແທັບເປີດພ້ອມກັນ) */
async function markRoomRead(room: string, lastId: string, username: string) {
  await query(
    `insert into ods_chat_read(room, username, last_read_id) values($1,$2,$3::bigint)
     on conflict (room, username) do update
        set last_read_id = greatest(ods_chat_read.last_read_id, excluded.last_read_id),
            updated_at = localtimestamp(0)`,
    [room, username, lastId],
  );
}

export async function markRead(room: string, lastId: string): Promise<void> {
  const session = await getSession();
  if (!session || !canJoin(room, session.username, roleOf(session))) return;
  if (!/^\d+$/.test(lastId)) return;
  await markRoomRead(room, lastId, session.username);
  revalidatePath("/chat");
}

/**
 * ຂໍ້ມູນຕັ້ງຕົ້ນຂອງ**ປຸ່ມແຊັດລອຍ** — ລາຍຊື່ຄົນ + ຫ້ອງທີ່ເຂົ້າໄດ້.
 * ປຸ່ມລອຍຢູ່ນອກໜ້າ /chat ຈຶ່ງບໍ່ມີ server component ມາປ້ອນ props ໃຫ້ ⇒ ດຶງຜ່ານ action.
 * ຄິດ role ຢູ່ **server** (ບໍ່ຮັບຈາກ client) ⇒ ຫ້ອງທີມປອມບໍ່ໄດ້.
 */
export async function chatPanelData(): Promise<{ me: string; contacts: Contact[]; rooms: { room: string; label: string }[] }> {
  const session = await getSession();
  if (!session) return { me: "", contacts: [], rooms: [] };
  const role = roleOf(session);
  const rooms = [ALL_ROOM, ...(TEAM_ROLES.includes(role) ? [teamRoom(role)] : [])].map((room) => ({
    room,
    label: roomLabel(room, session.username),
  }));
  return { me: session.username, contacts: await contactsFor(session.username), rooms };
}

/** ຊື່ຫ້ອງ (ໃຫ້ໜ້າຈໍສະແດງຫົວ) — ຮັກສານິຍາມໄວ້ຝັ່ງ server ບ່ອນດຽວ */
export async function roomTitle(room: string): Promise<string> {
  const session = await getSession();
  return session ? roomLabel(room, session.username) : room;
}
