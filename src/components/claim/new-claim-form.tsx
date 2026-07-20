"use client";
import { createClaim } from "@/app/actions/claim";
import { CLAIM_TYPE_LABEL, type ClaimType } from "@/lib/claim";
import { LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

const TYPES: ClaimType[] = ["A", "B", "C"];

export function NewClaimForm({
  suppliers,
  brands,
  defaultType,
}: {
  suppliers: { code: string; name: string }[];
  brands: { code: string; name_1: string }[];
  defaultType: ClaimType;
}) {
  const router = useRouter();
  const [type, setType] = useState<ClaimType>(defaultType);
  const [supplier, setSupplier] = useState("");
  const [brand, setBrand] = useState("");
  const [customer, setCustomer] = useState("");
  const [refJob, setRefJob] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  const needsSupplier = type === "A" || type === "C";
  const needsCustomer = type === "B";

  const submit = () =>
    start(async () => {
      setError("");
      const res = await createClaim({ claim_type: type, supplier_code: supplier, brand_code: brand, customer_code: customer, ref_job: refJob, reason });
      if (res.error || !res.claimNo) { setError(res.error ?? "ບໍ່ສຳເລັດ"); return; }
      router.push(`/claims/${res.claimNo}`);
    });

  const label = "mb-1 block text-xs font-semibold text-slate-600";
  const field = "h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-teal-500";

  return (
    <div className="max-w-xl space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div>
        <span className={label}>ປະເພດເຄມ</span>
        <div className="flex flex-wrap gap-1.5">
          {TYPES.map((t) => (
            <button key={t} type="button" onClick={() => setType(t)} className={`rounded-lg px-3 py-2 text-xs font-semibold ${t === type ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
              <span className="font-mono">CLM-{t}</span> · {CLAIM_TYPE_LABEL[t]}
            </button>
          ))}
        </div>
      </div>

      {needsSupplier && (
        <div>
          <label className={label}>Supplier (ຈາກ ERP) *</label>
          <select value={supplier} onChange={(e) => setSupplier(e.target.value)} className={field}>
            <option value="">— ເລືອກ supplier —</option>
            {suppliers.map((s) => (
              <option key={s.code} value={s.code}>{s.code} · {s.name}</option>
            ))}
          </select>
        </div>
      )}

      {needsCustomer && (
        <div>
          <label className={label}>ຮ້ານ / ລູກຄ້າ (ລະຫັດ) *</label>
          <input value={customer} onChange={(e) => setCustomer(e.target.value)} placeholder="ລະຫັດລູກຄ້າ" className={field} />
        </div>
      )}

      {type === "A" && (
        <div>
          <label className={label}>ຫຍີ່ຫໍ້ (ຈາກ ERP)</label>
          <select value={brand} onChange={(e) => setBrand(e.target.value)} className={field}>
            <option value="">— ບໍ່ລະບຸ —</option>
            {brands.map((b) => (
              <option key={b.code} value={b.code}>{b.name_1}</option>
            ))}
          </select>
        </div>
      )}

      {(type === "C" || type === "A") && (
        <div>
          <label className={label}>ເລກงานสอม (ອ້າງອີງ){type === "C" ? " *" : ""}</label>
          <input value={refJob} onChange={(e) => setRefJob(e.target.value)} placeholder="ເລກงาน (ຖ້າມີ)" className={field} />
        </div>
      )}

      <div>
        <label className={label}>ເຫດຜົນ / ໝາຍເຫตุ</label>
        <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-500" />
      </div>

      {error && <p className="text-xs font-semibold text-rose-600">{error}</p>}

      <div className="flex justify-end gap-2">
        <button type="button" onClick={() => router.push("/claims")} className="h-10 rounded-lg border border-slate-200 px-4 text-sm font-semibold text-slate-600 hover:bg-slate-50">ຍົກເລີກ</button>
        <button type="button" disabled={pending} onClick={submit} className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-teal-600 px-5 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-60">
          {pending && <LoaderCircle className="size-4 animate-spin" />} ເປີດໃບເຄມ
        </button>
      </div>
    </div>
  );
}
