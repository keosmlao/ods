import { DocForm } from "@/components/stock/doc-form";
import { SpareLineTable, type SpareLine } from "@/components/stock/spare-lines";
import { ErrorBox, PageTitle } from "@/components/ui";
import { query } from "@/lib/db";
import { docPrefix } from "@/lib/doc-no";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getLocale } from "@/lib/i18n/locale";
import { notFound } from "next/navigation";

/** ods: stock.py /show_return/<doc_no> + templates/stock/show_return.html */

type Props = { params: Promise<{ docNo: string }> };

type Head = {
  doc_no: string;
  doc_date: string | null;
  customer: string | null;
  product: string | null;
  p_model: string | null;
  sn: string | null;
  issue: string | null;
  warranty: string | null;
  product_code: string | null;
  remark: string | null;
};

async function previewDocNo() {
  const prefix = docPrefix("SRT");
  const sql = `select coalesce(max(substring(doc_no from ${prefix.length + 1})::int), 0) + 1 seq
    from ic_trans where doc_no like $1 and substring(doc_no from ${prefix.length + 1}) ~ '^[0-9]+$'`;
  const seq = (await query<{ seq: number }>(sql, [`${prefix}%`])).rows[0]?.seq ?? 1;
  return `${prefix}${String(seq).padStart(4, "0")}`;
}

export default async function ShowReceiveReturnPage({ params }: Props) {
  const { docNo } = await params;
  const code = decodeURIComponent(docNo);
  const t = (await getDictionary(await getLocale())).receiveReturnsDetail;

  const head = await query<Head>(
    `select a.doc_no, to_char(a.doc_date,'DD-MM-YYYY') doc_date,
       coalesce(b.name_1,'')||'-'||coalesce(b.tel,'') customer,
       c.name_1 product, c.p_model, c.sn, c.issue, c.warrunty warranty, a.product_code, a.remark
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

  const newDocNo = await previewDocNo();
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });

  return (
    <div className="w-full space-y-6">
      <PageTitle sub={t.subtitle}>{t.title}</PageTitle>

      <DocForm
        kind="receiveReturn"
        backHref="/stock/receive-returns"
        docNo={newDocNo}
        today={today}
        docRef={bill.doc_no}
        productCode={bill.product_code ?? ""}
        defaultRemark={bill.remark ?? ""}
        disabled={lines.rows.length === 0}
        fields={[
          { label: t.checkBillNo, value: bill.doc_no },
          { label: t.date, value: bill.doc_date },
          { label: t.customer, value: bill.customer },
          { label: t.productName, value: bill.product },
          { label: t.model, value: bill.p_model },
          { label: t.serialNo, value: bill.sn },
          { label: t.issue, value: bill.issue, accent: true },
          { label: t.warranty, value: bill.warranty },
        ]}
      />

      <SpareLineTable lines={lines.rows} />

      {lines.rows.length === 0 && <ErrorBox>{t.noSpares}</ErrorBox>}
    </div>
  );
}
