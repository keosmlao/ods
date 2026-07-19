"use client";
import { searchSpare, type SpareItem } from "@/app/actions/checking";
import { Button, Empty } from "@/components/ui";
import { useDict } from "@/lib/i18n/context";
import { Check, LoaderCircle, Minus, Plus, Search, X } from "lucide-react";
import { useEffect, useState, useTransition } from "react";

/**
 * ໜ້າຕ່າງເລືອກອາໄຫຼ່ — ໃຊ້ຮ່ວມກັນ 2 ບ່ອນ:
 *   ຂັ້ນກວດເຊັກ  → ເພີ່ມເຂົ້າກະຕ່າ (ic_trans_detail_draft)
 *   ຂັ້ນສ້ອມແປງ → ເພີ່ມເຂົ້າອາໄຫຼ່ທີ່ປ່ຽນຈິງ (tb_used_spare)
 *
 * ຕ່າງຈາກ modal ຂອງ ods: ເປີດມາກໍ່ດຶງລາຍການໃຫ້ເລີຍ ບໍ່ຕ້ອງພິມກ່ອນ.
 */

/** ແຖວອາໄຫຼ່ໃນຜົນການຄົ້ນຫາ — ໃສ່ຈຳນວນໄດ້ກ່ອນກົດເພີ່ມ */
function SpareResult({
  item,
  added,
  onAdd,
}: {
  item: SpareItem;
  added: boolean;
  onAdd: (item: SpareItem, qty: number) => Promise<unknown>;
}) {
  const t = useDict().spareSearch;
  const [qty, setQty] = useState(1);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const outOfStock = item.balance_qty <= 0;

  return (
    <li className="flex flex-wrap items-center gap-3 px-4 py-2.5 transition hover:bg-slate-50">
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium text-slate-800" title={item.name_1}>
          {item.name_1}
        </p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[10px] text-slate-400">
          <span className="font-mono text-slate-500">{item.code}</span>
          {item.brand && <span>· {item.brand}</span>}
          {item.unit_code && <span>· {item.unit_code}</span>}
        </p>
      </div>

      {/* ຄົງເຫຼືອໃນສາງ */}
      <span
        className={`whitespace-nowrap rounded px-1.5 py-0.5 text-[10px] font-bold ${
          outOfStock ? "bg-red-50 text-red-600" : "bg-emerald-50 text-emerald-700"
        }`}
        title={t.stockTooltip}
      >
        {outOfStock ? t.outOfStock : `${t.inStock} ${item.balance_qty}`}
      </span>

      {/* ຈຳນວນ */}
      <span className="flex h-8 items-center overflow-hidden rounded-lg border border-slate-300">
        <button
          type="button"
          onClick={() => setQty((n) => Math.max(1, n - 1))}
          className="grid size-8 place-items-center text-slate-500 transition hover:bg-slate-100"
        >
          <Minus className="size-3" />
        </button>
        <input
          value={qty}
          onChange={(event) => setQty(Math.max(1, Number(event.target.value.replace(/\D/g, "")) || 1))}
          className="h-full w-10 border-x border-slate-200 text-center text-xs tabular-nums outline-none"
        />
        <button
          type="button"
          onClick={() => setQty((n) => n + 1)}
          className="grid size-8 place-items-center text-slate-500 transition hover:bg-slate-100"
        >
          <Plus className="size-3" />
        </button>
      </span>

      <Button
        type="button"
        tone={added ? "info" : "success"}
        disabled={pending}
        className="h-8 w-24 justify-center px-3 text-xs"
        onClick={() =>
          start(async () => {
            setError("");
            const result = await onAdd(item, qty);
            if (
              result &&
              typeof result === "object" &&
              "error" in result &&
              typeof result.error === "string"
            ) {
              setError(result.error);
            }
          })
        }
      >
        {pending ? (
          <LoaderCircle className="size-3.5 animate-spin" />
        ) : added ? (
          <>
            <Check className="size-3.5" />
            {t.addMore}
          </>
        ) : (
          <>
            <Plus className="size-3.5" />
            {t.add}
          </>
        )}
      </Button>
      {error && <p className="basis-full text-right text-[10px] font-medium text-red-600">{error}</p>}
    </li>
  );
}

