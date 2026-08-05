import { AcceptRepairButton } from "@/components/repair/accept-repair-button";
import { BackLink } from "@/components/back-link";
import { AssignTechButton } from "@/components/installation/assign-tech";
import { StartCheckButton } from "@/components/checking/check-actions";
import { LinkPending } from "@/components/link-pending";
import { Elapsed } from "@/components/elapsed";
import { PageTitle } from "@/components/ui";
import { getSession } from "@/lib/auth";
import { claimStatuses, pipelineOf } from "@/lib/dashboard-status";
import { query } from "@/lib/db";
import { CLAIM_SIDE, roleOf } from "@/lib/roles";
import { listTechnicians } from "@/lib/technicians";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

/**
 * **ຄິວງານເຄມ ຂັ້ນນຶ່ງ** — ຕາຕະລາງຂອງເຄມເອງ (ບໍ່ຜູກກັບໜ້າຄິວສ້ອມ).
 *
 * ສະແດງແຕ່ສິ່ງທີ່ຄົນເຄມຕ້ອງການ: ໃບງານ · ຮ້ານ/ລູກຄ້າ · ເຄື່ອງ · ຂອບເຂດເຄມ · ຊ່າງ ·
 * ໂມງຄ້າງ ພ້ອມ **ປຸ່ມໄປຕໍ່ຂອງຂັ້ນນັ້ນ**. ນິຍາມຂັ້ນມາຈາກ lib/dashboard-status ບ່ອນດຽວ.
 *
 * ອອກແບບໃໝ່ 05-08-2026: pill ຂັ້ນພ້ອມຕົວເລກ (ກະໂດດຂ້າມຂັ້ນໄດ້) · ສີໂມງຄ້າງຕາມອາຍຸ
 * (≥7 ວັນສົ້ມ · ≥30 ວັນແດງ) — ກົດດຽວກັບໜ້າອາໄຫຼ່ຕາມໃບງານ.
 */
export const dynamic = "force-dynamic";

type Row = {
  code: string;
  customer: string | null;
  tel: string | null;
  product: string | null;
  sn: string | null;
  brand: string | null;
  claim_scope: string | null;
  claim_part_name: string | null;
  claim_no: string | null;
  technician: string | null;
  accepted: boolean;
  registered: string | null;
  elapsed_seconds: number;
};

/** ປຸ່ມໄປຕໍ່ຂອງແຕ່ລະຂັ້ນ — ພາໄປໜ້າທີ່ເຮັດວຽກຂັ້ນນັ້ນຂອງໃບນັ້ນ */
const NEXT_STEP: Record<string, { label: string; href: (code: string) => string }> = {
  "claim-checking": { label: "ບັນທຶກຜົນກວດ", href: (code) => `/claims/jobs/check/${encodeURIComponent(code)}` },
  "claim-decision": { label: "ໄປຕັດສິນຜົນເຄມ", href: (code) => `/claims/jobs/detail/${encodeURIComponent(code)}` },
  "claim-stock": { label: "ຈັດການປ່ຽນຈາກ Stock", href: (code) => `/claims/jobs/detail/${encodeURIComponent(code)}` },
  "claim-purchase": { label: "ຕິດຕາມຂອງສັ່ງຊື້", href: (code) => `/claims/jobs/detail/${encodeURIComponent(code)}` },
  "claim-supplier": { label: "ຕິດຕາມເຄມ Supplier", href: (code) => `/claims/jobs/detail/${encodeURIComponent(code)}` },
  "claim-return": { label: "ສົ່ງຄືນຮ້ານ", href: (code) => `/claims/jobs/return/${encodeURIComponent(code)}` },
};

