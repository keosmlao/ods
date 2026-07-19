"use client";
import type { Option } from "@/app/actions/service-rate";
import { saveQcItem, toggleQcItem, type QcItemRow } from "@/app/actions/qc-admin";
import { Button, ErrorBox, inputClass, labelClass } from "@/components/ui";
import type { Workflow } from "@/lib/commission-roles";
import { useDict } from "@/lib/i18n/context";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { Camera, LoaderCircle, Pencil, Plus, Power, PowerOff } from "lucide-react";
import { useActionState, useState, useTransition } from "react";

type Dict = Dictionary["checklistForms"];

const workflowOptions = (t: Dict): { value: Workflow; label: string }[] => [
  { value: "install", label: t.workflowInstall },
  { value: "repair", label: t.workflowRepair },
];

/* ── ຟອມເພີ່ມ/ແກ້ ລາຍການກວດ ─────────────────────────────────────── */

export function ItemForm({ categories, editing }: { categories: Option[]; editing?: QcItemRow }) {
  const t = useDict().checklistForms;
  const [state, action, pending] = useActionState(saveQcItem, {});
  const [open, setOpen] = useState(!!editing);

  if (!open) {
    return (
      <Button tone="neutral" onClick={() => setOpen(true)} className="h-9 text-xs">
        <Plus className="size-4" /> {t.addItem}
      </Button>
    );
  }

  return (
    <form action={action} className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
      {editing && <input type="hidden" name="id" value={editing.id} />}
      {state.error && <ErrorBox>{state.error}</ErrorBox>}
      {state.ok && <p className="text-xs font-semibold text-emerald-700">{state.ok}</p>}

      <div className="grid gap-3 sm:grid-cols-4">
        <div>
          <label className={labelClass}>{t.labelWorkflow}</label>
          <select name="workflow" defaultValue={editing?.workflow ?? "install"} className={inputClass}>
            {workflowOptions(t).map((workflow) => (
              <option key={workflow.value} value={workflow.value}>
                {workflow.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          {/* ຫວ່າງ = ໃຊ້ກັບທຸກໝວດ — ຕິດຕັ້ງແອ ກັບ ຕິດຕັ້ງໂທລະທັດ ກວດຄົນລະຢ່າງ */}
          <label className={labelClass}>{t.labelCategory}</label>
          <select name="category_code" defaultValue={editing?.category_code ?? ""} className={inputClass}>
            <option value="">{t.optionAllCategories}</option>
            {categories.map((category) => (
              <option key={category.code} value={category.code}>
                {category.name}
              </option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className={labelClass}>{t.labelItemName}</label>
          <input name="name" defaultValue={editing?.name} required className={inputClass} placeholder={t.placeholderItemName} />
        </div>
        <div>
          <label className={labelClass}>{t.labelSortOrder}</label>
          <input
            name="sort_order"
            type="number"
            min={0}
            max={999}
            defaultValue={editing?.sort_order ?? 0}
            className={inputClass}
          />
        </div>
        <label className="flex items-end gap-2 pb-2 text-sm text-slate-700 sm:col-span-3">
          <input
            type="checkbox"
            name="require_photo"
            defaultChecked={editing?.require_photo}
            className="size-4 accent-teal-600"
          />
          <Camera className="size-4 text-slate-400" /> {t.requirePhoto}
        </label>
      </div>

      <div className="flex gap-2">
        <Button disabled={pending} className="h-9 text-xs">
          {pending && <LoaderCircle className="size-3.5 animate-spin" />} {t.save}
        </Button>
        {!editing && (
          <Button type="button" tone="neutral" onClick={() => setOpen(false)} className="h-9 text-xs">
            {t.cancel}
          </Button>
        )}
      </div>
    </form>
  );
}

/* ── ປຸ່ມແກ້ / ເປີດ-ປິດ ຢູ່ໃນຕາຕະລາງ ─────────────────────────────── */

export function ItemRowActions({ item, categories }: { item: QcItemRow; categories: Option[] }) {
  const t = useDict().checklistForms;
  const [editing, setEditing] = useState(false);
  const [pending, start] = useTransition();

  if (editing) {
    return (
      <div className="py-2">
        <ItemForm categories={categories} editing={item} />
        <Button tone="neutral" onClick={() => setEditing(false)} className="mt-2 h-8 text-xs">
          {t.close}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex justify-center gap-2">
      <Button tone="neutral" onClick={() => setEditing(true)} className="h-8 px-2 text-xs">
        <Pencil className="size-3.5" /> {t.edit}
      </Button>
      <Button
        tone={item.is_active ? "neutral" : "success"}
        disabled={pending}
        onClick={() => start(() => void toggleQcItem(item.id, !item.is_active))}
        className="h-8 px-2 text-xs"
        title={item.used > 0 ? `${t.usedPrefix} ${item.used} ${t.usedSuffix}` : undefined}
      >
        {pending ? (
          <LoaderCircle className="size-3.5 animate-spin" />
        ) : item.is_active ? (
          <PowerOff className="size-3.5" />
        ) : (
          <Power className="size-3.5" />
        )}
        {item.is_active ? t.off : t.on}
      </Button>
    </div>
  );
}
