"use client";

import {
  cancelReturnRequest,
  removeReturnDraftLine,
  saveReturnRequest,
  type StockState,
} from "@/app/actions/stock";
import { KeepFormValues } from "@/components/keep-form-values";
import { FormError, SaveBar } from "@/components/stock/save-bar";
import { LinkButton, inputClass } from "@/components/ui";
import { useDict } from "@/lib/i18n/context";
import { ArrowLeft, FileInput, PackageX, Trash2, Undo2 } from "lucide-react";
import Link from "next/link";
import { useActionState } from "react";

export type ReturnDraftLine = {
  rnum: number;
  item_code: string;
  item_name: string | null;
  qty: string;
  unit_code: string | null;
  roworder: number;
};

/**
 * **ໜ້າໃບຂໍສົ່ງຄືນອາໄຫຼ່ (SRI)** — ອອກແບບໃໝ່ 05-08-2026 ແທນ `DocForm` ກ້ອນຟ້າ.
 *
 * ⚠️ **ຟອມດຽວທັງໜ້າ** — ແຖວອາໄຫຼ່ຢູ່ **ໃນ** ຟອມ ຈຶ່ງໃຊ້ `<form>` ຊ້ອນກັນບໍ່ໄດ້ (HTML ຫ້າມ):
 * ປຸ່ມຖັງຂີ້ເຫຍື້ອຈຶ່ງເປັນ `formAction={removeReturnDraftLine}` ພ້ອມ `name="row_id"`
 * (ຄ່າຂອງປຸ່ມທີ່ຖືກກົດເທົ່ານັ້ນທີ່ຖືກສົ່ງ) ⇒ ໄດ້ໜ້າຕາເປັນອັນດຽວກັນ ໂດຍບໍ່ເສຍພຶດຕິກຳເດີມ.
 */