export default async function ClaimStagePage({ params }: { params: Promise<{ status: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!CLAIM_SIDE.includes(roleOf(session))) redirect("/forbidden");

  const { status } = await params;
  const def = claimStatuses[status];
  if (!def) notFound();

  const rows = (
    await query<Row>(
      `select a.code, c.name_1 customer, c.tel, a.name_1 product, a.sn, a.p_brand brand,
          a.claim_scope, a.claim_part_name, a.emp_code technician,
          a.repair_confirm is not null accepted,
          to_char(a.time_register,'DD-MM-YYYY HH24:MI') registered,
          greatest(0, round(extract(epoch from (localtimestamp - a.time_register))))::int elapsed_seconds,
          (select cl.claim_no from ods_claim cl where cl.ref_job = a.code order by cl.id desc limit 1) claim_no
        from tb_product a
        left join ar_customer c on c.code = a.cust_code
       where ${def.condition}
       order by a.time_register`,
    )
  ).rows;

  const stages = pipelineOf(claimStatuses);
  const index = stages.findIndex(([slug]) => slug === status);
  const step = NEXT_STEP[status];
  // ຕົວເລກທຸກຂັ້ນສຳລັບ pill — query ດຽວຄືໜ້າ /claims/jobs (ນິຍາມຂັ້ນບ່ອນດຽວ ຕົວເລກຈຶ່ງກົງກັນ)
  const stageCounts = (
    await query<Record<string, number>>(
      `select ${stages
        .map(([slug, d]) => `(select count(*) from tb_product a where ${d.condition})::int as "${slug}"`)
        .join(", ")}`,
    )
  ).rows[0];
  const techs = status === "claim-wait-check" ? await listTechnicians() : [];
  const days = (seconds: number) => Math.floor(seconds / 86400);
  const ageTone = (seconds: number) =>
    days(seconds) >= 30
      ? "bg-red-100 text-red-700"
      : days(seconds) >= 7
        ? "bg-amber-100 text-amber-800"
        : "bg-slate-100 text-slate-600";

  return (
    <div className="w-full space-y-4">
      <BackLink fallback="/claims/jobs" label="ຄິວງານເຄມ" />

      <PageTitle sub={`ຂັ້ນ ${index + 1}/${stages.length} · ${rows.length} ໃບ`}>{def.label}</PageTitle>

      {/* ── pill ຂັ້ນ — ກະໂດດໄປຂັ້ນອື່ນໄດ້ ພ້ອມຕົວເລກຄິວ ── */}
      <div className="flex flex-wrap items-center gap-1.5">
        {stages.map(([slug, d], i) => {
          const count = Number(stageCounts?.[slug] ?? 0);
          const active = slug === status;
          return (
            <Link
              key={slug}
              href={`/claims/jobs/${slug}`}
              className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold ${
                active
                  ? "bg-brand-orange-600 text-white"
                  : count > 0
                    ? "bg-white text-slate-600 ring-1 ring-brand-orange-200 hover:bg-brand-orange-50"
                    : "bg-white text-slate-400 ring-1 ring-slate-200 hover:bg-slate-50"
              }`}
            >
              {i + 1}. {d.label} <span className="tabular-nums opacity-80">{count}</span>
            </Link>
          );
        })}
      </div>

      {rows.length === 0 ? (
        <p className="rounded-xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-400 shadow-sm">
          ບໍ່ມີງານຢູ່ຂັ້ນນີ້
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full min-w-[1000px] text-sm">
            <thead className="bg-slate-50 text-left text-xs text-slate-500">
              <tr>
                <th className="px-3 py-2">ໃບງານ</th>
                <th className="px-3 py-2">ຮ້ານ / ລູກຄ້າ</th>
                <th className="px-3 py-2">ເຄື່ອງ</th>
                <th className="px-3 py-2">ຂອບເຂດເຄມ</th>
                <th className="px-3 py-2">ໃບເຄມ</th>
                <th className="px-3 py-2">ຊ່າງ</th>
                <th className="px-3 py-2">ຄ້າງ</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.code} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-3 py-2">
                    <Link href={`/claims/jobs/detail/${row.code}`} className="font-semibold text-brand-orange-700 hover:underline">
                      #{row.code}
                      <LinkPending className="ml-1 size-3" />
                    </Link>
                    <span className="block text-[10px] text-slate-400">{row.registered}</span>
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {row.customer || "-"}
                    {row.tel && <span className="block text-slate-400">{row.tel}</span>}
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-600">
                    {row.product || "-"}
                    {row.sn && <span className="block text-slate-400">S/N {row.sn}</span>}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {row.claim_scope === "part" ? (
                      <span className="rounded-full bg-brand-orange-100 px-2 py-0.5 font-semibold text-brand-orange-700">
                        ອາໄຫຼ່ {row.claim_part_name || ""}
                      </span>
                    ) : (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 font-semibold text-slate-600">ທັງເຄື່ອງ</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {row.claim_no ? (
                      <Link href={`/claims/${row.claim_no}`} className="font-semibold text-brand-800 hover:underline">
                        {row.claim_no}
                      </Link>
                    ) : (
                      <span className="text-slate-400">-</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs">{row.technician || <span className="text-slate-400">ຍັງບໍ່ຈັດ</span>}</td>
                  <td className="px-3 py-2">
                    <Elapsed
                      seconds={row.elapsed_seconds}
                      className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${ageTone(row.elapsed_seconds)}`}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap items-center justify-end gap-1.5">
                      {/* ຂັ້ນ "ຮັບຈາກຮ້ານ/ລໍກວດ": ຈັດຊ່າງ → ຊ່າງຮັບ → ເລີ່ມກວດ */}
                      {status === "claim-wait-check" && !row.technician && (
                        <AssignTechButton
                          row={{ code: row.code, customer: row.customer, location_inst: null, appoint_date: null, remark: null }}
                          techs={techs}
                          workflow="repair"
                          size="sm"
                        />
                      )}
                      {status === "claim-wait-check" && row.technician && !row.accepted && (
                        <AcceptRepairButton code={row.code} />
                      )}
                      {status === "claim-wait-check" && row.accepted && <StartCheckButton code={row.code} />}
                      {step && (
                        <Link
                          href={step.href(row.code)}
                          className="inline-flex h-8 items-center gap-1 rounded-lg bg-brand-orange-600 px-3 text-xs font-semibold text-white hover:bg-brand-orange-700"
                        >
                          {step.label}
                          <ArrowRight className="size-3.5" />
                        </Link>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
