import { Card, Empty, PageTitle, Table } from "@/components/ui";
import { getSession } from "@/lib/auth";
import { ROLE_LABEL } from "@/lib/commission";
import { query, queryOdg } from "@/lib/db";
import { roleOf } from "@/lib/roles";
import { ownJobsOnly } from "@/lib/scope";
import { AlertTriangle } from "lucide-react";
import Link from "next/link";

/**
 * ລາຍຮັບ / ຄ່າຄອມ — ອ່ານຈາກ **ods_service_payout ຢ່າງດຽວ** (ຕົວເລກທີ່ແຊ່ໄວ້ຕອນປິດງານ).
 *
 * ບໍ່ຄິດເງິນສົດຢູ່ນີ້: ຖ້າຄິດໃໝ່ທຸກຄັ້ງທີ່ເປີດລາຍງານ ພໍປ່ຽນອັດຕາເດືອນໜ້າ **ເງິນຂອງເດືອນ
 * ທີ່ຈ່າຍໄປແລ້ວຈະປ່ຽນຕາມ** — ບັນຊີກັບສະລິບຈະບໍ່ຕົງກັນ.
 *
 * ຊ່າງເຫັນສະເພາະຂອງຕົນ (lib/scope) · ຄົນອື່ນເຫັນທັງໝົດ.
 */
export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ month?: string }> };

type Row = {
  employee_code: string | null;
  role: string;
  jobs: number;
  total_thb: string;
};

type Detail = {
  job_code: string;
  workflow: string;
  rate_label: string | null;
  role: string;
  employee_code: string | null;
  amount_thb: string;
  pct: string;
  pay_thb: string;
  closed_on: string | null;
};

const ISO_MONTH = /^\d{4}-\d{2}$/;

