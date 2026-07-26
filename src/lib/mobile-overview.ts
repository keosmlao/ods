import { getDashboard } from "@/lib/dashboard";
import { listTechnicians } from "@/lib/technicians";

/**
 * ພາບລວມສຳລັບຜູ້ຈັດການ ຢູ່ມືຖື — **ຫຍໍ້ຈາກ** getDashboard (ໜ້າ dashboard ຂອງເວັບ)
 * ໃຫ້ເຫຼືອສະເພາະຕົວເລກທີ່ຈໍມືຖືສະແດງ ⇒ ຕົວເລກກົງກັບເວັບແນ່ນອນ (ແຫຼ່ງດຽວກັນ).
 */

export type OverviewStage = { key: string; label: string; count: number };
export type OverviewTech = { tech: string; jobs: number; oldest_seconds: number };

export type MobileOverview = {
  kpi: { repair_open: number; install_open: number; over_sla: number; approvals: number };
  approvals: { quotes: number; customer: number; purchases: number; cancels: number };
  sla: { warning: number; late: number; critical: number };
  today: { appointments: number; checking: number; repairing: number };
  unassigned: { repair: number; install: number };
  pipeline: OverviewStage[];
  tech_load: OverviewTech[];
  /** ຊ່າງສູນບໍລິການ **ທີ່ວ່າງ** (ບໍ່ມີວຽກຄ້າງ) — ຊື່ເຕັມ */
  tech_free: string[];
  feedback: { avg: number | null; jobs: number; unhappy: number };
};

/** ຂັ້ນຫຼັກຂອງງານສ້ອມ ທີ່ຄວນເຫັນເປັນ funnel (slug ຕ້ອງກົງກັບ dashboard-status) */
const REPAIR_FUNNEL: { key: string; label: string }[] = [
  { key: "wait-check", label: "ລໍກວດ" },
  { key: "checking", label: "ກຳລັງກວດ" },
  { key: "wait-quote", label: "ລໍ Quotation" },
  { key: "wait-repair", label: "ລໍສ້ອມ" },
  { key: "repairing", label: "ກຳລັງສ້ອມ" },
  { key: "wait-qc", label: "ລໍ QC" },
  { key: "wait-return", label: "ພ້ອມສົ່ງ" },
];

export async function mobileOverview(days = 30): Promise<MobileOverview> {
  // tech = null ⇒ ຕົວເລກທັງບໍລິສັດ (ຜູ້ຈັດການເຫັນໝົດ)
  const { data, error } = await getDashboard(null, days);
  if (error || !data) throw new Error("dashboard unavailable");

  // ── ຊ່າງວ່າງ/ບໍ່ຫວ່າງ: ຊ່າງສູນບໍລິການທັງໝົດ vs ຄົນທີ່ມີວຽກຄ້າງ (techLoad) ──
  const techs = await listTechnicians();
  const nameOf = new Map(techs.map((t) => [t.code, t.name]));
  const busy = new Set(data.techLoad.map((t) => t.tech));
  const techFree = techs.filter((t) => !busy.has(t.code)).map((t) => t.name);

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
    today: data.today,
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
  };
}
