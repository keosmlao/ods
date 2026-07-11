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

  const suggestion = warrantyFromBill(billDate);
  // ຄຳນວນຕອນ render — ບໍ່ຕ້ອງ setState ໃນ effect
  const suggestedWarranty = suggestion ? (suggestion.inWarranty ? "ຮັບປະກັນ" : "ໝົດຮັບປະກັນ") : "ຮັບປະກັນ";
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
          {pending ? "ກຳລັງບັນທຶກ..." : "ບັນທຶກ ແລະ ພິມໃບຮັບ"}
        </button>
        <Link href="/service" className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#DE3163] px-4 text-sm font-semibold text-white transition hover:opacity-90">
          <LogOut className="size-4" />
          ອອກ
        </Link>
        <button type="reset" onClick={resetAll} className="inline-flex h-10 items-center gap-2 rounded-lg bg-sky-500 px-4 text-sm font-semibold text-white transition hover:bg-sky-600">
          <RotateCcw className="size-4" />
          ລ້າງ
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
              ລູກຄ້າ
            </h2>
            <ServiceCustomer selected={customer} onSelect={setCustomer} buyer={scanned?.buyer ?? null} />
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 flex items-center gap-2 border-b border-slate-100 pb-2 font-bold text-slate-700">
              <span className="grid size-6 place-items-center rounded-full bg-slate-800 text-xs text-white">2</span>
              ສິນຄ້າ
            </h2>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className={label}>
                  ຊື່ເຄື່ອງ *{" "}
                  <span className="text-xs text-slate-400">
                    {customer
                      ? loadingProducts
                        ? "(ກຳລັງດຶງສິນຄ້າທີ່ລູກຄ້າຊື້ໄປ...)"
                        : products.length
                          ? `(ຊື້ໄປ ${products.length} ລາຍການ — ຫຼືພິມຄົ້ນຫາໃນ ERP / ສ້າງໃໝ່)`
                          : "(ບໍ່ມີປະຫວັດຊື້ — ພິມຄົ້ນຫາໃນ ERP ຫຼືສ້າງໃໝ່)"
                      : "(ພິມຄົ້ນຫາໃນ ERP ຫຼືສ້າງໃໝ່)"}
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
              </div>

              <div className="sm:col-span-2">
                <label className={label}>
                  Serial Number (SN){" "}
                  <span className="text-xs text-slate-400">
                    {product
                      ? loadingSerials
                        ? "(ກຳລັງດຶງ...)"
                        : serials.length
                          ? `(ຂາຍໃຫ້ລູກຄ້ານີ້ ${serials.length} ໜ່ວຍ — ຫຼືພິມເອງ, ຫວ່າງໄດ້)`
                          : "(ບໍ່ພົບ ISN ຂອງລູກຄ້ານີ້ — ພິມເອງ ຫຼືປະຫວ່າງໄວ້)"
                      : "(ບໍ່ມີກໍປະຫວ່າງໄວ້ໄດ້)"}
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
                <label className={label}>ປະເພດສິນຄ້າ *</label>
                <SelectField
                  name="pro_type"
                  value={productType}
                  onChange={setProductType}
                  options={types.map((item) => ({ value: item.code, label: item.name_1 }))}
                  placeholder="ຄົ້ນຫາປະເພດ..."
                />
              </div>

              <div>
                <label className={label}>ຫຍີ່ຫໍ້ *</label>
                <SelectField
                  name="pro_brand"
                  value={brand}
                  onChange={setBrand}
                  options={brands.map((item) => ({ value: item.code, label: item.name_1 }))}
                  placeholder="ຄົ້ນຫາຫຍີ່ຫໍ້..."
                />
              </div>

              <div>
                <label className={label}>ອຸປະກອນທີ່ນຳມາ</label>
                <input name="pro_acc" className={field} placeholder="ສາຍໄຟ, ລີໂມດ..." />
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 flex items-center gap-2 border-b border-slate-100 pb-2 font-bold text-slate-700">
              <span className="grid size-6 place-items-center rounded-full bg-slate-800 text-xs text-white">3</span>
              ບິນຊື້ ແລະ ການຮັບປະກັນ
            </h2>

            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label className={label}>ລະຫັດຮ້ານຄ້າ</label>
                <input name="sup_id" className={field} />
              </div>
              <div>
                <label className={label}>ເລກທີບິນ</label>
                <input name="billon" value={billNo} onChange={(event) => setBillNo(event.target.value)} className={field} />
              </div>
              <div>
                <label className={label}>ວັນທີບິນ</label>
                <input
                  name="billdate"
                  type="date"
                  value={billDate}
                  onChange={(event) => { setBillDate(event.target.value); setWarrantyChoice(null); }}
                  className={field}
                />
              </div>

              <div className="sm:col-span-3">
                <label className={label}>ການຮັບປະກັນ *</label>
                <SelectField
                  name="pro_wa"
                  value={warranty}
                  onChange={setWarrantyChoice}
                  options={[
                    { value: "ຮັບປະກັນ", label: "ຮັບປະກັນ" },
                    { value: "ໝົດຮັບປະກັນ", label: "ໝົດຮັບປະກັນ" },
                  ]}
                />

                {suggestion && (
                  <p
                    className={`mt-2 flex items-start gap-2 rounded-lg p-2 text-xs ${
                      suggestion.inWarranty ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800"
                    }`}
                  >
                    <ShieldCheck className="mt-0.5 size-4 shrink-0" />
                    <span>
                      ຊື້ມາແລ້ວ <b>{suggestion.months} ເດືອນ</b> — ຕາມມາດຕະຖານ {WARRANTY_MONTHS} ເດືອນ ຄວນເປັນ{" "}
                      <b>{suggestion.inWarranty ? "ຮັບປະກັນ" : "ໝົດຮັບປະກັນ"}</b>
                      {warrantyTouched && " (ທ່ານເລືອກເອງແລ້ວ)"}
                    </span>
                  </p>
                )}
                <p className="mt-1 text-xs text-slate-400">
                  ຕົວເລືອກນີ້ຕັດສິນວ່າວຽກຈະໄປທາງ &quot;ສ້ອມເລີຍ&quot; ຫຼື &quot;ຕ້ອງສະເໜີລາຄາກ່ອນ&quot;
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 flex items-center gap-2 border-b border-slate-100 pb-2 font-bold text-slate-700">
              <span className="grid size-6 place-items-center rounded-full bg-slate-800 text-xs text-white">4</span>
              ອາການ ແລະ ຜູ້ຮັບຜິດຊອບ
            </h2>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className={label}>ອາການເບື້ອງຕົ້ນ *</label>
                <textarea name="pro_issue" required rows={2} autoFocus={Boolean(scanned)} className={`${field} h-auto py-2`} placeholder="ລູກຄ້າແຈ້ງວ່າ..." />
              </div>
              <div className="sm:col-span-2">
                <label className={label}>ໝາຍເຫດ</label>
                <input name="pro_remark" className={field} placeholder="ຮອຍຂູດ, ອຸປະກອນຂາດ..." />
              </div>

              <div>
                <label className={label}>ຊ່າງ *</label>
                <SelectField
                  name="emp"
                  options={techs.map((tech) => ({ value: tech.code, label: tech.name_1 }))}
                  placeholder="ຄົ້ນຫາຊ່າງ..."
                />
              </div>

              <div>
                <label className={label}>ປະເພດບໍລິການ *</label>
                <SelectField
                  name="service_type"
                  options={[
                    { value: "CI", label: "ລູກຄ້ານຳເຄື່ອງເຂົ້າ" },
                    { value: "PS", label: "ໄປຮັບບ້ານລູກຄ້າ" },
                    { value: "IH", label: "ສ້ອມບ້ານລູກຄ້າ" },
                    { value: "ST", label: "ສ້ອມເຄື່ອງໃນສາງ" },
                  ]}
                />
              </div>

              <div className="sm:col-span-2">
                <label className={label}>ການຈັດສົ່ງຄືນ *</label>
                <SelectField
                  name="pro_deli"
                  defaultValue="2"
                  options={[
                    { value: "1", label: "ໂອດ້ຽນຈັດສົ່ງ" },
                    { value: "2", label: "ລູກຄ້າຮັບເອງ" },
                  ]}
                />
              </div>
            </div>
          </section>
        </div>

        {/* ຂວາ — ຮູບ (ຄ້າງໄວ້ ເລື່ອນຕາມ) */}
        <aside className="lg:sticky lg:top-40 lg:self-start">
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 border-b border-slate-100 pb-2 font-bold text-slate-700">ຮູບສິນຄ້າ</h2>
            <ServicePhotos />
            <p className="mt-3 rounded-lg bg-slate-50 p-2 text-xs text-slate-500">
              ຄວນຖ່າຍ: ສະພາບເຄື່ອງຕອນຮັບເຂົ້າ, ປ້າຍ SN, ຈຸດທີ່ເສຍ, ອຸປະກອນທີ່ນຳມາ
            </p>
          </section>
        </aside>
      </div>
    </form>
  );
}
