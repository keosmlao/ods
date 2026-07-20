import { getSession } from "@/lib/auth";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getLocale } from "@/lib/i18n/locale";
import { APPROVER_SIDE, roleOf } from "@/lib/roles";
import { stockCountReport } from "@/lib/stock-count";
import { Check, Clock, Download, FileBarChart, ScanLine, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

/**
 * **ລາຍງານຜົນການກວດນັບສະຕັອກ** — ສະແດງ **ທັງ** ເຄື່ອງທີ່ນັບພົບແລ້ວ **ແລະ** pending ທີ່ຍັງບໍ່ນັບ
 * (stockCountReport). ຍັງບໍ່ນັບຂຶ້ນກ່ອນ (ຕ້ອງຕິດຕາມ). ອອກ Excel ໄດ້ກ່ອນ "ລ້າງການນັບ" ຮອບໃໝ່.
 */
export const dynamic = "force-dynamic";

export default async function StockCountReportPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!APPROVER_SIDE.includes(roleOf(session))) redirect("/forbidden");

  const t = (await getDictionary(await getLocale())).stockCountReport;

  const rows = await stockCountReport();
  const counted = rows.filter((r) => r.counted).length;
  const pending = rows.filter((r) => !r.returned).length;
  const notCounted = rows.filter((r) => !r.counted).length;
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
        <div className="flex shrink-0 items-center gap-2">
          {rows.length > 0 && (
            <a
              href="/api/reports/export/stock-count"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
            >
              <Download className="size-4" />
              {t.exportXlsx}
            </a>
          )}
          <Link
            href="/service/stock-count"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 hover:bg-slate-50"
          >
            <ScanLine className="size-4 text-teal-600" />
            {t.goToCount}
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:max-w-2xl sm:grid-cols-4">
        {stat(t.statPending, pending, "text-slate-700")}
        {stat(t.statFound, counted, "text-emerald-600")}
        {stat(t.statNotCounted, notCounted, "text-rose-600")}
        {stat(t.statReturned, returned, "text-amber-600")}
      </div>

      {rows.length === 0 ? (
        <p className="py-16 text-center text-sm text-slate-400">{t.emptyState}</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full min-w-[980px] border-collapse text-[11px] leading-tight">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-[10px] uppercase tracking-wide text-slate-500">
                <th className="px-2 py-1.5 font-semibold">{t.colCountState}</th>
                <th className="px-2 py-1.5 font-semibold">{t.colJob}</th>
                <th className="px-2 py-1.5 font-semibold">{t.colProduct}</th>
                <th className="px-2 py-1.5 font-semibold">{t.colBrand}</th>
                <th className="px-2 py-1.5 font-semibold">{t.colCustomer}</th>
                <th className="px-2 py-1.5 font-semibold">{t.colIssue}</th>
                <th className="px-2 py-1.5 font-semibold">{t.colService}</th>
                <th className="px-2 py-1.5 font-semibold">{t.colStage}</th>
                <th className="px-2 py-1.5 font-semibold">{t.colCountedAtBy}</th>
                <th className="px-2 py-1.5 font-semibold">{t.colLabel}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.code}
                  className={`border-b border-slate-100 ${!row.counted ? "bg-rose-50/40" : row.returned ? "bg-amber-50/50" : ""}`}
                >
                  <td className="whitespace-nowrap px-2 py-1">
                    {row.counted ? (
                      <span className="inline-flex items-center gap-1 rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
                        <Check className="size-3" /> {t.stateCounted}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded bg-rose-50 px-1.5 py-0.5 text-[10px] font-semibold text-rose-600">
                        <Clock className="size-3" /> {t.stateNotCounted}
                      </span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-2 py-1 font-bold text-[#0536a9]">{row.code}</td>
                  <td className="max-w-72 px-2 py-1">
                    <span className="block truncate font-medium text-slate-800" title={row.product ?? ""}>{row.product || "-"}</span>
                    <span className="block truncate text-[10px] text-slate-400">{row.sn || "-"}</span>
                  </td>
                  <td className="whitespace-nowrap px-2 py-1">{row.brand || "-"}</td>
                  <td className="max-w-48 truncate px-2 py-1" title={row.customer ?? ""}>{row.customer || "-"}</td>
                  <td className="max-w-56 truncate px-2 py-1 text-slate-600" title={row.issue ?? ""}>{row.issue || "-"}</td>
                  <td className="whitespace-nowrap px-2 py-1">
                    {row.service_type ? <b className="text-sky-700">{row.service_type}</b> : <span className="text-slate-300">-</span>}
                  </td>
                  <td className="whitespace-nowrap px-2 py-1">
                    <span className="inline-flex items-center gap-1">
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">{row.stage_label}</span>
                      {row.counted && row.counted_stage_label && row.counted_stage_label !== row.stage_label && (
                        <span className="rounded bg-teal-50 px-1.5 py-0.5 text-[9px] font-semibold text-teal-700" title={t.countedStageTooltip}>
                          {row.counted_stage_label}
                        </span>
                      )}
                      {row.returned && (
                        <span className="inline-flex items-center gap-0.5 rounded bg-amber-50 px-1 py-0.5 text-[9px] font-semibold text-amber-700" title={t.returnedTooltip}>
                          <TriangleAlert className="size-2.5" /> {t.returnedBadge}
                        </span>
                      )}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-2 py-1 text-slate-600">
                    {row.counted ? (
                      <span className="inline-flex items-center gap-1">
                        <Check className="size-3 text-emerald-600" />
                        {row.counted_at || "-"}
                        {row.counted_by && <span className="text-slate-400">· {row.counted_by}</span>}
                      </span>
                    ) : (
                      <span className="text-slate-300">-</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-2 py-1">
                    <a
                      href={`/service/${row.code}/label`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-0.5 text-[10px] font-semibold text-slate-600 hover:bg-teal-50 hover:text-teal-700"
                    >
                      {t.printSticker}
                    </a>
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
