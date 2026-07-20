import { RefreshRepairStock } from "@/components/repair/refresh-repair-stock";
import { RepairBalanceTable } from "@/components/repair/repair-balance-table";
import { PageTitle } from "@/components/ui";
import { requireRoleOrRedirect } from "@/lib/guard";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getLocale } from "@/lib/i18n/locale";
import { repairStockCache } from "@/lib/repair-stock-cache";
import { STOCK_SIDE } from "@/lib/roles";
import { Search } from "lucide-react";

/**
 * ຄົງເຫຼືອ ສາງສ້ອມ (ສູນບໍລິການ 1104/1206) — browse ທັງໝົດ ຈາກ cache (ໄວ) + ກອງ + ດຶງໃໝ່.
 * ແຍກ tab ຕາມສູນບໍລິການ (RepairBalanceTable, client). ຍອດເປັນ snapshot (ບໍ່ real-time) —
 * ກົດ "ດຶງໃໝ່" ເພື່ອອັບເດດ (~25ວິ, ERP).
 */
type Props = { searchParams: Promise<{ q?: string }> };

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
        <RepairBalanceTable
          items={items}
          t={t}
          exportHref={`/api/reports/export/repair-stock${q ? `?q=${encodeURIComponent(q)}` : ""}`}
        />
      )}
    </div>
  );
}
