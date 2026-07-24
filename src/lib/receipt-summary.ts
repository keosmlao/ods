import { query } from "@/lib/db";

/**
 * **ສະຫຼຸບໃບຮັບເງິນ (SIN)** — ປະຈຳວັນ ຫຼື ປະຈຳເດືອນ.
 *
 * ໃບຮັບເງິນ = `ic_trans` ທີ່ `trans_flag = 44` (ເບິ່ງ lib/doc-no).
 *
 * ── ຍອດເອົາມາຈາກໃສ ──
 * ໃຊ້ `total_amount` ຂອງຫົວໃບ ແລະ ຖ້າຫົວໃບເປັນ 0 ໃຫ້ຕົກມາໃຊ້ຜົນລວມຂອງ**ລາຍການ**
 * (ic_trans_detail.sum_amount) ເພາະຂໍ້ມູນຈິງມີໃບທີ່ຫົວບໍ່ຖືກຂຽນ ແຕ່ລາຍການມີຍອດ.
 *
 * ⚠️ ຄວາມຈິງຂອງຂໍ້ມູນ (24-07-2026): ໃບ SIN 4,496 ໃບ **ມີພຽງ 1 ໃບທີ່ຍອດ > 0**
 * ເພາະງານສ່ວນໃຫຍ່ຢູ່ໃນປະກັນ (ບໍ່ເກັບເງິນ) ແລະ ໃບເກົ່າບໍ່ໄດ້ບັນທຶກຍອດໄວ້.
 * ⇒ ລາຍງານນີ້ຈະສະແດງ 0 ເປັນສ່ວນໃຫຍ່ ຊຶ່ງ **ຖືກຕ້ອງຕາມຂໍ້ມູນ** ບໍ່ແມ່ນລາຍງານພັງ.
 */

export type ReceiptPeriodRow = {
  period: string;
  receipts: number;
  charged: number;
  free: number;
  total: string;
};

export type ReceiptDocRow = {
  doc_no: string;
  doc_date: string;
  job: string | null;
  customer: string | null;
  amount: string;
  cashier: string | null;
};

/** ຍອດຂອງໃບ — ຫົວໃບກ່ອນ, ບໍ່ມີຈຶ່ງລວມຈາກລາຍການ */
const AMOUNT = `coalesce(nullif(t.total_amount, 0),
  (select sum(d.sum_amount) from ic_trans_detail d
    where d.doc_no = t.doc_no and d.trans_flag = 44), 0)`;

/** ສະຫຼຸບຕາມຊ່ວງ — 'day' = ວັນ · 'month' = ເດືອນ */
export async function receiptsByPeriod(
  from: string,
  to: string,
  mode: "day" | "month",
): Promise<ReceiptPeriodRow[]> {
  const format = mode === "month" ? "MM-YYYY" : "DD-MM-YYYY";
  const bucket = mode === "month" ? "date_trunc('month', t.doc_date)" : "t.doc_date::date";
  return (
    await query<ReceiptPeriodRow>(
      `select to_char(${bucket}, '${format}') as period,
          count(*)::int as receipts,
          count(*) filter (where ${AMOUNT} > 0)::int as charged,
          count(*) filter (where ${AMOUNT} <= 0)::int as free,
          to_char(sum(${AMOUNT}), 'FM999,999,999,990') as total
        from ic_trans t
       where t.trans_flag = 44 and t.doc_date::date between $1 and $2
       group by ${bucket}
       order by ${bucket} desc`,
      [from, to],
    )
  ).rows;
}

/** ລາຍໃບ (ໃຫ້ກົດເຂົ້າກວດໄດ້ວ່າຍອດມາຈາກໃບໃດ) */
export async function receiptDocs(from: string, to: string): Promise<ReceiptDocRow[]> {
  return (
    await query<ReceiptDocRow>(
      `select t.doc_no,
          to_char(t.doc_date, 'DD-MM-YYYY') as doc_date,
          nullif(t.product_code, '') as job,
          c.name_1 as customer,
          to_char(${AMOUNT}, 'FM999,999,999,990') as amount,
          nullif(t.user_created, '') as cashier
        from ic_trans t
        left join ar_customer c on c.code = t.cust_code
       where t.trans_flag = 44 and t.doc_date::date between $1 and $2
       order by t.doc_date desc, t.doc_no desc`,
      [from, to],
    )
  ).rows;
}
