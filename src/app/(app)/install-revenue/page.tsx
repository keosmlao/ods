import { employeeNameMap, resolveName } from "@/lib/employee-names";
import {
  installRevenueBetween,
  installRevenueByDay,
  installRevenueByTech,
  installRevenueDetail,
  unlinkedInstallBills,
} from "@/lib/service-money";
import { AlertTriangle, BarChart3, ChevronDown, ChevronLeft, ChevronRight, HardHat, Trophy } from "lucide-react";
import Link from "next/link";

/**
 * **ລາຍຮັບງານຕິດຕັ້ງ — ໂຕໂຕໃໝ່** (ອອກແບບຄືກັບ /tech-revenue ໃຫ້ອ່ານເປັນເດືອນ).
 *
 * ນັບຈາກ **ໃບງານຕິດຕັ້ງ** ບໍ່ແມ່ນຈາກບິນລອຍໆ — ຜູກຜ່ານ `ods_tb_install.doc_ref_1`
 * = ເລກບິນຂາຍ ERP ຂອງໃບງານນັ້ນ · ເອົາສະເພາະລາຍການຄ່າບໍລິການ 9701xx · ນັບຕາມວັນປິດງານ.
 * ໂຊ້ສະເພາະ **ບາດ** ຕາມ ERP — ບໍ່ແປງເປັນກີບ.
 *
 * ໂຄງໜ້າ: ① ເລືອກເດືອນ ‹ › ② ຍອດລວມ 4 ກ້ອນ ③ ກຣາຟລາຍວັນ + ອັນດັບຊ່າງ
 * ④ ຕາຕະລາງລາຍໃບງານ. ທຸກສ່ວນອ່ານຈາກສູດດຽວກັນ (lib/service-money) ⇒ ຕົວເລກກົງກັນ.
 */
export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ month?: string; page?: string }> };

const BATCH = 20;
const MONTH_RE = /^\d{4}-\d{2}$/;

