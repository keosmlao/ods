import { query } from "@/lib/db";

/**
 * ລາຍງານ (ຜູ້ຈັດການ) — ແນວໂນ້ມ 14 ມື້ (ເປີດ vs ປິດ, ສ້ອມ+ຕິດຕັ້ງ) + ຄ່າຄອມຈ່າຍເດືອນນີ້.
 * ນິຍາມ "ປິດ": ສ້ອມ = return_complete · ຕິດຕັ້ງ = job_finish (ຄືກັບ throughput ຂອງ dashboard).
 */

export type ReportDay = { date: string; opened: number; closed: number };

export type MobileReports = {
  days: ReportDay[];
  total_opened: number;
  total_closed: number;
  /** ຄ່າຄອມທີ່ຈ່າຍ (ປິດງານ) ໃນເດືອນນີ້ — ບໍລິສັດລວມ */
  commission_month_thb: number;
  commission_month_jobs: number;
};

const WINDOW = 14;

type DayCount = { d: string; n: number };

export async function mobileReports(): Promise<MobileReports> {
  const [opened, closed, commission] = await Promise.all([
    query<DayCount>(
      `select d::text, count(*)::int as n from (
          select time_register::date as d from tb_product
           where time_register >= current_date - interval '${WINDOW - 1} days'
          union all
          select time_register::date as d from ods_tb_install
           where time_register >= current_date - interval '${WINDOW - 1} days'
        ) t group by d`,
    ),
    query<DayCount>(
      `select d::text, count(*)::int as n from (
          select return_complete::date as d from tb_product
           where return_complete >= current_date - interval '${WINDOW - 1} days'
          union all
          select job_finish::date as d from ods_tb_install
           where job_finish >= current_date - interval '${WINDOW - 1} days'
        ) t group by d`,
    ),
    query<{ thb: number; jobs: number }>(
      `select coalesce(sum(pay_thb), 0)::float as thb,
          count(distinct job_code)::int as jobs
        from ods_service_payout
       where closed_at >= date_trunc('month', current_date)`,
    ),
  ]);

  const openMap = new Map(opened.rows.map((r) => [r.d.slice(0, 10), r.n]));
  const closeMap = new Map(closed.rows.map((r) => [r.d.slice(0, 10), r.n]));

  // ສ້າງແກນ 14 ມື້ ຄົບ (ບໍ່ໃຫ້ chart ຂາດຮ່ອງ) — ຄິດວັນຢູ່ SQL ໃຫ້ກົງ timezone server
  const axis = await query<{ d: string }>(
    `select (current_date - g)::text as d
       from generate_series(${WINDOW - 1}, 0, -1) as g`,
  );

  const days: ReportDay[] = axis.rows.map((r) => {
    const key = r.d.slice(0, 10);
    return { date: key, opened: openMap.get(key) ?? 0, closed: closeMap.get(key) ?? 0 };
  });

  return {
    days,
    total_opened: days.reduce((s, d) => s + d.opened, 0),
    total_closed: days.reduce((s, d) => s + d.closed, 0),
    commission_month_thb: commission.rows[0]?.thb ?? 0,
    commission_month_jobs: commission.rows[0]?.jobs ?? 0,
  };
}
