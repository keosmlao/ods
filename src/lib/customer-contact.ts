/**
 * ຄິວແຈ້ງລູກຄ້າ — ງານທີ່ **ລໍລູກຄ້າລົງມື** ແລະ ຈະບໍ່ຂະຫຍັບຈົນກວ່າຈະມີຄົນໂທໄປ.
 *
 * ── ເປັນຫຍັງຕ້ອງມີ ──
 * LINE Notify ທີ່ ods ໃຊ້ແຈ້ງລູກຄ້າ **ປິດບໍລິການແລ້ວ** (31-03-2025) ແລະ ບໍ່ມີຫຍັງມາແທນ
 * ⇒ ບໍ່ມີໃຜຮູ້ວ່າໃບໃດແຈ້ງລູກຄ້າໄປແລ້ວ ໃບໃດຍັງ. ຂໍ້ມູນຈິງ: **24 ໃບ** ນອນລໍລູກຄ້າຕັດສິນ
 * ລາຄາຢູ່ ໂດຍບໍ່ມີບ່ອນບອກວ່າໂທໄປແລ້ວ ຫຼື ຍັງ.
 *
 * ── ບໍ່ເພີ່ມຕາຕະລາງ ──
 * "ແຈ້ງແລ້ວ" ບັນທຶກເປັນຂໍ້ຄວາມ chatter ຂອງໃບນັ້ນ (ods_chatter_message) ດ້ວຍຄຳນຳໜ້າ
 * ຄົງທີ່ ⇒ ໄດ້ທັງປະຫວັດ (ໃຜໂທ ເມື່ອໃດ ເວົ້າຫຍັງ) ແລະ ຕົວກອງຄິວ ໂດຍບໍ່ຕ້ອງແກ້ schema.
 * ບໍ່ແມ່ນການສົ່ງຂໍ້ຄວາມອັດຕະໂນມັດ — ລະບົບບໍ່ມີຊ່ອງທາງສົ່ງ (ບໍ່ມີ SMS gateway).
 * ອັນນີ້ຄື **ບັນຊີວຽກໂທ** ພ້ອມຂໍ້ຄວາມແມ່ແບບ ແລະ ເບີໂທໃຫ້ກົດໂທໄດ້ເລີຍ.
 */

export type ContactKind = "quote" | "pickup" | "appointment";

export const CONTACT_LABEL: Record<ContactKind, string> = {
  quote: "ລໍລູກຄ້າຕັດສິນລາຄາ",
  pickup: "ມາຮັບເຄື່ອງໄດ້ແລ້ວ",
  appointment: "ຢືນຢັນວັນນັດຕິດຕັ້ງ",
};

/** ຄຳນຳໜ້າຂອງບັນທຶກ chatter — ຄົງທີ່ ເພາະ SQL ຂອງຄິວກອງດ້ວຍອັນນີ້ */
export const contactMark = (kind: ContactKind) => `ແຈ້ງລູກຄ້າ (${CONTACT_LABEL[kind]})`;

/** ຂໍ້ຄວາມແມ່ແບບ — ພະນັກງານກັອບປີ້ໄປສົ່ງ ຫຼື ອ່ານທາງໂທລະສັບ */
export const MESSAGE_TEMPLATE: Record<ContactKind, (job: ContactJob) => string> = {
  quote: (job) =>
    `ສະບາຍດີ ${job.customer ?? "ທ່ານລູກຄ້າ"} — ODIEN SERVICE ແຈ້ງວ່າ ${job.product ?? "ເຄື່ອງ"} (ໃບຮັບເຄື່ອງ #${job.code}) ກວດເຊັກແລ້ວ ແລະ ມີໃບສະເໜີລາຄາໃຫ້ທ່ານພິຈາລະນາ. ກະລຸນາຢືນຢັນວ່າຈະໃຫ້ດຳເນີນການສ້ອມແປງຫຼືບໍ່.`,
  pickup: (job) =>
    `ສະບາຍດີ ${job.customer ?? "ທ່ານລູກຄ້າ"} — ${job.product ?? "ເຄື່ອງ"} (ໃບຮັບເຄື່ອງ #${job.code}) ສ້ອມແປງ ແລະ ຜ່ານການກວດຮັບຄຸນນະພາບແລ້ວ. ເຊີນມາຮັບເຄື່ອງໄດ້ທີ່ ODIEN SERVICE ຫຼື ແຈ້ງໃຫ້ຈັດສົ່ງ.`,
  appointment: (job) =>
    `ສະບາຍດີ ${job.customer ?? "ທ່ານລູກຄ້າ"} — ODIEN SERVICE ຂໍຢືນຢັນນັດຕິດຕັ້ງ ${job.product ?? ""} (ງານ ${job.code}) ວັນທີ ${job.at ?? "-"}. ຖ້າບໍ່ສະດວກ ກະລຸນາແຈ້ງລ່ວງໜ້າ.`,
};

export type ContactJob = {
  kind: ContactKind;
  code: string;
  customer: string | null;
  tel: string | null;
  product: string | null;
  /** ວັນທີທີ່ກ່ຽວຂ້ອງ — ວັນນັດ ຫຼື ວັນທີເຂົ້າຄິວ */
  at: string | null;
  waiting_seconds: number;
  /** ໂທໄປແລ້ວເທື່ອຫຼ້າສຸດເມື່ອໃດ (null = ຍັງບໍ່ເຄີຍແຈ້ງ) */
  last_contact: string | null;
  contacts: number;
};

/** ຕາຕະລາງທີ່ chatter ຂອງແຕ່ລະປະເພດຊີ້ໄປຫາ */
export const CONTACT_MODEL: Record<ContactKind, "tb_product" | "ods_tb_install"> = {
  quote: "tb_product",
  pickup: "tb_product",
  appointment: "ods_tb_install",
};
