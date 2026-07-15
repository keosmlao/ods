"use client";
import { createServiceFromNotice } from "@/app/actions/service";
import { ServiceCustomer, type Customer } from "@/components/service-customer";
import { ProductPicker, type Product } from "@/components/product-picker";
import { SerialPicker, type Serial } from "@/components/serial-picker";
import { ServicePhotos } from "@/components/service-photos";
import { SelectField } from "@/components/select-field";
import { LocationPicker, type Point } from "@/components/installation/location-picker";
import { ONSITE_SERVICE_TYPES } from "@/lib/sla";
import { AlertTriangle, LoaderCircle, LogOut, Save, ShieldCheck } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useActionState, useEffect, useState } from "react";

type Option = { code: string; name_1: string };

export type Notice = {
  code: string;
  creator_name: string;
  telephone: string;
  name_1: string;
  sn: string;
  issue: string;
  remark: string;
  noticed: string;
  p_brand: string;
  p_model: string;
  service_type: string;
  ref_code: string;
  cust_name: string;
  cust_address: string;
};

const field = "h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100";
const label = "mb-1 block text-sm text-slate-600";

/** ໄລຍະຮັບປະກັນມາດຕະຖານ — ຄືກັບໜ້າຮັບເຄື່ອງໂດຍພະນັກງານ */
const WARRANTY_MONTHS = 12;

function warrantyFromBill(billDate: string) {
  if (!billDate) return null;
  const bought = new Date(billDate);
  if (Number.isNaN(bought.getTime())) return null;
  const months = (Date.now() - bought.getTime()) / (1000 * 60 * 60 * 24 * 30.44);
  if (months < 0) return null;
  return { months: Math.floor(months), inWarranty: months <= WARRANTY_MONTHS };
}

/**
 * ຮັບໃບແຈ້ງສ້ອມອອນລາຍເຂົ້າເປັນງານ — ໃຊ້ໂຄງດຽວກັບໜ້າ "ຮັບເຄື່ອງໂດຍພະນັກງານ" (ServiceForm):
 * ເລືອກລູກຄ້າຈາກ ERP (ຫຼືສ້າງໃໝ່), ເລືອກສິນຄ້າ ERP ⇒ Model/ປະເພດ/ຫຍີ່ຫໍ້/item_code ຕື່ມໃຫ້ຄົບ,
 * ແລະ ງານນອກສະຖານທີ່ (IH/PS) ຕ້ອງມີສະຖານທີ່ໜ້າງານ. ຄ່າຕົ້ນມາຈາກໃບແຈ້ງ — ແກ້ໄດ້ໝົດ.
 */
