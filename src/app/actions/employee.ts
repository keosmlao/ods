"use server";
import { getSession } from "@/lib/auth";
import { query, queryOdg } from "@/lib/db";
import { ERP_IDENTITY_SQL } from "@/lib/erp-auth";
import { ROLES, roleOf, type Role } from "@/lib/roles";
import { revalidatePath } from "next/cache";
import { z } from "zod";

/**
 * ກຳນົດສິດພະນັກງານ — ໜ້າ /manage/employees (ຜູ້ຈັດການເທົ່ານັ້ນ).
 *
 * ຂຽນລົງ ods_employee_role ຂອງຖານ ODS ເທົ່ານັ້ນ. ຖານ ERP (odg_employee) ອ່ານຢ່າງດຽວ
 * ຢ່າງເດັດຂາດ — ຮ່ວມກັບລະບົບອື່ນຢູ່ ຫ້າມແຕະ.
 *
 * ເບິ່ງລຳດັບຄວາມສຳຄັນຂອງ role ໄດ້ທີ່ src/lib/employee-role.ts
 */

const NOW = "localtimestamp(0)";

export type EmployeeActionState = { ok?: string; error?: string };

const codeSchema = z.string().trim().min(1).max(32);
const roleSchema = z.enum(ROLES).nullable();

/** ຕົວຕົນ (= ຊື່ເຂົ້າລະບົບ) ຂອງພະນັກງານ ERP — ສູດດຽວກັບ ERP_SQL ຂອງ actions/auth */
async function erpIdentity(employeeCode: string): Promise<string | null> {
  const row = (
    await queryOdg<{ identity: string | null; fullname_lo: string | null }>(
      `select ${ERP_IDENTITY_SQL} as identity, e.fullname_lo
         from odg_employee e
        where e.employee_code = $1 and e.employment_status = 'ACTIVE'
        limit 1`,
      [employeeCode],
    )
  ).rows[0];
  if (!row) return null;
  return (row.identity ?? "").trim() || (row.fullname_lo ?? "").trim() || employeeCode;
}

/** ຜູ້ຈັດການເທົ່ານັ້ນ — ດ່ານຊັ້ນທີ 3 (proxy ແລະ layout ກັນຢູ່ແລ້ວ ແຕ່ action ຖືກເອີ້ນກົງໄດ້) */
async function requireManager(): Promise<{ username: string } | { error: string }> {
  const session = await getSession();
  if (!session) return { error: "Session ໝົດອາຍຸ" };
  if (roleOf(session) !== "manager") return { error: "ບໍ່ມີສິດກຳນົດສິດພະນັກງານ" };
  return { username: session.username };
}

function done(): void {
  revalidatePath("/manage/employees");
  revalidatePath("/", "layout");
}

/**
 * ກຳນົດສິດເອງໃຫ້ພະນັກງານ 1 ຄົນ.
 * role = null ⇒ ກັບໄປໃຊ້ "ສິດຕາມຕຳແໜ່ງ" (ລົບແຖວກຳນົດເອງອອກ).
 * ຖ້າຄົນນັ້ນຖືກປິດການໃຊ້ງານຢູ່ ຈະບໍ່ລົບແຖວ ແຕ່ລ້າງແຕ່ app_role — ບໍ່ດັ່ງນັ້ນການປິດຈະຫາຍໄປນຳ.
 */
export async function setEmployeeRole(employeeCode: string, role: Role | null): Promise<EmployeeActionState> {
  const auth = await requireManager();
  if ("error" in auth) return auth;

  const code = codeSchema.safeParse(employeeCode);
  const parsedRole = roleSchema.safeParse(role);
  if (!code.success || !parsedRole.success) return { error: "ຂໍ້ມູນບໍ່ຖືກຕ້ອງ" };

  const identity = await erpIdentity(code.data);
  if (!identity) return { error: "ບໍ່ພົບພະນັກງານໃນ ERP" };

  try {
    if (parsedRole.data === null) {
      // ຍັງໃຊ້ງານໄດ້ → ລົບແຖວອອກເລີຍ · ຖືກປິດຢູ່ → ເກັບແຖວໄວ້ ລ້າງແຕ່ສິດ
      await query(`delete from ods_employee_role where employee_code = $1 and active = true`, [code.data]);
      await query(
        `update ods_employee_role set app_role = '', identity = $2, updated_by = $3, updated_at = ${NOW}
          where employee_code = $1`,
        [code.data, identity, auth.username],
      );
      done();
      return { ok: "ກັບໄປໃຊ້ສິດຕາມຕຳແໜ່ງແລ້ວ" };
    }

    await query(
      `insert into ods_employee_role(employee_code, identity, app_role, active, updated_by, updated_at)
       values ($1, $2, $3, true, $4, ${NOW})
       on conflict (employee_code) do update
          set app_role = excluded.app_role,
              identity = excluded.identity,
              updated_by = excluded.updated_by,
              updated_at = excluded.updated_at`,
      [code.data, identity, parsedRole.data, auth.username],
    );
    done();
    return { ok: "ບັນທຶກສິດແລ້ວ" };
  } catch (error) {
    console.error("setEmployeeRole failed", error);
    return { error: "ບັນທຶກບໍ່ສຳເລັດ" };
  }
}

/**
 * ເປີດ / ປິດ ການໃຊ້ງານ. active = false ⇒ ຄົນນັ້ນ login ບໍ່ໄດ້ (actions/auth)
 * ແລະ ບໍ່ໄດ້ຮັບການແຈ້ງເຕືອນຕາມ role ອີກ (actions/notification).
 */
export async function setEmployeeActive(employeeCode: string, active: boolean): Promise<EmployeeActionState> {
  const auth = await requireManager();
  if ("error" in auth) return auth;

  const code = codeSchema.safeParse(employeeCode);
  const parsedActive = z.boolean().safeParse(active);
  if (!code.success || !parsedActive.success) return { error: "ຂໍ້ມູນບໍ່ຖືກຕ້ອງ" };

  const identity = await erpIdentity(code.data);
  if (!identity) return { error: "ບໍ່ພົບພະນັກງານໃນ ERP" };

  try {
    if (!parsedActive.data) {
      // ປິດ — ສ້າງແຖວຖ້າຍັງບໍ່ມີ (ບໍ່ແຕະ app_role ເດີມ)
      await query(
        `insert into ods_employee_role(employee_code, identity, app_role, active, updated_by, updated_at)
         values ($1, $2, '', false, $3, ${NOW})
         on conflict (employee_code) do update
            set active = false,
                identity = excluded.identity,
                updated_by = excluded.updated_by,
                updated_at = excluded.updated_at`,
        [code.data, identity, auth.username],
      );
      done();
      return { ok: "ປິດການໃຊ້ງານແລ້ວ" };
    }

    // ເປີດຄືນ — ຖ້າບໍ່ມີສິດກຳນົດເອງເຫຼືອຢູ່ ແຖວນັ້ນກໍ່ບໍ່ມີປະໂຫຍດ ⇒ ລົບອອກ
    await query(
      `update ods_employee_role set active = true, identity = $2, updated_by = $3, updated_at = ${NOW}
        where employee_code = $1`,
      [code.data, identity, auth.username],
    );
    await query(`delete from ods_employee_role where employee_code = $1 and coalesce(app_role,'') = ''`, [code.data]);
    done();
    return { ok: "ເປີດການໃຊ້ງານແລ້ວ" };
  } catch (error) {
    console.error("setEmployeeActive failed", error);
    return { error: "ບັນທຶກບໍ່ສຳເລັດ" };
  }
}
