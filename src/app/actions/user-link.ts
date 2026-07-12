"use server";
import { getSession } from "@/lib/auth";
import { db, query, queryOdg } from "@/lib/db";
import { roleOf } from "@/lib/roles";
import { revalidatePath } from "next/cache";

/**
 * ເຊື່ອມຕົວຕົນ: ຜູ້ໃຊ້ ODS ↔ ພະນັກງານ ERP — **ຜູ້ຈັດການເທົ່ານັ້ນ** (ກະທົບການຈ່າຍເງິນ).
 *
 * ງານບັນທຶກຊ່າງໄວ້ເປັນ users.code ຂອງ ODS ('Xiew', 'sak') ແຕ່ຜູ້ຮັບເງິນບົດບາດອື່ນ
 * ເປັນ odg_employee.employee_code ('23037') ⇒ ຄົນລະລະບົບຕົວຕົນ.
 * ຕາຕະລາງນີ້ເປັນສະພານ ⇒ ຄ່າຄອມທຸກແຖວອອກມາເປັນ employee_code ອັນດຽວກັນ.
 */
export type LinkState = { error?: string; ok?: string };

async function requireManager() {
  const session = await getSession();
  if (!session) return { ok: false as const, error: "Session ໝົດອາຍຸ" };
  if (roleOf(session) !== "manager") return { ok: false as const, error: "ຜູ້ຈັດການເທົ່ານັ້ນ" };
  return { ok: true as const, username: session.username };
}

export type TechRow = {
  /** ຄ່າທີ່ຢູ່ໃນງານຈິງ (tech_code / emp_code) */
  user_code: string;
  ods_name: string | null;
  jobs: number;
  employee_code: string | null;
  /** ຄູ່ທີ່ລະບົບເດົາໃຫ້ — ຜູ້ຈັດການຢືນຢັນເອງ */
  suggestion: string | null;
};

export type Employee = { code: string; name: string; nickname: string | null };

/**
 * ຊ່າງທຸກຄົນທີ່ **ປາກົດໃນງານຈິງ** (ບໍ່ແມ່ນທຸກຜູ້ໃຊ້) — ພ້ອມຈຳນວນງານ ແລະ ຄູ່ທີ່ເຊື່ອມແລ້ວ.
 * ຮຽງຄົນທີ່ຍັງບໍ່ເຊື່ອມກ່ອນ — ນັ້ນຄືຄົນທີ່ເງິນຈະຕົກຫຼົ່ນ.
 */
export async function technicianLinks(): Promise<{ rows: TechRow[]; employees: Employee[] }> {
  const [techs, links, staff] = await Promise.all([
    query<{ user_code: string; ods_name: string | null; jobs: number }>(
      `select t.code as user_code,
          (select coalesce(nullif(u.name_1,''), u.username) from users u where u.code = t.code) as ods_name,
          t.jobs
        from (
          select tech_code as code, count(*)::int jobs from ods_tb_install
           where coalesce(tech_code,'') <> '' group by 1
          union all
          select emp_code, count(*)::int from tb_product
           where coalesce(emp_code,'') <> '' group by 1
        ) t
        group by t.code, t.jobs`,
    ),
    query<{ user_code: string; employee_code: string }>("select user_code, employee_code from ods_user_employee"),
    queryOdg<Employee>(
      `select employee_code as code,
          coalesce(nullif(fullname_lo,''), employee_code) as name,
          nullif(nickname,'') as nickname
        from odg_employee
        where employment_status = 'ACTIVE' and division_code = '400'
        order by fullname_lo`,
    ),
  ]);

  const linked = new Map(links.rows.map((row) => [row.user_code, row.employee_code]));

  // ລວມຈຳນວນງານຂອງລະຫັດດຽວກັນ (ຄົນນຶ່ງອາດມີທັງງານສ້ອມ ແລະ ງານຕິດຕັ້ງ)
  const totals = new Map<string, { ods_name: string | null; jobs: number }>();
  for (const tech of techs.rows) {
    const current = totals.get(tech.user_code);
    totals.set(tech.user_code, {
      ods_name: tech.ods_name ?? current?.ods_name ?? null,
      jobs: (current?.jobs ?? 0) + tech.jobs,
    });
  }

  /**
   * ຄູ່ທີ່ເດົາໃຫ້ — ຊື່ຜູ້ໃຊ້ເກົ່າຄື **ຊື່ຫຼິ້ນລາວທີ່ຂຽນເປັນອັກສອນລາຕິນ**
   * (Xiew → ຊີວ · Mee → ມີ · sak → ສັກ). ການທັບສັບບໍ່ແນ່ນອນ ⇒ ນີ້ເປັນພຽງ
   * **ຄຳແນະນຳ** ຜູ້ຈັດການຕ້ອງຢືນຢັນເອງ (ນີ້ເປັນເລື່ອງເງິນ).
   */
  const norm = (value: string) => value.trim().toLowerCase();
  const byCode = new Map(staff.rows.map((employee) => [employee.code, employee]));

  const rows: TechRow[] = [...totals.entries()]
    .map(([user_code, info]) => {
      const employee_code = linked.get(user_code) ?? null;
      let suggestion: string | null = null;
      if (!employee_code) {
        // ① ຄ່າໃນງານເປັນ employee_code ຢູ່ແລ້ວ
        if (byCode.has(user_code)) suggestion = user_code;
        // ② ຊື່ຫຼິ້ນ ຫຼື ຊື່ເຕັມ ມີຄຳນີ້ຢູ່
        else {
          const found = staff.rows.find(
            (employee) =>
              (employee.nickname && norm(employee.nickname) === norm(user_code)) ||
              (norm(user_code).length >= 3 && norm(employee.name).includes(norm(user_code))),
          );
          suggestion = found?.code ?? null;
        }
      }
      return { user_code, ods_name: info.ods_name, jobs: info.jobs, employee_code, suggestion };
    })
    // ຍັງບໍ່ເຊື່ອມ → ຂຶ້ນກ່ອນ (ຄົນທີ່ເງິນຈະຕົກຫຼົ່ນ) · ແລ້ວຮຽງຕາມຈຳນວນງານ
    .sort((a, b) => Number(Boolean(a.employee_code)) - Number(Boolean(b.employee_code)) || b.jobs - a.jobs);

  return { rows, employees: staff.rows };
}

/** ເຊື່ອມ (ຫຼື ຖອນ) ຄູ່ຕົວຕົນ — ຄ່າຫວ່າງ = ຖອນການເຊື່ອມ */
export async function linkTechnician(_: LinkState, formData: FormData): Promise<LinkState> {
  const guard = await requireManager();
  if (!guard.ok) return { error: guard.error };
  if (!db) return { error: "ບໍ່ພົບ DATABASE_URL" };

  const userCode = String(formData.get("user_code") ?? "").trim();
  const employeeCode = String(formData.get("employee_code") ?? "").trim();
  if (!userCode) return { error: "ບໍ່ພົບຜູ້ໃຊ້" };

  if (!employeeCode) {
    await db.query("delete from ods_user_employee where user_code = $1", [userCode]);
  } else {
    await db.query(
      `insert into ods_user_employee(user_code, employee_code, updated_by)
       values($1,$2,$3)
       on conflict (user_code) do update
          set employee_code = excluded.employee_code,
              updated_by = excluded.updated_by,
              updated_at = localtimestamp(0)`,
      [userCode, employeeCode, guard.username],
    );
  }

  revalidatePath("/manage/technicians");
  revalidatePath("/reports/technician-income");
  return { ok: "ບັນທຶກສຳເລັດ" };
}
