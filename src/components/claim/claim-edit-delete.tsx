"use client";
import { deleteClaim, updateClaim } from "@/app/actions/claim";
import { useConfirm } from "@/components/confirm-dialog";
import { type Option, SelectField } from "@/components/select-field";
import { ChevronDown, LoaderCircle, Pencil, Save, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useDict } from "@/lib/i18n/context";
import { useState, useTransition } from "react";

export function ClaimEditDelete({
  claimNo,
  supplierCode,
  brandCode,
  reason,
  supplierOptions,
  brandOptions,
}: {
  claimNo: string;
  supplierCode: string | null;
  brandCode: string | null;
  reason: string | null;
  supplierOptions: Option[];
  brandOptions: Option[];
}) {
  const t = useDict().claimDetail;
  const router = useRouter();
  const { ask, dialog } = useConfirm();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false); // ພັບໄວ້ (ບໍ່ໃຫ້ card ໃຫຍ່ຄາໜ້າ) — ກົດ "ແກ້ໄຂ" ຈຶ່ງເປີດ
  const [sup, setSup] = useState(supplierCode ?? "");
  const [brand, setBrand] = useState(brandCode ?? "");
  const [rsn, setRsn] = useState(reason ?? "");
  const [err, setErr] = useState("");

  const save = () =>
    start(async () => {
      setErr("");
      const r = await updateClaim(claimNo, { supplier_code: sup, brand_code: brand, reason: rsn });
      if (r.error) { setErr(r.error); return; }
      router.refresh();
    });

  const remove = () =>
    void (async () => {
      const ok = await ask({ title: t.deleteAsk, message: t.deleteWarn.replace("{claim}", claimNo), confirmLabel: t.delete, tone: "danger" });
      if (ok) start(async () => { const r = await deleteClaim(claimNo); if (!r.error) router.push("/claims"); });
    })();

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      {dialog}
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-700">
        <Pencil className="size-3.5" /> {t.editDeleteTitle}
        <ChevronDown className={`ml-auto size-4 transition ${open ? "rotate-180" : ""}`} />
      </button>
      {!open ? null : (
        <>
      <div className="mt-3 space-y-2">
        <div>
          <label className="mb-1 block text-[11px] font-semibold text-slate-500">Supplier</label>
          <SelectField name="claim_supplier" options={supplierOptions} value={sup} onChange={setSup} placeholder={t.pickSupplier} />
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-semibold text-slate-500">{t.brand}</label>
          <SelectField name="claim_brand" options={brandOptions} value={brand} onChange={setBrand} placeholder={t.pickBrand} />
        </div>
        <textarea value={rsn} onChange={(e) => setRsn(e.target.value)} rows={2} placeholder={t.reason} className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm outline-none focus:border-brand-600" />
      </div>
      {err && <p className="mt-2 text-xs font-semibold text-brand-orange-700">{err}</p>}
      <div className="mt-3 flex items-center justify-between">
        <button type="button" disabled={pending} onClick={remove} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-brand-orange-400 bg-brand-orange-50 px-3 text-xs font-semibold text-brand-orange-700 hover:bg-brand-orange-100 disabled:opacity-60">
          <Trash2 className="size-4" /> {t.deleteClaim}
        </button>
        <button type="button" disabled={pending} onClick={save} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand-900 px-4 text-xs font-semibold text-white hover:bg-brand-800 disabled:opacity-60">
          {pending ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />} ບັນທຶກ
        </button>
      </div>
        </>
      )}
    </div>
  );
}
