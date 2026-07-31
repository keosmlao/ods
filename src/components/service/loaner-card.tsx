"use client";
import { findLoanerUnit, lendLoaner, returnLoaner, type LoanerState } from "@/app/actions/loaner";
import type { LoanerRow, LoanerUnit } from "@/lib/loaner";
import { useDict } from "@/lib/i18n/context";
import { Check, LoaderCircle, PackageCheck, Plus, Printer, Search, X } from "lucide-react";
import { useActionState, useState } from "react";

/**
 * **ເຄື່ອງສຳຮອງ** ຂອງໃບງານສ້ອມ — ໃຫ້ຢືມ / ຮັບຄືນ ຢູ່ໜ້າໃບງານ.
 *
 * ບໍ່ຕັດສະຕັອກ (ເຄື່ອງຂອງສູນ) ⇒ ຟອມສັ້ນ: **ISN** (ບັງຄັບ) · ຊື່ເຄື່ອງ · ໝາຍເຫດ.
 * ພິມ ISN ແລ້ວກົດ "ຫາຈາກ ERP" ⇒ ຕື່ມຊື່/ລະຫັດໃຫ້ (api/scan — ຕ່ອງໂສ້ດຽວກັບໜ້າຮັບເຄື່ອງ).
 * ຍັງມີໜ່ວຍຄ້າງ ⇒ ສົ່ງເຄື່ອງຄືນລູກຄ້າບໍ່ໄດ້ (ດ່ານຢູ່ actions/return.ts).
 */
const field = "h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-teal-500";

