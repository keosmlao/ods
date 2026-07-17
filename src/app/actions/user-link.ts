"use server";
import { getSession } from "@/lib/auth";
import { db, query, queryOdg } from "@/lib/db";
import { laoLatinScore } from "@/lib/lao-latin";
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
/**
 * ບົດບາດທີ່ **ຂຽນເອກະສານລົງ ERP** (ໃບຂໍຊື້ · PO · ໃບເບີກ) ⇒ ຕ້ອງມີລະຫັດພະນັກງານ
 * ບໍ່ດັ່ງນັ້ນໃບໄປລົງ ERP ໂດຍ `creator_code` ຫວ່າງ (ຄົນ ERP ບໍ່ຮູ້ໃຜອອກໃບ).
 */
const DOC_WRITER_ROLES = ["manager", "admin", "stock", "headtechnical"];

export async function technicianLinks(): Promise<{ rows: TechRow[]; employees: Employee[] }> {
  // ຜັງ ຊ່າງ↔ລະຫັດ ERP ເປັນຂໍ້ມູນພາຍໃນ — ໜ້ານີ້ຂອງຜູ້ຈັດການຢູ່ແລ້ວ
  if (!(await getSession())) return { rows: [], employees: [] };
  const [techs, writers, links, staff] = await Promise.all([
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
    /**
     * ── ຄົນທີ່ອອກເອກະສານ ERP (17-07-2026) ──
     * ໜ້ານີ້ເຄີຍລວມແຕ່ **ຊ່າງທີ່ປາກົດໃນງານ** ⇒ ຄົນສາງ/ຈັດຊື້/ຜູ້ຈັດການ (stk · keo …)
     * **ບໍ່ເຄີຍຂຶ້ນມາໃຫ້ຜູກເລີຍ** ທັງທີ່ໃບຂໍຊື້/PO ຂອງເຂົາຕ້ອງມີຊື່ຜູ້ສ້າງໃນ ERP.
     * ຂໍ້ມູນຈິງ: 23/42 ຜູ້ໃຊ້ຍັງບໍ່ຜູກ ໃນນັ້ນມີ stk · stkservice · ຜູ້ຈັດການ 5 ຄົນ.
     */
    query<{ user_code: string; ods_name: string | null }>(
      `select u.username as user_code, coalesce(nullif(u.name_1,''), u.username) as ods_name
         from users u
        where u.roles = any($1::text[]) and u.username !~ '^[0-9]+$'`,
      [DOC_WRITER_ROLES],
    ),
    query<{ user_code: string; employee_code: string }>("select user_code, employee_code from ods_user_employee"),
    queryOdg<Employee>(
      /**
       * **ພະນັກງານ ACTIVE ທັງບໍລິສັດ** — ບໍ່ກອງຝ່າຍ.
       *
       * ⚠️ ເຄີຍກອງແຕ່ຝ່າຍບໍລິການ (400) ⇒ ຄົນທີ່ອອກເອກະສານແຕ່ຢູ່ຝ່າຍອື່ນ **ບໍ່ມີໃນລາຍຊື່
       * ໃຫ້ເລືອກເລີຍ** ຈຶ່ງຜູກບໍ່ໄດ້ຕະຫຼອດການ (ຕົວຢ່າງຈິງ: keo = ພູມີພົນ ຂູນວິເສດ 22020
       * ຢູ່ຝ່າຍ 800 · stk = ພຸດທະສອນ ວໍລະບຸດ 20019 ຢູ່ພະແນກ 501).
       * ຜູ້ຈັດການເປັນຄົນເລືອກຢູ່ແລ້ວ — ໃຫ້ລາຍຊື່ຄົບດີກວ່າເຊື່ອງຄົນທີ່ຖືກຕ້ອງ.
       */
      `select employee_code as code,
          coalesce(nullif(fullname_lo,''), employee_code) as name,
          nullif(nickname,'') as nickname
        from odg_employee
        where employment_status = 'ACTIVE'
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
  // ຄົນອອກເອກະສານທີ່ບໍ່ມີງານສ້ອມ — ໃສ່ດ້ວຍງານ 0 ເພື່ອໃຫ້ຜູກໄດ້ (ບໍ່ທັບຂໍ້ມູນງານທີ່ມີແລ້ວ)
  for (const writer of writers.rows) {
    if (!totals.has(writer.user_code)) totals.set(writer.user_code, { ods_name: writer.ods_name, jobs: 0 });
  }

  /**
   * ຄູ່ທີ່ເດົາໃຫ້ — ຊື່ຜູ້ໃຊ້ເກົ່າຄື **ຊື່ຫຼິ້ນລາວທີ່ຂຽນເປັນອັກສອນລາຕິນ**
   * (Xiew → ຊີວ · Mee → ມີ · sak → ສັກ). ການທັບສັບບໍ່ແນ່ນອນ ⇒ ນີ້ເປັນພຽງ
   * **ຄຳແນະນຳ** ຜູ້ຈັດການຕ້ອງຢືນຢັນເອງ (ນີ້ເປັນເລື່ອງເງິນ).
   */
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
          /**
           * ── ຊື່ໃນງານເປັນ **ລາຕິນ** ແຕ່ ERP ເປັນ **ອັກສອນລາວ** ──
           * ທຽບກົງໆບໍ່ຕົງຈັກຄົນ (ຂໍ້ມູນຈິງ: 23 ຊື່ ຈັບຄູ່ໄດ້ 1) ⇒ ຖອດອັກສອນລາວ
           * ເປັນລາຕິນກ່ອນແລ້ວຄ່ອຍທຽບ (lib/lao-latin) — ທຽບກັບ **ຊື່ຫຼິ້ນ** ແລະ
           * **ທຸກຄຳໃນຊື່ເຕັມ** (Santi → ສັນຕິ ເທບທາລາ · Mee → ບຸນມີ).
           *
           * ⚠️ ຮັບສະເພາະຄູ່ທີ່ **ຕົງແທ້** (ຄະແນນ 1) — ຄຳໃກ້ຄຽງພາໃຫ້ Tong → ຕິ່ງ
           * ແລະ wang → ນາງ ເຊິ່ງເປັນຄົນລະຄົນ. ນີ້ຄືເລື່ອງເງິນ ⇒ "ຫາບໍ່ພົບ"
           * ປອດໄພກວ່າ "ແນະນຳຜິດຄົນ".
           */
          const found = staff.rows.find((employee) => {
            if (employee.nickname && laoLatinScore(user_code, employee.nickname) === 1) return true;
            return employee.name.split(/\s+/).some((word) => laoLatinScore(user_code, word) === 1);
          });
          suggestion = found?.code ?? null;
        }
      }
      return { user_code, ods_name: info.ods_name, jobs: info.jobs, employee_code, suggestion };
    })
    // ຍັງບໍ່ເຊື່ອມ → ຂຶ້ນກ່ອນ (ຄົນທີ່ເງິນຈະຕົກຫຼົ່ນ) · ແລ້ວຮຽງຕາມຈຳນວນງານ
    .sort((a, b) => Number(Boolean(a.employee_code)) - Number(Boolean(b.employee_code)) || b.jobs - a.jobs);

  return { rows, employees: staff.rows };
}

/**
 * ── ທຸກບ່ອນທີ່ເກັບ "ຕົວຕົນຂອງຄົນ" ໄວ້ເປັນຂໍ້ຄວາມ ──
 *
 * ODS ບໍ່ມີ "ລະຫັດພະນັກງານ" — ມັນຂຽນ **ຊື່ຫຼິ້ນ** ລົງທຸກຕາຕະລາງ ('Xiew', 'sak').
 * ຈຶ່ງບໍ່ມີບ່ອນດຽວທີ່ຈະປ່ຽນ — ຕ້ອງໄລ່ຂຽນທັບໃຫ້ຄົບ ບໍ່ດັ່ງນັ້ນຈະເກີດ "ຄົນເຄິ່ງຄົນ":
 * ງານໃໝ່ຢູ່ໃຕ້ລະຫັດ ERP ແຕ່ງານເກົ່າ · ຮູບ · check-in · ຄ່າຄອມ ຍັງຢູ່ໃຕ້ຊື່ເກົ່າ
 * ⇒ "ວຽກຂອງຂ້ອຍ" ບໍ່ຄົບ ແລະ ລາຍງານລາຍຮັບຂາດເຄິ່ງ.
 *
 * ຮູບແບບ: [ຕາຕະລາງ, ຖັນ] — ຂຽນທັບສະເພາະແຖວທີ່ **ຄ່າຕົງກັນທຸກຕົວອັກສອນ** ກັບຊື່ເກົ່າ.
 */
const IDENTITY_COLUMNS: [table: string, column: string][] = [
  // ງານຕິດຕັ້ງ — ຊ່າງ · ຊ່າງກ່ອນໜ້າ · ຜູ້ຈັດ · ຜູ້ສ້າງ · ຜູ້ແກ້ · ຜູ້ QC
  ["ods_tb_install", "tech_code"],
  ["ods_tb_install", "tech_before"],
  ["ods_tb_install", "user_assigt"],
  ["ods_tb_install", "user_created"],
  ["ods_tb_install", "user_edit"],
  ["ods_tb_install", "qc_by"],
  // ງານສ້ອມ
  ["tb_product", "emp_code"],
  ["tb_product", "user_regis"],
  ["tb_product", "user_edit"],
  ["tb_product", "qc_by"],
  ["tb_product", "spare_arrive_by"],
  // ຮ່ອງຮອຍຂອງແອັບຊ່າງ
  ["ods_job_checkin", "tech_code"],
  ["ods_job_reject", "tech_code"],
  ["ods_job_photo", "created_by"],
  ["ods_qc_result", "checked_by"],
  ["ods_push_token", "user_code"],
  // ຂ່າວສານ/ຜູ້ຕິດຕາມ (ແຈ້ງເຕືອນຈະໄປຫາລະຫັດໃໝ່)
  ["ods_chatter_message", "author"],
  ["ods_chatter_follower", "username"],
  // ເອກະສານສາງທີ່ອອກໃນນາມຄົນນີ້
  ["ic_trans", "user_created"],
];

/**
 * ເຊື່ອມ (ຫຼື ຖອນ) ຄູ່ຕົວຕົນ — ຄ່າຫວ່າງ = ຖອນການເຊື່ອມ.
 *
 * ── ເຊື່ອມແລ້ວ = **ຍ້າຍຂໍ້ມູນເກົ່າມາໃຊ້ລະຫັດ ERP ທັນທີ** ──
 * ເປົ້າໝາຍຄື **ລະຫັດດຽວທັງລະບົບ** (ລະຫັດພະນັກງານ ERP). ດັ່ງນັ້ນຕອນເຊື່ອມ ຈຶ່ງຂຽນ
 * ລະຫັດ ERP ທັບຊື່ເກົ່າໃນທຸກຕາຕະລາງ (IDENTITY_COLUMNS) **ໃນ transaction ດຽວ** —
 * ບໍ່ດັ່ງນັ້ນຈະໄດ້ "ຄົນເຄິ່ງຄົນ" ຄືທີ່ອະທິບາຍຂ້າງເທິງ.
 *
 * ຫຼັງຈາກນີ້ ຕອນຄົນນັ້ນ login (lib/credentials) session.username ຈະເປັນ **ລະຫັດ ERP**
 * ເພາະມີແຖວເຊື່ອມຢູ່ ⇒ "ວຽກຂອງຂ້ອຍ" ຫາງານເກົ່າພົບຄືເກົ່າ.
 *
 * ຍ້ອນຄືນໄດ້: ແຖວເຊື່ອມເກັບ user_code ເກົ່າໄວ້ ⇒ ຮູ້ສະເໝີວ່າ '23037' ແມ່ນ 'Xiew'.
 */
export async function linkTechnician(_: LinkState, formData: FormData): Promise<LinkState> {
  const guard = await requireManager();
  if (!guard.ok) return { error: guard.error };
  if (!db) return { error: "ບໍ່ພົບ DATABASE_URL" };

  const userCode = String(formData.get("user_code") ?? "").trim();
  const employeeCode = String(formData.get("employee_code") ?? "").trim();
  if (!userCode) return { error: "ບໍ່ພົບຜູ້ໃຊ້" };

  // ຖອນການເຊື່ອມ — **ບໍ່ຂຽນຂໍ້ມູນຄືນ** (ງານທີ່ຍ້າຍໄປລະຫັດ ERP ແລ້ວ ຍັງຢູ່ລະຫັດ ERP
  // ເພາະນັ້ນຄືຕົວຕົນທີ່ຖືກຕ້ອງ — ຖອນພຽງແຕ່ຢຸດການຈ່າຍເງິນເຂົ້າບັນຊີນັ້ນ)
  if (!employeeCode) {
    await db.query("delete from ods_user_employee where user_code = $1", [userCode]);
    revalidatePath("/manage/technicians");
    revalidatePath("/reports/technician-income");
    return { ok: "ຖອນການເຊື່ອມແລ້ວ" };
  }

  if (employeeCode === userCode) {
    // ຄ່າໃນງານເປັນລະຫັດ ERP ຢູ່ແລ້ວ ⇒ ບັນທຶກຄູ່ໄວ້ຢ່າງດຽວ ບໍ່ຕ້ອງຂຽນຫຍັງທັບ
    await db.query(
      `insert into ods_user_employee(user_code, employee_code, updated_by) values($1,$2,$3)
       on conflict (user_code) do update set employee_code = excluded.employee_code,
          updated_by = excluded.updated_by, updated_at = localtimestamp(0)`,
      [userCode, employeeCode, guard.username],
    );
    revalidatePath("/manage/technicians");
    return { ok: "ບັນທຶກສຳເລັດ" };
  }

  const client = await db.connect();
  let moved = 0;
  try {
    await client.query("begin");

    await client.query(
      `insert into ods_user_employee(user_code, employee_code, updated_by) values($1,$2,$3)
       on conflict (user_code) do update set employee_code = excluded.employee_code,
          updated_by = excluded.updated_by, updated_at = localtimestamp(0)`,
      [userCode, employeeCode, guard.username],
    );

    // ຂຽນລະຫັດ ERP ທັບຊື່ເກົ່າ ທຸກຕາຕະລາງ (ຊື່ຕາຕະລາງ/ຖັນ ມາຈາກລາຍການຄົງທີ່ຂ້າງເທິງ
    // ບໍ່ແມ່ນຈາກຜູ້ໃຊ້ ⇒ ຕໍ່ເປັນ SQL ໄດ້ · ຄ່າຍັງເປັນ parameter ຄືເກົ່າ)
    for (const [table, column] of IDENTITY_COLUMNS) {
      const done = await client.query(`update ${table} set ${column} = $1 where ${column} = $2`, [
        employeeCode,
        userCode,
      ]);
      moved += done.rowCount ?? 0;
    }

    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    console.error("linkTechnician backfill failed", error);
    return { error: "ຍ້າຍຂໍ້ມູນບໍ່ສຳເລັດ — ບໍ່ໄດ້ປ່ຽນຫຍັງເລີຍ" };
  } finally {
    client.release();
  }

  revalidatePath("/manage/technicians");
  revalidatePath("/reports/technician-income");
  return { ok: `ເຊື່ອມແລ້ວ — ຍ້າຍ ${moved.toLocaleString()} ແຖວມາໃຊ້ລະຫັດ ${employeeCode}` };
}
