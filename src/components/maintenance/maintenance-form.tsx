"use client";
import { createMaintenance } from "@/app/actions/maintenance";
import type { MaintenanceCatalogItem } from "@/lib/maintenance";
import { LoaderCircle, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type Line = { service_code: string | null; name: string; qty: number; price: number };
type Tech = { code: string; name: string };

const field = "h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-cyan-500";

/** ຟອມເປີດງານສ້ອມບໍລຸງ — ລູກຄ້າ + ລາຍການບໍລິການ (ຈາກ catalog, ແກ້ລາຄາໄດ້). */
export function MaintenanceForm({ catalog, technicians }: { catalog: MaintenanceCatalogItem[]; technicians: Tech[] }) {
  const router = useRouter();
  const [lines, setLines] = useState<Line[]>([]);
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();

  const addService = (code: string) => {
    if (!code) return;
    const item = catalog.find((c) => c.code === code);
    if (!item) return;
    setLines((prev) => [...prev, { service_code: item.code, name: item.name, qty: 1, price: item.default_price }]);
  };
  const update = (i: number, patch: Partial<Line>) => setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  const remove = (i: number) => setLines((prev) => prev.filter((_, idx) => idx !== i));
  const total = lines.reduce((s, l) => s + (l.price || 0) * (l.qty || 1), 0);

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErr("");
    if (lines.length === 0) { setErr("ກະລຸນາເລືອກຢ່າງໜ້ອຍ 1 ບໍລິການ"); return; }
    const fd = new FormData(e.currentTarget);
    fd.set("services", JSON.stringify(lines));
    start(async () => {
      const r = await createMaintenance(fd);
      if (r.error) { setErr(r.error); return; }
      router.push(r.code ? `/maintenance/${r.code}` : "/maintenance");
    });
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-600">ຊື່ລູກຄ້າ *</label>
          <input name="cust_name" required className={field} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-600">ເບີໂທ</label>
          <input name="cust_tel" inputMode="tel" className={field} />
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs font-semibold text-slate-600">ທີ່ຢູ່ໜ້າງານ</label>
          <input name="location" className={field} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-600">ຊ່າງ (ຈັດຕອນນີ້ ຫຼື ພາຍຫຼັງ)</label>
          <select name="emp_code" defaultValue="" className={field}>
            <option value="">— ຍັງບໍ່ຈັດ —</option>
            {technicians.map((t) => <option key={t.code} value={t.code}>{t.name}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-600">ວັນນັດ</label>
          <input name="appoint_date" type="date" className={field} />
        </div>
      </div>

      {/* ── ລາຍການບໍລິການ ── */}
      <div>
        <div className="mb-1 flex items-center justify-between">
          <label className="text-xs font-semibold text-slate-600">ລາຍການບໍລິການ *</label>
          <select value="" onChange={(e) => addService(e.target.value)} className="h-8 rounded-lg border border-slate-300 px-2 text-xs outline-none focus:border-cyan-500">
            <option value="">+ ເພີ່ມບໍລິການ</option>
            {catalog.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
          </select>
        </div>
        {lines.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-200 py-4 text-center text-xs text-slate-400">ຍັງບໍ່ມີບໍລິການ — ເລືອກຈາກ &quot;+ ເພີ່ມບໍລິການ&quot;</p>
        ) : (
          <ul className="space-y-2">
            {lines.map((l, i) => (
              <li key={i} className="flex items-center gap-2 rounded-lg border border-slate-200 p-2">
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-700">{l.name}</span>
                <input
                  type="number" min={1} value={l.qty}
                  onChange={(e) => update(i, { qty: Math.max(1, Number(e.target.value) || 1) })}
                  className="h-8 w-14 rounded border border-slate-300 px-2 text-center text-xs" title="ຈຳນວນ"
                />
                <input
                  type="number" min={0} value={l.price}
                  onChange={(e) => update(i, { price: Math.max(0, Number(e.target.value) || 0) })}
                  className="h-8 w-28 rounded border border-slate-300 px-2 text-right text-xs" placeholder="ລາຄາ/ໜ່ວຍ"
                />
                <button type="button" onClick={() => remove(i)} className="grid size-8 place-items-center rounded text-slate-400 hover:bg-rose-50 hover:text-rose-600">
                  <Trash2 className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
        {total > 0 && <p className="mt-2 text-right text-sm font-bold text-slate-700">ລວມ: <span className="tabular-nums text-cyan-700">{total.toLocaleString()}</span> ກີບ</p>}
      </div>

      <div>
        <label className="mb-1 block text-xs font-semibold text-slate-600">ໝາຍເຫດ</label>
        <textarea name="remark" rows={2} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-cyan-500" />
      </div>

      {err && <p className="text-xs font-semibold text-rose-600">{err}</p>}

      <div className="flex justify-end gap-2">
        <button type="button" onClick={() => router.push("/maintenance")} className="h-9 rounded-lg border border-slate-200 px-4 text-xs font-semibold text-slate-600 hover:bg-slate-50">ຍົກເລີກ</button>
        <button type="submit" disabled={pending} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-cyan-600 px-4 text-xs font-semibold text-white hover:bg-cyan-700 disabled:opacity-60">
          {pending ? <LoaderCircle className="size-4 animate-spin" /> : <Plus className="size-4" />} ເປີດງານ
        </button>
      </div>
    </form>
  );
}
