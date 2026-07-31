import { Chatter } from "@/components/chatter/chatter";
import { ClaimResolveCard } from "@/components/claim/claim-resolve-card";
import { LinkPending } from "@/components/link-pending";
import { LoanerCard } from "@/components/service/loaner-card";
import { Card, LinkButton, PageTitle } from "@/components/ui";
import { getSession } from "@/lib/auth";
import { claimByNo } from "@/lib/claim";
import { query } from "@/lib/db";
import { loanersFor } from "@/lib/loaner";
import { CLAIM_SIDE, roleOf, SERVICE_SIDE } from "@/lib/roles";
import { ArrowLeft, ClipboardCheck, PackageCheck, Printer } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

/**
 * **ໜ້າໃບງານເຄມ** — ຂອງເຄມເອງ ບໍ່ແມ່ນ /service/<code> ຂອງສ້ອມ (31-07-2026).
 *
 * ສະແດງສະເພາະສິ່ງທີ່ຄົນເຄມຕັດສິນໃຈ: ຮ້ານ/ເຄື່ອງ · **ຂອບເຂດເຄມ** · ຜົນກວດຂອງຊ່າງ ·
 * ໃບເຄມ CLM-B ພ້ອມປຸ່ມຕັດສິນ · ເຄື່ອງສຳຮອງ · ປະຫວັດ. ບໍ່ມີເລື່ອງໃບສະເໜີລາຄາ/QC
 * ຂອງສາຍສ້ອມມາປົນ.
 */
export const dynamic = "force-dynamic";

type Row = {
  code: string;
  registered: string | null;
  customer: string | null;
  tel: string | null;
  address: string | null;
  product: string | null;
  model: string | null;
  brand: string | null;
  sn: string | null;
  warranty: string | null;
  issue: string | null;
  diagnosis: string | null;
  technician: string | null;
  receiver: string | null;
  claim_scope: string | null;
  claim_part_code: string | null;
  claim_part_name: string | null;
  claim_part_sn: string | null;
  claim_part_qty: string | null;
  claim_decision: string | null;
  checked: string | null;
  returned: string | null;
  claim_no: string | null;
};

