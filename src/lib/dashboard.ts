import { query } from "@/lib/db";
import { installStatuses, repairStatuses, type StatusDef } from "@/lib/dashboard-status";
import { INSTALL_OPEN, INSTALL_STAGE_SQL } from "@/lib/install-stage";
import { SLA_SQL } from "@/lib/sla";
import { OPEN_JOBS, STAGE_SQL } from "@/lib/stage";
import { LINE_STATUS, TRANS } from "@/lib/stock-constants";

/**
 * ຂໍ້ມູນຂອງໜ້າລວມ (/dashboard).
 *
 * ── ກົດເກນ ──
 * ທຸກຕົວເລກຢູ່ນີ້ **ໃຊ້ເງື່ອນໄຂອັນດຽວກັນກັບໜ້າປາຍທາງ** ທີ່ມັນລິ້ງໄປ (ຄັດລອກມາຈາກໜ້ານັ້ນໆ)
 * ⇒ ກົດຕົວເລກ 5 ແລ້ວຕ້ອງເຫັນ 5 ແຖວ. ຖ້າວັນໜຶ່ງໜ້າປາຍທາງປ່ຽນເງື່ອນໄຂ ຕ້ອງມາປ່ຽນບ່ອນນີ້ນຳ.
 * ບ່ອນທີ່ເປັນ "ຂັ້ນ" ໃຊ້ຜ່ານ lib/dashboard-status (ເຊິ່ງອີງ STAGE_SQL / INSTALL_STAGE_SQL)
 * ຈຶ່ງບໍ່ຕ້ອງກັງວົນ.
 *
 * ── ຂອບເຂດຂອງຜູ້ໃຊ້ ──
 * ຊ່າງ (technical) ເຫັນສະເພາະວຽກຂອງຕົນ — ຄືກັນກັບທຸກໜ້າອື່ນ (lib/scope ownJobsOnly
 * ຝັ່ງສ້ອມ = emp_code · techFilter ຝັ່ງຕິດຕັ້ງ = tech_code). ແຕ່ກ່ອນໜ້າລວມບໍ່ກອງເລີຍ
 * ⇒ ຊ່າງເຫັນຕົວເລກຂອງທັງບໍລິສັດ ແລ້ວກົດເຂົ້າໄປເຫັນແຕ່ວຽກຂອງຕົນ (ຕົວເລກບໍ່ຕົງກັນ).
 */

export type Counts = Record<string, number>;

/** ນັບທຸກຂັ້ນຂອງ workflow ດຽວ ດ້ວຍ query ດຽວ — ບໍ່ດຶງແຖວ */
function countsSql(statuses: Record<string, StatusDef>, from: string, where: string) {
  const filters = Object.entries(statuses)
    .map(([slug, { condition }], index) => `count(*) filter (where ${condition})::int c${index} /* ${slug} */`)
    .join(", ");
  return `select ${filters}, count(*)::int total from ${from} where ${where}`;
}

function readCounts(statuses: Record<string, StatusDef>, row: Record<string, number> | undefined): Counts {
  const out: Counts = { total: row?.total ?? 0 };
  Object.keys(statuses).forEach((slug, index) => {
    out[slug] = row?.[`c${index}`] ?? 0;
  });
  return out;
}

/* ── ຄິວ "ຕ້ອງລົງມື" ທີ່ບໍ່ແມ່ນຂັ້ນ ─────────────────────────────── */

/**
 * ວຽກກວດເຊັກທີ່ **ເກີນກຳນົດເວລາ (SLA)** — ສູດດຽວກັນກັບໜ້າ /checking.
 * SLA ວັດສະເພາະ 2 ຂັ້ນກວດເຊັກ (lib/sla) ຂັ້ນອື່ນບໍ່ໄດ້ກຳນົດເວລາໄວ້.
 *   ລໍຖ້າກວດເຊັກ  → ນັບຈາກ time_register
 *   ກຳລັງກວດເຊັກ → ນັບຈາກ time_check
 */
const SLA_LATE_SQL = `select
    count(*) filter (
      where a.time_check is null and a.time_finish_check is null and a.status = 1
        and (${SLA_SQL}) is not null
        and extract(epoch from (localtimestamp - a.time_register)) > (${SLA_SQL}))::int wait_late,
    count(*) filter (
      where a.time_check is not null and a.time_finish_check is null and a.status <> 6
        and (${SLA_SQL}) is not null
        and extract(epoch from (localtimestamp - a.time_check)) > (${SLA_SQL}))::int check_late
  from tb_product a`;

/**
 * ອາໄຫຼ່ຄ້າງນອກສາງ ຂອງງານທີ່ **ຍົກເລີກແລ້ວ** — ຄືກັນທຸກປະການກັບແທັບ
 * "ຍົກເລີກ — ຖ້າສົ່ງຄືນ" ຂອງ /stock/returns (ຄຸມທັງສ້ອມ ແລະ ຕິດຕັ້ງ).
 * ນີ້ຄື "ໜີ້ອາໄຫຼ່": ຂອງອອກຈາກສາງໄປແລ້ວ ແຕ່ບໍ່ມີເອກະສານຮັບຮູ້ວ່າຄືນ.
 */
