"use client";
import { createService } from "@/app/actions/service";
import { ServiceCustomer, type Customer } from "@/components/service-customer";
import { ProductPicker, type Product } from "@/components/product-picker";
import { SerialPicker, type Serial } from "@/components/serial-picker";
import { ServicePhotos } from "@/components/service-photos";
import { SelectField } from "@/components/select-field";
import type { ScanResult } from "@/components/service-scan";
import { AlertTriangle, LoaderCircle, LogOut, RotateCcw, Save, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { LocationPicker, type Point } from "@/components/installation/location-picker";
import { ONSITE_SERVICE_TYPES } from "@/lib/sla";
import { useDict } from "@/lib/i18n/context";
import { useActionState, useEffect, useState } from "react";

type Option = { code: string; name_1: string };
export type ServicePrefill = { proname?: string; sn?: string; billon?: string; billdate?: string };

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
  const [customer, setCustomer] = useState<Customer | null>(null);

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
  /** ພິກັດໜ້າງານ (ບໍ່ບັງຄັບ) — ຊ່າງກົດນຳທາງໄດ້ຈາກແອັບ */
  const [point, setPoint] = useState<Point | null>(null);

  /** IH ສ້ອມບ້ານລູກຄ້າ · PS ໄປຮັບເຄື່ອງຈາກບ້ານມາສ້ອມຢູ່ສູນ ⇒ ຊ່າງອອກໜ້າງານ (ນິຍາມດຽວກັບ lib/sla) */
  const onsite = ONSITE_SERVICE_TYPES.includes(serviceType as "IH" | "PS");

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
  }

  return (
    <form action={action} className="space-y-5">
      {/* ແຖບປຸ່ມ ຄ້າງຢູ່ເທິງ */}
      <div className="sticky top-20 z-20 flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white/95 p-3 shadow-sm backdrop-blur">
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
                <label className={label}>{t.tech} *</label>
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
        <aside className="lg:sticky lg:top-40 lg:self-start">
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
