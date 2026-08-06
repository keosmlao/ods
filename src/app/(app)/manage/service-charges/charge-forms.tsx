"use client";
import { deleteServiceCharge, saveCobConfig, saveServiceCharge } from "@/app/actions/service-charge";
import { type Option, optionsForCategory } from "@/app/actions/service-rate";
import { useConfirm } from "@/components/confirm-dialog";
import { Button, ErrorBox, inputClass } from "@/components/ui";
import { LoaderCircle, Plus, Trash2 } from "lucide-react";
import { useActionState, useState, useTransition } from "react";

/** ປະເພດບໍລິການ — ຄືກັບໜ້າອັດຕາຄ່າຄອມ (ຄ່າຢູ່ tb_product.service_type) */
const SERVICE_TYPES: Option[] = [
  { code: "CI", name: "ລູກຄ້ານຳເຄື່ອງເຂົ້າ" },
  { code: "ST", name: "ສ້ອມເຄື່ອງໃນສາງ" },
  { code: "IH", name: "ສ້ອມບ້ານລູກຄ້າ" },
  { code: "PS", name: "ໄປຮັບເຄື່ອງທີ່ບ້ານລູກຄ້າມາສ້ອມຢູ່ສູນ" },
];

function Select({
  name, label, options, value, onChange, disabled, hint,
}: {
  name: string; label: string; options: Option[];
  value?: string; onChange?: (value: string) => void; disabled?: boolean; hint?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-slate-600">
        {label} <span className="text-slate-400">{hint ?? "(ຫວ່າງ = ທຸກອັນ)"}</span>
      </span>
      <select name={name} className={inputClass} value={value} disabled={disabled} onChange={(e) => onChange?.(e.target.value)}>
        <option value="">— ທຸກອັນ —</option>
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
      <h2 className="text-sm font-bold text-slate-700">ເພີ່ມການຈັບຄູ່</h2>
      {state.error && <ErrorBox>{state.error}</ErrorBox>}
      {state.ok && <p className="rounded-lg bg-brand-50 px-3 py-2 text-xs font-semibold text-brand-800">{state.ok}</p>}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {/**
          * ມິຕິຫຼັກ — ງານສ້ອມເກືອບບໍ່ມີ item_code ⇒ ໝວດ/ແບບ/ຂະໜາດ ຂອງ ERP ຈັບຄູ່ໄດ້ພຽງ
          * 0.7% ຂອງງານ. ອັນທີ່ມີທຸກໃບຄື p_type ຈາກໃບຮັບເຄື່ອງ (ເບິ່ງ lib/service-charge).
          */}
        <Select
          name="product_type"
          label="ປະເພດເຄື່ອງ (ໃບຮັບເຄື່ອງ)"
          options={productTypes.map((p) => ({ code: p.code, name: `${p.name} · ${p.jobs.toLocaleString()} ງານ` }))}
          hint="(ມິຕິຫຼັກ — ຫວ່າງ = ທຸກປະເພດ)"
        />
        <Select name="service_type" label="ປະເພດບໍລິການ" options={SERVICE_TYPES} />
        <Select name="category_code" label="ໝວດສິນຄ້າ (ERP)" options={categories} value={category} onChange={pickCategory} hint="(ໃຊ້ໄດ້ສະເພາະງານທີ່ມີລະຫັດສິນຄ້າ ERP)" />
        <Select
          name="design_code"
          label="ແບບ"
          options={designs}
          disabled={!category || loading}
          hint={!category ? "(ເລືອກໝວດກ່ອນ)" : loading ? "(ກຳລັງໂຫຼດ…)" : `(${designs.length} ແບບ · ຫວ່າງ = ທຸກອັນ)`}
        />
        <Select
          name="size_code"
          label="ຂະໜາດ"
          options={sizes}
          disabled={!category || loading}
          hint={!category ? "(ເລືອກໝວດກ່ອນ)" : loading ? "(ກຳລັງໂຫຼດ…)" : `(${sizes.length} ຂະໜາດ · ຫວ່າງ = ທຸກອັນ)`}
        />

        <label className="block sm:col-span-2">
          <span className="mb-1 block text-xs text-slate-600">ລາຍການຄ່າບໍລິການ (ERP 9702xx) *</span>
          <select
            name="service_code"
            required
            className={inputClass}
            value={service}
            onChange={(e) => setService(e.target.value)}
          >
            <option value="">— ເລືອກລາຍການ —</option>
            {services.map((s) => <option key={s.code} value={s.code}>{s.code} · {s.name}</option>)}
          </select>
          {/* ຊື່ໄປນຳ ⇒ ບິນເກົ່າຍັງອ່ານອອກ ເຖິງ ERP ຈະປ່ຽນຊື່ພາຍຫຼັງ */}
          <input type="hidden" name="service_name" value={services.find((s) => s.code === service)?.name ?? ""} />
        </label>

        <label className="block">
          <span className="mb-1 block text-xs text-slate-600">
            ລາຄາ (ບາດ) <span className="text-slate-400">— ໃນປະກັນລະບົບໃສ່ 0 ໃຫ້ເອງ</span>
          </span>
          <input name="price_thb" type="number" step="0.01" min="0" defaultValue="0" className={inputClass} />
        </label>
      </div>

      <Button type="submit" disabled={pending}>
        {pending ? <LoaderCircle className="size-4 animate-spin" /> : <Plus className="size-4" />}
        ບັນທຶກ
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
        aria-label="ລາຍການຄ່າບໍລິການ"
      >
        {services.map((s) => <option key={s.code} value={s.code}>{s.code} · {s.name}</option>)}
      </select>
      <input
        name="price_thb"
        type="number"
        step="0.01"
        min="0"
        defaultValue={row.price_thb}
        aria-label="ລາຄາ (ບາດ)"
        className="h-8 w-24 rounded-lg border border-slate-200 px-2 text-right text-[11px] outline-none focus:border-brand-600"
      />
      <button
        type="submit"
        disabled={pending}
        className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-300 px-2.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
      >
        {pending ? <LoaderCircle className="size-3.5 animate-spin" /> : null}
        ບັນທຶກ
      </button>
      {state.error && <span className="text-[10px] font-semibold text-brand-orange-700">{state.error}</span>}
      {state.ok && <span className="text-[10px] font-semibold text-brand-800">✓</span>}
    </form>
  );
}

