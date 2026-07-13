import { query } from "@/lib/db";

/**
 * **ເຄື່ອງທີ່ກັບມາສ້ອມຊ້ຳ** — ເຄື່ອງໜ່ວຍດຽວກັນ (S/N + ລູກຄ້າ) ກັບມາພາຍໃນ 60 ມື້.
 *
 * ── ເປັນຫຍັງສຳຄັນ ──
 * ງານທີ່ໄວແຕ່ຕ້ອງກັບມາ = ຈ່າຍຄ່າຊ່າງ 2 ເທື່ອ · ອາໄຫຼ່ອາດເສຍຖິ້ມ · ລູກຄ້າເສຍຄວາມເຊື່ອ.
 * ບໍ່ມີໜ້າໃດເຫັນມັນເລີຍ ⇒ ບໍ່ມີໃຜຮູ້ວ່າສ້ອມບໍ່ຫາຍແຕ່ເທື່ອທຳອິດ.
 *
 * ── ⚠️ ວິທີນັບ (ຢ່າແກ້ໂດຍບໍ່ອ່ານ) ──
 * S/N '-' ຖືກໃຊ້ໃນ **269 ໃບ / 234 ລູກຄ້າ** (ເຄື່ອງທີ່ບໍ່ມີປ້າຍ) ⇒ ຈັດກຸ່ມດ້ວຍ S/N ລ້ວນ
 * ຈະເຮັດໃຫ້ທຸກໃບກາຍເປັນ "ເຄື່ອງໜ່ວຍດຽວກັນ" ແລ້ວອັດຕາສ້ອມຊ້ຳພຸ່ງເປັນ 29% (ຜິດ).
 * ຄວາມຈິງ **3.5% (27/773 ໃບ ໃນ 180 ມື້)** ແລະ **19/27 ຄືຊ່າງຄົນເກົ່າ**.
 * ⇒ ນັບສະເພາະ S/N ທີ່ມີໂຕອັກສອນ/ໂຕເລກ ≥5 ຕົວ ແລະ ຈັດກຸ່ມ **S/N + ລູກຄ້າ**.
 */
export type RepeatRepair = {
  code: string;
  customer: string | null;
  product: string | null;
  sn: string;
  issue: string | null;
  tech: string | null;
  registered: string;
  /** ໃບກ່ອນໜ້າ (ເທື່ອທີ່ສ້ອມໄປແລ້ວ) */
  prev_code: string;
  prev_issue: string | null;
  prev_tech: string | null;
  prev_done: string;
  /** ກັບມາຫຼັງສ້ອມແລ້ວຈັກມື້ */
  days_after: number;
  /** ຊ່າງຄົນເກົ່າບໍ */
  same_tech: boolean;
};

/** ກັບມາພາຍໃນນີ້ = ຖືວ່າສ້ອມບໍ່ຫາຍ (ບໍ່ແມ່ນເສຍໃໝ່) */
export const REPEAT_DAYS = 60;

export async function repeatRepairs(days = 180): Promise<RepeatRepair[]> {
  return (
    await query<RepeatRepair>(
      `with r as (
         select a.code, a.sn, a.cust_code, a.name_1, a.p_brand, a.p_model, a.issue, a.emp_code,
             a.time_register, a.return_complete,
             lag(a.code) over w as prev_code,
             lag(a.issue) over w as prev_issue,
             lag(a.emp_code) over w as prev_tech,
             lag(a.return_complete) over w as prev_done
           from tb_product a
          where length(regexp_replace(coalesce(a.sn,''), '[^A-Za-z0-9]', '', 'g')) >= 5
            and a.cancel_start is null
         window w as (
           partition by upper(regexp_replace(a.sn, '[^A-Za-z0-9]', '', 'g')), a.cust_code
           order by a.time_register
         )
       )
       select r.code, c.name_1 as customer,
           concat_ws(' ', r.name_1, r.p_brand, r.p_model) as product,
           r.sn, nullif(r.issue,'') as issue, nullif(r.emp_code,'') as tech,
           to_char(r.time_register,'DD-MM-YYYY HH24:MI') as registered,
           r.prev_code, nullif(r.prev_issue,'') as prev_issue, nullif(r.prev_tech,'') as prev_tech,
           to_char(r.prev_done,'DD-MM-YYYY') as prev_done,
           round(extract(epoch from (r.time_register - r.prev_done))/86400)::int as days_after,
           (nullif(r.emp_code,'') is not distinct from nullif(r.prev_tech,'')) as same_tech
         from r
         left join ar_customer c on c.code = r.cust_code
        where r.prev_done is not null
          and r.time_register > r.prev_done
          and r.time_register - r.prev_done < interval '${REPEAT_DAYS} days'
          and r.time_register >= current_date - $1::int
        order by r.time_register desc`,
      [days],
    )
  ).rows;
}
