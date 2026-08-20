"use client";
import {
  addInstallKitLine,
  addInstallKitType,
  deleteInstallKitLine,
  deleteInstallKitType,
  setInstallKitDesigns,
  updateInstallKitLine,
  updateInstallKitType,
  type KitState,
} from "@/app/actions/install-kit";
import { UndoButton } from "@/components/checking/undo-button";
import { SelectField } from "@/components/select-field";
import { Button, Card, Empty, Table, inputClass, labelClass } from "@/components/ui";
import type { InstallKit, InstallKitLine } from "@/lib/install-kit";
import {
  AlertTriangle,
  LoaderCircle,
  Package,
  Pencil,
  Plus,
  Save,
  Search,
  Shapes,
  X,
} from "lucide-react";
import { useActionState, useEffect, useMemo, useState, useTransition } from "react";

/**
 * ── ຈັດການຊຸດອາໄຫຼ່ມາດຕະຖານຂອງງານຕິດຕັ້ງ ──
 *
 * ສອງຊັ້ນ:
 *   ① **ໝວດ** (`install_kit_type`) — ເພີ່ມ/ແກ້/ລົບ ໄດ້ແລ້ວ (19-08-2026). ໝວດຜູກກັບ
 *      `ic_size` ຂອງ ERP ຊຶ່ງເປັນຊ່ວງ BTU ⇒ ບິນໃໝ່ຖືກຈັບໝວດອັດຕະໂນມັດ.
 *   ② **ລາຍການໃນໝວດ** (`used_spare_install`) — ອາໄຫຼ່ + ຈຳນວນ + ຫົວໜ່ວຍ
 *
 * ປຸ່ມແຕ່ລະອັນ**ຜູກກັບ action ຂອງຕົນເອງ** (ເພີ່ມ=create · ບັນທຶກ=update · ລົບ=delete)
 * ⇒ ຜູ້ຈັດການຕິກ "ແກ້ໄຂ" ຢ່າງດຽວ ກໍ່ໄດ້ແຕ່ປຸ່ມບັນທຶກຈິງ. ດ່ານຈິງຢູ່ຝັ່ງ server
 * (actions/install-kit) ເພາະ server action ຖືກຍິງໂດຍກົງໄດ້ — ຢູ່ນີ້ພຽງບໍ່ໃຫ້ກົດຫຼິ້ນ.
 */
export type KitPermission = { create: boolean; update: boolean; delete: boolean };

export type SizeOption = { code: string; name_1: string };
/** ຮູບແບບ (ic_design) ຂອງ ERP — ແອຕິດຝາ · ແອແຄັດເສັດ · ແອດັກ … */
export type DesignOption = { code: string; name_1: string };

type ErpItem = { code: string; name_1: string; unit_code: string | null };

