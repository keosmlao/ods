"use client";
import { createService } from "@/app/actions/service";
import { ServiceCustomer, type Customer } from "@/components/service-customer";
import { ProductPicker, type Product } from "@/components/product-picker";
import { RepairHistory } from "@/components/service/repair-history";
import { SerialPicker, type Serial } from "@/components/serial-picker";
import { ServicePhotos } from "@/components/service-photos";
import { SelectField } from "@/components/select-field";
import type { ScanResult } from "@/components/service-scan";
import { AlertTriangle, LoaderCircle, LogOut, RotateCcw, Save, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { LocationPicker, type Point } from "@/components/installation/location-picker";
import { ONSITE_SERVICE_TYPES } from "@/lib/sla";
import { useDict } from "@/lib/i18n/context";
import { REPAIR_CENTER_LABEL, REPAIR_CENTERS } from "@/lib/repair-center";
import { useActionState, useEffect, useState } from "react";

type Option = { code: string; name_1: string };
export type ServicePrefill = {
  proname?: string; sn?: string; billon?: string; billdate?: string; claim?: string;
  kind?: "repair" | "claim";
  /** ລູກຄ້າ prefill (ຈາກໃບເຄມ → ເປີດໃບສ້ອມ) — cust=ລະຫັດ ODS */
  cust?: string; custname?: string; custtel?: string; custaddr?: string;
};

const field = "h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100";
const label = "mb-1 block text-sm text-slate-600";

/** ໄລຍະຮັບປະກັນມາດຕະຖານ — ERP ມີຄໍລຳ warranty_monthy ແຕ່ເປັນ NULL ທຸກແຖວ ຈຶ່ງໃຊ້ຄ່ານີ້ແທນ */
const WARRANTY_MONTHS = 12;

/** ຄຳນວນຈາກວັນທີບິນ: ຊື້ມາດົນເທົ່າໃດ ແລະ ຍັງຢູ່ໃນປະກັນບໍ */
function warrantyFromBill(billDate: string) {
  if (!billDate) return null;
  const bought = new Date(billDate);
  if (Number.isNaN(bought.getTime())) return null;
  const months = (Date.now() - bought.getTime()) / (1000 * 60 * 60 * 24 * 30.44);
  if (months < 0) return null;
  return { months: Math.floor(months), inWarranty: months <= WARRANTY_MONTHS };
}

export function ServiceForm({
  types,
  brands,
  techs,
  prefill = {},
  scanned = null,
}: {
  types: Option[];
  brands: Option[];
  techs: { code: string; name_1: string; department?: string }[];
  prefill?: ServicePrefill;
  /** ຄ່າທີ່ໄດ້ຈາກການຍິງບາໂຄດ — ຕື່ມໃຫ້ ແຕ່ແກ້ໄດ້ໝົດ */
  scanned?: ScanResult | null;
}) {
  const t = useDict().serviceForm;
  const [state, action, pending] = useActionState(createService, {});
  const [customer, setCustomer] = useState<Customer | null>(
    prefill.cust
      ? { code: prefill.cust, name_1: prefill.custname ?? prefill.cust, tel: prefill.custtel ?? "", address: prefill.custaddr ?? "", ref_code: prefill.cust, source: "ods" }
      : null,
  );

  const [productQuery, setProductQuery] = useState(scanned?.product ?? prefill.proname ?? "");
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [product, setProduct] = useState<Product | null>(null);

  const [serialQuery, setSerialQuery] = useState(scanned?.sn ?? prefill.sn ?? "");
  const [serials, setSerials] = useState<Serial[]>([]);
  const [loadingSerials, setLoadingSerials] = useState(false);
  const [, setSerial] = useState<Serial | null>(null);

  // ຊ່ອງທີ່ ERP ຕື່ມໃຫ້ ແຕ່ຍັງແກ້ໄດ້ເອງ
  const [model, setModel] = useState(scanned?.model ?? "");
  const [brand, setBrand] = useState(scanned?.brand ?? "");
  const [productType, setProductType] = useState(scanned?.productType ?? "");
  const [billNo, setBillNo] = useState(scanned?.billNo ?? prefill.billon ?? "");
  const [billDate, setBillDate] = useState(scanned?.billDate ?? prefill.billdate ?? "");
  /** ຄ່າທີ່ພະນັກງານເລືອກເອງ — null ຄື "ຍັງບໍ່ໄດ້ແຕະ, ໃຫ້ໃຊ້ຄ່າທີ່ແນະນຳ" */
  const [warrantyChoice, setWarrantyChoice] = useState<string | null>(null);

  /**
   * ປະເພດບໍລິການ — ຕ້ອງເປັນ state ເພາະ **ງານນອກສະຖານທີ່ (IH/PS) ຕ້ອງມີສະຖານທີ່ໜ້າງານ**
   * (75% ຂອງໃບ). ແຕ່ກ່ອນ tb_product ບໍ່ມີຖັນນີ້ ⇒ ຊ່າງອາໄສທີ່ຢູ່ລູກຄ້າ ເຊິ່ງອາດເປັນ
   * ທີ່ຢູ່ຮ້ານ ບໍ່ແມ່ນບ່ອນທີ່ເຄື່ອງຕິດຢູ່.
   */
  const [serviceType, setServiceType] = useState("");
  /** ບ່ອນຮັບເຄື່ອງ — ຄ່າຕັ້ງຕົ້ນຈາກສູນທີ່ຜູ້ໃຊ້ຮັບເຄື່ອງຫຼ້າສຸດ (ຈື່ໄວ້ໃນ browser) */
  const [intakeCenter, setIntakeCenter] = useState("");
  const [jobKind, setJobKind] = useState<"repair" | "claim">(prefill.kind === "claim" ? "claim" : "repair");
  const [claimScope, setClaimScope] = useState<"whole" | "part">("whole");
  /** ພິກັດໜ້າງານ (ບໍ່ບັງຄັບ) — ຊ່າງກົດນຳທາງໄດ້ຈາກແອັບ */
  const [point, setPoint] = useState<Point | null>(null);

  /** IH ສ້ອມບ້ານລູກຄ້າ · PS ໄປຮັບເຄື່ອງຈາກບ້ານມາສ້ອມຢູ່ສູນ ⇒ ຊ່າງອອກໜ້າງານ (ນິຍາມດຽວກັບ lib/sla) */
  const onsite = ONSITE_SERVICE_TYPES.includes(serviceType as "IH" | "PS");

  /**
   * ── ງານເຄມ ⇒ ຕັ້ງປະເພດບໍລິການເປັນ **CI (ລູກຄ້ານຳເຄື່ອງເຂົ້າ)** ໃຫ້ ──
   * ເຄມເກືອບທັງໝົດຄືຮ້ານຄ້າ/ລູກຄ້າຫອບເຄື່ອງມາເອງ ⇒ ບໍ່ມີພິກັດໜ້າງານ ບໍ່ມີວັນນັດ ບໍ່ຕ້ອງ
   * check-in. ຖ້າປະໄວ້ຫວ່າງ ຄົນຮັບເຄື່ອງມັກເລືອກ IH/PS ຕິດມືມາຈາກໃບກ່ອນ ແລ້ວຟອມຈະ
   * **ບັງຄັບສະຖານທີ່ໜ້າງານ** ທັງທີ່ບໍ່ມີ ⇒ ບັນທຶກບໍ່ໄດ້.
   * ຍັງປ່ຽນເປັນ PS ໄດ້ ຖ້າໄປຮັບເຄື່ອງເຄມເຖິງບ້ານ/ຮ້ານ (ບໍ່ໄດ້ລັອກ).
   */
  const pickClaim = () => {
    setJobKind("claim");
    if (!serviceType || ONSITE_SERVICE_TYPES.includes(serviceType as "IH" | "PS")) setServiceType("CI");
  };


  const suggestion = warrantyFromBill(billDate);
  // ຄຳນວນຕອນ render — ບໍ່ຕ້ອງ setState ໃນ effect
  // ບໍ່ມີວັນທີບິນ = ຢືນຢັນສິດປະກັນອັດຕະໂນມັດບໍ່ໄດ້.
  // ປະໄວ້ຫວ່າງເພື່ອບັງຄັບໃຫ້ພະນັກງານກວດຫຼັກຖານ ແລະເລືອກເອງ.
  const suggestedWarranty = suggestion ? (suggestion.inWarranty ? "ຮັບປະກັນ" : "ໝົດຮັບປະກັນ") : "";
  const warranty = warrantyChoice ?? suggestedWarranty;
  const warrantyTouched = warrantyChoice !== null;

  // ພໍເລືອກລູກຄ້າ → ດຶງສິນຄ້າທີ່ລູກຄ້າຄົນນັ້ນຊື້ໄປ (ic_trans_detail) ຂຶ້ນມາໃຫ້ເລືອກເລີຍ
  const custRef = customer?.ref_code ?? "";
  useEffect(() => {
    if (!custRef) return;
    let cancelled = false;

    async function load() {
      setLoadingProducts(true);
      try {
        const rows = await (await fetch(`/api/products?customer=${encodeURIComponent(custRef)}`)).json();
        if (!cancelled) setProducts(rows);
      } catch {
        if (!cancelled) setProducts([]);
      } finally {
        if (!cancelled) setLoadingProducts(false);
      }
    }
    load();

    return () => { cancelled = true; };
  }, [custRef]);

  // ພໍເລືອກສິນຄ້າ → ດຶງ SN/ISN ຂອງສິນຄ້ານັ້ນຈາກ sn_inventory ຂຶ້ນມາໃຫ້ເລືອກເລີຍ
  const itemCode = product?.item_code ?? "";
  useEffect(() => {
    if (!itemCode || !custRef) return;
    let cancelled = false;

    async function load() {
      setLoadingSerials(true);
      try {
        const url = `/api/serials?customer=${encodeURIComponent(custRef)}&item_code=${encodeURIComponent(itemCode)}`;
        const rows = await (await fetch(url)).json();
        if (!cancelled) setSerials(rows);
      } catch {
        if (!cancelled) setSerials([]);
      } finally {
        if (!cancelled) setLoadingSerials(false);
      }
    }
    load();

    return () => { cancelled = true; };
  }, [itemCode, custRef]);

  function pickProduct(picked: Product) {
    setProduct(picked);
    setProductQuery(picked.item_name);
    setProducts([]);
    setSerial(null);
    setSerialQuery("");
    setModel(picked.model);
    setBrand(picked.brand);
    setProductType(picked.product_type || "");
    setBillNo(picked.doc_no);
    setBillDate(picked.doc_date);
    setWarrantyChoice(null); // ບິນໃໝ່ → ກັບໄປໃຊ້ຄ່າທີ່ແນະນຳ
  }

  function resetAll() {
    setCustomer(null);
    setProductQuery(""); setProducts([]); setProduct(null);
    setSerialQuery(""); setSerials([]); setSerial(null);
    setModel(""); setBrand(""); setProductType(""); setBillNo(""); setBillDate("");
    setWarrantyChoice(null);
    setJobKind("repair");
    setClaimScope("whole");
  }

  return (
    <form action={action} className="space-y-5">
      {/* ແຖບປຸ່ມ ຄ້າງຢູ່ເທິງ */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <button
          disabled={pending}
          className="inline-flex h-10 items-center gap-2 rounded-lg bg-emerald-600 px-5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
        >
          {pending ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />}
          {pending ? t.saving : t.saveAndPrint}
        </button>
        <Link href="/service" className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#DE3163] px-4 text-sm font-semibold text-white transition hover:opacity-90">
          <LogOut className="size-4" />
          {t.exit}
        </Link>
        <button type="reset" onClick={resetAll} className="inline-flex h-10 items-center gap-2 rounded-lg bg-sky-500 px-4 text-sm font-semibold text-white transition hover:bg-sky-600">
          <RotateCcw className="size-4" />
          {t.clear}
        </button>
      </div>

      {state.error && (
        <p className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertTriangle className="size-4 shrink-0" />
          {state.error}
        </p>
      )}

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="mb-2 text-sm font-bold text-slate-700">ປະເພດງານ *</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <button type="button" onClick={() => setJobKind("repair")} className={`rounded-xl border p-3 text-left ${jobKind === "repair" ? "border-teal-500 bg-teal-50 ring-2 ring-teal-100" : "border-slate-200"}`}>
            <b className="block text-sm">🔧 ງານສ້ອມ</b>
            <span className="text-xs text-slate-500">ຮັບເຄື່ອງເຂົ້າກວດ ແລະສ້ອມຕາມປົກກະຕິ</span>
          </button>
          <button type="button" onClick={() => pickClaim()} className={`rounded-xl border p-3 text-left ${jobKind === "claim" ? "border-violet-500 bg-violet-50 ring-2 ring-violet-100" : "border-slate-200"}`}>
            <b className="block text-sm">🛡️ ງານເຄມ</b>
            <span className="text-xs text-slate-500">ລູກຄ້າຂໍປ່ຽນສິນຄ້າ/ອາໄຫຼ່; ສ້າງ CLM-B ອັດຕະໂນມັດ</span>
          </button>
        </div>
        <input type="hidden" name="job_kind" value={jobKind} />
        {jobKind === "claim" && (
          <div className="mt-3 rounded-xl border border-violet-200 bg-violet-50/50 p-3">
            <p className="mb-2 text-xs font-bold text-violet-800">ລູກຄ້າສົ່ງມາເຄມຫຍັງ?</p>
            {/* ບອກວ່າຟອມຕັ້ງປະເພດບໍລິການໃຫ້ແລ້ວ — ບໍ່ດັ່ງນັ້ນຄົນຮັບເຄື່ອງບໍ່ຮູ້ວ່າມັນປ່ຽນ */}
            <p className="mb-2 text-[11px] text-violet-700">{t.claimServiceHint}</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => setClaimScope("whole")} className={`rounded-lg px-3 py-2 text-xs font-semibold ${claimScope === "whole" ? "bg-violet-600 text-white" : "border border-violet-200 bg-white text-violet-700"}`}>ເຄມທັງເຄື່ອງ</button>
              <button type="button" onClick={() => setClaimScope("part")} className={`rounded-lg px-3 py-2 text-xs font-semibold ${claimScope === "part" ? "bg-violet-600 text-white" : "border border-violet-200 bg-white text-violet-700"}`}>ເຄມສະເພາະອາໄຫຼ່</button>
            </div>
            <input type="hidden" name="claim_scope" value={claimScope} />
            {claimScope === "part" && (
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <input name="claim_part_code" placeholder="ລະຫັດອາໄຫຼ່ (ຖ້າມີ)" className={field} />
                <input name="claim_part_name" required placeholder="ຊື່ອາໄຫຼ່ *" className={field} />
                <input name="claim_part_sn" placeholder="Serial ອາໄຫຼ່ (ຖ້າມີ)" className={field} />
                <input name="claim_part_qty" type="number" min="0.01" step="0.01" defaultValue="1" required placeholder="ຈຳນວນ" className={field} />
              </div>
            )}
          </div>
        )}
      </section>

      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        {/* ຊ້າຍ — ຂໍ້ມູນ */}
        <div className="space-y-5">
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 flex items-center gap-2 border-b border-slate-100 pb-2 font-bold text-slate-700">
              <span className="grid size-6 place-items-center rounded-full bg-slate-800 text-xs text-white">1</span>
              {t.customer}
            </h2>
            <ServiceCustomer selected={customer} onSelect={setCustomer} buyer={scanned?.buyer ?? null} />
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 flex items-center gap-2 border-b border-slate-100 pb-2 font-bold text-slate-700">
              <span className="grid size-6 place-items-center rounded-full bg-slate-800 text-xs text-white">2</span>
              {t.productSection}
            </h2>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className={label}>
                  {t.productName} *{" "}
                  <span className="text-xs text-slate-400">
                    {customer
                      ? loadingProducts
                        ? t.loadingCustomerProducts
                        : products.length
                          ? `(${t.boughtCountPrefix} ${products.length} ${t.boughtCountSuffix})`
                          : t.noPurchaseHistory
                      : t.searchErpHint}
                  </span>
                </label>
                <ProductPicker
                  products={products}
                  customerRef={custRef}
                  value={productQuery}
                  onPick={pickProduct}
                  onType={(text) => { setProductQuery(text); setProduct(null); }}
                  isLoading={loadingProducts}
                />
                <input type="hidden" name="proname" value={productQuery} />
                {/* ຜູກກັບໃບເຄມ — ຖ້າໃບງານນີ້ເປີດຈາກ "ສ້ອມ" ຂອງ CLM (createService ຈະ set claim.ref_job) */}
                <input type="hidden" name="claim" value={prefill.claim ?? ""} />
                {/**
                 * ລະຫັດສິນຄ້າ ERP — ຟອມນີ້ຄົ້ນ ERP ຢູ່ແລ້ວ ແຕ່ແຕ່ກ່ອນ **ຖິ້ມລະຫັດຖິ້ມ**
                 * ເກັບແຕ່ຊື່/ຮຸ່ນ/ຫຍີ່ຫໍ້. ຜົນຄື ໃບຮັບເຄື່ອງໄປຫາ ic_size / ic_design
                 * ຂອງ ERP ບໍ່ໄດ້ ⇒ ຄິດຄ່າບໍລິການ (ທີ່ແບ່ງຕາມຂະໜາດ/ແບບ) ບໍ່ໄດ້.
                 * ຫວ່າງໄດ້ — ສິນຄ້າທີ່ບໍ່ມີໃນ ERP (ພິມຊື່ເອງ) ຈະບໍ່ມີລະຫັດ.
                 */}
                <input type="hidden" name="item_code" value={product?.item_code ?? ""} />
              </div>

              <div className="sm:col-span-2">
                <label className={label}>
                  Serial Number (SN){" "}
                  <span className="text-xs text-slate-400">
                    {product
                      ? loadingSerials
                        ? t.loading
                        : serials.length
                          ? `(${t.soldCountPrefix} ${serials.length} ${t.soldCountSuffix})`
                          : t.noIsnFound
                      : t.snOptional}
                  </span>
                </label>
                <SerialPicker
                  serials={serials}
                  value={serialQuery}
                  isLoading={loadingSerials}
                  onPick={(picked) => { setSerial(picked); setSerialQuery(picked.isn || picked.sn); }}
                  onType={(text) => { setSerialQuery(text); setSerial(null); }}
                />
                <input type="hidden" name="pro_sn" value={serialQuery} />
              </div>

              {/* ປະຫວັດການສ້ອມຂອງ SN ນີ້ — ຂຶ້ນເອງເມື່ອໃສ່ SN (ຊ່ວຍວິເຄາະ · ກັນສ້ອມຊ້ຳ) */}
              <div className="sm:col-span-2">
                <RepairHistory sn={serialQuery} />
              </div>

              <div>
                <label className={label}>Model *</label>
                <input name="pro_model" required value={model} onChange={(event) => setModel(event.target.value)} className={field} />
              </div>

              <div>
                <label className={label}>{t.productType} *</label>
                <SelectField
                  name="pro_type"
                  value={productType}
                  onChange={setProductType}
                  options={types.map((item) => ({ value: item.code, label: item.name_1 }))}
                  placeholder={t.searchTypePlaceholder}
                />
              </div>

              <div>
                <label className={label}>{t.brand} *</label>
                <SelectField
                  name="pro_brand"
                  value={brand}
                  onChange={setBrand}
                  options={brands.map((item) => ({ value: item.code, label: item.name_1 }))}
                  placeholder={t.searchBrandPlaceholder}
                />
              </div>

              <div>
                <label className={label}>{t.accessories}</label>
                <input name="pro_acc" className={field} placeholder={t.accessoriesPlaceholder} />
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 flex items-center gap-2 border-b border-slate-100 pb-2 font-bold text-slate-700">
              <span className="grid size-6 place-items-center rounded-full bg-slate-800 text-xs text-white">3</span>
              {t.billAndWarranty}
            </h2>

            <div className="grid gap-4 sm:grid-cols-2">
              {/* ຊ່ອງ "ລະຫັດຮ້ານຄ້າ" ຖືກຖອດອອກ — ມັນຄືລະຫັດລູກຄ້າອັນດຽວກັນ (server ຂຽນ ap_code ໃຫ້ເອງ) */}
              <div>
                <label className={label}>{t.billNo}</label>
                <input name="billon" value={billNo} onChange={(event) => setBillNo(event.target.value)} className={field} />
              </div>
              <div>
                <label className={label}>{t.billDate}</label>
                <input
                  name="billdate"
                  type="date"
                  value={billDate}
                  onChange={(event) => { setBillDate(event.target.value); setWarrantyChoice(null); }}
                  className={field}
                />
              </div>

              <div className="sm:col-span-3">
                <label className={label}>{t.warrantyLabel} *</label>
                <SelectField
                  name="pro_wa"
                  value={warranty}
                  onChange={setWarrantyChoice}
                  options={[
                    { value: "ຮັບປະກັນ", label: "ຮັບປະກັນ" },
                    { value: "ໝົດຮັບປະກັນ", label: "ໝົດຮັບປະກັນ" },
                  ]}
                  placeholder={t.checkEvidencePlaceholder}
                />

                {suggestion && (
                  <p
                    className={`mt-2 flex items-start gap-2 rounded-lg p-2 text-xs ${
                      suggestion.inWarranty ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800"
                    }`}
                  >
                    <ShieldCheck className="mt-0.5 size-4 shrink-0" />
                    <span>
                      {t.boughtAgo} <b>{suggestion.months} {t.monthsUnit}</b> {t.perStandard} {WARRANTY_MONTHS} {t.monthsShouldBe}{" "}
                      <b>{suggestion.inWarranty ? "ຮັບປະກັນ" : "ໝົດຮັບປະກັນ"}</b>
                      {warrantyTouched && ` ${t.youChoseManually}`}
                    </span>
                  </p>
                )}
                {!suggestion && (
                  <p className="mt-2 flex items-start gap-2 rounded-lg bg-amber-50 p-2 text-xs text-amber-800">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                    <span>{t.noBillDateWarning}</span>
                  </p>
                )}
                <p className="mt-1 text-xs text-slate-400">
                  {t.warrantyDecisionNote}
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 flex items-center gap-2 border-b border-slate-100 pb-2 font-bold text-slate-700">
              <span className="grid size-6 place-items-center rounded-full bg-slate-800 text-xs text-white">4</span>
              {t.symptomsAndOwner}
            </h2>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className={label}>{t.initialSymptom} *</label>
                <textarea name="pro_issue" required rows={2} autoFocus={Boolean(scanned)} className={`${field} h-auto py-2`} placeholder={t.symptomPlaceholder} />
              </div>
              <div className="sm:col-span-2">
                <label className={label}>{t.remark}</label>
                <input name="pro_remark" className={field} placeholder={t.remarkPlaceholder} />
              </div>

              <div>
                {/* ຊ່າງບໍ່ບັງຄັບ — ຮັບເຄື່ອງກ່ອນ ຈັດຊ່າງພາຍຫຼັງໄດ້ (ເບິ່ງ actions/service.ts) */}
                <label className={label}>{t.tech}</label>
                <SelectField
                  name="emp"
                  options={techs.map((tech) => ({ value: tech.code, label: tech.name_1 }))}
                  placeholder={t.searchTechPlaceholder}
                />
              </div>

              <div>
                <label className={label}>{t.serviceTypeLabel} *</label>
                <SelectField
                  name="service_type"
                  value={serviceType}
                  onChange={setServiceType}
                  options={[
                    { value: "CI", label: t.serviceTypeCI },
                    { value: "PS", label: t.serviceTypePS },
                    { value: "IH", label: t.serviceTypeIH },
                    { value: "ST", label: t.serviceTypeST },
                  ]}
                />
              </div>

              {/*
                ── ບ່ອນຮັບເຄື່ອງ (ສູນມີ 2 ບ່ອນ: ຂົວຫຼວງ · ດອນຕີ້ວ) ──
                ເຄື່ອງໂອນຂ້າມສູນໄປສ້ອມໄດ້ ແຕ່ **ລູກຄ້າມາຮັບຄືນບ່ອນທີ່ຝາກໄວ້** ⇒ ຕ້ອງຈື່ໄວ້
                ຕັ້ງແຕ່ຕອນຮັບ ບໍ່ດັ່ງນັ້ນສ້ອມແລ້ວບໍ່ຮູ້ວ່າຈະສົ່ງກັບບ່ອນໃດ (ເບິ່ງ lib/job-center).
              */}
              <div>
                <label className={label}>{t.intakeCenterLabel}</label>
                <SelectField
                  name="intake_center"
                  value={intakeCenter}
                  onChange={setIntakeCenter}
                  placeholder={t.intakeCenterPlaceholder}
                  options={REPAIR_CENTERS.map((code) => ({ value: code, label: REPAIR_CENTER_LABEL[code] }))}
                />
              </div>

              {/* ── ນອກສະຖານທີ່ ⇒ ຕ້ອງຮູ້ວ່າ "ໄປໃສ" ແລະ "ໄປມື້ໃດ" (CI/ST ເຮັດຢູ່ສູນ ບໍ່ຕ້ອງ) ── */}
              {onsite && (
                <>
                  <div className="sm:col-span-2">
                    <label className={label}>{t.siteLocation} *</label>
                    <input
                      name="location_repair"
                      required
                      defaultValue={customer?.address ?? ""}
                      key={customer?.code ?? "none"}
                      placeholder={t.siteLocationPlaceholder}
                      className={field}
                    />
                    <p className="mt-1 text-xs text-slate-400">
                      {t.siteLocationNote}
                    </p>

                    {/* ພິກັດ (ບໍ່ບັງຄັບ) — ວາງລິງ Google Maps ໄດ້ ຫຼື ປັກໝຸດເອງ */}
                    <LocationPicker value={point} onChange={setPoint} />
                    <input type="hidden" name="location_lat" value={point ? String(point.lat) : ""} />
                    <input type="hidden" name="location_lng" value={point ? String(point.lng) : ""} />
                  </div>

                  <div>
                    <label className={label}>{t.appointDate}</label>
                    <input type="date" name="appoint_date" className={field} />
                    <p className="mt-1 text-xs text-slate-400">{t.appointDateNote}</p>
                  </div>
                </>
              )}

              <div className="sm:col-span-2">
                <label className={label}>{t.deliveryReturn} *</label>
                <SelectField
                  name="pro_deli"
                  defaultValue="2"
                  options={[
                    { value: "1", label: t.deliveryByOdien },
                    { value: "2", label: t.deliveryPickup },
                  ]}
                />
              </div>
            </div>
          </section>
        </div>

        {/* ຂວາ — ຮູບ (ຄ້າງໄວ້ ເລື່ອນຕາມ) */}
        <aside className="lg:self-start">
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 border-b border-slate-100 pb-2 font-bold text-slate-700">{t.productPhotos}</h2>
            <ServicePhotos />
            <p className="mt-3 rounded-lg bg-slate-50 p-2 text-xs text-slate-500">
              {t.photoHint}
            </p>
          </section>
        </aside>
      </div>
    </form>
  );
}
