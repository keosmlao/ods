/**
 * **ຍິງອັນໃດເຂົ້າແອັບ** — ນິຍາມປະເພດການເຄື່ອນໄຫວ ທີ່ຜູ້ຈັດການເປີດ/ປິດ Firebase push ໄດ້.
 * ພາກທີ່ບໍ່ແຕະຖານ ⇒ client import ໄດ້ (ພາກຖານຢູ່ lib/push-event.ts).
 *
 * ── ⚠️ ຄຸມແຕ່ **push ເຂົ້າມືຖື** ເທົ່ານັ້ນ ──
 * ກ່ອງແຈ້ງເຕືອນຢູ່ **ເວັບ ແລະ ໃນແອັບ ຍັງເຫັນຄົບ 100%** ບໍ່ວ່າຈະປິດອັນໃດ — ແຖວຍັງຖືກ
 * ບັນທຶກລົງ `ods_notification` ຄືເກົ່າ ⇒ ປະຫວັດບໍ່ຫາຍ ແລະ ໄລ່ຫາຫຼັງໄດ້ຢູ່.
 * ອັນນີ້ຄຸມ**ສຽງເອີ້ນ**ຢ່າງດຽວ: ມືຖືຈະສັ່ນ ຫຼື ບໍ່ສັ່ນ.
 *
 * ── ເປັນຫຍັງແບ່ງດ້ວຍ (ປະເພດງານ × ປະເພດເຫດການ) ──
 * ນີ້ຄືສອງຄ່າທີ່ `notify()` ມີຢູ່ໃນມືຈິງ (`model` + `kind`) ⇒ ຄຸມໄດ້ທັນທີ ໂດຍບໍ່ຕ້ອງໄປ
 * ຕິດລະຫັດເຫດການໃສ່ 171 ບ່ອນທີ່ເອີ້ນ `logChange`. ຢາກລະອຽດກວ່ານີ້ (ເຊັ່ນ ແຍກ
 * "ປິດງານ" ອອກຈາກ "check-in") ຕ້ອງຕິດລະຫັດໃສ່ບ່ອນເອີ້ນກ່ອນ — ຍັງບໍ່ໄດ້ເຮັດ.
 */

/** ປະເພດງານ = `ods_notification.model` — ເອົາຕາມທີ່ມີຈິງໃນຖານ */
export const PUSH_MODELS = [
  { model: "ods_tb_install", label: "ງານຕິດຕັ້ງ" },
  { model: "tb_product", label: "ງານສ້ອມແປງ" },
  { model: "ods_tb_maintenance", label: "ງານບຳລຸງຮັກສາ" },
  { model: "ods_claim", label: "ເຄມ (Claim)" },
  { model: "ic_trans", label: "ບິນ / ສາງ" },
  { model: "ar_customer", label: "ລູກຄ້າ" },
] as const;

/** ປະເພດເຫດການ = `ods_notification.kind` (ຄືກັນກັບ NOTIFICATION_KIND_LABEL ຂອງ chatter) */
export const PUSH_EVENT_KINDS = [
  { kind: "assign", label: "ມອບໝາຍ", help: "ງານຖືກມອບ/ຮັບຊ່ວງໃຫ້ຄົນນຶ່ງ" },
  { kind: "comment", label: "ຂໍ້ຄວາມ", help: "ຄົນພິມຂໍ້ຄວາມໃສ່ເອກະສານ" },
  { kind: "log", label: "ຄວາມເຄື່ອນໄຫວ", help: "ເປີດ · ເລີ່ມ · QC · ປິດງານ · ແກ້ໄຂ ແລະ ອື່ນໆ" },
] as const;

export type PushEvent = { model: string; kind: string; enabled: boolean };

export const pushEventKey = (model: string, kind: string) => `${model}:${kind}`;

/** ບໍ່ມີແຖວ = **ເປີດ** (ຄືພຶດຕິກຳກ່ອນມີໜ້ານີ້) — ກົດດຽວກັນກັບ ods_setting */
export function pushEventOn(disabled: Set<string>, model: string, kind: string): boolean {
  return !disabled.has(pushEventKey(model, kind));
}
