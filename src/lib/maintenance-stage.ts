/**
 * ຂັ້ນຕອນຂອງງານ "ສ້ອມບໍລຸງ" (ລ້າງແອ/ລ້າງເຄື່ອງ) — ຄິດຈາກ timestamp ຂອງ ods_tb_maintenance.
 * ຕ້ອງ alias ຕາຕະລາງເປັນ `a` ເມື່ອນຳ SQL ນີ້ໄປໃຊ້ (ຄືກັບ lib/stage · lib/install-stage).
 *
 * 0 ຮັບແຈ້ງ/ລໍນັດ+ຈັດຊ່າງ → 1 ລໍຊ່າງຮັບ → 2 ລໍໄປລ້າງ → 3 ກຳລັງລ້າງ
 * → 4 ລໍກວດ QC → 5 ລໍເກັບເງິນ/ປິດ → 6 ສຳເລັດ.  −1 = ຍົກເລີກ (ບໍ່ແມ່ນຄິວເປີດ).
 *
 * case ແບບ "ອັນທຳອິດທີ່ຖືກ ຊະນະ" ⇒ ທຸກແຖວໄດ້ຂັ້ນສະເໝີ (ບໍ່ຕົກຫຼົ່ນ).
 */
export const MAINTENANCE_STAGE_SQL = `case
  when a.cancel_date is not null                        then -1
  when a.job_finish is not null                         then 6
  when a.qc_finish is not null                          then 5
  when a.finish_clean is not null                       then 4
  when a.start_clean is not null                        then 3
  when a.emp_code is null or a.emp_code = ''
    or a.appoint_date is null                           then 0
  when a.tech_confirm is null                           then 1
  else 2
end`;

export const MAINTENANCE_STAGE_LABEL: Record<number, string> = {
  [-1]: "ຍົກເລີກແລ້ວ",
  0: "ຮັບແຈ້ງ / ລໍນັດ+ຈັດຊ່າງ",
  1: "ລໍຖ້າຊ່າງຮັບ",
  2: "ລໍໄປລ້າງ (ໜ້າງານ)",
  3: "ກຳລັງລ້າງ",
  4: "ລໍຖ້າກວດ QC",
  5: "ລໍເກັບເງິນ / ປິດງານ",
  6: "ສຳເລັດ",
};

/**
 * ຄິວຕໍ່ຂັ້ນ (URL-addressable) — ຄູ່ກັບເມນູ "ສ້ອມບໍລຸງ" ແລະ ໜ້າ /maintenance/status/<slug>.
 * ຄືກັບ repairStatuses/installStatuses ແຕ່ maintenance ຢືນເອກະລາດ (ບໍ່ຜ່ານ dashboard/status ຮ່ວມ).
 * slug + ຂັ້ນ ນິຍາມບ່ອນດຽວ ⇒ ເມນູ · badge · ໜ້າ ບໍ່ມີທາງຫຼົ້ນກັນ.
 */
export const MAINTENANCE_STATUSES: { slug: string; label: string; stage: number }[] = [
  { slug: "receive", label: MAINTENANCE_STAGE_LABEL[0], stage: 0 },
  { slug: "wait-accept", label: MAINTENANCE_STAGE_LABEL[1], stage: 1 },
  { slug: "wait-clean", label: MAINTENANCE_STAGE_LABEL[2], stage: 2 },
  { slug: "cleaning", label: MAINTENANCE_STAGE_LABEL[3], stage: 3 },
  { slug: "wait-qc", label: MAINTENANCE_STAGE_LABEL[4], stage: 4 },
  { slug: "wait-payment", label: MAINTENANCE_STAGE_LABEL[5], stage: 5 },
];

export const maintenanceStatusBySlug = (slug: string) =>
  MAINTENANCE_STATUSES.find((s) => s.slug === slug) ?? null;