const CANCELLED_SPARES_SQL = `select count(*)::int docs,
    coalesce(sum((select count(*) from ic_trans_detail d
                  where d.doc_no = a.doc_no and d.status in (${LINE_STATUS.PENDING}, ${LINE_STATUS.ISSUED}))), 0)::int lines
  from ic_trans a
  where a.trans_flag = ${TRANS.DISPATCH}
    and ( ( a.used_status = 0 and a.status = 0
            and not exists (select 1 from ic_trans t
                            where t.doc_ref = a.doc_no and t.used_status = 0 and t.status = 3) )
       or exists (select 1 from ic_trans_detail d
                  where d.doc_no = a.doc_no and d.doc_no like 'SWC%' and d.status = ${LINE_STATUS.PENDING}) )
    and ( ( a.job_type = 'install'
            and exists (select 1 from ods_tb_install i
                        where i.code = a.product_code and i.cancel_date is not null) )
       or ( coalesce(a.job_type,'') <> 'install'
            and exists (select 1 from tb_product p where p.code = a.product_code and p.status = 6) ) )`;

/** ຄິວອະນຸມັດ — ເງື່ອນໄຂຄັດລອກມາຈາກໜ້າອະນຸມັດແຕ່ລະໜ້າ */
const APPROVALS_SQL = `select
    count(*) filter (where a.trans_flag = 17 and a.aprove_status = 0)::int quotes,
    count(*) filter (where a.trans_flag = 17 and a.aprove_status = 1 and a.aprove_status_2 = 0)::int customer,
    count(*) filter (where a.trans_flag = 78 and a.aprove_status = 0)::int purchases
  from ic_trans a`;

/** ຄຳຂໍຍົກເລີກທີ່ລໍອະນຸມັດ — /approvals/cancellations ແທັບ "ລໍຖ້າອະນຸມັດ" */
const CANCEL_REQUESTS_SQL = `select count(*)::int n from tb_product a
  where a.status = 6 and a.cancel_start is not null and a.cancel_finish is null`;

/**
 * ຄະແນນແບບສອບຖາມລູກຄ້າ (ງານຕິດຕັ້ງ).
 *
 * ⚠️ ມາດຕາສ່ວນ **1 = ງ່າຍຫຼາຍ (ດີສຸດ) … 4 = ຍາກຫຼາຍ (ແຍ່ສຸດ)** — **ຕໍ່າກວ່າ = ດີກວ່າ**
 * (ເບິ່ງ components/installation/feedback-form). ຢ່າສະແດງເປັນດາວຄະແນນແບບ x/4
 * ບໍ່ດັ່ງນັ້ນຄວາມໝາຍຈະກັບຫົວ. ໃຊ້ topic_code '002' (ຊຸດຄຳຖາມປັດຈຸບັນ).
 */
const FEEDBACK_SQL = `select round(avg(points)::numeric, 2)::float avg_points,
    count(distinct product_code)::int jobs
  from cust_complain where topic_code = '002'`;

/** ວຽກຄ້າງດົນສຸດ (ວັນ) — ໃຫ້ຮູ້ວ່າ "ດົນສຸດ" ຮ້າຍແຮງປານໃດ */
const OLDEST_SQL = `select
    (select coalesce(max(extract(epoch from (localtimestamp - a.time_register))), 0)::int
       from tb_product a where ${OPEN_JOBS}) repair_seconds,
    (select coalesce(max(extract(epoch from (localtimestamp - a.time_register))), 0)::int
       from ods_tb_install a where ${INSTALL_OPEN}) install_seconds`;

/**
 * ວຽກທີ່ **ຄ້າງດົນສຸດ** — ບໍ່ແມ່ນ "ລ່າສຸດ".
 *
 * ໜ້າລວມເກົ່າສະແດງວຽກຄ້າງ "ລ່າສຸດ" (order by time_register desc) ເຊິ່ງແມ່ນວຽກທີ່ຫາກໍ່ເປີດ
 * — ຄືວຽກທີ່ **ດ່ວນນ້ອຍທີ່ສຸດ**. ໜ້າລວມຄວນຊີ້ວຽກທີ່ຖືກລືມ ບໍ່ແມ່ນວຽກທີ່ຫາກໍ່ມາ.
 */
export type StaleJob = {
  code: string;
  customer: string | null;
  product: string | null;
  who: string | null;
  stage: string;
  elapsed_seconds: number;
};

