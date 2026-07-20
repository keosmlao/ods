"use client";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { RepairStockItem } from "@/lib/repair-stock-cache";
import { Download } from "lucide-react";
import { useMemo, useState } from "react";

const fmt = (value: number) => (Math.round(value * 100) / 100).toLocaleString();

/**
 * ຄົງເຫຼືອ ສາງສ້ອມ — **ແຍກ tab ຕາມສູນບໍລິການ** (ສາງ 1104 ຂົວຫຼວງ / 1206 ດອນຕີ້ວ …).
 * tab "ທຸກສູນ" = ໂຊ້ຖັນຕໍ່ສູນ + ລວມ. tab ສູນໃດ = ສະເພາະ item ທີ່ມີໃນສູນນັ້ນ (ຍອດສູນນັ້ນ).
 * ອ່ານຈາກ cache local (ບໍ່ແມ່ນ ERP ສົດ).
 */
export function RepairBalanceTable({
  items,
  t,
  exportHref,
}: {
  items: RepairStockItem[];
  t: Dictionary["stockBalanceRepair"];
  exportHref: string;
}) {
  // ສູນ (ສາງ) ທີ່ມີໃນ cache — ຮຽງຕາມລະຫັດ (1104 ກ່ອນ 1206)
  const centers = useMemo(() => {
    const m = new Map<string, string>();
    for (const it of items) for (const w of it.warehouses) if (!m.has(w.code)) m.set(w.code, w.name || w.code);
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([code, name]) => ({ code, name }));
  }, [items]);

  const [tab, setTab] = useState<string>("all");

  const qtyIn = (it: RepairStockItem, code: string) => it.warehouses.find((w) => w.code === code)?.qty ?? 0;
  const centerCount = (code: string) => items.filter((it) => qtyIn(it, code) > 0).length;

  const rows = useMemo(() => (tab === "all" ? items : items.filter((it) => qtyIn(it, tab) > 0)), [items, tab]);

  const tabBtn = (key: string, label: string, n: number) => (
    <button
      type="button"
      onClick={() => setTab(key)}
      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
        tab === key ? "bg-slate-900 text-white shadow-sm" : "bg-white text-slate-500 hover:bg-slate-50"
      }`}
    >
      {label}
      <span className={`rounded-full px-1.5 text-[10px] tabular-nums ${tab === key ? "bg-white/25" : "bg-slate-100"}`}>{n.toLocaleString()}</span>
    </button>
  );

  return (
    <div className="space-y-3">
      {/* ── tab ສູນບໍລິການ ── */}
      <div className="flex flex-wrap gap-1.5 rounded-xl border border-slate-200 bg-slate-50 p-1">
        {tabBtn("all", t.allCenters, items.length)}
        {centers.map((c) => tabBtn(c.code, c.name, centerCount(c.code)))}
      </div>

      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-slate-500">
          {t.all}: <b className="tabular-nums">{rows.length.toLocaleString()}</b> {t.items}
        </p>
        <a
          href={exportHref}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
        >
          <Download className="size-3.5" /> Export Excel
        </a>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-sm">
        <table className="w-full min-w-[560px] border-collapse bg-white text-sm">
          <thead>
            <tr className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="px-4 py-3 font-bold">{t.colSpare}</th>
              {tab === "all" ? (
                <>
                  {centers.map((c) => (
                    <th key={c.code} className="px-3 py-3 text-right font-bold">{c.name}</th>
                  ))}
                  <th className="px-3 py-3 text-right font-bold">{t.colTotal}</th>
                </>
              ) : (
                <th className="px-3 py-3 text-right font-bold">{t.colTotal}</th>
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((item) => (
              <tr key={item.code} className="border-t border-slate-100 align-top">
                <td className="px-4 py-2.5">
                  <span className="block font-medium text-slate-700">{item.name}</span>
                  <span className="text-[11px] text-slate-400">{item.code}{item.unit_code ? ` · ${item.unit_code}` : ""}</span>
                </td>
                {tab === "all" ? (
                  <>
                    {centers.map((c) => {
                      const qty = qtyIn(item, c.code);
                      return (
                        <td key={c.code} className="px-3 py-2.5 text-right tabular-nums text-slate-600">{qty ? fmt(qty) : "–"}</td>
                      );
                    })}
                    <td className="px-3 py-2.5 text-right font-bold tabular-nums text-emerald-600">{fmt(item.total)}</td>
                  </>
                ) : (
                  <td className="px-3 py-2.5 text-right font-bold tabular-nums text-emerald-600">{fmt(qtyIn(item, tab))}</td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