export default async function TechnicianIncomePage({ searchParams }: Props) {
  const session = await getSession();
  const tech = ownJobsOnly(session);
  const isManager = roleOf(session) === "manager";

  const params = await searchParams;
  const month = ISO_MONTH.test(params.month ?? "") ? (params.month as string) : new Date().toISOString().slice(0, 7);

  // ຂອບເຂດເດືອນ — ໃຊ້ closed_at (ເວລາປິດງານ) ບໍ່ແມ່ນເວລາຄິດເງິນ
  const where = ["p.closed_at >= $1::date", "p.closed_at < ($1::date + interval '1 month')"];
  const args: string[] = [`${month}-01`];
  if (tech) {
    args.push(tech);
    where.push(`p.employee_code = $${args.length}`);
  }
  const filter = where.join(" and ");

  const [summary, unassigned, details, unpriced] = await Promise.all([
    /**
     * ສະຫຼຸບ — **ສະເພາະຜູ້ທີ່ຖືກກຳນົດ** (employee_code ບໍ່ຫວ່າງ).
     * ຄື: ຊ່າງທີ່ເຊື່ອມຕົວຕົນແລ້ວ (/manage/technicians) ແລະ ບົດບາດທີ່ລະບຸຜູ້ຮັບແລ້ວ
     * (/manage/service-rates). ຄົນທີ່ຍັງບໍ່ກຳນົດ ບໍ່ຂຶ້ນຢູ່ນີ້ — ແຕ່ເງິນບໍ່ຫາຍ
     * (ນັບແຍກໄວ້ຢູ່ `unassigned` ແລ້ວຂຶ້ນເປັນຄຳເຕືອນ).
     */
    query<Row>(
      `select p.employee_code, p.role, count(*)::int jobs, sum(p.pay_thb)::text total_thb
         from ods_service_payout p
        where ${filter} and p.employee_code is not null
        group by p.employee_code, p.role
        order by sum(p.pay_thb) desc`,
      args,
    ),
    // ເງິນທີ່ຍັງບໍ່ມີເຈົ້າຂອງ — ຕ້ອງເຫັນ ບໍ່ດັ່ງນັ້ນເງິນຫາຍງຽບໆ
    query<{ jobs: number; total_thb: string | null }>(
      `select count(*)::int jobs, sum(p.pay_thb)::text total_thb
         from ods_service_payout p
        where ${filter} and p.employee_code is null`,
      args,
    ),
    query<Detail>(
      `select p.job_code, p.workflow, p.rate_label, p.role, p.employee_code,
          p.amount_thb, p.pct, p.pay_thb, to_char(p.closed_at,'DD-MM-YYYY') closed_on
         from ods_service_payout p
        where ${filter}
        order by p.closed_at desc, p.job_code
        limit 200`,
      args,
    ),
    /**
     * ງານທີ່ປິດແລ້ວ ແຕ່ **ບໍ່ມີແຖວເງິນ** — ຈັບຄູ່ອັດຕາບໍ່ໄດ້ (ບໍ່ມີ item_code, ຫຼື ຍັງບໍ່ຕັ້ງອັດຕາ).
     * ຕ້ອງເຫັນ ບໍ່ດັ່ງນັ້ນເງິນຫາຍງຽບໆ ໂດຍບໍ່ມີໃຜຮູ້.
     */
    isManager
      ? query<{ workflow: string; n: number }>(
          `select 'install' as workflow, count(*)::int n from ods_tb_install a
             where a.job_finish >= $1::date and a.job_finish < ($1::date + interval '1 month')
               and not exists (select 1 from ods_service_payout p
                               where p.workflow='install' and p.job_code = a.code)
           union all
           select 'repair', count(*)::int from tb_product a
             where a.return_complete >= $1::date and a.return_complete < ($1::date + interval '1 month')
               and a.status <> 6
               and not exists (select 1 from ods_service_payout p
                               where p.workflow='repair' and p.job_code = a.code)`,
          [`${month}-01`],
        )
      : Promise.resolve({ rows: [] as { workflow: string; n: number }[] }),
  ]);

  const grand = summary.rows.reduce((sum, row) => sum + Number(row.total_thb), 0);
  const missing = unpriced.rows.reduce((sum, row) => sum + row.n, 0);
  const orphanJobs = unassigned.rows[0]?.jobs ?? 0;
  const orphanThb = Number(unassigned.rows[0]?.total_thb ?? 0);

  /**
   * ຊື່ຂອງຜູ້ຮັບເງິນ — ຕ້ອງແປງຈາກ **ສອງລະບົບຕົວຕົນ** ບໍ່ດັ່ງນັ້ນຈະສະແດງເປັນລະຫັດດິບ:
   *
   *   ຊ່າງ         ← tech_code / emp_code ຂອງງານ ('Xiew', 'sak', 'Mee' …)
   *                  ⇒ ຢູ່ໃນ users ຂອງ ODS (23 ໃນ 25 ຄົນ ບໍ່ມີໃນ ERP)
   *   ຜູ້ຄຸມ/ຫົວໜ້າທີມ/Admin ← employee_code ຂອງ odg_employee ('25069')
   *
   * ຄົ້ນ ODS ກ່ອນ ແລ້ວຄ່ອຍ ERP. ບໍ່ພົບທັງສອງ → ສະແດງລະຫັດດິບ (ດີກວ່າຫວ່າງ).
   */
  const [odsUsers, erpStaff] = await Promise.all([
    query<{ code: string; name: string }>(
      `select code, coalesce(nullif(name_1,''), username, code) as name from users`,
    ),
    queryOdg<{ code: string; name: string }>(
      `select employee_code as code, coalesce(nullif(fullname_lo,''), employee_code) as name
         from odg_employee`,
    ).catch(() => ({ rows: [] as { code: string; name: string }[] })),
  ]);
  const names = new Map<string, string>();
  for (const staff of erpStaff.rows) names.set(staff.code, staff.name);
  for (const user of odsUsers.rows) names.set(user.code, user.name); // ODS ຊະນະ (ຊື່ທີ່ຄົນຮູ້ຈັກ)
  const nameOf = (code: string | null) => (code ? (names.get(code) ?? code) : null);

  const monthHref = (value: string) => `/reports/technician-income?month=${value}`;
  const shift = (delta: number) => {
    const [year, mon] = month.split("-").map(Number);
    const date = new Date(Date.UTC(year, mon - 1 + delta, 1));
    return date.toISOString().slice(0, 7);
  };

  return (
    <div className="w-full space-y-5">
      <PageTitle sub={tech ? "ສະແດງສະເພາະລາຍຮັບຂອງທ່ານ" : "ຄ່າຄອມທີ່ແຊ່ໄວ້ຕອນປິດງານ (ບາທ)"}>
        ລາຍຮັບຊ່າງ
      </PageTitle>

      <div className="flex flex-wrap items-center gap-2">
        <Link href={monthHref(shift(-1))} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs hover:bg-slate-50">
          ← ເດືອນກ່ອນ
        </Link>
        <span className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-bold text-white">{month}</span>
        <Link href={monthHref(shift(1))} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs hover:bg-slate-50">
          ເດືອນຕໍ່ໄປ →
        </Link>
        <span className="ml-auto text-sm">
          ລວມ <b className="text-lg text-slate-900">{grand.toLocaleString("en-US", { minimumFractionDigits: 2 })}</b>{" "}
          <span className="text-xs text-slate-400">ບາທ</span>
        </span>
      </div>

      {/* ເງິນທີ່ຄິດແລ້ວ ແຕ່ຍັງບໍ່ມີເຈົ້າຂອງ — ບໍ່ຢູ່ໃນຕາຕະລາງລຸ່ມ ຈຶ່ງຕ້ອງເຕືອນຢູ່ນີ້ */}
      {orphanJobs > 0 && (
        <Link
          href="/manage/technicians"
          className="flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-xs text-amber-800 transition hover:bg-amber-100"
        >
          <AlertTriangle className="size-4 shrink-0" />
          <span className="flex-1">
            <b>{orphanThb.toLocaleString("en-US", { minimumFractionDigits: 2 })} ບາທ</b> ({orphanJobs} ແຖວ)
            ຄິດແລ້ວແຕ່ <b>ຍັງບໍ່ມີເຈົ້າຂອງ</b> — ຊ່າງຍັງບໍ່ໄດ້ເຊື່ອມຕົວຕົນ ຫຼື ບົດບາດຍັງບໍ່ໄດ້ລະບຸຜູ້ຮັບ.
            ເງິນບໍ່ຫາຍ ແຕ່ຍັງບໍ່ຂຶ້ນຕາຕະລາງລຸ່ມ. ກົດເພື່ອໄປເຊື່ອມ.
          </span>
        </Link>
      )}

      {/* ງານທີ່ຄິດເງິນບໍ່ໄດ້ — ຕ້ອງເຫັນ ບໍ່ດັ່ງນັ້ນເງິນຫາຍງຽບໆ */}
      {missing > 0 && (
        <Link
          href="/manage/service-rates"
          className="flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-xs text-amber-800 transition hover:bg-amber-100"
        >
          <AlertTriangle className="size-4 shrink-0" />
          <span className="flex-1">
            <b>{missing} ງານ</b> ປິດໃນເດືອນນີ້ ແຕ່ <b>ຍັງບໍ່ໄດ້ຄິດຄ່າບໍລິການ</b> — ຈັບຄູ່ອັດຕາບໍ່ໄດ້
            (ບໍ່ມີລະຫັດສິນຄ້າ ERP ຫຼື ຍັງບໍ່ໄດ້ຕັ້ງອັດຕາ). ກົດເພື່ອໄປຕັ້ງອັດຕາ.
          </span>
        </Link>
      )}

      <Card title="ສະຫຼຸບຕໍ່ຄົນ">
        {summary.rows.length === 0 ? (
          <Empty>ບໍ່ມີລາຍຮັບໃນເດືອນນີ້</Empty>
        ) : (
          <Table head={["ຜູ້ຮັບ", "ບົດບາດ", "ຈຳນວນງານ", "ລວມ (ບາທ)"]} minWidth={520}>
            {summary.rows.map((row) => (
              <tr key={`${row.employee_code}-${row.role}`} className="border-b border-slate-100">
                {/* ຕາຕະລາງນີ້ມີແຕ່ຜູ້ທີ່ຖືກກຳນົດແລ້ວ (query ກອງ employee_code is not null) */}
                <td className="px-3 py-2 text-xs font-semibold text-slate-800">{nameOf(row.employee_code)}</td>
                <td className="px-3 py-2 text-xs text-slate-600">{ROLE_LABEL[row.role] ?? row.role}</td>
                <td className="px-3 py-2 text-xs text-slate-600">{row.jobs.toLocaleString()}</td>
                <td className="px-3 py-2 text-xs font-bold text-slate-900">
                  {Number(row.total_thb).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      <Card title={`ລາຍລະອຽດ (${details.rows.length})`}>
        {details.rows.length === 0 ? (
          <Empty>ບໍ່ມີລາຍການ</Empty>
        ) : (
          <Table head={["ວັນປິດງານ", "ງານ", "ສາຍງານ", "ອັດຕາ", "ຄ່າບໍລິການ", "ຜູ້ຮັບ", "ບົດບາດ", "%", "ໄດ້ຮັບ"]} minWidth={900}>
            {details.rows.map((row) => (
              <tr key={`${row.workflow}-${row.job_code}-${row.role}`} className="border-b border-slate-100">
                <td className="whitespace-nowrap px-3 py-2 text-xs text-slate-500">{row.closed_on ?? "-"}</td>
                <td className="whitespace-nowrap px-3 py-2 text-xs font-bold text-[#0536a9]">
                  <Link
                    href={
                      row.workflow === "install"
                        ? `/installations/${encodeURIComponent(row.job_code)}`
                        : `/service/${encodeURIComponent(row.job_code)}`
                    }
                    className="hover:underline"
                  >
                    {row.job_code}
                  </Link>
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-xs">
                  <span
                    className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                      row.workflow === "install" ? "bg-violet-50 text-violet-700" : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {row.workflow === "install" ? "ຕິດຕັ້ງ" : "ສ້ອມແປງ"}
                  </span>
                </td>
                <td className="max-w-56 truncate px-3 py-2 text-xs text-slate-600" title={row.rate_label ?? ""}>
                  {row.rate_label ?? "-"}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-xs text-slate-500">
                  {Number(row.amount_thb).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-xs text-slate-700">
                  {nameOf(row.employee_code) ?? <span className="text-amber-700">—</span>}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-xs text-slate-600">
                  {ROLE_LABEL[row.role] ?? row.role}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-xs text-slate-500">{Number(row.pct)}%</td>
                <td className="whitespace-nowrap px-3 py-2 text-xs font-bold text-slate-900">
                  {Number(row.pay_thb).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </div>
  );
}
