/**
 * ຂັ້ນຕອນຂອງງານຕິດຕັ້ງ (ods_tb_install) — ຄິດຈາກຖັນເວລາໂດຍກົງ.
 *
 * ── ຂັ້ນໄດຂອງ ods ──
 * ods ຂຽນ CASE ອັນນີ້ຄືນໃໝ່ໃນທຸກໜ້າ (install_admin.py, tech_install.py,
 * tech_reg_install.py …) ແລະ ແຕ່ລະສະບັບບໍ່ຄືກັນ. ສະບັບຫຍໍ້ທີ່ສຸດຢູ່
 * install_admin.py:1148-1155 (pending_success):
 *
 *   1 reg_start isnull                              → ລໍຖ້າຊ່າງຂໍເບີກ
 *   2 reg_start notnull, reg_finish isnull          → ລໍຖ້າສາງເບີກ
 *   3 reg_finish notnull, pick_finish isnull        → ລໍຖ້າຊ່າງຮັບອາໄຫຼ່
 *   4 pick_finish notnull, start_install isnull     → ລໍຖ້າຊ່າງຕິດຕັ້ງ
 *   5 start_install notnull, finish_install isnull  → ກຳລັງຕິດຕັ້ງ
 *   6 finish_install notnull, complain_finish isnull→ ຕິດຕັ້ງສຳເລັດ
 *   7 complain_finish notnull                       → ປິດຈັອບເເລ້ວ
 *
 * ── ເປັນຫຍັງບໍ່ຄັດລອກມາຊື່ໆ ──
 * ຂັ້ນໄດຫຍໍ້ນັ້ນຕົກຫຼົ່ນ 3 ຢ່າງ ທີ່ໜ້າອື່ນຂອງ ods ຕ້ອງໃຊ້:
 *   • cancel_date  — ງານທີ່ຍົກເລີກແລ້ວຈະຖືກຈັດເປັນ "ລໍຖ້າຊ່າງຂໍເບີກ"
 *   • used_spare=0 — ງານທີ່ບໍ່ໃຊ້ອາໄຫຼ່ບໍ່ມີ reg_start ຈັກເທື່ອ ⇒ ຄ້າງຢູ່ຂັ້ນ 1 ຕະຫຼອດ
 *     ທັງທີ່ຄວາມຈິງລໍຖ້າຊ່າງຕິດຕັ້ງຢູ່ (ຂັ້ນ 4)
 *   • tech_code / job_finish — "ລໍຖ້າຈັດຊ່າງ" ແລະ ການແຍກ
 *     "ລໍຖ້າປິດງານ" (complain ແລ້ວ ແຕ່ຍັງບໍ່ປິດ) ອອກຈາກ "ປິດງານເເລ້ວ"
 *
 * ຈຶ່ງຂະຫຍາຍຂັ້ນໄດຫຍໍ້ໃຫ້ຄົບ ໂດຍຮັກສາຄວາມໝາຍ ແລະ ລຳດັບເລກ 1-6 ໄວ້ຄືເກົ່າ
 * ແລ້ວເພີ່ມ 0 (ລໍຖ້າຈັດຊ່າງ), -1 (ຍົກເລີກ) ແລະ ແຍກຂັ້ນ 7 ຂອງ ods
 * ("ປິດຈັອບເເລ້ວ") ອອກເປັນ 7 = ລໍຖ້າປິດງານ ແລະ 8 = ປິດງານເເລ້ວ
 * — ຄືກັບທີ່ install_admin.py:559 (Home_install_all) ແລະ /api/install_list ເຮັດ.
 *
 * ເປັນ case ແບບ "ອັນທຳອິດທີ່ຖືກ ຊະນະ" ຈຶ່ງ **ບໍ່ມີທາງຕົກຫຼົ່ນ**:
 * ທຸກແຖວຕ້ອງໄດ້ຂັ້ນນຶ່ງສະເໝີ (-1 ຫຼື 0..8).
 */

/** ໃຊ້ໃນ SQL — ຕ້ອງ alias ຕາຕະລາງ ods_tb_install ເປັນ a */
export const INSTALL_STAGE_SQL = `case
  when a.cancel_date is not null                     then -1
  when a.job_finish is not null                      then 8
  when a.complain_finish is not null                 then 7
  when a.finish_install is not null                  then 6
  when a.start_install is not null                   then 5
  when a.tech_code is null or a.tech_code = ''       then 0
  when coalesce(a.used_spare,0) = 0                  then 4
  when a.reg_start is null                           then 1
  when a.reg_finish is null                          then 2
  when a.pick_finish is null                         then 3
  else 4
end`;