export function InstallKitManager({
  kits,
  sizes,
  designs,
  can,
}: {
  kits: InstallKit[];
  /** ຂະໜາດ (ic_size) ຂອງ ERP ໃຫ້ຜູກກັບໝວດ */
  sizes: SizeOption[];
  /** ຮູບແບບ (ic_design) ຂອງ ERP ໃຫ້ຜູກກັບໝວດ */
  designs: DesignOption[];
  can: KitPermission;
}) {
  const [adding, setAdding] = useState(false);
  /**
   * ⚠️ **ບໍ່ກອງຂະໜາດທີ່ໝວດອື່ນໃຊ້ອອກອີກ** (ຕ່າງຈາກກ່ອນ 19-08-2026): ດຽວນີ້ຂະໜາດດຽວ
   * ມີຫຼາຍໝວດໄດ້ ຖ້າ**ຮູບແບບ**ຕ່າງກັນ (033+ແອຕິດຝາ ກັບ 033+ແອແຄັດເສັດ) ⇒ ກອງອອກ
   * ຈະເຮັດໃຫ້ສ້າງໝວດທີ່ຕ້ອງການບໍ່ໄດ້ເລີຍ. ດ່ານກັນຊ້ຳຄື**ຄູ່** ຂະໜາດ×ຮູບແບບ ຢູ່ຝັ່ງ server.
   */
  const autoCount = kits.filter((kit) => kit.auto).length;

  return (
    <div className="space-y-4">
      {/*
        ── ຄຳເຕືອນລວມ: ບໍ່ມີໝວດໃດຈັບຄູ່ໄດ້ ⇒ ບິນໃໝ່ບໍ່ໄດ້ຊຸດເລີຍ ──
        ເກີດແນ່ນອນຫຼັງແລ່ນ migration 2026-08-19b (5 ໝວດເກົ່າຍັງບໍ່ມີ ic_design)
        ⇒ ຕ້ອງບອກໃຫ້ດັງ ບໍ່ດັ່ງນັ້ນຄົນຈະຮູ້ຕົວຕອນງານເປີດມາແລ້ວບໍ່ມີອາໄຫຼ່.
      */}
      {kits.length > 0 && autoCount === 0 && (
        <p className="flex items-start gap-2 rounded-xl border border-brand-orange-400 bg-brand-orange-50 px-4 py-3 text-xs font-semibold text-brand-orange-700">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <span>
            ຍັງບໍ່ມີໝວດໃດ<b> ຈັບຄູ່ບິນອັດຕະໂນມັດ </b>ໄດ້ — ບິນໃໝ່ຈະບໍ່ໄດ້ຊຸດອາໄຫຼ່ຕັ້ງຕົ້ນ
            (ຕ້ອງເຂົ້າໃບງານໄປເລືອກໝວດເອງ). ໝວດຈະຈັບຄູ່ໄດ້ເມື່ອລະບຸ<b> ທັງຂະໜາດ ແລະ ຮູບແບບ</b>.
          </span>
        </p>
      )}
      {can.create && (
        <Card
          title={<span className="text-sm">ໝວດຊຸດອາໄຫຼ່</span>}
          actions={
            <Button type="button" size="sm" tone={adding ? "neutral" : "primary"} onClick={() => setAdding((v) => !v)}>
              {adding ? <X className="size-3.5" /> : <Plus className="size-3.5" />}
              {adding ? "ຍົກເລີກ" : "ເພີ່ມໝວດໃໝ່"}
            </Button>
          }
        >
          {adding ? (
            <KitTypeForm
              sizes={sizes}
              nextCode={suggestNextCode(kits)}
              onDone={() => setAdding(false)}
            />
          ) : (
            <p className="text-xs text-slate-500">
              ໝວດຈັບຄູ່ບິນດ້ວຍ<b> ຂະໜາດ (ic_size) × ຮູບແບບ (ic_design) </b>ຂອງ ERP —
              ຕ້ອງລະບຸທັງສອງຈຶ່ງ default ຊຸດໃຫ້ບິນໃໝ່ໄດ້. ຂະໜາດດຽວມີຫຼາຍໝວດໄດ້ ຖ້າຮູບແບບຕ່າງກັນ.
              ດຽວນີ້ມີ {kits.length} ໝວດ ({autoCount} ຈັບຄູ່ໄດ້).
            </p>
          )}
        </Card>
      )}

      {kits.length === 0 ? (
        <Empty>ຍັງບໍ່ມີໝວດຊຸດອາໄຫຼ່ — ກົດ &quot;ເພີ່ມໝວດໃໝ່&quot; ເພື່ອເລີ່ມ</Empty>
      ) : (
        kits.map((kit) => (
          <KitCard key={kit.code} kit={kit} sizes={sizes} designs={designs} can={can} />
        ))
      )}
    </div>
  );
}

/**
 * ແນະລະຫັດຖັດໄປໃນຊຸດ `9900-xxxx` — ຄົນຕັ້ງເອງໄດ້ ແຕ່ສ່ວນຫຼາຍຢາກໃຫ້ຕໍ່ຈາກເກົ່າ.
 * ບໍ່ມີໝວດຮູບແບບນັ້ນຈັກອັນ ⇒ ປະຫວ່າງໄວ້ໃຫ້ພິມເອງ.
 */
function suggestNextCode(kits: InstallKit[]): string {
  const numbers = kits
    .map((kit) => /^9900-(\d{4})$/.exec(kit.code)?.[1])
    .filter((value): value is string => !!value)
    .map(Number);
  if (!numbers.length) return "";
  return `9900-${String(Math.max(...numbers) + 1).padStart(4, "0")}`;
}

