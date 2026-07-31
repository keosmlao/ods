import { query } from "@/lib/db";
import { ROLE_LABEL } from "@/lib/commission-roles";
import { listTechnicians } from "@/lib/technicians";

/**
 * ── ສະຫຼຸບຄ່າຄອມ ສຳລັບຜູ້ຈັດການ (ແອັບ) ──
 *
 * ອ່ານ `ods_service_payout` ທີ່ **ແຊ່ໄວ້ຕອນປິດງານ** (lib/commission-record) —
 * ບໍ່ຄິດຄ່າຄອມຄືນໃໝ່ຢູ່ນີ້. ຄິດຄືນ = ຕົວເລກປ່ຽນເມື່ອຕາຕະລາງອັດຕາຖືກແກ້
 * ⇒ ເງິນທີ່ຈ່າຍໄປແລ້ວກັບຕົວເລກໃນລາຍງານຈະບໍ່ຕົງກັນ.
 *
 * ໃຫ້ 2 ຊັ້ນ ຕາມທີ່ຜູ້ຈັດການຂໍ:
 *   ① **ສະຫຼຸບຕໍ່ຄົນ** — ໃຜໄດ້ເທົ່າໃດ ຈາກຈັກໃບ
 *   ② **ລາຍລະອຽດວ່າຄ່າຄອມມາຈາກໃສ** — ແຕ່ລະແຖວບອກ ໃບງານ · ອັດຕາທີ່ຈັບໄດ້ (rate_label)
 *      · ຍອດເຕັມ · ເປີເຊັນຂອງບົດບາດ · ເງິນທີ່ໄດ້ຈິງ
 */

export type CommissionPerson = {
  /** ລະຫັດ (ຫຼື ຊື່ຫຼິ້ນ) ທີ່ຢູ່ໃນ payout — ວ່າງ = ສ່ວນທີ່ບໍ່ໄດ້ຜູກກັບຄົນ */
  employee_code: string;
  name: string;
  jobs: number;
  lines: number;
  total_thb: number;
};

export type CommissionLine = {
  employee_code: string;
  name: string;
  job_code: string;
  workflow: string;
  role: string;
  role_label: string;
  /** ອັດຕາທີ່ຈັບໄດ້ — ບອກວ່າ **ຄ່າຄອມນີ້ມາຈາກຫຍັງ** */
  rate_label: string | null;
  /** ຍອດເຕັມຂອງອັດຕານັ້ນ ກ່ອນແບ່ງເປີເຊັນ */
  amount_thb: number;
  pct: number;
  pay_thb: number;
  closed_at: string | null;
};

export type MobileCommission = {
  /** ເດືອນທີ່ເບິ່ງ — YYYY-MM */
  month: string;
  total_thb: number;
  jobs: number;
  people: CommissionPerson[];
  lines: CommissionLine[];
};

/** ຄົນທີ່ບໍ່ໄດ້ຜູກລະຫັດ (ສ່ວນແບ່ງຂອງບົດບາດທີ່ບໍ່ມີຄົນຮັບ) */
const UNASSIGNED = "ບໍ່ໄດ້ລະບຸຄົນ";

type Row = {
  employee_code: string | null;
  job_code: string;
  workflow: string;
  role: string;
  rate_label: string | null;
  amount_thb: number;
  pct: number;
  pay_thb: number;
  closed_at: string | null;
};

/**
 * @param month `YYYY-MM`; ວ່າງ = ເດືອນປັດຈຸບັນ
 * @param employee ກອງສະເພາະຄົນດຽວ (ໜ້າລາຍລະອຽດ) — ວ່າງ = ທຸກຄົນ
 */
export async function mobileCommission(month = "", employee = ""): Promise<MobileCommission> {
  // ເດືອນມາຈາກ client ⇒ ຮັບສະເພາະຮູບແບບທີ່ຖືກ ແລ້ວປະກອບເປັນວັນທີ 1 (ຢ່າແປະລົງ SQL ຊື່ໆ)
  const valid = /^\d{4}-\d{2}$/.test(month);
  const first = valid ? `${month}-01` : new Date().toISOString().slice(0, 8) + "01";

  const args: unknown[] = [first];
  let filter = "";
  if (employee.trim()) {
    args.push(employee.trim());
    filter = " and coalesce(p.employee_code,'') = $2";
  }

  const rows = (
    await query<Row>(
      `select p.employee_code, p.job_code, p.workflow, p.role, p.rate_label,
              p.amount_thb::float8 amount_thb, p.pct::float8 pct, p.pay_thb::float8 pay_thb,
              to_char(p.closed_at,'DD-MM-YYYY HH24:MI') closed_at
         from ods_service_payout p
        where p.closed_at >= $1::date
          and p.closed_at < ($1::date + interval '1 month')${filter}
        order by p.closed_at desc, p.job_code`,
      args,
    )
  ).rows;

  // ລະຫັດ ERP → ຊື່ເຕັມ; ຄົນທີ່ຍັງບໍ່ເຊື່ອມເກັບເປັນ**ຊື່ຫຼິ້ນ** ⇒ ບໍ່ຢູ່ map ກໍ່ໃຊ້ຄ່າເດີມ
  const techs = await listTechnicians();
  const nameOf = new Map(techs.map((tech) => [tech.code, tech.name]));
  const displayName = (code: string) => (code ? (nameOf.get(code) ?? code) : UNASSIGNED);

  const byPerson = new Map<string, CommissionPerson & { jobSet: Set<string> }>();
  for (const row of rows) {
    const code = row.employee_code ?? "";
    const person =
      byPerson.get(code) ??
      { employee_code: code, name: displayName(code), jobs: 0, lines: 0, total_thb: 0, jobSet: new Set<string>() };
    person.lines += 1;
    person.total_thb += row.pay_thb;
    person.jobSet.add(row.job_code);
    byPerson.set(code, person);
  }

  const people = [...byPerson.values()]
    .map(({ jobSet, ...person }) => ({ ...person, jobs: jobSet.size }))
    .sort((a, b) => b.total_thb - a.total_thb);

  return {
    month: valid ? month : first.slice(0, 7),
    total_thb: rows.reduce((sum, row) => sum + row.pay_thb, 0),
    jobs: new Set(rows.map((row) => row.job_code)).size,
    people,
    lines: rows.map((row) => ({
      employee_code: row.employee_code ?? "",
      name: displayName(row.employee_code ?? ""),
      job_code: row.job_code,
      workflow: row.workflow,
      role: row.role,
      role_label: ROLE_LABEL[row.role] ?? row.role,
      rate_label: row.rate_label,
      amount_thb: row.amount_thb,
      pct: row.pct,
      pay_thb: row.pay_thb,
      closed_at: row.closed_at,
    })),
  };
}
