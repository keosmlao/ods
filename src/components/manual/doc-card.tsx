import type { Dictionary } from "@/lib/i18n/dictionaries";
import { Printer } from "lucide-react";

type Dict = Dictionary["manualPage"];
export type DocMeta = Dict["docMeta"];
export type Doc = Dict["sopDocs"][number];

/** ວັນທີ່ມີຜົນ / revision — ຄ່າດຽວກັນທຸກເອກະສານ (ບໍ່ຂຶ້ນກັບພາສາ) */
export const DOC_REV = "01";
export const DOC_EFF = "20-07-2026";

/**
 * ໃບເອກະສານ SOP/WI ແບບ QMS — ຫົວມີ ລະຫັດ · revision · ວັນທີມີຜົນ · ຜູ້ຮັບຜິດຊອບ.
 * ໃຊ້ຮ່ວມ ໜ້າຄູ່ມື (/manual) ແລະ ໜ້າພິມ (/manual/documents/print).
 * ໃສ່ `printHref` ⇒ ໂຊ້ icon ພິມ (ພິມใบเดียว); `printLabel` = tooltip.
 */
export function DocCard({ doc, meta, printHref, printLabel }: { doc: Doc; meta: DocMeta; printHref?: string; printLabel?: string }) {
  return (
    <article className="doc-card overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm print:break-inside-avoid print:shadow-none">
      <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-slate-200 bg-slate-50 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="rounded bg-teal-600 px-2 py-0.5 font-mono text-xs font-bold text-white">{doc.code}</span>
          <h3 className="text-[15px] font-bold text-slate-800">{doc.title}</h3>
        </div>
        <div className="flex items-center gap-3">
          <dl className="flex flex-wrap gap-x-4 gap-y-0.5 text-[11px] text-slate-500">
            <div className="flex gap-1"><dt className="font-semibold">{meta.revision}:</dt><dd className="font-mono">{DOC_REV}</dd></div>
            <div className="flex gap-1"><dt className="font-semibold">{meta.effectiveDate}:</dt><dd className="font-mono">{DOC_EFF}</dd></div>
            <div className="flex gap-1"><dt className="font-semibold">{meta.owner}:</dt><dd>{doc.owner}</dd></div>
          </dl>
          {printHref && (
            <a
              href={printHref}
              target="_blank"
              rel="noreferrer"
              title={printLabel}
              className="no-print grid size-7 shrink-0 place-items-center rounded-lg text-slate-400 hover:bg-teal-50 hover:text-teal-600"
            >
              <Printer className="size-4" />
            </a>
          )}
        </div>
      </header>
      <div className="grid gap-3 border-b border-slate-100 p-4 md:grid-cols-2">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wide text-teal-700">{meta.purpose}</p>
          <p className="mt-0.5 text-[13px] text-slate-600">{doc.purpose}</p>
        </div>
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wide text-teal-700">{meta.scope}</p>
          <p className="mt-0.5 text-[13px] text-slate-600">{doc.scope}</p>
        </div>
      </div>
      <div className="p-4">
        <p className="text-[11px] font-bold uppercase tracking-wide text-teal-700">{meta.procedure}</p>
        <ol className="mt-2 space-y-1.5">
          {doc.steps.map((step, i) => (
            <li key={i} className="flex gap-2.5 text-[13px] text-slate-700">
              <span className="mt-0.5 grid size-[20px] shrink-0 place-items-center rounded-md bg-slate-700 font-mono text-[11px] font-bold text-white">{i + 1}</span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
        {doc.refs && <p className="mt-3 text-[11px] text-slate-400">{meta.references}: {doc.refs}</p>}
      </div>
    </article>
  );
}