function KitCard({
  kit,
  sizes,
  designs,
  can,
}: {
  kit: InstallKit;
  sizes: SizeOption[];
  designs: DesignOption[];
  can: KitPermission;
}) {
  const [editing, setEditing] = useState(false);
  const total = kit.lines.reduce((sum, line) => sum + line.qty, 0);

  return (
    <Card
      title={
        <span className="flex flex-wrap items-center gap-2">
          <Package className="size-4 text-brand-700" />
          <span className="font-mono">{kit.code}</span>
          <span className="text-sm font-normal text-slate-600">{kit.name || "(ບໍ່ມີຊື່)"}</span>
          {!kit.active && (
            <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-600">
              ປິດການໃຊ້ງານ
            </span>
          )}
        </span>
      }
      actions={
        <span className="flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded bg-slate-100 px-2 py-0.5 font-semibold text-slate-600 tabular-nums">
            {kit.lines.length} ລາຍການ · ລວມ {total}
          </span>
          <span className="rounded bg-brand-50 px-2 py-0.5 font-semibold text-brand-800 tabular-nums">
            ໃຊ້ຢູ່ {kit.jobs} ໃບງານ
          </span>
          {can.update && (
            <Button type="button" size="sm" tone="neutral" onClick={() => setEditing((v) => !v)}>
              {editing ? <X className="size-3.5" /> : <Pencil className="size-3.5" />}
              {editing ? "ປິດ" : "ແກ້ໝວດ"}
            </Button>
          )}
          {can.delete && (
            <UndoButton
              variant="icon"
              label="ລົບໝວດນີ້"
              title={`ລົບໝວດ ${kit.code}?`}
              message={
                <>
                  ລາຍການອາໄຫຼ່ <b className="text-slate-700">{kit.lines.length} ລາຍການ</b> ຂອງໝວດນີ້ຈະຖືກລົບນຳ.
                  {kit.jobs > 0 && (
                    <span className="mt-1 block font-semibold text-brand-orange-700">
                      ມີ {kit.jobs} ໃບງານໃຊ້ໝວດນີ້ຢູ່ — ລະບົບຈະປະຕິເສດ, ໃຫ້ປິດການໃຊ້ງານແທນ
                    </span>
                  )}
                </>
              }
              action={() => deleteInstallKitType(kit.code)}
            />
          )}
        </span>
      }
    >
      {/*
        ── ເງື່ອນໄຂການຈັບຄູ່ = ຂະໜາດ **ແລະ** ຮູບແບບ ──
        ຂາດອັນໃດອັນນຶ່ງ = ບິນໃໝ່ບໍ່ມີວັນຕົກມາໝວດນີ້ (installTypeCaseSql ບໍ່ນັບເຂົ້າ)
        ⇒ ຄົນສ້າງໝວດແລ້ວໃສ່ອາໄຫຼ່ຄົບ ແຕ່ລໍວ່າເປັນຫຍັງງານໃໝ່ບໍ່ໄດ້ຊຸດ. ຕ້ອງບອກວ່າຂາດອັນໃດ.
      */}
      <div className="mb-3 space-y-2">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500">
          <span>
            ຂະໜາດ:{" "}
            {kit.ic_size ? (
              <>
                <span className="font-mono font-semibold text-slate-700">{kit.ic_size}</span>
                {kit.size_name && <> — {kit.size_name}</>}
              </>
            ) : (
              <b className="text-brand-orange-700">ຍັງບໍ່ລະບຸ</b>
            )}
          </span>
          <span className="flex flex-wrap items-center gap-1">
            ຮູບແບບ:
            {kit.designs.length === 0 ? (
              <b className="text-brand-orange-700">ຍັງບໍ່ລະບຸ</b>
            ) : (
              kit.designs.map((design) => (
                <span
                  key={design.code}
                  title={design.code}
                  className="rounded-full bg-brand-50 px-2 py-0.5 font-semibold text-brand-800"
                >
                  {design.name || design.code}
                </span>
              ))
            )}
          </span>
          {kit.active && (
            <span
              className={`rounded-full px-2 py-0.5 font-bold ${
                kit.auto
                  ? "bg-brand-100 text-brand-800"
                  : "bg-brand-orange-100 text-brand-orange-700"
              }`}
            >
              {kit.auto ? "ຈັບຄູ່ບິນອັດຕະໂນມັດ" : "ບໍ່ຈັບຄູ່ — ຕ້ອງເລືອກໝວດໃນໃບງານ"}
            </span>
          )}
        </div>

        {can.update && (
          <DesignPicker kit={kit} designs={designs} />
        )}
      </div>

      {editing && can.update && (
        <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50/60 p-3">
          <KitTypeForm kit={kit} sizes={sizes} onDone={() => setEditing(false)} />
        </div>
      )}

      {kit.lines.length === 0 ? (
        <Empty>
          ຊຸດນີ້ຍັງບໍ່ມີລາຍການ — ງານໃໝ່ຂອງຂະໜາດນີ້ຈະ<b> ຂ້າມຂັ້ນເບີກອາໄຫຼ່ </b>
          (ຍົກເວັ້ນແອ ທີ່ບັງຄັບເຂົ້າຂະບວນການສະເໝີ)
        </Empty>
      ) : (
        <Table minWidth={860} head={["#", "ລະຫັດອາໄຫຼ່", "ຊື່ລາຍການ", "ຈຳນວນ", "ຫົວໜ່ວຍ", ""]}>
          {kit.lines.map((line, index) => (
            <LineRow key={line.roworder} line={line} index={index + 1} can={can} />
          ))}
        </Table>
      )}

      {can.create && <AddLineForm installType={kit.code} />}
    </Card>
  );
}

