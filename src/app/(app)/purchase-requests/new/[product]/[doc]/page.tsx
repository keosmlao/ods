import { RqForm, type RqHead, type RqLine } from "@/components/purchase/rq-form";
import { PageTitle } from "@/components/ui";
import { db, query } from "@/lib/db";
import { nextDocNo } from "@/lib/doc-no";
import { notFound } from "next/navigation";

/** ຖອດແບບຈາກ ods: order.py add_request_order() + templates/request_order/add_request_order.html */

type Props = { params: Promise<{ product: string; doc: string }> };

async function getHead(productCode: string, docNo: string) {
  const sql = `select a.doc_no, to_char(a.doc_date,'DD-MM-YYYY') doc_date,
      concat_ws('-', d.name_1, d.tel) customer, d.code cust_code,
      c.name_1 product, c.p_model model, c.sn, c.issue, c.warrunty warranty, a.product_code
    from ic_trans_detail a
    left join ic_trans b on a.doc_no = b.doc_no
    left join tb_product c on c.code = a.product_code
    left join ar_customer d on d.code = c.cust_code
    where a.product_code = $1 and a.doc_no = $2 and a.trans_flag = 122
    limit 1`;
  return (await query<RqHead>(sql, [productCode, docNo])).rows[0] ?? null;
}

/** ອາໄຫຼ່ທີ່ stock ໝົດ ແລະ ຍັງບໍ່ທັນຖືກຂໍຊື້ */
async function getLines(productCode: string, docNo: string) {
  const sql = `select a.roworder, a.item_code, a.item_name, coalesce(a.qty,0) qty, a.unit_code,
      ic.balance_qty, coalesce(a.price,0) price, coalesce(a.sum_amount,0) sum_amount
    from ic_trans_detail a
    left join ic_inventory ic on ic.code = a.item_code
    where a.product_code = $1 and a.doc_no = $2
      and coalesce(ic.balance_qty,0) = 0 and a.status not in (1,7,5)
    order by a.roworder`;
  return (await query<RqLine>(sql, [productCode, docNo])).rows;
}

/** ເລກ RQ ທີ່ຈະໄດ້ (ສະແດງເທົ່ານັ້ນ — ຕອນບັນທຶກອອກເລກໃໝ່ໃນ transaction ທີ່ລັອກແລ້ວ) */
async function previewDocNo() {
  if (!db) return "";
  const client = await db.connect();
  try {
    return await nextDocNo(client, "RQ");
  } finally {
    client.release();
  }
}

export default async function NewPurchaseRequestPage({ params }: Props) {
  const { product, doc } = await params;
  const productCode = decodeURIComponent(product);
  const docNo = decodeURIComponent(doc);

  const head = await getHead(productCode, docNo);
  if (!head) notFound();

  const [lines, newDocNo] = await Promise.all([getLines(productCode, docNo), previewDocNo()]);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="w-full space-y-5">
      <PageTitle sub="ຂໍສັ່ງຊື່">ຂໍອະນຸມັດສະເໜີຊື້ອາໄຫຼ່</PageTitle>
      <RqForm head={head} lines={lines} docNo={newDocNo} today={today} />
    </div>
  );
}
