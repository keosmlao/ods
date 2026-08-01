import { ASSIGNEES_SQL } from "@/lib/activity-assignee";
import { query } from "@/lib/db";

/**
 * ── ກິດຈະກຳທັງໝົດ ສຳລັບຜູ້ຈັດການ (ແອັບ) ──
 *
 * CS ນັດກິດຈະກຳໃສ່ໃບງານ (ໂທຫາລູກຄ້າ · ໄປພົບ · ນັດປະຊຸມ) ແຕ່ຜູ້ຈັດການ **ບໍ່ມີບ່ອນ
 * ເຫັນມັນຢູ່ແອັບເລີຍ** — ຕ້ອງເປີດເວັບເປັນໃບໆ. ໜ້ານີ້ລວມທຸກອັນທີ່ຍັງບໍ່ປິດ
 * ພ້ອມ **ຜູ້ຮັບຜິດຊອບທຸກຄົນ** ແລະ ບອກວ່າອັນໃດເລີຍກຳນົດແລ້ວ.
 */
export type MobileActivity = {
  id: number;
  model: string;
  res_id: string;
  kind: string;
  summary: string;
  note: string | null;
  /** ຜູ້ຮັບຜິດຊອບທຸກຄົນ ຄັ່ນດ້ວຍ ", " */
  assigned_to: string;
  due_date: string | null;
  created_by: string;
  /** ຕິດລົບ = ເລີຍກຳນົດແລ້ວ */
  days_left: number;
  /** ຊື່ເຄື່ອງ/ລູກຄ້າ ຂອງໃບງານທີ່ຜູກຢູ່ — ໃຫ້ຮູ້ວ່າກ່ຽວກັບໃບໃດ */
  job_title: string | null;
  customer: string | null;
  /** repair | install — ໃຫ້ແອັບເປີດໜ້າໃບງານຖືກສາຍ */
  workflow: "repair" | "install";
};

export async function mobileActivities(): Promise<{ items: MobileActivity[]; late: number }> {
  const rows = (
    await query<MobileActivity>(
      `select a.id, a.model, a.res_id, a.kind, a.summary, a.note,
          ${ASSIGNEES_SQL("a")} assigned_to,
          to_char(a.due_date,'DD-MM-YYYY') due_date, a.created_by,
          (a.due_date - current_date)::int days_left,
          -- ຫົວຂໍ້ໃບງານ: ຝັ່ງສ້ອມຢູ່ tb_product · ຝັ່ງຕິດຕັ້ງຢູ່ ods_tb_install
          case when a.model = 'ods_tb_install'
               then (select i.item_name from ods_tb_install i where i.code = a.res_id)
               else (select p.name_1 from tb_product p where p.code = a.res_id) end job_title,
          case when a.model = 'ods_tb_install'
               then (select c.name_1 from ods_tb_install i
                      left join ar_customer c on c.code = i.cust_code where i.code = a.res_id)
               else (select c.name_1 from tb_product p
                      left join ar_customer c on c.code = p.cust_code where p.code = a.res_id) end customer,
          case when a.model = 'ods_tb_install' then 'install' else 'repair' end workflow
         from ods_activity a
        where a.state = 'planned'
        order by a.due_date`,
    )
  ).rows;

  return { items: rows, late: rows.filter((row) => row.days_left < 0).length };
}
