// relative ບໍ່ແມ່ນ alias @/ — tests/ ແລ່ນດ້ວຍ node ລ້ວນ ຈຶ່ງ resolve alias ບໍ່ໄດ້
import { centerLabel } from "./repair-center.ts";

/**
 * ກົດເກນ **ບ່ອນຮັບເຄື່ອງ ↔ ບ່ອນສ້ອມ** ທີ່ບໍ່ແຕະຖານຂໍ້ມູນ (ທົດສອບໄດ້ · client import ໄດ້).
 * ພາກທີ່ຖາມຖານຢູ່ lib/job-center.ts
 *
 * ສູນມີ 2 ບ່ອນ (ຂົວຫຼວງ · ດອນຕີ້ວ) ແລະ ເຄື່ອງໂອນຂ້າມສູນໄປສ້ອມໄດ້ ⇒ ກ່ອນສົ່ງຄືນລູກຄ້າ
 * ເຄື່ອງຕ້ອງ**ກັບມາຢູ່ບ່ອນທີ່ຮັບເຂົ້າ** ບໍ່ດັ່ງນັ້ນລູກຄ້າມາຮັບແລ້ວບໍ່ມີເຄື່ອງ.
 */
export type JobCenterState = {
  /** ບ່ອນຮັບເຄື່ອງເຂົ້າ (tb_product.intake_center) — ຫວ່າງ = ໃບເກົ່າ ບໍ່ກວດ */
  intake: string | null;
  /** ບ່ອນທີ່ເຄື່ອງຢູ່ດຽວນີ້ (tb_product.service_center) */
  current: string | null;
  /** ມີການໂອນທີ່ປາຍທາງຍັງບໍ່ກົດ "ຮັບເຂົ້າ" */
  transferPending: boolean;
  /** ສູນປາຍທາງຂອງການໂອນທີ່ຄ້າງ (ມີເມື່ອ transferPending) */
  transferTo?: string | null;
};

/**
 * ຂໍ້ຄວາມຫ້າມສົ່ງເຄື່ອງຄືນລູກຄ້າ — null ຄື ຜ່ານ.
 *
 * ຫ້າມ 2 ກໍລະນີ:
 *   ① ກຳລັງໂອນ ແລະ ປາຍທາງຍັງບໍ່ກົດຮັບ ⇒ ບໍ່ຮູ້ວ່າເຄື່ອງຢູ່ໃສແທ້
 *   ② ເຄື່ອງຢູ່ຄົນລະສູນກັບບ່ອນທີ່ຮັບເຂົ້າ ⇒ ຕ້ອງໂອນກັບກ່ອນ
 *
 * ໃບເກົ່າທີ່ບໍ່ມີ intake_center (5,167 ໃບ ກ່ອນ 31-07-2026) **ບໍ່ຖືກກວດ** —
 * ບໍ່ຮູ້ຄວາມຈິງຍ້ອນຫຼັງ ຈຶ່ງບໍ່ຄວນຂວາງວຽກທີ່ເຮັດຢູ່.
 */
export function centerHoldMessage(state: JobCenterState): string | null {
  if (state.transferPending) {
    return `ກຳລັງໂອນໄປສູນ ${centerLabel(state.transferTo)} ແລະ ປາຍທາງຍັງບໍ່ໄດ້ກົດ “ຮັບເຂົ້າ” — ສົ່ງເຄື່ອງຄືນລູກຄ້າບໍ່ໄດ້`;
  }
  if (!state.intake || !state.current) return null;
  if (state.intake === state.current) return null;
  return `ເຄື່ອງຢູ່ສູນ ${centerLabel(state.current)} ແຕ່ຮັບເຂົ້າທີ່ ${centerLabel(state.intake)} — ຕ້ອງໂອນກັບ ${centerLabel(state.intake)} ກ່ອນ ຈຶ່ງສົ່ງຄືນລູກຄ້າໄດ້`;
}
