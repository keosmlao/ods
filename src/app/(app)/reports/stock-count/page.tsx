import { getSession } from "@/lib/auth";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getLocale } from "@/lib/i18n/locale";
import { APPROVER_SIDE, roleOf } from "@/lib/roles";
import { countedItems } from "@/lib/stock-count";
import { Check, FileBarChart, ScanLine, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

/**
 * **ລາຍງານຜົນການກວດນັບສະຕັອກ** — ສະເພາະເຄື່ອງທີ່ **ນັບພົບແລ້ວ** (ຈາກ ods_stock_count).
 * ອອກລາຍງານກ່ອນ "ລ້າງການນັບ" ຮອບໃໝ່.
 */
export const dynamic = "force-dynamic";

export default async function StockCountReportPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!APPROVER_SIDE.includes(roleOf(session))) redirect("/forbidden");

  const t = (await getDictionary(await getLocale())).stockCountReport;

  const rows = await countedItems();
  const total = rows.length;
  const returned = rows.filter((r) => r.returned).length;

  const stat = (label: string, value: number, tone: string) => (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <p className={`text-2xl font-black tabular-nums ${tone}`}>{value.toLocaleString()}</p>
      <p className="mt-0.5 text-[11px] font-semibold text-slate-500">{label}</p>
    </div>
  );

  return (
    <div className="w-full space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="flex items-center gap-2 text-lg font-bold text-slate-700">
          <FileBarChart className="size-5 text-teal-600" />
          {t.title}
        </h1>
        <Link
          href="/service/stock-count"
          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 hover:bg-slate-50"
        >
          <ScanLine className="size-4 text-teal-600" />
          {t.goToCount}
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:max-w-sm">
        {stat(t.statFound, total, "text-emerald-600")}
        {stat(t.statReturned, returned, "text-amber-600")}
      </div>

      {total === 0 ? (
        <p className="py-16 text-center text-sm text-slate-400">{t.emptyState}</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full min-w-[820px] border-collapse text-[11px] leading-tight">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-[10px] uppercase tracking-wide text-slate-500">
                <th className="px-2 py-1.5 font-semibold">{t.colJob}</th>
                <th className="px-2 py-1.5 font-semibold">{t.colProduct}</th>
                <th className="px-2 py-1.5 font-semibold">{t.colBrand}</th>
                <th className="px-2 py-1.5 font-semibold">{t.colCustomer}</th>
                <th className="px-2 py-1.5 font-semibold">{t.colService}</th>
                <th className="px-2 py-1.5 font-semibold">{t.colCountStatus}</th>
                <th className="px-2 py-1.5 font-semibold">{t.colStage}</th>
                <th className="px-2 py-1.5 font-semibold">{t.colCountedAtBy}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.code} className={`border-b border-slate-100 ${row.returned ? "bg-amber-50/50" : ""}`}>
                  <td className="whitespace-nowrap px-2 py-1 font-bold text-[#0536a9]">{row.code}</td>
                  <td className="max-w-72 px-2 py-1">
                    <span className="block truncate font-medium text-slate-800" title={row.product ?? ""}>{row.product || "-"}</span>
                    <span className="block truncate text-[10px] text-slate-400">{row.sn || "-"}</span>
                  </td>
                  <td className="whitespace-nowrap px-2 py-1">{row.brand || "-"}</td>
                  <td className="max-w-48 truncate px-2 py-1" title={row.customer ?? ""}>{row.customer || "-"}</td>
                  <td className="whitespace-nowrap px-2 py-1">
                    {row.service_type ? <b className="text-sky-700">{row.service_type}</b> : <span className="text-slate-300">-</span>}
                  </td>
                  <td className="whitespace-nowrap px-2 py-1">
                    <span className="inline-flex items-center gap-1">
                      <span className="rounded bg-teal-50 px-1.5 py-0.5 text-[10px] font-semibold text-teal-700">{row.counted_stage_label || "-"}</span>
                      {row.returned && (
                        <span className="inline-flex items-center gap-0.5 rounded bg-amber-50 px-1 py-0.5 text-[9px] font-semibold text-amber-700" title={t.returnedTooltip}>
                          <TriangleAlert className="size-2.5" /> {t.returnedBadge}
                        </span>
                      )}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-2 py-1">
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">{row.stage_label}</span>
                  </td>
                  <td className="whitespace-nowrap px-2 py-1 text-slate-600">
                    <span className="inline-flex items-center gap-1">
                      <Check className="size-3 text-emerald-600" />
                      {row.counted_at || "-"}
                      {row.counted_by && <span className="text-slate-400">· {row.counted_by}</span>}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
