import { query } from "@/lib/db";
import { getOutstandingSpares } from "@/lib/outstanding-spares";

/**
 * ລາຍລະອຽດເຕັມຂອງລາຍການອະນຸມັດ — ໃຫ້ **ໜ້າ native ໃນແອັບ** (ບໍ່ຕ້ອງເປີດ web).
 *
 * ໃບສະເໜີລາຄາ (quotation): ຫົວ + **ລາຍການສິນຄ້າ/ອາໄຫຼ່ + ລາຄາ** ຈາກ ic_trans_detail (flag 17).
 * ຂໍຍົກເລີກ (cancellation): ຫົວ + ເຫດຜົນ + **ອາໄຫຼ່ຄ້າງນອກສາງ** (getOutstandingSpares).
 */

export type ApprovalLine = {
  name: string | null;
  qty: string;
  unit: string | null;
  price: string | null;
  total: string | null;
};

export type ApprovalDetail = {
  kind: "quotation" | "cancellation";
  ref: string;
  product: string | null;
  brand: string | null;
  model: string | null;
  sn: string | null;
  customer: string | null;
  tel: string | null;
  warranty: string | null;
  symptom: string | null;
  diagnosis: string | null;
  requestedBy: string | null;
  requestedAt: string | null;
  /** ໃບສະເໜີ: ຍອດ + ສ່ວນຫຼຸດ + ຍອດກີບ */
  amount: string | null;
  discount: string | null;
  amountKip: string | null;
  /** ຂໍຍົກເລີກ: ເຫດຜົນ */
  reason: string | null;
  /** ລາຍການ (ໃບສະເໜີ = ສິນຄ້າ/ອາໄຫຼ່ · ຂໍຍົກເລີກ = ອາໄຫຼ່ຄ້າງ) */
  lines: ApprovalLine[];
};

export async function approvalDetail(kind: string, ref: string): Promise<ApprovalDetail | null> {
  if (kind === "quotation") {
    const head = (
      await query<{
        product: string | null; brand: string | null; model: string | null; sn: string | null;
        customer: string | null; tel: string | null; warranty: string | null;
        symptom: string | null; diagnosis: string | null; requested_by: string | null; requested_at: string | null;
        amount: string; discount: string; amount_kip: string | null;
      }>(
        `select c.name_1 product, c.p_brand brand, c.p_model model, c.sn,
            b.name_1 customer, b.tel,
            c.warrunty warranty, c.issue symptom, c.issue_2 diagnosis,
            a.user_created requested_by, to_char(a.doc_date,'DD-MM-YYYY') requested_at,
            coalesce(a.total_amount,0)::text amount, coalesce(a.total_discount,0)::text discount,
            a.total_amount_2::text amount_kip
          from ic_trans a
          left join ar_customer b on b.code = a.cust_code
          left join tb_product c on c.code = a.product_code
          where a.doc_no = $1 and a.trans_flag = 17 limit 1`,
        [ref],
      )
    ).rows[0];
    if (!head) return null;

    const lines = (
      await query<ApprovalLine>(
        `select item_name name, coalesce(qty,0)::text qty, unit_code unit,
            coalesce(price,0)::text price, coalesce(sum_amount,0)::text total
          from ic_trans_detail where doc_no=$1 and trans_flag=17 order by roworder`,
        [ref],
      )
    ).rows;

    return {
      kind: "quotation",
      ref,
      product: head.product, brand: head.brand, model: head.model, sn: head.sn,
      customer: head.customer, tel: head.tel, warranty: head.warranty,
      symptom: head.symptom, diagnosis: head.diagnosis,
      requestedBy: head.requested_by, requestedAt: head.requested_at,
      amount: head.amount, discount: head.discount, amountKip: head.amount_kip,
      reason: null, lines,
    };
  }

  // ── ຂໍຍົກເລີກ ──
  const head = (
    await query<{
      product: string | null; brand: string | null; model: string | null; sn: string | null;
      customer: string | null; tel: string | null; warranty: string | null;
      symptom: string | null; diagnosis: string | null; requested_at: string | null; reason: string | null;
    }>(
      `select a.name_1 product, a.p_brand brand, a.p_model model, a.sn,
          b.name_1 customer, b.tel, a.warrunty warranty,
          a.issue symptom, a.issue_2 diagnosis,
          to_char(a.cancel_start,'DD-MM-YYYY') requested_at,
          nullif(a.request_cancel,'') reason
        from tb_product a
        left join ar_customer b on b.code = a.cust_code
        where a.code = $1 limit 1`,
      [ref],
    )
  ).rows[0];
  if (!head) return null;

  const spares = await getOutstandingSpares(ref);
  return {
    kind: "cancellation",
    ref,
    product: head.product, brand: head.brand, model: head.model, sn: head.sn,
    customer: head.customer, tel: head.tel, warranty: head.warranty,
    symptom: head.symptom, diagnosis: head.diagnosis,
    requestedBy: null, requestedAt: head.requested_at,
    amount: null, discount: null, amountKip: null,
    reason: head.reason,
    lines: spares.map((s) => ({ name: s.item_name, qty: s.qty, unit: s.unit_code, price: null, total: null })),
  };
}
