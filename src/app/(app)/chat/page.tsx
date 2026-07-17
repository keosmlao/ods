import { ChatRoom } from "@/components/chat/chat-room";
import { ContactList } from "@/components/chat/contact-list";
import { LinkPending } from "@/components/link-pending";
import { getSession } from "@/lib/auth";
import { ALL_ROOM, canJoin, contactsFor, roomLabel, teamRoom, TEAM_ROLES } from "@/lib/chat";
import { ROLE_LABEL, roleOf, type Role } from "@/lib/roles";
import { Hash, Users } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

/**
 * **ສົນທະນາ (live chat)** — ພະນັກງານ · ຫົວໜ້າ · ຜູ້ຈັດການ · ຊ່າງ ລົມກັນ.
 *
 * ── ໂຄງ ──
 * ຊ້າຍ = ຫ້ອງລວມ + ຫ້ອງທີມຂອງຕົນ + ລາຍຊື່ຄົນ (ຮຽງຄົນທີ່ລົມລ່າສຸດຂຶ້ນກ່ອນ ພ້ອມ
 * ຂໍ້ຄວາມຫຼ້າສຸດ ແລະ ຕົວເລກທີ່ຍັງບໍ່ໄດ້ອ່ານ) · ຂວາ = ຫ້ອງທີ່ເລືອກ (ອັບເດດເອງທຸກ 3 ວິ).
 *
 * ── ຄວາມເປັນສ່ວນຕົວ ──
 * `dm:` ເຫັນສະເພາະສອງຄົນນັ້ນ — **ຜູ້ຈັດການກໍ່ອ່ານຂອງຄົນອື່ນບໍ່ໄດ້** (canJoin ບັງຄັບ
 * ທັງໜ້ານີ້ ແລະ ທຸກ action). ຫ້ອງທີມເຫັນສະເພາະຄົນໃນ role ນັ້ນ.
 */
export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ room?: string }> };

export default async function ChatPage({ searchParams }: Props) {
  const session = await getSession();
  if (!session) redirect("/login");
  const me = session.username;
  const role = roleOf(session);

  const params = await searchParams;
  // ຫ້ອງທີ່ຂໍມາເຂົ້າບໍ່ໄດ້ ⇒ ຕົກກັບຫ້ອງລວມ (ບໍ່ແມ່ນ error — ຄົນອາດແປະລິ້ງເກົ່າ)
  const asked = (params.room ?? "").trim();
  const room = asked && canJoin(asked, me, role) ? asked : ALL_ROOM;

  const contacts = await contactsFor(me);
  const myTeam: Role[] = TEAM_ROLES.includes(role) ? [role] : [];

  const roomHref = (target: string) => `/chat?room=${encodeURIComponent(target)}`;
  const ItemClass = (active: boolean) =>
    `flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs ${
      active ? "bg-[#0536a9] text-white" : "text-slate-600 hover:bg-slate-100"
    }`;

  return (
    <div className="w-full space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-700">ສົນທະນາ</h1>
        <p className="mt-0.5 text-xs text-slate-500">
          ລົມກັບເພື່ອນຮ່ວມງານ · ຂໍ້ຄວາມສ່ວນຕົວເຫັນສະເພາະສອງຄົນ · ອັບເດດເອງທຸກ 3 ວິນາທີ
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[18rem_1fr]">
        {/* ── ຊ້າຍ: ຫ້ອງ + ຄົນ ── */}
        <aside className="h-[calc(100vh-11rem)] space-y-3 overflow-y-auto rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm">
          <div className="space-y-0.5">
            <p className="px-1 pb-1 text-[10px] font-bold uppercase text-slate-400">ຫ້ອງ</p>
            <Link href={roomHref(ALL_ROOM)} className={ItemClass(room === ALL_ROOM)}>
              <Users className="size-3.5 shrink-0" />
              ທຸກຄົນໃນບໍລິສັດ
              <LinkPending className="size-3" />
            </Link>
            {myTeam.map((team) => (
              <Link key={team} href={roomHref(teamRoom(team))} className={ItemClass(room === teamRoom(team))}>
                <Hash className="size-3.5 shrink-0" />
                ທີມ {ROLE_LABEL[team]}
                <LinkPending className="size-3" />
              </Link>
            ))}
          </div>

          <ContactList contacts={contacts} room={room} />
        </aside>

        {/* ── ຂວາ: ຫ້ອງທີ່ເລືອກ ── */}
        {/* key={room} ⇒ ປ່ຽນຫ້ອງ = component ໃໝ່ (state ເກົ່າຫາຍໄປເອງ ບໍ່ຕ້ອງລ້າງດ້ວຍມື) */}
        <ChatRoom key={room} room={room} me={me} title={roomLabel(room, me)} />
      </div>
    </div>
  );
}
