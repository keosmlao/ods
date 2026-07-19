import { query } from "@/lib/db";
import {
  REPAIR_SERVICE_TYPES,
  REPAIR_STAGE_OVERDUE_SQL,
  REPAIR_STAGE_POLICIES,
  type RepairServiceType,
} from "@/lib/repair-sla";

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

/**
 * ── ເປົ້າໝາຍ: **ຕິດຕັ້ງແລ້ວພາຍໃນ 24 ຊົ່ວໂມງ ນັບແຕ່ອອກບິນ** (ນະໂຍບາຍ 13-07-2026) ──
 * ນັບຈາກ **ວັນທີບິນ** (ods_tb_install.doc_ref_date) ບໍ່ແມ່ນຈາກວັນເປີດໃບງານ —
 * ເພາະລູກຄ້າເລີ່ມລໍຕັ້ງແຕ່ຕອນຈ່າຍເງິນ ບໍ່ແມ່ນຕອນ CS ຫາກໍ່ນຶກໄດ້ວ່າຕ້ອງເປີດງານ.
 *
 * ຂໍ້ມູນຈິງ (90 ມື້, 773 ງານ): ເຮັດໄດ້ພຽງ **1.7%** · ມັດທະຍົມ **81.5 ຊມ (3.4 ມື້)**
 * ແລະ ເວລາຫາຍໄປຢູ່: ອອກບິນ→ເປີດໃບງານ 15.7 ຊມ · ເປີດງານ→ຈັດຊ່າງ 44.1 ຊມ ·
 * ລໍຊ່າງຮັບ 44.1 ຊມ · ຮັບແລ້ວ→ຕິດແລ້ວ ~0 ຊມ (ຊ່າງເຮັດໄວ — ຄໍຂວດຢູ່ກ່ອນໜ້ານັ້ນ).
 */
export const INSTALL_TARGET_HOURS = 24;