const STALE_REPAIR = (where: string) => `select a.code, b.name_1 customer,
    concat_ws(' ', a.name_1, a.p_brand, a.p_model) product, a.emp_code who,
    greatest(0, round(extract(epoch from (localtimestamp - a.time_register))))::int elapsed_seconds,
    case (${STAGE_SQL})
      when 1 then 'ລໍຖ້າກວດເຊັກ' when 2 then 'ກຳລັງກວດເຊັກ' when 3 then 'ລໍຖ້າສະເໜີລາຄາ'
      when 4 then 'ກຳລັງສະເໜີລາຄາ' when 5 then 'ລໍຖ້າເບີກອາໄຫຼ່' when 6 then 'ກຳລັງເບີກອາໄຫຼ່'
      when 7 then 'ກຳລັງສັ່ງຊື້' when 8 then 'ລໍຖ້າສ້ອມ' when 9 then 'ກຳລັງສ້ອມ'
      when 10 then 'ລໍຖ້າສົ່ງຄືນ' else '-' end stage
  from tb_product a left join ar_customer b on b.code = a.cust_code
  where ${where}
  order by a.time_register asc nulls last limit 8`;

const STALE_INSTALL = (where: string) => `select a.code, c.name_1 customer,
    concat_ws(' ', a.item_name, a.pro_brand, a.pro_model) product, a.tech_code who,
    greatest(0, round(extract(epoch from (localtimestamp - a.time_register))))::int elapsed_seconds,
    case (${INSTALL_STAGE_SQL})
      when 0 then 'ລໍຖ້າຈັດຊ່າງ' when 1 then 'ລໍຖ້າຊ່າງຂໍເບີກ' when 2 then 'ລໍຖ້າສາງເບີກ'
      when 3 then 'ລໍຖ້າຮັບອາໄຫຼ່' when 4 then 'ລໍຖ້າຕິດຕັ້ງ' when 5 then 'ກຳລັງຕິດຕັ້ງ'
      when 6 then 'ລໍຖ້າແບບສອບຖາມ' when 7 then 'ລໍຖ້າປິດງານ' else '-' end stage
  from ods_tb_install a left join ar_customer c on c.code = a.cust_code
  where ${where}
  order by a.time_register asc nulls last limit 8`;

export type DashboardData = {
  repair: Counts;
  install: Counts;
  staleRepairs: StaleJob[];
  staleInstalls: StaleJob[];
  slaLate: number;
  cancelledSpares: { docs: number; lines: number };
  approvals: { quotes: number; customer: number; purchases: number };
  cancelRequests: number;
  feedback: { avg_points: number | null; jobs: number };
  oldest: { repair_seconds: number; install_seconds: number };
};

/**
 * @param tech ຊື່ຜູ້ໃຊ້ຂອງຊ່າງ — ກອງໃຫ້ເຫັນສະເພາະວຽກຂອງຕົນ (null = ເຫັນໝົດ)
 */
export async function getDashboard(tech: string | null): Promise<{ data: DashboardData | null; error: boolean }> {
  // ຊ່າງ: ຝັ່ງສ້ອມກອງດ້ວຍ emp_code · ຝັ່ງຕິດຕັ້ງກອງດ້ວຍ tech_code (ຄືກັບທຸກໜ້າອື່ນ)
  const repairWhere = tech ? `${OPEN_JOBS} and a.emp_code = $1` : OPEN_JOBS;
  const installWhere = tech ? `${INSTALL_OPEN} and a.tech_code = $1` : INSTALL_OPEN;
  const args = tech ? [tech] : [];

  try {
    const [repair, install, staleRepairs, staleInstalls, sla, spares, approvals, cancels, feedback, oldest] =
      await Promise.all([
      query<Record<string, number>>(countsSql(repairStatuses, "tb_product a", repairWhere), args),
      query<Record<string, number>>(countsSql(installStatuses, "ods_tb_install a", installWhere), args),
      query<StaleJob>(STALE_REPAIR(repairWhere), args),
      query<StaleJob>(STALE_INSTALL(installWhere), args),
      query<{ wait_late: number; check_late: number }>(SLA_LATE_SQL),
      query<{ docs: number; lines: number }>(CANCELLED_SPARES_SQL),
      query<{ quotes: number; customer: number; purchases: number }>(APPROVALS_SQL),
      query<{ n: number }>(CANCEL_REQUESTS_SQL),
      query<{ avg_points: number | null; jobs: number }>(FEEDBACK_SQL),
      query<{ repair_seconds: number; install_seconds: number }>(OLDEST_SQL),
    ]);

    const late = sla.rows[0];
    return {
      data: {
        repair: readCounts(repairStatuses, repair.rows[0]),
        install: readCounts(installStatuses, install.rows[0]),
        staleRepairs: staleRepairs.rows,
        staleInstalls: staleInstalls.rows,
        slaLate: (late?.wait_late ?? 0) + (late?.check_late ?? 0),
        cancelledSpares: spares.rows[0] ?? { docs: 0, lines: 0 },
        approvals: approvals.rows[0] ?? { quotes: 0, customer: 0, purchases: 0 },
        cancelRequests: cancels.rows[0]?.n ?? 0,
        feedback: feedback.rows[0] ?? { avg_points: null, jobs: 0 },
        oldest: oldest.rows[0] ?? { repair_seconds: 0, install_seconds: 0 },
      },
      error: false,
    };
  } catch (error) {
    console.error("Dashboard query failed", error);
    return { data: null, error: true };
  }
}
