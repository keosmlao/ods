"use client";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { RepairStockItem } from "@/lib/repair-stock-cache";
import { ChevronLeft, ChevronRight, Download } from "lucide-react";
import { useMemo, useState } from "react";

/** ຈຳນວນແຖວຕໍ່ໜ້າ — 1,141 ລາຍການໃນໜ້າດຽວເຮັດໃຫ້ scroll ຫາບໍ່ພົບ ແລະ render ຊ້າ */
const PER_PAGE = 50;

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
  const [page, setPage] = useState(1);

  const qtyIn = (it: RepairStockItem, code: string) => it.warehouses.find((w) => w.code === code)?.qty ?? 0;
  const qtyAtLoc = (it: RepairStockItem, wh: string, location: string) =>
    it.locations.filter((l) => l.wh_code === wh && l.location === location).reduce((s, l) => s + l.qty, 0);
  const centerCount = (code: string) => items.filter((it) => qtyIn(it, code) > 0).length;

  /**
   * ທີ່ຈັດເກັບ (shelf) ໃນສາງທີ່ເລືອກ — ຮຽງ + ນັບ item ຕໍ່ shelf **ພ້ອມຊື່**.
   * ແຕ່ກ່ອນສະແດງແຕ່ລະຫັດ (110411 · 110412 …) ເຊິ່ງບໍ່ມີໃຜຈື່ໄດ້ວ່າອັນໃດແມ່ນຫຍັງ
   * ⇒ ດຽວນີ້ເອົາຊື່ຈາກ ic_shelf ທີ່ເກັບໄວ້ໃນ cache ມາສະແດງ (ເບິ່ງ lib/repair-stock-cache).
   */
  const shelves = useMemo(() => {
    if (tab === "all") return [];
    const m = new Map<string, { n: number; name: string }>();
    for (const it of items)
      for (const l of it.locations)
        if (l.wh_code === tab && l.qty > 0) {
          const prev = m.get(l.location);
          m.set(l.location, { n: (prev?.n ?? 0) + 1, name: prev?.name || l.location_name });
        }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [items, tab]);

  const rows = useMemo(() => {
    if (tab === "all") return items;
    const inWh = items.filter((it) => qtyIn(it, tab) > 0);
    return loc ? inWh.filter((it) => qtyAtLoc(it, tab, loc) > 0) : inWh;
  }, [items, tab, loc]);

  /**
   * ຕັດເປັນໜ້າ — cache ມີ 1,141 ລາຍການ; render ໝົດໃນໜ້າດຽວເຮັດໃຫ້ຊອກຫາຍາກ
   * ແລະ ໜ້າໜັກ. ຕັດຢູ່ client ເພາະຂໍ້ມູນທັງກ້ອນມາຈາກ cache ຢູ່ແລ້ວ (ບໍ່ຕ້ອງຍິງ server ຄືນ)
   * ⇒ ປ່ຽນ tab/shelf ແລ້ວຕົວເລກປ່ຽນທັນທີໂດຍບໍ່ຕ້ອງໂຫຼດໃໝ່.
   */
  const pageCount = Math.max(1, Math.ceil(rows.length / PER_PAGE));
  const current = Math.min(page, pageCount);
  const pageRows = rows.slice((current - 1) * PER_PAGE, current * PER_PAGE);

  const tabBtn = (key: string, label: string, n: number) => (
    <button
      type="button"
      onClick={() => { setTab(key); setLoc(""); setPage(1); }}
      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
        tab === key ? "bg-brand-900 text-white shadow-sm" : "bg-white text-slate-500 hover:bg-slate-50"
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
          <button type="button" onClick={() => { setLoc(""); setPage(1); }} className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold ${loc === "" ? "bg-brand-700 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"}`}>
            ທຸກທີ່ <span className="tabular-nums opacity-70">{rows.length.toLocaleString()}</span>
          </button>
          {shelves.map(([code, shelf]) => (
            <button key={code} type="button" onClick={() => { setLoc(code); setPage(1); }} className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold ${loc === code ? "bg-brand-700 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"}`}>
              {shelf.name ? (
                <>
                  {shelf.name} <span className={`font-mono ${loc === code ? "opacity-70" : "text-slate-400"}`}>{code}</span>
                </>
              ) : (
                <span className="font-mono">{code || "—"}</span>
              )}{" "}
              <span className="tabular-nums opacity-70">{shelf.n}</span>
            </button>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-slate-500">
          {t.all}: <b className="tabular-nums">{rows.length.toLocaleString()}</b> {t.items}
          {pageCount > 1 && (
            <span className="ml-2 text-slate-400">
              ({((current - 1) * PER_PAGE + 1).toLocaleString()}–
              {Math.min(current * PER_PAGE, rows.length).toLocaleString()})
            </span>
          )}
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
            {pageRows.map((item) => (
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
                            {l.location_name && <span className="text-slate-600">{l.location_name}</span>}
                            <span className="font-mono">{l.location || "—"}</span>
                            <span className="tabular-nums text-brand-800">{fmt(l.qty)}</span>
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
                    <td className="px-3 py-2.5 text-right font-bold tabular-nums text-brand-800">{fmt(item.total)}</td>
                  </>
                ) : (
                  <td className="px-3 py-2.5 text-right font-bold tabular-nums text-brand-800">{fmt(loc ? qtyAtLoc(item, tab, loc) : qtyIn(item, tab))}</td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pageCount > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            type="button"
            disabled={current <= 1}
            onClick={() => setPage(current - 1)}
            className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
          >
            <ChevronLeft className="size-3.5" />
          </button>
          <span className="text-xs tabular-nums text-slate-500">
            {current} / {pageCount}
          </span>
          <button
            type="button"
            disabled={current >= pageCount}
            onClick={() => setPage(current + 1)}
            className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
          >
            <ChevronRight className="size-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
