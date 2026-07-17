import { SERVICE_TYPE_LABEL } from "@/lib/sla";
import { STAGE_SQL, STAGE_TIME_COL } from "@/lib/stage";

/** ປະເພດບໍລິການສ້ອມ — ລຳດັບນີ້ໃຊ້ຮ່ວມກັນໃນ UI/ລາຍງານ. */
export const REPAIR_SERVICE_TYPES = ["CI", "ST", "IH", "PS"] as const;
export type RepairServiceType = (typeof REPAIR_SERVICE_TYPES)[number];

export type RepairStagePolicy = {
  stage: number;
  label: string;
  owner: string;
  kpi: string;
  /** SLA ຊົ່ວໂມງ ແຍກຕາມ CI/ST/IH/PS. */
  hours: Record<RepairServiceType, number>;
  /** ຂັ້ນທີ່ເວລາຫຼັກຂຶ້ນກັບລູກຄ້າ/ຜູ້ສະໜອງ — ລາຍງານແຍກ, ບໍ່ຫັກ KPI ພະນັກງານ. */
  external?: boolean;
  targetPct: number;
};

/**
 * SLA ນະໂຍບາຍຮອບທຳອິດ (calendar hours).
 * - CI ເລັ່ງສຸດ: ລູກຄ້ານຳເຄື່ອງມາລໍທີ່ສູນ.
 * - IH ຕ້ອງນັດ/ເດີນທາງ ແຕ່ສ້ອມຢູ່ໜ້າງານ.
 * - PS ຕ້ອງໄປຮັບເຄື່ອງແລ້ວນຳກັບສູນ ຈຶ່ງໃຫ້ເວລາຂົນສົ່ງເພີ່ມ.
 * - ລູກຄ້າອະນຸມັດລາຄາ/ລໍຜູ້ສະໜອງ ແຍກເປັນ external SLA.
 */
export const REPAIR_STAGE_POLICIES: RepairStagePolicy[] = [
  { stage: 1, label: "ຮັບງານ / ເລີ່ມກວດ", owner: "ຫົວໜ້າຊ່າງ + ຊ່າງ", kpi: "ຮັບງານ ແລະເລີ່ມກວດພາຍໃນ SLA", hours: { CI: 2, ST: 4, IH: 12, PS: 24 }, targetPct: 90 },
  { stage: 2, label: "ກຳລັງກວດເຊັກ", owner: "ຊ່າງ", kpi: "ບັນທຶກຜົນວິນິດໄສຄົບພາຍໃນ SLA", hours: { CI: 2, ST: 4, IH: 4, PS: 8 }, targetPct: 90 },
  { stage: 3, label: "ລໍສ້າງໃບສະເໜີລາຄາ", owner: "ຝ່າຍບໍລິການ", kpi: "ເລີ່ມຈັດທຳໃບສະເໜີລາຄາພາຍໃນ SLA", hours: { CI: 2, ST: 2, IH: 2, PS: 2 }, targetPct: 95 },
  { stage: 4, label: "ລໍອະນຸມັດລາຄາ", owner: "ລູກຄ້າ + ຝ່າຍບໍລິການ", kpi: "ຕິດຕາມຄຳຕອບລູກຄ້າພາຍໃນ SLA", hours: { CI: 24, ST: 24, IH: 24, PS: 24 }, external: true, targetPct: 80 },
  { stage: 5, label: "ກວດ Stock / ດຳເນີນອາໄຫຼ່", owner: "ຊ່າງ + ສາງ + ຈັດຊື້", kpi: "ກວດ ERP ແລະເລືອກ ຂໍເບີກ ຫຼື ສັ່ງຊື້ ຕາມ stock ຈິງ", hours: { CI: 2, ST: 2, IH: 2, PS: 2 }, targetPct: 95 },
  { stage: 6, label: "ກຳລັງເບີກອາໄຫຼ່", owner: "ສາງ", kpi: "ຈ່າຍອາໄຫຼ່ທີ່ມີໃນສາງພາຍໃນ SLA", hours: { CI: 4, ST: 4, IH: 8, PS: 8 }, targetPct: 90 },
  { stage: 7, label: "ກຳລັງສັ່ງຊື້ອາໄຫຼ່", owner: "ຈັດຊື້ + ຜູ້ສະໜອງ", kpi: "ອາໄຫຼ່ເຂົ້າສາງຕາມ lead time", hours: { CI: 168, ST: 168, IH: 168, PS: 168 }, external: true, targetPct: 80 },
  { stage: 8, label: "ລໍເລີ່ມສ້ອມ", owner: "ຫົວໜ້າຊ່າງ + ຊ່າງ", kpi: "ເລີ່ມສ້ອມຫຼັງເງື່ອນໄຂຄົບ", hours: { CI: 4, ST: 4, IH: 12, PS: 8 }, targetPct: 90 },
  { stage: 9, label: "ກຳລັງສ້ອມ", owner: "ຊ່າງ", kpi: "ສ້ອມສຳເລັດພາຍໃນ SLA ແລະບໍ່ກັບມາສ້ອມຊ້ຳ", hours: { CI: 4, ST: 8, IH: 4, PS: 8 }, targetPct: 90 },
  { stage: 10, label: "ລໍກວດ QC", owner: "ຜູ້ກວດ QC", kpi: "ກວດ QC ຄົບ checklist ພາຍໃນ SLA", hours: { CI: 2, ST: 2, IH: 2, PS: 2 }, targetPct: 95 },
  { stage: 11, label: "ລໍສົ່ງມອບ / ຮັບເງິນ", owner: "ຝ່າຍບໍລິການ", kpi: "ແຈ້ງລູກຄ້າ ແລະສົ່ງມອບພາຍໃນ SLA", hours: { CI: 4, ST: 24, IH: 8, PS: 24 }, targetPct: 90 },
];

