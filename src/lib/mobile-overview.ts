import { getDashboard } from "@/lib/dashboard";
import { getManagerOverview, monthRevenue, type AgeBucket, type OldJob } from "@/lib/manager-overview";
import { listTechnicians } from "@/lib/technicians";
import { query } from "@/lib/db";
import { STAGE_LABEL } from "@/lib/stage";

/**
 * ພາບລວມສຳລັບຜູ້ຈັດການ ຢູ່ມືຖື — **ຫຍໍ້ຈາກ** getDashboard (ໜ້າ dashboard ຂອງເວັບ)
 * ໃຫ້ເຫຼືອສະເພາະຕົວເລກທີ່ຈໍມືຖືສະແດງ ⇒ ຕົວເລກກົງກັບເວັບແນ່ນອນ (ແຫຼ່ງດຽວກັນ).
 */

export type OverviewStage = { key: string; label: string; count: number; stage: number };
export type OverviewTech = { tech: string; jobs: number; oldest_seconds: number };

export type MobileOverview = {
  kpi: { repair_open: number; install_open: number; over_sla: number; approvals: number };
  approvals: { quotes: number; customer: number; purchases: number; cancels: number };
  sla: { warning: number; late: number; critical: number };
  /** received = ເບີດງານ (ຮັບເຄື່ອງ) ມື້ນີ້ · returned = ສົ່ງຄືນລູກຄ້າ ມື້ນີ້ */
  today: { appointments: number; checking: number; repairing: number; received: number; returned: number };
  unassigned: { repair: number; install: number };
  pipeline: OverviewStage[];
  tech_load: OverviewTech[];
  /** ຊ່າງສູນບໍລິການ **ທີ່ວ່າງ** (ບໍ່ມີວຽກຄ້າງ) — ຊື່ເຕັມ */
  tech_free: string[];
  feedback: { avg: number | null; jobs: number; unhappy: number };

  /**
   * ── ພາກ "ຜູ້ຈັດການ" (ເພີ່ມ 31-07-2026) — ຄືກັບໜ້າ /overview ຂອງເວັບ ──
   * ອ່ານຈາກ lib/manager-overview ບ່ອນດຽວກັບເວັບ ⇒ ຕົວເລກໃນແອັບກັບໃນເວັບບໍ່ຫຼົ້ນກັນ.
   */
  aging: AgeBucket[];
  open_total: number;
  /** ໃບເກົ່າສຸດ + ຊື່ຂັ້ນທີ່ແປແລ້ວ (ແອັບບໍ່ຮູ້ຈັກ STAGE_LABEL) */
  oldest: (OldJob & { stage_label: string })[];
  tech_backlog: { tech: string; tech_code: string; open: number; oldest_days: number; stale: number }[];
  claims: { open: number; wait_decision: number };
  loaners: number;
  flow: { opened: number; closed: number };
  /** ລາຍຮັບງານສ້ອມເດືອນນີ້ — ບາດ (ຕົວເລກດິບ, ແອັບຈັດຮູບເອງ) */
  money: { quoted: number; paid: number; due: number };
};

/**
 * ຂັ້ນຫຼັກຂອງງານສ້ອມ ທີ່ຄວນເຫັນເປັນ funnel (slug ຕ້ອງກົງກັບ dashboard-status).
 * `stage` = ເລກຂັ້ນຂອງ STAGE_SQL — ສົ່ງລົງໄປໃຫ້ແອັບກົດເປີດລາຍການຂອງຂັ້ນນັ້ນໄດ້
 * ⇒ ແອັບບໍ່ຕ້ອງເກັບຕາຕະລາງ slug→ຂັ້ນ ຊ້ຳອີກບ່ອນໜຶ່ງ (ບ່ອນທີ່ຈະລືມແກ້ແນ່ນອນ).
 */
const REPAIR_FUNNEL: { key: string; label: string; stage: number }[] = [
  { key: "wait-check", label: "ລໍກວດ", stage: 1 },
  { key: "checking", label: "ກຳລັງກວດ", stage: 2 },
  { key: "claim-decision", label: "ລໍຕັດສິນເຄມ", stage: 13 },
  { key: "claim-stock", label: "ລໍປ່ຽນຈາກ Stock", stage: 14 },
  { key: "claim-purchase", label: "ລໍຂອງສັ່ງຊື້", stage: 15 },
  { key: "claim-supplier", label: "ລໍ Supplier", stage: 16 },
  { key: "wait-quote", label: "ລໍ Quotation", stage: 3 },
  { key: "wait-repair", label: "ລໍສ້ອມ", stage: 8 },
  { key: "repairing", label: "ກຳລັງສ້ອມ", stage: 9 },
  { key: "wait-qc", label: "ລໍ QC", stage: 10 },
  { key: "wait-return", label: "ພ້ອມສົ່ງ", stage: 11 },
];

