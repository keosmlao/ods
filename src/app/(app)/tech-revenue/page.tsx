import { employeeNameMap, resolveName } from "@/lib/employee-names";
import { installRevenueBetween, payoutLines } from "@/lib/service-money";
import { ChevronLeft, ChevronRight, Trophy, Wallet, Wrench } from "lucide-react";
import Link from "next/link";

/**
 * **ລາຍຮັບຊ່າງ — ເບິ່ງເປັນເດືອນ**.
 *
 * ອ່ານຈາກ `ods_service_payout` — ແຫຼ່ງດຽວກັບໜ້າ "ລາຍຮັບຂອງຂ້ອຍ" ໃນແອັບ (ແຊ່ໄວ້ຕອນປິດງານ)
 * ⇒ ຕົວເລກຕົງກັນ · ມີແຕ່ "ຈ່າຍຈິງ" ບໍ່ມີ ຕົກລົງ/ຄ້າງ · ໂຊ້ສະເພາະ **ບາດ** ບໍ່ແປງໜ່ວຍ.
 *
 * ໂຄງໜ້າ: ① ເລືອກເດືອນ ② ຍອດລວມ ③ ລາຍຮັບຕິດຕັ້ງ (ບິນ ERP) ④ ແບ່ງຕາມບົດບາດ
 * ⑤ ບັນຊີຄົນຮຽງຈາກຫຼາຍໄປໜ້ອຍ ພ້ອມແຖບສ່ວນແບ່ງ ແລະ ໄຂເບິ່ງລາຍການໄດ້.
 */
export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ month?: string }> };

const MONTH_RE = /^\d{4}-\d{2}$/;

/** ຊື່ບົດບາດເປັນພາສາລາວ — ຄ່າດິບມາຈາກ ods_service_payout.role */
const ROLE: Record<string, string> = {
  technician: "ຊ່າງ",
  team_lead: "ຫົວໜ້າທີມ",
  supervisor: "ຜູ້ຄວບຄຸມ",
  admin: "ແອັດມິນ",
};

