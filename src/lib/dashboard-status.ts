import { installStageIs } from "@/lib/install-stage";
import { STAGE_SQL } from "@/lib/stage";

/**
 * ຂັ້ນຂອງວຽກ ສຳລັບໜ້າລວມ ແລະ ໜ້າລາຍລະອຽດ /dashboard/status/<workflow>/<slug>.
 *
 * ທັງສອງໜ້າອ່ານຈາກໄຟລ໌ນີ້ບ່ອນດຽວ ⇒ ຕົວເລກຢູ່ໜ້າລວມ ກັບ ຈຳນວນແຖວຢູ່ໜ້າລາຍລະອຽດ
 * ບໍ່ມີທາງບໍ່ຕົງກັນ.
 */

/** ເງື່ອນໄຂ "ຢູ່ຂັ້ນນີ້" ຂອງ tb_product (alias a) */
const stageIs = (stage: number) => `(${STAGE_SQL}) = ${stage}`;

export type StatusDef = {
  label: string;
  condition: string;
  /**
   * ຂັ້ນຂອງຂັ້ນໄດ — ຂັ້ນລ້ວນໆຈະ "ບໍ່ຫຼົ້ນກັນ" ແລະ ລວມກັນໄດ້ຍອດທັງໝົດພໍດີ
   * ຈຶ່ງເອົາມາເຮັດແຖບ pipeline ໄດ້. ບໍ່ມີ stage = ຄິວທີ່ **ຕັດຂວາງຂັ້ນ** (overlay)
   * — ນັບຊ້ຳກັບຂັ້ນອື່ນ ຈຶ່ງຫ້າມເອົາໄປລວມຍອດ.
   */
  stage?: number;
};

export const repairStatuses: Record<string, StatusDef> = {
  "wait-check": { label: "ລໍຖ້າກວດເຊັກ", condition: stageIs(1), stage: 1 },
  checking: { label: "ກຳລັງກວດເຊັກ", condition: stageIs(2), stage: 2 },
  "wait-quote": { label: "ລໍຖ້າສະເໜີລາຄາ", condition: stageIs(3), stage: 3 },
  quoting: { label: "ກຳລັງສະເໜີລາຄາ", condition: stageIs(4), stage: 4 },
  "wait-withdraw": { label: "ລໍຖ້າເບີກອາໄຫຼ່", condition: stageIs(5), stage: 5 },
  withdrawing: { label: "ກຳລັງເບີກອາໄຫຼ່", condition: stageIs(6), stage: 6 },
  purchasing: { label: "ກຳລັງສັ່ງຊື້", condition: stageIs(7), stage: 7 },
  "wait-repair": { label: "ລໍຖ້າສ້ອມ", condition: stageIs(8), stage: 8 },
  repairing: { label: "ກຳລັງສ້ອມ", condition: stageIs(9), stage: 9 },
  // ດ່ານກວດຮັບຄຸນນະພາບ — ຂັ້ນໃໝ່ (ສ້ອມສຳເລັດແລ້ວ ແຕ່ຍັງບໍ່ຜ່ານ QC)
  "wait-qc": { label: "ລໍກວດຮັບຄຸນນະພາບ", condition: stageIs(10), stage: 10 },
  "wait-return": { label: "ລໍຖ້າສົ່ງຄືນ", condition: stageIs(11), stage: 11 },
  // ບໍ່ມີ "ຂໍ້ມູນຜິດປົກກະຕິ" ອີກຕໍ່ໄປ — STAGE_SQL ໃຫ້ຂັ້ນທຸກໃບສະເໝີ ຈຶ່ງຕົກຫຼົ່ນບໍ່ໄດ້
};

