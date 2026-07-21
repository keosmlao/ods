"use client";
import { createClaim } from "@/app/actions/claim";
import { JobPickerModal } from "@/components/claim/job-picker-modal";
import { SelectField } from "@/components/select-field";
import { CLAIM_TYPE_LABEL, type ClaimJobCandidate, type ClaimType } from "@/lib/claim-shared";
import { LoaderCircle, Search, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

const TYPES: ClaimType[] = ["A", "B", "C"];

export function NewClaimForm({
  suppliers,
  brands,
  defaultType,
  initialRefJob = "",
  initialBrand = "",
  initialSupplier = "",
}: {
  suppliers: { code: string; name: string }[];
  brands: { code: string; name_1: string }[];
  defaultType: ClaimType;
  initialRefJob?: string;
  initialBrand?: string;
  initialSupplier?: string;
}) {
  const router = useRouter();
  const [type, setType] = useState<ClaimType>(defaultType);
  const [supplier, setSupplier] = useState(initialSupplier);
  const [brand, setBrand] = useState(initialBrand);
  const [customer, setCustomer] = useState("");
  const [refJob, setRefJob] = useState(initialRefJob);
  const [jobInfo, setJobInfo] = useState<ClaimJobCandidate | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  const pickJob = (job: ClaimJobCandidate) => {
    setRefJob(job.code);
    setJobInfo(job);
    if (job.brand && !brand) setBrand(job.brand);
    setPickerOpen(false);
  };

  const needsSupplier = type === "A" || type === "C";
  const needsCustomer = type === "B";
  const supplierOpts = useMemo(() => suppliers.map((s) => ({ value: s.code, label: `${s.code} · ${s.name}` })), [suppliers]);
  const brandOpts = useMemo(() => brands.map((b) => ({ value: b.code, label: b.name_1 })), [brands]);

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
          <SelectField name="claim_supplier" options={supplierOpts} value={supplier} onChange={setSupplier} placeholder="— ເລືອກ supplier —" />
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
          <SelectField name="claim_brand" options={brandOpts} value={brand} onChange={setBrand} placeholder="— ບໍ່ລະບຸ —" />
        </div>
      )}

      {(type === "C" || type === "A") && (
        <div>
          <label className={label}>ເລກງານສ້ອມ (ອ້າງອີງ){type === "C" ? " *" : ""}</label>
          {refJob ? (
            <div className="flex items-start gap-2 rounded-lg border border-teal-200 bg-teal-50/60 px-3 py-2">
              <span className="mt-0.5 shrink-0 rounded bg-white px-1.5 py-0.5 font-mono text-xs font-bold text-[#0536a9]">{refJob}</span>
              <span className="min-w-0 flex-1 text-xs text-slate-600">
                {jobInfo ? (
                  <>
                    <span className="block truncate font-medium text-slate-800">{jobInfo.product || "-"}{jobInfo.brand ? ` · ${jobInfo.brand}` : ""}</span>
                    <span className="block truncate text-[11px] text-slate-500">{jobInfo.sn ? `SN ${jobInfo.sn} · ` : ""}{jobInfo.customer || "-"}</span>
                  </>
                ) : (
                  <span className="text-slate-500">ງານທີ່ເລືອກ</span>
                )}
              </span>
              <button type="button" onClick={() => { setRefJob(""); setJobInfo(null); }} title="ລ້າງ" className="shrink-0 text-slate-400 hover:text-rose-600"><X className="size-4" /></button>
            </div>
          ) : (
            <button type="button" onClick={() => setPickerOpen(true)} className={`${field} flex items-center gap-2 text-left text-slate-400 hover:border-teal-500`}>
              <Search className="size-4" /> ເລືອກເລກງານສ້ອມ (ສຳເລັດ · ສົ່ງຄືນ)
            </button>
          )}
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

      <JobPickerModal open={pickerOpen} onClose={() => setPickerOpen(false)} onPick={pickJob} />
    </div>
  );
}
