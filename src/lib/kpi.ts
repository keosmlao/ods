import { query } from "@/lib/db";
import { SLA_SQL } from "@/lib/sla";

/**
 * **KPI ປະສິດທິພາບ — ຕິດຕັ້ງ ແລະ ສ້ອມແປງ.**
 *
 * ── ວັດຫຍັງ ແລະ ເປັນຫຍັງ ──
 * ຄຳຖາມທີ່ຜູ້ຈັດການຖາມແທ້ໆ ມີ 3 ຂໍ້: ງານໄຫຼໄດ້ດີບໍ · **ຄ້າງຢູ່ຂັ້ນໃດ** · ໃຜເຮັດໄດ້ເທົ່າໃດ.
 * ⇒ ໜ້ານີ້ບໍ່ໃຫ້ "ຄ່າສະເລ່ຍ" ລ້ວນໆ ແຕ່ແຍກ **ເວລາຕໍ່ຂັ້ນ** ເພື່ອຊີ້ຄໍຂວດ.
 *
 * ⚠️ ໃຊ້ **ມັດທະຍົມ (median)** ບໍ່ແມ່ນຄ່າສະເລ່ຍ — ງານທີ່ຄ້າງ 3 ເດືອນ 1 ງານ
 * ດຶງຄ່າສະເລ່ຍໃຫ້ຜິດຮູບໝົດ. ເສີມດ້ວຍ p90 ("ງານຊ້າສຸດ 10% ໃຊ້ເວລາເທົ່າໃດ").
 *
 * ຂໍ້ມູນຈິງ (180 ມື້): ຕິດຕັ້ງ ລວມ 50.8 ຊມ ໃນນັ້ນ **ລໍຊ່າງຮັບງານ 42.5 ຊມ** (84%) ·
 * ສ້ອມ ລວມ 90.3 ຊມ ໃນນັ້ນ **ລໍກວດເຊັກ 23.9 ຊມ** ⇒ ຄໍຂວດບໍ່ໄດ້ຢູ່ຕອນລົງມືເຮັດ.
 */

/** ໄລຍະທີ່ເບິ່ງ (ມື້) */
export type Period = 30 | 90 | 180 | 365;

export type StageTime = { label: string; median: number; p90: number };

export type FlowKpi = {
  /** ງານທີ່ເປີດ/ຮັບເຂົ້າໃນໄລຍະ */
  opened: number;
  /** ງານທີ່ປິດໃນໄລຍະ */
  closed: number;
  /** ຍັງດຳເນີນຢູ່ດຽວນີ້ (ບໍ່ອີງໄລຍະ) */
  open_now: number;
  /** ຄ້າງເກີນກຳນົດ (ຕິດຕັ້ງ: ເລີຍວັນນັດ · ສ້ອມ: ເກີນ SLA ຂອງຂັ້ນກວດເຊັກ) */
  overdue: number;
  /** ຊົ່ວໂມງລວມຕໍ່ງານ (median · p90) */
  total: StageTime;
  /** ເວລາຕໍ່ຂັ້ນ — ຂັ້ນທີ່ໃຊ້ເວລາຫຼາຍສຸດຄືຄໍຂວດ */
  stages: StageTime[];
};

export type TechKpi = {
  tech: string;
  install_done: number;
  repair_done: number;
  /** ຊົ່ວໂມງມັດທະຍົມ ຈາກ "ຮັບງານ" ຫາ "ຈົບງານ" (ທັງສອງຝັ່ງລວມກັນ) */
  median_hours: number;
  /** ປະຕິເສດງານຈັກເທື່ອ (ods_job_reject) */
  rejects: number;
  /** QC ບໍ່ຜ່ານຈັກຄັ້ງ */
  qc_failed: number;
};

/**
 * median + p90 ຂອງໄລຍະຫ່າງສອງໂມງ (ຊົ່ວໂມງ) — ອອກ **2 ຖັນ**: `<name>` ແລະ `<name>_p90`.
 * median ບອກ "ງານທຳມະດາໃຊ້ເວລາເທົ່າໃດ" · p90 ບອກ "ງານຊ້າສຸດ 10% ໃຊ້ເວລາເທົ່າໃດ"
 * (ຄ່າສະເລ່ຍຖືກງານທີ່ຄ້າງ 3 ເດືອນ 1 ງານ ດຶງໃຫ້ຜິດຮູບໝົດ).
 */
