"use client";
import {
  deactivateRate,
  type Option,
  optionsForCategory,
  savePayee,
  saveRate,
  saveSplit,
} from "@/app/actions/service-rate";
import { useConfirm } from "@/components/confirm-dialog";
import { Button, ErrorBox, inputClass } from "@/components/ui";
// ⚠️ ຢ່າ import ຈາກ lib/commission — ມັນດຶງ `pg` ເຂົ້າ browser ແລ້ວ build ພັງ
import { ROLE_LABEL, type Workflow } from "@/lib/commission-roles";
import { useDict } from "@/lib/i18n/context";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { LoaderCircle, Plus, Trash2 } from "lucide-react";
import { useActionState, useState, useTransition } from "react";

type Dict = Dictionary["rateForms"];

/**
 * ຟອມກຳນົດ ອັດຕາ · ເປີເຊັນ · ຜູ້ຮັບເງິນ.
 * ກົດເກນຈິງບັງຄັບຢູ່ຝັ່ງ server ໝົດ (actions/service-rate.ts — ຜູ້ຈັດການເທົ່ານັ້ນ,
 * ເປີເຊັນຕ້ອງລວມ 100). ຢູ່ນີ້ເປັນພຽງການຊ່ວຍປ້ອນ.
 */

const SPLIT_ROLES = ["supervisor", "team_lead", "admin", "technician"] as const;

/* ── ເພີ່ມອັດຕາ ─────────────────────────────────────────────────── */

const SERVICE_TYPES: Option[] = [
  { code: "CI", name: "ລູກຄ້ານຳເຄື່ອງເຂົ້າ" },
  { code: "ST", name: "ສ້ອມເຄື່ອງໃນສາງ" },
  { code: "IH", name: "ສ້ອມບ້ານລູກຄ້າ" },
  { code: "PS", name: "ໄປຮັບເຄື່ອງທີ່ບ້ານລູກຄ້າມາສ້ອມຢູ່ສູນ" },
];

function Select({
  name,
  label,
  options,
  value,
  onChange,
  disabled,
  hint,
  t,
}: {
  name: string;
  label: string;
  options: Option[];
  value?: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
  hint?: string;
  t: Dict;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-slate-600">
        {label} <span className="text-slate-400">{hint ?? `(${t.emptyAll})`}</span>
      </span>
      <select
        name={name}
        className={inputClass}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange?.(event.target.value)}
      >
        <option value="">{t.optionAll}</option>
        {options.map((option) => (
          <option key={option.code} value={option.code}>
            {option.name}
          </option>
        ))}
      </select>
    </label>
  );
}

/**
 * ເພີ່ມອັດຕາ — **ແບບ ແລະ ຂະໜາດ ກອງຕາມໝວດທີ່ເລືອກ**.
 *
 * ERP ມີ 56 ແບບ ແລະ 489 ຂະໜາດ ລວມທຸກໝວດ ('0.2ລິດ', '3ຊ່ອງ' …). ຖ້າເທລົງມາທັງໝົດ
 * ຜູ້ຈັດການຈະເລືອກຂະໜາດທີ່ **ໝວດນັ້ນບໍ່ເຄີຍມີ** ໄດ້ ⇒ ອັດຕານັ້ນຈະບໍ່ມີວັນຈັບຄູ່
 * ກັບງານໃດເລີຍ (ອັດຕາຕາຍ ໂດຍບໍ່ມີໃຜຮູ້). ດຶງຈາກສິນຄ້າຈິງຂອງໝວດນັ້ນ.
 */
