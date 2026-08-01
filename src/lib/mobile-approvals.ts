import { query, queryOdg } from "@/lib/db";
import { ERP_PURCHASE } from "@/lib/stock-constants";

/**
 * **ຄິວອະນຸມັດ ສຳລັບແອັບ (ຜູ້ຈັດການ/ຫົວໜ້າ)** — ອ່ານຢ່າງດຽວ.
 *
 * ── ຂອບເຂດ ──
 * ດຶງ **4** ຢ່າງທີ່ຄ້າງລໍຜູ້ຈັດການຕັດສິນ:
 *   • ໃບສະເໜີລາຄາ ລໍອະນຸມັດ (ic_trans trans_flag 17 · aprove_status = 0)
 *   • ຄຳຂໍຍົກເລີກໃບຮັບເຄື່ອງ (tb_product status 6 · ຂໍແລ້ວ ຍັງບໍ່ອະນຸມັດ)
 *   • **ໃບຂໍຊື້ (SPR) ລໍ WPRA**       ← ເພີ່ມ 31-07-2026
 *   • **ໃບສັ່ງຊື້ (PO) ລໍ WPOA**       ← ເພີ່ມ 31-07-2026
 *
 * ສອງອັນຫຼັງ **ຂາດໄປທັງໝົດ** ⇒ ຜູ້ຈັດການເປີດແອັບແລ້ວບໍ່ເຫັນໃບສັ່ງຊື້ຈັກໃບ
 * ທັງທີ່ຄິວຢູ່ເວັບມີ 48 ໃບຄ້າງ (ເກົ່າສຸດ 361 ມື້). ຂໍ້ມູນຢູ່ **ERP (odg)**
 * ບໍ່ແມ່ນ ODS ຈຶ່ງໃຊ້ queryOdg ແລະ ຫໍ່ try/catch ແຍກ — ERP ລົ້ມ ⇒ ຄິວອື່ນຍັງມາຄືເກົ່າ.
 *
 * ທັງ 4 ປະເພດມີໜ້າລາຍລະອຽດ ແລະ ຕັດສິນແບບ native ໃນແອັບ;
 * SPR/PO ຂຽນ WPRA/WPOA ໄປ ERP ຜ່ານ purchase-approval-core.
 */

export type ApprovalItem = {
  kind: "quotation" | "cancellation" | "purchase-request" | "purchase-order";
  /** ປ້າຍປະເພດ (ພາສາລາວ) — ໃຫ້ແອັບບໍ່ຕ້ອງແປເອງ */
  kind_label: string;
  /** ເລກທີ່ໃຊ້ອ້າງອີງ (ເລກໃບສະເໜີ ຫຼື ລະຫັດໃບຮັບເຄື່ອງ) */
  ref: string;
  title: string | null;
  customer: string | null;
  amount: string | null;
  requested_at: string | null;
  /** ວິນາທີທີ່ຄ້າງລໍການຕັດສິນ — ແອັບໃຊ້ຈັດລຳດັບ/ໃສ່ສີ */
  waiting_seconds: number;
  /** ໜ້າເວັບທີ່ໄປຕັດສິນ */
  href: string;
};

