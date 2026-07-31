"use client";
import { addSuggestedLines, type StandardState } from "@/app/actions/install-standard";
import type { StandardSuggestion } from "@/lib/install-standard";
import { useDict } from "@/lib/i18n/context";
import { History, LoaderCircle, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useActionState, useState } from "react";

/**
 * **ແນະນຳມາດຕະຖານຈາກປະຫວັດ** — ລາຍການທີ່ຊ່າງເບີກຈິງຫຼາຍທີ່ສຸດຂອງໝວດ (+ຂະໜາດ) 2 ປີຫຼັງສຸດ.
 *
 * ບໍ່ຕັ້ງໃຫ້ອັດຕະໂນມັດ ເພາະ **ບໍ່ມີລາຍການໃດຢູ່ 100%** (ຂໍ້ມູນຈິງຂອງແອ: ສູງສຸດ 47%
 * ທົ່ວທຸກຂະໜາດ · 58% ເມື່ອແຍກຂະໜາດ) ⇒ % ບອກແຕ່ "ເບີກເລື້ອຍປານໃດ" ບໍ່ໄດ້ບອກວ່າ
 * "ຄວນເປັນມາດຕະຖານ". ຄົນຕັດສິນ ລະບົບພຽງແຕ່ວາງຫຼັກຖານໃສ່ໂຕະ.
 */
export function StandardSuggestions({
  proTypeCode,
  proSize,
  rows,
}: {
  proTypeCode: string;
  proSize: string;
  rows: StandardSuggestion[];
}) {
  const t = useDict().manageInstallStandard;
  const router = useRouter();
  const [state, action, saving] = useActionState<StandardState, FormData>(addSuggestedLines, {});
  // ຕັ້ງຕົ້ນຕິກໃຫ້ອັນທີ່ພົບ ≥40% (ເສັ້ນທີ່ຂໍ້ມູນຈິງແຍກ "ຊຸດຫຼັກ" ອອກຈາກ "ບາງເທື່ອ")
  const [checked, setChecked] = useState<Set<string>>(
    () => new Set(rows.filter((row) => row.pct >= 40).map((row) => row.item_code)),
  );

  if (!rows.length) {
    return (
      <p className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-400 shadow-sm">
        {t.suggestEmpty}
      </p>
    );
  }

  return (
    <form action={action} className="rounded-2xl border border-teal-200 bg-teal-50/40 p-4 shadow-sm">
      <input type="hidden" name="pro_type_code" value={proTypeCode} />
      <input type="hidden" name="pro_size" value={proSize} />

      <p className="mb-1 flex items-center gap-2 text-sm font-bold text-slate-700">
        <History className="size-4 text-teal-700" />
        {t.suggestTitle}
      </p>
      <p className="mb-3 text-xs text-slate-500">
        {t.suggestSub}
      </p>

      <ul className="mb-3 divide-y divide-teal-100">
        {rows.map((row) => (
          <li key={row.item_code} className="flex items-center gap-2 py-1.5 text-sm">
            <input
              type="checkbox"
              name="item"
              value={row.item_code}
              checked={checked.has(row.item_code)}
              onChange={() =>
                setChecked((current) => {
                  const next = new Set(current);
                  if (next.has(row.item_code)) next.delete(row.item_code);
                  else next.add(row.item_code);
                  return next;
                })
              }
              className="size-4 accent-teal-600"
            />
            <span
              className={`w-12 shrink-0 rounded-full px-1.5 py-0.5 text-center text-[11px] font-bold ${row.pct >= 40 ? "bg-teal-100 text-teal-800" : "bg-slate-100 text-slate-500"}`}
            >
              {row.pct}%
            </span>
            <span className="min-w-0 flex-1 truncate">
              <b className="text-slate-800">{row.item_name}</b>
              <span className="ml-2 text-xs text-slate-400">{row.item_code}</span>
            </span>
            <span className="shrink-0 text-xs text-slate-600">
              {row.median_qty.toLocaleString()} {row.unit_code || ""}
              <span className="ml-2 text-slate-400">({row.jobs} {t.suggestJobs})</span>
            </span>
          </li>
        ))}
      </ul>

      {state.error && <p className="mb-2 text-xs font-semibold text-rose-600">{state.error}</p>}
      {state.ok && <p className="mb-2 text-xs font-semibold text-emerald-600">{state.ok}</p>}

      <button
        disabled={saving || checked.size === 0}
        onClick={() => setTimeout(() => router.refresh(), 300)}
        className="inline-flex h-9 items-center gap-1 rounded-lg bg-teal-600 px-3 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-60"
      >
        {saving ? <LoaderCircle className="size-4 animate-spin" /> : <Plus className="size-4" />}
        {t.suggestAdd} ({checked.size})
      </button>
    </form>
  );
}
