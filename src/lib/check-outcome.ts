/**
 * **ຜົນກວດເຊັກທີ່ຈົບງານໂດຍບໍ່ສ້ອມ — ຄ່າຄົງທີ່ລ້ວນໆ (ບໍ່ import ຫຍັງເລີຍ).**
 *
 * ── ເປັນຫຍັງຕ້ອງແຍກ 2 ຜົນ ──
 * ທັງສອງຈົບດ້ວຍ "ຄືນເຄື່ອງໂດຍບໍ່ສ້ອມ" ຄືກັນ ແຕ່**ຄົນລະເລື່ອງກັນ**:
 *
 *   cannot_repair   ສ້ອມບໍ່ໄດ້ — ເສຍໜັກ · ອາໄຫຼ່ບໍ່ມີຂາຍ · ບໍ່ຄຸ້ມ
 *                   ⇒ ງານຈົບຢູ່ນີ້ ລູກຄ້າເອົາເຄື່ອງເກົ່າກັບ
 *   replace_advice  ແນະນຳໃຫ້ປ່ຽນເຄື່ອງ ⇒ **ສົ່ງຕໍ່ຝ່າຍຂາຍ**
 *                   ⇒ ການປ່ຽນເຄື່ອງເປັນໜ້າທີ່ຝ່າຍຂາຍ ສູນບໍລິການພຽງແຕ່ແນະນຳ
 *
 * ແຕ່ກ່ອນມີແຕ່ຜົນດຽວ (ສ້ອມບໍ່ໄດ້) ⇒ ຊ່າງທີ່ຢາກແນະນຳໃຫ້ປ່ຽນເຄື່ອງຕ້ອງຢືມມັນມາໃຊ້
 * ແລ້ວລາຍງານນັບທັງສອງລວມເປັນ "ຍົກເລີກ" ກ້ອນດຽວ — ແຍກສະຖິຕິບໍ່ໄດ້ ແລະ ຝ່າຍຂາຍ
 * ບໍ່ມີສັນຍານວ່າມີເຄື່ອງລໍໃຫ້ໄປສະເໜີປ່ຽນ.
 *
 * ⚠️ **ບໍ່ຢູ່ໃນ STAGE_SQL** — ທັງສອງຍັງເດີນເສັ້ນທາງເກົ່າ (ຄຳຂໍຍົກເລີກ → ອະນຸມັດ →
 * ຂັ້ນ 11 ລໍຖ້າສົ່ງຄືນ) ⇒ ຄິວ · ລາຍງານ · KPI ບໍ່ຂະຫຍັບຈັກອັນ. ຖັນນີ້ເປັນ**ປ້າຍ**
 * ໄວ້ແຍກສະຖິຕິ ແລະ ບອກຜູ້ອະນຸມັດວ່າກຳລັງອະນຸມັດເລື່ອງໃດ.
 *
 * ⚠️ ໄຟລ໌ນີ້ **ຫ້າມ import ຫຍັງ** — client component (check-form) ໃຊ້ນຳ, ຖ້າດຶງ
 * lib/db ເຂົ້າມາ bundler ຈະເອົາ pg ໄປ browser ແລ້ວ `next build` ພັງ (ຄືກັບ lib/cust-kind).
 */

/** `tb_product.check_outcome` — null = ງານສ້ອມປົກກະຕິ (ບໍ່ໄດ້ຈົບແບບບໍ່ສ້ອມ) */
export type CheckOutcome = "cannot_repair" | "replace_advice";

export const CHECK_OUTCOMES: CheckOutcome[] = ["cannot_repair", "replace_advice"];

export const CHECK_OUTCOME_LABEL: Record<CheckOutcome, string> = {
  cannot_repair: "ສ້ອມບໍ່ໄດ້",
  replace_advice: "ແນະນຳປ່ຽນເຄື່ອງ (ສົ່ງຕໍ່ຝ່າຍຂາຍ)",
};

/** ຄຳອະທິບາຍໃຕ້ຕົວເລືອກ — ບອກຊ່າງວ່າເລືອກອັນໃດເມື່ອໃດ */
export const CHECK_OUTCOME_HINT: Record<CheckOutcome, string> = {
  cannot_repair: "ເສຍໜັກ · ອາໄຫຼ່ບໍ່ມີຂາຍ · ສ້ອມບໍ່ຄຸ້ມ — ລູກຄ້າເອົາເຄື່ອງເກົ່າກັບ",
  replace_advice: "ຄວນປ່ຽນເຄື່ອງໃໝ່ — ສູນແນະນຳເທົ່ານັ້ນ ຝ່າຍຂາຍເປັນຜູ້ຕັດສິນ ແລະ ດຳເນີນການ",
};

/** ຄຳນຳໜ້າທີ່ຂຽນລົງ `tb_product.remark` — ໃຫ້ອ່ານອອກທັນທີວ່າຄຳຂໍນີ້ມາຈາກເລື່ອງໃດ */
export const CHECK_OUTCOME_REMARK: Record<CheckOutcome, string> = {
  cannot_repair: "ສ້ອມບໍ່ໄດ້",
  replace_advice: "ແນະນຳປ່ຽນເຄື່ອງ (ສົ່ງຕໍ່ຝ່າຍຂາຍ)",
};

/** ຂໍ້ຄວາມທີ່ບັງຄັບໃຫ້ປ້ອນເຫດຜົນ — ຄົນລະຄຳກັນ ເພາະເຫດຜົນຖືກໃຊ້ຄົນລະຢ່າງ */
export const CHECK_OUTCOME_REASON_ERROR: Record<CheckOutcome, string> = {
  cannot_repair: "ກະລຸນາປ້ອນເຫດຜົນ ທີ່ສ້ອມບໍ່ໄດ້ — ເປັນສິ່ງທີ່ຕ້ອງບອກລູກຄ້າຕອນຄືນເຄື່ອງ",
  replace_advice: "ກະລຸນາປ້ອນເຫດຜົນ ທີ່ຄວນປ່ຽນເຄື່ອງ — ຝ່າຍຂາຍໃຊ້ອັນນີ້ໄປສະເໜີລູກຄ້າ",
};

export const isCheckOutcome = (value: unknown): value is CheckOutcome =>
  value === "cannot_repair" || value === "replace_advice";

/** ອ່ານຄ່າຈາກຖານ → ປ້າຍ; null/ຄ່າແປກ = ບໍ່ສະແດງຫຍັງ */
export const checkOutcomeLabel = (value: string | null | undefined): string | null =>
  isCheckOutcome(value) ? CHECK_OUTCOME_LABEL[value] : null;
