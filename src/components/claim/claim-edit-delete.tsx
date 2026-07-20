"use client";
import { deleteClaim, updateClaim } from "@/app/actions/claim";
import { useConfirm } from "@/components/confirm-dialog";
import { type Option, SelectField } from "@/components/select-field";
import { LoaderCircle, Save, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
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
  const router = useRouter();
  const { ask, dialog } = useConfirm();
  const [pending, start] = useTransition();
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
      const ok = await ask({ title: "ລບ ໃບເຄມ?", message: `ລບ ${claimNo} ຖາວອນ — ຍ້ອນຄືนบໍ่ได้`, confirmLabel: "ລບ", tone: "danger" });
      if (ok) start(async () => { const r = await deleteClaim(claimNo); if (!r.error) router.push("/claims"); });
    })();

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      {dialog}
      <p className="mb-2 text-xs font-semibold text-slate-500">ແກ້ໄຂ / ລບ</p>
      <div className="space-y-2">
        <div>
          <label className="mb-1 block text-[11px] font-semibold text-slate-500">Supplier</label>
          <SelectField name="claim_supplier" options={supplierOptions} value={sup} onChange={setSup} placeholder="ເລືອກ supplier..." />
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-semibold text-slate-500">ຫຍີ່ຫໍ້</label>
          <SelectField name="claim_brand" options={brandOptions} value={brand} onChange={setBrand} placeholder="ເລືອກ ຫຍີ່ຫໍ້..." />
        </div>
        <textarea value={rsn} onChange={(e) => setRsn(e.target.value)} rows={2} placeholder="ເຫດຜົນ" className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm outline-none focus:border-teal-500" />
      </div>
      {err && <p className="mt-2 text-xs font-semibold text-rose-600">{err}</p>}
      <div className="mt-3 flex items-center justify-between">
        <button type="button" disabled={pending} onClick={remove} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 text-xs font-semibold text-rose-600 hover:bg-rose-100 disabled:opacity-60">
          <Trash2 className="size-4" /> ລບໃບເຄມ
        </button>
        <button type="button" disabled={pending} onClick={save} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-slate-900 px-4 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-60">
          {pending ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />} ບັນທຶກ
        </button>
      </div>
    </div>
  );
}
