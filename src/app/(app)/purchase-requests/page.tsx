import { jobsForDocs } from "@/lib/erp-doc-link";
import { ApproveSprForm } from "@/components/purchase/approve-spr-form";
import { SprDangerButtons } from "@/components/purchase/spr-danger-buttons";
import { LinkPending } from "@/components/link-pending";
import { getSession } from "@/lib/auth";
import { APPROVER_SIDE, roleOf } from "@/lib/roles";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getLocale } from "@/lib/i18n/locale";
import { query, queryOdg } from "@/lib/db";
import { getBalances, withdrawableQty } from "@/lib/stock-balance";
import { STAGE_SQL } from "@/lib/stage";
import { PackageCheck, ShoppingCart } from "lucide-react";
import Link from "next/link";

/**
 * ຂໍສັ່ງຊື້ອາໄຫຼ່ — flow ໃໝ່ (16-07-2026): ຂໍຊື້ຈາກ**ຜົນກວດເຊັກໂດຍກົງ** ຢູ່ຂັ້ນ 5
 * (ກວດ Stock ERP → ບໍ່ພໍ → ອອກ SPR ລົງ ERP) ບໍ່ແມ່ນຈາກແຖວໃບຂໍເບີກ (SIO) ອີກ.
 *
 * ຕາຕະລາງແຖວ SIO ຄ້າງເກົ່າຖືກຖອດອອກຕາມຄຳສັ່ງຜູ້ຈັດການ — ມັນຄືກົນໄກເກົ່າ:
 * 103/129 ແຖວເປັນວຽກຕາຍ ແລະ ທີ່ເຫຼືອກໍ່ຊ້ຳກັບຄິວ "ວຽກທີ່ຕ້ອງສັ່ງຊື້" ຢູ່ນີ້.
 *
 * ໜ້ານີ້ມີ 2 ສ່ວນ:
 *   ① ວຽກທີ່ຕ້ອງສັ່ງຊື້ — ວຽກຂັ້ນ 5 ທີ່ ERP ບໍ່ມີ/ບໍ່ພໍ ແລະ ຍັງບໍ່ໄດ້ຂໍຊື້
 *   ② ໃບສະເໜີຊື້ (SPR) ທີ່ອອກແລ້ວ ຈາກ ERP — **ແຍກ 2 ແທັບ**: ລໍຖ້າອະນຸມັດ / ອະນຸມັດແລ້ວ
 */
export const dynamic = "force-dynamic";

type DirectCandidate = {
  product_code: string;
  product: string | null;
  item_code: string;
  qty: string;
  checked_at: string | null;
};

/** ວຽກຂັ້ນ 5 ທີ່ມີອາໄຫຼ່ ERP ບໍ່ພໍ — stock ແລະ dedup ຈາກ ERP ບ່ອນດຽວ */
async function getDirectPurchaseJobs() {
  const candidates = (
    await query<DirectCandidate>(
      `select a.code product_code, concat_ws(' · ',a.name_1,a.sn) product,
          s.item_code, sum(coalesce(s.qty,0))::text qty,
          to_char(a.time_finish_check,'DD-MM-YYYY HH24:MI') checked_at
        from tb_product a join tb_used_spare s on s.product_code=a.code
       where (${STAGE_SQL})=5
       group by a.code,a.name_1,a.sn,a.time_finish_check,s.item_code
       order by a.time_finish_check asc nulls last limit 200`,
    )
  ).rows;
  if (!candidates.length) return [];

  const [balances, sprRows] = await Promise.all([
    getBalances(candidates.map((line) => line.item_code)),
    queryOdg<{ doc_ref: string; item_code: string }>(
      `select distinct doc_ref, item_code from ic_trans_detail
        where trans_flag = 2 and doc_ref = any($1::text[]) and item_code = any($2::text[])`,
      [
        [...new Set(candidates.map((line) => line.product_code))],
        [...new Set(candidates.map((line) => line.item_code))],
      ],
    ).then((r) => r.rows).catch(() => []),
  ]);
  const onSpr = new Set(sprRows.map((row) => `${row.doc_ref}|${row.item_code}`));

  const jobs = new Map<string, { product_code: string; product: string | null; checked_at: string | null; shortages: number }>();
  for (const line of candidates) {
    if (onSpr.has(`${line.product_code}|${line.item_code}`)) continue; // ຂໍຊື້ໄປແລ້ວ ຂໍຊ້ຳບໍ່ໄດ້
    if (withdrawableQty(balances.get(line.item_code)) >= Number(line.qty)) continue; // ສາງມີ → ໄປເບີກ
    const item = jobs.get(line.product_code) ?? { ...line, shortages: 0 };
    item.shortages += 1;
    jobs.set(line.product_code, item);
  }
  return [...jobs.values()].slice(0, 50);
}

