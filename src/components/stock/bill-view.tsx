import { SpareLineTable, type SpareLine } from "@/components/stock/spare-lines";
import { PrintButton } from "@/components/print-button";
import { LinkButton, PageTitle } from "@/components/ui";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getLocale } from "@/lib/i18n/locale";
import { ArrowLeft } from "lucide-react";

export type BillField = { label: string; value: string | null; accent?: boolean };

/**
 * ໜ້າເບິ່ງບິນແບບອ່ານຢ່າງດຽວ — ໃຊ້ຮ່ວມກັນ 3 ໜ້າຂອງ ods:
 * showrequstpage.html (/showstkrq), showbilldipatch.html (/showbilldp), showbillreturn.html (/showbillreturn)
 */
export async function BillView({
  title,
  subtitle,
  backHref,
  fields,
  lines,
}: {
  title: string;
  subtitle?: string;
  backHref: string;
  fields: BillField[];
  lines: Omit<SpareLine, "roworder">[];
}) {
  const t = (await getDictionary(await getLocale())).docChrome;
  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 bg-white print:max-w-none print:space-y-4">
      <style>{`@media print { @page { size: A4; margin: 12mm } .no-print { display:none !important } }`}</style>
      <div className="no-print">
        <PageTitle sub={subtitle}>{title}</PageTitle>
      </div>

      <div className="no-print flex flex-wrap gap-2">
        <LinkButton href={backHref} tone="neutral">
          <ArrowLeft className="size-4" />
          {t.back}
        </LinkButton>
        <PrintButton />
      </div>

      <h1 className="hidden border-b-2 border-slate-900 pb-3 text-center text-xl font-bold print:block">
        {title}
      </h1>

      <div className="grid gap-x-8 gap-y-1 rounded-xl bg-[#0a5e96] p-5 text-sm text-white md:grid-cols-2 print:grid-cols-2 print:rounded-none print:border print:border-slate-900 print:bg-white print:text-slate-900">
        {fields.map((field) => (
          <p key={field.label}>
            <span className="text-white/70 print:text-slate-500">{field.label}</span>{" "}
            <span className={field.accent ? "text-[#ffd0d0] print:text-slate-900" : undefined}>{field.value || "-"}</span>
          </p>
        ))}
      </div>

      <SpareLineTable lines={lines} />
    </div>
  );
}
