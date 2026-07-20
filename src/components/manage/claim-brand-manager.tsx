"use client";
import { removeBrandClaim, setBrandClaim } from "@/app/actions/claim-brand";
import type { BrandClaim } from "@/lib/claim-brand";
import { LoaderCircle, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export function ClaimBrandManager({
  brands,
  suppliers,
  initial,
}: {
  brands: { code: string; name_1: string }[];
  suppliers: { code: string; name: string }[];
  initial: BrandClaim[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [brand, setBrand] = useState("");
  const [supplier, setSupplier] = useState("");
  const [err, setErr] = useState("");

  const act = (fn: () => Promise<{ error?: string }>) =>
    start(async () => {
      setErr("");
      const r = await fn();
      if (r?.error) { setErr(r.error); return; }
      router.refresh();
    });

  const add = () => {
    if (!brand) { setErr("ເລືອກ ຫຍີ່ຫໍ້"); return; }
    act(async () => {
      const r = await setBrandClaim(brand, supplier, true);
      if (!r.error) { setBrand(""); setSupplier(""); }
      return r;
    });
  };

  const supName = (code: string | null) => (code ? suppliers.find((s) => s.code === code)?.name ?? code : "-");
  const inp = "h-9 rounded-lg border border-slate-300 px-2.5 text-sm outline-none focus:border-teal-500";

  return (
    <div className="max-w-2xl space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="mb-2 text-xs font-semibold text-slate-500">ເພີ່ມ ຫຍີ່ຫໍ້ → supplier</p>
        <div className="flex flex-wrap items-end gap-2">
          <select value={brand} onChange={(e) => setBrand(e.target.value)} className={`${inp} min-w-40 flex-1`}>
            <option value="">— ຫຍີ່ຫໍ້ —</option>
            {brands.map((b) => <option key={b.code} value={b.code}>{b.name_1}</option>)}
          </select>
          <select value={supplier} onChange={(e) => setSupplier(e.target.value)} className={`${inp} min-w-40 flex-1`}>
            <option value="">— supplier —</option>
            {suppliers.map((s) => <option key={s.code} value={s.code}>{s.code} · {s.name}</option>)}
          </select>
          <button type="button" disabled={pending} onClick={add} className="inline-flex h-9 items-center gap-1 rounded-lg bg-teal-600 px-3 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-60">
            {pending ? <LoaderCircle className="size-4 animate-spin" /> : <Plus className="size-4" />} ເພີ່ມ
          </button>
        </div>
        {err && <p className="mt-2 text-xs font-semibold text-rose-600">{err}</p>}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="mb-2 text-xs font-bold text-slate-600">ຫຍີ່ຫໍ້ ທີ່ເກັບເງินกับ supplier ({initial.length})</p>
        {initial.length === 0 ? (
          <p className="py-3 text-center text-xs text-slate-400">ຍັງບໍ່ມີ</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {initial.map((b) => (
              <li key={b.brand_code} className="flex items-center gap-2 py-1.5 text-sm">
                <input type="checkbox" checked={b.active} onChange={(e) => act(() => setBrandClaim(b.brand_code, b.supplier_code ?? "", e.target.checked))} className="size-4 accent-teal-600" />
                <span className={`font-semibold ${b.active ? "text-slate-800" : "text-slate-400 line-through"}`}>{b.brand_code}</span>
                <span className="text-slate-400">→</span>
                <span className="min-w-0 flex-1 truncate text-slate-600">{supName(b.supplier_code)}</span>
                <button type="button" onClick={() => act(() => removeBrandClaim(b.brand_code))} className="text-slate-400 hover:text-rose-600"><Trash2 className="size-4" /></button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <p className="text-[11px] text-slate-400">ງານ ຫຍີ່ຫໍ້ນี้ ສ່ງคืนแล้ว → ຂຶ້ນ candidate CLM-C ອัตโนมัติ (supplier เติมให้). ຫຼือ ໝາຍเองที่หน้างาน.</p>
    </div>
  );
}