/**
 * ຂັ້ນຂອງງານຕິດຕັ້ງ — ດຽວນີ້ອີງ **INSTALL_STAGE_SQL** (lib/install-stage) ບ່ອນດຽວ.
 *
 * ແຕ່ກ່ອນໄຟລ໌ນີ້ຂຽນເງື່ອນໄຂເອງດ້ວຍມື (a.tech_code is null, a.reg_start is null …)
 * ⇒ ເປັນການ "ຄິດຂັ້ນສອງບ່ອນ" ເຊິ່ງຂັ້ນໄດຈິງເຕືອນໄວ້ວ່າຢ່າເຮັດ: ເງື່ອນໄຂເກົ່າເຊື່ອທຸງ
 * used_spare ຢ່າງດຽວ ໃນຂະນະທີ່ຂັ້ນໄດຈິງບໍ່ເຊື່ອທຸງນັ້ນຖ້າມີຮ່ອງຮອຍການເບີກຢູ່ໃນແຖວແລ້ວ
 * (ມີງານຈິງທີ່ used_spare=0 ແຕ່ມີໃບຂໍເບີກ/ໃບເບີກ) ⇒ ຕົວເລກໜ້າລວມ ກັບ ໜ້າ /installations
 * ຫຼົ້ນກັນໄດ້. ດຽວນີ້ໃຊ້ນິຍາມອັນດຽວກັນທັງລະບົບ.
 */
export const installStatuses: Record<string, StatusDef> = {
  "wait-assign": { label: "ລໍຖ້າຈັດຊ່າງ", condition: installStageIs(0), stage: 0 },
  "wait-register": { label: "ລໍຖ້າຊ່າງຂໍເບີກ", condition: installStageIs(1), stage: 1 },
  "wait-dispatch": { label: "ລໍຖ້າສາງເບີກ", condition: installStageIs(2), stage: 2 },
  "wait-pick": { label: "ລໍຖ້າຮັບອາໄຫຼ່", condition: installStageIs(3), stage: 3 },
  "wait-install": { label: "ລໍຖ້າຕິດຕັ້ງ", condition: installStageIs(4), stage: 4 },
  installing: { label: "ກຳລັງຕິດຕັ້ງ", condition: installStageIs(5), stage: 5 },
  // ດ່ານກວດຮັບຄຸນນະພາບ — ຂັ້ນໃໝ່ (ຕິດຕັ້ງສຳເລັດແລ້ວ ແຕ່ຍັງບໍ່ຜ່ານ QC)
  "wait-qc": { label: "ລໍກວດຮັບຄຸນນະພາບ", condition: installStageIs(6), stage: 6 },
  "wait-feedback": { label: "ລໍຖ້າແບບສອບຖາມ", condition: installStageIs(7), stage: 7 },
  "wait-close": { label: "ລໍຖ້າປິດງານ", condition: installStageIs(8), stage: 8 },

  /**
   * ⚠️ ຄິວທີ່ **ຕັດຂວາງຂັ້ນ** — ບໍ່ແມ່ນຂັ້ນຂອງຕົນເອງ.
   * ຊ່າງຖືກຈັດໃຫ້ແລ້ວ ແຕ່ຍັງບໍ່ກົດຮັບງານ: ງານນັ້ນຍັງນອນຢູ່ຂັ້ນ 1-4 ຢູ່ (ແລ້ວແຕ່ອາໄຫຼ່)
   * ⇒ ນັບຊ້ຳກັບຂັ້ນຂ້າງເທິງ. ຫ້າມເອົາໄປລວມຍອດ (ຈຶ່ງບໍ່ມີ `stage`).
   * ເງື່ອນໄຂຄືກັນກັບແທັບ "ຮັບງານ" ຂອງ /installations/accept.
   */
  "wait-accept": {
    label: "ລໍຖ້າຊ່າງຮັບງານ",
    condition: "a.tech_code is not null and a.tech_code <> '' and a.tech_confirm is null and a.start_install is null",
  },
};

/** ສະເພາະຂັ້ນລ້ວນໆ (ບໍ່ຫຼົ້ນກັນ) — ໃຊ້ເຮັດແຖບ pipeline ແລະ ລວມຍອດ */
export const pipelineOf = (statuses: Record<string, StatusDef>) =>
  Object.entries(statuses)
    .filter(([, def]) => def.stage != null)
    .sort((a, b) => (a[1].stage ?? 0) - (b[1].stage ?? 0));
