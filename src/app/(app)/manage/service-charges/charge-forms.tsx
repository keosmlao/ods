"use client";
import { deleteServiceCharge, saveAobConfig, saveServiceCharge } from "@/app/actions/service-charge";
import { type Option, optionsForCategory } from "@/app/actions/service-rate";
import { useConfirm } from "@/components/confirm-dialog";
import { Button, ErrorBox, inputClass } from "@/components/ui";
import { useDict } from "@/lib/i18n/context";
import { LoaderCircle, Plus, Trash2 } from "lucide-react";
import { useActionState, useState, useTransition } from "react";

/** ປະເພດບໍລິການ — ຄືກັບໜ້າອັດຕາຄ່າຄອມ (ຄ່າຢູ່ tb_product.service_type) */
const serviceTypes = (t: { stCI: string; stST: string; stIH: string; stPS: string }): Option[] => [
  { code: "CI", name: t.stCI }, { code: "ST", name: t.stST }, { code: "IH", name: t.stIH }, { code: "PS", name: t.stPS },
];

function Select({
  name, label, options, value, onChange, disabled, hint,
}: {
  name: string; label: string; options: Option[];
  value?: string; onChange?: (value: string) => void; disabled?: boolean; hint?: string;
}) {
  const t = useDict().serviceCharges;
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-slate-600">
        {label} <span className="text-slate-400">{hint ?? t.allHint}</span>
      </span>
      <select name={name} className={inputClass} value={value} disabled={disabled} onChange={(e) => onChange?.(e.target.value)}>
        <option value="">{t.all}</option>
        {options.map((o) => <option key={o.code} value={o.code}>{o.name}</option>)}
      </select>
    </label>
  );
}

/**
 * ຟອມເພີ່ມ/ແກ້ການຈັບຄູ່ — **ແບບ ແລະ ຂະໜາດ ກອງຕາມໝວດ** (ຄືໜ້າອັດຕາຄ່າຄອມ):
 * ERP ມີ 56 ແບບ · 489 ຂະໜາດ ລວມທຸກໝວດ ⇒ ບໍ່ກອງແລ້ວຄົນຈະຕັ້ງມິຕິທີ່ບໍ່ມີວັນຈັບຄູ່ໄດ້.
 */
