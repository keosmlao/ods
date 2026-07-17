/**
 * **ບົດບາດຜູ້ຮັບຄ່າຄອມ — ຄ່າຄົງທີ່ລ້ວນໆ (ບໍ່ແຕະຖານຂໍ້ມູນ).**
 *
 * ແຍກອອກຈາກ `lib/commission` ດ້ວຍເຫດຜົນດຽວກັນກັບ `lib/cust-kind`:
 * client component (manage/service-rates/rate-forms.tsx) ໃຊ້ `ROLE_LABEL` ຢູ່,
 * ແຕ່ `lib/commission` ດຶງ `employeeCode` → `lib/db` → `pg` ⇒ ຖ້າ client import
 * ຈາກນັ້ນ, bundler ດຶງ `pg` ເຂົ້າ browser ແລ້ວ **build ພັງ** (dev ແລະ typecheck
 * ຈັບບໍ່ໄດ້ ເຫັນແຕ່ຕອນ `next build`).
 * ⇒ ຄ່າທີ່ **ສອງຝັ່ງໃຊ້ຮ່ວມກັນ** ຕ້ອງຢູ່ໄຟລ໌ທີ່ບໍ່ import ຫຍັງເລີຍ ຄືອັນນີ້.
 */

export type Workflow = "repair" | "install";

export const ROLE_LABEL: Record<string, string> = {
  supervisor: "ຜູ້ຄຸມ",
  team_lead: "ຫົວໜ້າທີມ",
  admin: "Admin",
  technician: "ຊ່າງ",
};
