import { type Session, verifyWerkzeugPassword } from "@/lib/auth";
import { query, queryOdg } from "@/lib/db";
import { getEmployeeOverride, isBlockedIdentity } from "@/lib/employee-role";
import { ERP_IDENTITY_SQL, roleFromErp, verifyErpPassword } from "@/lib/erp-auth";

/**
 * ກວດຊື່ຜູ້ໃຊ້ + ລະຫັດຜ່ານ — **ບ່ອນດຽວຂອງລະບົບ**.
 *
 * ໃຊ້ຮ່ວມກັນລະຫວ່າງ ໜ້າ login ຂອງເວັບ (actions/auth) ແລະ API ຂອງແອັບມືຖື
 * (/api/mobile/login). ຖ້າແຍກສອງບ່ອນ ມື້ໜຶ່ງກົດເກນຈະບໍ່ຕົງກັນ — ເຊັ່ນ ຄົນທີ່
 * ຜູ້ຈັດການປິດບັນຊີໄວ້ ຈະຍັງເຂົ້າທາງແອັບໄດ້ ⇒ ຮູຮົ່ວທີ່ບໍ່ມີໃຜເຫັນ.
 */

export const BLOCKED = "ບັນຊີນີ້ຖືກປິດການໃຊ້ງານ ກະລຸນາຕິດຕໍ່ຜູ້ຈັດການ";
export const BAD_CREDENTIALS = "ລະຫັດພະນັກງານ ຫຼື ລະຫັດຜ່ານບໍ່ຖືກຕ້ອງ";

type ErpEmployee = {
  employee_code: string;
  /** ຊື່ທີ່ຈະເກັບເປັນຕົວຕົນໃນລະບົບ — ຕົງກັບຄ່າທີ່ເກັບໃນ tb_product.emp_code */
  identity: string;
  fullname_lo: string;
  department_code: string | null;
  position_code: string | null;
  app_role: string | null;
  password: string | null;
};

type OdsUser = { roles: string; password: string | null; password_hash: string | null };

/** ຮັບໄດ້ທັງ ລະຫັດພະນັກງານ, ຊື່ຫຼິ້ນ ຫຼື ຊື່ເຕັມ */
const ERP_SQL = `
  select e.employee_code,
         ${ERP_IDENTITY_SQL} as identity,
         e.fullname_lo, e.department_code, e.position_code, e.app_role, e.password
  from odg_employee e
  where e.employment_status = 'ACTIVE'
    and ( e.employee_code = $1
       or lower(coalesce(e.nickname,'')) = lower($1)
       or lower(coalesce(e.fullname_lo,'')) = lower($1) )
  limit 1`;

export type CredentialResult = { ok: true; session: Session } | { ok: false; error: string };

export async function verifyCredentials(username: string, password: string): Promise<CredentialResult> {
  if (!username || !password) return { ok: false, error: "ກະລຸນາປ້ອນຂໍ້ມູນໃຫ້ຄົບ" };

  // 1) ພະນັກງານຈາກ ERP (ທາງຫຼັກ)
  const employee = (await queryOdg<ErpEmployee>(ERP_SQL, [username])).rows[0];
  if (employee && verifyErpPassword(employee.password, password)) {
    const identity = employee.identity || employee.fullname_lo || employee.employee_code;

    // ສິດທີ່ຜູ້ຈັດການກຳນົດເອງ (/manage/employees) ຢູ່ເທິງສຸດ — ປິດແລ້ວ ເຂົ້າບໍ່ໄດ້ເລີຍ
    const assigned = await getEmployeeOverride(employee.employee_code);
    if (assigned && !assigned.active) return { ok: false, error: BLOCKED };

    // users ຂອງ ODS ຊະນະພະແນກ ERP (ERP ບໍ່ມີສັນຍານ "ຜູ້ຈັດການ"/"ຫົວໜ້າຊ່າງ")
    const override = (
      await query<{ roles: string }>(
        `select roles from users
          where lower(username) in (lower($1), lower($2), lower($3))
          order by case roles when 'manager' then 1 when 'headtechnical' then 2 else 3 end
          limit 1`,
        [employee.employee_code, identity, employee.fullname_lo],
      )
    ).rows[0];

    return {
      ok: true,
      session: {
        // ຕົວຕົນ = ຄ່າດຽວກັບທີ່ເກັບໃນ tb_product.emp_code ຈຶ່ງກອງ "ວຽກຂອງຂ້ອຍ" ໄດ້
        username: identity,
        role:
          assigned?.app_role ||
          override?.roles ||
          roleFromErp(employee.app_role, employee.position_code, employee.department_code),
      },
    };
  }

  // 2) ຜູ້ໃຊ້ເກົ່າໃນ ODS — ຍັງເກັບໄວ້ ບໍ່ດັ່ງນັ້ນ admin ຈະຖືກລັອກອອກ
  const user = (
    await query<OdsUser>("select roles, password, password_hash from users where username = $1 limit 1", [username])
  ).rows[0];
  const valid = Boolean(
    user && ((user.password_hash && verifyWerkzeugPassword(user.password_hash, password)) || user.password === password),
  );
  if (user && valid) {
    // ຄົນດຽວກັນອາດມີທັງແຖວ users ແລະ ພະນັກງານ ERP — ຖ້າຖືກປິດ ຕ້ອງປິດທາງນີ້ນຳ
    if (await isBlockedIdentity(username)) return { ok: false, error: BLOCKED };
    return { ok: true, session: { username, role: user.roles } };
  }

  return { ok: false, error: BAD_CREDENTIALS };
}
