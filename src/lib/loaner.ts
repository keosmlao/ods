import { query } from "@/lib/db";

/**
 * ── ເຄື່ອງສຳຮອງ (loaner) ຂອງງານສ້ອມ ──
 *
 * ສູນເອົາເຄື່ອງຂອງຕົນໃຫ້ລູກຄ້າໃຊ້ກ່ອນ ລະຫວ່າງລໍສ້ອມ. ບໍ່ຕັດສະຕັອກ ERP (ບໍ່ແມ່ນສິນຄ້າຂາຍ)
 * ⇒ ຕາຕະລາງ ods_loaner ຄືຄວາມຈິງບ່ອນດຽວວ່າ **ໜ່ວຍໃດຢູ່ບ້ານໃຜ ແລະ ຄືນຫຼືຍັງ**
 * (migrations/2026-07-31-service-loaner.sql).
 *
 * ໃຊ້ຮ່ວມກັນ 3 ບ່ອນ: ໜ້າໃບງານ · ຄິວ "ເຄື່ອງສຳຮອງຄ້າງຄືນ" · ດ່ານກ່ອນສົ່ງເຄື່ອງຄືນ.
 */
export type LoanerRow = {
  id: number;
  job_code: string;
  item_code: string | null;
  item_name: string;
  isn: string;
  sn: string | null;
  lend_time: string;
  lend_by: string;
  lend_note: string | null;
  return_time: string | null;
  return_by: string | null;
  return_note: string | null;
  /** ຈຳນວນວັນທີ່ຢູ່ນຳລູກຄ້າ (ຍັງບໍ່ຄືນ = ນັບຮອດມື້ນີ້) */
  days: number;
};

/** ຄໍລຳມາດຕະຖານ — ຮັບ alias ເພື່ອໃຊ້ຊ້ຳໄດ້ທັງ query ດ່ຽວ ແລະ query ທີ່ join ໃບງານ */
const columns = (alias: string) => `${alias}.id, ${alias}.job_code, ${alias}.item_code, ${alias}.item_name,
    ${alias}.isn, ${alias}.sn,
    to_char(${alias}.lend_time,'DD-MM-YYYY HH24:MI') lend_time, ${alias}.lend_by, ${alias}.lend_note,
    to_char(${alias}.return_time,'DD-MM-YYYY HH24:MI') return_time, ${alias}.return_by, ${alias}.return_note,
    greatest(0, extract(day from coalesce(${alias}.return_time, localtimestamp) - ${alias}.lend_time))::int days`;

/** ເຄື່ອງສຳຮອງທັງໝົດຂອງໃບງານ (ຄືນແລ້ວກໍ່ສະແດງ — ເປັນປະຫວັດ) */
export async function loanersFor(jobCode: string): Promise<LoanerRow[]> {
  const rows = await query<LoanerRow>(
    `select ${columns("l")} from ods_loaner l where l.job_code = $1
      order by l.return_time nulls first, l.lend_time desc`,
    [jobCode],
  );
  return rows.rows;
}

/** ຍັງບໍ່ຮັບຄືນຈັກໜ່ວຍ — ດ່ານກ່ອນສົ່ງເຄື່ອງຄືນລູກຄ້າ (actions/return.ts) */
export async function openLoaners(jobCode: string): Promise<LoanerRow[]> {
  const rows = await query<LoanerRow>(
    `select ${columns("l")} from ods_loaner l where l.job_code = $1 and l.return_time is null
      order by l.lend_time`,
    [jobCode],
  );
  return rows.rows;
}

/**
 * ຂໍ້ຄວາມຫ້າມ ຖ້າຍັງມີເຄື່ອງສຳຮອງຄ້າງ — null ຄື ຜ່ານ.
 * ເອີ້ນຢູ່ **ທຸກທາງອອກ** ທີ່ປະທັບ return_complete (ມີໃບເກັບເງິນ · ບໍ່ເກັບເງິນ · ຍົກເລີກ).
 */
export async function loanerBlock(jobCode: string): Promise<string | null> {
  const open = await openLoaners(jobCode);
  if (!open.length) return null;
  const list = open.map((row) => `${row.item_name} (ISN ${row.isn})`).join(", ");
  return `ຍັງບໍ່ໄດ້ຮັບເຄື່ອງສຳຮອງຄືນ: ${list} — ຮັບຄືນຢູ່ໜ້າໃບງານກ່ອນ ຈຶ່ງສົ່ງເຄື່ອງຄືນລູກຄ້າໄດ້`;
}

/** ຄິວ "ເຄື່ອງສຳຮອງຄ້າງຄືນ" — ທຸກໃບງານ (ໜ້າ /service/loaners ແລະ ຕົວເລກຂ້າງເມນູ) */
export type OutstandingLoaner = LoanerRow & {
  cust_name: string | null;
  tel: string | null;
  product: string | null;
};

export async function outstandingLoaners(): Promise<OutstandingLoaner[]> {
  const rows = await query<OutstandingLoaner>(
    `select ${columns("l")},
        c.name_1 cust_name, c.tel, p.name_1 product
       from ods_loaner l
       left join tb_product p on p.code = l.job_code
       left join ar_customer c on c.code = p.cust_code
      where l.return_time is null
      order by l.lend_time`,
  );
  return rows.rows;
}
