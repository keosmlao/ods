import { Card, Empty, PageTitle, Table } from "@/components/ui";
import { getSession } from "@/lib/auth";
import { query } from "@/lib/db";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getLocale } from "@/lib/i18n/locale";
import { canViewAssignedJob } from "@/lib/scope";
import { TRANS } from "@/lib/stock-constants";
import { notFound, redirect } from "next/navigation";
import { PickupForm } from "./pickup-form";

/** ຊ່າງຮັບອາໄຫຼ່ຕາມໃບເບີກ (SWC) ໃບນຶ່ງ — ຄູ່ກັບ /installations/spare-pickup/[docNo] ຂອງງານຕິດຕັ້ງ */
export const dynamic = "force-dynamic";

/** trans_flag ຂອງໃບ "ຊ່າງຮັບອາໄຫຼ່" (PISP) — ຄືກັບ actions/stock.ts */
const TRANS_PICK = 166;

type Props = { params: Promise<{ docNo: string }> };

type Head = {
  doc_no: string;
  doc_date: string | null;
  doc_ref: string | null;
  remark: string | null;
  code: string;
  customer: string | null;
  product: string | null;
  brand: string | null;
  warranty: string | null;
  issue: string | null;
  technician: string | null;
  picked: boolean;
};

type Line = {
  rnum: number;
  item_code: string;
  item_name: string | null;
  qty: string;
  unit_code: string | null;
};

function Info({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="text-[11px] text-slate-400">{label}</dt>
      <dd className="mt-0.5 text-xs font-medium text-slate-800">{value || "-"}</dd>
    </div>
  );
}

export default async function SparePickupDetail({ params }: Props) {
  const t = (await getDictionary(await getLocale())).requestsPickupDetail;
  const docNo = decodeURIComponent((await params).docNo);
  const session = await getSession();
  if (!session) redirect("/login");

  const head = (
    await query<Head>(
      `select ic.doc_no, to_char(ic.doc_date,'DD-MM-YYYY') doc_date, ic.doc_ref, ic.remark,
          p.code, concat_ws('-', c.name_1, c.tel) customer,
          concat_ws(' · ', p.name_1, p.sn) product, p.p_brand brand, p.warrunty warranty,
          coalesce(p.issue_2, p.issue) issue, p.emp_code technician,
          exists(select 1 from ic_trans t where t.trans_flag = $2 and t.doc_ref = ic.doc_no) picked
        from ic_trans ic
        join tb_product p on p.code = ic.product_code
        left join ar_customer c on c.code = p.cust_code
        where ic.doc_no = $1 and ic.trans_flag = $3 and (ic.job_type is null or ic.job_type <> 'install')
        limit 1`,
      [docNo, TRANS_PICK, TRANS.DISPATCH],
    )
  ).rows[0];
  if (!head) notFound();
  if (!canViewAssignedJob(session, head.technician)) redirect("/forbidden");

  const lines = (
    await query<Line>(
      `select row_number() over (order by roworder)::int rnum, item_code, item_name, qty::text qty, unit_code
        from ic_trans_detail where doc_no = $1 and trans_flag = $2 order by roworder`,
      [docNo, TRANS.DISPATCH],
    )
  ).rows;

  return (
    <div className="mx-auto w-full max-w-5xl space-y-5">
      <PageTitle sub={`${t.docNoPrefix} ${head.doc_no}`}>{t.title}</PageTitle>

      <Card title={t.jobInfo}>
        <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Info label={t.jobNo} value={head.code} />
          <Info label={t.customer} value={head.customer} />
          <Info label={t.productSn} value={head.product} />
          <Info label={t.brand} value={head.brand} />
          <Info label={t.warranty} value={head.warranty} />
          <Info label={t.technician} value={head.technician} />
          <Info label={t.pickupDate} value={head.doc_date} />
          <Info label={t.docRef} value={head.doc_ref} />
        </dl>
      </Card>

      <Card title={`${t.spareIssuedTitle} (${lines.length} ${t.items})`}>
        {lines.length === 0 ? (
          <Empty>{t.noSpares}</Empty>
        ) : (
          <Table head={["#", t.colCode, t.colSpareName, t.colQty, t.colUnit]} minWidth={700}>
            {lines.map((line) => (
              <tr key={line.rnum} className="border-b border-slate-100">
                <td className="px-3 py-3 text-center">{line.rnum}</td>
                <td className="px-3 py-3">{line.item_code}</td>
                <td className="px-3 py-3">{line.item_name ?? "-"}</td>
                <td className="px-3 py-3 text-center">{Number(line.qty)}</td>
                <td className="px-3 py-3 text-center">{line.unit_code ?? "-"}</td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      {head.picked ? (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-center text-sm font-semibold text-emerald-700">
          {t.alreadyPicked}
        </p>
      ) : (
        <PickupForm
          docRef={head.doc_no}
          lineCount={lines.length}
          defaultRemark={`${head.code} ${head.customer ?? ""}`.trim()}
          disabled={lines.length === 0}
        />
      )}
    </div>
  );
}
