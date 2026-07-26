"use client";
import { addClaimPhotos, createClaim } from "@/app/actions/claim";
import { JobPickerModal } from "@/components/claim/job-picker-modal";
import { SelectField } from "@/components/select-field";
import { CLAIM_TYPE_LABEL, claimPagePath, type ClaimJobCandidate, type ClaimType } from "@/lib/claim-shared";
import { ImagePlus, LoaderCircle, Search, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

export function NewClaimForm({
  suppliers,
  customers,
  brands,
  defaultType,
  initialRefJob = "",
  initialBrand = "",
  initialSupplier = "",
}: {
  suppliers: { code: string; name: string }[];
  customers: { code: string; name: string }[];
  brands: { code: string; name_1: string }[];
  defaultType: ClaimType;
  initialRefJob?: string;
  initialBrand?: string;
  initialSupplier?: string;
}) {
  const router = useRouter();
  // type fixed ຕາມໜ້າທີ່ມາ (shop=B · supplier=A · reimburse=C)
  const type = defaultType;
  const [supplier, setSupplier] = useState(initialSupplier);
  const [brand, setBrand] = useState(initialBrand);
  const [customer, setCustomer] = useState("");
  const [contact, setContact] = useState("");
  const [refJob, setRefJob] = useState(initialRefJob);
  const [jobInfo, setJobInfo] = useState<ClaimJobCandidate | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  // ── ສິນຄ້າ & ຮັບປະກັນ (B) ──
  const [product, setProduct] = useState("");
  const [model, setModel] = useState("");
  const [sn, setSn] = useState("");
  const [purchaseDate, setPurchaseDate] = useState("");
  const [warranty, setWarranty] = useState("");
  const [reason, setReason] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  // ເລືອກເລກສ້ອມ → auto-fill ສິນຄ້າ/ຫຍີ່ຫໍ້/model/SN/ອາການ (ບໍ່ຕ້ອງພິມຊ້ຳ)
  const pickJob = (job: ClaimJobCandidate) => {
    setRefJob(job.code);
    setJobInfo(job);
    if (job.brand) setBrand((b) => b || job.brand!);
    if (job.product) setProduct((p) => p || job.product!);
    if (job.model) setModel((m) => m || job.model!);
    if (job.sn) setSn((s) => s || job.sn!);
    if (job.fault) setReason((r) => r || job.fault!);
    setPickerOpen(false);
  };

  const needsSupplier = type === "A" || type === "C";
  const needsCustomer = type === "B";
  const showProduct = type === "B";
  const showPhotos = type === "A" || type === "B";
  const supplierOpts = useMemo(() => suppliers.map((s) => ({ value: s.code, label: `${s.code} · ${s.name}` })), [suppliers]);
  const customerOpts = useMemo(() => customers.map((c) => ({ value: c.code, label: `${c.code} · ${c.name}` })), [customers]);
  const brandOpts = useMemo(() => brands.map((b) => ({ value: b.code, label: b.name_1 })), [brands]);

  const submit = () =>
    start(async () => {
      setError("");
      const res = await createClaim({
        claim_type: type, supplier_code: supplier, brand_code: brand, customer_code: customer,
        ref_job: refJob, reason, product, model, sn, warranty, purchase_date: purchaseDate, contact,
      });
      if (res.error || !res.claimNo) { setError(res.error ?? "ບໍ່ສຳເລັດ"); return; }
      if (photos.length) {
        const fd = new FormData();
        for (const f of photos) fd.append("photos", f);
        const up = await addClaimPhotos(res.claimNo, fd);
        if (up.error) { setError(`ເປີດໃບແລ້ວ ແຕ່ແนบຮูปບໍ່ສຳເລັດ: ${up.error}`); router.push(`/claims/${res.claimNo}`); return; }
      }
      router.push(`/claims/${res.claimNo}`);
    });

  const label = "mb-1 block text-xs font-semibold text-slate-600";
  const field = "h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-teal-500";

  return (
    <div className="max-w-xl space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div>
        <span className={label}>ປະເພດເຄມ</span>
        <div className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white">
          <span className="font-mono">CLM-{type}</span> · {CLAIM_TYPE_LABEL[type]}
        </div>
      </div>

      {needsSupplier && (
        <div>
          <label className={label}>Supplier (ຈາກ ERP) *</label>
          <SelectField name="claim_supplier" options={supplierOpts} value={supplier} onChange={setSupplier} placeholder="— ເລືອກ supplier —" />
        </div>
      )}

      {needsCustomer && (
        <>
          <div>
            <label className={label}>ຮ້ານ / ຕົວແທນ (ຈາກ ERP) *</label>
            <SelectField name="claim_customer" options={customerOpts} value={customer} onChange={setCustomer} placeholder="— ຄົ້ນ ຮ້ານ/ລູກຄ້າ —" />
          </div>
          <div>
            <label className={label}>ຜູ້ຕິດຕໍ່ / ເບີໂທ</label>
            <input value={contact} onChange={(e) => setContact(e.target.value)} placeholder="ຊື່ຜູ້ຕິດຕໍ່ · ເບີໂທ (ບໍ່ບັງຄັບ)" className={field} />
          </div>
        </>
      )}

      {type === "A" && (
        <div>
          <label className={label}>ຫຍີ່ຫໍ້ (ຈາກ ERP)</label>
          <SelectField name="claim_brand" options={brandOpts} value={brand} onChange={setBrand} placeholder="— ບໍ່ລະບຸ —" />
        </div>
      )}

      {/* ── ເລກສ້ອມ (B=ດຶງ auto-fill · A/C=ອ້າງອີງ, C ບັງຄັບ) ── */}
      <div>
        <label className={label}>
          {type === "B" ? "ດຶງຈາກເລກສ້ອມ (auto-fill ສິນຄ້າ/SN/ອາການ)" : `ເລກງານສ້ອມ (ອ້າງອີງ)${type === "C" ? " *" : ""}`}
        </label>
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

      {/* ── ສິນຄ້າ & ຮັບປະກັນ (B) ── */}
      {showProduct && (
        <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
          <p className="text-[11px] font-bold text-slate-500">ສິນຄ້າ & ຮັບປະກັນ</p>
          <div>
            <label className={label}>ສິນຄ້າ</label>
            <input value={product} onChange={(e) => setProduct(e.target.value)} placeholder="ຊື່ສິນຄ້າ" className={field} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label}>ຫຍີ່ຫໍ້</label>
              <SelectField name="claim_brand_b" options={brandOpts} value={brand} onChange={setBrand} placeholder="— ຫຍີ່ຫໍ້ —" />
            </div>
            <div>
              <label className={label}>Model</label>
              <input value={model} onChange={(e) => setModel(e.target.value)} placeholder="ລຸ້ນ" className={field} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label}>SN (serial)</label>
              <input value={sn} onChange={(e) => setSn(e.target.value)} placeholder="ໝາຍເລກເຄື່ອງ" className={field} />
            </div>
            <div>
              <label className={label}>ວັນຊື້</label>
              <input type="date" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} className={field} />
            </div>
          </div>
          <div>
            <label className={label}>ຮັບປະກັນ</label>
            <div className="flex gap-1.5">
              {[["in", "ໃນປະກັນ"], ["out", "ນອກປະກັນ"]].map(([v, l]) => (
                <button key={v} type="button" onClick={() => setWarranty(warranty === v ? "" : v)} className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${warranty === v ? "bg-teal-600 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"}`}>{l}</button>
              ))}
            </div>
          </div>
        </div>
      )}

      <div>
        <label className={label}>{type === "B" ? "ອາການ / ບັນຫາ *" : "ເຫດຜົນ / ໝາຍເຫตุ"}</label>
        <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} placeholder={type === "B" ? "ອາການເສຍ / ບັນຫາຂອງສິນຄ້າ" : ""} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-500" />
      </div>

      {/* ── ຮູບຫຼັກฐาน (B/A) ── */}
      {showPhotos && (
        <div>
          <label className={label}>ຮູບຫຼັກຖານ</label>
          <label className={`${field} flex cursor-pointer items-center gap-2 text-slate-400 hover:border-teal-500`}>
            <ImagePlus className="size-4" />
            {photos.length ? `${photos.length} ຮູບ` : "ເລືອກ / ຖ່າຍຮູບ"}
            <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => setPhotos(Array.from(e.target.files ?? []))} />
          </label>
          {photos.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {photos.map((f, i) => (
                <span key={i} className="inline-flex max-w-[10rem] items-center gap-1 truncate rounded bg-slate-100 px-2 py-1 text-[11px] text-slate-600">
                  {f.name}
                  <button type="button" onClick={() => setPhotos((ps) => ps.filter((_, j) => j !== i))} className="text-slate-400 hover:text-rose-600"><X className="size-3" /></button>
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {error && <p className="text-xs font-semibold text-rose-600">{error}</p>}

      <div className="flex justify-end gap-2">
        <button type="button" onClick={() => router.push(claimPagePath(type))} className="h-10 rounded-lg border border-slate-200 px-4 text-sm font-semibold text-slate-600 hover:bg-slate-50">ຍົກເລີກ</button>
        <button type="button" disabled={pending} onClick={submit} className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-teal-600 px-5 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-60">
          {pending && <LoaderCircle className="size-4 animate-spin" />} ເປີດໃບເຄມ
        </button>
      </div>

      <JobPickerModal open={pickerOpen} onClose={() => setPickerOpen(false)} onPick={pickJob} />
    </div>
  );
}
