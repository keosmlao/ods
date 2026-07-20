import { RefreshRepairStock } from "@/components/repair/refresh-repair-stock";
import { PageTitle } from "@/components/ui";
import { requireRoleOrRedirect } from "@/lib/guard";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getLocale } from "@/lib/i18n/locale";
import { repairStockCache } from "@/lib/repair-stock-cache";
import { STOCK_SIDE } from "@/lib/roles";
import { Download, Search } from "lucide-react";
import Link from "next/link";

/**
 * ຄົງເຫຼືອ ສາງສ້ອມ (ສູນບໍລິການ 1104/1206) — browse ທັງໝົດ ຈາກ cache (ໄວ) + ກອງ + ດຶງໃໝ່.
 * ຍອດເປັນ snapshot (ບໍ່ real-time) — ກົດ "ດຶງໃໝ່" ເພື່ອອັບເດດ (~25ວິ, ERP).
 */
type Props = { searchParams: Promise<{ q?: string }> };

function fmt(value: number) {
  return (Math.round(value * 100) / 100).toLocaleString();
}

export default async function RepairBalancePage({ searchParams }: Props) {
  await requireRoleOrRedirect(STOCK_SIDE);
  const t = (await getDictionary(await getLocale())).stockBalanceRepair;
  const q = ((await searchParams).q ?? "").trim();
  const { items, refreshedAt } = await repairStockCache(q);

  return (
    <div className="mx-auto max-w-4xl pb-16">
      <PageTitle sub={t.subtitle}>
        {t.title}
      </PageTitle>

      <div className="mb-4">
        <RefreshRepairStock refreshedAt={refreshedAt} />
      </div>

      <form className="mb-4 flex gap-2" action="/stock/balance/repair" method="get">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <input
            name="q"
            defaultValue={q}
            placeholder={t.filterPlaceholder}
            className="h-11 w-full rounded-lg border border-slate-300 pl-9 pr-3 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
          />
        </div>
        <button type="submit" className="h-11 rounded-lg bg-slate-900 px-5 text-sm font-bold text-white hover:bg-slate-800">
          {t.filter}
        </button>
      </form>

      {refreshedAt === null ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-center text-sm text-amber-800">
          {t.noDataYet}
        </p>
      ) : items.length === 0 ? (
        <p className="py-12 text-center text-sm text-slate-400">
          {q ? `${t.notFound} "${q}" ${t.inRepairWarehouse}` : t.noSparesInWarehouse}
        </p>
      ) : (
        <>
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-xs text-slate-500">
              {q ? t.filterResult : t.all}: <b className="tabular-nums">{items.length.toLocaleString()}</b> {t.items}
            </p>
            <Link
              href={`/api/reports/export/repair-stock${q ? `?q=${encodeURIComponent(q)}` : ""}`}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              <Download className="size-3.5" /> Export Excel
            </Link>
          </div>
          <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-sm">
            <table className="w-full min-w-[560px] border-collapse bg-white text-sm">
              <thead>
                <tr className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3 font-bold">{t.colSpare}</th>
                  <th className="px-3 py-3 text-right font-bold">ຂົວຫຼວງ</th>
                  <th className="px-3 py-3 text-right font-bold">ດອນຕີ້ວ</th>
                  <th className="px-3 py-3 text-right font-bold">{t.colTotal}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const q1104 = item.warehouses.find((w) => w.code === "1104")?.qty ?? 0;
                  const q1206 = item.warehouses.find((w) => w.code === "1206")?.qty ?? 0;
                  return (
                    <tr key={item.code} className="border-t border-slate-100 align-top">
                      <td className="px-4 py-2.5">
                        <span className="block font-medium text-slate-700">{item.name}</span>
                        <span className="text-[11px] text-slate-400">{item.code}{item.unit_code ? ` · ${item.unit_code}` : ""}</span>
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-slate-600">{q1104 ? fmt(q1104) : "–"}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-slate-600">{q1206 ? fmt(q1206) : "–"}</td>
                      <td className="px-3 py-2.5 text-right font-bold tabular-nums text-emerald-600">{fmt(item.total)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
