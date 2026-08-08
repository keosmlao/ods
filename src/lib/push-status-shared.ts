/**
 * **ສະຖານະໃດ ຄວນແຈ້ງໃຜ** — ຕາຕະລາງ (ສາຍງານ × ຂັ້ນ × ສິດ) ສຳລັບ Firebase push.
 * ພາກທີ່ບໍ່ແຕະຖານ ⇒ client import ໄດ້ (ພາກຖານຢູ່ lib/push-status.ts).
 *
 * ── ອ່ານກ່ອນແກ້ ──
 * ① **ຄຸມແຕ່ push ເຂົ້າມືຖື** — ແຖວຍັງຂຽນລົງ `ods_notification` ຄົບ ⇒ ກ່ອງແຈ້ງເຕືອນ
 *    ຢູ່ເວັບ/ໃນແອັບເຫັນທຸກຢ່າງຄືເກົ່າ. ປິດ = ມືຖືງຽບ ບໍ່ແມ່ນປະຫວັດຫາຍ.
 * ② **ຊ່າງທີ່ຖືກມອບງານ ແລະ ຄົນທີ່ຖືກເອີ້ນເຖິງ ໄດ້ຮັບສະເໝີ** — ຕາຕະລາງນີ້ຄຸມແຕ່ການ
 *    ແຈ້ງ **ຕາມສິດ** (ຜູ້ຈັດການ · ຫົວໜ້າຊ່າງ · CS · ສາງ) ບໍ່ແມ່ນວຽກສ່ວນຕົວຂອງຄົນນັ້ນ.
 * ③ **ຄ່າຕັ້ງຕົ້ນຢູ່ໃນໂຄ້ດ** (`PUSH_STATUS_DEFAULT` ລຸ່ມນີ້) ບໍ່ແມ່ນຢູ່ຖານ ⇒ ບໍ່ຕ້ອງ seed
 *    ແລະ ຖານລົ້ມກໍ່ຍັງໄດ້ພຶດຕິກຳທີ່ຕັ້ງໃຈ. ຖານເກັບແຕ່ **ອັນທີ່ຜູ້ຈັດການແກ້**.
 *
 * ── ຫຼັກການເລືອກຄ່າຕັ້ງຕົ້ນ ──
 * ແຈ້ງ **ຄົນທີ່ຕ້ອງລົງມືຕໍ່ຢູ່ຂັ້ນນັ້ນ** ເທົ່ານັ້ນ. ຜູ້ຈັດການໄດ້ຮັບສະເພາະ**ເລື່ອງທີ່ຕ້ອງຕັດສິນ
 * ຫຼື ຜິດປົກກະຕິ** (ຍົກເລີກ · ລໍຕັດສິນ · ສັ່ງຊື້) ບໍ່ແມ່ນທຸກຂັ້ນ — ຍິງທຸກຂັ້ນໃສ່ຜູ້ຈັດການ
 * = 154,689 ແຖວ/ມື້ ແລ້ວຄົນຈະປິດແຈ້ງເຕືອນຖິ້ມ ຈົນກາຍເປັນ "ບໍ່ເຫັນຫຍັງເລີຍ".
 * ຂັ້ນທີ່ "ກຳລັງເຮັດຢູ່" (ກຳລັງກວດ · ກຳລັງສ້ອມ · ກຳລັງຕິດຕັ້ງ) ບໍ່ແຈ້ງໃຜ —
 * ມັນເປັນວຽກຂອງຊ່າງທີ່ຖືກມອບແລ້ວ ເຊິ່ງໄດ້ຮັບ push ໂດຍກົງຢູ່ແລ້ວ.
 */

/**
 * ສິດທີ່ແຈ້ງ**ຕາມກຸ່ມ**ໄດ້.
 *
 * ⚠️ **ຊ່າງ = ຊ່າງທຸກຄົນ (26 ຄົນ)** ບໍ່ແມ່ນ "ຊ່າງທີ່ຖືກມອບໃບນີ້" — ຊ່າງເຈົ້າຂອງໃບ
 * ໄດ້ຮັບຢູ່ແລ້ວທາງອື່ນ 2 ທາງ (ຖືກມອບໂດຍກົງ · ເປັນຜູ້ຕິດຕາມໃບ) ໂດຍບໍ່ຜ່ານຕາຕະລາງນີ້.
 * ⇒ ຕິດຊ່ອງແຖວ "ຊ່າງ" ເມື່ອຢາກໃຫ້ **ໝົດທີມ** ຮູ້ພ້ອມກັນເທົ່ານັ້ນ
 * (ຕັ້ງຕົ້ນບໍ່ຕິດຈັກຂັ້ນ — ເບິ່ງ PUSH_WORKFLOWS ລຸ່ມ).
 */
export const PUSH_STATUS_ROLES = [
  { role: "manager", label: "ຜູ້ຈັດການ" },
  { role: "headtechnical", label: "ຫົວໜ້າຊ່າງ" },
  { role: "admin", label: "CS" },
  { role: "stock", label: "ສາງ" },
  { role: "technical", label: "ຊ່າງ" },
] as const;

export type PushStatusRole = (typeof PUSH_STATUS_ROLES)[number]["role"];

export type PushStage = { stage: number; label: string; roles: PushStatusRole[] };

