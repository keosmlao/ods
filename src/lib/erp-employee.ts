import { query } from "@/lib/db";

/**
 * **ຜູ້ໃຊ້ ODSS → ລະຫັດພະນັກງານ ERP** — ນິຍາມ**ບ່ອນດຽວ**ຂອງລະບົບ.
 *
 * ── ເປັນຫຍັງຕ້ອງມີ ──
 * ERP ເກັບ `creator_code` / `user_request` ເປັນ**ລະຫັດພະນັກງານ** (25060) ບໍ່ແມ່ນຊື່ login
 * ('keo', 'stk') ⇒ ຂຽນຊື່ login ລົງໄປ ERP ຈະບໍ່ຮູ້ຈັກ.
 *
 * ── ⚠️ ບົດຮຽນ (17-07-2026) ──
 * ຟັງຊັນນີ້ເຄີຍຖືກ**ກ໋ອບໄວ້ 3 ບ່ອນ** (erp-spr · erp-po · erp-request) ແລະ ທຸກສຳເນົາ
 * ຫາແຕ່ 2 ບ່ອນ: ຊື່ login ທີ່ເປັນຕົວເລກ, ແລະ ຕາຕະລາງ `ods_user_employee`.
 * ບໍ່ມີສຳເນົາໃດເບິ່ງ **`users.code`** ທັງທີ່ຜູ້ໃຊ້ບາງຄົນມີລະຫັດພະນັກງານຢູ່ນັ້ນແລ້ວ
 * (ຕົວຢ່າງຈິງ: Mutsar → 25060 = "ມັດສາ ສາຍສຸດ" ມີໃນ ERP ແທ້) ⇒ ໃບທີ່ລາວອອກ
 * ໄປລົງ ERP ໂດຍ**ບໍ່ມີຊື່ຜູ້ສ້າງ** ທັງທີ່ຂໍ້ມູນມີພ້ອມ. ນິຍາມມີບ່ອນດຽວ — ອ້າງອີງມັນ.
 *
 * ຫາບໍ່ພົບ ⇒ ຄືນ "" (ດີກວ່າຂຽນຊື່ຫຼິ້ນລົງ ERP) ພ້ອມ warn ໄວ້ໃນ log ໃຫ້ຕາມແກ້ໄດ້ —
 * ຜູ້ຈັດການຜູກຄູ່ໃຫ້ຢູ່ໜ້າ /manage/technicians (ຕາຕະລາງ ods_user_employee).
 */
export async function employeeCode(username: string): Promise<string> {
  const name = username.trim();
  if (!name) return "";
  // ① ຊື່ login ເປັນລະຫັດພະນັກງານຢູ່ແລ້ວ (ພະນັກງານສ່ວນຫຼາຍ login ດ້ວຍລະຫັດ)
  if (/^\d+$/.test(name)) return name;

  const row = (
    await query<{ employee_code: string }>(
      `select e.employee_code
         from ods_user_employee e
        where lower(e.user_code) = lower($1)
        limit 1`,
      [name],
    )
  ).rows[0];
  // ② ຄູ່ທີ່ຜູ້ຈັດການຜູກໄວ້
  if (row?.employee_code) return row.employee_code;

  // ③ users.code ເປັນລະຫັດພະນັກງານ (ຂໍ້ມູນທີ່ສຳເນົາເກົ່າມອງຂ້າມ)
  const legacy = (
    await query<{ code: string }>(
      `select code from users where lower(username) = lower($1) and code ~ '^[0-9]+$' limit 1`,
      [name],
    )
  ).rows[0];
  if (legacy?.code) return legacy.code;

  console.warn(`employeeCode: ຜູ້ໃຊ້ "${name}" ຍັງບໍ່ໄດ້ຜູກລະຫັດພະນັກງານ ERP — ໃບຈະບໍ່ມີຊື່ຜູ້ສ້າງ`);
  return "";
}
