import { monthlyRevenueMatrix, REV_CATEGORIES, type RevCategory } from "@/lib/monthly-report";
import Link from "next/link";

/**
 * **ສະຫຼຸບລາຍຮັບປະຈຳເດືອນ — ສະບັບນຳສະເໜີຜູ້ບໍລິຫານ** (ໜ້າດຽວ · ພິມ A4 ໄດ້).
 *
 * ແຍກ 2 ຊັ້ນ: **ຕິດຕັ້ງ / ສ້ອມ** × **ແອ / ເຄື່ອງໃຊ້ໄຟຟ້າ** ⇒ 4 ໝວດ + ອື່ນໆ.
 *
 * ⚠️ ຕົວເລກມາຈາກ `monthlyRevenueMatrix` ເທົ່ານັ້ນ — ຢ່າຄິດສູດເອງໃໝ່.
 * ເຫດຜົນ: ໃບຕະກູນ **HSV ປ້ອນຄ່າເປັນກີບ**ທັງໃບ ທັງທີ່ currency_code='01'
 * ⇒ ຖ້າ sum ດິບຈະໄດ້ "ຕິດຕັ້ງເຄື່ອງໃຊ້ໄຟຟ້າ 3 ລ້ານບາດ/ເດືອນ" ເຊິ່ງບໍ່ມີຈິງ.
 * lib ນັ້ນຫານອັດຕາໃຫ້ແລ້ວ (ເບິ່ງຄຳເມັນໃນໄຟລ໌ນັ້ນ).
 *
 * ໜ້ານີ້ບໍ່ມີເມນູ/ປຸ່ມຕອນພິມ (`print:hidden`) ⇒ ໄດ້ເອກະສານສະອາດ.
 */
export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ year?: string }> };

const LABEL: Record<RevCategory, string> = {
  install_ac: "ຕິດຕັ້ງ · ແອ",
  install_app: "ຕິດຕັ້ງ · ເຄື່ອງໃຊ້ໄຟຟ້າ",
  repair_ac: "ສ້ອມ · ແອ",
  repair_app: "ສ້ອມ · ເຄື່ອງໃຊ້ໄຟຟ້າ",
  other: "ອື່ນໆ",
};
const BAR: Record<RevCategory, string> = {
  install_ac: "bg-teal-600",
  install_app: "bg-teal-400",
  repair_ac: "bg-indigo-600",
  repair_app: "bg-indigo-400",
  other: "bg-slate-400",
};
const MONTHS = ["ມັງກອນ","ກຸມພາ","ມີນາ","ເມສາ","ພຶດສະພາ","ມິຖຸນາ","ກໍລະກົດ","ສິງຫາ","ກັນຍາ","ຕຸລາ","ພະຈິກ","ທັນວາ"];

