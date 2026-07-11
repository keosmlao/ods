import { STAGE_SQL } from "@/lib/stage";

/** ເງື່ອນໄຂ "ຢູ່ຂັ້ນນີ້" ຂອງ tb_product (alias a) — ບໍ່ຕ້ອງ join view ອີກຕໍ່ໄປ */
const stageIs = (stage: number) => `(${STAGE_SQL}) = ${stage}`;

export const repairStatuses: Record<string, { label: string; condition: string }> = {
  "wait-check": { label: "ລໍຖ້າກວດເຊັກ", condition: stageIs(1) },
  checking: { label: "ກຳລັງກວດເຊັກ", condition: stageIs(2) },
  "wait-quote": { label: "ລໍຖ້າສະເໜີລາຄາ", condition: stageIs(3) },
  quoting: { label: "ກຳລັງສະເໜີລາຄາ", condition: stageIs(4) },
  "wait-withdraw": { label: "ລໍຖ້າເບີກອາໄຫຼ່", condition: stageIs(5) },
  withdrawing: { label: "ກຳລັງເບີກອາໄຫຼ່", condition: stageIs(6) },
  purchasing: { label: "ກຳລັງສັ່ງຊື້", condition: stageIs(7) },
  "wait-repair": { label: "ລໍຖ້າສ້ອມ", condition: stageIs(8) },
  repairing: { label: "ກຳລັງສ້ອມ", condition: stageIs(9) },
  "wait-return": { label: "ລໍຖ້າສົ່ງຄືນ", condition: stageIs(10) },
  // ບໍ່ມີ "ຂໍ້ມູນຜິດປົກກະຕິ" ອີກຕໍ່ໄປ — STAGE_SQL ໃຫ້ຂັ້ນທຸກໃບສະເໝີ ຈຶ່ງຕົກຫຼົ່ນບໍ່ໄດ້
};

export const installStatuses: Record<string, { label: string; condition: string }> = {
  "wait-assign": { label: "ລໍຖ້າຈັດຊ່າງ", condition: "a.tech_code is null" },
  "wait-accept": { label: "ລໍຖ້າຊ່າງຮັບງານ", condition: "a.tech_code is not null and a.tech_confirm is null" },
  "wait-register": { label: "ລໍຖ້າຂໍເບີກ", condition: "a.reg_start is null and a.used_spare=1 and a.tech_code is not null and a.tech_confirm is not null" },
  "wait-dispatch": { label: "ລໍຖ້າສາງເບີກ", condition: "a.reg_start is not null and a.reg_finish is null and a.used_spare=1" },
  "wait-pick": { label: "ລໍຖ້າຮັບອາໄຫຼ່", condition: "a.reg_finish is not null and a.pick_finish is null and a.used_spare=1" },
  "wait-install": { label: "ລໍຖ້າຕິດຕັ້ງ", condition: "a.start_install is null and a.tech_code is not null and a.tech_confirm is not null and (a.used_spare=0 or a.pick_finish is not null)" },
  installing: { label: "ກຳລັງຕິດຕັ້ງ", condition: "a.start_install is not null and a.finish_install is null" },
  "wait-feedback": { label: "ລໍຖ້າ feedback", condition: "a.finish_install is not null and a.complain_finish is null" },
  "wait-close": { label: "feedback ແລ້ວ/ລໍຖ້າປິດ", condition: "a.finish_install is not null and a.complain_finish is not null and a.job_finish is null" },
};
