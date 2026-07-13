import { query, queryOdg } from "@/lib/db";
import { ERP_IDENTITY_SQL, ERP_ROLE_CASE } from "@/lib/erp-auth";

/**
 * **ລາຍຊື່ຊ່າງ — ບ່ອນດຽວຂອງທັງລະບົບ.**
 *
 * ── ບັນຫາເກົ່າ ──
 * ທຸກໜ້າທີ່ຕ້ອງເລືອກຊ່າງຂຽນ `select code,username from users where roles='technical'`
 * ⇒ ດຶງຈາກ **ຕາຕະລາງຜູ້ໃຊ້ເກົ່າຂອງ ODS** ເຊິ່ງ:
 *   · ບໍ່ມີພະນັກງານໃໝ່ທີ່ຍັງບໍ່ເຄີຍມີແຖວ users (ຄົນເຂົ້າໃໝ່ ຈັດງານໃຫ້ບໍ່ໄດ້)
 *   · ບໍ່ຮູ້ຈັກ **ສິດທີ່ຜູ້ຈັດການກຳນົດເອງ** ຢູ່ /manage/employees (ods_employee_role)
 *     ⇒ ຕັ້ງໃຫ້ຄົນນຶ່ງເປັນ "ຊ່າງ" ແລ້ວ ແຕ່ຊື່ບໍ່ຂຶ້ນມາໃນລາຍການເລືອກ
 *   · ບໍ່ຮູ້ຈັກຄົນທີ່ຖືກ **ປິດບັນຊີ** ⇒ ຍັງຈັດງານໃຫ້ຄົນທີ່ອອກໄປແລ້ວໄດ້
 *
 * ── ດຽວນີ້ ──
 * ຕັ້ງຕົ້ນຈາກ **odg_employee (ACTIVE)** ແລ້ວຄິດ role ສຸດທ້າຍຕາມລຳດັບດຽວກັບຕອນ login
 * (lib/employee-role):
 *   ① ods_employee_role.app_role  ← ຜູ້ຈັດການກຳນົດເອງ ຢູ່ໜ້າກຳນົດສິດ (ສູງສຸດ)
 *   ② users.roles                 ← ຜູ້ໃຊ້ເກົ່າ ODS
 *   ③ ຕຳແໜ່ງ+ພະແນກ ຂອງ ERP        ← ERP_ROLE_CASE
 * ໃຜກາຍເປັນ technical / headtechnical = ຊ່າງ. active = false ⇒ ຕັດອອກ.
 *
 * ⚠️ **ຄ່າ `code` ຕ້ອງຕົງກັບ session.username ຂອງຄົນນັ້ນ** ບໍ່ດັ່ງນັ້ນຈັດງານໃຫ້ແລ້ວ
 * ລາວເປີດແອັບບໍ່ເຫັນ. ຄົນທີ່ **ເຊື່ອມຕົວຕົນແລ້ວ** (ods_user_employee) ໃຊ້ລະຫັດ ERP ·
 * ຄົນທີ່ຍັງບໍ່ເຊື່ອມ ໃຊ້ຊື່ຫຼິ້ນຄືເກົ່າ — ກົດເກນດຽວກັບ lib/credentials ເປັນະ.
 */
export type Technician = {
  /** ຄ່າທີ່ຈະຖືກຂຽນລົງ tech_code / emp_code — ຕົງກັບ session.username */
  code: string;
  /** ຊື່ທີ່ສະແດງ */
  name: string;
  employee_code: string;
  head: boolean;
};

type ErpRow = {
  employee_code: string;
  identity: string;
  fullname_lo: string;
  role: string;
};

export async function listTechnicians(): Promise<Technician[]> {
  const [erp, overrides, legacy, links] = await Promise.all([
    queryOdg<ErpRow>(
      `select e.employee_code, ${ERP_IDENTITY_SQL} as identity, e.fullname_lo, ${ERP_ROLE_CASE} as role
         from odg_employee e
        where e.employment_status = 'ACTIVE'
        order by e.fullname_lo`,
    ),
    query<{ employee_code: string; app_role: string; active: boolean }>(
      "select employee_code, coalesce(app_role,'') app_role, active from ods_employee_role",
    ),
    query<{ username: string; roles: string }>("select username, roles from users"),
    query<{ user_code: string; employee_code: string }>("select user_code, employee_code from ods_user_employee"),
  ]);

  const override = new Map(overrides.rows.map((row) => [row.employee_code, row]));
  const odsRole = new Map(legacy.rows.map((row) => [row.username.toLowerCase(), row.roles]));
  const linked = new Map(links.rows.map((row) => [row.employee_code, row.employee_code]));

  const rows: Technician[] = [];
  for (const employee of erp.rows) {
    const own = override.get(employee.employee_code);
    if (own && !own.active) continue; // ປິດບັນຊີແລ້ວ ⇒ ຈັດງານໃຫ້ບໍ່ໄດ້

    const role =
      own?.app_role ||
      odsRole.get(employee.employee_code.toLowerCase()) ||
      odsRole.get((employee.identity ?? "").toLowerCase()) ||
      employee.role;

    if (role !== "technical" && role !== "headtechnical") continue;

    const identity = employee.identity || employee.fullname_lo || employee.employee_code;
    rows.push({
      // ເຊື່ອມຕົວຕົນແລ້ວ ⇒ ລະຫັດ ERP · ຍັງບໍ່ເຊື່ອມ ⇒ ຊື່ຫຼິ້ນ (ຄືກັບຕອນ login)
      code: linked.has(employee.employee_code) ? employee.employee_code : identity,
      name: employee.fullname_lo || identity,
      employee_code: employee.employee_code,
      head: role === "headtechnical",
    });
  }

  return rows.sort((a, b) => a.name.localeCompare(b.name, "lo"));
}