export async function pendingApprovals(): Promise<ApprovalItem[]> {
  const [quotes, cancels, purchases] = await Promise.all([
    query<ApprovalItem>(
      `select 'quotation' as kind, 'ໃບສະເໜີລາຄາ' as kind_label,
          a.doc_no as ref,
          p.name_1 as title,
          c.name_1 as customer,
          to_char(a.total_amount, 'FM999,999,999,990') as amount,
          to_char(a.doc_date, 'DD-MM-YYYY') as requested_at,
          extract(epoch from localtimestamp - a.doc_date)::double precision as waiting_seconds,
          '/approvals/quotations/' || a.doc_no as href
        from ic_trans a
        left join tb_product p on p.code = a.product_code
        left join ar_customer c on c.code = a.cust_code
       where a.trans_flag = 17 and coalesce(a.aprove_status, 0) = 0
       order by a.doc_date`,
    ),
    query<ApprovalItem>(
      `select 'cancellation' as kind, 'ຂໍຍົກເລີກໃບຮັບເຄື່ອງ' as kind_label,
          a.code as ref,
          concat_ws(' ', a.name_1, a.p_model) as title,
          c.name_1 as customer,
          null as amount,
          to_char(a.cancel_start, 'DD-MM-YYYY') as requested_at,
          extract(epoch from localtimestamp - a.cancel_start)::double precision as waiting_seconds,
          '/approvals/cancellations/' || a.code as href
        from tb_product a
        left join ar_customer c on c.code = a.cust_code
       where a.status = 6 and a.cancel_start is not null and a.cancel_finish is null
       order by a.cancel_start`,
    ),
    erpPurchaseApprovals(),
  ]);

  // ຄ້າງດົນສຸດຂຶ້ນກ່ອນ — ອັນທີ່ຖ່ວງງານຢູ່ຄືອັນທີ່ຕ້ອງຕັດສິນກ່ອນ
  return [...quotes.rows, ...cancels.rows, ...purchases].sort(
    (a, b) => (b.waiting_seconds ?? 0) - (a.waiting_seconds ?? 0),
  );
}

/**
 * ໃບຂໍຊື້ (SPR→WPRA) ແລະ ໃບສັ່ງຊື້ (PO→WPOA) ທີ່ຍັງບໍ່ອະນຸມັດ — ຢູ່ **ERP (odg)**.
 *
 * ⚡ ເປັນຫຍັງໃຊ້ CTE ບໍ່ແມ່ນ subquery ຕໍ່ແຖວຄືໜ້າເວັບ: ໜ້າເວັບຖາມ
 * `split_part(w.doc_ref,' ',1) = t.doc_no` ໃນ subquery ທີ່ຜູກກັບແຕ່ລະແຖວ ⇒ ໃຊ້ index
 * ບໍ່ໄດ້ ແລະ ວັດແທ້ **25.8 ວິນາທີ**. ກວາດ WPOA ຮອບດຽວໄວ້ໃນ CTE ແລ້ວຄົ້ນ
 * ⇒ **416ms** (ຜົນລັບ 48 ໃບຄືກັນເປັນຕົວຕໍ່ຕົວ). ແອັບລໍ 25ວິ ບໍ່ໄດ້.
 *
 * ນິຍາມ "PO ຂອງສາຍເຮົາ" ຄືກັບ /approvals/purchase-orders: ມາຈາກ SPR ຫຼື ອອກໂດຍກົງ.
 */
/**
 * ⏱️ ຈຳກັດເວລາຂອງສ່ວນທີ່ຖາມ **ERP** — ERP ຢູ່ຄົນລະເຄື່ອງ ແລະ ບາງເວລາຊ້າ/ລົ້ມ.
 *
 * ⚠️ ຖ້າປະໃຫ້ມັນຄ້າງ ທັງ endpoint ຈະຄ້າງນຳ ⇒ ຜູ້ຈັດການເປີດຄິວອະນຸມັດແລ້ວ
 * **ບໍ່ເຫັນຫຍັງເລີຍ** ເຖິງແມ່ນໃບສະເໜີລາຄາ/ຄຳຂໍຍົກເລີກ (ຢູ່ ODS) ຈະດຶງໄດ້ປົກກະຕິ.
 * ໝົດເວລາ ⇒ ຄືນລາຍການຫວ່າງ ແລ້ວປ່ອຍໃຫ້ສ່ວນອື່ນສະແດງໄດ້ຄືເກົ່າ.
 */
const ERP_BUDGET_MS = 8000;

function withBudget<T>(work: Promise<T>, fallback: T, label: string): Promise<T> {
  return Promise.race([
    work,
    new Promise<T>((resolve) =>
      setTimeout(() => {
        console.error(`${label} ໝົດເວລາ ${ERP_BUDGET_MS}ms — ຂ້າມໄປກ່ອນ`);
        resolve(fallback);
      }, ERP_BUDGET_MS),
    ),
  ]);
}