type SprDoc = {
  doc_no: string;
  doc_date: string | null;
  job: string | null;
  branch_code: string | null;
  lines: number;
  total: string | null;
  wpra: string | null;
  po: string | null;
};

/** ແທັບຂອງລາຍການ SPR — ລໍຖ້າອະນຸມັດ (ຍັງບໍ່ມີ WPRA) / ອະນຸມັດແລ້ວ (ມີ WPRA ແລ້ວ) */
type SprTab = "wait" | "approved";

/**
 * ເງື່ອນໄຂຂອງແທັບ — **ນິຍາມບ່ອນດຽວ** ໃຊ້ທັງຕອນດຶງແຖວ ແລະ ຕອນນັບ ⇒ ຕົວເລກເທິງແທັບ
 * ກັບແຖວທີ່ເຫັນ ບໍ່ມີທາງບໍ່ຕົງກັນ.
 *
 * ກອງຢູ່ **SQL ບໍ່ແມ່ນຢູ່ Node**: ຖ້າດຶງ 100 ໃບລ່າສຸດມາແລ້ວຈຶ່ງແຍກ ໃບລໍອະນຸມັດເກົ່າໆ
 * ຈະຫຼົ່ນຫາຍ ແລະ ຕົວເລກເທິງແທັບຈະບອກແຕ່ "ໃນ 100 ໃບນັ້ນ" ເຊິ່ງເປັນຕົວເລກຫຼອກ.
 */
const SPR_WHERE = `t.trans_flag=2 and t.doc_format_code='SPR' and t.doc_date >= current_date - 365`;
const HAS_WPRA = `exists (select 1 from ic_trans_detail w where w.trans_flag=4 and w.ref_doc_no=t.doc_no)`;
const TAB_WHERE: Record<SprTab, string> = { wait: `not ${HAS_WPRA}`, approved: HAS_WPRA };

/** ຈຳນວນໃບຂອງແທັບ — ນັບເຕັມ (ບໍ່ຕິດ limit ຂອງຕາຕະລາງ) */
async function countSprDocs(tab: SprTab): Promise<number> {
  try {
    return (
      await queryOdg<{ n: number }>(
        `select count(*)::int n from ic_trans t where ${SPR_WHERE} and ${TAB_WHERE[tab]}`,
      )
    ).rows[0]?.n ?? 0;
  } catch (error) {
    console.error("countSprDocs failed", error);
    return 0;
  }
}

/**
 * ໃບສະເໜີຊື້ (SPR) ຈາກ ERP ພ້ອມສະຖານະຕໍ່ໃບ.
 *
 * ── ຖັນ "ວຽກ" ມາຈາກ 2 ທາງ ──
 * ① `doc_ref` ຂອງ ERP — ທາງທີ່ຕັ້ງໃຈໄວ້ (writeErpSpr ຂຽນເລກວຽກລົງນັ້ນ)
 * ② ດັດຊະນີຂອງເຮົາ (ods_erp_doc_link) — ໃຊ້ເມື່ອ ① ໃຊ້ບໍ່ໄດ້
 * ຕ້ອງມີ ② ເພາະ **ຄົນ ERP ແກ້ doc_ref ໄດ້** (ເກີດຈິງກັບ SPR26070008 ຂອງວຽກ 7521)
 * ແລະ ໃບຈາກທາງເກົ່າ doc_ref = ເລກ RQ ບໍ່ແມ່ນເລກວຽກ ⇒ ຖັນນີ້ຂຶ້ນ "-" ທຸກແຖວ.
 */
async function getSprDocs(tab: SprTab): Promise<SprDoc[]> {
  try {
    const docs = (
      await queryOdg<SprDoc>(
        `select t.doc_no, to_char(t.doc_date,'DD-MM-YYYY') doc_date,
            split_part(trim(coalesce(t.doc_ref,'')),' ',1) job, t.branch_code,
            (select count(*) from ic_trans_detail d where d.doc_no=t.doc_no and d.trans_flag=2)::int lines,
            (select to_char(sum(d.sum_amount),'FM999,999,999,990') from ic_trans_detail d
              where d.doc_no=t.doc_no and d.trans_flag=2) total,
            (select min(w.doc_no) from ic_trans_detail w where w.trans_flag=4 and w.ref_doc_no=t.doc_no) wpra,
            (select min(p.doc_no) from ic_trans_detail p where p.trans_flag=6
              and p.ref_doc_no in (select w.doc_no from ic_trans_detail w where w.trans_flag=4 and w.ref_doc_no=t.doc_no)) po
          from ic_trans t
         where ${SPR_WHERE} and ${TAB_WHERE[tab]}
         order by t.doc_no desc limit 100`,
      )
    ).rows;

    // ຂ້າມຖານບໍ່ໄດ້ ⇒ ດຶງດັດຊະນີມາຕື່ມຢູ່ Node (ໃບທີ່ doc_ref ບອກເລກວຽກຢູ່ແລ້ວ ບໍ່ຕ້ອງແຕະ)
    const linked = await jobsForDocs(docs.filter((doc) => !isJobCode(doc.job)).map((doc) => doc.doc_no));
    return docs.map((doc) => (isJobCode(doc.job) ? doc : { ...doc, job: linked.get(doc.doc_no) ?? doc.job }));
  } catch (error) {
    console.error("getSprDocs failed", error);
    return [];
  }
}