export default async function ClaimJobDetail({ params }: { params: Promise<{ code: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!CLAIM_SIDE.includes(roleOf(session))) redirect("/forbidden");
  const code = decodeURIComponent((await params).code);

  const row = (
    await query<Row>(
      `select a.code, to_char(a.time_register,'DD-MM-YYYY HH24:MI') registered,
          b.name_1 customer, b.tel, concat_ws(', ', b.address, d.name_1, c.name_1) address,
          a.name_1 product, a.p_model model, a.p_brand brand, a.sn, a.warrunty warranty,
          a.issue, a.issue_2 diagnosis, a.emp_code technician, a.user_regis receiver,
          a.claim_scope, a.claim_part_code, a.claim_part_name, a.claim_part_sn, a.claim_part_qty::text,
          a.claim_decision,
          to_char(a.time_finish_check,'DD-MM-YYYY HH24:MI') checked,
          to_char(a.return_complete,'DD-MM-YYYY HH24:MI') returned,
          (select cl.claim_no from ods_claim cl where cl.ref_job = a.code order by cl.id desc limit 1) claim_no
        from tb_product a
        left join ar_customer b on b.code = a.cust_code
        left join province c on c.code = b.provine
        left join city d on d.code = b.city and d.province = b.provine
       where a.code = $1 and coalesce(a.job_kind,'repair') = 'claim' limit 1`,
      [code],
    )
  ).rows[0];
  if (!row) notFound();

  const [claim, loaners] = await Promise.all([
    row.claim_no ? claimByNo(row.claim_no) : Promise.resolve(null),
    loanersFor(code),
  ]);
  const canEdit = SERVICE_SIDE.includes(roleOf(session));

  const field = (label: string, value: string | null) => (
    <div key={label} className="border-b border-slate-100 pb-2">
      <dt className="text-xs text-slate-400">{label}</dt>
      <dd className="mt-1 text-sm font-medium text-slate-800">{value || "-"}</dd>
    </div>
  );

  return (
    <div className="w-full space-y-5">
      <Link href="/claims/jobs" className="inline-flex items-center gap-1.5 text-xs font-medium text-violet-600 hover:underline">
        <ArrowLeft className="size-3.5" />
        ຄິວງານເຄມ
        <LinkPending className="size-3" />
      </Link>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <PageTitle sub={`ໃບງານເຄມ #${row.code} · ຮັບເມື່ອ ${row.registered ?? "-"}`}>
          🛡️ {row.product || "ງານເຄມ"}
        </PageTitle>
        <div className="flex gap-2">
          {!row.checked && (
            <LinkButton tone="success" href={`/claims/jobs/check/${encodeURIComponent(row.code)}`}>
              <ClipboardCheck className="size-4" />
              ບັນທຶກຜົນກວດ
            </LinkButton>
          )}
          {row.checked && !row.returned && (
            <LinkButton tone="success" href={`/claims/jobs/return/${encodeURIComponent(row.code)}`}>
              <PackageCheck className="size-4" />
              ສົ່ງຄືນຮ້ານ
            </LinkButton>
          )}
          <LinkButton tone="neutral" href={`/service/${encodeURIComponent(row.code)}/print`}>
            <Printer className="size-4" />
            ພິມໃບຮັບເຄື່ອງ
          </LinkButton>
        </div>
      </div>

      <Card title="ຂອບເຂດເຄມ">
        <div className="flex flex-wrap items-center gap-3">
          <span className={`rounded-full px-3 py-1 text-xs font-bold ${row.claim_scope === "part" ? "bg-violet-100 text-violet-800" : "bg-slate-100 text-slate-700"}`}>
            {row.claim_scope === "part" ? "ເຄມສະເພາະອາໄຫຼ່" : "ເຄມທັງເຄື່ອງ"}
          </span>
          {row.claim_scope === "part" && (
            <span className="text-sm text-slate-700">
              {row.claim_part_name || "-"}
              {row.claim_part_code && <span className="ml-2 text-xs text-slate-400">{row.claim_part_code}</span>}
              {row.claim_part_qty && <span className="ml-2 text-xs text-slate-500">× {row.claim_part_qty}</span>}
              {row.claim_part_sn && <span className="ml-2 text-xs text-slate-400">S/N {row.claim_part_sn}</span>}
            </span>
          )}
          {row.claim_no && (
            <Link href={`/claims/${row.claim_no}`} className="ml-auto text-sm font-semibold text-teal-700 hover:underline">
              ໃບເຄມ {row.claim_no} {claim ? `· ${claim.status}` : ""}
            </Link>
          )}
        </div>
      </Card>

      {/* ຕັດສິນ ປ່ຽນ/ສ້ອມ — ຂັ້ນຫຼັກຂອງເຄມ (ເຮັດຢູ່ນີ້ ບໍ່ຕ້ອງໄປໜ້າໃບເຄມ) */}
      {claim && <ClaimResolveCard claim={claim} canEdit={canEdit} />}

      <Card title="ຂໍ້ມູນໃບງານ">
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {field("ຮ້ານ / ລູກຄ້າ", row.customer)}
          {field("ເບີໂທ", row.tel)}
          {field("ທີ່ຢູ່", row.address)}
          {field("ຜູ້ຮັບເຄື່ອງ", row.receiver)}
          {field("ສິນຄ້າ", row.product)}
          {field("ຍີ່ຫໍ້ / Model", [row.brand, row.model].filter(Boolean).join(" / "))}
          {field("S/N", row.sn)}
          {field("ການຮັບປະກັນ", row.warranty)}
          {field("ອາການທີ່ຮ້ານແຈ້ງ", row.issue)}
          {field("ຜົນກວດຂອງຊ່າງ", row.diagnosis)}
          {field("ຊ່າງ", row.technician)}
          {field("ກວດແລ້ວເມື່ອ", row.checked)}
        </dl>
      </Card>

      <LoanerCard code={row.code} rows={loaners} canEdit={canEdit} />

      <Chatter model="tb_product" resId={row.code} />
    </div>
  );
}
