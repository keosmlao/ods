"use client";
import {
  createSubstituteGroup,
  deleteSubstituteGroup,
  updateSubstituteGroup,
  type SubState,
} from "@/app/actions/spare-substitute";
import { UndoButton } from "@/components/checking/undo-button";
import { Button, Card, Empty, inputClass, labelClass } from "@/components/ui";
import type { SubstituteGroup } from "@/lib/spare-substitute";
import { ArrowLeftRight, LoaderCircle, Plus, Save, Search, X } from "lucide-react";
import { useEffect, useState, useTransition } from "react";

/**
 * ── ຈັດການ **ກຸ່ມອາໄຫຼ່ທົດແທນກັນ** ──
 *
 * ຕອບຄຳຖາມ "ອາໄຫຼ່ຕົວນີ້ໃຊ້ຫຍັງແທນໄດ້" — ຕົວຢ່າງຈິງ: ທໍ່ PVC ສີເຫຼືອງ 3/8 ມີ 4 ລະຫັດ
 * ຕ່າງແຕ່ຍີ່ຫໍ້ (ກາOK · NPI ຊ້າງ · ເສືອ SCG …) ຊຸດມາດຕະຖານລະບຸແຕ່ຕົວດຽວ ⇒ ສາງມີແຕ່
 * ຍີ່ຫໍ້ອື່ນກໍ່ເບີກແທນໄດ້.
 *
 * **ກຸ່ມສາກົນ**: ໃສ່ເທື່ອດຽວ ໃຊ້ທຸກໝວດຊຸດ (130201-0206 ຢູ່ໃນທັງ 5 ໝວດ ⇒ ຖ້າກຳນົດ
 * ຕໍ່ໝວດຈະຕ້ອງໃສ່ 5 ເທື່ອ). **1 ສິນຄ້າ = 1 ກຸ່ມ** ⇒ ຄຳຕອບບໍ່ກຳກວມ.
 */
type ErpItem = { code: string; name_1: string; unit_code: string | null };

export type SubPermission = { create: boolean; update: boolean; delete: boolean };

export function SpareSubstituteManager({
  groups,
  can,
}: {
  groups: SubstituteGroup[];
  can: SubPermission;
}) {
  const [adding, setAdding] = useState(false);

  return (
    <Card
      title={
        <span className="flex items-center gap-2">
          <ArrowLeftRight className="size-4 text-brand-700" />
          ອາໄຫຼ່ທີ່ໃຊ້ທົດແທນກັນໄດ້ ({groups.length} ກຸ່ມ)
        </span>
      }
      actions={
        can.create && (
          <Button
            type="button"
            size="sm"
            tone={adding ? "neutral" : "primary"}
            onClick={() => setAdding((value) => !value)}
          >
            {adding ? <X className="size-3.5" /> : <Plus className="size-3.5" />}
            {adding ? "ຍົກເລີກ" : "ເພີ່ມກຸ່ມ"}
          </Button>
        )
      }
    >
      <p className="mb-3 rounded-lg bg-brand-50 px-3 py-2 text-[11px] leading-relaxed text-brand-800">
        ລາຍການໃນກຸ່ມດຽວກັນ ຖືວ່າ<b> ໃຊ້ແທນກັນໄດ້ </b>— ຕອນເພີ່ມອາໄຫຼ່ໃສ່ໃບງານ ຕົວທົດແທນ
        ຈະຂຶ້ນໃຫ້ເລືອກ ແລະ ນັບເປັນ<b> ອາໄຫຼ່ຕາມມາດຕະຖານ </b>ນຳ. ໃຊ້ຮ່ວມທຸກໝວດ (ໃສ່ເທື່ອດຽວ)
        ແລະ 1 ລາຍການຢູ່ໄດ້ກຸ່ມດຽວ.
      </p>

      {adding && can.create && (
        <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50/60 p-3">
          <GroupForm onDone={() => setAdding(false)} />
        </div>
      )}

      {groups.length === 0 ? (
        <Empty>ຍັງບໍ່ມີກຸ່ມທົດແທນ — ກົດ &quot;ເພີ່ມກຸ່ມ&quot; ເພື່ອກຳນົດ</Empty>
      ) : (
        <div className="space-y-2">
          {groups.map((group) => (
            <GroupRow key={group.group_id} group={group} can={can} />
          ))}
        </div>
      )}
    </Card>
  );
}

function GroupRow({ group, can }: { group: SubstituteGroup; can: SubPermission }) {
  const [editing, setEditing] = useState(false);

  if (editing && can.update) {
    return (
      <div className="rounded-lg border border-brand-200 bg-white p-3">
        <GroupForm group={group} onDone={() => setEditing(false)} />
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="text-xs font-bold text-slate-700">{group.name_1 || `ກຸ່ມ #${group.group_id}`}</span>
        <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
          {group.items.length} ລາຍການ
        </span>
        <span className="ml-auto flex items-center gap-2">
          {can.update && (
            <Button type="button" size="sm" tone="neutral" onClick={() => setEditing(true)}>
              <Save className="size-3.5" /> ແກ້ໄຂ
            </Button>
          )}
          {can.delete && (
            <UndoButton
              variant="icon"
              label="ລົບກຸ່ມນີ້"
              title={`ລົບກຸ່ມ ${group.name_1 || group.group_id}?`}
              message={
                <>
                  ລາຍການ {group.items.length} ຕົວຈະ<b> ບໍ່ຖືວ່າແທນກັນໄດ້ </b>ອີກ.
                  ອາໄຫຼ່ທີ່ຖືກເລືອກໃສ່ໃບງານໄປແລ້ວ<b> ບໍ່ຖືກແຕະ</b>.
                </>
              }
              action={() => deleteSubstituteGroup(group.group_id)}
            />
          )}
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {group.items.map((item) => (
          <span
            key={item.ic_code}
            className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] text-brand-800"
          >
            <span className="font-mono text-[10px] text-brand-700">{item.ic_code}</span>{" "}
            {item.name_1 ?? <i className="text-slate-400">(ບໍ່ພົບຊື່ໃນ ERP)</i>}
            {item.unit_code && <span className="text-slate-400"> · {item.unit_code}</span>}
          </span>
        ))}
      </div>
    </div>
  );
}