/**
 * ── ເລືອກ **ຮູບແບບ (ic_design)** ທີ່ໝວດນີ້ຄຸມ — ໄດ້ຫຼາຍອັນ ──
 *
 * ic_design ມີ 58 ອັນ (ຄຸມທຸກປະເພດສິນຄ້າ ບໍ່ແມ່ນສະເພາະແອ) ⇒ ມີຊ່ອງກອງ ແລະ
 * **ດັນອັນທີ່ຕິກໄວ້ຂຶ້ນເທິງ** ເພື່ອບໍ່ໃຫ້ຫາຍໄປໃນລາຍການຍາວຕອນກອງ.
 *
 * ບັນທຶກແບບ **replace ທັງຊຸດ** (setInstallKitDesigns) ⇒ ບໍ່ມີ race ແບບ toggle ທີລະອັນ.
 */
function DesignPicker({ kit, designs }: { kit: InstallKit; designs: DesignOption[] }) {
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(
    () => new Set(kit.designs.map((design) => design.code)),
  );
  const [q, setQ] = useState("");
  const [message, setMessage] = useState<KitState>({});
  const [saving, startSaving] = useTransition();

  const current = useMemo(() => new Set(kit.designs.map((d) => d.code)), [kit.designs]);
  const dirty =
    picked.size !== current.size || [...picked].some((code) => !current.has(code));

  const rows = useMemo(() => {
    const keyword = q.trim().toLocaleLowerCase();
    const match = (option: DesignOption) =>
      !keyword ||
      option.code.toLocaleLowerCase().includes(keyword) ||
      option.name_1.toLocaleLowerCase().includes(keyword);
    // ຕິກໄວ້ຂຶ້ນກ່ອນ ແລ້ວຄ່ອຍລາຍການທີ່ຕົງກັບຄຳກອງ
    return [
      ...designs.filter((option) => picked.has(option.code)),
      ...designs.filter((option) => !picked.has(option.code) && match(option)),
    ];
  }, [designs, picked, q]);

  if (!open) {
    return (
      <Button type="button" size="sm" tone="neutral" onClick={() => setOpen(true)}>
        <Shapes className="size-3.5" /> ຕັ້ງຮູບແບບ ({kit.designs.length})
      </Button>
    );
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="text-xs font-bold text-slate-700">ຮູບແບບທີ່ໝວດນີ້ຄຸມ</span>
        <input
          value={q}
          onChange={(event) => setQ(event.target.value)}
          placeholder="ກອງ (ລະຫັດ ຫຼື ຊື່)..."
          className={`${inputClass} h-8 w-56 text-xs`}
        />
        <span className="text-[11px] text-slate-500">ເລືອກແລ້ວ {picked.size}</span>
        <span className="ml-auto flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            tone="success"
            disabled={!dirty || saving}
            onClick={() =>
              startSaving(async () => {
                const result = await setInstallKitDesigns(kit.code, [...picked]);
                setMessage(result);
                if (result.ok) setOpen(false);
              })
            }
          >
            {saving ? (
              <LoaderCircle className="size-3.5 animate-spin" />
            ) : (
              <Save className="size-3.5" />
            )}
            ບັນທຶກ
          </Button>
          <Button
            type="button"
            size="sm"
            tone="neutral"
            onClick={() => {
              setPicked(new Set(current));
              setOpen(false);
              setMessage({});
            }}
          >
            <X className="size-3.5" /> ປິດ
          </Button>
        </span>
      </div>

      {designs.length === 0 ? (
        <p className="py-4 text-center text-xs text-slate-400">
          ອ່ານ ic_design ຈາກ ERP ບໍ່ໄດ້ — ລອງໂຫຼດໜ້າໃໝ່
        </p>
      ) : (
        <div className="grid max-h-56 grid-cols-1 gap-x-4 overflow-auto sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((option) => (
            <label
              key={option.code}
              className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-xs hover:bg-brand-50/60"
            >
              <input
                type="checkbox"
                checked={picked.has(option.code)}
                onChange={() =>
                  setPicked((prev) => {
                    const next = new Set(prev);
                    if (next.has(option.code)) next.delete(option.code);
                    else next.add(option.code);
                    return next;
                  })
                }
                className="size-4 shrink-0 accent-brand-700"
              />
              <span className="min-w-0 flex-1 truncate text-slate-700">{option.name_1}</span>
              <span className="shrink-0 font-mono text-[10px] text-slate-400">{option.code}</span>
            </label>
          ))}
        </div>
      )}

      {message.error && (
        <p className="mt-2 text-xs font-semibold text-brand-orange-700">{message.error}</p>
      )}
      {message.ok && <p className="mt-2 text-xs font-semibold text-brand-800">{message.ok}</p>}
    </div>
  );
}

