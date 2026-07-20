import { StockCountReportTable } from "@/components/stock-count/stock-count-report-table";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getLocale } from "@/lib/i18n/locale";
import { stockCountReport } from "@/lib/stock-count";
import { Download, FileBarChart, PackageX, ScanLine } from "lucide-react";
import Link from "next/link";

type Tab = "all" | "counted" | "missing" | "uncounted";

/**
 * ເນື້ອຫາລາຍງານກວດນັບ — ໃຊ້ຮ່ວມ 2 ໜ້າ: ຜົນກວດນັບ (defaultTab=uncounted) ແລະ
 * ເມນູແຍກ "ເຄື່ອງນັບບໍ່ພົບ/ຫາຍ" (defaultTab=missing). auth ຢູ່ຝັ່ງໜ້າ (route) ແລ້ວ.
 */
export async function StockCountReportView({ defaultTab = "uncounted" }: { defaultTab?: Tab }) {
  const t = (await getDictionary(await getLocale())).stockCountReport;
  const rows = await stockCountReport();
  const found = rows.filter((r) => r.counted).length;
  const missing = rows.filter((r) => r.missing).length;
  const pending = rows.filter((r) => !r.returned).length;
  const notCounted = rows.filter((r) => !r.counted && !r.missing).length;

  const missingView = defaultTab === "missing";

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
          {missingView ? <PackageX className="size-5 text-amber-500" /> : <FileBarChart className="size-5 text-teal-600" />}
          {missingView ? t.missingMenuTitle : t.title}
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
        {stat(t.statFound, found, "text-emerald-600")}
        {stat(t.statNotCounted, notCounted, "text-rose-600")}
        {stat(t.statMissing, missing, "text-amber-600")}
      </div>

      {rows.length === 0 ? (
        <p className="py-16 text-center text-sm text-slate-400">{t.emptyState}</p>
      ) : (
        <StockCountReportTable rows={rows} t={t} initialTab={defaultTab} />
      )}
    </div>
  );
}