export function ServiceNoticeForm({ notice, types, brands, techs, images }: {
  notice: Notice;
  types: Option[];
  brands: Option[];
  techs: { code: string; name_1: string; department?: string }[];
  images: Record<number, string>;
}) {
  const [state, action, pending] = useActionState(createServiceFromNotice, {});
  const noticeImages = Object.values(images).filter(Boolean);

  // ໃບແຈ້ງທີ່ຜູກກັບລູກຄ້າ ERP ຢູ່ແລ້ວ (ref_code) → ເລືອກໃຫ້ເລີຍ; ບໍ່ດັ່ງນັ້ນປະໃຫ້ພະນັກງານຄົ້ນ/ສ້າງ
  const [customer, setCustomer] = useState<Customer | null>(
    notice.ref_code
      ? {
          code: "",
          name_1: notice.cust_name || notice.creator_name,
          tel: notice.telephone,
          address: notice.cust_address,
          ref_code: notice.ref_code,
        }
      : null,
  );

  const [productQuery, setProductQuery] = useState(notice.name_1);
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [product, setProduct] = useState<Product | null>(null);

  const [serialQuery, setSerialQuery] = useState(notice.sn);
  const [serials, setSerials] = useState<Serial[]>([]);
  const [loadingSerials, setLoadingSerials] = useState(false);
  const [, setSerial] = useState<Serial | null>(null);

  const [model, setModel] = useState(notice.p_model);
  const [brand, setBrand] = useState(notice.p_brand);
  const [productType, setProductType] = useState("");
  const [billNo, setBillNo] = useState("");
  const [billDate, setBillDate] = useState("");
  const [warrantyChoice, setWarrantyChoice] = useState<string | null>(null);

  const [serviceType, setServiceType] = useState(notice.service_type || "");
  const [point, setPoint] = useState<Point | null>(null);

  const onsite = ONSITE_SERVICE_TYPES.includes(serviceType as "IH" | "PS");

  const suggestion = warrantyFromBill(billDate);
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
    setWarrantyChoice(null);
  }

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="ref_notice" value={notice.code} />

      <div className="sticky top-20 z-20 flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white/95 p-3 shadow-sm backdrop-blur">
        <button
          disabled={pending}
          className="inline-flex h-10 items-center gap-2 rounded-lg bg-emerald-600 px-5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
        >
          {pending ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />}
          {pending ? "ກຳລັງບັນທຶກ..." : "ບັນທຶກ"}
        </button>
        <Link href="/service/notices" className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#DE3163] px-5 text-sm font-semibold text-white transition hover:opacity-90">
          <LogOut className="size-4" />
          ອອກ
        </Link>
        <span className="ml-auto text-sm text-slate-500">ລະຫັດເເຈ້ງສ້ອມ: <b className="text-[#0536a9]">{notice.code}</b> · {notice.noticed}</span>
      </div>

      {state.error && (
        <p className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertTriangle className="size-4 shrink-0" />
          {state.error}
        </p>
      )}

      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <div className="space-y-5">
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 flex items-center gap-2 border-b border-slate-100 pb-2 font-bold text-slate-700">
              <span className="grid size-6 place-items-center rounded-full bg-slate-800 text-xs text-white">1</span>
              ລູກຄ້າ
            </h2>
            <ServiceCustomer
              selected={customer}
              onSelect={setCustomer}
              buyer={
                notice.ref_code
                  ? null
                  : { name: notice.creator_name || notice.cust_name, tel: notice.telephone, ods: null }
              }
            />
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
                <input type="hidden" name="item_code" value={product?.item_code ?? ""} />
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
              ຮ້ານຄ້າ / ບິນຊື້ ແລະ ການຮັບປະກັນ
            </h2>

            <div className="grid gap-4 sm:grid-cols-3">
              {/* ຊ່ອງ "ລະຫັດຮ້ານຄ້າ" ຖືກຖອດ — ຄືລະຫັດລູກຄ້າອັນດຽວກັນ (server ຂຽນ ap_code ໃຫ້) */}
              <div>
                <label className={label}>ຊື່ຮ້ານຄ້າ</label>
                <input name="sup_name" className={field} />
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
                <textarea name="pro_issue" required rows={2} defaultValue={notice.issue} className={`${field} h-auto py-2`} placeholder="ລູກຄ້າແຈ້ງວ່າ..." />
              </div>
              <div className="sm:col-span-2">
                <label className={label}>ໝາຍເຫດ</label>
                <input name="pro_remark" defaultValue={notice.remark} className={field} placeholder="ຮອຍຂູດ, ອຸປະກອນຂາດ..." />
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
                  value={serviceType}
                  onChange={setServiceType}
                  options={[
                    { value: "CI", label: "ລູກຄ້ານຳເຄື່ອງເຂົ້າ" },
                    { value: "PS", label: "ໄປຮັບບ້ານລູກຄ້າ" },
                    { value: "IH", label: "ສ້ອມບ້ານລູກຄ້າ" },
                    { value: "ST", label: "ສ້ອມເຄື່ອງໃນສາງ" },
                  ]}
                />
              </div>

              {/* ── ນອກສະຖານທີ່ ⇒ ຕ້ອງຮູ້ວ່າ "ໄປໃສ" ແລະ "ໄປມື້ໃດ" (CI/ST ເຮັດຢູ່ສູນ ບໍ່ຕ້ອງ) ── */}
              {onsite && (
                <>
                  <div className="sm:col-span-2">
                    <label className={label}>ສະຖານທີ່ໜ້າງານ *</label>
                    <input
                      name="location_repair"
                      required
                      defaultValue={customer?.address ?? notice.cust_address ?? ""}
                      key={customer?.code ?? "none"}
                      placeholder="ບ້ານ / ເມືອງ / ຈຸດສັງເກດ"
                      className={field}
                    />
                    <p className="mt-1 text-xs text-slate-400">
                      ຕື່ມມາຈາກທີ່ຢູ່ລູກຄ້າ — ແກ້ໄດ້ ຖ້າເຄື່ອງຢູ່ຄົນລະບ່ອນກັບທີ່ຢູ່ໃນລະບົບ
                    </p>

                    <LocationPicker value={point} onChange={setPoint} />
                    <input type="hidden" name="location_lat" value={point ? String(point.lat) : ""} />
                    <input type="hidden" name="location_lng" value={point ? String(point.lng) : ""} />
                  </div>

                  <div>
                    <label className={label}>ວັນນັດເຂົ້າສ້ອມ</label>
                    <input type="date" name="appoint_date" className={field} />
                    <p className="mt-1 text-xs text-slate-400">ຜູ້ຈັດຊ່າງປ່ຽນໄດ້ພາຍຫຼັງ</p>
                  </div>
                </>
              )}

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
        <aside className="lg:sticky lg:top-40 lg:self-start space-y-5">
          {/* ຮູບທີ່ລູກຄ້າແນບມາຕອນແຈ້ງ — ຍ້າຍມາເປັນຮູບຂອງງານໃຫ້ອັດຕະໂນມັດ (ສະແດງໃຫ້ເບິ່ງເທົ່ານັ້ນ) */}
          {noticeImages.length > 0 && (
            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="mb-1 border-b border-slate-100 pb-2 font-bold text-slate-700">ຮູບທີ່ລູກຄ້າແນບມາ</h2>
              <p className="mb-3 text-xs text-slate-400">{noticeImages.length} ຮູບ · ຈະຕິດໄປກັບງານໃຫ້ອັດຕະໂນມັດ</p>
              <div className="grid grid-cols-2 gap-2">
                {noticeImages.map((url) => (
                  <div key={url} className="aspect-square overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                    <Image
                      src={`/api/uploads/${encodeURIComponent(url)}`}
                      alt=""
                      width={160}
                      height={160}
                      unoptimized
                      className="size-full object-cover"
                    />
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 border-b border-slate-100 pb-2 font-bold text-slate-700">ຮູບພາບສິນຄ້າ (ເພີ່ມ)</h2>
            <ServicePhotos />
            <p className="mt-3 rounded-lg bg-slate-50 p-2 text-xs text-slate-500">
              ໃສ່ໄດ້ບໍ່ຈຳກັດຈຳນວນ — ຄວນຖ່າຍ: ສະພາບເຄື່ອງຕອນຮັບເຂົ້າ, ປ້າຍ SN, ຈຸດທີ່ເສຍ, ອຸປະກອນທີ່ນຳມາ
            </p>
          </section>
        </aside>
      </div>
    </form>
  );
}
