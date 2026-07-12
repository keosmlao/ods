import { query } from "@/lib/db";
import { contactMark, type ContactJob, type ContactKind } from "@/lib/customer-contact";
import { installStageIs } from "@/lib/install-stage";
import { STAGE_SQL } from "@/lib/stage";

/**
 * ຄິວແຈ້ງລູກຄ້າ — ຝັ່ງຖານຂໍ້ມູນ (ແຍກອອກຈາກ lib/customer-contact ທີ່ client ນຳໃຊ້).
 * ໄຟລ໌ໃດທີ່ import lib/db ຈະ **ຖືກໂຫຼດເຂົ້າ browser ບໍ່ໄດ້** ⇒ ຂໍ້ຄວາມແມ່ແບບ ແລະ
 * ຊື່ປະເພດ ຢູ່ຄົນລະໄຟລ໌ ຈຶ່ງໃຊ້ຮ່ວມກັນໄດ້ທັງສອງຝັ່ງ.
 */

/** ບັນທຶກການແຈ້ງຂອງໃບນັ້ນ — ນັບຈາກ chatter (ບໍ່ຕ້ອງມີຕາຕະລາງໃໝ່) */
const CONTACT_COLS = (model: string, kind: ContactKind) => `
  (select count(*)::int from ods_chatter_message m
    where m.model = '${model}' and m.res_id = a.code
      and m.body like '${contactMark(kind)}%') as contacts,
  (select to_char(max(m.created_at),'DD-MM-YYYY HH24:MI') from ods_chatter_message m
    where m.model = '${model}' and m.res_id = a.code
      and m.body like '${contactMark(kind)}%') as last_contact`;

const AGE = (col: string) => `greatest(0, round(extract(epoch from (localtimestamp - ${col}))))::int`;

/**
 * ① ລໍລູກຄ້າຕັດສິນລາຄາ — ຂັ້ນ 4 ຂອງຝັ່ງສ້ອມ (ອອກໃບສະເໜີລາຄາແລ້ວ ຍັງບໍ່ຈົບ)
 * ② ມາຮັບເຄື່ອງໄດ້ — ຂັ້ນ 11 (ຜ່ານ QC ແລ້ວ ລໍສົ່ງຄືນ)
 * ③ ຢືນຢັນວັນນັດ — ງານຕິດຕັ້ງທີ່ນັດພາຍໃນ 2 ມື້ຂ້າງໜ້າ ແລະ ຍັງບໍ່ໄດ້ຕິດຕັ້ງ
 */
export async function contactQueue(): Promise<ContactJob[]> {
  const [quote, pickup, appointment] = await Promise.all([
    query<ContactJob>(
      `select 'quote' as kind, a.code,
          c.name_1 as customer, c.tel, a.name_1 as product,
          to_char(a.qt_finish,'DD-MM-YYYY') as at,
          ${AGE("coalesce(a.qt_finish, a.time_finish_check, a.time_register)")} as waiting_seconds,
          ${CONTACT_COLS("tb_product", "quote")}
        from tb_product a left join ar_customer c on c.code = a.cust_code
       where (${STAGE_SQL}) = 4
       order by a.qt_finish asc nulls last`,
    ),
    query<ContactJob>(
      `select 'pickup' as kind, a.code,
          c.name_1 as customer, c.tel, a.name_1 as product,
          to_char(a.qc_finish,'DD-MM-YYYY') as at,
          ${AGE("coalesce(a.qc_finish, a.time_finish_repair)")} as waiting_seconds,
          ${CONTACT_COLS("tb_product", "pickup")}
        from tb_product a left join ar_customer c on c.code = a.cust_code
       where (${STAGE_SQL}) = 11
       order by a.qc_finish asc nulls last`,
    ),
    query<ContactJob>(
      `select 'appointment' as kind, a.code,
          c.name_1 as customer, c.tel, a.item_name as product,
          to_char(a.appoint_date,'DD-MM-YYYY') as at,
          ${AGE("a.time_register")} as waiting_seconds,
          ${CONTACT_COLS("ods_tb_install", "appointment")}
        from ods_tb_install a left join ar_customer c on c.code = a.cust_code
       where a.appoint_date is not null
         and a.appoint_date <= current_date + 2
         and a.start_install is null
         and not (${installStageIs(-1)})
       order by a.appoint_date asc`,
    ),
  ]);
  return [...quote.rows, ...pickup.rows, ...appointment.rows];
}