/** ບວກ/ລົບເດືອນຈາກ string — ໃຫ້ລິ້ງ ‹ › ຄິດໄດ້ໂດຍບໍ່ພຶ່ງ Date ຝັ່ງ SQL */
function shiftMonth(month: string, step: number) {
  const [year, mon] = month.split("-").map(Number);
  const total = year * 12 + (mon - 1) + step;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}`;
}

const LAO_MONTH = [
  "ມັງກອນ", "ກຸມພາ", "ມີນາ", "ເມສາ", "ພຶດສະພາ", "ມິຖຸນາ",
  "ກໍລະກົດ", "ສິງຫາ", "ກັນຍາ", "ຕຸລາ", "ພະຈິກ", "ທັນວາ",
];

export default async function InstallRevenuePage({ searchParams }: Props) {
  const params = await searchParams;
  const today = new Date();
  const current = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  const month = MONTH_RE.test(params.month ?? "") ? params.month! : current;
  const page = Math.max(1, Number(params.page) || 1);
  const shown = BATCH * page;

  const [year, mon] = month.split("-").map(Number);
  const from = `${month}-01`;
  const daysInMonth = new Date(year, mon, 0).getDate();
  const to = `${month}-${String(daysInMonth).padStart(2, "0")}`;

  let total = { jobs: 0, baht: 0, ac: 0, app: 0, other: 0 };
  let rows: Awaited<ReturnType<typeof installRevenueDetail>> = [];
  let days: Awaited<ReturnType<typeof installRevenueByDay>> = [];
  let techs: Awaited<ReturnType<typeof installRevenueByTech>> = [];
  let unlinked: Awaited<ReturnType<typeof unlinkedInstallBills>> = [];
  let error: string | null = null;
  try {
    [total, rows, days, techs, unlinked] = await Promise.all([
      installRevenueBetween(from, to),
      installRevenueDetail(from, to, shown + 1),
      installRevenueByDay(from, to),
      installRevenueByTech(from, to),
      unlinkedInstallBills(from, to),
    ]);
  } catch (exception) {
    error = exception instanceof Error ? exception.message : "ດຶງຂໍ້ມູນບໍ່ສຳເລັດ";
  }
  const hasMore = rows.length > shown;
  const list = rows.slice(0, shown);

  /**
   * ບິນຍັງບໍ່ຜູກໃບງານ — **ເອົາຍອດຈາກ ERP ມາຊື່ໆ ບໍ່ແປງອັດຕາ** (ຄຳສັ່ງ 04-08-2026).
   * ແປງດ້ວຍ tb_bill_rate (550) ແລ້ວຕົວເລກບໍ່ຕົງກັບບິນຈິງ ⇒ ຄົນກວດຄືນກັບ ERP ບໍ່ໄດ້.
   */
  const unSum = {
    baht: unlinked.reduce((sum, bill) => sum + bill.baht, 0),
    ac: unlinked.reduce((sum, bill) => sum + bill.ac, 0),
    app: unlinked.reduce((sum, bill) => sum + bill.app, 0),
  };
  total = {
    ...total,
    baht: total.baht + unSum.baht,
    ac: total.ac + unSum.ac,
    app: total.app + unSum.app,
  };

  const avg = total.jobs > 0 ? total.baht / total.jobs : 0;
  const pct = (value: number) => (total.baht > 0 ? Math.round((value / total.baht) * 100) : 0);

  // ຊ່າງ: ຕ້ອງໂຊ້ **ຊື່** ບໍ່ແມ່ນລະຫັດ — tech_code ເປັນລະຫັດ ERP (23031) ຫຼືຊື່ຫຼິ້ນ
  // ⇒ ແປຈາກ odg_employee (ຄ່າທີ່ບໍ່ກົງລະຫັດ = ເປັນຊື່ຢູ່ແລ້ວ ຄົງໄວ້ຕາມເດີມ)
  const techNames = await employeeNameMap([...list.map((row) => row.tech), ...techs.map((row) => row.tech)]);

  const monthHref = (value: string) => `/install-revenue?month=${value}`;

  // ກຣາຟລາຍວັນ — ເຕັມຊ່ອງທຸກວັນຂອງເດືອນ (ວັນບໍ່ມີງານ = ຊ່ອງວ່າງ)
  const dayMap = new Map(days.map((day) => [day.day, day]));
  const peak = days.reduce((max, day) => Math.max(max, day.baht), 0);

  // ອັນດັບຊ່າງ — ແຖບສ່ວນແບ່ງທຽບກັບຄົນສູງສຸດ (ຮຽງມາຈາກ SQL ແລ້ວ)
  const topTech = techs[0]?.baht ?? 0;

  return (
    <div className="w-full space-y-5 pb-10">
      {/* ── ① ເລືອກເດືອນ ── */}
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="flex items-center gap-2 text-xl font-bold text-slate-700">
          <HardHat className="size-5 text-brand-700" />
          ລາຍຮັບງານຕິດຕັ້ງ
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
          <Link href={monthHref(current)} className="text-xs font-semibold text-brand-800 hover:underline">
            ກັບເດືອນນີ້
          </Link>
        )}
      </div>

      {error && (
        <p className="rounded-xl border border-brand-orange-400 bg-brand-orange-50 px-4 py-3 text-xs text-brand-orange-700">{error}</p>
      )}

      {/* ── ② ຍອດລວມຂອງເດືອນ — ແຍກ ແອ / ເຄື່ອງໃຊ້ໄຟຟ້າ ດ້ວຍກົດດຽວກັບລາຍງານປະຈຳເດືອນ ── */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "ໃບງານທີ່ປິດ", value: total.jobs.toLocaleString(), tone: "text-slate-800", sub: `ສະເລ່ຍ ${Math.round(avg).toLocaleString()} ບາດ/ໃບງານ` },
          { label: "ລາຍຮັບລວມ (ບາດ)", value: Math.round(total.baht).toLocaleString(), tone: "text-brand-800", sub: unlinked.length > 0 ? `ລວມບິນຍັງບໍ່ຜູກໃບງານ ${Math.round(unSum.baht).toLocaleString()}` : "" },
          { label: "ຕິດຕັ້ງແອ", value: Math.round(total.ac).toLocaleString(), tone: "text-brand-800", sub: `${pct(total.ac)}% ຂອງລາຍຮັບ` },
          { label: "ຕິດຕັ້ງເຄື່ອງໃຊ້ໄຟຟ້າ", value: Math.round(total.app).toLocaleString(), tone: "text-brand-700", sub: `${pct(total.app)}% ຂອງລາຍຮັບ` },
        ].map((card) => (
          <div key={card.label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-[11px] text-slate-400">{card.label}</p>
            <p className={`mt-1 text-2xl font-bold tabular-nums ${card.tone}`}>{card.value}</p>
            {card.sub && <p className="mt-0.5 text-[10px] tabular-nums text-slate-400">{card.sub}</p>}
          </div>
        ))}
      </div>
      {Math.round(total.other) > 0 && (
        <p className="-mt-2 text-[11px] text-slate-400">
          ນອກນັ້ນມີໝວດ <b>ອື່ນໆ</b> (ຕິດຕັ້ງໂຄງການ / ຄ່າໄລຍະທາງ) ອີກ {Math.round(total.other).toLocaleString()} ບາດ — ລວມຢູ່ໃນຍອດລວມແລ້ວ
        </p>
      )}

      {/* ── ③ ແນວໂນ້ມລາຍວັນ + ອັນດັບຊ່າງ ── */}
      <div className="grid gap-3 xl:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="mb-3 flex items-center gap-2 border-b border-slate-100 pb-2 text-sm font-bold text-slate-700">
            <BarChart3 className="size-4 text-brand-700" />
            ລາຍຮັບລາຍວັນ
            <span className="ml-auto text-[11px] font-medium text-slate-400">
              {days.length} ວັນທີ່ມີງານປິດ
            </span>
          </h2>
          {days.length === 0 && !error ? (
            <p className="py-10 text-center text-xs text-slate-400">ເດືອນນີ້ຍັງບໍ່ມີລາຍຮັບ</p>
          ) : (
            <>
              <div className="flex h-32 items-end gap-[3px]">
                {Array.from({ length: daysInMonth }, (_, index) => {
                  const day = dayMap.get(index + 1);
                  const height = day && peak > 0 ? Math.max(3, (day.baht / peak) * 100) : 0;
                  return (
                    <div
                      key={index + 1}
                      title={
                        day
                          ? `ວັນທີ ${index + 1} · ${day.jobs.toLocaleString()} ໃບງານ · ${Math.round(day.baht).toLocaleString()} ບາດ`
                          : `ວັນທີ ${index + 1} · ບໍ່ມີງານປິດ`
                      }
                      className="flex-1 rounded-t-sm"
                      style={{
                        height: `${height}%`,
                        backgroundColor: day ? (day.baht >= peak ? "#1e5b9a" : "#93ddf5") : "#f1f5f9",
                      }}
                    />
                  );
                })}
              </div>
              <div className="mt-1 flex gap-[3px] text-center text-[9px] text-slate-400">
                {Array.from({ length: daysInMonth }, (_, index) => (
                  <span key={index + 1} className="flex-1">
                    {(index + 1) % 5 === 1 || index + 1 === daysInMonth ? index + 1 : ""}
                  </span>
                ))}
              </div>
            </>
          )}
        </section>

        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-semibold text-slate-600">
            <Trophy className="size-3.5 text-brand-orange-300" />
            ຍອດຕາມຊ່າງ · {techs.length} ຄົນ
          </div>
          {techs.length === 0 && !error && (
            <p className="py-10 text-center text-xs text-slate-400">ເດືອນນີ້ຍັງບໍ່ມີລາຍຮັບ</p>
          )}
          <ul className="max-h-72 divide-y divide-slate-100 overflow-y-auto">
            {techs.map((row, index) => (
              <li key={row.tech} className="flex items-center gap-3 px-4 py-2.5">
                <span
                  className={`flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                    index === 0 ? "bg-brand-orange-300 text-brand-900" : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="truncate text-xs font-bold text-slate-700">
                      {resolveName(row.tech, techNames)}
                    </p>
                    <p className="shrink-0 text-xs font-bold tabular-nums text-slate-800">
                      {Math.round(row.baht).toLocaleString()}
                    </p>
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-brand-600"
                        style={{ width: `${topTech > 0 ? Math.max(2, (row.baht / topTech) * 100) : 0}%` }}
                      />
                    </div>
                    <span className="shrink-0 text-[10px] tabular-nums text-slate-400">
                      {row.jobs.toLocaleString()} ໃບງານ
                    </span>
                  </div>
                  {/* ແຍກ ແອ/ໄຟຟ້າ ຂອງຊ່າງຄົນນີ້ — 0 ບໍ່ໂຊ້ ໃຫ້ເຫັນແຕ່ໝວດທີ່ມີ */}
                  <p className="mt-0.5 text-[10px] tabular-nums text-slate-400">
                    {[row.ac > 0 && `ແອ ${Math.round(row.ac).toLocaleString()}`,
                      row.app > 0 && `ໄຟຟ້າ ${Math.round(row.app).toLocaleString()}`]
                      .filter(Boolean)
                      .join(" · ") || "ອື່ນໆ"}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {/* ── ④ ຕາຕະລາງລາຍໃບງານ ── */}
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px] border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-slate-600">
                <th className="px-4 py-2.5 font-semibold">ໃບງານ</th>
                <th className="px-4 py-2.5 font-semibold">ວັນປິດງານ</th>
                <th className="px-4 py-2.5 font-semibold">ລູກຄ້າ</th>
                <th className="px-4 py-2.5 font-semibold">ຊ່າງ</th>
                <th className="px-4 py-2.5 font-semibold">ບິນຂາຍ ERP</th>
                <th className="px-4 py-2.5 font-semibold">ຄ່າບໍລິການ</th>
                <th className="px-4 py-2.5 font-semibold">ໝວດ</th>
                <th className="px-4 py-2.5 text-right font-semibold">ບາດ</th>
              </tr>
            </thead>
            <tbody>
              {list.map((row) => (
                <tr key={row.code} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="whitespace-nowrap px-4 py-2">
                    <Link
                      href={`/installations/${encodeURIComponent(row.code)}`}
                      className="font-bold text-brand-700 hover:underline"
                    >
                      {row.code}
                    </Link>
                  </td>
                  <td className="whitespace-nowrap px-4 py-2 text-slate-500">{row.finished ?? "-"}</td>
                  <td className="max-w-56 truncate px-4 py-2 text-slate-700">{row.customer ?? "-"}</td>
                  <td className="whitespace-nowrap px-4 py-2 text-slate-600">
                    {row.tech ? resolveName(row.tech, techNames) : "-"}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2 font-mono text-[11px] text-slate-500">
                    {row.bill_no ?? "-"}
                  </td>
                  <td className="max-w-72 px-4 py-2 text-slate-600">
                    <span className="block truncate" title={row.items ?? ""}>
                      {row.items ?? "-"}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-2">
                    <InstallKindBadge ac={row.ac} app={row.app} baht={row.baht} />
                  </td>
                  <td className="whitespace-nowrap px-4 py-2 text-right font-bold tabular-nums text-slate-800">
                    {Math.round(row.baht).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {list.length === 0 && !error && (
          <p className="py-12 text-center text-xs text-slate-400">ເດືອນນີ້ຍັງບໍ່ມີໃບງານຕິດຕັ້ງທີ່ປິດພ້ອມຄ່າບໍລິການ</p>
        )}
      </section>

      {hasMore && (
        <nav className="flex items-center justify-center gap-3 text-xs">
          <Link
            href={`/install-revenue?month=${month}&page=${page + 1}`}
            scroll={false}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2 font-semibold text-slate-700 hover:bg-slate-50"
          >
            <ChevronDown className="size-3.5" />
            ໂຫຼດເພີ່ມ {BATCH} ໃບງານ
          </Link>
          <span className="text-slate-400">ສະແດງ {list.length.toLocaleString()} ຈາກ {total.jobs.toLocaleString()}</span>
        </nav>
      )}

      {/* ── ⑥ ບິນຕິດຕັ້ງທີ່ຍັງບໍ່ຜູກໃບງານ — ແປງກີບ→ບາດ ແລ້ວລວມເຂົ້າຍອດຂ້າງເທິງແລ້ວ ── */}
      {unlinked.length > 0 && (
        <section className="rounded-xl border border-brand-orange-400 bg-brand-orange-100 p-4 shadow-sm">
          <h2 className="flex flex-wrap items-center gap-2 text-sm font-bold text-brand-900">
            <AlertTriangle className="size-4" />
            ບິນຕິດຕັ້ງຍັງບໍ່ຜູກໃບງານ · {unlinked.length.toLocaleString()} ໃບ ·{" "}
            <span className="tabular-nums">{Math.round(unSum.baht).toLocaleString()} ບາດ</span>
          </h2>
          <p className="mt-1 text-[11px] text-brand-900">
            ບິນເຫຼົ່ານີ້ມີລາຍການຄ່າຕິດຕັ້ງ (9701xx) ມີລາຄາ ແຕ່ບໍ່ມີໃບງານໃດໃສ່ເລກບິນນີ້ໃນ <b>doc_ref_1</b>
            ⇒ ຍອດ <b>ເອົາຈາກ ERP ມາຊື່ໆ ແລະ ລວມເຂົ້າຍອດຂ້າງເທິງແລ້ວ</b> (ບໍ່ແປງອັດຕາ) ·
            ໃສ່ເລກບິນໃນໃບງານ ເມື່ອໄດ້ໃບງານແລ້ວ ຕົວເລກຈະຍ້າຍໄປຢູ່ໃບງານນັ້ນເອງ.
          </p>
          <div className="mt-2 overflow-x-auto rounded-lg border border-brand-orange-400 bg-white">
            <table className="w-full min-w-[760px] border-collapse text-xs">
              <thead>
                <tr className="border-b border-brand-orange-300 bg-brand-orange-100/60 text-left text-brand-900">
                  <th className="px-3 py-2 font-semibold">ເລກບິນ</th>
                  <th className="px-3 py-2 font-semibold">ວັນທີບິນ</th>
                  <th className="px-3 py-2 font-semibold">ລູກຄ້າ</th>
                  <th className="px-3 py-2 font-semibold">ລາຍການຕິດຕັ້ງ</th>
                  <th className="px-3 py-2 text-right font-semibold">ຍອດ</th>
                </tr>
              </thead>
              <tbody>
                {unlinked.map((bill) => (
                  <tr key={bill.doc_no} className="border-b border-brand-orange-200">
                    <td className="whitespace-nowrap px-3 py-1.5 font-mono text-[11px] font-semibold text-slate-700">
                      {bill.doc_no}
                    </td>
                    <td className="whitespace-nowrap px-3 py-1.5 text-slate-500">{bill.doc_date ?? "-"}</td>
                    <td className="max-w-48 truncate px-3 py-1.5 text-slate-600">{bill.customer ?? "-"}</td>
                    <td className="max-w-64 px-3 py-1.5 text-slate-600">
                      <span className="block truncate" title={bill.items ?? ""}>
                        {bill.items ?? "-"}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-1.5 text-right font-bold tabular-nums text-slate-800">
                      {Math.round(bill.baht).toLocaleString()}
                      <span className="ml-1 text-[10px] font-semibold text-slate-400">ບາດ</span>
                      {bill.kip && (
                        <p className="text-[10px] font-normal text-brand-900">
                          ຈາກ {Math.round(bill.baht).toLocaleString()} ກີບ
                        </p>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <p className="text-[11px] text-slate-400">
        ຜູກຜ່ານ <b>ods_tb_install.doc_ref_1</b> = ເລກບິນຂາຍ ERP ຂອງໃບງານ ແລ້ວເອົາສະເພາະລາຍການ
        ຄ່າບໍລິການຕິດຕັ້ງ (ລະຫັດ 9701xx) · ນັບຕາມວັນປິດງານ · ຍອດເປັນບາດ ຕາມທີ່ບັນທຶກໃນ ERP ·
        1 ບິນທີ່ຄຸມຫຼາຍໃບງານ ນັບຍອດເທື່ອດຽວ ແລ້ວຫານໃຫ້ແຕ່ລະໃບງານເທົ່າກັນ ·
        ແຍກ ແອ/ໄຟຟ້າ ຕາມລະຫັດບໍລິການ ກົດດຽວກັບລາຍງານປະຈຳເດືອນ
      </p>
    </div>
  );
}

/**
 * ປ້າຍໝວດຂອງແຖວ — ຕັດສິນຈາກສ່ວນແບ່ງ ແອ/ໄຟຟ້າ ຂອງແຖວນັ້ນ:
 * ໝວດໃດມີຄ່າສູງສຸດເອົາໝວດນັ້ນ · ມີຫຼາຍໝວດພໍກັນ = "ປົນ" · ບໍ່ມີທັງສອງ = ອື່ນໆ
 */
function InstallKindBadge({ ac, app, baht }: { ac: number; app: number; baht: number }) {
  const other = Math.max(0, baht - ac - app);
  const entries = [
    { label: "ແອ", value: ac, className: "bg-brand-50 text-brand-800 border-brand-200" },
    { label: "ໄຟຟ້າ", value: app, className: "bg-brand-50 text-brand-700 border-brand-200" },
    { label: "ອື່ນໆ", value: other, className: "bg-slate-100 text-slate-500 border-slate-200" },
  ].filter((entry) => entry.value > 0);
  const top = entries.reduce((best, entry) => (entry.value > best.value ? entry : best), entries[0]);
  if (!top) return <span className="text-slate-300">-</span>;
  const mixed = entries.filter((entry) => Math.abs(entry.value - top.value) < 0.005).length > 1;
  return (
    <span
      className={`inline-flex rounded-md border px-1.5 py-0.5 text-[10px] font-semibold ${mixed ? "bg-brand-orange-100 text-brand-900 border-brand-orange-400" : top.className}`}
    >
      {mixed ? "ປົນ" : top.label}
    </span>
  );
}
