import { query } from "@/lib/db";

/**
 * ຕິດຕາມການເຂົ້າລະບົບ — ບັນທຶກທຸກຄັ້ງທີ່ login ສຳເລັດ (ເວັບ/ມືຖື).
 * ບໍ່ເກັບລະຫັດຜ່ານ. ຄວາມລົ້ມເຫຼວຂອງການບັນທຶກ **ບໍ່ໃຫ້** ເຮັດໃຫ້ login ລົ້ມ.
 */
export type LoginSource = "web" | "mobile";

export async function recordLogin(
  username: string,
  source: LoginSource,
  ip: string | null,
  userAgent: string | null,
): Promise<void> {
  try {
    await query(
      `insert into ods_login_log(username, source, ip, user_agent) values($1,$2,$3,$4)`,
      [username, source, ip?.slice(0, 100) ?? null, userAgent?.slice(0, 300) ?? null],
    );
  } catch (error) {
    console.error("recordLogin failed", error);
  }
}

export type LoginLogRow = {
  username: string;
  emp_code: string | null;
  source: string;
  ip: string | null;
  user_agent: string | null;
  logged_at: string;
};

/** ປະຫວັດການເຂົ້າລະບົບ — ໃໝ່ສຸດກ່ອນ. emp_code ຈາກ ods_user_employee (ຊື່ ERP ຢູ່ຄົນລະຖານ). */
export async function recentLogins(limit = 200, username?: string): Promise<LoginLogRow[]> {
  const args: (string | number)[] = [];
  const where: string[] = [];
  if (username) {
    args.push(username);
    where.push(`l.username = $${args.length}`);
  }
  args.push(limit);
  return (
    await query<LoginLogRow>(
      `select l.username, ue.employee_code as emp_code, l.source, l.ip, l.user_agent,
          to_char(l.logged_at,'DD-MM-YYYY HH24:MI') as logged_at
        from ods_login_log l
        left join ods_user_employee ue on ue.user_code = l.username
       ${where.length ? `where ${where.join(" and ")}` : ""}
       order by l.logged_at desc
       limit $${args.length}`,
      args,
    )
  ).rows;
}
