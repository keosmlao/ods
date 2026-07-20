import { ClaimManage } from "@/components/claim/claim-manage";
import { getSession } from "@/lib/auth";
import { CLAIM_FLOW, CLAIM_REJECTED, CLAIM_TYPE_LABEL, claimByNo, claimItems, claimLogs, claimNextStatus, isClaimOpen } from "@/lib/claim";
import { CLAIM_SIDE, roleOf } from "@/lib/roles";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ claimNo: string }> };

export default async function ClaimDetailPage({ params }: Props) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!CLAIM_SIDE.includes(roleOf(session))) redirect("/forbidden");

  const { claimNo } = await params;
  const claim = await claimByNo(claimNo);
  if (!claim) notFound();
  const [items, logs] = await Promise.all([claimItems(claimNo), claimLogs(claimNo)]);
  const next = claimNextStatus(claim.claim_type, claim.status);

  const info = (k: string, v: string | null) =>
    v ? (
      <div className="flex gap-2 text-sm">
        <span className="w-24 shrink-0 text-slate-500">{k}</span>
        <span className="font-semibold text-slate-800">{v}</span>
      </div>
    ) : null;

  return (
    <div className="w-full space-y-4">
      <Link href={`/claims?type=${claim.claim_type}`} className="inline-flex items-center gap-1 text-sm font-semibold text-slate-500 hover:text-slate-700">
        <ChevronLeft className="size-4" /> ກັບລາຍการเคลม
      </Link>

      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-lg font-bold text-[#0536a9]">{claim.claim_no}</h1>
        <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-[11px] font-bold text-slate-600">CLM-{claim.claim_type}</span>
        <span className="text-xs text-slate-500">{CLAIM_TYPE_LABEL[claim.claim_type]}</span>
        <span className={`ml-auto rounded-full px-2.5 py-1 text-[11px] font-bold ${isClaimOpen(claim.status) ? "bg-teal-50 text-teal-700" : "bg-slate-100 text-slate-500"}`}>{claim.status_label}</span>
      </div>

      {/* ── pipeline ── */}
      <div className="flex flex-wrap items-center gap-1.5 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
        {CLAIM_FLOW[claim.claim_type].map((s, i) => {
          const active = s.status === claim.status;
          const done = CLAIM_FLOW[claim.claim_type].findIndex((x) => x.status === claim.status) > i;
          return (
            <span key={s.status} className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold ${active ? "bg-teal-600 text-white" : done ? "bg-teal-50 text-teal-700" : "bg-slate-100 text-slate-400"}`}>{s.label}</span>
          );
        })}
        {claim.status === CLAIM_REJECTED.status && <span className="rounded-lg bg-rose-50 px-2.5 py-1 text-[11px] font-semibold text-rose-600">{CLAIM_REJECTED.label}</span>}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
        <div className="space-y-4">
          <div className="space-y-1.5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            {info("Supplier", claim.supplier_code)}
            {info("ຮ້ານ/ລູກຄ້າ", claim.customer_name || claim.customer_code)}
            {info("ຫຍີ່ຫໍ້", claim.brand_code)}
            {info("ເລກງານ", claim.ref_job)}
            {info("ຍອດ", claim.amount ? claim.amount.toLocaleString() : null)}
            {info("ເຫດຜົນ", claim.reason)}
            {info("ເປີດໂດຍ", claim.created_by)}
            {info("ວັນເປີດ", claim.created_at)}
          </div>

          {logs.length > 0 && (
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="mb-2 text-xs font-semibold text-slate-500">ປະຫວັດ</p>
              <ul className="space-y-1.5">
                {logs.map((l, i) => (
                  <li key={i} className="flex gap-2 text-[12px] text-slate-600">
                    <span className="w-28 shrink-0 text-slate-400">{l.at}</span>
                    <span className="flex-1">{l.detail}{l.by_user ? ` · ${l.by_user}` : ""}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <ClaimManage
          claimNo={claim.claim_no}
          type={claim.claim_type}
          status={claim.status}
          nextStatus={next}
          canReject={claim.claim_type === "A"}
          initialItems={items}
          remark={claim.remark}
        />
      </div>
    </div>
  );
}