/** ຟອມສ້າງ/ແກ້ໝວດ — ໃຊ້ຮ່ວມກັນ, ມີ `kit` = ໂໝດແກ້ */
function KitTypeForm({
  kit,
  sizes,
  nextCode = "",
  onDone,
}: {
  kit?: InstallKit;
  sizes: SizeOption[];
  nextCode?: string;
  onDone: () => void;
}) {
  const editing = !!kit;
  /**
   * ພັບຟອມລົງ **ໃນຕົວ action** ບໍ່ແມ່ນໃນ effect — ຟັງຊັນຂອງ useActionState ແລ່ນເປັນ
   * transition handler (setState ໄດ້ປົກກະຕິ) ຂະນະທີ່ setState ໃນ effect ເຮັດໃຫ້
   * render ຊ້ອນກັນ (react-hooks/set-state-in-effect).
   * ຄຳຢືນຢັນທີ່ຄົນເຫັນ = ລາຍການໝວດລຸ່ມນີ້ຖືກ revalidate ມາໃໝ່ພ້ອມຊື່/ຂະໜາດທີ່ແກ້.
   */
  const [state, formAction, pending] = useActionState<KitState, FormData>(
    async (previous, formData) => {
      const result = await (editing ? updateInstallKitType : addInstallKitType)(previous, formData);
      if (result.ok) onDone();
      return result;
    },
    {},
  );

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      {editing ? (
        <input type="hidden" name="install_type" value={kit.code} />
      ) : (
        <label className="text-xs text-slate-500">
          <span className={labelClass}>ລະຫັດໝວດ</span>
          <input
            name="install_type"
            required
            defaultValue={nextCode}
            placeholder="9900-0021"
            className={`${inputClass} h-9 w-36 font-mono`}
          />
        </label>
      )}

      <label className="text-xs text-slate-500">
        <span className={labelClass}>ຊື່ໝວດ (ຊ່ວງ BTU)</span>
        <input
          name="name_1"
          required
          defaultValue={kit?.name ?? ""}
          placeholder="20,000-29,999 btu."
          className={`${inputClass} h-9 w-56`}
        />
      </label>

      <div className="text-xs text-slate-500">
        <span className={labelClass}>ຂະໜາດ ERP (ic_size)</span>
        <div className="w-72">
          <SelectField
            name="ic_size"
            defaultValue={kit?.ic_size ?? ""}
            placeholder="ບໍ່ຜູກ (ບໍ່ຈັບຄູ່ອັດຕະໂນມັດ)"
            options={sizes.map((size) => ({
              value: size.code,
              label: `${size.code} ~ ${size.name_1}`,
            }))}
          />
        </div>
      </div>

      <label className="text-xs text-slate-500">
        <span className={labelClass}>ລຳດັບ</span>
        <input
          name="sort_order"
          type="number"
          step="10"
          defaultValue={kit?.sort_order ?? 0}
          title="ເລກໃຫຍ່ຂຶ້ນເທິງ — ໃຫ້ BTU ສູງຢູ່ເທິງ"
          className={`${inputClass} h-9 w-24 text-center tabular-nums`}
        />
      </label>

      {editing && (
        <label className="flex items-center gap-2 pb-2 text-xs font-semibold text-slate-600">
          <input type="checkbox" name="active" value="1" defaultChecked={kit.active} className="size-4 accent-brand-700" />
          ເປີດໃຊ້ງານ
        </label>
      )}

      <Button type="submit" size="sm" disabled={pending}>
        {pending ? <LoaderCircle className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
        {editing ? "ບັນທຶກໝວດ" : "ສ້າງໝວດ"}
      </Button>

      {state.error && <span className="pb-2 text-xs font-semibold text-brand-orange-700">{state.error}</span>}
      {state.ok && <span className="pb-2 text-xs font-semibold text-brand-800">{state.ok}</span>}
    </form>
  );
}

