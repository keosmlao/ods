import { StockCountReportTable } from "@/components/stock-count/stock-count-report-table";
import { getSession } from "@/lib/auth";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getLocale } from "@/lib/i18n/locale";
import { APPROVER_SIDE, roleOf } from "@/lib/roles";
import { stockCountReport } from "@/lib/stock-count";
import { Download, FileBarChart, ScanLine } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

/**
 * **ລາຍງານຜົນການກວດນັບສະຕັອກ** — ສະແດງ **ທັງ** ເຄື່ອງທີ່ນັບພົບແລ້ວ **ແລະ** pending ທີ່ຍັງບໍ່ນັບ
 * (stockCountReport). tab ສະຖານະ + sub-tab service ຢູ່ StockCountReportTable (client).
 * ອອກ Excel ໄດ້ກ່ອນ "ລ້າງການນັບ" ຮອບໃໝ່.
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
        <StockCountReportTable rows={rows} t={t} />
      )}
    </div>
  );
}
