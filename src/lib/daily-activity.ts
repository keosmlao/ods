import { query } from "@/lib/db";

/**
 * **ສະຫຼຸບການເຄື່ອນໄຫວປະຈຳວັນ** — ດຶງຈາກ `ods_chatter_message` ບ່ອນດຽວ.
 *
 * ທຸກການປ່ຽນຂັ້ນຂອງງານຂຽນ log ລົງ chatter ຢູ່ແລ້ວ (lib/chatter-log.logChange)
 * ພ້ອມກັບຂໍ້ຄວາມທີ່ຄົນພິມເອງ ⇒ ຕາຕະລາງນີ້ຄື "ໄດອາລີ່" ຂອງທັງລະບົບ:
 *   kind='log'     = ລະບົບບັນທຶກເອງຕອນວຽກຂ້າມຂັ້ນ (ຮັບງານ · ເລີ່ມ · ສຳເລັດ …)
 *   kind='comment' = ຄົນພິມ (ລວມທັງຊ່າງພິມຈາກແອັບ)
 *
 * ⚠️ ບໍ່ໃຊ້ ods_notification ເພາະແຖວມັນ **ຊ້ຳຕາມຈຳນວນຜູ້ຮັບ** (1 ເຫດການ = ຫຼາຍແຖວ)
 * ⇒ ນັບຍອດຈະເກີນຄວາມຈິງ. chatter ມີ 1 ແຖວ = 1 ເຫດການ.
 */

export type ActivityRow = {
  at: string;
  time: string;
  author: string;
  kind: string;
  doc: string;
  model: string;
  res_id: string;
  body: string;
};

export type PersonRow = { author: string; total: number; comments: number; logs: number };

const DOC_LABEL = `case m.model
  when 'tb_product'     then 'ໃບຮັບເຄື່ອງ'
  when 'ods_tb_install' then 'ງານຕິດຕັ້ງ'
  when 'ic_trans'       then 'ເອກະສານ ERP'
  when 'ar_customer'    then 'ລູກຄ້າ'
  else m.model end`;

/** ລາຍການເຄື່ອນໄຫວທັງໝົດໃນຊ່ວງວັນທີ່ (ໃໝ່ສຸດກ່ອນ) */
export async function activityFeed(from: string, to: string): Promise<ActivityRow[]> {
  return (
    await query<ActivityRow>(
      `select to_char(m.created_at,'DD-MM-YYYY') as at,
          to_char(m.created_at,'HH24:MI') as time,
          m.author, m.kind,
          ${DOC_LABEL} as doc,
          m.model, m.res_id, m.body
        from ods_chatter_message m
       where m.created_at::date between $1 and $2
       order by m.created_at desc, m.id desc`,
      [from, to],
    )
  ).rows;
}

/** ໃຜເຄື່ອນໄຫວຫຼາຍປານໃດ — ຫຼາຍສຸດກ່ອນ */
export async function activityByPerson(from: string, to: string): Promise<PersonRow[]> {
  return (
    await query<PersonRow>(
      `select m.author,
          count(*)::int as total,
          count(*) filter (where m.kind = 'comment')::int as comments,
          count(*) filter (where m.kind = 'log')::int as logs
        from ods_chatter_message m
       where m.created_at::date between $1 and $2
       group by m.author
       order by count(*) desc, m.author`,
      [from, to],
    )
  ).rows;
}
