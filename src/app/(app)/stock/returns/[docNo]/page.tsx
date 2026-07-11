import { cancelReturnRequest, removeReturnDraftLine } from "@/app/actions/stock";
import { DocForm } from "@/components/stock/doc-form";
import { Card, Empty, ErrorBox, PageTitle, Table } from "@/components/ui";
import { getSession } from "@/lib/auth";
import { query } from "@/lib/db";
import { docPrefix } from "@/lib/doc-no";
import { TRANS } from "@/lib/stock-constants";
import { Trash2 } from "lucide-react";
import { notFound } from "next/navigation";

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

type DraftLine = {
  rnum: number;
  item_code: string;
  item_name: string | null;
  qty: string;
  unit_code: string | null;
  roworder: number;
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
  const { docNo } = await params;
  const code = decodeURIComponent(docNo);

  const head = await query<Head>(
    `select to_char(a.spare_finish,'DD-MM-YYYY HH24:MI:SS') finished_at,
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

  const draft = await query<DraftLine>(
    `select row_number() over (order by roworder)::int rnum, item_code, item_name, qty, unit_code, roworder
     from ic_trans_detail_draft where doc_no = $1 and user_created = $2 and trans_flag = $3 order by roworder`,
    [code, session?.username ?? "", TRANS.DRAFT],
  );

  const newDocNo = await previewDocNo();
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });

  return (
    <div className="w-full space-y-6">
      <PageTitle sub="ໃບຂໍສົ່ງອາໄຫຼ່">ໃບຂໍສົ່ງຄືນອາໄຫຼ່</PageTitle>

      <DocForm
        kind="returnRequest"
        exitAction={cancelReturnRequest}
        docNo={newDocNo}
        today={today}
        docRef={bill.doc_no}
        docRefDate={bill.doc_ref_date ?? ""}
        productCode={bill.product_code}
        disabled={draft.rows.length === 0}
        fields={[
          { label: "ວັນ/ເວລາເບີກສຳເລັດ:", value: bill.finished_at },
          { label: "ເລກ​ທີ​ໃບ​ເບີກ:", value: bill.doc_no },
          { label: "ລູກຄ້າ:", value: bill.customer },
          { label: "ຊື່ສິນຄ້າ:", value: bill.product },
          { label: "ອາການເສຍ:", value: bill.issue, accent: true },
          { label: "ປະກັນ:", value: bill.warranty },
          { label: "ຊ່າງສ້ອມ:", value: bill.technician },
        ]}
      />

      <Card title="ອາໄຫຼ່ທີ່ໃຊ້">
        {draft.rows.length === 0 ? (
          <Empty />
        ) : (
          <Table head={["#", "ລະຫັດສິນຄ້າ", "ຊື່ສິນຄ້າ", "ຈຳນວນ", "ຫົວໜ່ວຍ", ""]} minWidth={800}>
            {draft.rows.map((line) => (
              <tr key={line.roworder} className="border-b border-slate-100">
                <td className="px-3 py-3 text-center">{line.rnum}</td>
                <td className="px-3 py-3">{line.item_code}</td>
                <td className="px-3 py-3">{line.item_name ?? "-"}</td>
                <td className="px-3 py-3 text-center">{Number(line.qty)}</td>
                <td className="px-3 py-3 text-center">{line.unit_code ?? "-"}</td>
                <td className="px-3 py-3 text-center">
                  <form action={removeReturnDraftLine}>
                    <input type="hidden" name="row_id" value={line.roworder} />
                    <input type="hidden" name="doc_no" value={code} />
                    <button type="submit" title="ບໍ່ເອົາລາຍການນີ້" className="text-[#DE3163] hover:opacity-70">
                      <Trash2 className="size-4" />
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      {draft.rows.length === 0 && <ErrorBox>ບໍ່ມີອາໄຫຼ່ໃຫ້ສົ່ງຄືນ</ErrorBox>}
    </div>
  );
}
