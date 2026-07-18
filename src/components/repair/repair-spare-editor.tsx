"use client";
import { addUsedSpare, deleteUsedSpare } from "@/app/actions/repair";
import { SpareSearchDialog } from "@/components/spare-search";
import { AlertTriangle, Lock, PackagePlus, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";

export type UsedSpareLine = {
  roworder: number;
  item_code: string;
  item_name: string;
  qty: number;
  unit_code: string | null;
  /** ເຂົ້າໃບຂໍເບີກ/ໃບເບີກແລ້ວ ⇒ ແກ້/ລຶບບໍ່ໄດ້ (ຕ້ອງສົ່ງຄືນສາງ) */
  locked: boolean;
  /** ຢູ່ໃນໃບຂໍເບີກແລ້ວ (reg_start) — false = ຍັງຄ້າງເບີກ */
  requested: boolean;
};

/**
 * ອາໄຫຼ່ຕອນສ້ອມ (ຂັ້ນ 9) — ເພີ່ມ/ລຶບ ອາໄຫຼ່ທີ່ພົບຕ້ອງໃຊ້ເພີ່ມຕອນລົງມືສ້ອມ ແລ້ວ
 * ອອກ **ໃບຂໍເບີກເພີ່ມ** (ຮອບ 2) ໃຫ້ສາງເບີກ. ແຖວທີ່ເບີກແລ້ວ (locked) ແກ້ບໍ່ໄດ້ —
 * ຢາກ "ປ່ຽນ" ໃຫ້ສົ່ງຄືນຕົວເກົ່າ (ໜ້າສາງ) ແລ້ວເພີ່ມຕົວໃໝ່. ວຽກຄົງຢູ່ຂັ້ນ "ກຳລັງສ້ອມ".
 */
export function RepairSpareEditor({
  code,
  roworder,
  lines,
  pending,
}: {
  code: string;
  roworder: string;
  lines: UsedSpareLine[];
  pending: number;
}) {
  const [open, setOpen] = useState(false);
  const [busy, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const run = (fn: () => Promise<{ error?: string } | unknown>) =>
    start(async () => {
      setError(null);
      const res = (await fn()) as { error?: string } | undefined;
      if (res?.error) setError(res.error);
    });

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between border-b border-slate-100 pb-2">
        <h2 className="text-sm font-bold text-slate-700">ອາໄຫຼ່ຕອນສ້ອມ</h2>
        <button
          type="button"
          onClick={() => setOpen(true)}
          disabled={busy}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-teal-600 px-3 text-xs font-semibold text-white hover:bg-teal-700 disabled:opacity-50"
        >
          <Plus className="size-3.5" /> ເພີ່ມອາໄຫຼ່
        </button>
      </div>

      {lines.length === 0 ? (
        <p className="py-2 text-center text-xs text-slate-400">ຍັງບໍ່ມີອາໄຫຼ່ — ກົດ &quot;ເພີ່ມອາໄຫຼ່&quot; ຖ້າຕ້ອງໃຊ້ເພີ່ມ</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {lines.map((line) => (
            <li key={line.roworder} className="flex items-center gap-2 py-2 text-sm">
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium text-slate-700" title={line.item_name}>
                  {line.item_name}
                </span>
                <span className="text-[11px] text-slate-400">
                  {line.item_code} · {line.qty} {line.unit_code ?? ""}
                  {line.locked ? " · ເບີກແລ້ວ" : line.requested ? " · ຂໍເບີກແລ້ວ" : " · ຄ້າງເບີກ"}
                </span>
              </span>
              {line.locked ? (
                <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">
                  <Lock className="size-3" /> ລັອກ
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => run(() => deleteUsedSpare(code, line.roworder))}
                  disabled={busy}
                  title="ຖອດອອກ"
                  className="rounded p-1.5 text-red-600 hover:bg-red-50 disabled:opacity-50"
                >
                  <Trash2 className="size-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {error && (
        <p className="mt-2 flex items-center gap-1 text-[11px] font-medium text-red-600">
          <AlertTriangle className="size-3 shrink-0" />
          {error}
        </p>
      )}

      {pending > 0 && (
        <Link
          href={`/stock/requests/${roworder}`}
          className="mt-3 inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-amber-600 px-3 text-xs font-semibold text-white hover:bg-amber-700"
        >
          <PackagePlus className="size-4" /> ຂໍເບີກອາໄຫຼ່ເພີ່ມ ({pending})
        </Link>
      )}

      {open && (
        <SpareSearchDialog
          chosen={new Set(lines.map((line) => line.item_code))}
          onAdd={(item, qty) =>
            addUsedSpare(code, { code: item.code, name_1: item.name_1, unit_code: item.unit_code }, qty)
          }
          onClose={() => setOpen(false)}
        />
      )}
    </section>
  );
}