async function erpPurchaseApprovals(): Promise<ApprovalItem[]> {
  try {
    const [pr, po] = await Promise.all([
      withBudget(queryOdg<ApprovalItem>(
        `select 'purchase-request' as kind, 'ໃບຂໍຊື້ (SPR)' as kind_label,
            t.doc_no as ref,
            split_part(trim(coalesce(t.doc_ref,'')),' ',1) as title,
            coalesce(nullif(t.user_request,''), t.creator_code) as customer,
            (select to_char(sum(d.sum_amount),'FM999,999,999,990') from ic_trans_detail d
              where d.doc_no = t.doc_no and d.trans_flag = t.trans_flag) as amount,
            to_char(t.doc_date,'DD-MM-YYYY') as requested_at,
            extract(epoch from localtimestamp - t.doc_date)::double precision as waiting_seconds,
            '/approvals/purchase-requests' as href
          from ic_trans t
         where t.trans_flag = $1 and t.doc_format_code = 'SPR'
           and t.doc_date >= current_date - 365
           and not exists (select 1 from ic_trans_detail w
                            where w.trans_flag = $2 and w.ref_doc_no = t.doc_no)
         order by t.doc_date
         limit 100`,
        [ERP_PURCHASE.PR_REQUEST, ERP_PURCHASE.PR_APPROVE],
      ).then((result) => result.rows), [], "ຄິວ SPR ຝັ່ງ ERP"),
      withBudget(queryOdg<ApprovalItem>(
        `with wpoa as (
           select distinct split_part(trim(coalesce(doc_ref,'')),' ',1) as po
             from ic_trans where trans_flag = $3 and doc_date >= current_date - 400
         ),
         from_spr as (
           select distinct d.doc_no
             from ic_trans_detail d
             join ic_trans_detail w on w.doc_no = d.ref_doc_no
                                   and w.trans_flag = $2 and w.ref_doc_no like 'SPR%'
            where d.trans_flag = $1
         ),
         linked as (
           select distinct doc_no from ic_trans_detail
            where trans_flag = $1 and coalesce(ref_doc_no,'') <> ''
         )
         select 'purchase-order' as kind, 'ໃບສັ່ງຊື້ (PO)' as kind_label,
             t.doc_no as ref,
             (select s.name_1 from ap_supplier s where s.code = t.cust_code limit 1) as title,
             t.cust_code as customer,
             to_char(coalesce(t.total_amount,0),'FM999,999,999,990') as amount,
             to_char(t.doc_date,'DD-MM-YYYY') as requested_at,
             extract(epoch from localtimestamp - t.doc_date)::double precision as waiting_seconds,
             '/approvals/purchase-orders' as href
           from ic_trans t
          where t.trans_flag = $1 and t.doc_date >= current_date - 365
            and not exists (select 1 from wpoa where wpoa.po = t.doc_no)
            and (t.doc_no in (select doc_no from from_spr)
              or t.doc_no not in (select doc_no from linked))
          order by t.doc_date
          limit 100`,
        [ERP_PURCHASE.ORDER, ERP_PURCHASE.PR_APPROVE, ERP_PURCHASE.ORDER_APPROVE],
      ).then((result) => result.rows), [], "ຄິວ PO ຝັ່ງ ERP"),
    ]);
    // ຖ້າ query ໃດໜຶ່ງຊ້າ ຍັງສົ່ງຄິວອີກປະເພດທີ່ໂຫຼດສຳເລັດກັບໄປໄດ້.
    return [...pr, ...po];
  } catch (error) {
    // ERP ລົ້ມ ⇒ ຄິວອື່ນຍັງມາຄືເກົ່າ (ຫຼັກການດຽວກັບ lib/erp-purchase)
    console.error("erpPurchaseApprovals failed", error);
    return [];
  }
}
