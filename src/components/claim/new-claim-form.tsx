"use client";
import { addClaimItem, addClaimPhotos, createClaim, findBills, findInventory, loadBillItems, loadClaimJob } from "@/app/actions/claim";
import type { ClaimJobDetail } from "@/lib/claim";
import { JobPickerModal } from "@/components/claim/job-picker-modal";
import { SearchPickerModal } from "@/components/claim/search-picker-modal";
import { SelectField } from "@/components/select-field";
import {
  type BillItem, type ClaimBill, CLAIM_TYPE_LABEL, claimPagePath, type ClaimJobCandidate, type ClaimType,
  type InvItem, warrantyFromBillDate,
} from "@/lib/claim-shared";
import { ImagePlus, LoaderCircle, Receipt, Search, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

export function NewClaimForm({
  suppliers,
  customers,
  defaultType,
  initialRefJob = "",
  initialBrand = "",
  initialSupplier = "",
  initialProduct = "",
  initialModel = "",
  initialSn = "",
}: {
  suppliers: { code: string; name: string }[];
  customers: { code: string; name: string }[];
  defaultType: ClaimType;
  initialRefJob?: string;
  initialBrand?: string;
  initialSupplier?: string;
  initialProduct?: string;
  initialModel?: string;
  initialSn?: string;
}) {
  const router = useRouter();
  const type = defaultType; // fixed ຕາມໜ້າ (shop=B · supplier=A · reimburse=C)
  const [supplier, setSupplier] = useState(initialSupplier);
  const [brand, setBrand] = useState(initialBrand);
  const [customer, setCustomer] = useState("");
  const [contact, setContact] = useState("");
  const [refJob, setRefJob] = useState(initialRefJob);
  const [jobInfo, setJobInfo] = useState<ClaimJobCandidate | null>(null);
  /** ລາຍລະອຽດເຕັມຂອງງານ + ລາຍການທີ່ຈະຮຽກເກັບ (ໂຫຼດຫຼັງເລືອກງານ) */
  const [jobDetail, setJobDetail] = useState<ClaimJobDetail | null>(null);
  const [jobItems, setJobItems] = useState<(ClaimJobDetail["items"][number] & { key: string; take: boolean })[]>([]);
  const [loadingJob, setLoadingJob] = useState(false);
  // ── ບິນຂາຍ ERP + ລາຍการສินค้า ──
  const [bill, setBill] = useState<ClaimBill | null>(null);
  const [billLines, setBillLines] = useState<BillItem[]>([]);
  const [replacement, setReplacement] = useState<InvItem | null>(null);
  // ── ສິນຄ້າ & ຮັບປະກັນ ──
  const [product, setProduct] = useState(initialProduct);
  const [model, setModel] = useState(initialModel);
  const [sn, setSn] = useState(initialSn);
  const [purchaseDate, setPurchaseDate] = useState("");
  const [warranty, setWarranty] = useState("");
  const [reason, setReason] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const [jobOpen, setJobOpen] = useState(false);
  const [billOpen, setBillOpen] = useState(false);
  const [invOpen, setInvOpen] = useState(false);
  const [loadingLines, setLoadingLines] = useState(false);

  const warrantyInfo = useMemo(() => warrantyFromBillDate(bill?.iso_date ?? ""), [bill]);

  // ເລືອກບິນ → auto customer/ວັນຊື້/ປະກັນ + ໂຫຼດລາຍการສินค้า
  const pickBill = async (b: ClaimBill) => {
    setBill(b);
    setCustomer(b.cust_code);
    setPurchaseDate(b.iso_date);
    const w = warrantyFromBillDate(b.iso_date);
    if (w) setWarranty(w.status);
    setBillOpen(false);
    setLoadingLines(true);
    const r = await loadBillItems(b.doc_no);
    setBillLines(r.items ?? []);
    setLoadingLines(false);
  };
  const pickLine = (line: BillItem) => { setProduct(line.item_name); if (line.brand) setBrand(line.brand); };
  /**
   * ເລືອກງານ ⇒ ນອກຈາກຕື່ມຊ່ອງໃຫ້ ຍັງ **ດຶງລາຍລະອຽດ + ລາຍການທີ່ຈະຮຽກເກັບ**ມາເລີຍ
   * (ໃບສະເໜີລາຄາຖ້າມີ · ບໍ່ດັ່ງນັ້ນເອົາອາໄຫຼ່ທີ່ໃຊ້ຈິງ). ຄົນຈຶ່ງເຫັນຕັ້ງແຕ່ກ່ອນເປີດໃບ
   * ວ່າຈະເກັບຫຍັງນຳ supplier ແດ່ ແລະ ບໍ່ຕ້ອງໄປພິມລາຍການຄືນເອງຢູ່ໜ້າໃບເຄມ.
   */
  const pickJob = (job: ClaimJobCandidate) => {
    setRefJob(job.code); setJobInfo(job); setBillOpen(false);
    if (job.brand) setBrand((b) => b || job.brand!);
    if (job.product) setProduct((p) => p || job.product!);
    if (job.model) setModel((m) => m || job.model!);
    if (job.sn) setSn((s) => s || job.sn!);
    if (job.fault) setReason((r) => r || job.fault!);
    setJobOpen(false);
    setJobDetail(null);
    setJobItems([]);
    setLoadingJob(true);
    void loadClaimJob(job.code).then((r) => {
      setLoadingJob(false);
      if (!r.job) return;
      setJobDetail(r.job);
      setJobItems(r.job.items.map((it, i) => ({ ...it, key: `${it.item_code ?? "x"}-${i}`, take: true })));
      if (r.job.customer_code) setCustomer((c) => c || r.job!.customer_code!);
      if (r.job.fault_2) setReason((x) => x || r.job!.fault_2!);
    });
  };
  const clearJob = () => { setRefJob(""); setJobInfo(null); setJobDetail(null); setJobItems([]); };

  const needsSupplier = type === "A" || type === "C";
  const isB = type === "B";
  const isC = type === "C";
  const showPhotos = type === "A" || type === "B";
  const supplierOpts = useMemo(() => suppliers.map((s) => ({ value: s.code, label: `${s.code} · ${s.name}` })), [suppliers]);
  const customerOpts = useMemo(() => customers.map((c) => ({ value: c.code, label: `${c.code} · ${c.name}` })), [customers]);

  const submit = () =>
    start(async () => {
      setError("");
      const res = await createClaim({
        claim_type: type, supplier_code: supplier, brand_code: brand, customer_code: customer,
        ref_job: refJob, reason, product, model, sn, warranty, purchase_date: purchaseDate, contact, bill_no: bill?.doc_no ?? "",
        // ສົ່ງລາຍການໄປພ້ອມ ⇒ ໃບເຄມມີຍອດຕັ້ງແຕ່ເກີດ ແລະ ລະບົບອອກ COB ໃຫ້ເລີຍ
        items: jobItems.filter((x) => x.take).map((it) => ({
          item_code: it.item_code,
          item_name: it.item_name ?? "ລາຍການ",
          qty: it.qty || 1,
          unit: it.unit,
          amount: it.amount || 0,
        })),
      });
      if (res.error || !res.claimNo) { setError(res.error ?? "ບໍ່ສຳເລັດ"); return; }
      // ອາໄຫຼ່/ສິນຄ້າທີ່ຕ້ອງການປ່ຽນ → ບັນທຶກເປັນ claim item
      if (replacement) await addClaimItem(res.claimNo, { item_code: replacement.code, item_name: replacement.name, unit: replacement.unit ?? undefined });
      if (photos.length) {
        const fd = new FormData();
        for (const f of photos) fd.append("photos", f);
        const up = await addClaimPhotos(res.claimNo, fd);
        if (up.error) { setError(`ເປີດໃບແລ້ວ ແຕ່ແนบຮูปບໍ່ສຳເລັດ: ${up.error}`); router.push(`/claims/${res.claimNo}`); return; }
      }
      router.push(`/claims/${res.claimNo}`);
    });

  const label = "mb-1 block text-xs font-semibold text-slate-600";
  const field = "h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-brand-600";
  const card = "space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm";

  return (
    <div className="w-full space-y-4">
      <div className="inline-flex items-center gap-2 rounded-lg bg-brand-900 px-3 py-2 text-xs font-semibold text-white">
        <span className="font-mono">CLM-{type}</span> · {CLAIM_TYPE_LABEL[type]}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* ═══ ຊ້າຍ: ບິນ + ສິນຄ້າ ═══ */}
        <div className="space-y-4">
          {isB && (
            <div className={card}>
              <p className="text-[11px] font-bold text-slate-500">① ບິນຂາຍ (ERP) — ດຶງລູກຄ້າ · ວັນຊື້ · ປະກັນ</p>
              {bill ? (
                <div className="rounded-xl border border-brand-200 bg-brand-50/60 p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-brand">{bill.doc_no}</span>
                    <button type="button" onClick={() => { setBill(null); setBillLines([]); }} className="text-slate-400 hover:text-brand-orange-700"><X className="size-4" /></button>
                  </div>
                  <p className="mt-0.5 text-xs text-slate-600">{bill.cust_name || bill.cust_code} · ວັນຊື້ {bill.doc_date}</p>
                  {warrantyInfo && (
                    <p className={`mt-1 inline-block rounded px-1.5 py-0.5 text-[11px] font-bold ${warrantyInfo.status === "in" ? "bg-brand-100 text-brand-800" : "bg-brand-orange-100 text-brand-orange-700"}`}>{warrantyInfo.label}</p>
                  )}
                </div>
              ) : (
                <button type="button" onClick={() => setBillOpen(true)} className={`${field} flex items-center gap-2 text-left text-slate-400 hover:border-brand-600`}>
                  <Receipt className="size-4" /> ຄົ້ນ-ເລືອກ ເລກບິນ / ລູກຄ້າ
                </button>
              )}

              {/* ② ລາຍการສินค้าใນບິນ → ເລືອກອັນທີ່ມີບັນຫາ */}
              {bill && (
                <div>
                  <p className={label}>② ສິນຄ້າໃນບິນ — ເລືອກອັນທີ່ມີບັນຫາ</p>
                  {loadingLines ? (
                    <p className="py-3 text-center text-xs text-slate-400"><LoaderCircle className="inline size-4 animate-spin" /> ໂຫຼດ...</p>
                  ) : billLines.length === 0 ? (
                    <p className="py-2 text-xs text-slate-400">ບໍ່ພົບລາຍการ</p>
                  ) : (
                    <ul className="max-h-48 space-y-1 overflow-y-auto">
                      {billLines.map((ln, i) => (
                        <li key={`${ln.item_code}-${i}`}>
                          <button type="button" onClick={() => pickLine(ln)} className={`w-full rounded-lg border px-2.5 py-1.5 text-left text-xs ${product === ln.item_name ? "border-brand-400 bg-brand-50" : "border-slate-200 hover:bg-slate-50"}`}>
                            <span className="block truncate font-medium text-slate-800">{ln.item_name}</span>
                            <span className="text-[10px] text-slate-400">{ln.item_code} · {ln.qty} {ln.unit ?? ""}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── ເລກສ້ອມ (B=ດຶງ auto-fill · A=ອ້າງອີງ · C=**ບັງຄັບ ແລະ ຕ້ອງສົ່ງຄືນແລ້ວ**) ── */}
          <div className={isC ? `${card} border-brand-orange-400 bg-brand-orange-50/40` : card}>
            <p className={label}>{isB ? "ດຶງຈາກເລກສ້ອມ (ຖ້າມີງານສ້ອມແລ້ວ)" : `ເລກງານສ້ອມ (ອ້າງອີງ)${isC ? " *" : ""}`}</p>
            {/**
              * CLM-C = ຮຽກເກັບຄ່າສ້ອມທີ່ເຮັດຈົບແລ້ວນຳ supplier ⇒ ຕ້ອງມີເລກງານ ແລະ
              * ງານນັ້ນຕ້ອງ **ສົ່ງຄືນລູກຄ້າສຳເລັດ** (picker ໂຊ້ວແຕ່ງານແບບນັ້ນ ແລະ
              * createClaim ກວດຊ້ຳ). ບອກໄວ້ຢູ່ນີ້ ຄົນຈຶ່ງບໍ່ໄປຫາງານທີ່ຍັງບໍ່ຈົບ.
              */}
            {isC && (
              <p className="-mt-1.5 mb-2 text-[11px] text-brand-orange-700">
                ບັງຄັບ — ເລືອກໄດ້ສະເພາະງານທີ່ <b>ສົ່ງຄືນລູກຄ້າສຳເລັດແລ້ວ</b> ແລະ ຍັງບໍ່ມີໃບເຄມ
              </p>
            )}
            {refJob ? (
              <div className="flex items-start gap-2 rounded-lg border border-brand-200 bg-brand-50/60 px-3 py-2">
                <span className="mt-0.5 shrink-0 rounded bg-white px-1.5 py-0.5 font-mono text-xs font-bold text-brand">{refJob}</span>
                <span className="min-w-0 flex-1 text-xs text-slate-600">{jobInfo ? `${jobInfo.product || "-"}${jobInfo.brand ? ` · ${jobInfo.brand}` : ""}` : "ງານທີ່ເລືອກ"}</span>
                <button type="button" onClick={clearJob} className="shrink-0 text-slate-400 hover:text-brand-orange-700"><X className="size-4" /></button>
              </div>
            ) : (
              <button type="button" onClick={() => setJobOpen(true)} className={`${field} flex items-center gap-2 text-left text-slate-400 hover:border-brand-600`}>
                <Search className="size-4" /> ເລືອກເລກງານສ້ອມ
              </button>
            )}

            {loadingJob && (
              <p className="pt-2 text-[11px] text-slate-400"><LoaderCircle className="inline size-3.5 animate-spin" /> ດຶງລາຍລະອຽດງານ...</p>
            )}

            {/* ── ລາຍລະອຽດຂອງງານ — ອ່ານຢ່າງດຽວ (ຄ່າຈິງຢູ່ໃບງານ ບໍ່ໃຫ້ແກ້ຢູ່ນີ້) ── */}
            {jobDetail && (
              <dl className="grid grid-cols-2 gap-x-3 gap-y-1 border-t border-slate-200/70 pt-2 text-[11px]">
                {([
                  ["ສິນຄ້າ", jobDetail.product],
                  ["ຫຍີ່ຫໍ້ / ຮຸ່ນ", [jobDetail.brand, jobDetail.model].filter(Boolean).join(" · ")],
                  ["SN", jobDetail.sn],
                  ["ລູກຄ້າ", jobDetail.customer],
                  ["ອາການ", jobDetail.fault],
                  ["ອາການ (ພົບຈິງ)", jobDetail.fault_2],
                  ["ຮັບປະກັນ", jobDetail.warranty],
                  ["ຊ່າງ", jobDetail.technician],
                  ["ສົ່ງຄືນລູກຄ້າ", jobDetail.returned_at],
                ] as const).map(([k, v]) =>
                  v ? (
                    <div key={k} className="min-w-0">
                      <dt className="text-slate-400">{k}</dt>
                      <dd className="truncate font-medium text-slate-700" title={v}>{v}</dd>
                    </div>
                  ) : null,
                )}
              </dl>
            )}

            {/**
              * ── ລາຍການທີ່ຈະຮຽກເກັບ ──
              * ມາຈາກ **ໃບສະເໜີລາຄາ/ເກັບເງິນ** (ມີລາຄາຈິງ) ຫຼື **ອາໄຫຼ່ທີ່ໃຊ້** (ລາຄາ 0 —
              * ງານຮັບປະກັນບໍ່ໄດ້ອອກໃບລາຄາ ແຕ່ຍັງຕ້ອງເກັບຄ່າອາໄຫຼ່ນຳ supplier).
              * ຕິດມາທຸກແຖວ ຄົນຖອດອອກໄດ້ — ບັນທຶກເປັນລາຍການຂອງໃບເຄມຕອນກົດ "ເປີດໃບເຄມ".
              */}
            {jobItems.length > 0 && (
              <div className="border-t border-slate-200/70 pt-2">
                <p className="mb-1 flex items-center gap-1.5 text-[11px] font-bold text-slate-600">
                  {jobDetail?.items_from === "quote"
                    ? <>ລາຍການຈາກໃບສະເໜີລາຄາ <span className="font-mono font-medium text-slate-400">{jobDetail.quote_no}</span></>
                    : <>ອາໄຫຼ່ທີ່ໃຊ້ໃນງານນີ້ <span className="font-medium text-slate-400">(ບໍ່ມີໃບລາຄາ — ຕື່ມລາຄາຢູ່ໜ້າໃບເຄມ)</span></>}
                </p>
                <ul className="space-y-1">
                  {jobItems.map((it) => (
                    <li key={it.key}>
                      <label className={`flex cursor-pointer items-center gap-2 rounded-lg border px-2.5 py-1.5 text-[11px] ${it.take ? "border-brand-200 bg-white" : "border-slate-200 bg-slate-50 opacity-60"}`}>
                        <input
                          type="checkbox"
                          checked={it.take}
                          onChange={() => setJobItems((list) => list.map((x) => (x.key === it.key ? { ...x, take: !x.take } : x)))}
                          className="size-3.5 accent-brand-700"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium text-slate-800">{it.item_name || it.item_code}</span>
                          <span className="text-[10px] text-slate-400">{it.item_code} · {it.qty} {it.unit ?? ""}</span>
                        </span>
                        {it.amount > 0 && <b className="shrink-0 tabular-nums text-slate-600">{it.amount.toLocaleString()}</b>}
                      </label>
                    </li>
                  ))}
                </ul>
                {jobItems.some((it) => it.take && it.amount > 0) && (
                  <p className="mt-1 text-right text-[11px] font-bold text-slate-700">
                    ລວມ {jobItems.filter((it) => it.take).reduce((s, it) => s + it.amount, 0).toLocaleString()}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* ── ຮູບຫຼັກฐาน ── */}
          {showPhotos && (
            <div className={card}>
              <p className={label}>ຮູບຫຼັກຖານ</p>
              <label className={`${field} flex cursor-pointer items-center gap-2 text-slate-400 hover:border-brand-600`}>
                <ImagePlus className="size-4" />{photos.length ? `${photos.length} ຮູບ` : "ເລືອກ / ຖ່າຍຮູບ"}
                <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => setPhotos(Array.from(e.target.files ?? []))} />
              </label>
              {photos.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {photos.map((f, i) => (
                    <span key={i} className="inline-flex max-w-[9rem] items-center gap-1 truncate rounded bg-slate-100 px-2 py-1 text-[11px] text-slate-600">{f.name}
                      <button type="button" onClick={() => setPhotos((ps) => ps.filter((_, j) => j !== i))} className="text-slate-400 hover:text-brand-orange-700"><X className="size-3" /></button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ═══ ຂວາ: ຄູ່ຄ້າ + ລາຍລະອຽດ ═══ */}
        <div className="space-y-4">
          <div className={card}>
            {needsSupplier && (
              <div>
                <label className={label}>Supplier (ຈາກ ERP) *</label>
                <SelectField name="claim_supplier" options={supplierOpts} value={supplier} onChange={setSupplier} placeholder="— ເລືອກ supplier —" />
              </div>
            )}
            {isB && (
              <div>
                <label className={label}>ຮ້ານ / ລູກຄ້າ *{bill ? " (ດຶງຈາກບິນ)" : ""}</label>
                <SelectField name="claim_customer" options={customerOpts} value={customer} onChange={setCustomer} placeholder="— ຄົ້ນ ຮ້ານ/ລູກຄ້າ —" />
                {bill && customer && !customerOpts.some((o) => o.value === customer) && (
                  <p className="mt-1 text-[11px] text-slate-500">{bill.cust_name || bill.cust_code}</p>
                )}
              </div>
            )}
            {isB && (
              <div>
                <label className={label}>ຜູ້ຕິດຕໍ່ / ເບີໂທ</label>
                <input value={contact} onChange={(e) => setContact(e.target.value)} placeholder="ຊື່ · ເບີໂທ (ບໍ່ບັງຄັບ)" className={field} />
              </div>
            )}
            {/**
              * **ບໍ່ມີຊ່ອງ "ຫຍີ່ຫໍ້" ອີກ** (ຖອດ 05-08-2026 ຕາມຄຳສັ່ງ) — ຫຍີ່ຫໍ້ມາຈາກ**ໃບງານ**
              * ຢູ່ແລ້ວ (pickJob ຕື່ມໃຫ້) ⇒ ໃຫ້ຄົນເລືອກຊ້ຳ = ໂອກາດໃສ່ຂັດກັບໃບງານ.
              * ຄ່າຍັງຖືກສົ່ງໄປກັບໃບເຄມຄືເກົ່າ (ods_claim.brand_code ບໍ່ຫວ່າງ).
              */}
          </div>

          {(isB || type === "A") && (
            <div className={card}>
              <p className="text-[11px] font-bold text-slate-500">ສິນຄ້າ{isB ? " & ຮັບປະກັນ" : " (ອ້າງອີງ)"}</p>
              <div>
                <label className={label}>ສິນຄ້າ{isB ? " (ຈາກບິນ ຫຼື ພິມ)" : ""}</label>
                <input value={product} onChange={(e) => setProduct(e.target.value)} placeholder="ຊື່ສິນຄ້າ" className={field} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className={label}>Model</label><input value={model} onChange={(e) => setModel(e.target.value)} className={field} /></div>
                <div><label className={label}>SN (serial)</label><input value={sn} onChange={(e) => setSn(e.target.value)} className={field} /></div>
              </div>
              {isB && (
                <div className="grid grid-cols-2 gap-3">
                  <div><label className={label}>ວັນຊື້</label><input type="date" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} className={field} /></div>
                  <div>
                    <label className={label}>ຮັບປະກັນ{warrantyInfo ? " (ຄິດຈາກບິນ)" : ""}</label>
                    <div className="flex gap-1.5">
                      {[["in", "ໃນປະກັນ"], ["out", "ນອກປະກັນ"]].map(([v, l]) => (
                        <button key={v} type="button" onClick={() => setWarranty(warranty === v ? "" : v)} className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${warranty === v ? "bg-brand-700 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"}`}>{l}</button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ③ ອາໄຫຼ່/ສິນຄ້າ ທີ່ຕ້ອງการปเปลี่ยน (ic_inventory) */}
          {(isB || type === "A") && (
            <div className={card}>
              <p className={label}>③ ອາໄຫຼ່/ສິນຄ້າ ທີ່ຕ້ອງການປ່ຽນ (ic_inventory)</p>
              {replacement ? (
                <div className="flex items-start gap-2 rounded-lg border border-brand-200 bg-brand-50/60 px-3 py-2 text-xs">
                  <span className="mt-0.5 shrink-0 rounded bg-white px-1.5 py-0.5 font-mono font-bold text-brand">{replacement.code}</span>
                  <span className="min-w-0 flex-1 text-slate-700">{replacement.name}</span>
                  <button type="button" onClick={() => setReplacement(null)} className="shrink-0 text-slate-400 hover:text-brand-orange-700"><X className="size-4" /></button>
                </div>
              ) : (
                <button type="button" onClick={() => setInvOpen(true)} className={`${field} flex items-center gap-2 text-left text-slate-400 hover:border-brand-600`}>
                  <Search className="size-4" /> ຄົ້ນ ອາໄຫຼ່/ສິນຄ້າ
                </button>
              )}
            </div>
          )}

          <div className={card}>
            <label className={label}>{isB ? "ອາການ / ບັນຫາ *" : "ເຫດຜົນ / ໝາຍເຫตุ"}</label>
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} placeholder={isB ? "ອາການເສຍ / ບັນຫາຂອງສິນຄ້າ" : ""} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-600" />
          </div>
        </div>
      </div>

      {error && <p className="text-xs font-semibold text-brand-orange-700">{error}</p>}

      <div className="flex justify-end gap-2">
        <button type="button" onClick={() => router.push(claimPagePath(type))} className="h-10 rounded-lg border border-slate-200 px-4 text-sm font-semibold text-slate-600 hover:bg-slate-50">ຍົກເລີກ</button>
        {/* C ບໍ່ມີເລກງານ = ກົດບໍ່ໄດ້ (server ກໍ່ປະຕິເສດ — ຢ່າໃຫ້ຄົນຕື່ມຟອມຈົນຈົບກ່ອນຮູ້) */}
        <button type="button" disabled={pending || (isC && !refJob)} onClick={submit} className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-brand-700 px-5 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-60">
          {pending && <LoaderCircle className="size-4 animate-spin" />} ເປີດໃບເຄມ
        </button>
      </div>

      <JobPickerModal open={jobOpen} onClose={() => setJobOpen(false)} onPick={pickJob} />
      <SearchPickerModal<ClaimBill>
        open={billOpen} onClose={() => setBillOpen(false)} onPick={pickBill}
        title="ເລືອກເລກບິນຂາຍ (ERP)" subtitle="ຄົ້ນ ເລກບິນ · ລະຫัส/ຊື່ລູກຄ້າ" placeholder="ຄົ້ນ ເລກບິນ / ລູກຄ້າ"
        search={async (q) => (await findBills(q)).bills ?? []} keyOf={(b) => b.doc_no}
        renderItem={(b) => (
          <span className="block">
            <span className="flex items-center justify-between"><span className="font-mono text-sm font-bold text-brand">{b.doc_no}</span><span className="text-[11px] text-slate-400">{b.doc_date}</span></span>
            <span className="block truncate text-[11px] text-slate-500">{b.cust_name || b.cust_code} · ฿{b.total.toLocaleString()}</span>
          </span>
        )}
      />
      <SearchPickerModal<InvItem>
        open={invOpen} onClose={() => setInvOpen(false)} onPick={(it) => { setReplacement(it); if (it.brand) setBrand((b) => b || it.brand!); setInvOpen(false); }}
        title="ຄົ້ນ ອາໄຫຼ່/ສິນຄ້າ (ic_inventory)" placeholder="ຄົ້ນ ລະຫັດ / ຊື່ສິນຄ້າ"
        search={async (q) => (await findInventory(q)).items ?? []} keyOf={(it) => it.code}
        renderItem={(it) => (
          <span className="block"><span className="font-mono text-xs font-bold text-brand">{it.code}</span><span className="block truncate text-sm text-slate-700">{it.name}</span></span>
        )}
      />
    </div>
  );
}
