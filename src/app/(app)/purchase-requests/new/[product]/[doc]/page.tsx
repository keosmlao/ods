import { RqForm, type RqHead, type RqLine } from "@/components/purchase/rq-form";
import { PageTitle } from "@/components/ui";
import { odgDb, query, queryOdg } from "@/lib/db";
import { nextSprNo } from "@/lib/erp-spr";
import { getBalances, withdrawableQty } from "@/lib/stock-balance";
import { STAGE_SQL } from "@/lib/stage";
import { notFound } from "next/navigation";

/** ຖອດແບບຈາກ ods: order.py add_request_order() + templates/request_order/add_request_order.html */

type Props = { params: Promise<{ product: string; doc: string }> };

async function getHead(productCode: string, docNo: string) {
  if (docNo === "direct") {
    const sql = `select concat('CHECK:',a.code) doc_no, to_char(a.time_finish_check,'DD-MM-YYYY') doc_date,
        concat_ws('-', d.name_1, d.tel) customer, d.code cust_code,
        a.name_1 product, a.p_model model, a.sn, a.issue, a.warrunty warranty, a.code product_code,
        'check'::text source_type
      from tb_product a
      left join ar_customer d on d.code = a.cust_code
      where a.code=$1 and (${STAGE_SQL})=5`;
    return (await query<RqHead>(sql, [productCode])).rows[0] ?? null;
  }
  const sql = `select a.doc_no, to_char(a.doc_date,'DD-MM-YYYY') doc_date,
      concat_ws('-', d.name_1, d.tel) customer, d.code cust_code,
      c.name_1 product, c.p_model model, c.sn, c.issue, c.warrunty warranty, a.product_code,
      'request'::text source_type
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
  if (docNo === "direct") {
    /**
     * ກັນຂໍຊື້ຊ້ຳ — dedup ດ້ວຍ **ໃບ SPR ຢູ່ ERP** (doc_ref = ລະຫັດວຽກ) ຄືກັນກັບ action.
     * ແຕ່ກ່ອນ dedup ດ້ວຍ RQ(78) ຂອງ ODS ທີ່ບໍ່ຖືກສ້າງອີກແລ້ວ ⇒ ຟອມຍັງເປີດໃຫ້ຂໍຊ້ຳ
     * ທັງທີ່ action ຈະປະຕິເສດ — ຄົນເສຍເວລາຕື່ມຟອມລ້າໆ.
     */
    const onSpr = new Set(
      (
        await queryOdg<{ item_code: string }>(
          `select distinct item_code from ic_trans_detail where trans_flag = 2 and doc_ref = $1`,
          [productCode],
        )
      ).rows.map((row) => row.item_code),
    );
    const required = (
      await query<{ roworder: number; item_code: string; item_name: string | null; qty: string; unit_code: string | null }>(
        `select min(s.roworder)::int roworder, s.item_code, max(s.item_name) item_name,
            sum(coalesce(s.qty,0))::text qty, max(s.unit_code) unit_code
           from tb_used_spare s
          where s.product_code=$1
          group by s.item_code order by min(s.roworder)`,
        [productCode],
      )
    ).rows.filter((line) => !onSpr.has(line.item_code));
    const balances = await getBalances(required.map((line) => line.item_code));
    return required.flatMap((line): RqLine[] => {
      // ຂອບເຂດດຽວກັບຕອນຂໍເບີກ+ຂໍຊື້ — ນັບສະເພາະສາງທີ່ເບີກໄດ້ (ບໍ່ແມ່ນ total ທຸກສາງ)
      const balance = withdrawableQty(balances.get(line.item_code));
      const shortage = Math.max(0, Number(line.qty) - balance);
      if (shortage <= 0) return [];
      return [{ ...line, qty: String(shortage), balance_qty: String(balance), price: "0", sum_amount: "0" }];
    });
  }
  const sql = `select a.roworder, a.item_code, a.item_name, coalesce(a.qty,0) qty, a.unit_code,
      ic.balance_qty, coalesce(a.price,0) price, coalesce(a.sum_amount,0) sum_amount
    from ic_trans_detail a
    left join ic_inventory ic on ic.code = a.item_code
    where a.product_code = $1 and a.doc_no = $2
      and coalesce(ic.balance_qty,0) < coalesce(a.qty,0) and a.status not in (1,7,5)
    order by a.roworder`;
  return (await query<RqLine>(sql, [productCode, docNo])).rows;
}

/**
 * ເລກໃບທີ່ຈະໄດ້ — **SPR ຈາກ ERP** (ໃບຂໍຊື້ອອກຢູ່ ERP ບ່ອນດຽວແລ້ວ, ບໍ່ມີ RQ ອີກ).
 * ສະແດງເທົ່ານັ້ນ — ເລກຈິງອອກຕອນບັນທຶກ ໃນ transaction ຂອງ ERP ທີ່ລັອກແລ້ວ (nextSprNo).
 */
async function previewDocNo() {
  if (!odgDb) return "";
  const odg = await odgDb.connect();
  try {
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });
    return await nextSprNo(odg, today);
  } catch (error) {
    console.error("preview SPR no failed", error);
    return "";
  } finally {
    odg.release();
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

  /** ບໍ່ເຫຼືອຫຍັງໃຫ້ຂໍ (ຂໍໄປແລ້ວ/ERP ມີພໍ) — ບອກເລີຍ ຢ່າໃຫ້ຕື່ມຟອມລ້າໆ */
  if (docNo === "direct" && lines.length === 0) {
    const prior = await queryOdg<{ doc_no: string }>(
      `select distinct doc_no from ic_trans_detail where trans_flag = 2 and doc_ref = $1 order by doc_no desc limit 3`,
      [productCode],
    ).then((r) => r.rows.map((row) => row.doc_no)).catch(() => []);
    return (
      <div className="w-full max-w-2xl space-y-5">
        <PageTitle sub="ຂໍສັ່ງຊື່">ຂໍອະນຸມັດສະເໜີຊື້ອາໄຫຼ່</PageTitle>
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {prior.length
            ? `ອາໄຫຼ່ຂອງວຽກ #${productCode} ຖືກຂໍຊື້ໄປແລ້ວ (${prior.join(", ")}) — ຂໍຊ້ຳບໍ່ໄດ້. ຕິດຕາມໄດ້ຢູ່ຄິວ "ອະນຸມັດຂໍສັ່ງຊື້"`
            : `ວຽກ #${productCode} ບໍ່ມີອາໄຫຼ່ທີ່ຕ້ອງສັ່ງຊື້ — ສາງມີພໍແລ້ວ ໃຫ້ຂໍເບີກແທນ`}
        </p>
      </div>
    );
  }

  return (
    <div className="w-full space-y-5">
      <PageTitle sub="ຂໍສັ່ງຊື່">ຂໍອະນຸມັດສະເໜີຊື້ອາໄຫຼ່</PageTitle>
      <RqForm head={head} lines={lines} docNo={newDocNo} today={today} />
    </div>
  );
}
