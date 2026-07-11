import { query } from "@/lib/db";

/**
 * ສິດທີ່ຜູ້ຈັດການກຳນົດເອງ (ods_employee_role — ຢູ່ຖານ ODS).
 *
 * ຖານ ERP ອ່ານໄດ້ຢ່າງດຽວ (odg_employee.app_role ເປັນ NULL ທັງ 242 ຄົນ ແລະ ຫ້າມຂຽນ)
 * ⇒ ການກຳນົດສິດຂອງແອັບນີ້ຈຶ່ງເກັບໄວ້ຖານຕົນເອງ ແລ້ວທາບໃສ່ພະນັກງານ ERP ດ້ວຍ employee_code.
 *
 * ລຳດັບຄວາມສຳຄັນຂອງ role ຕອນ login (ແລະ ຕອນຫາຜູ້ຮັບການແຈ້ງເຕືອນ):
 *   1. ods_employee_role.app_role  ← ຜູ້ຈັດການກຳນົດເອງ ຢູ່ໜ້າ /manage/employees (ສູງສຸດ)
 *   2. users.roles                 ← ຜູ້ໃຊ້ເກົ່າຂອງ ODS (ຮັກສາໄວ້ຄືເກົ່າ)
 *   3. roleFromErp()               ← ຄິດຈາກ ຕຳແໜ່ງ + ພະແນກ ຂອງ ERP
 *
 * active = false ⇒ ຄົນນັ້ນ login ບໍ່ໄດ້ ແລະ ບໍ່ໄດ້ຮັບການແຈ້ງເຕືອນອີກ.
 *
 * ໝາຍເຫດ: app_role ຂອງຕາຕະລາງນີ້ເປັນ NOT NULL ⇒ "ບໍ່ກຳນົດສິດເອງ ແຕ່ຖືກປິດການໃຊ້ງານ"
 * ຈຶ່ງເກັບເປັນຄ່າຫວ່າງ ('') ບໍ່ແມ່ນ NULL. ຄ່າຫວ່າງ = ບໍ່ມີການກຳນົດເອງ (ໃຫ້ຕົກໄປໃຊ້ຂໍ້ 2/3).
 */

export type EmployeeOverride = {
  employee_code: string;
  identity: string;
  /** ຄ່າຫວ່າງ = ບໍ່ໄດ້ກຳນົດສິດເອງ (ແຖວນີ້ມີໄວ້ເກັບສະຖານະ active ຢ່າງດຽວ) */
  app_role: string;
  active: boolean;
  updated_by: string;
  updated_at: string | null;
};

const SELECT = `select employee_code, identity, coalesce(app_role,'') app_role, active, updated_by,
                       to_char(updated_at,'DD-MM-YYYY HH24:MI') updated_at
                  from ods_employee_role`;

/** ການກຳນົດສິດຂອງພະນັກງານຄົນດຽວ — null ຖ້າບໍ່ເຄີຍຖືກກຳນົດ */
export async function getEmployeeOverride(employeeCode: string): Promise<EmployeeOverride | null> {
  const rows = (await query<EmployeeOverride>(`${SELECT} where employee_code = $1 limit 1`, [employeeCode])).rows;
  return rows[0] ?? null;
}

/**
 * ແຖວທີ່ຖືກປິດການໃຊ້ງານ ຊຶ່ງກົງກັບຊື່ຜູ້ໃຊ້ນີ້ — ໃຊ້ຕອນ login ທາງຜູ້ໃຊ້ເກົ່າ (users)
 * ບໍ່ດັ່ງນັ້ນຄົນທີ່ຖືກປິດຈະຫຼົບເຂົ້າທາງນັ້ນໄດ້ຢູ່.
 */
export async function isBlockedIdentity(username: string): Promise<boolean> {
  const rows = (
    await query<{ n: number }>(
      `select 1 n from ods_employee_role
        where active = false
          and (lower(employee_code) = lower($1) or lower(identity) = lower($1))
        limit 1`,
      [username],
    )
  ).rows;
  return rows.length > 0;
}

/** ທຸກແຖວ (ຕາຕະລາງນ້ອຍ — ພະນັກງານທັງບໍລິສັດ 242 ຄົນ) */
export async function listEmployeeOverrides(): Promise<EmployeeOverride[]> {
  return (await query<EmployeeOverride>(`${SELECT} order by employee_code`)).rows;
}
