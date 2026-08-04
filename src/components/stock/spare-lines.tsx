"use client";

import { deleteSpareFromRequest } from "@/app/actions/stock";
import { REQUEST_FORM_ID } from "@/components/stock/request-form";
import { Button, Card, Empty, Table, inputClass } from "@/components/ui";
import { useDict } from "@/lib/i18n/context";
import { takeField } from "@/lib/spare-take";
import { AlertTriangle, Boxes, CheckCircle2, Plus, Trash2, Warehouse } from "lucide-react";

export type SpareLine = {
  rnum: number;
  item_code: string;
  item_name: string | null;
  qty: string;
  unit_code: string | null;
  roworder: number;
  standard_qty?: string;
  requested_qty?: string;
  remaining_qty?: string;
  /** ຈຳນວນ SIO status=0 — ຈອງ stock ແລ້ວ ແຕ່ ERP ຍັງບໍ່ທັນຕັດ */
  pending_qty?: string;
};

export type SpareBalance = {
  total: number;
  byWarehouse: Record<string, number>;
  byLocation: Record<string, number>;
};

/** ຕາຕະລາງ "ອາໄຫຼ່ທີ່ໃຊ້" — ອ່ານຢ່າງດຽວ (ໃຊ້ໃນໜ້າເບີກ/ສົ່ງຄືນ/ເບິ່ງບິນ) */
export function SpareLineTable({ lines }: { lines: Omit<SpareLine, "roworder">[] }) {
  const t = useDict().spareLines;
  return (
    <Card title={t.sparesUsed}>
      {lines.length === 0 ? (
        <Empty />
      ) : (
        <Table head={["#", t.itemCode, t.itemName, t.qty, t.unit]} minWidth={700}>
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
  const t = useDict().spareLines;
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
        <div className="flex items-center gap-3">
          <span className="grid size-9 place-items-center rounded-xl bg-brand-50 text-brand-600">
            <Boxes className="size-4.5" />
          </span>
          <div>
            <h2 className="text-sm font-bold text-slate-800">{t.requestedSpareList}</h2>
            <p className="mt-0.5 text-[11px] text-slate-400">
              {selectedWarehouse
                ? `${t.checkingBalanceFrom} ${warehouseLabel ?? selectedWarehouse}${selectedShelf ? ` / ${selectedShelf}` : ""}`
                : t.selectWarehouseHint}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {selectedWarehouse ? (
            <span className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-brand-50 px-3 text-[11px] font-semibold text-brand-800">
              <Warehouse className="size-3.5" />
              {selectedWarehouse}{selectedShelf ? ` / ${selectedShelf}` : ""}
            </span>
          ) : (
            <span className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-brand-orange-100 px-3 text-[11px] font-semibold text-brand-900">
              <AlertTriangle className="size-3.5" />
              {t.noWarehouseSelected}
            </span>
          )}
          <Button type="button" tone="info" className="h-8 px-3 text-xs" onClick={onAddSpare}>
            <Plus className="size-4" />
            {t.addSpare}
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
                <th className="px-4 py-3 font-semibold">{t.spare}</th>
                <th className="w-28 px-4 py-3 text-center font-semibold">ຈຳນວນມາດຕະຖານ</th>
                <th className="w-28 px-4 py-3 text-center font-semibold">ຈຳນວນຂໍແລ້ວ</th>
                <th className="w-28 px-4 py-3 text-center font-semibold">ຈຳນວນຄົງເຫຼືອ</th>
                <th className="w-32 px-4 py-3 text-center font-semibold">{t.takeNow}</th>
                <th className="w-36 px-4 py-3 text-right font-semibold">{t.balanceThisWarehouse}</th>
                <th className="w-32 px-4 py-3 text-right font-semibold">{t.totalBalance}</th>
                <th className="w-36 px-4 py-3 text-center font-semibold">{t.check}</th>
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
                const standardQty = Number(line.standard_qty ?? line.qty);
                const alreadyRequested = Number(line.requested_qty ?? 0);
                const remainingQty = Number(line.remaining_qty ?? line.qty);
                const enough = selectedBalance !== null && selectedBalance >= remainingQty;
                return (
                  <tr key={line.roworder} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60">
                    <td className="px-4 py-3 text-center text-slate-400">{line.rnum}</td>
                    <td className="px-4 py-3">
                      <span className="block font-semibold text-slate-800">{line.item_name ?? "-"}</span>
                      <span className="mt-0.5 block font-mono text-[10px] text-slate-400">{line.item_code} · {line.unit_code ?? "-"}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <b className="tabular-nums">{standardQty.toLocaleString()}</b>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <b className="tabular-nums text-brand-800">{alreadyRequested.toLocaleString()}</b>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <b className="tabular-nums text-brand-900">{remainingQty.toLocaleString()}</b>
                    </td>
                    {/*
                      ── ເບີກຮອບນີ້ (1 ສາງ / 1 ໃບ) ──
                      ຕັ້ງຕົ້ນ = ເທົ່າທີ່ສາງ/ບ່ອນເກັບທີ່ເລືອກມີ (ບໍ່ເກີນຈຳນວນທີ່ຂໍ) ⇒ ສາງນີ້ບໍ່ພໍ
                      ກໍ່ຍັງເບີກເທົ່າທີ່ມີໄດ້ ແລ້ວອອກໃບໃໝ່ຈາກສາງອື່ນສຳລັບສ່ວນທີ່ເຫຼືອ.
                      ຢູ່ນອກ <form> ບັນທຶກ ⇒ ຜູກດ້ວຍ form={REQUEST_FORM_ID}.
                    */}
                    <td className="px-4 py-2">
                      <div className="flex justify-center">
                        <input
                          // ປ່ຽນສາງ/ບ່ອນເກັບ ⇒ remount ເພື່ອຕັ້ງຄ່າໃໝ່ຕາມບ່ອນນັ້ນ
                          key={`${selectedWarehouse}-${selectedShelf}`}
                          form={REQUEST_FORM_ID}
                          type="number"
                          name={takeField(line.item_code)}
                          min={0}
                          max={remainingQty}
                          step="any"
                          disabled={selectedBalance === null}
                          defaultValue={Math.min(remainingQty, selectedBalance ?? 0)}
                          aria-label={`${t.takeNow} ${line.item_name ?? line.item_code}`}
                          className={`${inputClass} h-9 w-24 text-center font-semibold`}
                        />
                      </div>
                    </td>
                    <td className={`px-4 py-3 text-right text-sm font-bold tabular-nums ${selectedBalance === null ? "text-slate-300" : enough ? "text-brand-800" : "text-brand-orange-700"}`}>
                      {selectedBalance === null ? "—" : selectedBalance.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums text-slate-600">
                      {balance.total.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {selectedBalance === null ? (
                        <span className="rounded-md bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-500">{t.selectWarehouseFirst}</span>
                      ) : enough ? (
                        <span className="inline-flex items-center gap-1 rounded-md bg-brand-50 px-2 py-1 text-[10px] font-semibold text-brand-800">
                          <CheckCircle2 className="size-3" /> {t.enough}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-md bg-brand-orange-50 px-2 py-1 text-[10px] font-semibold text-brand-orange-700">
                          <AlertTriangle className="size-3" /> {t.short} {Math.max(0, remainingQty - selectedBalance).toLocaleString()}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <form action={deleteSpareFromRequest}>
                        <input type="hidden" name="roworder" value={roworder} />
                        <input type="hidden" name="row_id" value={line.roworder} />
                        <button type="submit" title={t.delete} className="rounded-lg p-2 text-[#9f5f14] hover:bg-brand-orange-50">
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
        {t.footerHint}
      </div>
    </section>
  );
}
