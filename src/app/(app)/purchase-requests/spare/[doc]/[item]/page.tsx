import { SprForm, type SprHead, type SprLine } from "@/components/purchase/spr-form";
import { PageTitle } from "@/components/ui";
import { db, query } from "@/lib/db";
import { nextDocNo } from "@/lib/doc-no";
import { notFound } from "next/navigation";

/** ຖອດແບບຈາກ ods: orderspare.py showsparefororder() — ອອກ SPR ໃຫ້ອາໄຫຼ່ 1 ລາຍການ ໂດຍບໍ່ຜ່ານ RQ */

type Props = { params: Promise<{ doc: string; item: string }> };

async function getHead(docNo: string, itemCode: string) {
  const sql = `select a.doc_no, to_char(a.doc_date,'DD-MM-YYYY') doc_date,
      concat_ws('-', d.name_1, d.tel) customer, c.name_1 product, c.p_model model, c.sn,
      c.issue, b.wanrunty warranty, c.p_access, b.isue_2 issue_2, a.product_code, a.item_code
    from ic_trans_detail a
    left join ic_trans b on a.doc_no = b.doc_no
    left join tb_product c on c.code = a.product_code
    left join ar_customer d on d.code = c.cust_code
    where a.doc_no = $1 and a.item_code = $2 and a.trans_flag = 122
    limit 1`;
  return (await query<SprHead>(sql, [docNo, itemCode])).rows[0] ?? null;
}

async function getLines(docNo: string, itemCode: string) {
  const sql = `select roworder, item_code, item_name, coalesce(qty,0) qty, unit_code
    from ic_trans_detail where doc_no = $1 and item_code = $2 order by roworder`;
  return (await query<SprLine>(sql, [docNo, itemCode])).rows;
}

async function previewDocNo() {
  if (!db) return "";
  const client = await db.connect();
  try {
    return await nextDocNo(client, "SPR");
  } finally {
    client.release();
  }
}

export default async function SparePurchasePage({ params }: Props) {
  const { doc, item } = await params;
  const docNo = decodeURIComponent(doc);
  const itemCode = decodeURIComponent(item);

  const head = await getHead(docNo, itemCode);
  if (!head) notFound();

  const [lines, newDocNo] = await Promise.all([getLines(docNo, itemCode), previewDocNo()]);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="w-full space-y-5">
      <PageTitle sub="ຂໍສັ່ງຊື່">ສະເໜີຊື້ອາໄຫຼ່</PageTitle>
      <SprForm head={head} lines={lines} docNo={newDocNo} today={today} />
    </div>
  );
}