const isJobCode = (value: string | null): value is string => /^(\d+|INST-\w+)$/.test(value ?? "");

type Props = { searchParams: Promise<{ tab?: string }> };

export default async function PurchaseRequestsPage({ searchParams }: Props) {
  const params = await searchParams;
  // ຕັ້ງຕົ້ນ "ລໍຖ້າອະນຸມັດ" — ແທັບທີ່ມີວຽກໃຫ້ເຮັດ (ອະນຸມັດແລ້ວແມ່ນໄວ້ເບິ່ງຍ້ອນຫຼັງ)
  const tab: SprTab = params.tab === "approved" ? "approved" : "wait";
  const [directJobs, sprDocs, waitCount, approvedCount, session] = await Promise.all([
    getDirectPurchaseJobs(),
    getSprDocs(tab),
    countSprDocs("wait"),
    countSprDocs("approved"),
    getSession(),
  ]);
  const t = (await getDictionary(await getLocale())).purchaseRequests;
  // ອະນຸມັດໄດ້ຈາກໜ້ານີ້ເລີຍ (ຜູ້ມີສິດເທົ່ານັ້ນ) — ບໍ່ຕ້ອງຍ່າງໄປເມນູອະນຸມັດ
  const canApprove = APPROVER_SIDE.includes(roleOf(session));
  const TABS: { key: SprTab; label: string; count: number }[] = [
    { key: "wait", label: t.waitApproval, count: waitCount },
    { key: "approved", label: t.approved, count: approvedCount },
  ];

  return (
    <div className="w-full space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-700">{t.title}</h1>
          <p className="mt-0.5 text-xs text-slate-500">
            {t.jobsToPurchase} {directJobs.length} · {t.purchaseRequestsLabel} {waitCount + approvedCount} {t.sheetsRecordedErp}
          </p>
        </div>
        <Link
          href="/dashboard/status/repair/purchasing"
          className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50"
        >
          <PackageCheck className="size-4" />
          {t.trackPurchase}
          <LinkPending className="size-3.5" />
        </Link>
      </div>

      {/* ① ວຽກທີ່ຕ້ອງສັ່ງຊື້ — ຈາກຜົນກວດເຊັກ (ຂັ້ນ 5, ERP ບໍ່ພໍ, ຍັງບໍ່ໄດ້ຂໍຊື້) */}
      <section className="overflow-hidden rounded-xl border border-amber-300 bg-white shadow-sm">
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-2.5">
          <h2 className="text-sm font-bold text-amber-900">{t.jobsNeedingPurchase} ({directJobs.length})</h2>
          <p className="text-[11px] text-amber-800">{t.jobsNeedingPurchaseDesc}</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-slate-600">
                <th className="px-3 py-2.5 font-semibold">{t.colJob}</th>
                <th className="px-3 py-2.5 font-semibold">{t.colProduct}</th>
                <th className="px-3 py-2.5 text-right font-semibold">{t.colShortage}</th>
                <th className="px-3 py-2.5 font-semibold">{t.colChecked}</th>
                <th className="px-3 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {directJobs.map((job) => (
                <tr key={job.product_code} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-3 py-2.5 font-bold text-[#0536a9]">
                    <Link href={`/service/${job.product_code}`} className="hover:underline">
                      {job.product_code}
                    </Link>
                  </td>
                  <td className="max-w-96 truncate px-3 py-2.5" title={job.product ?? ""}>{job.product ?? "-"}</td>
                  <td className="px-3 py-2.5 text-right font-bold tabular-nums text-red-600">{job.shortages}</td>
                  <td className="whitespace-nowrap px-3 py-2.5">{job.checked_at ?? "-"}</td>
                  <td className="px-3 py-2.5 text-center">
                    <Link
                      href={`/purchase-requests/new/${encodeURIComponent(job.product_code)}/direct`}
                      className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-amber-600 px-3 text-xs font-semibold text-white hover:bg-amber-700"
                    >
                      <ShoppingCart className="size-3.5" />
                      {t.createPurchaseRequest}
                      <LinkPending className="size-3" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {directJobs.length === 0 && (
          <p className="py-8 text-center text-xs text-slate-400">{t.noJobsToPurchase}</p>
        )}
      </section>

      {/* ② ໃບສະເໜີຊື້ (SPR) ຈາກ ERP — ແຍກ 2 ແທັບ (ກອງຢູ່ ERP ບໍ່ແມ່ນຢູ່ Node) */}
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 bg-slate-50 px-4 py-2.5">
          <h2 className="text-sm font-bold text-slate-700">{t.sprTitle}</h2>
          <p className="text-[11px] text-slate-500">
            {tab === "wait" ? t.sprSubtitleWait : t.sprSubtitleApproved}
          </p>
          <div className="mt-2 flex w-fit overflow-hidden rounded-lg border border-slate-300 bg-white">
            {TABS.map(({ key, label, count }) => (
              <Link
                key={key}
                href={key === "wait" ? "/purchase-requests" : `/purchase-requests?tab=${key}`}
                className={`inline-flex h-8 items-center gap-1.5 border-l border-slate-300 px-3 text-xs font-medium first:border-l-0 ${
                  tab === key ? "bg-slate-900 text-white" : "bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                {label}
                <span className="tabular-nums opacity-70">({count})</span>
                <LinkPending className="size-3" />
              </Link>
            ))}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-slate-600">
                <th className="px-3 py-2.5 font-semibold">{t.colSprNo}</th>
                <th className="px-3 py-2.5 font-semibold">{t.colDate}</th>
                <th className="px-3 py-2.5 font-semibold">{t.colJob}</th>
                <th className="px-3 py-2.5 font-semibold">{t.colBranch}</th>
                <th className="px-3 py-2.5 text-right font-semibold">{t.colLines}</th>
                <th className="px-3 py-2.5 text-right font-semibold">{t.colTotal}</th>
                <th className="px-3 py-2.5 font-semibold">{t.colStatus}</th>
                {canApprove && <th className="px-3 py-2.5 font-semibold">{t.colManage}</th>}
              </tr>
            </thead>
            <tbody>
              {sprDocs.map((doc) => (
                <tr key={doc.doc_no} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-3 py-2.5 font-bold text-[#0536a9]">
                    <Link href={`/purchase-orders/${encodeURIComponent(doc.doc_no)}`} className="hover:underline">
                      {doc.doc_no}
                    </Link>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5">{doc.doc_date ?? "-"}</td>
                  <td className="px-3 py-2.5">
                    {isJobCode(doc.job) ? (
                      <Link href={`/service/${doc.job}`} className="font-medium text-[#0536a9] hover:underline">
                        {doc.job}
                      </Link>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5">
                    {doc.branch_code === "05" ? "ໂອດ່ຽນໄທ" : doc.branch_code === "00" ? "ສຳນັກງານໃຫ່ຍ" : (doc.branch_code ?? "-")}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{doc.lines}</td>
                  <td className="px-3 py-2.5 text-right font-semibold tabular-nums">{doc.total ?? "0"}</td>
                  <td className="whitespace-nowrap px-3 py-2.5">
                    {doc.po ? (
                      <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
                        {t.statusPoIssued} · {doc.po}
                      </span>
                    ) : doc.wpra ? (
                      <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700">
                        {t.approved} · {doc.wpra}
                      </span>
                    ) : (
                      <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
                        {t.pendingApproval}
                      </span>
                    )}
                  </td>
                  {canApprove && (
                    <td className="px-3 py-2.5">
                      {/**
                       * ລົງມືຈາກໜ້ານີ້ເລີຍ ບໍ່ຕ້ອງເປີດເຂົ້າໃບ:
                       *   ຍັງລໍ        → ອະນຸມັດ / ປະຕິເສດ (ປະຕິເສດ = ລຶບອອກຈາກ ERP)
                       *   ອະນຸມັດແລ້ວ  → ຖອນການອະນຸມັດ / ລົບທັງໃບ
                       *   ອອກ PO ແລ້ວ → ບໍ່ມີ (ຕ້ອງຍົກເລີກ PO ກ່ອນ — server ກັນຢູ່ດີ)
                       */}
                      {doc.po ? (
                        <span className="text-[10px] text-slate-400" title={`${t.statusPoIssued} (${doc.po}) — ${t.mustCancelPoFirst}`}>
                          -
                        </span>
                      ) : doc.wpra ? (
                        <SprDangerButtons sprNo={doc.doc_no} back="/purchase-requests" />
                      ) : (
                        <ApproveSprForm sprNo={doc.doc_no} back="/purchase-requests" />
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {sprDocs.length === 0 && (
          <p className="py-8 text-center text-xs text-slate-400">
            {tab === "wait" ? t.noWaitSheets : t.noApprovedSheets}
          </p>
        )}
      </section>
    </div>
  );
}
