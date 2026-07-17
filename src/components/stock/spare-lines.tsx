"use client";

import { deleteSpareFromRequest, updateSpareQty } from "@/app/actions/stock";
import { Button, Card, Empty, Table, inputClass } from "@/components/ui";
import { AlertTriangle, Boxes, CheckCircle2, Plus, Trash2, Warehouse } from "lucide-react";

export type SpareLine = {
  rnum: number;
  item_code: string;
  item_name: string | null;
  qty: string;
  unit_code: string | null;
  roworder: number;
};

export type SpareBalance = {
  total: number;
  byWarehouse: Record<string, number>;
  byLocation: Record<string, number>;
};

/** ຕາຕະລາງ "ອາໄຫຼ່ທີ່ໃຊ້" — ອ່ານຢ່າງດຽວ (ໃຊ້ໃນໜ້າເບີກ/ສົ່ງຄືນ/ເບິ່ງບິນ) */
export function SpareLineTable({ lines }: { lines: Omit<SpareLine, "roworder">[] }) {
  return (
    <Card title="ອາໄຫຼ່ທີ່ໃຊ້">
      {lines.length === 0 ? (
        <Empty />
      ) : (
        <Table head={["#", "ລະຫັດສິນຄ້າ", "ຊື່ສິນຄ້າ", "ຈຳນວນ", "ຫົວໜ່ວຍ"]} minWidth={700}>
          {lines.map((line, index) => (
            <tr key={`${line.item_code}-${index}`} className="border-b border-slate-100">
              <td className="px-3 py-3 text-center">{line.rnum}</td>
              <td className="px-3 py-3">{line.item_code}</td>
              <td className="px-3 py-3">{line.item_name ?? "-"}</td>
              <td className="px-3 py-3 text-center">{Number(line.qty)}</td>
              <td className="px-3 py-3 text-center">{line.unit_code ?? "-"}</td>
            </tr>
          ))}
        </Table>
      )}
    </Card>
  );
}

/**
 * ຕາຕະລາງ "ອາໄຫຼ່ທີ່ໃຊ້" ແບບແກ້ໄຂໄດ້ (ໜ້າສ້າງໃບຂໍເບີກ — tb_used_spare).
 * ods ຈື່ roworder ໄວ້ໃນ Flask session — ຢູ່ນີ້ສົ່ງມາທາງ hidden field ແທນ.
 */
