"use client";
import { LinkPending } from "@/components/link-pending";
import type { Contact } from "@/lib/chat";
import { Search } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

/**
 * **ລາຍຊື່ຄົນທີ່ລົມນຳໄດ້ + ຊ່ອງຄົ້ນຫາ.**
 *
 * ── ເປັນຫຍັງຕ້ອງມີຊ່ອງຄົ້ນຫາ ──
 * ຄົນທີ່ login ໄດ້ມີ **242 ຄົນ** (ພະນັກງານ ERP ທັງກຸ່ມ) ບໍ່ແມ່ນ 42 ຄົນຄືທີ່ຄິດຕອນທຳອິດ.
 * ຈະຕັດຄົນນອກຝ່າຍບໍລິການອອກກໍ່ບໍ່ໄດ້ — ເຂົາ login ໄດ້ ແລະ ຖ້າບໍ່ຢູ່ໃນລາຍຊື່
 * ກໍ່**ບໍ່ມີໃຜແຊັດຫາເຂົາໄດ້** (ບັກອັນດຽວກັນທີ່ຫາກໍ່ແກ້ໄປ). ⇒ ເອົາທຸກຄົນ ແລ້ວກອງເອົາ.
 * ກອງຢູ່ browser ເພາະລາຍຊື່ໂຫຼດມາຄົບແລ້ວ — ພິມແລ້ວເຫັນຜົນທັນທີ ບໍ່ຕ້ອງຖາມ server.
 */
export function ContactList({ contacts, room }: { contacts: Contact[]; room: string }) {
  const [term, setTerm] = useState("");

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

  return (
    <div className="space-y-0.5">
      <div className="flex items-center justify-between px-1 pb-1">
        <p className="text-[10px] font-bold uppercase text-slate-400">ພະນັກງານ ({shown.length})</p>
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

      {shown.length === 0 && <p className="px-1 py-3 text-center text-[10px] text-slate-400">ບໍ່ພົບຊື່ນີ້</p>}

      {shown.map((contact) => {
        const active = room === contact.room;
        return (
          <Link
            key={contact.username}
            href={`/chat?room=${encodeURIComponent(contact.room)}`}
            className={`flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs ${
              active ? "bg-[#0536a9] text-white" : "text-slate-600 hover:bg-slate-100"
            }`}
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
              <span className={`block truncate text-[10px] ${active ? "text-white/70" : "text-slate-400"}`}>
                {contact.last_body ?? contact.role_label}
              </span>
            </span>
            <LinkPending className="size-3" />
          </Link>
        );
      })}
    </div>
  );
}
