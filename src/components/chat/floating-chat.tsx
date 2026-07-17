"use client";
import { chatPanelData } from "@/app/actions/chat";
import { ChatRoom } from "@/components/chat/chat-room";
import type { Contact } from "@/lib/chat";
import { ArrowLeft, Hash, MessageCircle, Search, Users, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

/**
 * **ປຸ່ມແຊັດລອຍ** — ມູມຂວາລຸ່ມ ເຫັນທຸກໜ້າ.
 *
 * ── ເປັນຫຍັງເປັນປຸ່ມລອຍ ບໍ່ແມ່ນລາຍການເມນູ ──
 * ຄົນລົມກັນ **ໃນຂະນະທີ່**ກຳລັງເຮັດວຽກຢູ່ໜ້າອື່ນ ("ໃບນີ້ເອົາແນວໃດ?"). ຖ້າເປັນເມນູ
 * ຕ້ອງອອກຈາກໜ້າວຽກໄປໜ້າແຊັດ ແລ້ວກັບມາຫາບ່ອນເກົ່າໃໝ່ ⇒ ວຽກຂາດຕອນ.
 * ໜ້າ /chat ຍັງຢູ່ (ລິ້ງເກົ່າ ແລະ push ຂອງມືຖືພາໄປນັ້ນ) — ອັນນີ້ເປັນທາງລັດ ບໍ່ແມ່ນຕົວແທນ.
 *
 * ── ດຶງຂໍ້ມູນຕອນເປີດເທົ່ານັ້ນ ──
 * ລາຍຊື່ 110 ຄົນ + ສະຖິຕິຫ້ອງ = query ບໍ່ນ້ອຍ ⇒ ດຶງຕອນກົດເປີດ ບໍ່ແມ່ນຕອນໂຫຼດທຸກໜ້າ
 * (ບໍ່ດັ່ງນັ້ນທຸກໜ້າຂອງລະບົບຈະໜັກຂຶ້ນເພື່ອສິ່ງທີ່ຄົນສ່ວນຫຼາຍບໍ່ໄດ້ເປີດ).
 */
export function FloatingChat({ unread }: { unread: number }) {
  const [open, setOpen] = useState(false);
  const [room, setRoom] = useState<string | null>(null);
  const [me, setMe] = useState("");
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [rooms, setRooms] = useState<{ room: string; label: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [term, setTerm] = useState("");

  useEffect(() => {
    if (!open) return;
    let alive = true;
    chatPanelData().then((data) => {
      if (!alive) return;
      setMe(data.me);
      setContacts(data.contacts);
      setRooms(data.rooms);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [open]);

  const shown = useMemo(() => {
    const needle = term.trim().toLowerCase();
    if (!needle) return contacts;
    return contacts.filter(
      (contact) =>
        contact.name.toLowerCase().includes(needle) ||
        contact.username.toLowerCase().includes(needle) ||
        contact.role_label.toLowerCase().includes(needle),
    );
  }, [contacts, term]);

  // ຕົວເລກຂອງປຸ່ມ: ໃຊ້ຄ່າຈາກ server ຈົນກວ່າຈະເປີດ ແລ້ວຈຶ່ງນັບຈາກລາຍຊື່ຈິງ
  const badge = open && !loading ? contacts.reduce((sum, contact) => sum + contact.unread, 0) : unread;

  const title = room
    ? (rooms.find((entry) => entry.room === room)?.label ??
       contacts.find((contact) => contact.room === room)?.name ??
       room)
    : "";

  return (
    <>
      {open && (
        <section className="fixed bottom-20 right-4 z-50 flex h-[32rem] w-[22rem] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
          <header className="flex items-center gap-2 border-b border-slate-200 px-3 py-2.5">
            {room && (
              <button
                type="button"
                onClick={() => setRoom(null)}
                className="grid size-6 shrink-0 place-items-center rounded hover:bg-slate-100"
                aria-label="ກັບຄືນ"
              >
                <ArrowLeft className="size-4 text-slate-500" />
              </button>
            )}
            <h2 className="min-w-0 flex-1 truncate text-sm font-bold text-slate-700">{room ? title : "ສົນທະນາ"}</h2>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="grid size-6 shrink-0 place-items-center rounded hover:bg-slate-100"
              aria-label="ປິດ"
            >
              <X className="size-4 text-slate-500" />
            </button>
          </header>

          {room ? (
            /* key={room} ⇒ ປ່ຽນຫ້ອງ = component ໃໝ່ (state ເກົ່າຫາຍໄປເອງ) */
            <ChatRoom key={room} room={room} me={me} title="" compact />
          ) : (
            <div className="flex-1 overflow-y-auto p-2">
              {loading ? (
                <p className="py-10 text-center text-xs text-slate-400">ກຳລັງໂຫຼດ...</p>
              ) : (
                <>
                  <div className="space-y-0.5 pb-2">
                    {rooms.map((entry) => (
                      <button
                        key={entry.room}
                        type="button"
                        onClick={() => setRoom(entry.room)}
                        className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs text-slate-600 hover:bg-slate-100"
                      >
                        {entry.room === "all" ? (
                          <Users className="size-3.5 shrink-0" />
                        ) : (
                          <Hash className="size-3.5 shrink-0" />
                        )}
                        {entry.label}
                      </button>
                    ))}
                  </div>

                  <div className="relative pb-1">
                    <Search className="pointer-events-none absolute left-2 top-1/2 size-3 -translate-y-1/2 text-slate-400" />
                    <input
                      value={term}
                      onChange={(event) => setTerm(event.target.value)}
                      placeholder="ຄົ້ນຫາຊື່..."
                      className="h-8 w-full rounded-lg border border-slate-300 pl-7 pr-2 text-xs focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-100"
                    />
                  </div>

                  {shown.length === 0 && (
                    <p className="py-6 text-center text-[10px] text-slate-400">ບໍ່ພົບຊື່ນີ້</p>
                  )}

                  {shown.map((contact) => (
                    <button
                      key={contact.username}
                      type="button"
                      onClick={() => setRoom(contact.room)}
                      className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs text-slate-600 hover:bg-slate-100"
                    >
                      <span className="grid size-7 shrink-0 place-items-center rounded-full bg-slate-200 text-[10px] font-bold text-slate-600">
                        {(contact.name || contact.username).slice(0, 2)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1">
                          <span className="truncate font-semibold">{contact.name}</span>
                          {contact.unread > 0 && (
                            <span className="ml-auto grid min-w-4 shrink-0 place-items-center rounded-full bg-red-600 px-1 text-[9px] font-bold text-white">
                              {contact.unread}
                            </span>
                          )}
                        </span>
                        <span className="block truncate text-[10px] text-slate-400">
                          {contact.last_body ?? contact.role_label}
                        </span>
                      </span>
                    </button>
                  ))}
                </>
              )}
            </div>
          )}
        </section>
      )}

      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label="ສົນທະນາ"
        className="fixed bottom-4 right-4 z-50 grid size-12 place-items-center rounded-full bg-[#0536a9] text-white shadow-lg transition hover:opacity-90"
      >
        {open ? <X className="size-5" /> : <MessageCircle className="size-5" />}
        {!open && badge > 0 && (
          <span className="absolute -right-0.5 -top-0.5 grid min-w-5 place-items-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white ring-2 ring-white">
            {badge > 99 ? "99+" : badge}
          </span>
        )}
      </button>
    </>
  );
}
