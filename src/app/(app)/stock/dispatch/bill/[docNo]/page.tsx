import { BillView } from "@/components/stock/bill-view";
import type { SpareLine } from "@/components/stock/spare-lines";
import { query } from "@/lib/db";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getLocale } from "@/lib/i18n/locale";
import { notFound } from "next/navigation";

/** ods: stock.py /showbilldp/<doc_no> + templates/stock/showbilldipatch.html */

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
  remark: string | null;
};

export default async function ShowDispatchBillPage({ params }: Props) {
  const t = (await getDictionary(await getLocale())).dispatchBill;
  const { docNo } = await params;
  const code = decodeURIComponent(docNo);

  const head = await query<Head>(
    `select a.doc_no, to_char(a.doc_date,'DD-MM-YYYY') doc_date, a.doc_ref,
       to_char(a.doc_ref_date::date,'DD-MM-YYYY') doc_ref_date,
       coalesce(b.name_1,'')||'-'||coalesce(b.tel,'') customer,
       c.name_1 product, c.p_model, c.sn, c.issue, c.warrunty warranty, c.issue_2, c.emp_code technician, a.remark
     from ic_trans a
     left join tb_product c on c.code = a.product_code
     left join ar_customer b on b.code = c.cust_code
     where a.doc_no = $1`,
    [code],
  );
  const bill = head.rows[0];
  if (!bill) notFound();

  const lines = await query<Omit<SpareLine, "roworder">>(
    `select row_number() over ()::int rnum, item_code, item_name, qty, unit_code
     from ic_trans_detail where doc_no = $1`,
    [code],
  );

  return (
    <BillView
      title={t.title}
      backHref="/stock/dispatch"
      fields={[
        { label: t.requestDocNoLabel, value: bill.doc_no },
        { label: t.dateLabel, value: bill.doc_date },
        { label: t.checkDocNoLabel, value: bill.doc_ref },
        { label: t.dateLabel, value: bill.doc_ref_date },
        { label: t.customerLabel, value: bill.customer },
        { label: t.productNameLabel, value: bill.product },
        { label: t.modelLabel, value: bill.p_model },
        { label: t.snLabel, value: bill.sn },
        { label: t.faultLabel, value: bill.issue, accent: true },
        { label: t.warrantyLabel, value: bill.warranty },
        { label: t.techFaultLabel, value: bill.issue_2 },
        { label: t.repairTechLabel, value: bill.technician },
        { label: t.remarkLabel, value: bill.remark },
      ]}
      lines={lines.rows}
    />
  );
}
