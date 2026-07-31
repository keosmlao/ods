import { query, queryOdg } from "@/lib/db";
import { loanerHoldMessage } from "@/lib/loaner-shared";

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
 * ເອີ້ນຢູ່ **ທຸກທາງອອກ** ທີ່ປະທັບ return_complete: 3 ທາງຂອງ actions/return.ts
 * (ໃບຮັບເງິນ · ບໍ່ເກັບເງິນ · ວຽກຍົກເລີກ) ແລະ CLM-B "returned" ຂອງ actions/claim.ts.
 */
export async function loanerBlock(jobCode: string): Promise<string | null> {
  return loanerHoldMessage(await openLoaners(jobCode));
}

/** ຄິວ "ເຄື່ອງສຳຮອງຄ້າງຄືນ" — ທຸກໃບງານ (ໜ້າ /service/loaners ແລະ ຕົວເລກຂ້າງເມນູ) */
export type OutstandingLoaner = LoanerRow & {
  cust_name: string | null;
  tel: string | null;
  product: string | null;
};

/**
 * ── ຄົ້ນໜ່ວຍເຄື່ອງຈາກ SML (sn_inventory ຂອງ odg) ເພື່ອເອົາໄປໃຫ້ຢືມ ──
 *
 * ແຕ່ກ່ອນຟອມໃຫ້ຢືມມີແຕ່ຊ່ອງ ISN + ປຸ່ມ "ຫາຈາກ ERP" ທີ່ຈັບຄູ່ແບບ **ຕົງເປັນຕົວ**
 * ⇒ ຖ້າອ່ານປ້າຍບໍ່ຄົບ ຫຼື ບໍ່ຮູ້ ISN ເລີຍ (ຮູ້ແຕ່ວ່າ "ຈໍ 32 ນິ້ວ") ຈະ **ບໍ່ຂຶ້ນຫຍັງເລີຍ**
 * ແລ້ວຄົນກໍ່ພິມຊື່ເອົາເອງ ⇒ ໜ່ວຍທີ່ບັນທຶກໄວ້ບໍ່ຕົງກັບໜ່ວຍຈິງໃນ SML ແລະ ຕາມເອົາຄືນບໍ່ໄດ້.
 *
 * ດຽວນີ້ຄົ້ນໄດ້ດ້ວຍ **ISN · SN · ລະຫັດສິນຄ້າ · ຊື່ສິນຄ້າ** (ບາງສ່ວນກໍ່ໄດ້).
 *
 * ⚠️ **ບໍ່ຈຳກັດສາງ** ໂດຍເຈດຕະນາ: ສາງສູນບໍລິການ (1104) ມີພຽງ 69 ໜ່ວຍ ແລະ ເກືອບທັງໝົດ
 * ເປັນເຄື່ອງມືຊ່າງ — ເຄື່ອງທີ່ເອົາໄປໃຫ້ລູກຄ້າໃຊ້ກ່ອນ ຕົວຈິງຢືມມາຈາກສາງຂາຍ.
 * ຈຳກັດສາງ = ລາຍການຫວ່າງ = ບັນຫາເກົ່າຄືນມາ. ສະແດງ **ຊື່ສາງ** ໃຫ້ເຫັນແທນ
 * ⇒ ຄົນເລືອກຮູ້ວ່າຕ້ອງໄປເອົາໜ່ວຍນັ້ນຢູ່ໃສ.
 */
export type LoanerUnit = {
  isn: string;
  sn: string | null;
  item_code: string;
  item_name: string;
  wh_code: string | null;
  wh_name: string | null;
  /** ຢືມຢູ່ໃບງານອື່ນທີ່ຍັງບໍ່ຄືນ — ບອກໄວ້ກ່ອນກົດ (ດ່ານຈິງແມ່ນ unique index) */
  lent_job?: string | null;
};

export async function searchLoanerUnits(q: string, limit = 15): Promise<LoanerUnit[]> {
  const keyword = q.trim();
  if (keyword.length < 3) return [];
  const like = `%${keyword.replace(/\s+/g, "")}%`;

  const units = (
    await queryOdg<LoanerUnit>(
      `select coalesce(s.isn,'') isn, s.sn, s.item_code, coalesce(s.item_name,'') item_name,
              s.wh_code, w.name_1 wh_name
         from sn_inventory s
         left join ic_warehouse w on w.code = s.wh_code
        where coalesce(s.isn,'') <> ''
          and (replace(coalesce(s.isn,''),' ','') ilike $1
            or replace(coalesce(s.sn,''),' ','')  ilike $1
            or s.item_code ilike $2
            or s.item_name ilike $2)
        -- ຢູ່ສາງ (status 0) ຂຶ້ນກ່ອນ ໜ່ວຍທີ່ອອກໄປແລ້ວ
        order by s.status, s.updated_at desc nulls last
        limit $3`,
      [like, `%${keyword}%`, limit],
    )
  ).rows;
  if (!units.length) return units;

  // ໜ່ວຍໃດຢືມຄ້າງຢູ່ແລ້ວ — ຖາມ ODS ຮອບດຽວ (ບໍ່ join ຂ້າມຖານ)
  const open = await query<{ isn: string; job_code: string }>(
    `select isn, job_code from ods_loaner where return_time is null and isn = any($1)`,
    [units.map((unit) => unit.isn)],
  );
  const lent = new Map(open.rows.map((row) => [row.isn, row.job_code]));
  return units.map((unit) => ({ ...unit, lent_job: lent.get(unit.isn) ?? null }));
}

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