export async function mobileOverview(days = 30): Promise<MobileOverview> {
  // tech = null ⇒ ຕົວເລກທັງບໍລິສັດ (ຜູ້ຈັດການເຫັນໝົດ)
  const { data, error } = await getDashboard(null, days);
  if (error || !data) throw new Error("dashboard unavailable");

  const [mgr, money] = await Promise.all([getManagerOverview(days), monthRevenue()]);

  // ── ຊ່າງວ່າງ/ບໍ່ຫວ່າງ: ຊ່າງສູນບໍລິການທັງໝົດ vs ຄົນທີ່ມີວຽກຄ້າງ (techLoad) ──
  const techs = await listTechnicians();
  const nameOf = new Map(techs.map((t) => [t.code, t.name]));
  const busy = new Set(data.techLoad.map((t) => t.tech));
  const techFree = techs.filter((t) => !busy.has(t.code)).map((t) => t.name);

  // ── ເບີດງານ (ຮັບເຄື່ອງ) ມື້ນີ້ · ສົ່ງຄືນລູກຄ້າ ມື້ນີ້ (ຝັ່ງສ້ອມ) ──
  const daily = (
    await query<{ received: number; returned: number }>(
      `select
         (select count(*) from tb_product where time_register::date = current_date)::int received,
         (select count(*) from tb_product where return_complete::date = current_date)::int returned`,
    )
  ).rows[0] ?? { received: 0, returned: 0 };

  return {
    kpi: {
      repair_open: data.repair.total ?? 0,
      install_open: data.install.total ?? 0,
      over_sla: data.slaLate,
      approvals:
        data.approvals.quotes + data.approvals.customer + data.approvals.purchases + data.cancelRequests,
    },
    approvals: {
      quotes: data.approvals.quotes,
      customer: data.approvals.customer,
      purchases: data.approvals.purchases,
      cancels: data.cancelRequests,
    },
    sla: { warning: data.sla.warning, late: data.sla.late, critical: data.sla.critical },
    today: { ...data.today, received: daily.received, returned: daily.returned },
    unassigned: data.unassigned,
    pipeline: REPAIR_FUNNEL.map((s) => ({ ...s, count: data.repair[s.key] ?? 0 })),
    // ຊື່ຊ່າງ: ແປງ emp_code → ຊື່ເຕັມ (ຄົນທີ່ຍັງບໍ່ເຊື່ອມ = ຊື່ຫຼິ້ນ, ບໍ່ຢູ່ map ⇒ ໃຊ້ຄ່າເດີມ)
    tech_load: data.techLoad.map((t) => ({ tech: nameOf.get(t.tech) ?? t.tech, jobs: t.jobs, oldest_seconds: t.oldest_seconds })),
    tech_free: techFree,
    feedback: {
      avg: data.feedback.avg_points,
      jobs: data.feedback.jobs,
      unhappy: data.feedback.unhappy_jobs,
    },

    aging: mgr.aging,
    open_total: mgr.openTotal,
    oldest: mgr.oldest.map((job) => ({
      ...job,
      // ຊື່ຊ່າງເຕັມຄືກັບ tech_load — ບໍ່ດັ່ງນັ້ນລາຍການດຽວກັນສະກົດຄົນລະແບບໃນ 2 ບັດ
      tech: job.tech ? (nameOf.get(job.tech) ?? job.tech) : null,
      stage_label: STAGE_LABEL[job.stage] ?? String(job.stage),
    })),
    tech_backlog: mgr.techBacklog.map((row) => ({
      ...row,
      // ສົ່ງທັງລະຫັດ (ໃຊ້ຄົ້ນ) ແລະ ຊື່ເຕັມ (ໃຊ້ສະແດງ) — ແອັບແປງເອງບໍ່ໄດ້
      tech_code: row.tech,
      tech: nameOf.get(row.tech) ?? row.tech,
    })),
    claims: { open: mgr.claims.open, wait_decision: mgr.claims.waitDecision },
    loaners: mgr.loaners,
    flow: mgr.flow,
    money,
  };
}
