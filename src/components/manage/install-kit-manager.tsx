"use client";
import { addInstallKitLine, deleteInstallKitLine, updateInstallKitLine, type KitState } from "@/app/actions/install-kit";
import { UndoButton } from "@/components/checking/undo-button";
import { Button, Card, Empty, Table, inputClass } from "@/components/ui";
import type { InstallKit, InstallKitLine } from "@/lib/install-kit";
import { Package, Plus, Save } from "lucide-react";
import { useActionState } from "react";

/**
 * ── ຈັດການຊຸດອາໄຫຼ່ມາດຕະຖານຂອງງານຕິດຕັ້ງ ──
 *
 * ປຸ່ມແຕ່ລະອັນ**ຜູກກັບ action ຂອງຕົນເອງ** (ເພີ່ມ=create · ບັນທຶກ=update · ລົບ=delete)
 * ⇒ ຜູ້ຈັດການຕິກ "ແກ້ໄຂ" ຢ່າງດຽວ ກໍ່ໄດ້ແຕ່ປຸ່ມບັນທຶກຈິງ. ດ່ານຈິງຢູ່ຝັ່ງ server
 * (actions/install-kit) ເພາະ server action ຖືກຍິງໂດຍກົງໄດ້ — ຢູ່ນີ້ພຽງບໍ່ໃຫ້ກົດຫຼິ້ນ.
 */
export type KitPermission = { create: boolean; update: boolean; delete: boolean };

export function InstallKitManager({ kits, can }: { kits: InstallKit[]; can: KitPermission }) {
  return (
    <div className="space-y-4">
      {kits.map((kit) => (
        <KitCard key={kit.code} kit={kit} can={can} />
      ))}
    </div>
  );
}

function KitCard({ kit, can }: { kit: InstallKit; can: KitPermission }) {
  const total = kit.lines.reduce((sum, line) => sum + line.qty, 0);
  return (
    <Card
      title={
        <span className="flex flex-wrap items-center gap-2">
          <Package className="size-4 text-brand-700" />
          <span className="font-mono">{kit.code}</span>
          {kit.size_name && <span className="text-sm font-normal text-slate-500">{kit.size_name}</span>}
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
        </span>
      }
    >
      {kit.lines.length === 0 ? (
        <Empty>
          ຊຸດນີ້ຍັງບໍ່ມີລາຍການ — ງານໃໝ່ຂອງຂະໜາດນີ້ຈະ<b> ຂ້າມຂັ້ນເບີກອາໄຫຼ່ </b>
          (ຍົກເວັ້ນແອ ທີ່ບັງຄັບເຂົ້າຂະບວນການສະເໝີ)
        </Empty>
      ) : (
        <Table
          minWidth={860}
          head={["#", "ລະຫັດອາໄຫຼ່", "ຊື່ລາຍການ", "ຈຳນວນ", "ຫົວໜ່ວຍ", ""]}
        >
          {kit.lines.map((line, index) => (
            <LineRow key={line.roworder} line={line} index={index + 1} can={can} />
          ))}
        </Table>
      )}

      {can.create && <AddLineForm installType={kit.code} />}
    </Card>
  );
}

function LineRow({ line, index, can }: { line: InstallKitLine; index: number; can: KitPermission }) {
  const [state, formAction, pending] = useActionState<KitState, FormData>(updateInstallKitLine, {});
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
      <td className="px-3 py-2 text-center">
        <input
          form={`kit-${line.roworder}`}
          name="unit_code"
          defaultValue={line.unit_code ?? ""}
          disabled={!can.update}
          placeholder="-"
          className={`${inputClass} h-9 w-24 text-center`}
        />
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

function AddLineForm({ installType }: { installType: string }) {
  const [state, formAction, pending] = useActionState<KitState, FormData>(addInstallKitLine, {});
  return (
    <form action={formAction} className="mt-4 flex flex-wrap items-end gap-2 border-t border-slate-100 pt-4">
      <input type="hidden" name="install_type" value={installType} />
      <label className="text-xs text-slate-500">
        ລະຫັດອາໄຫຼ່ (ERP)
        <input name="ic_code" required placeholder="140507-0200" className={`${inputClass} mt-1 h-9 w-48 font-mono`} />
      </label>
      <label className="text-xs text-slate-500">
        ຈຳນວນ
        <input name="qty" type="number" min="0.01" step="0.01" defaultValue={1} className={`${inputClass} mt-1 h-9 w-24 text-center tabular-nums`} />
      </label>
      <label className="text-xs text-slate-500">
        ຫົວໜ່ວຍ
        <input name="unit_code" placeholder="ຕາມ ERP" className={`${inputClass} mt-1 h-9 w-28 text-center`} />
      </label>
      <Button type="submit" size="sm" disabled={pending}>
        <Plus className="size-3.5" /> ເພີ່ມເຂົ້າຊຸດ
      </Button>
      {state.error && <span className="text-xs font-semibold text-brand-orange-700">{state.error}</span>}
      {state.ok && <span className="text-xs font-semibold text-brand-800">{state.ok}</span>}
    </form>
  );
}