const gap = (name: string, from: string, to: string) => {
  const hours = `extract(epoch from (${to} - ${from}))/3600`;
  return `round(percentile_cont(0.5) within group (order by ${hours})::numeric, 1)::float as ${name},
      round(percentile_cont(0.9) within group (order by ${hours})::numeric, 1)::float as ${name}_p90`;
};

export async function installKpi(days: Period): Promise<FlowKpi> {
  const row = (
    await query<Record<string, number>>(
      `select
         (select count(*)::int from ods_tb_install
           where time_register >= current_date - ($1::int) and cancel_date is null) as opened,
         (select count(*)::int from ods_tb_install
           where job_finish >= current_date - ($1::int)) as closed,
         (select count(*)::int from ods_tb_install
           where job_finish is null and cancel_date is null) as open_now,
         -- ເລີຍວັນນັດ ແຕ່ຍັງບໍ່ຕິດຕັ້ງສຳເລັດ = ລູກຄ້າຖືກຜິດນັດ
         (select count(*)::int from ods_tb_install
           where appoint_date < current_date and finish_install is null
             and job_finish is null and cancel_date is null) as overdue,
         t.* from (
        select ${gap("total", "time_register", "job_finish")},
            ${gap("assign", "time_register", "coalesce(assigt_time, tech_confirm)")},
            ${gap("accept", "coalesce(assigt_time, time_register)", "tech_confirm")},
            ${gap("ready", "tech_confirm", "start_install")},
            ${gap("work", "start_install", "finish_install")},
            ${gap("qc", "finish_install", "qc_finish")},
            ${gap("close", "qc_finish", "job_finish")}
          from ods_tb_install
         where job_finish >= current_date - ($1::int) and cancel_date is null
       ) t`,
      [days],
    )
  ).rows[0];

  return {
    opened: Number(row?.opened ?? 0),
    closed: Number(row?.closed ?? 0),
    open_now: Number(row?.open_now ?? 0),
    overdue: Number(row?.overdue ?? 0),
    total: { label: "ລວມທັງໝົດ", median: Number(row?.total ?? 0), p90: Number(row?.total_p90 ?? 0) },
    stages: [
      { label: "ລໍຈັດຊ່າງ", median: Number(row?.assign ?? 0), p90: Number(row?.assign_p90 ?? 0) },
      { label: "ລໍຊ່າງຮັບງານ", median: Number(row?.accept ?? 0), p90: Number(row?.accept_p90 ?? 0) },
      { label: "ຮັບງານ → ເລີ່ມຕິດຕັ້ງ (ອາໄຫຼ່)", median: Number(row?.ready ?? 0), p90: Number(row?.ready_p90 ?? 0) },
      { label: "ກຳລັງຕິດຕັ້ງ", median: Number(row?.work ?? 0), p90: Number(row?.work_p90 ?? 0) },
      { label: "ລໍກວດຮັບຄຸນນະພາບ", median: Number(row?.qc ?? 0), p90: Number(row?.qc_p90 ?? 0) },
      { label: "ລໍປິດງານ", median: Number(row?.close ?? 0), p90: Number(row?.close_p90 ?? 0) },
    ],
  };
}