function LineRow({ line, index, can }: { line: InstallKitLine; index: number; can: KitPermission }) {
  const [state, formAction, pending] = useActionState<KitState, FormData>(updateInstallKitLine, {});
  // ຫົວໜ່ວຍມາພ້ອມຂໍ້ມູນຈາກ server (ດຶງເປັນກ້ອນດຽວ — ເບິ່ງ lib/install-kit itemUnitsMap)
  const units = line.units.length > 0 ? line.units : null;

  return (
    <tr className="border-b border-slate-100 last:border-0">
      <td className="px-3 py-2 text-center text-xs text-slate-400 tabular-nums">{index}</td>
      <td className="px-3 py-2 text-center font-mono text-xs text-slate-600">{line.ic_code}</td>
      <td className="px-3 py-2 text-slate-700">
        {line.item_name || "-"}
        {state.error && <span className="ml-2 text-xs text-brand-orange-700">{state.error}</span>}
      </td>
      <td className="px-3 py-2">
        <form action={formAction} className="flex items-center justify-center gap-2" id={`kit-${line.roworder}`}>
          <input type="hidden" name="roworder" value={line.roworder} />
          <input
            name="qty"
            type="number"
            min="0.01"
            step="0.01"
            defaultValue={line.qty}
            disabled={!can.update}
            className={`${inputClass} h-9 w-24 text-center tabular-nums`}
          />
        </form>
      </td>
      {/*
        ── ຫົວໜ່ວຍ = **ເລືອກ** ບໍ່ແມ່ນພິມ (19-08-2026) ──
        ຕົວເລືອກມາຈາກ `ic_unit_use` ຂອງສິນຄ້ານັ້ນ. ພິມມືແລ້ວຜິດ = ຈຳນວນຜິດຄວາມໝາຍ
        (140507-0334 ຂາຍເປັນ **ກິໂລ** ແຕ່ຕິດຕັ້ງເບີກເປັນ **ຕົວ** — lib/install-standard).
        ຍັງບໍ່ໂຫຼດ/ERP ລົ້ມ ⇒ ຕົກມາເປັນຊ່ອງພິມຄືເກົ່າ ຈະໄດ້ບໍ່ຕິດຢູ່.
      */}
      <td className="px-3 py-2 text-center">
        {units === null ? (
          <input
            form={`kit-${line.roworder}`}
            name="unit_code"
            defaultValue={line.unit_code ?? ""}
            disabled={!can.update}
            placeholder="-"
            className={`${inputClass} h-9 w-24 text-center`}
          />
        ) : (
          <select
            form={`kit-${line.roworder}`}
            name="unit_code"
            defaultValue={line.unit_code ?? ""}
            disabled={!can.update}
            className={`${inputClass} h-9 w-28 text-center`}
          >
            <option value="">(ຕາມ ERP)</option>
            {unitOptions(units, line.unit_code).map((unit) => (
              <option key={unit} value={unit}>
                {unit}
              </option>
            ))}
          </select>
        )}
      </td>
      <td className="px-3 py-2">
        <span className="flex items-center justify-center gap-2">
          {can.update && (
            <Button form={`kit-${line.roworder}`} type="submit" size="sm" tone="neutral" disabled={pending}>
              <Save className="size-3.5" /> ບັນທຶກ
            </Button>
          )}
          {can.delete && (
            <UndoButton
              variant="icon"
              label="ຖອດອອກຈາກຊຸດ"
              title="ຖອດລາຍການນີ້ອອກ?"
              message={
                <>
                  <b className="text-slate-700">{line.item_name || line.ic_code}</b> ຈະບໍ່ຖືກໃສ່ໃຫ້ງານໃໝ່ອີກ
                  (ງານທີ່ເປີດໄປແລ້ວບໍ່ຖືກແຕະ)
                </>
              }
              action={() => deleteInstallKitLine(line.roworder)}
            />
          )}
        </span>
      </td>
    </tr>
  );
}

