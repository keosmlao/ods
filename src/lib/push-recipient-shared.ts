/**
 * **ນິຍາມປະເພດ push ທີ່ກຳນົດຜູ້ຮັບໄດ້** — ພາກທີ່**ບໍ່ແຕະຖານຂໍ້ມູນ** ຈຶ່ງ client import ໄດ້.
 * ພາກທີ່ຖາມຖານຢູ່ lib/push-recipient.ts
 * (ດຶງ lib ທີ່ import @/lib/db ເຂົ້າ client = pg → dns → build ລົ້ມ)
 *
 * ── ກຳນົດແຕ່ 2 ປະເພດ ──
 * push ທີ່ **ຍິງໃສ່ຄົນນັ້ນໂດຍກົງ** (ຊ່າງຖືກມອບງານ · ຂໍ້ຄວາມແຊັດ) **ບໍ່ຢູ່ໃນນີ້ ໂດຍຕັ້ງໃຈ**:
 * ມັນຄືວຽກຂອງລາວເອງທີ່ຕ້ອງຮອດຕົວສະເໝີ — ປິດໄດ້ = ຊ່າງບໍ່ຮູ້ວ່າມີງານ ແລ້ວໂທດຕົກໃສ່ລະບົບ.
 */

export const PUSH_KINDS = ["approval", "digest"] as const;
export type PushKind = (typeof PUSH_KINDS)[number];

export const PUSH_KIND_META: Record<PushKind, { label: string; help: string; fallback: string }> = {
  approval: {
    label: "ເອກະສານລໍອະນຸມັດ",
    help:
      "ຍິງທັນທີເມື່ອມີເອກະສານເຂົ້າຄິວລໍການຕັດສິນ: ອອກໃບສະເໜີລາຄາ · ຂໍຍົກເລີກໃບຮັບເຄື່ອງ · " +
      "ຊ່າງກວດແລ້ວຂໍປ່ຽນເປັນ “ໝົດປະກັນ”. ນັບຈິງບໍ່ຮອດ 20 ຄັ້ງ/ມື້ ⇒ ບໍ່ລົບກວນ.",
    fallback: "ຜູ້ຈັດການ ແລະ ຫົວໜ້າຊ່າງ ທຸກຄົນ",
  },
  digest: {
    label: "ສະຫຼຸບການເຄື່ອນໄຫວ (ທຸກ 15 ນາທີ)",
    help:
      "ຮວບການເຄື່ອນໄຫວທີ່ຍັງບໍ່ໄດ້ອ່ານເປັນຂໍ້ຄວາມດຽວ “ມີການເຄື່ອນໄຫວ 37 ລາຍການໃໝ່…”. " +
      "ຍິງທຸກແຖວບໍ່ໄດ້ — ວັດຈິງ 154,689 ແຖວ/ມື້ ⇒ ມືຖືສັ່ນທຸກນາທີ ແລ້ວຄົນຈະປິດແຈ້ງເຕືອນຖິ້ມ. " +
      "⚠️ ກ່ອງແຈ້ງເຕືອນຢູ່ເວັບ/ແອັບ **ຍັງເຫັນຄົບທຸກແຖວ** ບໍ່ວ່າຈະຕັ້ງແນວໃດ — ອັນນີ້ຄຸມແຕ່ສຽງເອີ້ນ.",
    fallback: "ທຸກຄົນທີ່ໄດ້ຮັບແຈ້ງເຕືອນນັ້ນ (ຜູ້ຈັດການໄດ້ຮັບທຸກການເຄື່ອນໄຫວ)",
  },
};

/** ຄົນທີ່ເລືອກໄດ້ = ຄົນທີ່ມີເຄື່ອງຈິງ ຫຼື ເຄີຍ login ແອັບ — ເບິ່ງ pushAudience() */
export type PushPerson = {
  /** = session.username (ລະຫັດພະນັກງານ ຖ້າເຊື່ອມແລ້ວ, ບໍ່ດັ່ງນັ້ນຊື່ຫຼິ້ນ) — ເບິ່ງ lib/session-identity */
  username: string;
  /** ຊື່ອ່ານງ່າຍ — username ອາດເປັນລະຫັດ ('22020') ຈຶ່ງຕ້ອງມີຊື່ຄຽງ */
  name: string;
  role: string;
  devices: number;
  platform: string | null;
  last_login: string | null;
};

export type PushChoice = { kind: PushKind; username: string; active: boolean; updated_by: string | null };