export async function repairKpi(days: Period): Promise<FlowKpi> {
  const row = (
    await query<Record<string, number>>(
      `select
         (select count(*)::int from tb_product
           where time_register >= current_date - ($1::int) and cancel_start is null) as opened,
         (select count(*)::int from tb_product
           where return_complete >= current_date - ($1::int)) as closed,
         (select count(*)::int from tb_product
           where return_complete is null and cancel_start is null) as open_now,
         -- ເກີນກຳນົດເວລາຂອງຂັ້ນກວດເຊັກ (lib/sla — CI/ST 2 ຊມ · IH/PS 12 ຊມ)
         (select count(*)::int from tb_product a
           where a.time_finish_check is null and a.cancel_start is null
             and (${SLA_SQL}) is not null
             and extract(epoch from (localtimestamp - a.time_register)) > (${SLA_SQL})) as overdue,
         t.* from (
        select ${gap("total", "time_register", "return_complete")},
            ${gap("wait_check", "time_register", "time_check")},
            ${gap("check_work", "time_check", "time_finish_check")},
            ${gap("wait_repair", "time_finish_check", "coalesce(time_repair, time_finish_check)")},
            ${gap("repair_work", "time_repair", "time_finish_repair")},
            ${gap("qc", "time_finish_repair", "qc_finish")},
            ${gap("handover", "qc_finish", "return_complete")}
          from tb_product
         where return_complete >= current_date - ($1::int) and cancel_start is null
       ) t`,
      [days],
    )
  ).rows[0];

  return {
    opened: Number(row?.opened ?? 0),
    closed: Number(row?.closed ?? 0),
    open_now: Number(row?.open_now ?? 0),
    overdue: Number(row?.overdue ?? 0),
    total: { label: "ລວມທັງໝົດ", median: Number(row?.total ?? 0), p90: Number(row?.total_p90 ?? 0) },
    stages: [
      { label: "ລໍກວດເຊັກ", median: Number(row?.wait_check ?? 0), p90: Number(row?.wait_check_p90 ?? 0) },
      { label: "ກຳລັງກວດເຊັກ", median: Number(row?.check_work ?? 0), p90: Number(row?.check_work_p90 ?? 0) },
      { label: "ລໍສ້ອມ (ລາຄາ/ອາໄຫຼ່)", median: Number(row?.wait_repair ?? 0), p90: Number(row?.wait_repair_p90 ?? 0) },
      { label: "ກຳລັງສ້ອມ", median: Number(row?.repair_work ?? 0), p90: Number(row?.repair_work_p90 ?? 0) },
      { label: "ລໍກວດຮັບຄຸນນະພາບ", median: Number(row?.qc ?? 0), p90: Number(row?.qc_p90 ?? 0) },
      { label: "ລໍສົ່ງເຄື່ອງ/ຮັບເງິນ", median: Number(row?.handover ?? 0), p90: Number(row?.handover_p90 ?? 0) },
    ],
  };
}

/** ຜົນງານຕໍ່ຊ່າງ — ນັບງານທີ່ **ຈົບແລ້ວ** ໃນໄລຍະ (ບໍ່ນັບງານທີ່ຍັງຄ້າງ) */
export async function technicianKpi(days: Period): Promise<TechKpi[]> {
  return (
    await query<TechKpi>(
      `with done as (
         select nullif(tech_code,'') as tech, 'install' as workflow,
             extract(epoch from (finish_install - tech_confirm))/3600 as hours
           from ods_tb_install
          where finish_install >= current_date - ($1::int) and cancel_date is null and nullif(tech_code,'') is not null
         union all
         select nullif(emp_code,''), 'repair',
             extract(epoch from (time_finish_repair - time_repair))/3600
           from tb_product
          where time_finish_repair >= current_date - ($1::int) and cancel_start is null and nullif(emp_code,'') is not null
       )
       select d.tech,
           count(*) filter (where d.workflow = 'install')::int as install_done,
           count(*) filter (where d.workflow = 'repair')::int as repair_done,
           round(percentile_cont(0.5) within group (order by d.hours)::numeric, 1)::float as median_hours,
           (select count(*)::int from ods_job_reject r
             where r.tech_code = d.tech and r.created_at >= current_date - ($1::int)) as rejects,
           (select count(*)::int from ods_qc_result q
             where q.job_code in (
                 select code from ods_tb_install where tech_code = d.tech
                 union all select code from tb_product where emp_code = d.tech)
               and q.passed = false and q.checked_at >= current_date - ($1::int)) as qc_failed
         from done d
        group by d.tech
        order by (count(*) filter (where d.workflow = 'install') + count(*) filter (where d.workflow = 'repair')) desc`,
      [days],
    )
  ).rows;
}