/** ຫົວໜ່ວຍທີ່ບັນທຶກໄວ້ ຕ້ອງຢູ່ໃນລາຍການສະເໝີ — ບໍ່ດັ່ງນັ້ນ select ຈະເດັ້ງເປັນຄ່າອື່ນງຽບໆ */
function unitOptions(units: string[], current: string | null): string[] {
  if (current && !units.includes(current)) return [current, ...units];
  return units;
}

/**
 * ຫົວໜ່ວຍຂອງສິນຄ້າ 1 ຕົວ — `null` = ຍັງບໍ່ຮູ້ (ກຳລັງໂຫຼດ ຫຼື ບໍ່ໄດ້ຖາມ) ⇒ ໃຫ້ຄົນເອີ້ນ
 * ຕົກມາໃຊ້ຊ່ອງພິມ. ຖາມທີລະແຖວແບບ lazy — ໜ້ານີ້ມີບໍ່ຫຼາຍແຖວຕໍ່ໝວດ.
 */
function useItemUnits(itemCode: string): string[] | null {
  const [units, setUnits] = useState<string[] | null>(null);
  useEffect(() => {
    if (!itemCode) return;
    const controller = new AbortController();
    (async () => {
      try {
        const response = await fetch(
          `/api/manage/install-kits/items?units=${encodeURIComponent(itemCode)}`,
          { signal: controller.signal },
        );
        const json = await response.json();
        if (Array.isArray(json.units) && json.units.length) setUnits(json.units);
      } catch {
        // ERP ລົ້ມ/ຍົກເລີກ ⇒ ປະໄວ້ null ໃຫ້ຕົກມາເປັນຊ່ອງພິມ
      }
    })();
    return () => controller.abort();
  }, [itemCode]);
  return units;
}

