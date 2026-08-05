import { ReturnRequestForm, type ReturnDraftLine } from "@/components/stock/return-request-form";
import { getSession } from "@/lib/auth";
import { query } from "@/lib/db";
import { docPrefix } from "@/lib/doc-no";
import { employeeNameMap, resolveName } from "@/lib/employee-names";
import { canViewAssignedJob } from "@/lib/scope";
import { TRANS } from "@/lib/stock-constants";
import { notFound, redirect } from "next/navigation";

/** ods: stock.py /return_req_check + /show_return_req/<doc_no> + templates/stock/return_req_page.html */

type Props = { params: Promise<{ docNo: string }> };

type Head = {
  finished_at: string | null;
  customer: string | null;
  product: string | null;
  warranty: string | null;
  issue: string | null;
  technician: string | null;
  product_code: string;
  doc_no: string;
  doc_ref_date: string | null;
};

async function previewDocNo() {
  const prefix = docPrefix("SRI");
  const sql = `select coalesce(max(substring(doc_no from ${prefix.length + 1})::int), 0) + 1 seq
    from ic_trans where doc_no like $1 and substring(doc_no from ${prefix.length + 1}) ~ '^[0-9]+$'`;
  const seq = (await query<{ seq: number }>(sql, [`${prefix}%`])).rows[0]?.seq ?? 1;
  return `${prefix}${String(seq).padStart(4, "0")}`;
}

export default async function ReturnRequestPage({ params }: Props) {
  const session = await getSession();
  if (!session) redirect("/login");
  const { docNo } = await params;
  const code = decodeURIComponent(docNo);

  const head = await query<Head>(
    `select to_char(a.spare_finish,'DD-MM-YYYY HH24:MI') finished_at,
       b.name_1||'-'||b.tel customer, a.name_1||'-'||a.sn product, a.warrunty warranty, a.issue,
       a.emp_code technician, a.code product_code, c.doc_no, to_char(a.spare_finish,'YYYY-MM-DD') doc_ref_date
     from tb_product a
     left join ar_customer b on b.code = a.cust_code
     left join ic_trans c on a.code = c.product_code
     where c.trans_flag = $1 and c.doc_no = $2`,
    [TRANS.DISPATCH, code],
  );
  const bill = head.rows[0];
  if (!bill) notFound();
  if (!canViewAssignedJob(session, bill.technician)) redirect("/forbidden");

  const draft = await query<ReturnDraftLine>(
    `select row_number() over (order by roworder)::int rnum, item_code, item_name, qty, unit_code, roworder
     from ic_trans_detail_draft where doc_no = $1 and user_created = $2 and trans_flag = $3 order by roworder`,
    [code, session?.username ?? "", TRANS.DRAFT],
  );

  const newDocNo = await previewDocNo();
  // ວັນທີສະແດງເປັນ dd-MM-yyyy (ຄ່າທີ່ບັນທຶກລົງຖານມາຈາກ nowParts() ຢູ່ຝັ່ງ action ຢູ່ແລ້ວ)
  const today = new Date()
    .toLocaleDateString("en-GB", { timeZone: "Asia/Bangkok", day: "2-digit", month: "2-digit", year: "numeric" })
    .replaceAll("/", "-");

  return (
    <ReturnRequestForm
      docNo={newDocNo}
      docDate={today}
      docRef={bill.doc_no}
      docRefDate={bill.doc_ref_date ?? ""}
      dispatchedAt={bill.finished_at}
      productCode={bill.product_code}
      customer={bill.customer}
      product={bill.product}
      issue={bill.issue}
      warranty={bill.warranty}
      technician={resolveName(bill.technician, await employeeNameMap([bill.technician]))}
      lines={draft.rows}
    />
  );
}
