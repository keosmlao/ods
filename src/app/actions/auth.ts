"use server";
import { clearSession, createSession, verifyWerkzeugPassword } from "@/lib/auth";
import { query, queryOdg } from "@/lib/db";
import { getEmployeeOverride, isBlockedIdentity } from "@/lib/employee-role";
import { ERP_IDENTITY_SQL, roleFromErp, verifyErpPassword } from "@/lib/erp-auth";
import { redirect } from "next/navigation";

type LoginState = { error?: string };

/** ຄົນທີ່ຜູ້ຈັດການປິດການໃຊ້ງານໄວ້ (ods_employee_role.active = false) */
const BLOCKED = "ບັນຊີນີ້ຖືກປິດການໃຊ້ງານ ກະລຸນາຕິດຕໍ່ຜູ້ຈັດການ";

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

/**
 * ພະນັກງານ login ດ້ວຍ odg_employee (ຖານ ERP) ເປັນຫຼັກ.
 * ຮັບໄດ້ທັງ ລະຫັດພະນັກງານ, ຊື່ຫຼິ້ນ ຫຼືຊື່ເຕັມ.
 */
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

export async function loginAction(_: LoginState, formData: FormData): Promise<LoginState> {
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!username || !password) return { error: "ກະລຸນາປ້ອນຂໍ້ມູນໃຫ້ຄົບ" };

  try {
    // 1) ພະນັກງານຈາກ ERP
    const employee = (await queryOdg<ErpEmployee>(ERP_SQL, [username])).rows[0];
    if (employee && verifyErpPassword(employee.password, password)) {
      const identity = employee.identity || employee.fullname_lo || employee.employee_code;

      /**
       * ສິດທີ່ຜູ້ຈັດການກຳນົດເອງ (ods_employee_role — ໜ້າ /manage/employees) ຢູ່ເທິງສຸດ:
       *   ຖືກປິດການໃຊ້ງານ → ເຂົ້າລະບົບບໍ່ໄດ້ເລີຍ
       *   ມີ app_role     → ຖືເອົາຄ່ານັ້ນ ຊະນະທັງ users ແລະ ພະແນກ/ຕຳແໜ່ງ ຂອງ ERP
       */
      const assigned = await getEmployeeOverride(employee.employee_code);
      if (assigned && !assigned.active) return { error: BLOCKED };

      /**
       * ສິດທີ່ຄົນກຳນົດເອງໃນຕາຕະລາງ users ຂອງ ODS ຊະນະພະແນກ ERP.
       * ເປັນຫຍັງ: ERP ບໍ່ມີສັນຍານ "ຜູ້ຈັດການ"/"ຫົວໜ້າຊ່າງ" ເລີຍ — ຮູ້ແຕ່ພະແນກ.
       * ຜູ້ຈັດການ 5 ຄົນໃນ users ກໍ່ເປັນພະນັກງານ ERP ນຳ (username = ລະຫັດພະນັກງານ)
       * ຖ້າຖືເອົາພະແນກຢ່າງດຽວ ເຂົາຈະກາຍເປັນ user/technical ແລ້ວເສຍສິດອະນຸມັດ.
       */
      const override = (
        await query<{ roles: string }>(
          `select roles from users
            where lower(username) in (lower($1), lower($2), lower($3))
            order by case roles when 'manager' then 1 when 'headtechnical' then 2 else 3 end
            limit 1`,
          [employee.employee_code, identity, employee.fullname_lo],
        )
      ).rows[0];

      await createSession({
        // ຕົວຕົນ = ຄ່າດຽວກັບທີ່ເກັບໃນ tb_product.emp_code ຈຶ່ງກອງ "ວຽກຂອງຂ້ອຍ" ໄດ້
        username: identity,
        role:
          assigned?.app_role ||
          override?.roles ||
          roleFromErp(employee.app_role, employee.position_code, employee.department_code),
      });
      redirect("/dashboard");
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
      if (await isBlockedIdentity(username)) return { error: BLOCKED };
      await createSession({ username, role: user.roles });
      redirect("/dashboard");
    }

    return { error: "ຊື່ຜູ້ໃຊ້ ຫຼື ລະຫັດຜ່ານບໍ່ຖືກຕ້ອງ" };
  } catch (error) {
    // redirect() ຂອງ Next ໂຍນ error ພິເສດອອກມາ — ຕ້ອງປ່ອຍຜ່ານ ບໍ່ແມ່ນຈັບໄວ້
    if (error && typeof error === "object" && "digest" in error) throw error;
    console.error("Login failed", error);
    return { error: "ບໍ່ສາມາດເຊື່ອມຕໍ່ຖານຂໍ້ມູນໄດ້" };
  }
}

export async function logoutAction() {
  await clearSession();
  redirect("/login");
}
