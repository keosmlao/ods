import type { Workflow } from "@/lib/commission";
import { query } from "@/lib/db";
import { INSTALL_ELAPSED_SQL, installStageIs } from "@/lib/install-stage";
import { STAGE_ELAPSED_SQL, STAGE_SQL } from "@/lib/stage";

/**
 * ຄິວກວດຮັບຄຸນນະພາບ — ງານທີ່ຊ່າງກົດ "ສຳເລັດ" ແລ້ວ ແຕ່ຍັງບໍ່ຜ່ານ QC.
 *
 * ເງື່ອນໄຂ **ຄັດລອກມາຈາກຂັ້ນໄດບ່ອນດຽວ** (installStageIs / STAGE_SQL) ບໍ່ໄດ້ຂຽນ
 * `qc_finish is null and finish_install is not null` ດ້ວຍມື — ບໍ່ດັ່ງນັ້ນມື້ໜ້າ
 * ຂັ້ນໄດປ່ຽນ ຄິວນີ້ຈະບໍ່ຕົງກັບຕົວເລກຢູ່ໜ້າ dashboard ຢ່າງງຽບໆ.
 *
 * ຝັ່ງຕິດຕັ້ງ = ຂັ້ນ 6 · ຝັ່ງສ້ອມ = ຂັ້ນ 10 (ເບິ່ງ lib/install-stage, lib/stage)
 */

export type QcQueueRow = {
  code: string;
  customer: string | null;
  item: string | null;
  detail: string | null;
  /** ຄົນທີ່ເຮັດງານ — ຜູ້ນີ້ກວດຮັບງານຕົນເອງບໍ່ໄດ້ */
  worker: string | null;
  finished_at: string | null;
  elapsed_seconds: number | null;
  /** ກວດໄປແລ້ວຈັກຂໍ້ (ເປີດຄ້າງໄວ້ແລ້ວກັບມາເຮັດຕໍ່ໄດ້) */
  checked: number;
};

const CHECKED_SQL = (workflow: Workflow) =>
  `(select count(*)::int from ods_qc_result r where r.workflow = '${workflow}' and r.job_code = a.code)`;

/** ຄິວ QC — ໃສ່ `code` ເພື່ອເອົາງານດຽວ (ຄືນແຖວຫວ່າງ ຖ້າງານນັ້ນອອກຈາກຂັ້ນ QC ໄປແລ້ວ) */
export async function qcQueue(workflow: Workflow, code?: string): Promise<QcQueueRow[]> {
  const only = code ? "and a.code = $1" : "";
  const params = code ? [code] : [];

  if (workflow === "install") {
    return (
      await query<QcQueueRow>(
        `select a.code,
            concat_ws('-', c.name_1, c.tel) as customer,
            a.item_name as item,
            concat_ws(' ', a.pro_brand, a.pro_model) as detail,
            nullif(a.tech_code,'') as worker,
            to_char(a.finish_install,'DD-MM-YYYY HH24:MI') as finished_at,
            ${INSTALL_ELAPSED_SQL} as elapsed_seconds,
            ${CHECKED_SQL("install")} as checked
          from ods_tb_install a
          left join ar_customer c on c.code = a.cust_code
         where ${installStageIs(6)} ${only}
         order by a.finish_install asc nulls last`,
        params,
      )
    ).rows;
  }
  return (
    await query<QcQueueRow>(
      `select a.code,
          concat_ws('-', b.name_1, b.tel) as customer,
          a.name_1 as item,
          concat_ws(' ', a.p_brand, a.p_model) as detail,
          nullif(a.emp_code,'') as worker,
          to_char(a.time_finish_repair,'DD-MM-YYYY HH24:MI') as finished_at,
          ${STAGE_ELAPSED_SQL} as elapsed_seconds,
          ${CHECKED_SQL("repair")} as checked
        from tb_product a
        left join ar_customer b on b.code = a.cust_code
       where (${STAGE_SQL}) = 10 ${only}
       order by a.time_finish_repair asc nulls last`,
      params,
    )
  ).rows;
}

export const WORKFLOW_LABEL: Record<Workflow, string> = { install: "ຕິດຕັ້ງ", repair: "ສ້ອມແປງ" };

/** ງານດຽວ — null ຖ້າງານບໍ່ຢູ່ຂັ້ນ QC ອີກແລ້ວ (ກັນເປີດລິ້ງເກົ່າແລ້ວກວດຊ້ຳ) */
export async function qcJob(workflow: Workflow, code: string): Promise<QcQueueRow | null> {
  return (await qcQueue(workflow, code))[0] ?? null;
}
