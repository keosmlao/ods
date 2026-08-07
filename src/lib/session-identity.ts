import { query } from "@/lib/db";

/**
 * **ຊື່ຜູ້ໃຊ້ຂອງພະນັກງານ ERP = ຊື່ທີ່ລາວ login ດ້ວຍ** — ນິຍາມ**ບ່ອນດຽວ**.
 *
 * ── ກົດ (ຕົ້ນສະບັບຢູ່ credentials.ts) ──
 * ຕອນ login ຄືນ `linked?.employee_code ?? identity` ⇒
 *   · **ເຊື່ອມແລ້ວ** (ມີແຖວໃນ ods_user_employee — ໜ້າ /manage/technicians) ⇒ **ລະຫັດ ERP** ('22020')
 *   · **ຍັງບໍ່ເຊື່ອມ** ⇒ **ຊື່ຫຼິ້ນ** ('ສັກດາ')
 *
 * ── ⚠️ ເປັນຫຍັງທຸກບ່ອນຕ້ອງໃຊ້ກົດອັນນີ້ ──
 * ທຸກຢ່າງທີ່ຜູກກັບ "ຄົນ" ເກັບດ້ວຍ **session.username**:
 *   `ods_notification.username` · `ods_chatter_follower.username` · `ods_push_token.user_code`
 * ຄິດຕົວຕົນຄົນລະຢ່າງ = ຂຽນໃສ່ຊື່ທີ່**ບໍ່ມີໃຜ login ດ້ວຍ** ⇒ ງຽບຫາຍໄປ ໂດຍບໍ່ມີ error.
 * (ເກີດຂຶ້ນຈິງ: ຜູ້ຈັດການບໍ່ໄດ້ຮັບ push ຂອງ role ຈັກເທື່ອ ເພາະ token ຢູ່ '22020'
 *  ແຕ່ຍິງໃສ່ 'ແກ້ວ' — ແກ້ 08-08-2026)
 *
 * ── ⚠️ ຢ່າແກ້ດ້ວຍການ "ໄລ່ຫາຊື່ອື່ນຂອງຄົນດຽວກັນ" ──
 * ຊື່ຫຼິ້ນ**ຊ້ຳກັນໄດ້** (ຈິງ: 'ແກ້ວ' 3 ຄົນ · 'ນ້ອຍ' 6 ຄົນ) ⇒ ຈະໄປສັ່ນມືຖືຄົນຜິດ.
 * ໃຊ້ລະຫັດພະນັກງານຕັ້ງແຕ່ຕົ້ນທາງ ຈຶ່ງບໍ່ມີທາງຊ້ຳ.
 */

/** ລະຫັດພະນັກງານທີ່**ຖືກເຊື່ອມແລ້ວ** — ຄົນເຫຼົ່ານີ້ login ດ້ວຍລະຫັດ ບໍ່ແມ່ນຊື່ຫຼິ້ນ */
export async function linkedEmployeeCodes(codes: string[]): Promise<Set<string>> {
  const wanted = codes.filter(Boolean);
  if (!wanted.length) return new Set();
  try {
    const rows = (
      await query<{ employee_code: string }>(
        "select employee_code from ods_user_employee where employee_code = any($1::text[])",
        [wanted],
      )
    ).rows;
    return new Set(rows.map((row) => row.employee_code));
  } catch (error) {
    // ຫາຄູ່ບໍ່ໄດ້ → ຖອຍໄປໃຊ້ຊື່ຫຼິ້ນຄືເກົ່າ ດີກວ່າບໍ່ແຈ້ງໃຜເລີຍ
    console.error("linkedEmployeeCodes failed", error);
    return new Set();
  }
}

/** ຊື່ຜູ້ໃຊ້ຂອງພະນັກງານຄົນນຶ່ງ — ໃຊ້ຄູ່ກັບ linkedEmployeeCodes() ຂ້າງເທິງ */
export function sessionIdentity(
  employeeCode: string,
  identity: string | null,
  linked: Set<string>,
): string {
  return linked.has(employeeCode) ? employeeCode : (identity ?? "").trim();
}