/**
 * ສາຍງານ ແລະ ຂັ້ນ — ປ້າຍຊື່ຕົງກັບ `lib/dashboard-status` (ຄິວທີ່ຄົນເຫັນຢູ່ /work).
 * `roles` = **ຄ່າຕັ້ງຕົ້ນ** ວ່າຂັ້ນນັ້ນຄວນແຈ້ງໃຜ.
 */
export const PUSH_WORKFLOWS: { workflow: string; label: string; model: string; stages: PushStage[] }[] = [
  {
    workflow: "install",
    label: "ງານຕິດຕັ້ງ",
    model: "ods_tb_install",
    stages: [
      { stage: 0, label: "ເປີດງານ / ລໍຖ້າຈັດຊ່າງ", roles: ["admin", "headtechnical"] },
      { stage: 1, label: "ລໍຖ້າຊ່າງຮັບ", roles: ["headtechnical"] },
      { stage: 2, label: "ລໍຖ້າເບີກອາໄຫຼ່", roles: ["stock"] },
      { stage: 3, label: "ລໍຖ້າຮັບອາໄຫຼ່ຈາກການເບີກ", roles: ["stock"] },
      { stage: 4, label: "ລໍຖ້າຕິດຕັ້ງ", roles: [] },
      { stage: 5, label: "ກຳລັງຕິດຕັ້ງ", roles: [] },
      { stage: 6, label: "ລໍຖ້າກວດ QC", roles: ["headtechnical", "admin"] },
      { stage: 7, label: "ລໍຖ້າລູກຄ້າປະເມີນ", roles: ["admin"] },
      { stage: 8, label: "ລໍຖ້າປິດງານ", roles: ["admin"] },
      { stage: 9, label: "ປິດງານແລ້ວ", roles: [] },
      { stage: -1, label: "ຍົກເລີກແລ້ວ", roles: ["manager", "admin"] },
    ],
  },
  {
    workflow: "repair",
    label: "ງານສ້ອມແປງ",
    model: "tb_product",
    stages: [
      { stage: 0, label: "ລໍໄປຮັບເຄື່ອງ / ລໍນັດໝາຍ", roles: ["admin"] },
      { stage: 1, label: "ຮັບງານ / ລໍຖ້າກວດເຊັກ", roles: ["headtechnical"] },
      { stage: 2, label: "ກຳລັງກວດເຊັກ", roles: [] },
      { stage: 3, label: "ລໍຖ້າສະເໜີລາຄາ", roles: ["admin"] },
      { stage: 4, label: "ກຳລັງສະເໜີລາຄາ (ລໍອະນຸມັດ)", roles: ["manager"] },
      { stage: 5, label: "ກວດ Stock / ຊື້ ຫຼື ຂໍເບີກ", roles: ["stock"] },
      { stage: 6, label: "ກຳລັງເບີກອາໄຫຼ່", roles: ["stock"] },
      { stage: 7, label: "ກຳລັງສັ່ງຊື້", roles: ["manager", "stock"] },
      { stage: 8, label: "ລໍຖ້າສ້ອມ", roles: ["headtechnical"] },
      { stage: 9, label: "ກຳລັງສ້ອມ", roles: [] },
      { stage: 10, label: "ລໍກວດຮັບຄຸນນະພາບ (QC)", roles: ["headtechnical"] },
      { stage: 11, label: "ລໍຖ້າສົ່ງຄືນ / ປິດງານ", roles: ["admin"] },
      { stage: 12, label: "ສົ່ງຄືນແລ້ວ", roles: [] },
      { stage: -1, label: "ຍົກເລີກ (ລໍອະນຸມັດ)", roles: ["manager", "admin"] },
    ],
  },
  {
    workflow: "claim",
    label: "ເຄມ (Claim)",
    model: "tb_product",
    stages: [
      { stage: 1, label: "ຮັບຈາກຮ້ານ / ລໍຖ້າກວດ", roles: ["headtechnical"] },
      { stage: 2, label: "ກຳລັງກວດເຄມ", roles: [] },
      { stage: 13, label: "ລໍຕັດສິນຜົນເຄມ", roles: ["manager"] },
      { stage: 14, label: "ລໍປ່ຽນຈາກ Stock", roles: ["stock"] },
      { stage: 15, label: "ລໍຂອງຈາກການສັ່ງຊື້", roles: ["stock"] },
      { stage: 16, label: "ລໍຜົນ / ຂອງຈາກ Supplier", roles: ["admin"] },
      { stage: 11, label: "ລໍສົ່ງຄືນຮ້ານ", roles: ["admin"] },
    ],
  },
];

export const pushStatusKey = (workflow: string, stage: number, role: string) => `${workflow}:${stage}:${role}`;

/** ຄ່າຕັ້ງຕົ້ນ (ຈາກຕາຕະລາງເທິງ) ເປັນ Set ຂອງ key ທີ່ **ເປີດ** */
export const PUSH_STATUS_DEFAULT: Set<string> = new Set(
  PUSH_WORKFLOWS.flatMap((flow) =>
    flow.stages.flatMap((stage) => stage.roles.map((role) => pushStatusKey(flow.workflow, stage.stage, role))),
  ),
);

/** ເປີດບໍ — ຄ່າທີ່ຜູ້ຈັດການແກ້ເອງຊະນະຄ່າຕັ້ງຕົ້ນສະເໝີ */
export function pushStatusOn(
  overrides: Map<string, boolean>,
  workflow: string,
  stage: number,
  role: string,
): boolean {
  const key = pushStatusKey(workflow, stage, role);
  return overrides.get(key) ?? PUSH_STATUS_DEFAULT.has(key);
}