export function ReturnRequestForm({
  docNo,
  docDate,
  docRef,
  docRefDate,
  dispatchedAt,
  productCode,
  customer,
  product,
  issue,
  warranty,
  technician,
  lines,
}: {
  docNo: string;
  /** ວັນທີໃບໃໝ່ — ຮູບແບບພ້ອມສະແດງແລ້ວ (dd-MM-yyyy) */
  docDate: string;
  docRef: string;
  docRefDate: string;
  dispatchedAt: string | null;
  productCode: string;
  customer: string | null;
  product: string | null;
  issue: string | null;
  warranty: string | null;
  technician: string;
  lines: ReturnDraftLine[];
}) {
  const dict = useDict();
  const t = dict.stockReturnsDetail;
  const [state, action] = useActionState<StockState, FormData>(saveReturnRequest, {});
  const empty = lines.length === 0;
  const totalQty = lines.reduce((sum, line) => sum + Number(line.qty || 0), 0);

  return (
    <form action={action} className="w-full space-y-4">
      <KeepFormValues />
      <input type="hidden" name="doc_no" value={docRef} />
      <input type="hidden" name="doc_ref" value={docRef} />
      <input type="hidden" name="doc_ref_date" value={docRefDate} />
      <input type="hidden" name="Product_code" value={productCode} />

      {/* ── ແຖບຫົວ: ຊື່ເອກະສານ + ປຸ່ມບັນທຶກ/ອອກ (ຄ້າງໄວ້ຕອນເລື່ອນ) ── */}
      <div className="sticky top-20 z-10 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white/95 p-3 shadow-sm backdrop-blur">
        <div className="min-w-0">
          <p className="flex items-center gap-2 font-bold text-slate-700">
            <Undo2 className="size-4 shrink-0 text-brand-700" />
            {t.title}
          </p>
          <p className="mt-0.5 truncate text-xs text-slate-500">
            {docNo} · {docDate}
          </p>
        </div>
        {/* ອອກ = ຖິ້ມແຖວຮ່າງທັງໝົດ ບໍ່ແມ່ນລິ້ງກັບຄືນລ້ວນ (ບໍ່ດັ່ງນັ້ນກະຕ່າຄ້າງ) */}
        <SaveBar exitAction={cancelReturnRequest} disabled={empty} />
      </div>

      <FormError message={state.error} />

      {/* ── ຫົວບິນ: ໃບໃໝ່ ← ໃບເບີກ ← ວຽກ ── */}
      <section className="grid gap-px overflow-hidden rounded-xl border border-slate-200 bg-slate-200 shadow-sm md:grid-cols-3">
        <div className="bg-brand-700 p-4 text-white">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-white/70">{t.docSection}</p>
          <p className="mt-1 font-mono text-lg font-bold">{docNo}</p>
          <p className="mt-1 text-sm text-white/80">{docDate}</p>
        </div>

        <div className="bg-white p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{t.fromDispatch}</p>
          <p className="mt-1 font-mono text-lg font-bold text-slate-700">{docRef}</p>
          <p className="mt-1 text-sm text-slate-500">{dispatchedAt ?? "-"}</p>
        </div>

        <div className="space-y-1 bg-white p-4 text-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{t.jobSection}</p>
          <Link
            href={`/repair/${productCode}`}
            className="inline-flex items-center gap-1 font-bold text-brand-700 hover:underline"
          >
            <FileInput className="size-3.5" />
            {productCode}
          </Link>
          <Field label={t.fieldCustomer} value={customer} />
          <Field label={t.fieldProduct} value={product} />
          <Field label={t.fieldWarranty} value={warranty} />
          <Field label={t.fieldTechnician} value={technician} />
        </div>

        {issue && (
          <div className="bg-brand-orange-50 px-4 py-3 text-sm md:col-span-3">
            <span className="text-slate-500">{t.fieldIssue}</span>{" "}
            <span className="font-semibold text-brand-orange-700">{issue}</span>
          </div>
        )}

        <label className="block bg-white p-4 md:col-span-3">
          <span className="mb-1 block text-sm text-slate-600">{dict.docChrome.remark}</span>
          <input type="text" name="remark" autoComplete="off" className={inputClass} />
        </label>
      </section>

      {/* ── ລາຍການອາໄຫຼ່ທີ່ຈະສົ່ງຄືນ ── */}
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
          <h2 className="flex items-center gap-2 font-bold text-slate-700">
            {t.sparesToReturn}
            {!empty && (
              <span className="rounded-full bg-brand-100 px-2 py-0.5 text-xs font-semibold text-brand-800">
                {lines.length} {t.linesSuffix}
              </span>
            )}
          </h2>
          {!empty && <p className="text-xs text-slate-500">{t.pickHint}</p>}
        </div>

        {empty ? (
          <div className="flex flex-col items-center gap-3 px-4 py-12 text-center">
            <PackageX className="size-10 text-slate-300" />
            <p className="font-semibold text-slate-600">{t.noSparesToReturn}</p>
            <p className="max-w-lg text-sm text-slate-500">{t.emptyHint}</p>
            <LinkButton href="/stock/receive-returns" tone="neutral" size="sm">
              <ArrowLeft className="size-3.5" />
              {t.backToList}
            </LinkButton>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm" style={{ minWidth: 720 }}>
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                    <th className="w-12 px-3 py-2.5 text-center font-semibold">#</th>
                    <th className="px-3 py-2.5 text-left font-semibold">{t.colItemCode}</th>
                    <th className="px-3 py-2.5 text-left font-semibold">{t.colItemName}</th>
                    <th className="w-24 px-3 py-2.5 text-right font-semibold">{t.colQty}</th>
                    <th className="w-24 px-3 py-2.5 text-center font-semibold">{t.colUnit}</th>
                    <th className="w-14 px-3 py-2.5" />
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line) => (
                    <tr key={line.roworder} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/70">
                      <td className="px-3 py-2.5 text-center text-slate-400">{line.rnum}</td>
                      <td className="px-3 py-2.5 font-mono text-slate-700">{line.item_code}</td>
                      <td className="px-3 py-2.5 text-slate-700">{line.item_name ?? "-"}</td>
                      <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-slate-700">
                        {Number(line.qty)}
                      </td>
                      <td className="px-3 py-2.5 text-center text-slate-500">{line.unit_code ?? "-"}</td>
                      <td className="px-3 py-2.5 text-center">
                        <button
                          type="submit"
                          formAction={removeReturnDraftLine}
                          formNoValidate
                          name="row_id"
                          value={line.roworder}
                          title={t.removeLine}
                          className="grid size-7 place-items-center rounded-lg text-slate-400 transition hover:bg-brand-orange-50 hover:text-brand-orange-700"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="border-t border-slate-100 bg-slate-50 px-4 py-2.5 text-right text-xs text-slate-500">
              {t.totalLabel}{" "}
              <span className="font-semibold text-slate-700">
                {lines.length} {t.linesSuffix}
              </span>{" "}
              · <span className="font-semibold tabular-nums text-slate-700">{totalQty}</span> {t.colQty}
            </p>
          </>
        )}
      </section>
    </form>
  );
}

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <p className="truncate" title={value ?? undefined}>
      <span className="text-slate-500">{label}</span> <span className="text-slate-700">{value || "-"}</span>
    </p>
  );
}
