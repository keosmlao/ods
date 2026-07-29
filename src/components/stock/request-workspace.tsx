"use client";

import { addSpareToRequestFromDialog } from "@/app/actions/stock";
import { RequestForm, type RequestHead } from "@/components/stock/request-form";
import { EditableSpareLines, type SpareBalance, type SpareLine } from "@/components/stock/spare-lines";
import type { Shelf, Warehouse } from "@/components/stock/wh-shelf-select";
import { SpareSearchDialog } from "@/components/spare-search";
import { Check, ListChecks, Search, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function RequestWorkspace({
  head,
  docNo,
  today,
  warehouses,
  shelves,
  lines,
  roworder,
  balances,
  canRequest,
}: {
  head: RequestHead;
  docNo: string;
  today: string;
  warehouses: Warehouse[];
  shelves: Shelf[];
  lines: SpareLine[];
  roworder: string;
  balances: Record<string, SpareBalance>;
  canRequest: boolean;
}) {
  const router = useRouter();
  const [warehouse, setWarehouse] = useState("");
  const [shelf, setShelf] = useState("");
  const [searching, setSearching] = useState(false);
  const [picking, setPicking] = useState(false);
  const [selectedCodes, setSelectedCodes] = useState<Set<string>>(() => new Set());
  const [draftCodes, setDraftCodes] = useState<Set<string>>(() => new Set());
  const warehouseLabel = warehouses.find((item) => item.code === warehouse)?.name_1;
  const selectedLines = lines.filter((line) => selectedCodes.has(line.item_code));

  function openPicker() {
    setDraftCodes(new Set(selectedCodes));
    setPicking(true);
  }

  return (
    <div className="space-y-4">
      <RequestForm
        head={head}
        docNo={docNo}
        today={today}
        warehouses={warehouses}
        shelves={shelves}
        hasSpares={selectedLines.length > 0 && canRequest}
        roworder={roworder}
        warehouseValue={warehouse}
        shelfValue={shelf}
        onWarehouseChange={(value) => {
          setWarehouse(value);
          setShelf("");
        }}
        onShelfChange={setShelf}
      />
      <EditableSpareLines
        lines={selectedLines}
        roworder={roworder}
        balances={balances}
        selectedWarehouse={warehouse}
        selectedShelf={shelf}
        warehouseLabel={warehouseLabel}
        onAddSpare={openPicker}
      />
      {picking && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="ເລືອກອາໄຫຼ່ທີ່ຈະຂໍເບີກ"
          className="fixed inset-0 z-50 flex items-start justify-center overflow-auto bg-slate-900/50 p-4 pt-12 backdrop-blur-sm"
          onClick={(event) => event.target === event.currentTarget && setPicking(false)}
        >
          <div className="flex max-h-[80vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <h2 className="flex items-center gap-2 text-sm font-bold text-slate-800">
                  <ListChecks className="size-4 text-teal-600" />
                  ເລືອກອາໄຫຼ່ທີ່ຈະຂໍເບີກ
                </h2>
                <p className="mt-1 text-[11px] text-slate-400">ເລືອກເປັນລາຍການ ຫຼືເລືອກທັງໝົດຄັ້ງດຽວ</p>
              </div>
              <button type="button" onClick={() => setPicking(false)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100">
                <X className="size-4" />
              </button>
            </div>
            <div className="flex items-center justify-between gap-2 border-b border-slate-100 bg-slate-50 px-5 py-3">
              <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-slate-700">
                <input
                  type="checkbox"
                  checked={lines.length > 0 && draftCodes.size === lines.length}
                  onChange={(event) => setDraftCodes(event.target.checked ? new Set(lines.map((line) => line.item_code)) : new Set())}
                  className="size-4 accent-teal-600"
                />
                ເລືອກທັງໝົດ ({lines.length})
              </label>
              <button
                type="button"
                onClick={() => {
                  setPicking(false);
                  setSearching(true);
                }}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                <Search className="size-3.5" /> ເພີ່ມລາຍການອື່ນ
              </button>
            </div>
            <div className="overflow-y-auto">
              {lines.map((line) => {
                const checked = draftCodes.has(line.item_code);
                return (
                  <label key={line.item_code} className="flex cursor-pointer items-center gap-3 border-b border-slate-100 px-5 py-3 hover:bg-slate-50">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => setDraftCodes((current) => {
                        const next = new Set(current);
                        if (checked) next.delete(line.item_code);
                        else next.add(line.item_code);
                        return next;
                      })}
                      className="size-4 accent-teal-600"
                    />
                    <span className="min-w-0 flex-1">
                      <b className="block truncate text-xs text-slate-800">{line.item_name ?? "-"}</b>
                      <span className="font-mono text-[10px] text-slate-400">{line.item_code} · ຄົງເຫຼືອ {Number(line.remaining_qty ?? line.qty).toLocaleString()}</span>
                    </span>
                  </label>
                );
              })}
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-5 py-4">
              <button type="button" onClick={() => setPicking(false)} className="h-9 rounded-lg border border-slate-300 px-4 text-xs font-semibold text-slate-600">
                ຍົກເລີກ
              </button>
              <button
                type="button"
                disabled={draftCodes.size === 0}
                onClick={() => {
                  setSelectedCodes(new Set(draftCodes));
                  setPicking(false);
                }}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-teal-600 px-4 text-xs font-bold text-white disabled:opacity-40"
              >
                <Check className="size-3.5" /> ເພີ່ມ {draftCodes.size} ລາຍການ
              </button>
            </div>
          </div>
        </div>
      )}
      {searching && (
        <SpareSearchDialog
          chosen={new Set(lines.map((line) => line.item_code))}
          onAdd={async (item, qty) => {
            const result = await addSpareToRequestFromDialog(roworder, head.product_code, item.code, qty);
            router.refresh();
            return result;
          }}
          onClose={() => setSearching(false)}
        />
      )}
    </div>
  );
}