/** ຟອມສ້າງ/ແກ້ກຸ່ມ — `group` ມີຄ່າ = ໂໝດແກ້ */
function GroupForm({ group, onDone }: { group?: SubstituteGroup; onDone: () => void }) {
  const [name, setName] = useState(group?.name_1 ?? "");
  const [items, setItems] = useState<ErpItem[]>(
    () =>
      group?.items.map((item) => ({
        code: item.ic_code,
        name_1: item.name_1 ?? item.ic_code,
        unit_code: item.unit_code,
      })) ?? [],
  );
  const [state, setState] = useState<SubState>({});
  const [saving, startSaving] = useTransition();

  const save = () =>
    startSaving(async () => {
      const codes = items.map((item) => item.code);
      const result = group
        ? await updateSubstituteGroup(group.group_id, name, codes)
        : await createSubstituteGroup(name, codes);
      setState(result);
      if (result.ok) onDone();
    });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-xs text-slate-500">
          <span className={labelClass}>ຊື່ກຸ່ມ</span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="ທໍ່ PVC ສີເຫຼືອງ 3/8 (1ມັດ=50 ເສັ້ນ)"
            className={`${inputClass} h-9 w-80`}
          />
        </label>
        <Button
          type="button"
          size="sm"
          tone="success"
          disabled={saving || items.length < 2 || !name.trim()}
          onClick={save}
        >
          {saving ? <LoaderCircle className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
          {group ? "ບັນທຶກກຸ່ມ" : "ສ້າງກຸ່ມ"}
        </Button>
        <Button type="button" size="sm" tone="neutral" onClick={onDone}>
          <X className="size-3.5" /> ປິດ
        </Button>
        {items.length < 2 && (
          <span className="pb-2 text-[11px] font-semibold text-brand-orange-700">
            ຕ້ອງມີ 2 ລາຍການຂຶ້ນໄປ
          </span>
        )}
      </div>

      {items.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {items.map((item) => (
            <span
              key={item.code}
              className="flex items-center gap-1.5 rounded-full bg-brand-50 px-2 py-1 text-[11px] text-brand-800"
            >
              <span className="font-mono text-[10px] text-brand-700">{item.code}</span>
              <span className="max-w-72 truncate">{item.name_1}</span>
              <button
                type="button"
                aria-label={`ຖອດ ${item.code}`}
                onClick={() => setItems((prev) => prev.filter((row) => row.code !== item.code))}
                className="text-slate-400 hover:text-brand-orange-700"
              >
                <X className="size-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      <ItemSearch
        exclude={new Set(items.map((item) => item.code))}
        onPick={(item) => setItems((prev) => [...prev, item])}
      />

      {state.error && <p className="text-xs font-semibold text-brand-orange-700">{state.error}</p>}
      {state.ok && <p className="text-xs font-semibold text-brand-800">{state.ok}</p>}
    </div>
  );
}

/** ຄົ້ນ ERP ເພື່ອຕື່ມສະມາຊິກ — ໃຊ້ route ອັນດຽວກັບໜ້າຊຸດອາໄຫຼ່ (ສິດດຽວກັນ) */
function ItemSearch({
  exclude,
  onPick,
}: {
  exclude: Set<string>;
  onPick: (item: ErpItem) => void;
}) {
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

  const keyword = q.trim();
  const visible = rows.filter((row) => !exclude.has(row.code));

  return (
    <div>
      <label className="flex h-9 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 focus-within:border-brand-600">
        <Search className="size-4 shrink-0 text-slate-400" />
        <input
          value={q}
          onChange={(event) => setQ(event.target.value)}
          placeholder="ຄົ້ນ ERP ເພື່ອຕື່ມລາຍການ — ລະຫັດ ຫຼື ຊື່ (2 ຕົວອັກສອນຂຶ້ນໄປ)"
          className="w-full bg-transparent text-xs outline-none placeholder:text-slate-400"
        />
      </label>
      {keyword.length >= 2 && (
        <div className="mt-2 max-h-48 overflow-auto rounded-lg border border-slate-200">
          {visible.map((row) => (
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
              <span className="font-mono text-[10px] text-slate-500">{row.code}</span>
              <span className="min-w-0 flex-1 truncate text-xs text-slate-700">{row.name_1}</span>
              <span className="shrink-0 text-[10px] text-slate-400">{row.unit_code || "-"}</span>
            </button>
          ))}
          {!loading && visible.length === 0 && (
            <p className="py-5 text-center text-xs text-slate-400">ບໍ່ພົບລາຍການ</p>
          )}
          {loading && <p className="py-5 text-center text-xs text-slate-400">ກຳລັງຄົ້ນຫາ...</p>}
        </div>
      )}
    </div>
  );
}
