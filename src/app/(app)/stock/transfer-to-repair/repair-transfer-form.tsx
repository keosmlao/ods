"use client";
import { saveRepairTransfer, type StockState } from "@/app/actions/stock";
import { SpareSearchDialog } from "@/components/spare-search";
import { AlertTriangle, CheckCircle2, Plus, Trash2, Truck } from "lucide-react";
import { useActionState, useState } from "react";

type Line = { item_code: string; item_name: string; unit_code: string | null; qty: number };

/**
 * ຂໍໂອນອາໄຫຼ່ມາຫ້ອງສ້ອມ (ບໍ່ຜ່ານໃບຂໍເບີກ) — ໃບ 124 ເປັນ "ຄຳຂໍ" ໃຫ້ສາງໃຫຍ່ໂອນ,
 * ບໍ່ຕັດສະຕ໋ອກ. ຂອງມາຮອດແລ້ວກົດ "ຮັບ" ທີ່ /stock/transfers.
 */
export function RepairTransferForm({ warehouses }: { warehouses: { code: string; name: string }[] }) {
  const [lines, setLines] = useState<Line[]>([]);
  const [toWh, setToWh] = useState("");
  const [remark, setRemark] = useState("");
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<StockState, FormData>(saveRepairTransfer, {});

  const submit = (formData: FormData) => {
    formData.set("items", JSON.stringify(lines));
    formData.set("to_wh", toWh);
    formData.set("remark", remark);
    return action(formData);
  };

  return (
    <form action={submit} className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <label className="mb-1 block text-xs font-bold text-slate-600">ສາງຫ້ອງສ້ອມ (ປາຍທາງ)</label>
        <select
          value={toWh}
          onChange={(event) => setToWh(event.target.value)}
          required
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="">— ເລືອກສາງ —</option>
          {warehouses.map((wh) => (
            <option key={wh.code} value={wh.code}>
              {wh.code} · {wh.name}
            </option>
          ))}
        </select>
        <p className="mt-1 text-[11px] text-slate-400">ຕົ້ນທາງ = ສາງອາໄຫຼ່ 1204 · ໃບນີ້ບໍ່ຕັດສະຕ໋ອກ (ຄຳຂໍໃຫ້ສາງໃຫຍ່ໂອນ)</p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between border-b border-slate-100 pb-2">
          <h2 className="text-sm font-bold text-slate-700">ອາໄຫຼ່ທີ່ຂໍໂອນ ({lines.length})</h2>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-teal-600 px-3 text-xs font-semibold text-white hover:bg-teal-700"
          >
            <Plus className="size-3.5" /> ເພີ່ມອາໄຫຼ່
          </button>
        </div>
        {lines.length === 0 ? (
          <p className="py-2 text-center text-xs text-slate-400">ຍັງບໍ່ມີ — ກົດ &quot;ເພີ່ມອາໄຫຼ່&quot;</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {lines.map((line, index) => (
              <li key={line.item_code} className="flex items-center gap-2 py-2 text-sm">
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-slate-700" title={line.item_name}>{line.item_name}</span>
                  <span className="text-[11px] text-slate-400">{line.item_code}</span>
                </span>
                <input
                  type="number"
                  min={1}
                  value={line.qty}
                  onChange={(event) =>
                    setLines((rows) =>
                      rows.map((row, i) => (i === index ? { ...row, qty: Math.max(1, Number(event.target.value) || 1) } : row)),
                    )
                  }
                  className="w-16 rounded border border-slate-300 px-2 py-1 text-center text-sm"
                />
                <span className="w-10 text-[11px] text-slate-400">{line.unit_code}</span>
                <button
                  type="button"
                  onClick={() => setLines((rows) => rows.filter((_, i) => i !== index))}
                  className="rounded p-1.5 text-red-600 hover:bg-red-50"
                >
                  <Trash2 className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <input
        value={remark}
        onChange={(event) => setRemark(event.target.value)}
        placeholder="ໝາຍເຫດ (ບໍ່ບັງຄັບ)"
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
      />

      {state.error && (
        <p className="flex items-center gap-1.5 text-sm font-medium text-red-600">
          <AlertTriangle className="size-4 shrink-0" /> {state.error}
        </p>
      )}
      {state.ok && (
        <p className="flex items-center gap-1.5 text-sm font-medium text-emerald-700">
          <CheckCircle2 className="size-4 shrink-0" /> {state.ok}
        </p>
      )}

      <button
        type="submit"
        disabled={pending || !toWh || lines.length === 0}
        className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 text-sm font-bold text-white hover:bg-slate-800 disabled:opacity-50"
      >
        <Truck className="size-4" /> {pending ? "ກຳລັງສ້າງໃບຂໍໂອນ..." : "ສ້າງໃບຂໍໂອນມາຫ້ອງສ້ອມ"}
      </button>

      {open && (
        <SpareSearchDialog
          chosen={new Set(lines.map((line) => line.item_code))}
          onAdd={async (item, qty) => {
            setLines((rows) => [
              ...rows,
              { item_code: item.code, item_name: item.name_1, unit_code: item.unit_code, qty },
            ]);
          }}
          onClose={() => setOpen(false)}
        />
      )}
    </form>
  );
}
