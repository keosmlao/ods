import { CustomerApproveActions } from "@/components/quotation/approve-actions";
import { QuoteDetail, type DetailHead, type DetailLine } from "@/components/quotation/quote-detail";
import { query } from "@/lib/db";
import { notFound } from "next/navigation";

/** ຖອດແບບຈາກ ods: qt.py cust_qtdetail() + templates/approve/qt/cust_qtdetail.html */

type Props = { params: Promise<{ docNo: string }> };

export default async function CustomerApprovalDetailPage({ params }: Props) {
  const { docNo } = await params;

  const [headResult, lineResult] = await Promise.all([
    query<DetailHead>(
      `select a.doc_no, to_char(a.doc_date,'DD-MM-YYYY') doc_date, concat_ws('-', b.name_1, b.tel) customer,
          c.name_1 product, c.p_model model, c.sn, c.p_brand brand, c.issue, c.warrunty warranty, c.issue_2,
          c.user_regis, c.emp_code technician, a.user_created, a.approver1, e.product_url, c.code product_code
        from ic_trans a
        left join ar_customer b on b.code = a.cust_code
        left join tb_product c on c.code = a.product_code
        left join product_image e on e.iteme_code = a.product_code and e.line_number = 0
        where a.doc_no = $1 and a.trans_flag = 17`,
      [docNo],
    ),
    query<DetailLine>(
      "select item_code, item_name, qty, unit_code, price, sum_amount from ic_trans_detail where doc_no=$1 order by roworder",
      [docNo],
    ),
  ]);

  const head = headResult.rows[0];
  if (!head) notFound();

  return (
    <QuoteDetail
      head={head}
      lines={lineResult.rows}
      showApprover
      actions={<CustomerApproveActions docNo={head.doc_no} productCode={head.product_code ?? ""} />}
    />
  );
}