export const REPAIR_STAGE_POLICY = new Map(REPAIR_STAGE_POLICIES.map((item) => [item.stage, item]));

export function repairStageTargetHours(stage: number, serviceType: string | null | undefined): number | null {
  if (!serviceType || !REPAIR_SERVICE_TYPES.includes(serviceType as RepairServiceType)) return null;
  return REPAIR_STAGE_POLICY.get(stage)?.hours[serviceType as RepairServiceType] ?? null;
}

export function repairSlaState(seconds: number | null, targetHours: number | null): "none" | "ok" | "warn" | "late" {
  if (seconds == null || !targetHours) return "none";
  const target = targetHours * 3600;
  if (seconds > target) return "late";
  if (seconds >= target * 0.75) return "warn";
  return "ok";
}

export function repairSlaTone(state: ReturnType<typeof repairSlaState>) {
  if (state === "late") return { chip: "bg-red-600 text-white", bar: "bg-red-600" };
  if (state === "warn") return { chip: "bg-amber-100 text-amber-800", bar: "bg-amber-400" };
  if (state === "ok") return { chip: "bg-emerald-50 text-emerald-700", bar: "bg-emerald-400" };
  return { chip: "bg-slate-100 text-slate-600", bar: "bg-slate-200" };
}

const serviceCase = (policy: RepairStagePolicy) => `case a.service_type
${REPAIR_SERVICE_TYPES.map((code) => `      when '${code}' then ${policy.hours[code]}`).join("\n")}
      else null end`;

/** SLA (ຊົ່ວໂມງ) ຂອງຂັ້ນປັດຈຸບັນ — alias tb_product = a. */
export const REPAIR_STAGE_SLA_HOURS_SQL = `case (${STAGE_SQL})
${REPAIR_STAGE_POLICIES.map((policy) => `  when ${policy.stage} then ${serviceCase(policy)}`).join("\n")}
  else null end`;

/** ວຽກເປີດທີ່ເກີນ SLA ຂອງຂັ້ນປັດຈຸບັນ. */
export const REPAIR_STAGE_OVERDUE_SQL = `(${REPAIR_STAGE_SLA_HOURS_SQL}) is not null
  and extract(epoch from (localtimestamp - (${STAGE_TIME_COL}))) > (${REPAIR_STAGE_SLA_HOURS_SQL}) * 3600`;

export const repairServiceLabel = (code: RepairServiceType) => SERVICE_TYPE_LABEL[code] ?? code;
