import { PageTitle } from "@/components/ui";
import { requireRoleOrRedirect } from "@/lib/guard";
import { STOCK_SIDE } from "@/lib/roles";
import { REPAIR_WAREHOUSES } from "@/lib/stock-constants";
import { stockBalanceLookup } from "@/lib/stock-lookup";
import { Search } from "lucide-react";

/**
 * ຄົງເຫຼືອ **ສາງສູນບໍລິການ** (1104 ຂົວຫຼວງ / 1206 ດອນຕີ້ວ) — ຄົ້ນອາໄຫຼ່ → ຍອດໃນ 2 ສາງນັ້ນ.
 * ຄົ້ນຫາ (ໄວ) ແທນ browse ທັງໝົດ ເພາະ ERP ຄິດຍອດຕໍ່ສາງຊ້າ. ໃຊ້ stockBalanceLookup ຂອບເຂດ.
 */
type Props = { searchParams: Promise<{ q?: string }> };

function fmt(value: number) {
  return (Math.round(value * 100) / 100).toLocaleString();
}

export default async function RepairBalancePage({ searchParams }: Props) {
  await requireRoleOrRedirect(STOCK_SIDE);
  const q = ((await searchParams).q ?? "").trim();
  const items = q ? await stockBalanceLookup(q, REPAIR_WAREHOUSES) : [];

  return (
    <div className="mx-auto max-w-4xl pb-16">
      <PageTitle sub="ຄົ້ນອາໄຫຼ່ → ຍອດຄົງເຫຼືອໃນສາງສ້ອມ (1104 ຂົວຫຼວງ · 1206 ດອນຕີ້ວ)">
        ຄົງເຫຼືອ ສາງສ້ອມ (ສູນບໍລິການ)
      </PageTitle>

      <form className="mb-6 flex gap-2" action="/stock/balance/repair" method="get">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <input
            name="q"
            defaultValue={q}
            autoFocus
            placeholder="ຊື່ ຫຼື ລະຫັດອາໄຫຼ່..."
            className="h-11 w-full rounded-lg border border-slate-300 pl-9 pr-3 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
          />
        </div>
        <button type="submit" className="h-11 rounded-lg bg-slate-900 px-5 text-sm font-bold text-white hover:bg-slate-800">
          ຄົ້ນ
        </button>
      </form>

      {!q ? (
        <p className="py-16 text-center text-sm text-slate-400">ພິມຊື່/ລະຫັດ ແລ້ວກົດ ຄົ້ນ</p>
      ) : items.length === 0 ? (
        <p className="py-16 text-center text-sm text-slate-400">ບໍ່ພົບອາໄຫຼ່ &quot;{q}&quot;</p>
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            const inStock = item.total > 0;
            return (
              <div key={item.code} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-slate-800" title={item.name}>{item.name}</p>
                    <p className="mt-0.5 text-xs text-slate-500">{[item.code, item.brand].filter(Boolean).join(" · ")}</p>
                  </div>
                  <div className="text-right">
                    <span className={`block text-xl font-extrabold tabular-nums ${inStock ? "text-emerald-600" : "text-slate-300"}`}>
                      {fmt(item.total)}
                    </span>
                    <span className="text-[11px] text-slate-400">{item.unit_code ?? ""}</span>
                  </div>
                </div>
                {item.warehouses.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-1.5 border-t border-slate-100 pt-3">
                    {item.warehouses.map((wh) => (
                      <span key={wh.code} className="rounded-md bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800">
                        {wh.name} <span className="font-bold tabular-nums">{fmt(wh.qty)}</span>
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-xs font-medium text-slate-400">ບໍ່ມີໃນສາງສ້ອມ (ອາດຢູ່ສາງອື່ນ — ເບິ່ງ ຕິດຕາມສິນຄ້າຄົງເຫຼືອ)</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