/** ສີຂອງປ້າຍສະຖານະ — ໃຫ້ໜ້າຕາຄືກັນທຸກໜ້າ (ຄູ່ກັບ INSTALL_STAGE_CHIP) */
export const MAINTENANCE_STAGE_CHIP: Record<number, string> = {
  [-1]: "bg-red-100 text-red-700",
  0: "bg-amber-100 text-amber-800",
  1: "bg-amber-100 text-amber-800",
  2: "bg-indigo-50 text-indigo-700",
  3: "bg-cyan-100 text-cyan-800",
  4: "bg-purple-100 text-purple-800",
  5: "bg-orange-50 text-orange-700",
  6: "bg-slate-100 text-slate-600",
};

/** ຊື່ຂັ້ນ ໃນຮູບ SQL — ສ້າງຈາກ MAINTENANCE_STAGE_LABEL ບ່ອນດຽວ (ເບິ່ງ lib/stage) */
export const MAINTENANCE_STAGE_LABEL_SQL = `case (${MAINTENANCE_STAGE_SQL})
${Object.entries(MAINTENANCE_STAGE_LABEL).map(([stage, label]) => `  when ${stage} then '${label}'`).join("\n")}
  else '-' end`;

export const maintenanceStageLabel = (stage: number | null) =>
  stage == null ? "-" : (MAINTENANCE_STAGE_LABEL[stage] ?? "-");
export const maintenanceStageChip = (stage: number | null) =>
  stage == null ? "bg-slate-100 text-slate-500" : (MAINTENANCE_STAGE_CHIP[stage] ?? "bg-slate-100 text-slate-500");

/* ── 3 ກຸ່ມໃຫຍ່ — ລວມກັນໄດ້ທຸກແຖວ ods_tb_maintenance ພໍດີ ── */

/** ງານທີ່ຍັງດຳເນີນຢູ່ (ຂັ້ນ 0..5) */
export const MAINTENANCE_OPEN = "a.cancel_date is null and a.job_finish is null";
/** ງານທີ່ປິດແລ້ວ (ຂັ້ນ 6) */
export const MAINTENANCE_CLOSED = "a.cancel_date is null and a.job_finish is not null";
/** ງານທີ່ຍົກເລີກ (ຂັ້ນ -1) */
export const MAINTENANCE_CANCELLED = "a.cancel_date is not null";

/** ເງື່ອນໄຂ WHERE ຂອງຂັ້ນນຶ່ງ */
export const maintenanceStageIs = (stage: number) => `(${MAINTENANCE_STAGE_SQL}) = ${Number(stage)}`;

/**
 * ຖັນເວລາທີ່ "ນັບຄ້າງ" ຂອງແຕ່ລະຂັ້ນ — ໃຊ້ກັບ <Elapsed/>.
 * ຂັ້ນນຶ່ງນັບຈາກເວລາທີ່ເຂົ້າຂັ້ນນັ້ນ (ຂັ້ນ 0 ຍັງບໍ່ມີຫຍັງ ຈຶ່ງນັບຈາກເປີດງານ).
 */
export const MAINTENANCE_STAGE_TIME_COL = `case (${MAINTENANCE_STAGE_SQL})
  when 6 then a.job_finish
  when 5 then a.qc_finish
  when 4 then a.finish_clean
  when 3 then a.start_clean
  when 2 then coalesce(a.tech_confirm, a.assign_time, a.appoint_date, a.time_register)
  when 1 then coalesce(a.assign_time, a.appoint_date, a.time_register)
  when -1 then a.cancel_date
  else a.time_register
end`;

/** ຈຳນວນວິນາທີທີ່ຄ້າງຢູ່ຂັ້ນປັດຈຸບັນ — ສົ່ງໃຫ້ <Elapsed seconds=... /> */
export const MAINTENANCE_ELAPSED_SQL = `greatest(0, round(extract(epoch from (localtimestamp - (${MAINTENANCE_STAGE_TIME_COL})))))::int`;