export function AddChargeForm({
  categories,
  productTypes,
  services,
}: {
  categories: Option[];
  /** ປະເພດເຄື່ອງທີ່ໃຊ້ຈິງໃນໃບຮັບເຄື່ອງ (p_type) — **ມິຕິຫຼັກ** ຂອງການຈັບຄູ່ */
  productTypes: { code: string; name: string; jobs: number }[];
  services: { code: string; name: string }[];
}) {
  const t = useDict().serviceCharges;
  const fill = (text: string, vars: Record<string, number>) =>
    Object.entries(vars).reduce((out, [k, v]) => out.replaceAll(`{${k}}`, String(v)), text);
  const [state, action, pending] = useActionState(saveServiceCharge, {});
  const [category, setCategory] = useState("");
  const [designs, setDesigns] = useState<Option[]>([]);
  const [sizes, setSizes] = useState<Option[]>([]);
  const [loading, startLoad] = useTransition();
  const [service, setService] = useState("");

  function pickCategory(code: string) {
    setCategory(code);
    setDesigns([]);
    setSizes([]);
    if (!code) return;
    startLoad(async () => {
      const options = await optionsForCategory(code);
      setDesigns(options.designs);
      setSizes(options.sizes);
    });
  }

  return (
    <form action={action} className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="text-sm font-bold text-slate-700">{t.addTitle}</h2>
      {state.error && <ErrorBox>{state.error}</ErrorBox>}
      {state.ok && <p className="rounded-lg bg-brand-50 px-3 py-2 text-xs font-semibold text-brand-800">{state.ok}</p>}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {/**
          * ມິຕິຫຼັກ — ງານສ້ອມເກືອບບໍ່ມີ item_code ⇒ ໝວດ/ແບບ/ຂະໜາດ ຂອງ ERP ຈັບຄູ່ໄດ້ພຽງ
          * 0.7% ຂອງງານ. ອັນທີ່ມີທຸກໃບຄື p_type ຈາກໃບຮັບເຄື່ອງ (ເບິ່ງ lib/service-charge).
          */}
        <Select
          name="product_type"
          label={t.productType}
          options={productTypes.map((p) => ({ code: p.code, name: `${p.name} · ${p.jobs.toLocaleString()} ${t.jobsUnit}` }))}
          hint={t.productTypeHint}
        />
        <Select name="service_type" label={t.serviceType} options={serviceTypes(t)} />
        <Select name="category_code" label={t.category} options={categories} value={category} onChange={pickCategory} hint={t.categoryHint} />
        <Select
          name="design_code"
          label={t.design}
          options={designs}
          disabled={!category || loading}
          hint={!category ? t.pickCategoryFirst : loading ? t.loadingOptions : fill(t.designsCount, { n: designs.length })}
        />
        <Select
          name="size_code"
          label={t.size}
          options={sizes}
          disabled={!category || loading}
          hint={!category ? t.pickCategoryFirst : loading ? t.loadingOptions : fill(t.sizesCount, { n: sizes.length })}
        />

        <label className="block sm:col-span-2">
          <span className="mb-1 block text-xs text-slate-600">{t.serviceItem}</span>
          <select
            name="service_code"
            required
            className={inputClass}
            value={service}
            onChange={(e) => setService(e.target.value)}
          >
            <option value="">{t.pickService}</option>
            {services.map((s) => <option key={s.code} value={s.code}>{s.code} · {s.name}</option>)}
          </select>
          {/* ຊື່ໄປນຳ ⇒ ບິນເກົ່າຍັງອ່ານອອກ ເຖິງ ERP ຈະປ່ຽນຊື່ພາຍຫຼັງ */}
          <input type="hidden" name="service_name" value={services.find((s) => s.code === service)?.name ?? ""} />
        </label>

        <label className="block">
          <span className="mb-1 block text-xs text-slate-600">
            {t.price} <span className="text-slate-400">{t.priceHint}</span>
          </span>
          <input name="price_thb" type="number" step="0.01" min="0" defaultValue="0" className={inputClass} />
        </label>
      </div>

      <Button type="submit" disabled={pending}>
        {pending ? <LoaderCircle className="size-4 animate-spin" /> : <Plus className="size-4" />}
        {t.save}
      </Button>
    </form>
  );
}

/**
 * **ແກ້ແຖວທີ່ມີຢູ່** — ປ່ຽນ ລາຍການ/ລາຄາ ໄດ້ຢູ່ໃນຕາຕະລາງເລີຍ.
 *
 * ໃຊ້ `saveServiceCharge` ອັນເກົ່າ ໂດຍສົ່ງ **ມິຕິເດີມ**ໄປນຳ (hidden) — action ນັ້ນ
 * ຖືກອອກແບບໃຫ້ "ມິຕິຊ້ຳ = ທັບອັນເກົ່າ" ຢູ່ແລ້ວ ⇒ ບໍ່ຕ້ອງມີເສັ້ນທາງແກ້ໄຂອີກເສັ້ນ
 * (ໜ້ອຍໂຄດ ແລະ ບໍ່ມີທາງທີ່ສອງເສັ້ນຈະປະພຶດຕ່າງກັນ).
 */
