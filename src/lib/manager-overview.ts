import { query } from "@/lib/db";
import { INSTALL_OPEN } from "@/lib/install-stage";
import { MAINTENANCE_OPEN } from "@/lib/maintenance-stage";
import { ACCEPTED_QUOTE } from "@/lib/service-money";
import { IS_CLAIM, NOT_CLAIM, STAGE_SQL } from "@/lib/stage";

/**
 * ── ຂໍ້ມູນໜ້າແລກຂອງ **ຜູ້ຈັດການ** (/overview) ──
 *
 * ໜ້ານີ້ຕອບຄຳຖາມ 2 ຂໍ້ ຕາມລຳດັບນີ້ເທົ່ານັ້ນ:
 *   ① **ມີຫຍັງຄ້າງທີ່ຂ້ອຍຕ້ອງເຂົ້າໄປແກ້** (ເທິງສຸດ — ບ່ອນທີ່ຕາໄປຮອດກ່ອນ)
 *   ② **ເດືອນນີ້ໄປໄດ້ດີບໍ** (ລຸ່ມ — ຕົວເລກຜົນງານ)
 *
 * ── ເປັນຫຍັງບໍ່ໃຊ້ /dashboard ເດີມ ──
 * /dashboard ອອກແບບໃຫ້ **ທຸກ role** ⇒ ມັນສະແດງທຸກຄິວຂອງທຸກສາຍງານ ແລ້ວປະໃຫ້ຄົນເບິ່ງ
 * ຄິດເອົາເອງວ່າອັນໃດສຳຄັນ. ຜູ້ຈັດການບໍ່ໄດ້ລົງມືເຮັດຄິວເຫຼົ່ານັ້ນ — ລາວ**ຕັດສິນ** ແລະ
 * **ຕາມວຽກທີ່ຄ້າງຜິດປົກກະຕິ**. ໜ້ານີ້ຈຶ່ງເລືອກມາສະເພາະສິ່ງທີ່ຕ້ອງການການຕັດສິນ.
 *
 * ⚠️ ຄິດ "ຂັ້ນ" ດ້ວຍ STAGE_SQL ບ່ອນດຽວກັບໜ້າອື່ນ ⇒ ຕົວເລກຢູ່ນີ້ບໍ່ມີທາງຫຼົ້ນກັບ
 * ໜ້າຄິວທີ່ກົດເຂົ້າໄປ. ຢ່າຂຽນເງື່ອນໄຂ "ຂັ້ນ" ດ້ວຍມືຢູ່ໄຟລ໌ນີ້.
 */

/** ງານທີ່ຍັງບໍ່ຈົບ — ນິຍາມດຽວກັນທຸກ query ຂອງໄຟລ໌ນີ້ */
const OPEN_JOB = "a.return_complete is null and a.status <> 6";

export type AgeBucket = {
  /** ຄີຄົງທີ່ ສຳລັບ i18n ແລະ ລິ້ງ (ບໍ່ແມ່ນຂໍ້ຄວາມ) */
  key: "d7" | "d14" | "d30" | "over30";
  n: number;
};

export type OldJob = {
  code: string;
  product: string;
  cust_name: string | null;
  tech: string | null;
  stage: number;
  days: number;
};

export type TechBacklog = {
  tech: string;
  open: number;
  oldest_days: number;
  /** ຄ້າງເກີນ 30 ມື້ຈັກໃບ — ຕົວເລກທີ່ບອກວ່າ "ຄ້າງ" ບໍ່ແມ່ນ "ຫຍຸ້ງ" */
  stale: number;
};

/**
 * ສະຫຼຸບ **ຕໍ່ສາຍງານ** — ຜູ້ຈັດການຄຸມ 4 ສາຍ ແລະ ແຕ່ລະສາຍມີສຸຂະພາບຂອງຕົນ.
 * ຕົວເລກລວມອັນດຽວເຊື່ອງໄວ້ວ່າ **ສາຍໃດເປັນຕົ້ນເຫດ** (ເຊັ່ນ ສ້ອມຄ້າງ 46 ໃບ
 * ແຕ່ຕິດຕັ້ງບໍ່ຄ້າງຈັກໃບ — ຄົນລະບັນຫາກັນ, ຄົນລະຄົນຮັບຜິດຊອບ).
 *
 * ⚠️ ນິຍາມ "ເປີດຢູ່" ຂອງແຕ່ລະສາຍໃຊ້ຄ່າຄົງທີ່ຂອງສາຍນັ້ນເອງ (INSTALL_OPEN ·
 * MAINTENANCE_OPEN …) ບໍ່ແມ່ນຂຽນເງື່ອນໄຂໃໝ່ຢູ່ນີ້ ⇒ ຕົວເລກຕົງກັບໜ້າຄິວຂອງສາຍນັ້ນ.
 */