export function DeleteChargeButton({ id }: { id: number }) {
  const [pending, start] = useTransition();
  const { ask, dialog } = useConfirm();
  return (
    <>
      {dialog}
      <button
        type="button"
        disabled={pending}
        onClick={async () => {
          if (!(await ask({ title: "ລຶບການຈັບຄູ່ນີ້?", message: "ບິນໃໝ່ຈະບໍ່ຕື່ມຄ່າບໍລິການໃຫ້ອັດຕະໂນມັດອີກ", tone: "danger" }))) return;
          const data = new FormData();
          data.set("id", String(id));
          start(() => void deleteServiceCharge(data));
        }}
        className="grid size-7 place-items-center rounded text-slate-300 hover:bg-brand-orange-50 hover:text-brand-orange-700 disabled:opacity-50"
        title="ລຶບ"
      >
        {pending ? <LoaderCircle className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
      </button>
    </>
  );
}

/**
 * ຕັ້ງຄ່າ **COB** — ລະຫັດບັນຊີທີ່ໃບເຄມ CLM-C ຈະລົງຢູ່ ERP.
 * ຫວ່າງ = ບໍ່ອອກ COB (ໃບເຄມຍັງອອກປົກກະຕິ). ເລກເອກະສານໃຊ້ **ລະຫັດໃບເຄມ** ສະເໝີ.
 */
export function CobConfigForm({ config }: { config: { account_code: string; account_name: string; branch_code: string } }) {
  const [state, action, pending] = useActionState(saveCobConfig, {});
  return (
    <form action={action} className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div>
        <h2 className="text-sm font-bold text-slate-700">ໃບຕັ້ງໜີ້ຕ້ອງຮັບ ຂອງໃບເຄມ (CLM-C · AOB)</h2>
        <p className="text-[11px] text-slate-400">
          ອອກໃບເຄມ ⇒ ລະບົບ<b>ຕັ້ງໜີ້ຕ້ອງຮັບຈາກ supplier</b> ຢູ່ ERP ໃຫ້ເລີຍ (ເອກະສານ AOB)
          ໂດຍໃຊ້ <b>ລະຫັດໃບເຄມເປັນເລກເອກະສານ</b>. ບັນຊີຄູ່ຄ່າຕັ້ງຕົ້ນ = 4010501 ລາຍຮັບຈາກການບໍລິການ —
          ບັນຊີກວດແລ້ວປ່ຽນໄດ້ຢູ່ນີ້.
        </p>
      </div>
      {state.error && <ErrorBox>{state.error}</ErrorBox>}
      {state.ok && <p className="rounded-lg bg-brand-50 px-3 py-2 text-xs font-semibold text-brand-800">{state.ok}</p>}
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block">
          <span className="mb-1 block text-xs text-slate-600">ລະຫັດບັນຊີຄູ່ (ERP)</span>
          <input name="cob_account_code" defaultValue={config.account_code} placeholder="4010501" className={inputClass} />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-slate-600">ຊື່ບັນຊີ (ໂຊ້ວໃນເອກະສານ)</span>
          <input name="cob_account_name" defaultValue={config.account_name} placeholder="ລາຍຮັບຈາກການບໍລິການ" className={inputClass} />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-slate-600">ສາຂາ</span>
          <input name="cob_branch_code" defaultValue={config.branch_code} placeholder="01" className={inputClass} />
        </label>
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? <LoaderCircle className="size-4 animate-spin" /> : <Plus className="size-4" />}
        ບັນທຶກ
      </Button>
    </form>
  );
}