export function LoanerCard({
  code,
  rows,
  canEdit,
}: {
  code: string;
  rows: LoanerRow[];
  /** ຝ່າຍບໍລິການເທົ່ານັ້ນທີ່ໃຫ້ຢືມ/ຮັບຄືນໄດ້ — ຄົນອື່ນເຫັນຢ່າງດຽວ */
  canEdit: boolean;
}) {
  const t = useDict().loaner;
  const [open, setOpen] = useState(false);
  const [lendState, lendAction, lending] = useActionState<LoanerState, FormData>(lendLoaner, {});
  const [returnState, returnAction, returning] = useActionState<LoanerState, FormData>(returnLoaner, {});

  const [isn, setIsn] = useState("");
  const [itemName, setItemName] = useState("");
  const [itemCode, setItemCode] = useState("");
  const [picked, setPicked] = useState<LoanerUnit | null>(null);
  const [q, setQ] = useState("");
  const [units, setUnits] = useState<LoanerUnit[]>([]);
  const [looking, setLooking] = useState(false);
  const [searched, setSearched] = useState(false);

  const outstanding = rows.filter((row) => !row.return_time);

  /**
   * ຄົ້ນໜ່ວຍຈາກ **SML** ດ້ວຍ ISN · SN · ລະຫັດ · ຊື່ (ບາງສ່ວນກໍ່ໄດ້).
   * ແຕ່ກ່ອນຍິງ /api/scan ທີ່ຈັບຄູ່ ISN ຕົງເປັນຕົວ ⇒ ບໍ່ຮູ້ ISN ແມ່ນ **ບໍ່ຂຶ້ນຫຍັງເລີຍ**.
   */
  async function lookup() {
    if (q.trim().length < 3) return;
    setLooking(true);
    setSearched(true);
    const result = await findLoanerUnit(q.trim());
    setUnits(result.units ?? []);
    setLooking(false);
  }

  function pick(unit: LoanerUnit) {
    setPicked(unit);
    setIsn(unit.isn);
    setItemName(unit.item_name);
    setItemCode(unit.item_code);
    setUnits([]);
    setSearched(false);
  }

  function clearPick() {
    setPicked(null);
    setIsn("");
    setItemName("");
    setItemCode("");
    setQ("");
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-3 border-b border-slate-100 pb-2">
        <h2 className="flex items-center gap-2 text-sm font-bold text-slate-700">
          <PackageCheck className="size-4 text-teal-600" />
          {t.cardTitle}
          {outstanding.length > 0 && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-800">
              {t.outstanding} {outstanding.length}
            </span>
          )}
        </h2>
        {canEdit && (
          <button
            type="button"
            onClick={() => setOpen(!open)}
            className="inline-flex h-8 items-center gap-1 rounded-lg border border-teal-200 bg-teal-50 px-3 text-xs font-semibold text-teal-700 hover:bg-teal-100"
          >
            {open ? <X className="size-3.5" /> : <Plus className="size-3.5" />}
            {open ? t.cancel : t.lend}
          </button>
        )}
      </div>

      {open && canEdit && (
        <form action={lendAction} className="mb-3 space-y-2 rounded-lg bg-slate-50 p-3">
          <input type="hidden" name="job" value={code} />
          <input type="hidden" name="item_code" value={itemCode} />
          {/* ຄ່າທີ່ສົ່ງໄປ server — ຕື່ມຈາກໜ່ວຍທີ່ເລືອກ ບໍ່ແມ່ນຈາກທີ່ພິມ */}
          <input type="hidden" name="isn" value={isn} />
          <input type="hidden" name="item_name" value={itemName} />

          {picked ? (
            <div className="flex items-start justify-between gap-2 rounded-lg border border-emerald-200 bg-white p-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-slate-800">{picked.item_name}</p>
                <p className="mt-0.5 text-xs text-slate-500">
                  ISN <b className="text-slate-700">{picked.isn}</b>
                  <span className="ml-2 text-slate-400">{picked.item_code}</span>
                  {picked.wh_name && <span className="ml-2 text-slate-400">· {picked.wh_name}</span>}
                </p>
              </div>
              <button type="button" onClick={clearPick} className="shrink-0 text-slate-400 hover:text-red-600">
                <X className="size-4" />
              </button>
            </div>
          ) : (
            <div>
              <label className="mb-1 block text-xs text-slate-500">{t.searchLabel}</label>
              <div className="flex gap-2">
                <input
                  value={q}
                  onChange={(event) => setQ(event.target.value)}
                  onKeyDown={(event) => {
                    // ຍິງບາໂຄດຈົບດ້ວຍ Enter — ຫ້າມໃຫ້ມັນ submit ຟອມທັງທີ່ຍັງບໍ່ເລືອກໜ່ວຍ
                    if (event.key === "Enter") {
                      event.preventDefault();
                      lookup();
                    }
                  }}
                  placeholder={t.searchPlaceholder}
                  className={field}
                />
                <button
                  type="button"
                  onClick={lookup}
                  className="inline-flex h-9 shrink-0 items-center gap-1 rounded-lg border border-slate-300 px-3 text-xs font-semibold text-slate-600 hover:bg-white"
                >
                  {looking ? <LoaderCircle className="size-3.5 animate-spin" /> : <Search className="size-3.5" />}
                  {t.lookup}
                </button>
              </div>

              {units.length > 0 && (
                <ul className="mt-2 max-h-64 space-y-1 overflow-auto rounded-lg border border-slate-200 bg-white p-1">
                  {units.map((unit) => (
                    <li key={`${unit.isn}-${unit.item_code}`}>
                      <button
                        type="button"
                        disabled={!!unit.lent_job}
                        onClick={() => pick(unit)}
                        className="block w-full rounded px-3 py-2 text-left text-xs hover:bg-teal-50 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent"
                      >
                        <span className="font-semibold text-slate-800">{unit.item_name}</span>
                        <span className="mt-0.5 block text-slate-400">
                          ISN {unit.isn} · {unit.item_code}
                          {unit.wh_name ? ` · ${unit.wh_name}` : ""}
                        </span>
                        {unit.lent_job && (
                          <span className="mt-0.5 block font-semibold text-amber-600">
                            {t.alreadyLent} {unit.lent_job}
                          </span>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {searched && !looking && units.length === 0 && (
                <p className="mt-2 rounded-lg bg-white p-3 text-center text-xs text-slate-400">{t.searchEmpty}</p>
              )}
            </div>
          )}

          <div>
            <label className="mb-1 block text-xs text-slate-500">{t.lendNoteLabel}</label>
            <input name="note" className={field} />
          </div>
          {lendState.error && <p className="text-xs font-semibold text-red-600">{lendState.error}</p>}
          <button
            disabled={lending || !picked}
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-emerald-600 px-4 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            {lending ? <LoaderCircle className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
            {t.saveLend}
          </button>
        </form>
      )}

      {rows.length === 0 ? (
        <p className="py-3 text-center text-xs text-slate-400">{t.empty}</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((row) => (
            <li
              key={row.id}
              className={`rounded-lg border p-3 ${row.return_time ? "border-slate-200 bg-slate-50" : "border-amber-200 bg-amber-50"}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-800">{row.item_name}</p>
                  <p className="text-[11px] text-slate-500">
                    ISN {row.isn}
                    {row.sn ? ` · S/N ${row.sn}` : ""} · {t.lentAt} {row.lend_time} {t.by} {row.lend_by}
                  </p>
                  {row.lend_note && <p className="text-[11px] text-slate-500">{t.note}: {row.lend_note}</p>}
                  {/* ໃບເຊັນຮັບ — ເຄື່ອງສຳຮອງບໍ່ຜ່ານເອກະສານສາງ ⇒ ໃບນີ້ຄືຫຼັກຖານດຽວ */}
                  <a
                    href={`/service/loaners/${row.id}/print`}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-teal-700 hover:underline"
                  >
                    <Printer className="size-3" />
                    {t.printSlip}
                  </a>
                  {row.return_time && (
                    <p className="text-[11px] font-semibold text-emerald-700">
                      {t.returnedAt} {row.return_time} {t.by} {row.return_by}
                      {row.return_note ? ` · ${row.return_note}` : ""}
                    </p>
                  )}
                </div>
                {row.return_time ? (
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-700">
                    {t.returnedDays} · {row.days} {t.days}
                  </span>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-amber-200 px-2 py-0.5 text-[11px] font-bold text-amber-900">
                      {t.withCustomer} {row.days} {t.days}
                    </span>
                    {canEdit && (
                      <form action={returnAction} className="flex items-center gap-1">
                        <input type="hidden" name="id" value={row.id} />
                        <input type="hidden" name="job" value={code} />
                        <input name="note" placeholder={t.returnNotePlaceholder} className="h-8 w-36 rounded-lg border border-slate-300 px-2 text-xs outline-none focus:border-teal-500" />
                        <button
                          disabled={returning}
                          className="inline-flex h-8 items-center gap-1 rounded-lg bg-teal-600 px-3 text-xs font-semibold text-white hover:bg-teal-700 disabled:opacity-60"
                        >
                          {returning ? <LoaderCircle className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
                          {t.returnAction}
                        </button>
                      </form>
                    )}
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      {returnState.error && <p className="mt-2 text-xs font-semibold text-red-600">{returnState.error}</p>}
      {outstanding.length > 0 && (
        <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-[11px] font-semibold text-amber-800">
          {t.blockNote}
        </p>
      )}
    </section>
  );
}
