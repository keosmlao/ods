"use client";
import { lendLoaner, returnLoaner, type LoanerState } from "@/app/actions/loaner";
import type { LoanerRow } from "@/lib/loaner";
import { Check, LoaderCircle, PackageCheck, Plus, X } from "lucide-react";
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
  const [open, setOpen] = useState(false);
  const [lendState, lendAction, lending] = useActionState<LoanerState, FormData>(lendLoaner, {});
  const [returnState, returnAction, returning] = useActionState<LoanerState, FormData>(returnLoaner, {});

  const [isn, setIsn] = useState("");
  const [itemName, setItemName] = useState("");
  const [itemCode, setItemCode] = useState("");
  const [looking, setLooking] = useState(false);

  const outstanding = rows.filter((row) => !row.return_time);

  /** ຫາຊື່ເຄື່ອງຈາກ ISN — ບໍ່ພົບກໍ່ພິມເອງໄດ້ (ເຄື່ອງເກົ່າບາງໜ່ວຍບໍ່ມີໃນ ERP ແລ້ວ) */
  async function lookup() {
    if (isn.trim().length < 3) return;
    setLooking(true);
    try {
      const body = await (await fetch(`/api/scan?code=${encodeURIComponent(isn.trim())}`)).json();
      if (body.found) {
        setItemName(body.product ?? "");
        setItemCode(body.itemCode ?? "");
      }
    } catch {
      // ຫາບໍ່ໄດ້ = ພິມເອງ — ບໍ່ຕ້ອງລົບກວນຜູ້ໃຊ້
    } finally {
      setLooking(false);
    }
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-3 border-b border-slate-100 pb-2">
        <h2 className="flex items-center gap-2 text-sm font-bold text-slate-700">
          <PackageCheck className="size-4 text-teal-600" />
          ເຄື່ອງສຳຮອງໃຫ້ລູກຄ້າໃຊ້ກ່ອນ
          {outstanding.length > 0 && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-800">
              ຄ້າງຄືນ {outstanding.length}
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
            {open ? "ຍົກເລີກ" : "ໃຫ້ເຄື່ອງສຳຮອງ"}
          </button>
        )}
      </div>

      {open && canEdit && (
        <form action={lendAction} className="mb-3 space-y-2 rounded-lg bg-slate-50 p-3">
          <input type="hidden" name="job" value={code} />
          <input type="hidden" name="item_code" value={itemCode} />
          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs text-slate-500">ISN ຂອງເຄື່ອງສຳຮອງ *</label>
              <div className="flex gap-2">
                <input
                  name="isn"
                  required
                  value={isn}
                  onChange={(event) => setIsn(event.target.value)}
                  onBlur={lookup}
                  placeholder="ອ່ານເລກຈາກປ້າຍຕົວເຄື່ອງ"
                  className={field}
                />
                <button
                  type="button"
                  onClick={lookup}
                  className="h-9 shrink-0 rounded-lg border border-slate-300 px-3 text-xs font-semibold text-slate-600 hover:bg-white"
                >
                  {looking ? <LoaderCircle className="size-3.5 animate-spin" /> : "ຫາຈາກ ERP"}
                </button>
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-500">ຊື່ເຄື່ອງ *</label>
              <input
                name="item_name"
                required
                value={itemName}
                onChange={(event) => setItemName(event.target.value)}
                placeholder="ເຊັ່ນ ຈໍ LED 32 ນິ້ວ (ເຄື່ອງສູນ)"
                className={field}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs text-slate-500">ໝາຍເຫດ (ສະພາບເຄື່ອງ, ອຸປະກອນທີ່ໃຫ້ໄປນຳ)</label>
              <input name="note" className={field} />
            </div>
          </div>
          {lendState.error && <p className="text-xs font-semibold text-red-600">{lendState.error}</p>}
          <button
            disabled={lending}
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-emerald-600 px-4 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            {lending ? <LoaderCircle className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
            ບັນທຶກການໃຫ້ຢືມ
          </button>
        </form>
      )}

      {rows.length === 0 ? (
        <p className="py-3 text-center text-xs text-slate-400">ບໍ່ມີເຄື່ອງສຳຮອງໃນໃບງານນີ້</p>
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
                    {row.sn ? ` · S/N ${row.sn}` : ""} · ໃຫ້ຢືມ {row.lend_time} ໂດຍ {row.lend_by}
                  </p>
                  {row.lend_note && <p className="text-[11px] text-slate-500">ໝາຍເຫດ: {row.lend_note}</p>}
                  {row.return_time && (
                    <p className="text-[11px] font-semibold text-emerald-700">
                      ຮັບຄືນ {row.return_time} ໂດຍ {row.return_by}
                      {row.return_note ? ` · ${row.return_note}` : ""}
                    </p>
                  )}
                </div>
                {row.return_time ? (
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-700">
                    ຄືນແລ້ວ · {row.days} ມື້
                  </span>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-amber-200 px-2 py-0.5 text-[11px] font-bold text-amber-900">
                      ຢູ່ນຳລູກຄ້າ {row.days} ມື້
                    </span>
                    {canEdit && (
                      <form action={returnAction} className="flex items-center gap-1">
                        <input type="hidden" name="id" value={row.id} />
                        <input type="hidden" name="job" value={code} />
                        <input name="note" placeholder="ສະພາບຕອນຮັບຄືນ" className="h-8 w-36 rounded-lg border border-slate-300 px-2 text-xs outline-none focus:border-teal-500" />
                        <button
                          disabled={returning}
                          className="inline-flex h-8 items-center gap-1 rounded-lg bg-teal-600 px-3 text-xs font-semibold text-white hover:bg-teal-700 disabled:opacity-60"
                        >
                          {returning ? <LoaderCircle className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
                          ຮັບຄືນ
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
          ຍັງມີເຄື່ອງສຳຮອງຄ້າງ ⇒ ສົ່ງເຄື່ອງຄືນລູກຄ້າ / ປິດງານບໍ່ໄດ້ຈົນກວ່າຈະຮັບຄືນ
        </p>
      )}
    </section>
  );
}