export type WorkflowSummary = {
  key: "repair" | "install" | "claim" | "maintenance";
  label: string;
  open: number;
  /** ຄ້າງເກີນ 30 ມື້ — ຕົວທີ່ບອກວ່າສາຍນີ້ມີບັນຫາຈິງ ບໍ່ແມ່ນພຽງແຕ່ຫຍຸ້ງ */
  stale: number;
  oldest_days: number;
  /** ເສັ້ນທາງເວັບຂອງຄິວສາຍນັ້ນ */
  href: string;
};

export type ManagerOverview = {
  /** ງານສ້ອມທີ່ຍັງເປີດຢູ່ ແບ່ງຕາມອາຍຸ — ລວມກັນ = ງານເປີດທັງໝົດ (ບໍ່ຫຼົ້ນກັນ) */
  aging: AgeBucket[];
  openTotal: number;
  /** ໃບເກົ່າສຸດທີ່ຍັງບໍ່ຈົບ — ບ່ອນທີ່ຜູ້ຈັດການຕ້ອງເຂົ້າໄປຖາມ */
  oldest: OldJob[];
  techBacklog: TechBacklog[];
  claims: { open: number; waitDecision: number };
  loaners: number;
  /** ງານທີ່ຈົບແລ້ວ ທຽບກັບ ງານທີ່ເປີດ ໃນ N ມື້ — ຕິດລົບ = ກອງວຽກສູງຂຶ້ນ */
  flow: { opened: number; closed: number };
  /** ສະຫຼຸບແຍກຕາມສາຍງານ (ສ້ອມ · ຕິດຕັ້ງ · ເຄມ · ສ້ອມບຳລຸງ) */
  workflows: WorkflowSummary[];
};

/**
 * ລາຍຮັບງານສ້ອມ **ເດືອນປັດຈຸບັນ** — ເປັນຕົວເລກດິບ (ບໍ່ຈັດຮູບ)
 * ⇒ ເວັບ ແລະ ແອັບມືຖື ຈັດຮູບຕາມພາສາຂອງຕົນເອງ ແຕ່ **ຄິດຈາກສູດດຽວກັນ**.
 *
 * ນິຍາມ "ຕົກລົງ" ໃຊ້ ACCEPTED_QUOTE ຂອງ lib/service-money ບ່ອນດຽວກັບລາຍງານ
 * ⇒ ຕົວເລກໜ້ານີ້ກັບ /reports/service-revenue ບໍ່ມີທາງຫຼົ້ນກັນ.
 */
export type MonthMoney = { quoted: number; paid: number; due: number };

export async function monthRevenue(): Promise<MonthMoney> {
  const row = (
    await query<MonthMoney>(
      `select coalesce(sum(x.quoted),0)::float8 quoted,
              coalesce(sum(x.paid),0)::float8 paid,
              coalesce(sum(x.quoted - x.paid),0)::float8 due
         from (
           select a.code, sum(q.total_amount) quoted,
                  coalesce((select sum(amount_thb) from ods_service_payment where job_code = a.code),0) paid
             from ic_trans q
             join tb_product a on a.code = q.product_code
            where ${ACCEPTED_QUOTE}
              and q.doc_date >= date_trunc('month', current_date)
            group by a.code
         ) x`,
    )
  ).rows[0];
  return row ?? { quoted: 0, paid: 0, due: 0 };
}

/**
 * ອາຍຸນັບຈາກ **ວັນຮັບເຄື່ອງ** (time_register) ບໍ່ແມ່ນ create_date_time_now:
 * create_date_time_now ຄືມື້ທີ່ **ແຖວຖືກສ້າງ** ເຊິ່ງໃບທີ່ຍ້າຍມາຈາກລະບົບເກົ່າຈະເປັນ
 * ມື້ຍ້າຍຂໍ້ມູນ ⇒ ອາຍຸຜິດເປັນຮ້ອຍມື້. time_register ຄືມື້ທີ່ເຄື່ອງເຂົ້າມາຈິງ.
 * ຫວ່າງ ⇒ ຖອຍໄປໃຊ້ create_date_time_now (ບໍ່ດັ່ງນັ້ນໃບນັ້ນຫາຍອອກຈາກທຸກຖັງ).
 */
const AGE_DAYS = `extract(day from localtimestamp - coalesce(a.time_register, a.create_date_time_now))::int`;

