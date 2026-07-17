"use client";
import { searchSpare } from "@/app/actions/checking";
import type { SpareItem } from "@/lib/tech-flow";
import { Check, LoaderCircle, Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

/**
 * **ກ່ອງເລືອກອາໄຫຼ່ (modal)** — ຄື "Search More..." ຂອງ Odoo ທີ່ເປີດເປັນ dialog.
 *
 * ── ເປັນຫຍັງເປັນ modal ບໍ່ແມ່ນ dropdown ──
 * dropdown ລອຍຢູ່ໃນຟອມຖືກ**ຕັດ**ດ້ວຍກ່ອງເລື່ອນຂອງຕາຕະລາງ (overflow) ແລະ ຄັບແຄບ.
 * modal ໃຊ້ <dialog> ຂອງ HTML ⇒ ຢູ່ເທິງສຸດຂອງໜ້າສະເໝີ, ດັກ focus, ກົດ Esc ປິດ
 * (ຫຼັກການດຽວກັນກັບ components/confirm-dialog).
 *
 * **ເລືອກໄດ້ຫຼາຍລາຍການພ້ອມກັນ** ແລ້ວກົດ "ເພີ່ມ" ເທື່ອດຽວ — ຄົນສັ່ງຊື້ເລືອກເທື່ອລະຫຼາຍອັນ.
 */
export function SparePicker({
  open,
  onClose,
  onPick,
  /** ລະຫັດທີ່ຢູ່ໃນໃບແລ້ວ — ເລືອກຊ້ຳບໍ່ໄດ້ */
  existing,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (items: SpareItem[]) => void;
  existing: string[];
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState("");
  const [results, setResults] = useState<SpareItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [picked, setPicked] = useState<Map<string, SpareItem>>(new Map());

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      setText("");
      setPicked(new Map());
      setTimeout(() => inputRef.current?.focus(), 0);
    }
    if (!open && dialog.open) dialog.close();
  }, [open]);

  // ຄົ້ນຫາ ERP — debounce 300ms · ບໍ່ພິມຫຍັງກໍ່ຄືນລາຍການທີ່ມີຄົງເຫຼືອຫຼາຍສຸດ
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        setResults(await searchSpare(text));
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [text, open]);

  const inDoc = new Set(existing);
  const toggle = (item: SpareItem) =>
    setPicked((prev) => {
      const next = new Map(prev);
      if (next.has(item.code)) next.delete(item.code);
      else next.set(item.code, item);
      return next;
    });

  const confirm = () => {
    if (picked.size) onPick([...picked.values()]);
    onClose();
  };

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onCancel={onClose}
      className="w-[min(92vw,52rem)] rounded-xl p-0 shadow-2xl backdrop:bg-slate-900/40"
    >
      <div className="flex h-[min(80vh,40rem)] flex-col">
        {/* ຫົວ + ຊ່ອງຄົ້ນຫາ */}
        <div className="border-b border-slate-200 p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-sm font-bold text-slate-700">ເລືອກອາໄຫຼ່ (ຈາກ ERP)</h2>
            <button
              type="button"
              onClick={onClose}
              className="grid size-7 place-items-center rounded-full text-slate-400 hover:bg-slate-100"
            >
              <X className="size-4" />
            </button>
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-slate-300 px-3 focus-within:border-teal-500 focus-within:ring-2 focus-within:ring-teal-100">
            {searching ? (
              <LoaderCircle className="size-4 shrink-0 animate-spin text-slate-400" />
            ) : (
              <Search className="size-4 shrink-0 text-slate-400" />
            )}
            <input
              ref={inputRef}
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder="ພິມລະຫັດ / ຊື່ / ຍີ່ຫໍ້ ອາໄຫຼ່..."
              className="h-10 w-full text-sm focus:outline-none"
            />
          </div>
        </div>

        {/* ລາຍການຜົນຄົ້ນຫາ */}
        <div className="flex-1 overflow-y-auto">
          <table className="w-full border-collapse text-xs">
            <thead className="sticky top-0 bg-slate-50">
              <tr className="border-b border-slate-200 text-left text-slate-600">
                <th className="w-10 px-3 py-2" />
                <th className="px-3 py-2 font-semibold">ອາໄຫຼ່</th>
                <th className="px-3 py-2 font-semibold">ຍີ່ຫໍ້</th>
                <th className="px-3 py-2 text-right font-semibold">ຄົງເຫຼືອ</th>
              </tr>
            </thead>
            <tbody>
              {results.map((item) => {
                const already = inDoc.has(item.code);
                const on = picked.has(item.code);
                return (
                  <tr
                    key={item.code}
                    onClick={() => !already && toggle(item)}
                    className={`border-b border-slate-100 ${
                      already ? "opacity-40" : `cursor-pointer ${on ? "bg-teal-50" : "hover:bg-slate-50"}`
                    }`}
                  >
                    <td className="px-3 py-2">
                      <span
                        className={`grid size-4 place-items-center rounded border ${
                          on ? "border-teal-600 bg-teal-600 text-white" : "border-slate-300 bg-white"
                        }`}
                      >
                        {on && <Check className="size-3" strokeWidth={4} />}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <span className="block font-medium text-slate-800">{item.name_1}</span>
                      <span className="block font-mono text-[10px] text-slate-400">{item.code}</span>
                    </td>
                    <td className="px-3 py-2 text-slate-500">{item.brand ?? "-"}</td>
                    <td className="px-3 py-2 text-right">
                      {already ? (
                        <span className="text-[10px] font-semibold text-slate-400">ຢູ່ໃນໃບແລ້ວ</span>
                      ) : (
                        <span
                          className={`font-semibold tabular-nums ${
                            item.balance_qty > 0 ? "text-emerald-600" : "text-slate-400"
                          }`}
                        >
                          {item.balance_qty}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!searching && results.length === 0 && (
            <p className="py-16 text-center text-xs text-slate-400">
              {text.trim() ? `ບໍ່ພົບອາໄຫຼ່ "${text}" ໃນ ERP` : "ພິມເພື່ອຄົ້ນຫາອາໄຫຼ່"}
            </p>
          )}
        </div>

        {/* ທ້າຍ: ຈຳນວນທີ່ເລືອກ + ປຸ່ມເພີ່ມ */}
        <div className="flex items-center justify-between gap-3 border-t border-slate-200 p-3">
          <span className="text-xs text-slate-400">
            {picked.size > 0 ? `ເລືອກແລ້ວ ${picked.size} ລາຍການ` : "ກົດແຖວເພື່ອເລືອກ (ເລືອກໄດ້ຫຼາຍລາຍການ)"}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="h-9 rounded-lg border border-slate-300 px-4 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              ຍົກເລີກ
            </button>
            <button
              type="button"
              disabled={picked.size === 0}
              onClick={confirm}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-teal-600 px-4 text-xs font-semibold text-white hover:bg-teal-700 disabled:opacity-40"
            >
              <Check className="size-3.5" />
              ເພີ່ມ {picked.size > 0 && `(${picked.size})`}
            </button>
          </div>
        </div>
      </div>
    </dialog>
  );
}