export default async function RevenueSummaryPage({ searchParams }: Props) {
  const params = await searchParams;
  const thisYear = new Date().getFullYear();
  const year = Number(params.year) >= 2020 && Number(params.year) <= thisYear ? Number(params.year) : thisYear;

  const matrix = await monthlyRevenueMatrix(year);
  const cell = (y: number, m: number) => matrix.get(`${y}-${String(m + 1).padStart(2, "0")}`);

  const rows = MONTHS.map((label, index) => {
    const now = cell(year, index);
    const prev = cell(year - 1, index);
    const total = now?.total ?? 0;
    const last = prev?.total ?? 0;
    return {
      label,
      values: Object.fromEntries(REV_CATEGORIES.map((c) => [c, now?.[c] ?? 0])) as Record<RevCategory, number>,
      total,
      last,
      yoy: last > 0 ? ((total - last) / last) * 100 : null,
    };
  });

  const active = rows.filter((row) => row.total > 0);
  const grand = rows.reduce((sum, row) => sum + row.total, 0);
  const lastYear = rows.reduce((sum, row) => sum + row.last, 0);
  const byCategory = Object.fromEntries(
    REV_CATEGORIES.map((c) => [c, rows.reduce((sum, row) => sum + row.values[c], 0)]),
  ) as Record<RevCategory, number>;
  const peak = active.reduce((best, row) => (row.total > best.total ? row : best), active[0] ?? rows[0]);
  const best = REV_CATEGORIES.reduce((a, b) => (byCategory[a] >= byCategory[b] ? a : b));
  const average = active.length > 0 ? grand / active.length : 0;
  const money = (value: number) => Math.round(value).toLocaleString();
  const pct = (value: number) => (grand > 0 ? Math.round((value / grand) * 100) : 0);
  const yoyAll = lastYear > 0 ? ((grand - lastYear) / lastYear) * 100 : null;

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 bg-white p-8 text-slate-800 print:p-0">
      <div className="flex items-start justify-between gap-4 border-b-2 border-slate-800 pb-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-teal-700">ODIEN SERVICE CENTER</p>
          <h1 className="mt-1 text-2xl font-bold">ລາຍງານລາຍຮັບປະຈຳປີ {year}</h1>
          <p className="mt-0.5 text-xs text-slate-500">
            ແຍກຕາມປະເພດງານ (ຕິດຕັ້ງ · ສ້ອມແປງ) ແລະ ປະເພດເຄື່ອງ (ແອ · ເຄື່ອງໃຊ້ໄຟຟ້າ) · ຫົວໜ່ວຍ: ບາດ
          </p>
        </div>
        {/* ເລືອກປີ — ເຊື່ອງຕອນພິມ ⇒ ເອກະສານສະອາດ */}
        <div className="flex shrink-0 items-center gap-1 rounded-xl border border-slate-300 px-1 py-1 print:hidden">
          <Link href={`/revenue-summary?year=${year - 1}`} className="rounded-lg px-2 py-1 text-xs hover:bg-slate-100">
            ‹ {year - 1}
          </Link>
          <Link
            href={`/revenue-summary?year=${year + 1}`}
            aria-disabled={year >= thisYear}
            className="rounded-lg px-2 py-1 text-xs hover:bg-slate-100 aria-disabled:pointer-events-none aria-disabled:opacity-30"
          >
            {year + 1} ›
          </Link>
        </div>
      </div>

      {/* ── ຕົວເລກຫຼັກ ── */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-slate-300 p-4">
          <p className="text-[11px] text-slate-500">ລາຍຮັບລວມທັງປີ</p>
          <p className="mt-1 text-3xl font-bold tabular-nums">{money(grand)}</p>
          {yoyAll !== null && (
            <p className={`text-xs font-semibold ${yoyAll >= 0 ? "text-emerald-700" : "text-red-600"}`}>
              {yoyAll >= 0 ? "▲" : "▼"} {Math.abs(Math.round(yoyAll))}% ທຽບປີ {year - 1}
            </p>
          )}
        </div>
        <div className="rounded-xl border border-slate-300 p-4">
          <p className="text-[11px] text-slate-500">ສະເລ່ຍຕໍ່ເດືອນ</p>
          <p className="mt-1 text-3xl font-bold tabular-nums">{money(average)}</p>
          <p className="text-xs text-slate-500">ຈາກ {active.length} ເດືອນທີ່ມີລາຍຮັບ</p>
        </div>
        <div className="rounded-xl border border-slate-300 p-4">
          <p className="text-[11px] text-slate-500">ເດືອນສູງສຸດ</p>
          <p className="mt-1 text-3xl font-bold">{peak?.label ?? "-"}</p>
          <p className="text-xs text-slate-500">{money(peak?.total ?? 0)} ບາດ</p>
        </div>
      </div>

      {/* ── ສັດສ່ວນຕາມໝວດ ── */}
      <section>
        <h2 className="mb-2 text-sm font-bold">ອົງປະກອບລາຍຮັບ</h2>
        <div className="flex h-4 w-full overflow-hidden rounded-full">
          {REV_CATEGORIES.map((category) => (
            <span key={category} className={BAR[category]} style={{ width: `${pct(byCategory[category])}%` }} />
          ))}
        </div>
        <div className="mt-3 grid grid-cols-5 gap-3 text-xs">
          {REV_CATEGORIES.map((category) => (
            <div key={category}>
              <p className="flex items-center gap-1.5 text-slate-500">
                <span className={`size-2 rounded-full ${BAR[category]}`} />
                {LABEL[category]}
              </p>
              <p className="mt-0.5 font-bold tabular-nums">{money(byCategory[category])}</p>
              <p className="text-[10px] text-slate-400">{pct(byCategory[category])}%</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── ຕາຕະລາງລາຍເດືອນ ── */}
      <section>
        <h2 className="mb-2 text-sm font-bold">ລາຍຮັບລາຍເດືອນ</h2>
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="border-y border-slate-300 text-left">
              <th className="py-2 font-semibold">ເດືອນ</th>
              {REV_CATEGORIES.map((category) => (
                <th key={category} className="py-2 text-right font-semibold">
                  {LABEL[category]}
                </th>
              ))}
              <th className="py-2 text-right font-semibold">ລວມ</th>
              <th className="py-2 text-right font-semibold">ທຽບ {year - 1}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label} className="border-b border-slate-100">
                <td className="py-1.5 font-medium">{row.label}</td>
                {REV_CATEGORIES.map((category) => (
                  <td key={category} className="py-1.5 text-right tabular-nums text-slate-600">
                    {row.values[category] > 0 ? money(row.values[category]) : "—"}
                  </td>
                ))}
                <td className="py-1.5 text-right font-bold tabular-nums">{money(row.total)}</td>
                <td
                  className={`py-1.5 text-right tabular-nums ${
                    row.yoy === null ? "text-slate-300" : row.yoy >= 0 ? "text-emerald-700" : "text-red-600"
                  }`}
                >
                  {row.yoy === null ? "—" : `${row.yoy >= 0 ? "+" : ""}${Math.round(row.yoy)}%`}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-slate-800 font-bold">
              <td className="py-2">ລວມ</td>
              {REV_CATEGORIES.map((category) => (
                <td key={category} className="py-2 text-right tabular-nums">
                  {money(byCategory[category])}
                </td>
              ))}
              <td className="py-2 text-right tabular-nums">{money(grand)}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </section>

      {/* ── ຂໍ້ສັງເກດ — ຄິດຈາກຂໍ້ມູນ ບໍ່ແມ່ນຂໍ້ຄວາມຕາຍຕົວ ── */}
      <section className="rounded-xl border border-slate-300 bg-slate-50 p-4 text-xs leading-6">
        <h2 className="mb-1 text-sm font-bold">ຂໍ້ສັງເກດ</h2>
        <ul className="list-disc space-y-0.5 pl-5">
          <li>
            ໝວດທີ່ສ້າງລາຍຮັບຫຼາຍສຸດແມ່ນ <b>{LABEL[best]}</b> ຄິດເປັນ {pct(byCategory[best])}% ຂອງລາຍຮັບທັງປີ
          </li>
          <li>
            ເດືອນ <b>{peak?.label}</b> ສູງສຸດທີ່ {money(peak?.total ?? 0)} ບາດ — ສູງກວ່າຄ່າສະເລ່ຍ{" "}
            {average > 0 ? Math.round((((peak?.total ?? 0) - average) / average) * 100) : 0}%
          </li>
          {yoyAll !== null && (
            <li>
              ລາຍຮັບລວມ {yoyAll >= 0 ? "ເພີ່ມຂຶ້ນ" : "ຫຼຸດລົງ"} {Math.abs(Math.round(yoyAll))}% ທຽບກັບປີ {year - 1}
              （{money(lastYear)} ບາດ）
            </li>
          )}
        </ul>
      </section>

      <p className="border-t border-slate-200 pt-3 text-[10px] text-slate-400">
        ແຫຼ່ງຂໍ້ມູນ: ບິນຂາຍ ERP (ic_trans trans_flag 44) ລະຫັດບໍລິການ 9701xx (ຕິດຕັ້ງ) ແລະ 9702xx (ສ້ອມ) ·
        ໃບຕະກູນ HSV ປ້ອນເປັນກີບ ຈຶ່ງແປງດ້ວຍອັດຕາ tb_bill_rate ກ່ອນລວມ · ສ້າງໂດຍລະບົບ ODS
      </p>
    </div>
  );
}
