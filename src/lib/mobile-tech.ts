import { query } from "@/lib/db";
import { INSTALL_LEFT_SQL } from "@/lib/install-sla";
import { INSTALL_OPEN, INSTALL_STAGE_LABEL_SQL } from "@/lib/install-stage";
import { REPAIR_STAGE_SLA_HOURS_SQL } from "@/lib/repair-sla";
import { NOT_MISSING, NOT_PENDING_CANCEL, OPEN_JOBS, STAGE_ELAPSED_SQL, STAGE_LABEL_SQL } from "@/lib/stage";
import { listTechnicians } from "@/lib/technicians";
import type { MonitorJob } from "@/lib/mobile-monitor";

/**
 * ຜົນງານລູກນ້ອງ (ຜູ້ຈັດການ) — ຕໍ່ຊ່າງ 1 ຄົນ: ພາລະງານ · ຄວາມຊ້າ · ຜົນຜະລິດ · ຄ່າຄອມ.
 * ຄີ: ງານຈັດໃສ່ `emp_code`(ສ້ອມ)/`tech_code`(ຕິດຕັ້ງ) = login ຂອງຊ່າງ (= tech.code);
 * ຄ່າຄອມ (ods_service_payout) ຈ່າຍໃສ່ emp_code ຂອງງານ ⇒ ຄີດ້ວຍ tech.code ໄດ້ເລີຍ.
 */

export type TechRow = {
  code: string;
  name: string;
  open_jobs: number;
  oldest_days: number;
  late: number;
  month_jobs: number;
  month_thb: number;
};

export type TechDetail = TechRow & {
  today_closed: number;
  week_closed: number;
  jobs: MonitorJob[];
};

type LoadRow = { code: string; jobs: number; oldest_days: number; late: number };
type PayRow = { code: string; today: number; week: number; month: number; month_thb: number };

/** ພາລະງານ (repair+install) ຈັດກຸ່ມຕາມຊ່າງ — ໃຊ້ຮ່ວມ roster & detail */
async function loadByTech(): Promise<Map<string, LoadRow>> {
  const [repair, install] = await Promise.all([
    query<LoadRow>(
      `select nullif(trim(a.emp_code),'') as code,
          count(*)::int as jobs,
          coalesce(max(round(extract(epoch from (localtimestamp - a.time_register)) / 86400)), 0)::int as oldest_days,
          count(*) filter (where (${REPAIR_STAGE_SLA_HOURS_SQL}) is not null
            and (${REPAIR_STAGE_SLA_HOURS_SQL}) * 3600 - (${STAGE_ELAPSED_SQL}) < 0)::int as late
        from tb_product a
       where ${OPEN_JOBS} and ${NOT_MISSING} and ${NOT_PENDING_CANCEL}
         and nullif(trim(a.emp_code),'') is not null
       group by 1`,
    ),
    query<LoadRow>(
      `select nullif(trim(a.tech_code),'') as code,
          count(*)::int as jobs,
          coalesce(max(round(extract(epoch from (localtimestamp - a.time_register)) / 86400)), 0)::int as oldest_days,
          count(*) filter (where (${INSTALL_LEFT_SQL}) < 0)::int as late
        from ods_tb_install a
       where ${INSTALL_OPEN} and nullif(trim(a.tech_code),'') is not null
       group by 1`,
    ),
  ]);

  const map = new Map<string, LoadRow>();
  for (const r of [...repair.rows, ...install.rows]) {
    const cur = map.get(r.code) ?? { code: r.code, jobs: 0, oldest_days: 0, late: 0 };
    cur.jobs += r.jobs;
    cur.late += r.late;
    cur.oldest_days = Math.max(cur.oldest_days, r.oldest_days);
    map.set(r.code, cur);
  }
  return map;
}

/** ຄ່າຄອມ/ຜົນຜະລິດ ຈາກ payout — ຄີ = employee_code (= emp_code ຂອງງານ = tech.code) */
async function payByTech(): Promise<Map<string, PayRow>> {
  const rows = await query<PayRow>(
    `select p.employee_code as code,
        count(distinct p.job_code) filter (where p.closed_at::date = current_date)::int as today,
        count(distinct p.job_code) filter (where p.closed_at >= date_trunc('week', current_date))::int as week,
        count(distinct p.job_code) filter (where p.closed_at >= date_trunc('month', current_date))::int as month,
        coalesce(sum(p.pay_thb) filter (where p.closed_at >= date_trunc('month', current_date)), 0)::float as month_thb
      from ods_service_payout p
     where p.closed_at >= date_trunc('month', current_date) - interval '7 days'
     group by 1`,
  );
  return new Map(rows.rows.map((r) => [r.code, r]));
}

