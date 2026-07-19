import { LinkPending } from "@/components/link-pending";
import { queryOdg } from "@/lib/db";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getLocale } from "@/lib/i18n/locale";
import { ERP_PURCHASE } from "@/lib/stock-constants";
import { ArrowRight, Clock, FileCheck2 } from "lucide-react";
import Link from "next/link";

/**
 * ຄິວອະນຸມັດໃບຂໍສະເໜີຊື້ — **ອ່ານຈາກ ERP** (ໃບຢູ່ ERP ບ່ອນດຽວແລ້ວ, 16-07-2026).
 *
 * ແຕ່ກ່ອນອ່ານ RQ (trans_flag=78) ຂອງ ODS — ໃບນັ້ນບໍ່ຖືກສ້າງອີກແລ້ວ ⇒ ຄິວເກົ່າຈະຫວ່າງ
 * ຕະຫຼອດການ ທັງທີ່ມີໃບລໍຢູ່ ERP. ດຽວນີ້:
 *   ລໍອະນຸມັດ  = SPR ທີ່ຍັງບໍ່ມີ WPRA ອ້າງອີງ (ref_doc_no)
 *   ອະນຸມັດແລ້ວ = SPR ທີ່ມີ WPRA ແລ້ວ (ສະແດງເລກ PO ນຳ)
 * ວຽກສ້ອມ = doc_ref ຂອງ SPR (ERP ບໍ່ມີຖັນ product_code).
 */
export const dynamic = "force-dynamic";

/** ໃບເກົ່າ doc_ref/remark ເປັນເລກ RQ ຫຼື ຂໍ້ຄວາມ — ລິ້ງສະເພາະທີ່ເປັນລະຫັດວຽກແທ້ */
const isJobCode = (value: string | null): value is string => /^(\d+|INST-\w+)$/.test(value ?? "");

type Props = { searchParams: Promise<{ tab?: string }> };

type Row = {
  doc_no: string;
  doc_date: string | null;
  job: string | null;
  branch_code: string | null;
  requester: string | null;
  lines: number;
  total: string | null;
  wpra: string | null;
  po: string | null;
};

async function getRows(waiting: boolean): Promise<Row[]> {
  try {
    const rows = await queryOdg<Row>(
      `select t.doc_no, to_char(t.doc_date,'DD-MM-YYYY') doc_date,
          split_part(trim(coalesce(t.doc_ref,'')),' ',1) job, t.branch_code,
          coalesce(nullif(t.user_request,''), t.creator_code) requester,
          (select count(*) from ic_trans_detail d where d.doc_no=t.doc_no and d.trans_flag=t.trans_flag)::int lines,
          (select to_char(sum(d.sum_amount),'FM999,999,999,990') from ic_trans_detail d
            where d.doc_no=t.doc_no and d.trans_flag=t.trans_flag) total,
          (select min(w.doc_no) from ic_trans_detail w where w.trans_flag=$2 and w.ref_doc_no=t.doc_no) wpra,
          (select min(p.doc_no) from ic_trans_detail p where p.trans_flag=$3
            and p.ref_doc_no in (select w.doc_no from ic_trans_detail w where w.trans_flag=$2 and w.ref_doc_no=t.doc_no)) po
        from ic_trans t
       where t.trans_flag=$1 and t.doc_format_code='SPR' and t.doc_date >= current_date - 365
       order by t.doc_no desc limit 100`,
      [ERP_PURCHASE.PR_REQUEST, ERP_PURCHASE.PR_APPROVE, ERP_PURCHASE.ORDER],
    );
    return rows.rows.filter((row) => (waiting ? !row.wpra : Boolean(row.wpra)));
  } catch (error) {
    // ERP ລົ້ມ ⇒ ໜ້າຍັງເປີດໄດ້ ພຽງແຕ່ຄິວຫວ່າງ (ຫຼັກການດຽວກັບ lib/erp-purchase)
    console.error("approvals queue read failed", error);
    return [];
  }
}

export default async function ApprovePurchasePage({ searchParams }: Props) {
  const params = await searchParams;
  const tab = params.tab === "approved" ? "approved" : "waiting";
  const t = (await getDictionary(await getLocale())).approvalsPurchaseRequests;
  const rows = await getRows(tab === "waiting");

  const TABS = [
    { key: "waiting", label: t.tabWaiting, icon: Clock },
    { key: "approved", label: t.tabApproved, icon: FileCheck2 },
  ] as const;

  return (
    <div className="w-full space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-700">{t.heading}</h1>
        <p className="mt-0.5 text-xs text-slate-500">
          {t.subtitle} · {rows.length} {t.itemsUnit}
        </p>
      </div>

      <div className="flex w-fit overflow-hidden rounded-lg border border-slate-300 bg-white">
        {TABS.map(({ key, label, icon: Icon }) => (
          <Link
            key={key}
            href={key === "waiting" ? "/approvals/purchase-requests" : "/approvals/purchase-requests?tab=approved"}
            className={`inline-flex h-9 items-center gap-1.5 border-l border-slate-300 px-3 text-xs font-medium first:border-l-0 ${
              tab === key ? "bg-slate-900 text-white" : "bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            <Icon className="size-3.5" />
            {label}
            <LinkPending className="size-3" />
          </Link>
        ))}
      </div>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-slate-600">
                <th className="px-3 py-2.5 font-semibold">{t.colDocNo}</th>
                <th className="px-3 py-2.5 font-semibold">{t.colDate}</th>
                <th className="px-3 py-2.5 font-semibold">{t.colJob}</th>
                <th className="px-3 py-2.5 font-semibold">{t.colBranch}</th>
                <th className="px-3 py-2.5 text-right font-semibold">{t.colItems}</th>
                <th className="px-3 py-2.5 text-right font-semibold">{t.colTotal}</th>
                {tab === "approved" && <th className="px-3 py-2.5 font-semibold">WPRA · PO</th>}
                <th className="px-3 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.doc_no} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-3 py-2.5 font-bold">
                    <Link href={`/purchase-orders/${encodeURIComponent(row.doc_no)}`} className="text-[#0536a9] hover:underline">
                      {row.doc_no}
                    </Link>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5">{row.doc_date ?? "-"}</td>
                  <td className="px-3 py-2.5">
                    {isJobCode(row.job) ? (
                      <Link href={`/service/${row.job}`} className="font-medium text-[#0536a9] hover:underline">
                        {row.job}
                      </Link>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5">
                    {row.branch_code === "05" ? "ໂອດ່ຽນໄທ" : row.branch_code === "00" ? "ສຳນັກງານໃຫ່ຍ" : (row.branch_code ?? "-")}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{row.lines}</td>
                  <td className="px-3 py-2.5 text-right font-semibold tabular-nums">{row.total ?? "0"}</td>
                  {tab === "approved" && (
                    <td className="whitespace-nowrap px-3 py-2.5 font-mono text-[10px] text-slate-500">
                      {row.wpra} {row.po && `· ${row.po}`}
                    </td>
                  )}
                  <td className="px-3 py-2.5 text-center">
                    {tab === "waiting" && (
                      <Link
                        href={`/purchase-orders/${encodeURIComponent(row.doc_no)}`}
                        className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-teal-600 px-3 text-xs font-semibold text-white hover:bg-teal-700"
                      >
                        ອະນຸມັດ
                        <ArrowRight className="size-3.5" />
                        <LinkPending className="size-3" />
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {rows.length === 0 && (
          <p className="py-12 text-center text-xs text-slate-400">
            {tab === "waiting" ? t.emptyWaiting : t.emptyApproved}
          </p>
        )}
      </section>
    </div>
  );
}
