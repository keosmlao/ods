import type { Dictionary } from "@/lib/i18n/dictionaries";
import { CalendarDays, FileCheck2, Printer, RefreshCcw, UserRound } from "lucide-react";

type Dict = Dictionary["manualPage"];
export type DocMeta = Dict["docMeta"];
export type Doc = Dict["sopDocs"][number];

/** ວັນທີ່ມີຜົນ / revision — ຄ່າດຽວກັນທຸກເອກະສານ (ບໍ່ຂຶ້ນກັບພາສາ) */
export const DOC_REV = "01";
export const DOC_EFF = "20-07-2026";

function DocumentHeader({ doc, meta, printHref, printLabel }: { doc: Doc; meta: DocMeta; printHref?: string; printLabel?: string }) {
  const documentType = doc.code.startsWith("SOP-") ? "SOP" : "WI";

  return (
    <header className="relative overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-teal-950 px-5 py-5 text-white print:border-b-2 print:border-slate-800 print:bg-white print:px-4 print:py-3 print:text-slate-900">
      <div className="pointer-events-none absolute -right-16 -top-20 size-52 rounded-full bg-teal-400/10 blur-2xl print:hidden" />
      <div className="pointer-events-none absolute -bottom-24 left-1/3 size-44 rounded-full bg-cyan-300/5 blur-2xl print:hidden" />

      <div className="relative flex items-start gap-3.5 pr-9">
        <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-white/10 ring-1 ring-white/15 backdrop-blur print:size-10 print:rounded-lg print:bg-slate-100 print:text-slate-800 print:ring-slate-300">
          <FileCheck2 className="size-6 text-teal-300 print:size-5 print:text-teal-700" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-teal-400/15 px-2.5 py-1 font-mono text-[10px] font-black tracking-[0.18em] text-teal-200 ring-1 ring-inset ring-teal-300/20 print:bg-teal-50 print:text-teal-800 print:ring-teal-200">
              {documentType}
            </span>
            <span className="font-mono text-[11px] font-semibold text-slate-400 print:text-slate-500">{doc.code}</span>
          </div>
          <h3 className="mt-2 text-[17px] font-extrabold leading-snug tracking-tight text-white print:mt-1 print:text-[15px] print:text-slate-900">{doc.title}</h3>
          <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500 print:hidden">Quality Management System</p>
        </div>
      </div>

      <dl className="relative mt-5 grid gap-2 sm:grid-cols-3 print:mt-3 print:grid-cols-3">
        <div className="flex min-w-0 items-center gap-2.5 rounded-xl bg-white/[0.07] px-3 py-2.5 ring-1 ring-inset ring-white/10 print:rounded-none print:bg-white print:px-2 print:py-1.5 print:ring-slate-300">
          <RefreshCcw className="size-4 shrink-0 text-teal-300 print:size-3.5 print:text-teal-700" />
          <div className="min-w-0">
            <dt className="text-[9px] font-bold uppercase tracking-wider text-slate-400 print:text-slate-500">{meta.revision}</dt>
            <dd className="font-mono text-xs font-bold text-white print:text-slate-800">{DOC_REV}</dd>
          </div>
        </div>
        <div className="flex min-w-0 items-center gap-2.5 rounded-xl bg-white/[0.07] px-3 py-2.5 ring-1 ring-inset ring-white/10 print:rounded-none print:bg-white print:px-2 print:py-1.5 print:ring-slate-300">
          <CalendarDays className="size-4 shrink-0 text-teal-300 print:size-3.5 print:text-teal-700" />
          <div className="min-w-0">
            <dt className="text-[9px] font-bold uppercase tracking-wider text-slate-400 print:text-slate-500">{meta.effectiveDate}</dt>
            <dd className="font-mono text-xs font-bold text-white print:text-slate-800">{DOC_EFF}</dd>
          </div>
        </div>
        <div className="flex min-w-0 items-center gap-2.5 rounded-xl bg-white/[0.07] px-3 py-2.5 ring-1 ring-inset ring-white/10 print:rounded-none print:bg-white print:px-2 print:py-1.5 print:ring-slate-300">
          <UserRound className="size-4 shrink-0 text-teal-300 print:size-3.5 print:text-teal-700" />
          <div className="min-w-0">
            <dt className="text-[9px] font-bold uppercase tracking-wider text-slate-400 print:text-slate-500">{meta.owner}</dt>
            <dd className="truncate text-xs font-bold text-white print:text-slate-800">{doc.owner}</dd>
          </div>
        </div>
      </dl>
      {printHref && (
        <a
          href={printHref}
          target="_blank"
          rel="noreferrer"
          title={printLabel}
          className="no-print absolute right-4 top-4 grid size-9 place-items-center rounded-xl bg-white/10 text-slate-300 ring-1 ring-inset ring-white/15 backdrop-blur transition hover:-translate-y-0.5 hover:bg-white/20 hover:text-white"
        >
          <Printer className="size-4" />
        </a>
      )}
    </header>
  );
}

