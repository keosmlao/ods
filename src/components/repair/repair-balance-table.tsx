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
  const [loc, setLoc] = useState<string>(""); // ທີ່ຈັດເກັບ (shelf) ທີ່ເລືອກ — "" = ທຸກທີ່

  const qtyIn = (it: RepairStockItem, code: string) => it.warehouses.find((w) => w.code === code)?.qty ?? 0;
  const qtyAtLoc = (it: RepairStockItem, wh: string, location: string) =>
    it.locations.filter((l) => l.wh_code === wh && l.location === location).reduce((s, l) => s + l.qty, 0);
  const centerCount = (code: string) => items.filter((it) => qtyIn(it, code) > 0).length;

  // ທີ່ຈັດເກັບ (shelf) ໃນສາງທີ່ເລືອກ — ຮຽງ + ນັບ item ຕໍ່ shelf
  const shelves = useMemo(() => {
    if (tab === "all") return [];
    const m = new Map<string, number>();
    for (const it of items) for (const l of it.locations) if (l.wh_code === tab && l.qty > 0) m.set(l.location, (m.get(l.location) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [items, tab]);

  const rows = useMemo(() => {
    if (tab === "all") return items;
    const inWh = items.filter((it) => qtyIn(it, tab) > 0);
    return loc ? inWh.filter((it) => qtyAtLoc(it, tab, loc) > 0) : inWh;
  }, [items, tab, loc]);

  const tabBtn = (key: string, label: string, n: number) => (
    <button
      type="button"
      onClick={() => { setTab(key); setLoc(""); }}
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

      {/* ── tab ທີ່ຈັດເກັບ (shelf) ຂອງສາງທີ່ເລືອກ ── */}
      {shelves.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-semibold text-slate-400">ທີ່ຈັດເກັບ:</span>
          <button type="button" onClick={() => setLoc("")} className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold ${loc === "" ? "bg-teal-600 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"}`}>
            ທຸກທີ່ <span className="tabular-nums opacity-70">{rows.length.toLocaleString()}</span>
          </button>
          {shelves.map(([code, n]) => (
            <button key={code} type="button" onClick={() => setLoc(code)} className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold ${loc === code ? "bg-teal-600 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"}`}>
              <span className="font-mono">{code || "—"}</span> <span className="tabular-nums opacity-70">{n}</span>
            </button>
          ))}
        </div>
      )}

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
                  {/* ── ແຍກທີ່ຈັດເກັບ (shelf) — ກອງຕາມ tab ສາງ ── */}
                  {(() => {
                    const locs = (tab === "all" ? item.locations : item.locations.filter((l) => l.wh_code === tab)).filter((l) => l.qty > 0);
                    return locs.length ? (
                      <span className="mt-1 flex flex-wrap gap-1">
                        {locs.map((l, i) => (
                          <span key={`${l.wh_code}-${l.location}-${i}`} className="inline-flex items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">
                            {tab === "all" && <b className="font-semibold text-slate-600">{l.wh_name}</b>}
                            <span className="font-mono">{l.location || "—"}</span>
                            <span className="tabular-nums text-emerald-600">{fmt(l.qty)}</span>
                          </span>
                        ))}
                      </span>
                    ) : null;
                  })()}
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
                  <td className="px-3 py-2.5 text-right font-bold tabular-nums text-emerald-600">{fmt(loc ? qtyAtLoc(item, tab, loc) : qtyIn(item, tab))}</td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