export function EditableSpareLines({
  lines,
  roworder,
  balances,
  selectedWarehouse,
  selectedShelf,
  warehouseLabel,
  onAddSpare,
}: {
  lines: SpareLine[];
  roworder: string;
  balances: Record<string, SpareBalance>;
  selectedWarehouse: string;
  selectedShelf: string;
  warehouseLabel?: string;
  onAddSpare: () => void;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
        <div className="flex items-center gap-3">
          <span className="grid size-9 place-items-center rounded-xl bg-sky-50 text-sky-700">
            <Boxes className="size-4.5" />
          </span>
          <div>
            <h2 className="text-sm font-bold text-slate-800">ລາຍການອາໄຫຼ່ທີ່ຂໍເບີກ</h2>
            <p className="mt-0.5 text-[11px] text-slate-400">
              {selectedWarehouse
                ? `ກຳລັງກວດຍອດຈາກ ${warehouseLabel ?? selectedWarehouse}${selectedShelf ? ` / ${selectedShelf}` : ""}`
                : "ເລືອກສາງດ້ານເທິງ ເພື່ອກວດຈຳນວນຄົງເຫຼືອ"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {selectedWarehouse ? (
            <span className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-emerald-50 px-3 text-[11px] font-semibold text-emerald-700">
              <Warehouse className="size-3.5" />
              {selectedWarehouse}{selectedShelf ? ` / ${selectedShelf}` : ""}
            </span>
          ) : (
            <span className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-amber-50 px-3 text-[11px] font-semibold text-amber-700">
              <AlertTriangle className="size-3.5" />
              ຍັງບໍ່ເລືອກສາງ
            </span>
          )}
          <Button type="button" tone="info" className="h-8 px-3 text-xs" onClick={onAddSpare}>
            <Plus className="size-4" />
            ເພີ່ມອາໄຫຼ່
          </Button>
        </div>
      </div>

      {lines.length === 0 ? (
        <div className="p-5"><Empty /></div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-slate-500">
                <th className="w-14 px-4 py-3 text-center font-semibold">#</th>
                <th className="px-4 py-3 font-semibold">ອາໄຫຼ່</th>
                <th className="w-32 px-4 py-3 text-center font-semibold">ຈຳນວນຂໍ</th>
                <th className="w-36 px-4 py-3 text-right font-semibold">ຄົງເຫຼືອສາງນີ້</th>
                <th className="w-32 px-4 py-3 text-right font-semibold">ຄົງເຫຼືອລວມ</th>
                <th className="w-36 px-4 py-3 text-center font-semibold">ກວດສອບ</th>
                <th className="w-16 px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {lines.map((line) => {
                const balance = balances[line.item_code] ?? { total: 0, byWarehouse: {}, byLocation: {} };
                const selectedBalance = !selectedWarehouse
                  ? null
                  : selectedShelf
                    ? balance.byLocation[`${selectedWarehouse}:${selectedShelf}`] ?? 0
                    : balance.byWarehouse[selectedWarehouse] ?? 0;
                const requestedQty = Number(line.qty);
                const enough = selectedBalance !== null && selectedBalance >= requestedQty;
                return (
                  <tr key={line.roworder} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60">
                    <td className="px-4 py-3 text-center text-slate-400">{line.rnum}</td>
                    <td className="px-4 py-3">
                      <span className="block font-semibold text-slate-800">{line.item_name ?? "-"}</span>
                      <span className="mt-0.5 block font-mono text-[10px] text-slate-400">{line.item_code} · {line.unit_code ?? "-"}</span>
                    </td>
                    <td className="px-4 py-2">
                      <form action={updateSpareQty} className="flex justify-center">
                        <input type="hidden" name="roworder" value={roworder} />
                        <input type="hidden" name="row_id" value={line.roworder} />
                        <input
                          type="number"
                          name="reg_qty"
                          min="1"
                          step="any"
                          defaultValue={requestedQty}
                          aria-label={`ຈຳນວນ ${line.item_name ?? line.item_code}`}
                          className={`${inputClass} h-9 w-24 text-center font-semibold`}
                        />
                      </form>
                    </td>
                    <td className={`px-4 py-3 text-right text-sm font-bold tabular-nums ${selectedBalance === null ? "text-slate-300" : enough ? "text-emerald-600" : "text-red-600"}`}>
                      {selectedBalance === null ? "—" : selectedBalance.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums text-slate-600">
                      {balance.total.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {selectedBalance === null ? (
                        <span className="rounded-md bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-500">ເລືອກສາງກ່ອນ</span>
                      ) : enough ? (
                        <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-700">
                          <CheckCircle2 className="size-3" /> ພຽງພໍ
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-md bg-red-50 px-2 py-1 text-[10px] font-semibold text-red-700">
                          <AlertTriangle className="size-3" /> ຂາດ {Math.max(0, requestedQty - selectedBalance).toLocaleString()}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <form action={deleteSpareFromRequest}>
                        <input type="hidden" name="roworder" value={roworder} />
                        <input type="hidden" name="row_id" value={line.roworder} />
                        <button type="submit" title="ລຶບ" className="rounded-lg p-2 text-[#DE3163] hover:bg-red-50">
                          <Trash2 className="size-4" />
                        </button>
                      </form>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <div className="border-t border-slate-100 bg-slate-50/70 px-5 py-2.5 text-[11px] text-slate-400">
        ປ່ຽນຈຳນວນແລ້ວກົດ Enter ເພື່ອບັນທຶກ · ຖ້າສາງນີ້ບໍ່ພຽງພໍ ຍັງສາມາດສົ່ງຄຳຂໍເພື່ອໃຫ້ສາງດຳເນີນການສັ່ງຊື້
      </div>
    </section>
  );
}
