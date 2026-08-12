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

/**
 * **ລະຫັດພະນັກງານ ERP ຂອງສູນບໍລິການ** — ຄົນທີ່ມີບັນຊີຢູ່ ODSS ຄືພະນັກງານສູນ
 * ⇒ ໃບທີ່ເຂົາອອກ (creator_code) ເປັນໃບຂອງສູນ ເຖິງ ERP ຈະບໍ່ໄດ້ຕິດ `side_code` ໃຫ້.
 *
 * ໃຊ້ຢູ່ໜ້າ PO ເພື່ອກອງເອົາສະເພາະໃບຂອງສູນ — ຂໍ້ມູນຈິງ (12-08-2026) ພະນັກງານທີ່
 * ອອກ PO ຈິງມີ 23015 (ຈັດຊື້ຂອງສູນ) ແລະ 25009 ⇒ ຕື່ມ 10 ໃບທີ່ side_code ຫວ່າງ.
 *
 * ຂ້າມຖານກັນ join ບໍ່ໄດ້ (ລາຍຊື່ຢູ່ ODS · ໃບຢູ່ ERP) ⇒ ດຶງລາຍຊື່ກ່ອນ ແລ້ວສົ່ງເປັນ
 * array param ໃຫ້ query ຝັ່ງ ERP. ລົ້ມ ⇒ ຄືນ [] (ໜ້າຍັງເປີດໄດ້ ພຽງແຕ່ຂາດຂໍ້ ③).
 *
 * **ຈື່ໄວ້ 5 ນາທີ** — ລາຍຊື່ພະນັກງານປ່ຽນປີລະເທື່ອສອງເທື່ອ ແຕ່ໜ້າ PO ຖາມທຸກຄັ້ງທີ່ເປີດ
 * ⇒ ເສຍ round-trip ຂ້າມຖານຟຣີໆ. ຜູກຄູ່ພະນັກງານໃໝ່ແລ້ວ ລໍບໍ່ເກີນ 5 ນາທີກໍເຫັນຜົນ.
 */
const STAFF_TTL_MS = 5 * 60 * 1000;
let staffCache: { at: number; codes: string[] } | null = null;

export async function serviceStaffCodes(): Promise<string[]> {
  if (staffCache && Date.now() - staffCache.at < STAFF_TTL_MS) return staffCache.codes;
  try {
    const rows = await query<{ code: string }>(
      `select employee_code code from ods_user_employee where employee_code ~ '^[0-9]+$'
        union select code from users where code ~ '^[0-9]+$'
        union select username from users where username ~ '^[0-9]+$'`,
    );
    const codes = rows.rows.map((r) => r.code);
    staffCache = { at: Date.now(), codes };
    return codes;
  } catch (error) {
    console.error("serviceStaffCodes failed", error);
    // ຄືນຄ່າເກົ່າຖ້າມີ — ດີກວ່າໃຫ້ໜ້າຂາດໃບຂອງພະນັກງານໄປທັງໜ້າ
    return staffCache?.codes ?? [];
  }
}
