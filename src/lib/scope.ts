import type { Session } from "@/lib/auth";

/**
 * ວຽກຂອງໃຜ — ກົດເກນກາງອັນດຽວຂອງລະບົບ.
 *
 * ຊ່າງ (technical) ເຫັນສະເພາະວຽກຂອງຕົນເອງ.
 * ຄົນອື່ນທັງໝົດ (ຜູ້ຈັດການ, admin, CS, ສາງ, ພະນັກງານທົ່ວໄປ) ເຫັນທຸກວຽກ.
 *
 * ຄືນ username ຖ້າຕ້ອງກອງ, ຫຼື null ຖ້າເຫັນໝົດ.
 *
 * ໝາຍເຫດ: ໜ້າກວດເຊັກເຄີຍໃຊ້ `role !== "manager"` ຕາມ ods —
 * ແຕ່ role ດຽວນີ້ມາຈາກພະແນກໃນ odg_employee ຈຶ່ງບໍ່ມີໃຜເປັນ "manager"
 * ຜົນຄື ທຸກຄົນຖືກກອງແລ້ວເຫັນ 0 ວຽກ.
 */
export function ownJobsOnly(session: Session | null): string | null {
  return session?.role === "technical" ? session.username : null;
}
