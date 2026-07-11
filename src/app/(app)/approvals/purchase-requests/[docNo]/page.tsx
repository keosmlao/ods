import { ApproveForm, type ApproveHead, type ApproveLine } from "@/components/purchase/approve-form";
import { PageTitle } from "@/components/ui";
import { db, query } from "@/lib/db";
import { nextDocNo } from "@/lib/doc-no";
import { notFound } from "next/navigation";

/**
 * ຖອດແບບຈາກ ods: order.py approve_rq_order_page() + templates/request_order/approve_rq_order_page.html
 * ods ບັງຄັບ role=manager ຢູ່ໜ້ານີ້ — ໂຄງການນີ້ຕັດ role gating ອອກທັງລະບົບ.
 */

type Props = { params: Promise<{ docNo: string }> };

async function getHead(docNo: string) {
  const sql = `select a.doc_no, to_char(a.doc_date,'DD-MM-YYYY') doc_date,
      concat_ws('-', b.name_1, b.tel) customer, c.name_1 product, c.p_model model, c.sn, c.p_brand brand,
      c.issue, c.issue_2, c.user_regis, c.emp_code, a.user_created,
      (select product_url from product_image where iteme_code = a.product_code limit 1) product_url,
      (select product_url from product_image where iteme_code = a.doc_no limit 1) attach_url,
      c.code product_code, b.code cust_code,
      case when a.wanrunty = 'Warranty' then 'ຮັບປະກັນ' else 'ໝົດຮັບປະກັນ' end warranty,
      case when a.status_doc = 'Urgent' then 'ດ່ວນ' else 'ປົກກະຕິ' end status_doc,
      a.remark
    from ic_trans a
    left join ar_customer b on b.code = a.cust_code
    left join tb_product c on c.code = a.product_code
    where a.doc_no = $1 and a.trans_flag = 78`;
  return (await query<ApproveHead>(sql, [docNo])).rows[0] ?? null;
}

async function getLines(docNo: string) {
  const sql = `select item_code, item_name, coalesce(qty,0) qty, unit_code,
      coalesce(price,0) price, coalesce(sum_amount,0) sum_amount
    from ic_trans_detail where doc_no = $1 order by roworder`;
  return (await query<ApproveLine>(sql, [docNo])).rows;
}

/** ເລກ SPR ທີ່ຈະໄດ້ (ສະແດງເທົ່ານັ້ນ — ຕອນອະນຸມັດອອກເລກໃໝ່ໃນ transaction ທີ່ລັອກແລ້ວ) */
async function previewDocNo() {
  if (!db) return "";
  const client = await db.connect();
  try {
    return await nextDocNo(client, "SPR");
  } finally {
    client.release();
  }
}

export default async function ApproveDetailPage({ params }: Props) {
  const { docNo } = await params;
  const head = await getHead(decodeURIComponent(docNo));
  if (!head) notFound();

  const [lines, newDocNo] = await Promise.all([getLines(head.doc_no), previewDocNo()]);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="w-full space-y-5">
      <PageTitle sub="ອະນຸມັດຂໍສັ່ງຊື້">ລາຍລະອຽດຂໍອະນຸມັດສະເໜີຊື້</PageTitle>
      <ApproveForm head={head} lines={lines} docNo={newDocNo} today={today} />
    </div>
  );
}
