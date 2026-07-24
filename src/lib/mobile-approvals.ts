import { query } from "@/lib/db";

/**
 * **ຄິວອະນຸມັດ ສຳລັບແອັບ (ຜູ້ຈັດການ/ຫົວໜ້າ)** — ອ່ານຢ່າງດຽວ.
 *
 * ── ຂອບເຂດ ──
 * ດຶງ 2 ຢ່າງທີ່ຄ້າງລໍຜູ້ຈັດການຕັດສິນ:
 *   • ໃບສະເໜີລາຄາ ລໍອະນຸມັດ (ic_trans trans_flag 17 · aprove_status = 0)
 *   • ຄຳຂໍຍົກເລີກໃບຮັບເຄື່ອງ (tb_product status 6 · ຂໍແລ້ວ ຍັງບໍ່ອະນຸມັດ)
 *
 * ⚠️ **ບໍ່ມີການອະນຸມັດຈາກແອັບ** — ການອະນຸມັດແຕະເອກະສານທີ່ເປັນເງິນ (ລາຄາ · ສາງ · ERP)
 * ແລະ ຂັ້ນຕອນຢູ່ໃນ actions/approval.ts ທີ່ຜູກກັບ form/redirect ຂອງເວັບ.
 * ແອັບຈຶ່ງເປັນ "ກະດິ່ງເຕືອນ + ລາຍການ" ໃຫ້ຜູ້ຈັດການຮູ້ວ່າມີຫຍັງຄ້າງ ແລ້ວກົດໄປຕັດສິນຢູ່ເວັບ.
 */

export type ApprovalItem = {
  kind: "quotation" | "cancellation";
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
  const [quotes, cancels] = await Promise.all([
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
  ]);

  // ຄ້າງດົນສຸດຂຶ້ນກ່ອນ — ອັນທີ່ຖ່ວງງານຢູ່ຄືອັນທີ່ຕ້ອງຕັດສິນກ່ອນ
  return [...quotes.rows, ...cancels.rows].sort(
    (a, b) => (b.waiting_seconds ?? 0) - (a.waiting_seconds ?? 0),
  );
}