/** ບວກ/ລົບເດືອນ ໂດຍບໍ່ພຶ່ງ Date ໃນຝັ່ງ SQL — ໃຫ້ລິ້ງ ‹ › ຄິດໄດ້ຈາກ string */
function shiftMonth(month: string, step: number) {
  const [year, mon] = month.split("-").map(Number);
  const total = year * 12 + (mon - 1) + step;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}`;
}

const LAO_MONTH = [
  "ມັງກອນ", "ກຸມພາ", "ມີນາ", "ເມສາ", "ພຶດສະພາ", "ມິຖຸນາ",
  "ກໍລະກົດ", "ສິງຫາ", "ກັນຍາ", "ຕຸລາ", "ພະຈິກ", "ທັນວາ",
];

export default async function TechRevenueMonthPage({ searchParams }: Props) {
  const params = await searchParams;
  const today = new Date();
  const current = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  const month = MONTH_RE.test(params.month ?? "") ? params.month! : current;

  // ວັນສຸດທ້າຍຂອງເດືອນ = ວັນທີ 0 ຂອງເດືອນຖັດໄປ
  const [year, mon] = month.split("-").map(Number);
  const from = `${month}-01`;
  const to = `${month}-${String(new Date(year, mon, 0).getDate()).padStart(2, "0")}`;

  let lines: Awaited<ReturnType<typeof payoutLines>> = [];
  /**
   * **ລາຍຮັບຕິດຕັ້ງ** ບໍ່ໄດ້ຢູ່ຝັ່ງ ODS ເລີຍ — ວັດ 04-08-2026: ໃບງານ INST- ມີແຕ່ເອກະສານ
   * ອາໄຫຼ່ (122/56/166) **ບໍ່ມີບິນຈັກໃບ** ⇒ ຄ່າບໍລິການຕິດຕັ້ງອອກເປັນ **ບິນຂາຍຝັ່ງ ERP**
   * ດ້ວຍລະຫັດບໍລິການ 9701xx (ic_inventory). ໃຊ້ສູດດຽວກັບລາຍງານປະຈຳເດືອນ (lib/monthly-report)
   * ຈຶ່ງບໍ່ຂັດກັນລະຫວ່າງ 2 ໜ້າ.
   */
  let install = { jobs: 0, baht: 0 };
  let error: string | null = null;
  try {
    const [payRows, erpInstall] = await Promise.all([
      payoutLines(from, to),
      installRevenueBetween(from, to),
    ]);
    lines = payRows;
    // ໂຊ້ **ບາດ** ຕາມທີ່ບັນທຶກໃນ ERP — ບໍ່ແປງເປັນກີບ
    install = { jobs: erpInstall.jobs, baht: Math.round(erpInstall.baht) };
  } catch (exception) {
    error = exception instanceof Error ? exception.message : "ດຶງຂໍ້ມູນບໍ່ສຳເລັດ";
  }

  /**
   * ລວມເອງຢູ່ນີ້ (ບໍ່ລວມໃນ SQL) ⇒ ໄດ້ 3 ມຸມຈາກການດຶງເທື່ອດຽວ:
   * ① ຕໍ່ຄົນ (ພ້ອມຊື່) ② ຕໍ່ບົດບາດ ③ ລາຍການໃບງານຂອງແຕ່ລະຄົນ
   */
  const people = new Map<
    string,
    { code: string; name: string | null; thb: number; jobs: Set<string>; lines: typeof lines }
  >();
  const roles = new Map<string, { thb: number; count: number }>();
  for (const line of lines) {
    const key = line.employee_code || "ບໍ່ລະບຸ";
    const person = people.get(key) ?? { code: key, name: line.name, thb: 0, jobs: new Set<string>(), lines: [] };
    person.thb += line.pay_thb;
    person.jobs.add(line.job_code);
    person.lines.push(line);
    person.name = person.name ?? line.name;
    people.set(key, person);
    const role = roles.get(line.role) ?? { thb: 0, count: 0 };
    role.thb += line.pay_thb;
    role.count += 1;
    roles.set(line.role, role);
  }
  const ranked = [...people.values()].sort((a, b) => b.thb - a.thb);
  // ຊື່ທີ່ SQL ຫາບໍ່ເຫັນ (ຊ່າງຍັງບໍ່ມີບັນຊີ users) ⇒ ແປຈາກ odg_employee ຕໍ່ ບໍ່ໃຫ້ໂຊ້ລະຫັດເປົ່າໆ
  const missing = ranked.filter((person) => !person.name).map((person) => person.code);
  if (missing.length > 0) {
    const techNames = await employeeNameMap(missing);
    for (const person of ranked) if (!person.name) person.name = resolveName(person.code, techNames);
  }
  const top = ranked[0]?.thb ?? 0;
  const totals = {
    jobs: new Set(lines.map((line) => line.job_code)).size,
    thb: ranked.reduce((sum, row) => sum + row.thb, 0),
  };

  const monthHref = (value: string) => `/tech-revenue?month=${value}`;

  return (
    <div className="w-full space-y-5 pb-10">
      {/* ── ① ເລືອກເດືອນ ── */}
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="flex items-center gap-2 text-xl font-bold text-slate-700">
          <Wallet className="size-5 text-teal-600" />
          ລາຍຮັບຊ່າງ
        </h1>
        <div className="flex items-center gap-1 rounded-xl border border-slate-300 bg-white px-1 py-1">
          <Link
            href={monthHref(shiftMonth(month, -1))}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
            aria-label="ເດືອນກ່ອນ"
          >
            <ChevronLeft className="size-4" />
          </Link>
          <span className="min-w-36 text-center text-sm font-bold text-slate-700">
            {LAO_MONTH[mon - 1]} {year}
          </span>
          <Link
            href={monthHref(shiftMonth(month, 1))}
            aria-disabled={month >= current}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 aria-disabled:pointer-events-none aria-disabled:opacity-30"
            aria-label="ເດືອນຕໍ່ໄປ"
          >
            <ChevronRight className="size-4" />
          </Link>
        </div>
        {month !== current && (
          <Link href={monthHref(current)} className="text-xs font-semibold text-teal-700 hover:underline">
            ກັບເດືອນນີ້
          </Link>
        )}
      </div>

      {error && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">{error}</p>
      )}

      {/* ── ② ຍອດລວມ ── */}
      <div className="grid gap-3 sm:grid-cols-2">
        {[
          { label: "ວຽກທີ່ຈ່າຍແລ້ວ", value: totals.jobs.toLocaleString(), tone: "text-slate-800" },
          { label: "ລາຍຮັບຊ່າງ (ບາດ)", value: Math.round(totals.thb).toLocaleString(), tone: "text-emerald-700" },
        ].map((card) => (
          <div key={card.label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-[11px] text-slate-400">{card.label}</p>
            <p className={`mt-1 text-2xl font-bold tabular-nums ${card.tone}`}>{card.value}</p>
          </div>
        ))}
      </div>

      {/* ── ③ ລາຍຮັບຕິດຕັ້ງ (ຈາກບິນຂາຍ ERP) ── */}
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 flex flex-wrap items-center gap-2 border-b border-slate-100 pb-2 text-sm font-bold text-slate-700">
          <Wrench className="size-4 text-indigo-600" />
          ລາຍຮັບຈາກການຕິດຕັ້ງ
          <span className="text-[11px] font-medium text-slate-400">
            {install.jobs.toLocaleString()} ໃບງານປິດໃນເດືອນນີ້ · ຄ່າບໍລິການ 9701xx ຈາກບິນ ERP ຂອງໃບງານ
          </span>
          <span className="ml-auto text-lg font-bold tabular-nums text-slate-800">
            {install.baht.toLocaleString()} ບາດ
          </span>
        </h2>
        <p className="text-[11px] text-slate-400">
          ຜູກຜ່ານ <b>ods_tb_install.doc_ref_1</b> = ເລກບິນຂາຍ ERP ຂອງໃບງານນັ້ນ (ມີຄົບ 100% ຂອງໃບງານ ·
          92% ມີຄ່າບໍລິການ 9701xx). ນັບຕາມວັນປິດງານ · ຍອດເປັນບາດ ບໍ່ແປງໜ່ວຍ.
        </p>
      </section>

      {/* ── ພາກສ່ວນອື່ນທີ່ໄດ້ຮັບສ່ວນແບ່ງນຳ (ບໍ່ແມ່ນສະເພາະຊ່າງ) ── */}
      {roles.size > 0 && (
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="mb-2 border-b border-slate-100 pb-2 text-sm font-bold text-slate-700">
            ແບ່ງຕາມບົດບາດ
            <span className="ml-1.5 text-[11px] font-medium text-slate-400">ໃຜໄດ້ສ່ວນແບ່ງແດ່ໃນເດືອນນີ້</span>
          </h2>
          <div className="grid gap-3 sm:grid-cols-4">
            {[...roles.entries()]
              .sort((a, b) => b[1].thb - a[1].thb)
              .map(([role, value]) => (
                <div key={role} className="rounded-lg bg-slate-50 p-3">
                  <p className="text-[11px] text-slate-500">{ROLE[role] ?? role}</p>
                  <p className="mt-0.5 text-lg font-bold tabular-nums text-slate-800">
                    {Math.round(value.thb).toLocaleString()}
                  </p>
                  <p className="text-[10px] text-slate-400">{value.count} ລາຍການ</p>
                </div>
              ))}
          </div>
        </section>
      )}

      {/* ── ④ ບັນຊີຊ່າງ ຮຽງຈາກຫຼາຍໄປໜ້ອຍ ── */}
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-semibold text-slate-600">
          <Trophy className="size-3.5 text-amber-500" />
          ຮຽງຕາມລາຍຮັບ · {ranked.length} ຄົນ
        </div>

        {ranked.length === 0 && !error && (
          <p className="py-12 text-center text-xs text-slate-400">ເດືອນນີ້ຍັງບໍ່ມີການຈ່າຍ</p>
        )}

        <ul className="divide-y divide-slate-100">
          {ranked.map((row, index) => (
            <li key={row.code} className="px-4 py-3">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <span
                className={`flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                  index === 0 ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-500"
                }`}
              >
                {index + 1}
              </span>
              <div className="min-w-40 flex-1">
                <p className="text-sm font-bold text-slate-700">
                  {row.name ?? row.code}
                  {row.name && <span className="ml-1.5 text-[10px] font-normal text-slate-400">{row.code}</span>}
                </p>
                <p className="text-[11px] text-slate-400">{row.jobs.size.toLocaleString()} ວຽກ</p>
                {/* ແຖບສ່ວນແບ່ງທຽບກັບຄົນສູງສຸດ — ເຫັນຄວາມຕ່າງໄດ້ໂດຍບໍ່ຕ້ອງອ່ານເລກ */}
                <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-teal-500"
                    style={{ width: `${top > 0 ? Math.max(2, (row.thb / top) * 100) : 0}%` }}
                  />
                </div>
              </div>
              <dl className="text-right text-xs tabular-nums">
                <dt className="text-[10px] text-slate-400">ລາຍຮັບ (ບາດ)</dt>
                <dd className="text-base font-bold text-emerald-700">{Math.round(row.thb).toLocaleString()}</dd>
              </dl>
              </div>

              {/* ── ກົດເບິ່ງໃບງານທີ່ເປັນທີ່ມາຂອງລາຍຮັບກ້ອນນີ້ ── */}
              <details className="mt-2">
                <summary className="cursor-pointer text-[11px] font-semibold text-teal-700 hover:underline">
                  ເບິ່ງລາຍລະອຽດ {row.lines.length} ລາຍການ
                </summary>
                <table className="mt-1.5 w-full border-collapse text-[11px]">
                  <thead>
                    <tr className="border-b border-slate-100 text-left text-slate-500">
                      <th className="py-1 font-semibold">ໃບງານ</th>
                      <th className="py-1 font-semibold">ປະເພດ</th>
                      <th className="py-1 font-semibold">ບົດບາດ</th>
                      <th className="py-1 font-semibold">ວັນປິດງານ</th>
                      <th className="py-1 text-right font-semibold">ບາດ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {row.lines.map((line, index) => (
                      <tr key={`${line.job_code}-${line.role}-${index}`} className="border-b border-slate-50">
                        <td className="py-1">
                          <Link
                            href={
                              line.workflow === "install"
                                ? `/installations/${encodeURIComponent(line.job_code)}`
                                : `/service/${encodeURIComponent(line.job_code)}`
                            }
                            className="font-semibold text-blue-700 hover:underline"
                          >
                            {line.job_code}
                          </Link>
                        </td>
                        <td className="py-1 text-slate-500">{line.workflow === "install" ? "ຕິດຕັ້ງ" : "ສ້ອມ"}</td>
                        <td className="py-1 text-slate-500">{ROLE[line.role] ?? line.role}</td>
                        <td className="py-1 text-slate-400">{line.closed_at ?? "-"}</td>
                        <td className="py-1 text-right font-semibold tabular-nums">
                          {Math.round(line.pay_thb).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </details>
            </li>
          ))}
        </ul>
      </section>

      <p className="text-[11px] text-slate-400">
        ອ່ານຈາກ <b>ods_service_payout</b> — ແຫຼ່ງດຽວກັບໜ້າ “ລາຍຮັບຂອງຂ້ອຍ” ໃນແອັບ (ແຊ່ໄວ້ຕອນປິດງານ) ⇒ ຕົວເລກຕົງກັນ
      </p>
    </div>
  );
}
