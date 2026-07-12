"use client";
import type { Option } from "@/app/actions/service-rate";
import { saveQcItem, saveQcRoles, toggleQcItem, type QcItemRow } from "@/app/actions/qc-admin";
import { Button, ErrorBox, inputClass, labelClass } from "@/components/ui";
import type { Workflow } from "@/lib/commission";
import { ROLE_LABEL, ROLES, type Role } from "@/lib/roles";
import { Camera, LoaderCircle, Pencil, Plus, Power, PowerOff } from "lucide-react";
import { useActionState, useState, useTransition } from "react";

const WORKFLOWS: { value: Workflow; label: string }[] = [
  { value: "install", label: "ຕິດຕັ້ງ" },
  { value: "repair", label: "ສ້ອມແປງ" },
];

/* ── ຟອມເພີ່ມ/ແກ້ ລາຍການກວດ ─────────────────────────────────────── */

export function ItemForm({ categories, editing }: { categories: Option[]; editing?: QcItemRow }) {
  const [state, action, pending] = useActionState(saveQcItem, {});
  const [open, setOpen] = useState(!!editing);

  if (!open) {
    return (
      <Button tone="neutral" onClick={() => setOpen(true)} className="h-9 text-xs">
        <Plus className="size-4" /> ເພີ່ມລາຍການກວດ
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
          <label className={labelClass}>ສາຍງານ</label>
          <select name="workflow" defaultValue={editing?.workflow ?? "install"} className={inputClass}>
            {WORKFLOWS.map((workflow) => (
              <option key={workflow.value} value={workflow.value}>
                {workflow.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          {/* ຫວ່າງ = ໃຊ້ກັບທຸກໝວດ — ຕິດຕັ້ງແອ ກັບ ຕິດຕັ້ງໂທລະທັດ ກວດຄົນລະຢ່າງ */}
          <label className={labelClass}>ໝວດສິນຄ້າ (ຫວ່າງ = ທຸກໝວດ)</label>
          <select name="category_code" defaultValue={editing?.category_code ?? ""} className={inputClass}>
            <option value="">ທຸກໝວດ</option>
            {categories.map((category) => (
              <option key={category.code} value={category.code}>
                {category.name}
              </option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className={labelClass}>ຊື່ລາຍການທີ່ຕ້ອງກວດ</label>
          <input name="name" defaultValue={editing?.name} required className={inputClass} placeholder="ເຊັ່ນ: ທົດສອບຄວາມເຢັນ ແລະ ຮອຍຮົ່ວນ້ຳຢາ" />
        </div>
        <div>
          <label className={labelClass}>ລຳດັບ</label>
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
          <Camera className="size-4 text-slate-400" /> ບັງຄັບແນບຮູບ (ຜ່ານໂດຍບໍ່ມີຮູບບໍ່ໄດ້)
        </label>
      </div>

      <div className="flex gap-2">
        <Button disabled={pending} className="h-9 text-xs">
          {pending && <LoaderCircle className="size-3.5 animate-spin" />} ບັນທຶກ
        </Button>
        {!editing && (
          <Button type="button" tone="neutral" onClick={() => setOpen(false)} className="h-9 text-xs">
            ຍົກເລີກ
          </Button>
        )}
      </div>
    </form>
  );
}

/* ── ປຸ່ມແກ້ / ເປີດ-ປິດ ຢູ່ໃນຕາຕະລາງ ─────────────────────────────── */

export function ItemRowActions({ item, categories }: { item: QcItemRow; categories: Option[] }) {
  const [editing, setEditing] = useState(false);
  const [pending, start] = useTransition();

  if (editing) {
    return (
      <div className="py-2">
        <ItemForm categories={categories} editing={item} />
        <Button tone="neutral" onClick={() => setEditing(false)} className="mt-2 h-8 text-xs">
          ປິດ
        </Button>
      </div>
    );
  }

  return (
    <div className="flex justify-center gap-2">
      <Button tone="neutral" onClick={() => setEditing(true)} className="h-8 px-2 text-xs">
        <Pencil className="size-3.5" /> ແກ້
      </Button>
      <Button
        tone={item.is_active ? "neutral" : "success"}
        disabled={pending}
        onClick={() => start(() => void toggleQcItem(item.id, !item.is_active))}
        className="h-8 px-2 text-xs"
        title={item.used > 0 ? `ໃຊ້ໄປແລ້ວ ${item.used} ງານ — ລົບບໍ່ໄດ້ ໄດ້ແຕ່ປິດ` : undefined}
      >
        {pending ? (
          <LoaderCircle className="size-3.5 animate-spin" />
        ) : item.is_active ? (
          <PowerOff className="size-3.5" />
        ) : (
          <Power className="size-3.5" />
        )}
        {item.is_active ? "ປິດ" : "ເປີດ"}
      </Button>
    </div>
  );
}

/* ── ໃຜກວດ QC ໄດ້ ───────────────────────────────────────────────── */

export function RoleMatrix({ current }: { current: { workflow: Workflow; role: Role }[] }) {
  const [pairs, setPairs] = useState(current);
  const [state, setState] = useState<{ error?: string; ok?: string }>({});
  const [pending, start] = useTransition();

  const has = (workflow: Workflow, role: Role) =>
    pairs.some((pair) => pair.workflow === workflow && pair.role === role);

  const toggle = (workflow: Workflow, role: Role) =>
    setPairs((list) =>
      has(workflow, role)
        ? list.filter((pair) => !(pair.workflow === workflow && pair.role === role))
        : [...list, { workflow, role }],
    );

  return (
    <div className="space-y-3">
      {state.error && <ErrorBox>{state.error}</ErrorBox>}
      {state.ok && <p className="text-xs font-semibold text-emerald-700">{state.ok}</p>}

      <div className="overflow-x-auto">
        <table className="text-sm">
          <thead>
            <tr className="border-y border-slate-200 bg-slate-50 text-slate-600">
              <th className="px-3 py-2 text-left font-semibold">ຕຳແໜ່ງ</th>
              {WORKFLOWS.map((workflow) => (
                <th key={workflow.value} className="px-6 py-2 font-semibold">
                  {workflow.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROLES.filter((role) => role !== "user").map((role) => (
              <tr key={role} className="border-b border-slate-100">
                <td className="px-3 py-2 text-slate-700">{ROLE_LABEL[role]}</td>
                {WORKFLOWS.map((workflow) => (
                  <td key={workflow.value} className="px-6 py-2 text-center">
                    <input
                      type="checkbox"
                      checked={has(workflow.value, role)}
                      onChange={() => toggle(workflow.value, role)}
                      className="size-4 accent-teal-600"
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ຄົນເຮັດງານກວດຮັບຂອງຕົນເອງບໍ່ໄດ້ສະເໝີ — ບໍ່ວ່າຈະຕິກຫຍັງຢູ່ນີ້ (actions/qc.ts ບັງຄັບ) */}
      <p className="text-xs text-slate-500">
        ໝາຍເຫດ: ເຖິງຈະຕິກໃຫ້ <b>ຊ່າງ</b> ກວດໄດ້ ຊ່າງກໍ່ຍັງ <b>ກວດຮັບງານຂອງຕົນເອງບໍ່ໄດ້</b> — ຕ້ອງເປັນຄົນອື່ນກວດສະເໝີ.
      </p>

      <Button
        disabled={pending}
        onClick={() => start(async () => setState(await saveQcRoles(pairs)))}
        className="h-9 text-xs"
      >
        {pending && <LoaderCircle className="size-3.5 animate-spin" />} ບັນທຶກຜູ້ມີສິດກວດ
      </Button>
    </div>
  );
}
