import { markAllNotificationsRead, markNotificationRead, markNotificationUnread, myNotifications } from "@/app/actions/notification";
import { LinkPending } from "@/components/link-pending";
import { MODEL_LABEL, NOTIFICATION_KIND_LABEL, recordHref, type ChatterModel, type NotificationKind } from "@/lib/chatter";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getLocale } from "@/lib/i18n/locale";
import { BellRing, Check, CheckCheck, ChevronLeft, ChevronRight, Inbox, Mail } from "lucide-react";
import Link from "next/link";

/**
 * ກ່ອງແຈ້ງເຕືອນ — ແທນ LINE Notify ຂອງ ods (ປິດບໍລິການ 31-03-2025).
 * ແຖວທີ່ຍັງບໍ່ໄດ້ອ່ານຂຶ້ນກ່ອນ ແລ້ວກົດເຂົ້າໄປຫາເອກະສານຕົ້ນທາງໄດ້ເລີຍ.
 */

const PAGE_SIZE = 20;

type Tab = "unread" | "all";
type Props = { searchParams: Promise<{ tab?: string; page?: string }> };

const KIND_CHIP: Record<NotificationKind, string> = {
  log: "bg-slate-100 text-slate-600",
  comment: "bg-sky-50 text-sky-700",
  assign: "bg-amber-100 text-amber-800",
};

export default async function NotificationsPage({ searchParams }: Props) {
  const params = await searchParams;
  const tab: Tab = params.tab === "all" ? "all" : "unread";
  const page = Math.max(1, Number(params.page) || 1);
  const t = (await getDictionary(await getLocale())).notificationsPage;

  const { rows, total, unread, all } = await myNotifications(tab, page);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const tabHref = (target: Tab) => `/notifications${target === "all" ? "?tab=all" : ""}`;
  const pageHref = (n: number) =>
    `/notifications?${new URLSearchParams({ ...(tab === "all" && { tab }), ...(n > 1 && { page: String(n) }) })}`;

  const TABS: { key: Tab; label: string; icon: typeof Inbox; count: number }[] = [
    { key: "unread", label: t.unread, icon: Mail, count: unread },
    { key: "all", label: t.all, icon: Inbox, count: all },
  ];

  return (
    <div className="w-full space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-700">{t.title}</h1>
          <p className="mt-0.5 text-xs text-slate-500">
            {total.toLocaleString()} {t.items} · {t.page} {page}/{pages}
            {unread > 0 && <span className="font-semibold text-teal-700"> · {t.unread} {unread}</span>}
          </p>
        </div>
        {unread > 0 && (
          <form action={markAllNotificationsRead}>
            <button className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50">
              <CheckCheck className="size-4" />
              {t.markAllRead}
            </button>
          </form>
        )}
      </div>

      {/* ແທັບ */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm">
        <div className="flex overflow-hidden rounded-lg border border-slate-300">
          {TABS.map(({ key, label, icon: Icon, count }) => (
            <Link
              key={key}
              href={tabHref(key)}
              className={`inline-flex h-9 items-center gap-1.5 border-l border-slate-300 px-3 text-xs font-medium first:border-l-0 ${
                tab === key ? "bg-slate-900 text-white" : "bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              <Icon className="size-3.5" />
              {label}
              <span
                className={`rounded px-1 text-[10px] font-bold ${
                  tab === key ? "bg-white/20" : "bg-slate-100 text-slate-600"
                }`}
              >
                {count}
              </span>
              <LinkPending className="size-3" />
            </Link>
          ))}
        </div>
      </div>

      {/* ຕາຕະລາງ */}
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-slate-600">
                <th className="whitespace-nowrap px-3 py-2.5 font-semibold">{t.colDocument}</th>
                <th className="whitespace-nowrap px-3 py-2.5 font-semibold">{t.colType}</th>
                <th className="px-3 py-2.5 font-semibold">{t.colContent}</th>
                <th className="whitespace-nowrap px-3 py-2.5 font-semibold">{t.colActor}</th>
                <th className="whitespace-nowrap px-3 py-2.5 font-semibold">{t.colTime}</th>
                <th className="px-3 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const href = recordHref(row.model, row.res_id);
                const model = MODEL_LABEL[row.model as ChatterModel] ?? row.model;
                return (
                  <tr
                    key={row.id}
                    className={`relative border-b border-slate-100 hover:bg-slate-50 ${row.read ? "" : "bg-teal-50/40"}`}
                  >
                    <td className="relative whitespace-nowrap px-3 py-2.5 font-bold text-[#0536a9]">
                      <span
                        className={`absolute inset-y-0 left-0 w-1 ${row.read ? "bg-transparent" : "bg-teal-500"}`}
                        aria-hidden
                      />
                      {href === "#" ? (
                        <span className="text-slate-600">{row.res_id}</span>
                      ) : (
                        <Link href={href} className="hover:underline">
                          {row.res_id}
                          <LinkPending className="ml-1 inline size-3" />
                        </Link>
                      )}
                      <span className="mt-0.5 block text-[10px] font-normal text-slate-400">{model}</span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5">
                      <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${KIND_CHIP[row.kind] ?? KIND_CHIP.log}`}>
                        {NOTIFICATION_KIND_LABEL[row.kind] ?? row.kind}
                      </span>
                    </td>
                    <td className="max-w-xl px-3 py-2.5">
                      <span className={`block ${row.read ? "text-slate-600" : "font-semibold text-slate-800"}`}>
                        {row.body}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-slate-600">{row.actor}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-slate-400">{row.created_at}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-right">
                      {/* ກົດ read/unread ໄດ້ສອງທາງ — ອ່ານຜິດ ຫຼື ຢາກໝາຍໄວ້ອ່ານຄືນ ກໍ່ກັບໄດ້ */}
                      <form action={row.read ? markNotificationUnread : markNotificationRead}>
                        <input type="hidden" name="id" value={row.id} />
                        <button className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50">
                          {row.read ? (
                            <>
                              <Mail className="size-3.5" />
                              {t.markUnread}
                            </>
                          ) : (
                            <>
                              <Check className="size-3.5" />
                              {t.markRead}
                            </>
                          )}
                        </button>
                      </form>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {rows.length === 0 && (
          <p className="flex flex-col items-center gap-2 py-12 text-center text-xs text-slate-400">
            <BellRing className="size-5 text-slate-300" />
            {tab === "unread" ? t.emptyUnread : t.emptyAll}
          </p>
        )}
      </section>

      {pages > 1 && (
        <nav className="flex items-center justify-between gap-3 text-xs">
          <span className="text-slate-500">
            {t.showing} {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} {t.of} {total.toLocaleString()}
          </span>
          <div className="flex items-center gap-1">
            <Link
              href={pageHref(page - 1)}
              aria-disabled={page === 1}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 hover:bg-slate-50 aria-disabled:pointer-events-none aria-disabled:opacity-40"
            >
              <ChevronLeft className="size-3.5" />
              {t.prev}
            </Link>
            <span className="px-3 font-medium text-slate-700">
              {page} / {pages}
            </span>
            <Link
              href={pageHref(page + 1)}
              aria-disabled={page >= pages}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 hover:bg-slate-50 aria-disabled:pointer-events-none aria-disabled:opacity-40"
            >
              {t.next}
              <ChevronRight className="size-3.5" />
            </Link>
          </div>
        </nav>
      )}
    </div>
  );
}