function NumberedSection({ n, label, children }: { n: number; label: string; children: React.ReactNode }) {
  return (
    <section className="group flex gap-3 border-b border-slate-100 px-5 py-4 last:border-b-0 print:gap-2 print:border-slate-300 print:px-4 print:py-2.5">
      <div className="grid size-7 shrink-0 place-items-center rounded-lg bg-teal-50 font-mono text-[11px] font-black text-teal-700 ring-1 ring-inset ring-teal-100 transition group-hover:bg-teal-600 group-hover:text-white print:size-6 print:rounded-none print:bg-slate-100 print:text-slate-800 print:ring-slate-300">
        {String(n).padStart(2, "0")}
      </div>
      <div className="min-w-0 flex-1">
        <h4 className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-slate-800">{label}</h4>
        <div className="mt-1 text-[13px] leading-relaxed text-slate-600">{children}</div>
      </div>
    </section>
  );
}

/**
 * ໃບເອກະສານ SOP/WI ແບບ QMS — ຫົວມີ ລະຫັດ · revision · ວັນທີມີຜົນ · ຜູ້ຮັບຜິດຊອບ.
 * ໃຊ້ຮ່ວມ ໜ້າຄູ່ມື (/manual) ແລະ ໜ້າພິມ (/manual/documents/print).
 * ໃສ່ `printHref` ⇒ ໂຊ້ icon ພິມ (ພິມใบเดียว); `printLabel` = tooltip.
 */
export function DocCard({ doc, meta, printHref, printLabel }: { doc: Doc; meta: DocMeta; printHref?: string; printLabel?: string }) {
  const isSop = doc.code.startsWith("SOP-");

  return (
    <article className="doc-card relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_18px_50px_-28px_rgba(15,23,42,0.35)] ring-1 ring-slate-900/[0.025] transition-shadow hover:shadow-[0_22px_60px_-28px_rgba(15,23,42,0.45)] print:rounded-none print:border-slate-400 print:shadow-none print:ring-0">
      <DocumentHeader doc={doc} meta={meta} printHref={printHref} printLabel={printLabel} />

      {isSop ? (
        <div>
          <NumberedSection n={1} label={meta.purpose}>{doc.purpose}</NumberedSection>
          <NumberedSection n={2} label={meta.scope}>{doc.scope}</NumberedSection>
          <NumberedSection n={3} label={meta.owner}>{doc.owner}</NumberedSection>
          <NumberedSection n={4} label={meta.references}>{doc.refs || "—"}</NumberedSection>
          <NumberedSection n={5} label={meta.procedure}>
            <div className="mt-2 overflow-hidden rounded-xl border border-slate-200 shadow-sm print:rounded-none print:border-slate-400 print:shadow-none">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="bg-slate-900 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-300 print:bg-slate-100 print:text-slate-700">
                    <th className="w-11 border-r border-white/10 px-2 py-2.5 text-center print:border-slate-300">#</th>
                    <th className="px-3 py-2">{meta.procedure}</th>
                    <th className="hidden w-32 border-l border-white/10 px-3 py-2 sm:table-cell print:border-slate-300">{meta.owner}</th>
                  </tr>
                </thead>
                <tbody>
                  {doc.steps.map((step, i) => (
                    <tr key={i} className="border-t border-slate-100 align-top transition-colors even:bg-slate-50/60 hover:bg-teal-50/50 print:border-slate-300 print:bg-white">
                      <td className="border-r border-slate-100 px-2 py-3 text-center font-mono text-[11px] font-black text-teal-700 print:border-slate-300">{String(i + 1).padStart(2, "0")}</td>
                      <td className="px-3 py-2.5 text-[12.5px] leading-relaxed text-slate-700">{step}</td>
                      <td className="hidden border-l border-slate-100 px-3 py-2.5 text-[11px] text-slate-500 sm:table-cell print:border-slate-300">
                        <span className="inline-flex rounded-full bg-slate-100 px-2 py-1 font-semibold text-slate-600 print:bg-white print:p-0">{doc.owner}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </NumberedSection>
        </div>
      ) : (
        <div>
          <div className="grid gap-3 border-b border-slate-200 p-4 md:grid-cols-2">
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
        </div>
      )}
    </article>
  );
}
