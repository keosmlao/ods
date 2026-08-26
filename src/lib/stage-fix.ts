/**
 * ── ແກ້ໄຂ **ຂັ້ນຂອງໃບງານສ້ອມ** ໃຫ້ຕົງກັບຄວາມຈິງ (ຜູ້ຈັດການ) ──
 *
 * ຂັ້ນຂອງໃບງານ **ບໍ່ໄດ້ເກັບເປັນຄໍລຳ** — ມັນຄິດຈາກຖັນເວລາ (STAGE_SQL, ເບິ່ງ lib/stage).
 * ⇒ "ແກ້ຂັ້ນ" ຄວາມຈິງແລ້ວແມ່ນ **ຂຽນ/ລ້າງຖັນເວລາ** ໃຫ້ຖືກຊຸດ. ຂຽນເອງດ້ວຍມືທຸກເທື່ອ
 * (ຄືທີ່ເຄີຍເຮັດກັບໃບ 7528) ⇒ ຜິດງ່າຍ ແລະ ບໍ່ມີບັນທຶກວ່າໃຜແກ້ຫຍັງ. ໄຟລ໌ນີ້ນິຍາມ
 * "ຊຸດຖັນຂອງແຕ່ລະຂັ້ນ" ໄວ້ບ່ອນດຽວ.
 *
 * ── ເປັນຫຍັງບໍ່ມີຂັ້ນ 3-7 ──
 * ຂັ້ນ 3-7 (ສະເໜີລາຄາ · ກວດ stock · ເບີກ · ສັ່ງຊື້) **ຖືກຄິດຈາກເອກະສານຈິງ**
 * (ic_trans ໃບສະເໜີລາຄາ · ic_trans_detail ໃບຂໍເບີກ/ໃບເບີກ) ບໍ່ແມ່ນຈາກທຸງຂອງໃບງານ
 * ⇒ ບັງຄັບໄປໂດຍບໍ່ມີເອກະສານ = ຕົວເລກໜ້າຈໍກັບເອກະສານຈິງຈະຂັດກັນ. ຢາກໃຫ້ໃບຢູ່ຂັ້ນນັ້ນ
 * ຕ້ອງອອກ/ຍົກເລີກເອກະສານນັ້ນຕາມຈິງ.
 */

/** ຂັ້ນທີ່ອະນຸຍາດໃຫ້ຕັ້ງໄດ້ — ເປັນຂັ້ນທີ່ນິຍາມດ້ວຍ **ຖັນເວລາລ້ວນ** */
export const FIXABLE_STAGES = [1, 2, 8, 9, 10, 11, 12] as const;
export type FixableStage = (typeof FIXABLE_STAGES)[number];

/**
 * ຖັນເວລາຂອງແຕ່ລະຂັ້ນ: `set` = ຕັ້ງເປັນເວລາປັດຈຸບັນຖ້າຍັງຫວ່າງ · `clear` = ລ້າງເປັນ null.
 *
 * ⚠️ ລຳດັບສຳຄັນ — STAGE_SQL ອ່ານຈາກ **ລຸ່ມຂຶ້ນເທິງ** (return_complete ກ່ອນ qc_finish
 * ກ່ອນ time_finish_repair …) ⇒ ຖ້າລ້າງບໍ່ຄົບ ໃບຈະຄາຢູ່ຂັ້ນສູງກວ່າທີ່ຕັ້ງ.
 */
const COLUMNS: Record<FixableStage, { set: string[]; clear: string[] }> = {
  // ລໍຖ້າກວດເຊັກ — ຄືໃບທີ່ຫາກໍ່ຮັບເຂົ້າມາ
  1: {
    set: [],
    clear: ["time_check", "time_finish_check", "time_repair", "time_finish_repair", "qc_finish", "return_complete", "repair_confirm"],
  },
  // ກຳລັງກວດເຊັກ
  2: {
    set: ["time_check"],
    clear: ["time_finish_check", "time_repair", "time_finish_repair", "qc_finish", "return_complete"],
  },
  // ລໍຖ້າສ້ອມແປງ — ຊຸດດຽວກັບທີ່ QC ຂຽນຕອນສົ່ງງານກັບ (lib/qc-flow: TABLE.sendBackSet).
  // `qc_reject_at` ບໍ່ຢູ່ໃນລາຍການນີ້ຕັ້ງໃຈ: ມັນບໍ່ມີຜົນຕໍ່ STAGE_SQL (ເປັນແຕ່ນາລິກາ
  // ຂອງຂັ້ນ 8) ແລະ ມັນເປັນເຫດການທີ່ເກີດຂຶ້ນຈິງ ⇒ ຢ່າລຶບປະຫວັດຖິ້ມຕອນແກ້ຂັ້ນດ້ວຍມື.
  8: {
    set: ["time_check", "time_finish_check"],
    clear: ["time_repair", "time_finish_repair", "qc_finish", "return_complete"],
  },
  // ກຳລັງສ້ອມແປງ
  9: {
    set: ["time_check", "time_finish_check", "time_repair"],
    clear: ["time_finish_repair", "qc_finish", "return_complete"],
  },
  // ລໍກວດຮັບຄຸນນະພາບ
  10: {
    set: ["time_check", "time_finish_check", "time_repair", "time_finish_repair"],
    clear: ["qc_finish", "return_complete"],
  },
  // ລໍຖ້າສົ່ງຄືນ
  11: {
    set: ["time_check", "time_finish_check", "time_repair", "time_finish_repair", "qc_finish"],
    clear: ["return_complete"],
  },
  // ສົ່ງຄືນສຳເລັດ
  12: {
    set: ["time_check", "time_finish_check", "time_repair", "time_finish_repair", "qc_finish", "return_complete"],
    clear: [],
  },
};

/**
 * SQL `set` ຂອງການຍ້າຍໄປຂັ້ນນັ້ນ.
 *
 * ຖັນທີ່ຕ້ອງ "ມີຄ່າ" ໃຊ້ `coalesce(ຖັນ, now)` ⇒ **ບໍ່ທັບເວລາເດີມ** ຖ້າມີຢູ່ແລ້ວ
 * (ປະຫວັດເວລາຈິງມີຄ່າກວ່າເວລາທີ່ຫາກໍ່ແກ້). ຖັນທີ່ຕ້ອງຫວ່າງ ຕັ້ງເປັນ null ຊື່ໆ.
 *
 * @param now ນິພົດເວລາຂອງ DB (ເຊັ່ນ `localtimestamp`) — ສົ່ງເຂົ້າມາເພື່ອໃຫ້ຕົງກັບບ່ອນອື່ນ
 */
export function stageFixSql(stage: FixableStage, now: string): string {
  const spec = COLUMNS[stage];
  return [
    ...spec.set.map((column) => `${column} = coalesce(${column}, ${now})`),
    ...spec.clear.map((column) => `${column} = null`),
  ].join(", ");
}