export function AddRateForm({ categories }: { categories: Option[] }) {
  const t = useDict().rateForms;
  const [state, action, pending] = useActionState(saveRate, {});
  const [category, setCategory] = useState("");
  const [designs, setDesigns] = useState<Option[]>([]);
  const [sizes, setSizes] = useState<Option[]>([]);
  const [loading, startLoad] = useTransition();

  function pickCategory(code: string) {
    setCategory(code);
    // ປ່ຽນໝວດ → ແບບ/ຂະໜາດ ເກົ່າໃຊ້ບໍ່ໄດ້ອີກ ⇒ ລ້າງທັນທີ ບໍ່ດັ່ງນັ້ນຈະສົ່ງຄ່າທີ່ຂັດກັນໄປ
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
      <h2 className="text-sm font-bold text-slate-700">{t.addRateHeading}</h2>
      {state.error && <ErrorBox>{state.error}</ErrorBox>}
      {state.ok && (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800">{state.ok}</p>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <label className="block">
          <span className="mb-1 block text-xs text-slate-600">{t.labelWorkflow}</span>
          <select name="workflow" className={inputClass} defaultValue="repair">
            <option value="repair">{t.workflowRepair}</option>
            <option value="install">{t.workflowInstall}</option>
          </select>
        </label>

        <Select name="service_type" label={t.labelServiceType} options={SERVICE_TYPES} t={t} />

        {/* ໝວດ → ກອງ ແບບ ແລະ ຂະໜາດ ໃຫ້ເຫຼືອສະເພາະທີ່ໝວດນັ້ນມີຈິງໃນ ERP */}
        <Select
          name="category_code"
          label={t.labelCategory}
          options={categories}
          value={category}
          onChange={pickCategory}
          t={t}
        />
        <Select
          name="design_code"
          label={t.labelDesign}
          options={designs}
          disabled={!category || loading}
          hint={
            !category
              ? t.hintPickCategory
              : loading
                ? t.hintLoading
                : `(${designs.length} ${t.designsInCategory} · ${t.emptyAll})`
          }
          t={t}
        />
        <Select
          name="size_code"
          label={t.labelSize}
          options={sizes}
          disabled={!category || loading}
          hint={
            !category
              ? t.hintPickCategory
              : loading
                ? t.hintLoading
                : `(${sizes.length} ${t.sizesInCategory} · ${t.emptyAll})`
          }
          t={t}
        />

        <label className="block">
          <span className="mb-1 block text-xs text-slate-600">{t.labelAmount}</span>
          <input name="amount_thb" type="number" step="0.01" min="0" required className={inputClass} />
        </label>

        <label className="block sm:col-span-2 lg:col-span-3">
          <span className="mb-1 block text-xs text-slate-600">{t.labelDescription}</span>
          <input
            name="label"
            required
            placeholder={t.placeholderDescription}
            className={inputClass}
          />
        </label>
      </div>

      <Button tone="primary" disabled={pending} className="h-9 px-4 text-xs">
        {pending ? <LoaderCircle className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
        {t.addRate}
      </Button>
    </form>
  );
}

/* ── ປິດອັດຕາ ───────────────────────────────────────────────────── */

export function DeactivateRateButton({ id, label }: { id: number; label: string }) {
  const t = useDict().rateForms;
  const [pending, start] = useTransition();
  const { ask, dialog } = useConfirm();
  const [error, setError] = useState("");

  return (
    <>
      {dialog}
      <button
        type="button"
        disabled={pending}
        title={error || t.deactivateTitle}
        onClick={async () => {
          const ok = await ask({
            title: t.deactivateConfirmTitle,
            message: (
              <>
                <b className="text-slate-700">{label}</b> {t.deactivateMessage}
              </>
            ),
            confirmLabel: t.deactivateConfirm,
          });
          if (!ok) return;
          start(async () => {
            const result = await deactivateRate(id);
            if (result.error) setError(result.error);
          });
        }}
        className="text-slate-400 transition hover:text-red-600 disabled:opacity-50"
      >
        {pending ? <LoaderCircle className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
      </button>
    </>
  );
}

/* ── ເປີເຊັນການແບ່ງ ─────────────────────────────────────────────── */

export function SplitForm({ workflow, current }: { workflow: Workflow; current: Record<string, number> }) {
  const t = useDict().rateForms;
  const [pcts, setPcts] = useState<Record<string, number>>(current);
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<{ error?: string; ok?: string }>({});

  const total = SPLIT_ROLES.reduce((sum, role) => sum + (pcts[role] ?? 0), 0);
  const valid = Math.abs(total - 100) < 0.001;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="mb-3 text-sm font-bold text-slate-700">
        {t.moneySplit} — {workflow === "repair" ? t.workflowRepair : t.workflowInstall}
      </h2>

      {message.error && <ErrorBox>{message.error}</ErrorBox>}
      {message.ok && (
        <p className="mb-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800">{message.ok}</p>
      )}

      <div className="grid gap-3 sm:grid-cols-4">
        {SPLIT_ROLES.map((role) => (
          <label key={role} className="block">
            <span className="mb-1 block text-xs text-slate-600">{ROLE_LABEL[role]}</span>
            <div className="flex items-center gap-1">
              <input
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={pcts[role] ?? 0}
                onChange={(event) => setPcts({ ...pcts, [role]: Number(event.target.value) })}
                className={inputClass}
              />
              <span className="text-xs text-slate-400">%</span>
            </div>
          </label>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        {/* ລວມຕ້ອງເປັນ 100 ພໍດີ — ບໍ່ດັ່ງນັ້ນເງິນຫາຍ (<100) ຫຼື ຈ່າຍເກີນ (>100) */}
        <span
          className={`rounded px-2 py-1 text-xs font-bold ${
            valid ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
          }`}
        >
          {t.total} {total}% {valid ? "✓" : t.mustBe100}
        </span>
        <Button
          tone="primary"
          disabled={pending || !valid}
          className="h-8 px-3 text-xs"
          onClick={() =>
            start(async () => {
              setMessage(await saveSplit(workflow, pcts));
            })
          }
        >
          {pending && <LoaderCircle className="size-3.5 animate-spin" />}
          {t.save}
        </Button>
      </div>
    </div>
  );
}

/* ── ຜູ້ຮັບເງິນ ─────────────────────────────────────────────────── */

export function PayeeForm({
  workflow,
  role,
  current,
  employees,
}: {
  workflow: Workflow;
  role: string;
  current: string;
  employees: Option[];
}) {
  const t = useDict().rateForms;
  const [state, action, pending] = useActionState(savePayee, {});

  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="workflow" value={workflow} />
      <input type="hidden" name="role" value={role} />
      <label className="min-w-52 flex-1">
        <span className="mb-1 block text-xs text-slate-600">{ROLE_LABEL[role]}</span>
        <select name="employee_code" defaultValue={current} className={inputClass}>
          <option value="">{t.payeeUnset}</option>
          {employees.map((employee) => (
            <option key={employee.code} value={employee.code}>
              {employee.name}
            </option>
          ))}
        </select>
      </label>
      <Button tone="neutral" disabled={pending} className="h-9 px-3 text-xs">
        {pending && <LoaderCircle className="size-3.5 animate-spin" />}
        {t.save}
      </Button>
      {state.error && <span className="text-xs font-semibold text-red-600">{state.error}</span>}
      {state.ok && <span className="text-xs font-semibold text-emerald-600">✓</span>}
    </form>
  );
}