export const INSTALL_STAGE_LABEL: Record<number, string> = {
  [-1]: "ຍົກເລີກແລ້ວ",
  0: "ລໍຖ້າຈັດຊ່າງ",
  1: "ລໍຖ້າຊ່າງຂໍເບີກ",
  2: "ລໍຖ້າສາງເບີກ",
  3: "ລໍຖ້າຊ່າງຮັບອາໄຫຼ່",
  4: "ລໍຖ້າຊ່າງຕິດຕັ້ງ",
  5: "ກຳລັງຕິດຕັ້ງ",
  6: "ຕິດຕັ້ງສຳເລັດ",
  7: "ລໍຖ້າປິດງານ",
  8: "ປິດງານເເລ້ວ",
};

/** ສີຂອງປ້າຍສະຖານະ — ໃຫ້ໜ້າຕາຄືກັນທຸກໜ້າ */
export const INSTALL_STAGE_CHIP: Record<number, string> = {
  [-1]: "bg-red-100 text-red-700",
  0: "bg-amber-100 text-amber-800",
  1: "bg-amber-100 text-amber-800",
  2: "bg-blue-50 text-blue-700",
  3: "bg-blue-50 text-blue-700",
  4: "bg-indigo-50 text-indigo-700",
  5: "bg-emerald-50 text-emerald-700",
  6: "bg-teal-50 text-teal-700",
  7: "bg-orange-50 text-orange-700",
  8: "bg-slate-100 text-slate-600",
};

export const installStageLabel = (stage: number | null) =>
  stage == null ? "-" : (INSTALL_STAGE_LABEL[stage] ?? "-");
export const installStageChip = (stage: number | null) =>
  stage == null ? "bg-slate-100 text-slate-500" : (INSTALL_STAGE_CHIP[stage] ?? "bg-slate-100 text-slate-500");

/* ── ເງື່ອນໄຂ 3 ກຸ່ມໃຫຍ່ — ລວມກັນແລ້ວໄດ້ທຸກແຖວຂອງ ods_tb_install ພໍດີ ── */

/** ງານທີ່ຍັງດຳເນີນຢູ່ (ຂັ້ນ 0..7) */
export const INSTALL_OPEN = "a.cancel_date is null and a.job_finish is null";
/** ງານທີ່ປິດແລ້ວ (ຂັ້ນ 8) */
export const INSTALL_CLOSED = "a.cancel_date is null and a.job_finish is not null";
/** ງານທີ່ຍົກເລີກ (ຂັ້ນ -1) */
export const INSTALL_CANCELLED = "a.cancel_date is not null";

/** ເງື່ອນໄຂ WHERE ຂອງຂັ້ນນຶ່ງ */
export const installStageIs = (stage: number) => `(${INSTALL_STAGE_SQL}) = ${Number(stage)}`;

/**
 * ຖັນເວລາທີ່ "ນັບຄ້າງ" ຂອງແຕ່ລະຂັ້ນ — ໃຊ້ກັບ <Elapsed/>.
 * ຂັ້ນນຶ່ງນັບຈາກເວລາທີ່ເຂົ້າຂັ້ນນັ້ນ (ຂັ້ນ 0 ຍັງບໍ່ມີຫຍັງ ຈຶ່ງນັບຈາກເປີດງານ).
 */
export const INSTALL_STAGE_TIME_COL = `case (${INSTALL_STAGE_SQL})
  when 8 then a.job_finish
  when 7 then a.complain_finish
  when 6 then a.finish_install
  when 5 then a.start_install
  when 4 then coalesce(a.pick_finish, a.tech_confirm, a.time_register)
  when 3 then a.reg_finish
  when 2 then a.reg_start
  when -1 then a.cancel_date
  else a.time_register
end`;

/** ຈຳນວນວິນາທີທີ່ຄ້າງຢູ່ຂັ້ນປັດຈຸບັນ — ສົ່ງໃຫ້ <Elapsed seconds=... /> */
export const INSTALL_ELAPSED_SQL = `greatest(0, round(extract(epoch from (localtimestamp - (${INSTALL_STAGE_TIME_COL})))))::int`;
