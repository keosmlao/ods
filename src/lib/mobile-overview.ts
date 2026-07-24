import { getDashboard } from "@/lib/dashboard";

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
    tech_load: data.techLoad.map((t) => ({ tech: t.tech, jobs: t.jobs, oldest_seconds: t.oldest_seconds })),
    feedback: {
      avg: data.feedback.avg_points,
      jobs: data.feedback.jobs,
      unhappy: data.feedback.unhappy_jobs,
    },
  };
}
