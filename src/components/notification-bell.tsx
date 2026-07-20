"use client";
import { markAllNotificationsRead, type NotificationBrief } from "@/app/actions/notification";
import { LinkPending } from "@/components/link-pending";
import { NOTIFICATION_KIND_LABEL, recordHref, type NotificationKind } from "@/lib/chatter";
import { useDict } from "@/lib/i18n/context";
import { BellRing, CheckCheck, LoaderCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";

/**
 * **ກະດິງການເຄື່ອນໄຫວ** — ກ່ອງເລື່ອນລົງ ບໍ່ຕ້ອງຍ່າງໄປໜ້າ /notifications ກ່ອນ.
 *
 * ── ເປັນຫຍັງເປັນ dropdown ──
 * ການແຈ້ງເຕືອນສ່ວນຫຼາຍຄື "ຮູ້ໄວ້" ບໍ່ແມ່ນ "ໄປເຮັດ" ⇒ ບັງຄັບໃຫ້ປ່ຽນໜ້າເພື່ອອ່ານ
 * ແລ້ວກັບມາບ່ອນເກົ່າ ຄືການລົງໂທດຄົນທີ່ຢາກຮູ້. ໜ້າເຕັມ (/notifications) ຍັງຢູ່
 * ສຳລັບຄົ້ນຫາ/ແບ່ງໜ້າ — ກົດ "ເບິ່ງທັງໝົດ" ລຸ່ມກ່ອງ.
 *
 * ── ດຶງຂໍ້ມູນຕອນເປີດ ບໍ່ແມ່ນຕອນໂຫຼດໜ້າ ──
 * ປ້າຍຕົວເລກມາຈາກ layout ຢູ່ແລ້ວ (ຖືກຢູ່ສະເໝີ). ລາຍການດຶງເມື່ອກົດເປີດ ⇒ ທຸກໜ້າ
 * ຂອງແອັບບໍ່ຕ້ອງແບກ query ນີ້ ແລະ ສິ່ງທີ່ເຫັນຄືສິ່ງທີ່ຈິງ **ຕອນເປີດ** ບໍ່ແມ່ນຕອນໂຫຼດໜ້າ.
 */

type Dict = ReturnType<typeof useDict>["notificationBell"];

const KIND_DOT: Record<NotificationKind, string> = {
  log: "bg-slate-300",
  comment: "bg-sky-500",
  assign: "bg-amber-500",
};

/**
 * ອາຍຸເປັນຄຳເວົ້າ — "ຫາກໍ່" · "18 ນາທີ" · "3 ຊົ່ວໂມງ" · "2 ມື້".
 * ຄິດຈາກວິນາທີທີ່ server ສົ່ງມາ (ບໍ່ແຕະໂມງຂອງເຄື່ອງ ⇒ ບໍ່ມີບັນຫາເຂດເວລາ/hydration).
 */
function ageLabel(seconds: number, t: Dict) {
  if (seconds < 60) return t.justNow;
  if (seconds < 3600) return `${Math.floor(seconds / 60)} ${t.minutes}`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} ${t.hours}`;
  return `${Math.floor(seconds / 86400)} ${t.days}`;
}

export function NotificationBell({ count, label }: { count: number; label: string }) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<NotificationBrief[] | null>(null);
  const [unread, setUnread] = useState(count);
  const [loading, setLoading] = useState(false);
  const [marking, startMarking] = useTransition();
  const boxRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const t = useDict().notificationBell;

  // ປິດເມື່ອກົດນອກກ່ອງ ຫຼື ກົດ Esc — ຄືກ່ອງເລື່ອນລົງທົ່ວໄປ
  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      if (!boxRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const load = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const response = await fetch(`/api/notifications?t=${Date.now()}`, {
        cache: "no-store",
        credentials: "same-origin",
      });
      if (!response.ok) throw new Error(`notification fetch failed: ${response.status}`);
      const data = (await response.json()) as { rows: NotificationBrief[]; unread: number };
      setRows(data.rows);
      setUnread(data.unread);
    } catch (error) {
      console.error(error);
    } finally {
      if (showLoading) setLoading(false);
    }
  }, []);

  // PostgreSQL NOTIFY → SSE ປຸກ browser ທັນທີທີ່ມີ event. ການ poll 60 ວິນາທີ
  // ເປັນພຽງ fallback ຖ້າ proxy/network ຕັດ SSE; ບໍ່ແມ່ນທາງຫຼັກ. Event ດຽວກັນ
  // ຕ້ອງ refresh Server Components ຂອງໜ້າຄິວນຳ ເພື່ອໃຫ້ແຖວຍ້າຍຂັ້ນທັນທີ.
  useEffect(() => {
    const refreshBell = () => {
      if (document.visibilityState === "visible") void load(false);
    };
    const refreshPage = () => {
      if (document.visibilityState !== "visible") return;
      void load(false);
      router.refresh();
    };
    const initial = window.setTimeout(refreshPage, 0);
    const source = new EventSource("/api/notifications/stream");
    source.addEventListener("notification", refreshPage);
    const timer = window.setInterval(refreshBell, 60_000);
    window.addEventListener("focus", refreshPage);
    document.addEventListener("visibilitychange", refreshPage);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(timer);
      source.removeEventListener("notification", refreshPage);
      source.close();
      window.removeEventListener("focus", refreshPage);
      document.removeEventListener("visibilitychange", refreshPage);
    };
  }, [load, router]);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next) void load(); // ດຶງໃໝ່ທຸກເທື່ອທີ່ເປີດ — ຂໍ້ມູນເກົ່າຄ້າງ ຄືການໂກຫົກ
  };

  const markAll = () =>
    startMarking(async () => {
      await markAllNotificationsRead();
      await load();
      router.refresh(); // ປ້າຍຕົວເລກມາຈາກ layout (server) ⇒ ຕ້ອງໃຫ້ມັນ render ໃໝ່
    });

  return (
    <div ref={boxRef} className="relative">
      <button
        type="button"
        title={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={toggle}
        className={`relative grid size-8 place-items-center rounded-lg transition ${
          open ? "bg-slate-100 text-slate-600" : "text-slate-400 hover:bg-slate-100 hover:text-slate-600"
        }`}
      >
        <BellRing className="size-4" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-teal-600 px-1 text-[10px] font-bold text-white">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-10 z-30 w-96 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl"
        >
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
            <div>
              <p className="text-sm font-bold text-slate-700">{t.activity}</p>
              <p className="text-[11px] text-slate-400">
                {unread > 0 ? `${unread} ${t.newItems}` : t.allRead}
              </p>
            </div>
            {unread > 0 && (
              <button
                type="button"
                disabled={marking}
                onClick={markAll}
                className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold text-teal-700 hover:bg-teal-50 disabled:opacity-50"
              >
                {marking ? <LoaderCircle className="size-3.5 animate-spin" /> : <CheckCheck className="size-3.5" />}
                {t.markAllRead}
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {loading && rows === null ? (
              <p className="grid place-items-center py-10 text-xs text-slate-400">
                <LoaderCircle className="size-4 animate-spin" />
              </p>
            ) : rows && rows.length > 0 ? (
              rows.map((row) => {
                const href = recordHref(row.model, row.res_id);
                const body = (
                  <>
                    <span className={`mt-1.5 size-2 shrink-0 rounded-full ${KIND_DOT[row.kind] ?? "bg-slate-300"}`} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-semibold text-slate-700">{row.body}</span>
                      <span className="block truncate text-[11px] text-slate-500">
                        {row.res_id} · {NOTIFICATION_KIND_LABEL[row.kind] ?? row.kind} · {row.actor}
                      </span>
                      <span className="block text-[10px] text-slate-400">
                        {ageLabel(row.age_seconds, t)} · {row.created_at}
                      </span>
                    </span>
                  </>
                );
                const cls = `flex w-full gap-2 px-4 py-2.5 text-left ${row.read ? "" : "bg-teal-50/40"}`;
                return href === "#" ? (
                  <span key={row.id} className={cls}>{body}</span>
                ) : (
                  <Link key={row.id} href={href} onClick={() => setOpen(false)} className={`${cls} hover:bg-slate-50`}>
                    {body}
                  </Link>
                );
              })
            ) : (
              <p className="py-10 text-center text-xs text-slate-400">{t.empty}</p>
            )}
          </div>

          <Link
            href="/notifications"
            onClick={() => setOpen(false)}
            className="flex items-center justify-center gap-1.5 border-t border-slate-100 bg-slate-50 py-2.5 text-xs font-semibold text-[#0536a9] hover:bg-slate-100"
          >
            {t.viewAll}
            <LinkPending className="size-3" />
          </Link>
        </div>
      )}
    </div>
  );
}
