"use client";
import { LoaderCircle, Search, X } from "lucide-react";
import { type ReactNode, useEffect, useState, useTransition } from "react";

/**
 * Modal ຄົ້ນ-ເລືອກ ທົ່ວໄປ — ໃຊ້ຮ່ວມ (ບິນ ic_trans · inventory). ຄົ້ນຜ່ານ server action ທີ່ສົ່ງເຂົ້າມາ.
 * ຄົ້ນ debounce 300ms · ບໍ່ພິມ = ບໍ່ຄົ້ນ (ຢ່າດຶງທັງ ERP).
 */
export function SearchPickerModal<T>({
  open,
  onClose,
  onPick,
  title,
  subtitle,
  placeholder,
  search,
  renderItem,
  keyOf,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (item: T) => void;
  title: string;
  subtitle?: string;
  placeholder: string;
  search: (q: string) => Promise<T[]>;
  renderItem: (item: T) => ReactNode;
  keyOf: (item: T) => string;
}) {
  const [q, setQ] = useState("");
  const [items, setItems] = useState<T[]>([]);
  const [pending, start] = useTransition();
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!open) return;
    const term = q.trim();
    if (!term) return; // ວ່າງ ⇒ ບໍ່ຄົ້ນ (render ໂຊ້ "ພິມເພື່ອຄົ້ນ" ຢູ່ແລ້ວ — ບໍ່ຕ້ອງ setState ກາງ effect)
    const t = setTimeout(() => start(async () => { setItems(await search(term)); setLoaded(true); }), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, q]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/50 p-4" onClick={onClose}>
      <div className="flex max-h-[80vh] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-100 p-4">
          <div>
            <h2 className="text-sm font-bold text-slate-800">{title}</h2>
            {subtitle && <p className="text-[11px] text-slate-500">{subtitle}</p>}
          </div>
          <button type="button" onClick={onClose} className="grid size-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100"><X className="size-4" /></button>
        </div>

        <div className="border-b border-slate-100 p-3">
          <div className="flex items-center gap-2 rounded-lg border border-slate-300 px-2.5 focus-within:border-teal-500">
            <Search className="size-4 shrink-0 text-slate-400" />
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder} className="h-9 w-full text-sm outline-none" />
            {pending && <LoaderCircle className="size-4 shrink-0 animate-spin text-slate-400" />}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {!q.trim() ? (
            <p className="py-12 text-center text-sm text-slate-400">ພິມເພື່ອຄົ້ນ</p>
          ) : loaded && items.length === 0 ? (
            <p className="py-12 text-center text-sm text-slate-400">ບໍ່ພົບ</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {items.map((it) => (
                <li key={keyOf(it)}>
                  <button type="button" onClick={() => onPick(it)} className="w-full px-4 py-2.5 text-left hover:bg-teal-50/60">
                    {renderItem(it)}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
