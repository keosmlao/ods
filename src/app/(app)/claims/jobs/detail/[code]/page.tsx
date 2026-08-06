import { Chatter } from "@/components/chatter/chatter";
import { BackLink } from "@/components/back-link";
import { ClaimResolveCard } from "@/components/claim/claim-resolve-card";
import { LoanerCard } from "@/components/service/loaner-card";
import { Card, LinkButton, PageTitle } from "@/components/ui";
import { getSession } from "@/lib/auth";
import { claimByNo } from "@/lib/claim";
import { query } from "@/lib/db";
import { loanersFor } from "@/lib/loaner";
import { CLAIM_SIDE, roleOf, SERVICE_SIDE } from "@/lib/roles";
import { ClipboardCheck, PackageCheck, Printer } from "lucide-react";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getLocale } from "@/lib/i18n/locale";
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
  const t = (await getDictionary(await getLocale())).claimJobs;
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
      <BackLink fallback="/claims/jobs" label={t.queueTitle} />

      <div className="flex flex-wrap items-end justify-between gap-3">
        <PageTitle sub={`${t.detailTitle.replace("{code}", row.code)} · ${t.receivedAt} ${row.registered ?? "-"}`}>
          🛡️ {row.product || t.claimJob}
        </PageTitle>
        <div className="flex gap-2">
          {!row.checked && (
            <LinkButton tone="success" href={`/claims/jobs/check/${encodeURIComponent(row.code)}`}>
              <ClipboardCheck className="size-4" />
              {t.saveCheck}
            </LinkButton>
          )}
          {row.checked && !row.returned && (
            <LinkButton tone="success" href={`/claims/jobs/return/${encodeURIComponent(row.code)}`}>
              <PackageCheck className="size-4" />
              {t.returnToShop}
            </LinkButton>
          )}
          <LinkButton tone="neutral" href={`/service/${encodeURIComponent(row.code)}/print`}>
            <Printer className="size-4" />
            {t.printIntake}
          </LinkButton>
        </div>
      </div>

      <Card title={t.colScope}>
        <div className="flex flex-wrap items-center gap-3">
          <span className={`rounded-full px-3 py-1 text-xs font-bold ${row.claim_scope === "part" ? "bg-brand-orange-100 text-brand-orange-700" : "bg-slate-100 text-slate-700"}`}>
            {row.claim_scope === "part" ? "{t.scopePart}" : "{t.scopeWhole}"}
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
            <Link href={`/claims/${row.claim_no}`} className="ml-auto text-sm font-semibold text-brand-800 hover:underline">
              {t.claimDoc} {row.claim_no} {claim ? `· ${claim.status}` : ""}
            </Link>
          )}
        </div>
      </Card>

      {/* ຕັດສິນ ປ່ຽນ/ສ້ອມ — ຂັ້ນຫຼັກຂອງເຄມ (ເຮັດຢູ່ນີ້ ບໍ່ຕ້ອງໄປໜ້າໃບເຄມ) */}
      {claim && <ClaimResolveCard claim={claim} canEdit={canEdit} />}

      <Card title={t.jobInfo}>
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {field(t.colShop, row.customer)}
          {field(t.tel, row.tel)}
          {field(t.address, row.address)}
          {field(t.receiver, row.receiver)}
          {field(t.product, row.product)}
          {field(t.brandModel, [row.brand, row.model].filter(Boolean).join(" / "))}
          {field("S/N", row.sn)}
          {field(t.warranty, row.warranty)}
          {field(t.shopFault, row.issue)}
          {field(t.techResult, row.diagnosis)}
          {field(t.tech, row.technician)}
          {field(t.checkedAt, row.checked)}
        </dl>
      </Card>

      <LoanerCard code={row.code} rows={loaners} canEdit={canEdit} />

      <Chatter model="tb_product" resId={row.code} />
    </div>
  );
}