/** ດຶງ pay ຂອງຊ່າງ 1 ຄົນ — ລອງ code ກ່ອນ ແລ້ວ fallback employee_code (ຊ່າງເຊື່ອມ ERP) */
function payOf(pay: Map<string, PayRow>, code: string, employeeCode: string): PayRow {
  return (
    pay.get(code) ??
    pay.get(employeeCode) ?? { code, today: 0, week: 0, month: 0, month_thb: 0 }
  );
}

export async function techRoster(): Promise<TechRow[]> {
  const [techs, load, pay] = await Promise.all([listTechnicians(), loadByTech(), payByTech()]);
  return techs
    .map((t) => {
      const l = load.get(t.code) ?? { jobs: 0, oldest_days: 0, late: 0 };
      const p = payOf(pay, t.code, t.employee_code);
      return {
        code: t.code,
        name: t.name,
        open_jobs: l.jobs,
        oldest_days: l.oldest_days,
        late: l.late,
        month_jobs: p.month,
        month_thb: p.month_thb,
      };
    })
    // ຄົນມີວຽກຄ້າງ/ຊ້າ ຂຶ້ນກ່ອນ — ຜູ້ຈັດການເຫັນຄົນຕ້ອງເບິ່ງແຍງກ່ອນ
    .sort((a, b) => b.late - a.late || b.open_jobs - a.open_jobs || b.month_jobs - a.month_jobs);
}

export async function techDetail(code: string): Promise<TechDetail | null> {
  const techs = await listTechnicians();
  const tech = techs.find((t) => t.code === code);
  if (!tech) return null;

  const [load, pay, jobs] = await Promise.all([loadByTech(), payByTech(), techJobs(code)]);
  const l = load.get(code) ?? { jobs: 0, oldest_days: 0, late: 0 };
  const p = payOf(pay, code, tech.employee_code);

  return {
    code,
    name: tech.name,
    open_jobs: l.jobs,
    oldest_days: l.oldest_days,
    late: l.late,
    month_jobs: p.month,
    month_thb: p.month_thb,
    today_closed: p.today,
    week_closed: p.week,
    jobs,
  };
}

/** ງານເປີດຂອງຊ່າງ 1 ຄົນ (repair+install) — ຮຽງ ດ່ວນ (SLA) ກ່ອນ */
async function techJobs(code: string): Promise<MonitorJob[]> {
  const [repair, install] = await Promise.all([
    query<MonitorJob>(
      `select 'repair' as workflow, a.code,
          a.name_1 as product, b.name_1 as customer, a.service_type,
          (${STAGE_LABEL_SQL}) as stage_label,
          round(extract(epoch from (localtimestamp - a.time_register)) / 86400)::int as age_days,
          case when (${REPAIR_STAGE_SLA_HOURS_SQL}) is not null
            then (${REPAIR_STAGE_SLA_HOURS_SQL}) * 3600 - (${STAGE_ELAPSED_SQL})
            else null end::double precision as sla_left,
          null::text as tech
        from tb_product a
        left join ar_customer b on b.code = a.cust_code
       where ${OPEN_JOBS} and ${NOT_MISSING} and ${NOT_PENDING_CANCEL} and a.emp_code = $1`,
      [code],
    ),
    query<MonitorJob>(
      `select 'install' as workflow, a.code,
          a.item_name as product, c.name_1 as customer, null as service_type,
          (${INSTALL_STAGE_LABEL_SQL}) as stage_label,
          round(extract(epoch from (localtimestamp - a.time_register)) / 86400)::int as age_days,
          (${INSTALL_LEFT_SQL})::double precision as sla_left,
          null::text as tech
        from ods_tb_install a
        left join ar_customer c on c.code = a.cust_code
       where ${INSTALL_OPEN} and a.tech_code = $1`,
      [code],
    ),
  ]);
  return [...repair.rows, ...install.rows].sort(
    (a, b) => (a.sla_left ?? 1e12) - (b.sla_left ?? 1e12) || b.age_days - a.age_days,
  );
}