export async function getManagerOverview(days = 30): Promise<ManagerOverview> {
  /** ນັບ "ເປີດ · ຄ້າງເກີນ 30 ມື້ · ເກົ່າສຸດ" ຂອງ 1 ສາຍງານ ດ້ວຍຮູບແບບດຽວກັນ */
  const summarize = (table: string, open: string, age: string) =>
    query<{ open: number; stale: number; oldest_days: number }>(
      `select count(*)::int open,
              count(*) filter (where ${age} > 30)::int stale,
              coalesce(max(${age}), 0)::int oldest_days
         from ${table} a where ${open}`,
    );

  const [aging, oldest, techBacklog, claims, loaners, flow, repairSum, installSum, claimSum, maintSum] = await Promise.all([
    query<{ key: AgeBucket["key"]; n: number }>(
      `select case when ${AGE_DAYS} > 30 then 'over30'
                   when ${AGE_DAYS} > 14 then 'd30'
                   when ${AGE_DAYS} > 7  then 'd14'
                   else 'd7' end as key,
              count(*)::int n
         from tb_product a
        where ${OPEN_JOB} and ${NOT_CLAIM}
        group by 1`,
    ),

    query<OldJob>(
      `select a.code, coalesce(a.name_1,'') product, c.name_1 cust_name,
              nullif(a.emp_code,'') tech, (${STAGE_SQL}) stage, ${AGE_DAYS} days
         from tb_product a
         left join ar_customer c on c.code = a.cust_code
        where ${OPEN_JOB} and ${NOT_CLAIM}
        order by days desc
        limit 8`,
    ),

    query<TechBacklog>(
      `select coalesce(nullif(a.emp_code,''),'—') tech,
              count(*)::int open,
              max(${AGE_DAYS}) oldest_days,
              count(*) filter (where ${AGE_DAYS} > 30)::int stale
         from tb_product a
        where ${OPEN_JOB} and ${NOT_CLAIM}
        group by 1
        order by stale desc, open desc
        limit 8`,
    ),

    query<{ open: number; wait_decision: number }>(
      `select count(*)::int open,
              count(*) filter (where (${STAGE_SQL}) = 13)::int wait_decision
         from tb_product a
        where ${OPEN_JOB} and ${IS_CLAIM}`,
    ),

    query<{ n: number }>(`select count(*)::int n from ods_loaner where return_time is null`),

    query<{ opened: number; closed: number }>(
      `select count(*) filter (where a.time_register >= localtimestamp - ($1 || ' day')::interval)::int opened,
              count(*) filter (where a.return_complete >= localtimestamp - ($1 || ' day')::interval)::int closed
         from tb_product a
        where ${NOT_CLAIM}`,
      [days],
    ),

    summarize("tb_product", `${OPEN_JOB} and ${NOT_CLAIM}`, AGE_DAYS),
    summarize(
      "ods_tb_install",
      INSTALL_OPEN,
      "extract(day from localtimestamp - a.time_register)::int",
    ),
    summarize("tb_product", `${OPEN_JOB} and ${IS_CLAIM}`, AGE_DAYS),
    summarize(
      "ods_tb_maintenance",
      MAINTENANCE_OPEN,
      "extract(day from localtimestamp - a.time_register)::int",
    ),
  ]);

  const workflow = (
    key: WorkflowSummary["key"],
    label: string,
    href: string,
    rows: { rows: { open: number; stale: number; oldest_days: number }[] },
  ): WorkflowSummary => ({
    key,
    label,
    href,
    open: rows.rows[0]?.open ?? 0,
    stale: rows.rows[0]?.stale ?? 0,
    oldest_days: rows.rows[0]?.oldest_days ?? 0,
  });

  const byKey = new Map(aging.rows.map((row) => [row.key, row.n]));
  const buckets: AgeBucket[] = (["d7", "d14", "d30", "over30"] as const).map((key) => ({
    key,
    n: byKey.get(key) ?? 0,
  }));

  return {
    aging: buckets,
    openTotal: buckets.reduce((sum, bucket) => sum + bucket.n, 0),
    oldest: oldest.rows,
    techBacklog: techBacklog.rows,
    claims: { open: claims.rows[0]?.open ?? 0, waitDecision: claims.rows[0]?.wait_decision ?? 0 },
    loaners: loaners.rows[0]?.n ?? 0,
    flow: { opened: flow.rows[0]?.opened ?? 0, closed: flow.rows[0]?.closed ?? 0 },
    workflows: [
      workflow("repair", "ສ້ອມແປງ", "/reports/pending", repairSum),
      workflow("install", "ຕິດຕັ້ງ", "/installations", installSum),
      workflow("claim", "ເຄມ", "/claims/jobs", claimSum),
      workflow("maintenance", "ສ້ອມບຳລຸງ", "/maintenance", maintSum),
    ],
  };
}
