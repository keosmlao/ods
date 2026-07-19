import { BillView } from "@/components/stock/bill-view";
import type { SpareLine } from "@/components/stock/spare-lines";
import { getSession } from "@/lib/auth";
import { query } from "@/lib/db";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getLocale } from "@/lib/i18n/locale";
import { canViewAssignedJob } from "@/lib/scope";
import { notFound, redirect } from "next/navigation";

/** ods: stock.py /showstkrq/<doc_no> + templates/stock/showrequstpage.html */

type Props = { params: Promise<{ docNo: string }> };

type Head = {
  doc_no: string;
  doc_date: string | null;
  doc_ref: string | null;
  doc_ref_date: string | null;
  customer: string | null;
  product: string | null;
  p_model: string | null;
  sn: string | null;
  issue: string | null;
  warranty: string | null;
  issue_2: string | null;
  technician: string | null;
  technician_code: string | null;
};

export default async function ShowRequestBillPage({ params }: Props) {
  const { docNo } = await params;
  const code = decodeURIComponent(docNo);
  const session = await getSession();
  if (!session) redirect("/login");

  const t = (await getDictionary(await getLocale())).requestsView;

  const head = await query<Head>(
    `select a.doc_no, to_char(a.doc_date,'DD-MM-YYYY') doc_date, a.doc_ref,
       to_char(a.doc_ref_date::date,'DD-MM-YYYY') doc_ref_date,
       b.name_1||'-'||b.tel customer, c.name_1 product, c.p_model, c.sn, c.issue,
       a.wanrunty warranty, a.isue_2 issue_2, d.name_1 technician, c.emp_code technician_code
     from ic_trans a
     left join ar_customer b on b.code = a.cust_code
     left join tb_product c on c.code = a.product_code
     left join tb_techemp d on d.code = a.emp
     where a.doc_no = $1`,
    [code],
  );
  const bill = head.rows[0];
  if (!bill) notFound();
  if (!canViewAssignedJob(session, bill.technician_code)) redirect("/forbidden");

  const lines = await query<Omit<SpareLine, "roworder">>(
    `select row_number() over ()::int rnum, item_code, item_name, qty, unit_code
     from ic_trans_detail where doc_no = $1`,
    [code],
  );

  return (
    <BillView
      title={t.title}
      backHref="/stock/requests"
      fields={[
        { label: t.requestNo, value: bill.doc_no },
        { label: t.date, value: bill.doc_date },
        { label: t.customer, value: bill.customer },
        { label: t.productName, value: bill.product },
        { label: t.model, value: bill.p_model },
        { label: t.serialNo, value: bill.sn },
        { label: t.issue, value: bill.issue, accent: true },
        { label: t.warranty, value: bill.warranty },
        { label: t.technicianDiagnosis, value: bill.issue_2 },
        { label: t.technician, value: bill.technician },
      ]}
      lines={lines.rows}
    />
  );
}
