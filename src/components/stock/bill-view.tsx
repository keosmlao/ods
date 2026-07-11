import { SpareLineTable, type SpareLine } from "@/components/stock/spare-lines";
import { LinkButton, PageTitle } from "@/components/ui";
import { ArrowLeft } from "lucide-react";

export type BillField = { label: string; value: string | null; accent?: boolean };

/**
 * ໜ້າເບິ່ງບິນແບບອ່ານຢ່າງດຽວ — ໃຊ້ຮ່ວມກັນ 3 ໜ້າຂອງ ods:
 * showrequstpage.html (/showstkrq), showbilldipatch.html (/showbilldp), showbillreturn.html (/showbillreturn)
 */
export function BillView({
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
  return (
    <div className="w-full space-y-6">
      <PageTitle sub={subtitle}>{title}</PageTitle>

      <LinkButton href={backHref} tone="neutral">
        <ArrowLeft className="size-4" />
        ກັບຄືນ
      </LinkButton>

      <div className="grid gap-x-8 gap-y-1 rounded-xl bg-[#0a5e96] p-5 text-sm text-white md:grid-cols-2">
        {fields.map((field) => (
          <p key={field.label}>
            <span className="text-white/70">{field.label}</span>{" "}
            <span className={field.accent ? "text-[#ffd0d0]" : undefined}>{field.value || "-"}</span>
          </p>
        ))}
      </div>

      <SpareLineTable lines={lines} />
    </div>
  );
}