function AddLineForm({ installType }: { installType: string }) {
  const [picked, setPicked] = useState<ErpItem | null>(null);
  const units = useItemUnits(picked?.code ?? "");
  // ເພີ່ມສຳເລັດ ⇒ ລ້າງລາຍການທີ່ເລືອກ ໃຫ້ພ້ອມເພີ່ມຕົວຖັດໄປ (ຢູ່ໃນ action ບໍ່ແມ່ນ effect)
  const [state, formAction, pending] = useActionState<KitState, FormData>(
    async (previous, formData) => {
      const result = await addInstallKitLine(previous, formData);
      if (result.ok) setPicked(null);
      return result;
    },
    {},
  );

  return (
    <form action={formAction} className="mt-4 space-y-3 border-t border-slate-100 pt-4">
      <input type="hidden" name="install_type" value={installType} />
      <input type="hidden" name="ic_code" value={picked?.code ?? ""} />

      <ItemPicker picked={picked} onPick={setPicked} />

      {picked && (
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-xs text-slate-500">
            <span className={labelClass}>ຈຳນວນ</span>
            <input
              name="qty"
              type="number"
              min="0.01"
              step="0.01"
              defaultValue={1}
              className={`${inputClass} h-9 w-24 text-center tabular-nums`}
            />
          </label>
          <label className="text-xs text-slate-500">
            <span className={labelClass}>ຫົວໜ່ວຍ</span>
            {units === null ? (
              <input name="unit_code" placeholder="ຕາມ ERP" className={`${inputClass} h-9 w-28 text-center`} />
            ) : (
              <select name="unit_code" defaultValue="" className={`${inputClass} h-9 w-32 text-center`}>
                <option value="">(ຕາມ ERP: {picked.unit_code || "-"})</option>
                {units.map((unit) => (
                  <option key={unit} value={unit}>
                    {unit}
                  </option>
                ))}
              </select>
            )}
          </label>
          <Button type="submit" size="sm" disabled={pending}>
            {pending ? <LoaderCircle className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
            ເພີ່ມເຂົ້າຊຸດ
          </Button>
        </div>
      )}

      {state.error && <p className="text-xs font-semibold text-brand-orange-700">{state.error}</p>}
      {state.ok && <p className="text-xs font-semibold text-brand-800">{state.ok}</p>}
    </form>
  );
}

/**
 * ຄົ້ນຫາອາໄຫຼ່ຈາກ ERP (`ic_inventory`) ແລ້ວເລືອກ 1 ຕົວ.
 * ເມື່ອກ່ອນເປັນ**ຊ່ອງພິມລະຫັດ** ⇒ ຕ້ອງຮູ້ລະຫັດຢູ່ຫົວກ່ອນ (140507-0200) ບໍ່ດັ່ງນັ້ນ
 * ໄປເປີດ ERP ຫາເອົາ. ດຽວນີ້ພິມຊື່ຄົ້ນໄດ້.
 */
function ItemPicker({ picked, onPick }: { picked: ErpItem | null; onPick: (item: ErpItem | null) => void }) {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<ErpItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const keyword = q.trim();
    if (keyword.length < 2) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch(
          `/api/manage/install-kits/items?q=${encodeURIComponent(keyword)}`,
          { signal: controller.signal },
        );
        const json = await response.json();
        setRows(json.data ?? []);
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) setRows([]);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [q]);

  if (picked) {
    return (
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-brand-200 bg-brand-50/60 px-3 py-2">
        <span className="font-mono text-xs font-bold text-brand-800">{picked.code}</span>
        <span className="text-sm font-semibold text-slate-700">{picked.name_1}</span>
        <button
          type="button"
          onClick={() => onPick(null)}
          className="ml-auto text-xs font-semibold text-slate-500 underline hover:text-brand-orange-700"
        >
          ປ່ຽນລາຍການ
        </button>
      </div>
    );
  }

  const keyword = q.trim();
  return (
    <div>
      <label className="flex h-10 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 focus-within:border-brand-600">
        <Search className="size-4 shrink-0 text-slate-400" />
        <input
          value={q}
          onChange={(event) => setQ(event.target.value)}
          placeholder="ຄົ້ນຫາອາໄຫຼ່ຈາກ ERP — ພິມລະຫັດ ຫຼື ຊື່ (2 ຕົວອັກສອນຂຶ້ນໄປ)"
          className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
        />
      </label>
      {keyword.length >= 2 && (
        <div className="mt-2 max-h-64 overflow-auto rounded-lg border border-slate-200">
          {rows.map((row) => (
            <button
              key={row.code}
              type="button"
              onClick={() => {
                onPick(row);
                setQ("");
                setRows([]);
              }}
              className="flex w-full items-center gap-3 border-b border-slate-100 px-3 py-2 text-left last:border-0 hover:bg-brand-50/60"
            >
              <span className="font-mono text-xs text-slate-500">{row.code}</span>
              <span className="min-w-0 flex-1 truncate text-sm text-slate-700">{row.name_1}</span>
              <span className="shrink-0 text-xs text-slate-400">{row.unit_code || "-"}</span>
            </button>
          ))}
          {!loading && rows.length === 0 && (
            <p className="py-6 text-center text-xs text-slate-400">ບໍ່ພົບລາຍການ</p>
          )}
          {loading && <p className="py-6 text-center text-xs text-slate-400">ກຳລັງຄົ້ນຫາ...</p>}
        </div>
      )}
    </div>
  );
}