export function EditChargeRow({
  row,
  services,
}: {
  row: {
    id: number;
    service_type: string | null;
    product_type: string | null;
    category_code: string | null;
    design_code: string | null;
    size_code: string | null;
    service_code: string;
    price_thb: number;
  };
  services: { code: string; name: string }[];
}) {
  const t = useDict().serviceCharges;
  const [state, action, pending] = useActionState(saveServiceCharge, {});
  const [service, setService] = useState(row.service_code);
  return (
    <form action={action} className="flex items-center gap-1.5">
      {/* ມິຕິເດີມ — ບອກ action ວ່າແກ້ແຖວໃດ */}
      <input type="hidden" name="service_type" value={row.service_type ?? ""} />
      <input type="hidden" name="product_type" value={row.product_type ?? ""} />
      <input type="hidden" name="category_code" value={row.category_code ?? ""} />
      <input type="hidden" name="design_code" value={row.design_code ?? ""} />
      <input type="hidden" name="size_code" value={row.size_code ?? ""} />
      <input type="hidden" name="service_name" value={services.find((s) => s.code === service)?.name ?? ""} />
      <select
        name="service_code"
        value={service}
        onChange={(e) => setService(e.target.value)}
        className="h-8 max-w-56 rounded-lg border border-slate-200 px-2 text-[11px] outline-none focus:border-brand-600"
        aria-label={t.serviceItem}
      >
        {services.map((s) => <option key={s.code} value={s.code}>{s.code} · {s.name}</option>)}
      </select>
      <input
        name="price_thb"
        type="number"
        step="0.01"
        min="0"
        defaultValue={row.price_thb}
        aria-label={t.price}
        className="h-8 w-24 rounded-lg border border-slate-200 px-2 text-right text-[11px] outline-none focus:border-brand-600"
      />
      <button
        type="submit"
        disabled={pending}
        className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-300 px-2.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
      >
        {pending ? <LoaderCircle className="size-3.5 animate-spin" /> : null}
        {t.save}
      </button>
      {state.error && <span className="text-[10px] font-semibold text-brand-orange-700">{state.error}</span>}
      {state.ok && <span className="text-[10px] font-semibold text-brand-800">✓</span>}
    </form>
  );
}

export function DeleteChargeButton({ id }: { id: number }) {
  const t = useDict().serviceCharges;
  const [pending, start] = useTransition();
  const { ask, dialog } = useConfirm();
  return (
    <>
      {dialog}
      <button
        type="button"
        disabled={pending}
        onClick={async () => {
          if (!(await ask({ title: t.deleteTitle, message: t.deleteMessage, tone: "danger" }))) return;
          const data = new FormData();
          data.set("id", String(id));
          start(() => void deleteServiceCharge(data));
        }}
        className="grid size-7 place-items-center rounded text-slate-300 hover:bg-brand-orange-50 hover:text-brand-orange-700 disabled:opacity-50"
        title={t.delete}
      >
        {pending ? <LoaderCircle className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
      </button>
    </>
  );
}

/**
 * ຕັ້ງຄ່າ **ໃບຕັ້ງໜີ້ຕ້ອງຮັບ (AOB)** — ລະຫັດບັນຊີຄູ່ທີ່ໃບເຄມ CLM-C ຈະລົງຢູ່ ERP.
 * ຫວ່າງ = ໃຊ້ຄ່າຕັ້ງຕົ້ນ 4010501 ລາຍຮັບຈາກການບໍລິການ. ເລກເອກະສານໃຊ້ **ລະຫັດໃບເຄມ** ສະເໝີ.
 */
export function AobConfigForm({ config }: { config: { account_code: string; account_name: string; branch_code: string } }) {
  const t = useDict().serviceCharges;
  const [state, action, pending] = useActionState(saveAobConfig, {});
  return (
    <form action={action} className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div>
        <h2 className="text-sm font-bold text-slate-700">{t.aobTitle}</h2>
        <p className="text-[11px] text-slate-400">{t.aobHint}</p>
      </div>
      {state.error && <ErrorBox>{state.error}</ErrorBox>}
      {state.ok && <p className="rounded-lg bg-brand-50 px-3 py-2 text-xs font-semibold text-brand-800">{state.ok}</p>}
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block">
          <span className="mb-1 block text-xs text-slate-600">{t.accountCode}</span>
          <input name="aob_account_code" defaultValue={config.account_code} placeholder="4010501" className={inputClass} />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-slate-600">{t.accountName}</span>
          <input name="aob_account_name" defaultValue={config.account_name} placeholder={t.accountName} className={inputClass} />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-slate-600">{t.branch}</span>
          <input name="aob_branch_code" defaultValue={config.branch_code} placeholder="01" className={inputClass} />
        </label>
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? <LoaderCircle className="size-4 animate-spin" /> : <Plus className="size-4" />}
        ບັນທຶກ
      </Button>
    </form>
  );
}