export type FlowKpi = {
  /** ງານທີ່ເປີດ/ຮັບເຂົ້າໃນໄລຍະ */
  opened: number;
  /** ງານທີ່ປິດໃນໄລຍະ */
  closed: number;
  /** ຍັງດຳເນີນຢູ່ດຽວນີ້ (ບໍ່ອີງໄລຍະ) */
  open_now: number;
  /** ຄ້າງເກີນກຳນົດ (ຕິດຕັ້ງ: ເລີຍວັນນັດ · ສ້ອມ: ເກີນ SLA ຂອງຂັ້ນປັດຈຸບັນ) */
  overdue: number;
  /** ຊົ່ວໂມງລວມຕໍ່ງານ (median · p90) */
  total: StageTime;
  /** ເວລາຕໍ່ຂັ້ນ — ຂັ້ນທີ່ໃຊ້ເວລາຫຼາຍສຸດຄືຄໍຂວດ */
  stages: StageTime[];
  /** ເປົ້າໝາຍ 24 ຊມ ນັບແຕ່ອອກບິນ (ສະເພາະຝັ່ງຕິດຕັ້ງ) */
  target?: { done: number; total: number; pct: number; median: number };
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

export type RepairSlaCompliance = {
  stage: number;
  service_type: RepairServiceType;
  total: number;
  within_sla: number;
  pct: number;
};

/** ຈຸດເລີ່ມ/ຈົບທີ່ວັດ SLA ຈິງຂອງແຕ່ລະຂັ້ນ. */
const REPAIR_STAGE_PERIOD: Record<number, { start: string; finish: string }> = {
  1: { start: "a.time_register", finish: "a.time_check" },
  2: { start: "a.time_check", finish: "a.time_finish_check" },
  3: { start: "a.time_finish_check", finish: "a.qt_start" },
  4: { start: "a.qt_start", finish: "a.qt_finish" },
  5: { start: "coalesce(a.qt_finish,a.time_finish_check)", finish: "coalesce(a.spare_order,a.spare_reg)" },
  6: { start: "a.spare_reg", finish: "case when a.spare_order is not null then a.spare_order else a.spare_finish end" },
  7: { start: "a.spare_order", finish: "a.spare_arrive" },
  8: { start: "coalesce(a.spare_finish,a.qt_finish,a.time_finish_check)", finish: "a.time_repair" },
  9: { start: "a.time_repair", finish: "a.time_finish_repair" },
  10: { start: "a.time_finish_repair", finish: "a.qc_finish" },
  11: { start: "a.qc_finish", finish: "a.return_complete" },
};

/** ອັດຕາທີ່ຈົບແຕ່ລະຂັ້ນພາຍໃນ SLA — ແຍກ CI/ST/IH/PS. */
export async function repairSlaCompliance(days: Period): Promise<RepairSlaCompliance[]> {
  const branches = REPAIR_STAGE_POLICIES.flatMap((policy) => {
    const period = REPAIR_STAGE_PERIOD[policy.stage];
    if (!period) return [];
    return REPAIR_SERVICE_TYPES.map((serviceType) => {
      const duration = `extract(epoch from (${period.finish} - ${period.start}))`;
      return `select ${policy.stage}::int stage, '${serviceType}'::text service_type,
          count(*)::int total,
          count(*) filter (where ${duration} between 0 and ${policy.hours[serviceType] * 3600})::int within_sla
        from tb_product a
       where a.status <> 6 and a.service_type='${serviceType}'
         and ${period.start} is not null and ${period.finish} is not null
         and ${period.finish} >= current_date - ($1::int)`;
    });
  });

  const rows = (await query<Omit<RepairSlaCompliance, "pct">>(branches.join(" union all "), [days])).rows;
  return rows.map((row) => ({
    ...row,
    total: Number(row.total),
    within_sla: Number(row.within_sla),
    pct: Number(row.total) ? Math.round((Number(row.within_sla) / Number(row.total)) * 1000) / 10 : 0,
  }));
}

/**
 * median + p90 ຂອງໄລຍະຫ່າງສອງໂມງ (ຊົ່ວໂມງ) — ອອກ **2 ຖັນ**: `<name>` ແລະ `<name>_p90`.
 * median ບອກ "ງານທຳມະດາໃຊ້ເວລາເທົ່າໃດ" · p90 ບອກ "ງານຊ້າສຸດ 10% ໃຊ້ເວລາເທົ່າໃດ"
 * (ຄ່າສະເລ່ຍຖືກງານທີ່ຄ້າງ 3 ເດືອນ 1 ງານ ດຶງໃຫ້ຜິດຮູບໝົດ).
 */
const gap = (name: string, from: string, to: string) => {
  // ຂໍ້ມູນເກົ່າບາງໃບມີ timestamp ກັບລຳດັບ. ຄ່າຕິດລົບບໍ່ແມ່ນເວລາເຮັດວຽກ ຈຶ່ງບໍ່ນຳໄປບິດ median/p90.
  const hours = `case when ${from} is not null and ${to} is not null and ${to} >= ${from}
    then extract(epoch from (${to} - ${from}))/3600 end`;
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
         -- ເປົ້າໝາຍ: ຕິດຕັ້ງແລ້ວພາຍໃນ 24 ຊມ ນັບແຕ່ **ອອກບິນ**
         (select count(*)::int from ods_tb_install
           where finish_install >= current_date - ($1::int) and cancel_date is null
             and doc_ref_date is not null) as target_total,
         (select count(*)::int from ods_tb_install
           where finish_install >= current_date - ($1::int) and cancel_date is null
             and doc_ref_date is not null
             and finish_install <= doc_ref_date + interval '${INSTALL_TARGET_HOURS} hours') as target_done,
         (select round(percentile_cont(0.5) within group (
                   order by extract(epoch from (finish_install - doc_ref_date))/3600)::numeric, 1)::float
            from ods_tb_install
           where finish_install >= current_date - ($1::int) and cancel_date is null
             and doc_ref_date is not null) as target_median,
         t.* from (
        select ${gap("total", "doc_ref_date", "job_finish")},
            ${gap("open", "doc_ref_date", "time_register")},
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
    total: { label: "ອອກບິນ → ປິດງານ", median: Number(row?.total ?? 0), p90: Number(row?.total_p90 ?? 0) },
    target: {
      done: Number(row?.target_done ?? 0),
      total: Number(row?.target_total ?? 0),
      pct: Number(row?.target_total ?? 0)
        ? Math.round((Number(row?.target_done ?? 0) / Number(row?.target_total ?? 0)) * 1000) / 10
        : 0,
      median: Number(row?.target_median ?? 0),
    },
    stages: [
      // ເວລານີ້ບໍ່ເຄີຍຖືກນັບມາກ່ອນ — ລູກຄ້າລໍຢູ່ ໂດຍທີ່ລະບົບຍັງບໍ່ຮູ້ຈັກງານນີ້ດ້ວຍຊ້ຳ
      { label: "ອອກບິນ → ເປີດໃບງານ", median: Number(row?.open ?? 0), p90: Number(row?.open_p90 ?? 0) },
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
         -- ເກີນ SLA ຂອງຂັ້ນປັດຈຸບັນ ແລະປະເພດ CI/ST/IH/PS (lib/repair-sla)
         (select count(*)::int from tb_product a
           where a.return_complete is null and a.status <> 6
             and (${REPAIR_STAGE_OVERDUE_SQL})) as overdue,
         t.* from (
        select ${gap("total", "time_register", "return_complete")},
            ${gap("accept", "time_register", "repair_confirm")},
            ${gap("start_check", "coalesce(repair_confirm, time_register)", "time_check")},
            ${gap("check_work", "time_check", "time_finish_check")},
            ${gap("wait_quote", "time_finish_check", "qt_start")},
            ${gap("quote", "qt_start", "qt_finish")},
            ${gap("request_spare", "coalesce(qt_finish, time_finish_check)", "coalesce(spare_order,spare_reg)")},
            ${gap("after_purchase_request", "spare_arrive", "spare_reg")},
            ${gap("stock", "spare_reg", "coalesce(spare_finish, spare_arrive)")},
            ${gap("purchase", "spare_order", "spare_arrive")},
            ${gap("wait_repair", "coalesce(spare_finish, qt_finish, time_finish_check)", "time_repair")},
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
      { label: "ລໍຊ່າງຮັບງານ", median: Number(row?.accept ?? 0), p90: Number(row?.accept_p90 ?? 0) },
      { label: "ຮັບງານ → ເລີ່ມກວດ", median: Number(row?.start_check ?? 0), p90: Number(row?.start_check_p90 ?? 0) },
      { label: "ກຳລັງກວດເຊັກ", median: Number(row?.check_work ?? 0), p90: Number(row?.check_work_p90 ?? 0) },
      { label: "ລໍສ້າງໃບສະເໜີລາຄາ", median: Number(row?.wait_quote ?? 0), p90: Number(row?.wait_quote_p90 ?? 0) },
      { label: "ຈັດທຳ/ອະນຸມັດລາຄາ", median: Number(row?.quote ?? 0), p90: Number(row?.quote_p90 ?? 0) },
      { label: "ກວດ Stock / ສ້າງໃບຊື້ຫຼືຂໍເບີກ", median: Number(row?.request_spare ?? 0), p90: Number(row?.request_spare_p90 ?? 0) },
      { label: "ຮັບເຂົ້າສາງ → ສ້າງໃບຂໍເບີກ", median: Number(row?.after_purchase_request ?? 0), p90: Number(row?.after_purchase_request_p90 ?? 0) },
      { label: "ສາງຈ່າຍອາໄຫຼ່", median: Number(row?.stock ?? 0), p90: Number(row?.stock_p90 ?? 0) },
      { label: "ຈັດຊື້/ລໍອາໄຫຼ່ເຂົ້າ", median: Number(row?.purchase ?? 0), p90: Number(row?.purchase_p90 ?? 0) },
      { label: "ອາໄຫຼ່ພ້ອມ → ເລີ່ມສ້ອມ", median: Number(row?.wait_repair ?? 0), p90: Number(row?.wait_repair_p90 ?? 0) },
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


export type TechSla = {
  tech: string;
  /** ຈຳນວນຂັ້ນທີ່ວັດໄດ້ (ກວດເຊັກ + ສ້ອມ ຂອງໃບທີ່ຈົບຂັ້ນນັ້ນໃນໄລຍະ) */
  total: number;
  within_sla: number;
  late: number;
  pct: number;
};

/**
 * **ອັດຕາທັນເວລາ (SLA) ຕໍ່ຊ່າງ** — ວັດສະເພາະຂັ້ນທີ່ຊ່າງລົງມືເອງ: **ກວດເຊັກ (2) + ສ້ອມ (9)**.
 * ໃຊ້ SLA ອັນດຽວກັບ repairSlaCompliance (REPAIR_STAGE_POLICIES ຕໍ່ປະເພດບໍລິການ) ແຕ່ຈັດຕາມ emp_code
 * ⇒ ບໍ່ຫັກຊ່າງຈາກຂັ້ນທີ່ຄົນອື່ນຮັບຜິດຊອບ (ສະເໜີລາຄາ/ສາງ/ອະນຸມັດ).
 */
export async function technicianSla(days: Period): Promise<TechSla[]> {
  const TECH_STAGES = [2, 9];
  const branches = TECH_STAGES.flatMap((stage) => {
    const policy = REPAIR_STAGE_POLICIES.find((p) => p.stage === stage);
    const period = REPAIR_STAGE_PERIOD[stage];
    if (!policy || !period) return [];
    return REPAIR_SERVICE_TYPES.map((serviceType) => {
      const duration = `extract(epoch from (${period.finish} - ${period.start}))`;
      return `select nullif(a.emp_code,'') as tech,
          (${duration} between 0 and ${policy.hours[serviceType] * 3600}) as ontime
        from tb_product a
       where a.status <> 6 and a.service_type = '${serviceType}' and nullif(a.emp_code,'') is not null
         and ${period.start} is not null and ${period.finish} is not null
         and ${period.finish} >= current_date - ($1::int)`;
    });
  });
  const rows = (
    await query<{ tech: string; total: number; within_sla: number; late: number }>(
      `select tech, count(*)::int total,
          count(*) filter (where ontime)::int within_sla,
          count(*) filter (where not ontime)::int late
        from (${branches.join(" union all ")}) x
        group by tech
        having count(*) > 0
        order by count(*) desc`,
      [days],
    )
  ).rows;
  return rows.map((row) => ({
    tech: row.tech,
    total: Number(row.total),
    within_sla: Number(row.within_sla),
    late: Number(row.late),
    pct: Number(row.total) ? Math.round((Number(row.within_sla) / Number(row.total)) * 1000) / 10 : 0,
  }));
}

export type TechServiceMix = { tech: string; ci: number; st: number; ih: number; ps: number; total: number };

/**
 * **ງານສ້ອມຕໍ່ຊ່າງ ແຍກປະເພດບໍລິການ** — ຮັບຮູ້ໃຜເຮັດງານໄປສ້ອມບ້ານ (IH) / ໄປຮັບ (PS) ຫຼາຍ
 * ທຽບກັບງານຢູ່ສູນ (CI/ST). ນັບໃບທີ່ **ສ້ອມສຳເລັດ** ໃນໄລຍະ (time_finish_repair) ຕໍ່ emp_code.
 */
export async function technicianServiceMix(days: Period): Promise<TechServiceMix[]> {
  return (
    await query<TechServiceMix>(
      `select nullif(emp_code,'') as tech,
          count(*) filter (where service_type='CI')::int as ci,
          count(*) filter (where service_type='ST')::int as st,
          count(*) filter (where service_type='IH')::int as ih,
          count(*) filter (where service_type='PS')::int as ps,
          count(*)::int as total
        from tb_product
       where time_finish_repair >= current_date - ($1::int) and cancel_start is null and nullif(emp_code,'') is not null
       group by nullif(emp_code,'')
       having count(*) > 0
       order by count(*) desc`,
      [days],
    )
  ).rows.map((row) => ({
    tech: row.tech,
    ci: Number(row.ci),
    st: Number(row.st),
    ih: Number(row.ih),
    ps: Number(row.ps),
    total: Number(row.total),
  }));
}

/**
 * **ຄຸນນະພາບ** — ໄວຢ່າງດຽວບໍ່ພຽງພໍ. ງານທີ່ໄວແຕ່ຕ້ອງກັບມາສ້ອມຊ້ຳ = ຂາດທຶນສອງເທື່ອ.
 */
export type QualityKpi = {
  /** ລູກຄ້າຕອບແບບສອບຖາມຈັກງານ (ຝັ່ງຕິດຕັ້ງ — ຝັ່ງສ້ອມຍັງບໍ່ໄດ້ເກັບ) */
  feedback_jobs: number;
  /** ຄະແນນສະເລ່ຍ — **1 = ດີສຸດ · 4 = ຮ້າຍສຸດ** (ນິຍາມດຽວກັບ lib/dashboard) */
  feedback_avg: number;
  /** ງານທີ່ລູກຄ້າໃຫ້ຄະແນນ ≥3 (ບໍ່ພໍໃຈ) */
  feedback_unhappy: number;
  /** ເຄື່ອງທີ່ **ກັບມາສ້ອມຊ້ຳ** ພາຍໃນ 60 ມື້ (S/N ດຽວກັນ) — ຕົວຊີ້ວັດຄຸນນະພາບການສ້ອມ */
  repeat_repairs: number;
  /** ໃບສ້ອມທັງໝົດທີ່ມີ S/N ໃນໄລຍະ (ຕົວຫານຂອງອັດຕາສ້ອມຊ້ຳ) */
  repair_with_sn: number;
  /** ຂໍ້ກວດ QC ທີ່ບັນທຶກ · ງານທີ່ມີຂໍ້ບົກຜ່ອງ · ງານທີ່ຖືກປະຕິເສດໂດຍຊ່າງ */
  qc_answers: number;
  qc_failed_jobs: number;
  rejects: number;
};

/** ເຄື່ອງທີ່ກັບມາສ້ອມຊ້ຳພາຍໃນ 60 ມື້ = ສ້ອມບໍ່ຫາຍແຕ່ເທື່ອທຳອິດ */
const REPEAT_DAYS = 60;

export async function qualityKpi(days: Period): Promise<QualityKpi> {
  const row = (
    await query<Record<string, number>>(
      `select
         (select count(distinct product_code)::int from cust_complain
           where create_date_time_now >= current_date - ($1::int)) as feedback_jobs,
         (select round(avg(points)::numeric, 2)::float from cust_complain
           where create_date_time_now >= current_date - ($1::int)) as feedback_avg,
         -- ຄະແນນ ≥3 = ບໍ່ພໍໃຈ (1 = ດີສຸດ) — ນິຍາມດຽວກັບ lib/dashboard
         (select count(distinct product_code)::int from cust_complain
           where create_date_time_now >= current_date - ($1::int) and points >= 3) as feedback_unhappy,
         (select count(*)::int from ods_qc_result
           where checked_at >= current_date - ($1::int)) as qc_answers,
         (select count(distinct job_code)::int from ods_qc_result
           where passed = false and checked_at >= current_date - ($1::int)) as qc_failed_jobs,
         (select count(*)::int from ods_job_reject
           where created_at >= current_date - ($1::int)) as rejects,
         r.repeat_repairs, r.repair_with_sn
       from (
         select count(*) filter (
                  where prev is not null and time_register > prev
                    and time_register - prev < interval '${REPEAT_DAYS} days'
                )::int as repeat_repairs,
             count(*)::int as repair_with_sn
           from (
             /**
              * ⚠️ **S/N ຕ້ອງເປັນ S/N ຈິງ** — ຄ່າ '-' ຖືກໃຊ້ໃນ **269 ໃບ / 234 ລູກຄ້າ**
              * (ເຄື່ອງທີ່ບໍ່ມີປ້າຍ) ⇒ ຖ້າຈັດກຸ່ມດ້ວຍມັນ ທຸກໃບຈະກາຍເປັນ "ເຄື່ອງໜ່ວຍດຽວກັນ"
              * ແລ້ວອັດຕາສ້ອມຊ້ຳພຸ່ງເປັນ 29% (ຜິດ). ຄວາມຈິງ **3.5%**.
              * ⇒ ນັບສະເພາະ S/N ທີ່ມີໂຕອັກສອນ/ໂຕເລກ ≥5 ຕົວ · ຈັດກຸ່ມດ້ວຍ **S/N + ລູກຄ້າ**
              *   ແລະ ຕ້ອງເປັນໃບທີ່ເປີດ **ຫຼັງ** ໃບກ່ອນຈົບ (time_register > prev).
              */
             select time_register,
                 lag(return_complete) over (
                   partition by upper(regexp_replace(sn, '[^A-Za-z0-9]', '', 'g')), cust_code
                   order by time_register
                 ) as prev
               from tb_product
              where length(regexp_replace(coalesce(sn,''), '[^A-Za-z0-9]', '', 'g')) >= 5
                and cancel_start is null
           ) x
          where x.time_register >= current_date - ($1::int)
       ) r`,
      [days],
    )
  ).rows[0];

  return {
    feedback_jobs: Number(row?.feedback_jobs ?? 0),
    feedback_avg: Number(row?.feedback_avg ?? 0),
    feedback_unhappy: Number(row?.feedback_unhappy ?? 0),
    repeat_repairs: Number(row?.repeat_repairs ?? 0),
    repair_with_sn: Number(row?.repair_with_sn ?? 0),
    qc_answers: Number(row?.qc_answers ?? 0),
    qc_failed_jobs: Number(row?.qc_failed_jobs ?? 0),
    rejects: Number(row?.rejects ?? 0),
  };
}

/** ປະລິມານງານຕໍ່ອາທິດ — ຮັບເຂົ້າ vs ປິດໄດ້ (ຮັບເຂົ້າ > ປິດ ຕິດຕໍ່ກັນ = ງານກອງ) */
export type WeekPoint = { week: string; opened: number; closed: number };

export async function weeklyThroughput(days: Period): Promise<{ install: WeekPoint[]; repair: WeekPoint[] }> {
  const rows = await query<{ workflow: string; week: string; opened: number; closed: number }>(
    `with weeks as (
       select generate_series(
         date_trunc('week', current_date - ($1::int)), date_trunc('week', current_date), interval '1 week'
       )::date as week
     )
     select 'install' as workflow, to_char(w.week,'DD/MM') as week,
         (select count(*)::int from ods_tb_install a
           where date_trunc('week', a.time_register) = w.week and a.cancel_date is null) as opened,
         (select count(*)::int from ods_tb_install a
           where date_trunc('week', a.job_finish) = w.week) as closed
       from weeks w
     union all
     select 'repair', to_char(w.week,'DD/MM'),
         (select count(*)::int from tb_product a
           where date_trunc('week', a.time_register) = w.week and a.cancel_start is null),
         (select count(*)::int from tb_product a
           where date_trunc('week', a.return_complete) = w.week)
       from weeks w`,
    [days],
  );

  return {
    install: rows.rows.filter((row) => row.workflow === "install"),
    repair: rows.rows.filter((row) => row.workflow === "repair"),
  };
}