export function SpareSearchDialog({
  chosen,
  onAdd,
  onClose,
}: {
  /** ລະຫັດອາໄຫຼ່ທີ່ຢູ່ໃນລາຍການແລ້ວ — ໃຊ້ໝາຍວ່າ "ເພີ່ມແລ້ວ" */
  chosen: Set<string>;
  onAdd: (item: SpareItem, qty: number) => Promise<unknown>;
  onClose: () => void;
}) {
  const t = useDict().spareSearch;
  const [q, setQ] = useState("");
  const [inStockOnly, setInStockOnly] = useState(false);
  const [items, setItems] = useState<SpareItem[] | null>(null);
  const [loading, setLoading] = useState(false);

  // ດຶງລາຍການ — ເປີດມາຄັ້ງທຳອິດກໍ່ດຶງ (q ຫວ່າງ = ຮຽງຕາມຄົງເຫຼືອຫຼາຍສຸດ)
  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(
      () => {
        setLoading(true);
        searchSpare(q, inStockOnly)
          .then((rows) => !cancelled && setItems(rows))
          .finally(() => !cancelled && setLoading(false));
      },
      q ? 250 : 0,
    );
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [q, inStockOnly]);

  // ກົດ Esc ປິດ
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t.selectSpare}
      onClick={(event) => event.target === event.currentTarget && onClose()}
      className="fixed inset-0 z-50 flex items-start justify-center overflow-auto bg-slate-900/50 p-4 pt-12 backdrop-blur-sm"
    >
      <div className="flex max-h-[80vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
          <h2 className="text-sm font-bold text-slate-800">{t.selectSpare}</h2>
          <button type="button" onClick={onClose} className="text-slate-400 transition hover:text-slate-700">
            <X className="size-4" />
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 bg-slate-50 px-4 py-2.5">
          <div className="flex h-9 min-w-56 flex-1 items-center gap-2 rounded-lg border border-slate-300 bg-white px-2.5">
            {loading ? (
              <LoaderCircle className="size-3.5 shrink-0 animate-spin text-teal-600" />
            ) : (
              <Search className="size-3.5 shrink-0 text-slate-400" />
            )}
            <input
              autoFocus
              value={q}
              onChange={(event) => setQ(event.target.value)}
              placeholder={t.searchPlaceholder}
              className="w-full text-xs outline-none"
            />
            {q && (
              <button type="button" onClick={() => setQ("")} className="text-slate-400 hover:text-slate-600">
                <X className="size-3.5" />
              </button>
            )}
          </div>
          <label className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs text-slate-600">
            <input
              type="checkbox"
              checked={inStockOnly}
              onChange={(event) => setInStockOnly(event.target.checked)}
              className="size-3.5 accent-teal-600"
            />
            {t.inStockOnly}
          </label>
        </div>

        <div className="min-h-40 flex-1 overflow-y-auto">
          {items === null ? (
            <p className="py-12 text-center text-xs text-slate-400">{t.loading}</p>
          ) : items.length === 0 ? (
            <Empty>{t.noSpareFound}</Empty>
          ) : (
            <ul className="divide-y divide-slate-100">
              {items.map((item) => (
                <SpareResult key={item.code} item={item} added={chosen.has(item.code)} onAdd={onAdd} />
              ))}
            </ul>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-4 py-2.5 text-[11px] text-slate-500">
          <span>
            {items ? `${items.length} ${t.itemsUnit}` : "..."}
            {items?.length === 50 && ` ${t.showingFirst50Hint}`}
          </span>
          <Button type="button" tone="info" className="h-8 px-3 text-xs" onClick={onClose}>
            {t.done}
          </Button>
        </div>
      </div>
    </div>
  );
}
