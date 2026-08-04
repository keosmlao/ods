import { monthlyRevenueMatrix, REV_CATEGORIES, type RevCategory } from "@/lib/monthly-report";
import { ChevronLeft, ChevronRight, PieChart } from "lucide-react";
import Link from "next/link";

/**
 * **ສະຫຼຸບລາຍຮັບປະຈຳເດືອນ — ໜ້າດຽວຈົບ**.
 *
 * ແຍກ 2 ຊັ້ນຕາມທີ່ຕ້ອງການ: **ຕິດຕັ້ງ / ສ້ອມ** × **ແອ / ເຄື່ອງໃຊ້ໄຟຟ້າ**
 * ⇒ 4 ໝວດຫຼັກ + "ອື່ນໆ" (ຕິດຕັ້ງໂຄງການ · ຄ່າໄລຍະທາງ · ບຳລຸງຮັກສາ).
 *
 * ໃຊ້ `lib/monthly-report` ທີ່ມີຢູ່ແລ້ວ — ບໍ່ຂຽນສູດໃໝ່ ຈຶ່ງ **ບໍ່ມີ 2 ຕົວເລກຂັດກັນ**
 * ກັບໜ້າ /reports/monthly-revenue (ຂອງຜູ້ຈັດການ).
 *
 * ⚠️ ຝັ່ງຕິດຕັ້ງທີ່ນີ້ນັບຈາກ **ບິນຂາຍ ERP ຕາມວັນທີບິນ** (ລະຫັດ 9701xx).
 * ໜ້າ /install-revenue ນັບຄົນລະແບບ — ຈາກ **ໃບງານ** (doc_ref_1) ຕາມ **ວັນປິດງານ**
 * ⇒ 2 ໜ້ານັ້ນຈະບໍ່ເທົ່າກັນໂດຍທຳມະຊາດ ແລະ ບອກໄວ້ໃຫ້ຄົນອ່ານຮູ້ ບໍ່ໃຫ້ເຂົ້າໃຈວ່າຜິດ.
 *
 * ຄ່າທັງໝົດເປັນ **ບາດ** (ຄືກັບ 2 ໜ້າເງິນອື່ນ).
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

const TONE: Record<RevCategory, string> = {
  install_ac: "bg-teal-500",
  install_app: "bg-teal-300",
  repair_ac: "bg-indigo-500",
  repair_app: "bg-indigo-300",
  other: "bg-slate-300",
};

const LAO_MONTH = [
  "ມັງກອນ", "ກຸມພາ", "ມີນາ", "ເມສາ", "ພຶດສະພາ", "ມິຖຸນາ",
  "ກໍລະກົດ", "ສິງຫາ", "ກັນຍາ", "ຕຸລາ", "ພະຈິກ", "ທັນວາ",
];

export default async function RevenueSummaryPage({ searchParams }: Props) {
  const params = await searchParams;
  const thisYear = new Date().getFullYear();
  const year = Number(params.year) >= 2020 && Number(params.year) <= thisYear + 1 ? Number(params.year) : thisYear;

  let matrix: Awaited<ReturnType<typeof monthlyRevenueMatrix>> = new Map();
  let error: string | null = null;
  try {
    matrix = await monthlyRevenueMatrix(year);
  } catch (exception) {
    error = exception instanceof Error ? exception.message : "ດຶງຂໍ້ມູນບໍ່ສຳເລັດ";
  }

  const months = Array.from({ length: 12 }, (_, index) => {
    const key = `${year}-${String(index + 1).padStart(2, "0")}`;
    const cell = matrix.get(key);
    return {
      key,
      label: LAO_MONTH[index],
      values: Object.fromEntries(REV_CATEGORIES.map((c) => [c, cell?.[c] ?? 0])) as Record<RevCategory, number>,
      total: cell?.total ?? 0,
    };
  });

  const yearTotal = Object.fromEntries(
    REV_CATEGORIES.map((c) => [c, months.reduce((sum, m) => sum + m.values[c], 0)]),
  ) as Record<RevCategory, number>;
  const grand = months.reduce((sum, m) => sum + m.total, 0);
  const peak = Math.max(1, ...months.map((m) => m.total));
  const money = (value: number) => Math.round(value).toLocaleString();
  const yearHref = (value: number) => `/revenue-summary?year=${value}`;

  return (
    <div className="w-full space-y-5 pb-10">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="flex items-center gap-2 text-xl font-bold text-slate-700">
          <PieChart className="size-5 text-teal-600" />
          ສະຫຼຸບລາຍຮັບປະຈຳເດືອນ
        </h1>
        <div className="flex items-center gap-1 rounded-xl border border-slate-300 bg-white px-1 py-1">
          <Link href={yearHref(year - 1)} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100">
            <ChevronLeft className="size-4" />
          </Link>
          <span className="min-w-16 text-center text-sm font-bold text-slate-700">{year}</span>
          <Link
            href={yearHref(year + 1)}
            aria-disabled={year >= thisYear}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 aria-disabled:pointer-events-none aria-disabled:opacity-30"
          >
            <ChevronRight className="size-4" />
          </Link>
        </div>
        <Link
          href={`/revenue-summary/print?year=${year}`}
          className="ml-auto inline-flex h-9 items-center rounded-xl bg-slate-800 px-4 text-xs font-semibold text-white hover:bg-slate-900"
        >
          ລາຍງານຜູ້ບໍລິຫານ
        </Link>
      </div>

      {error && <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">{error}</p>}

      {/* ── ຍອດປີ ແຍກ 4 ໝວດ + ອື່ນໆ ── */}
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {REV_CATEGORIES.map((category) => (
          <div key={category} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="flex items-center gap-1.5 text-[11px] text-slate-400">
              <span className={`size-2 rounded-full ${TONE[category]}`} />
              {LABEL[category]}
            </p>
            <p className="mt-1 text-xl font-bold tabular-nums text-slate-800">{money(yearTotal[category])}</p>
            <p className="text-[10px] text-slate-400">
              {grand > 0 ? Math.round((yearTotal[category] / grand) * 100) : 0}% ຂອງປີ
            </p>
          </div>
        ))}
      </div>

      {/* ── ຕາຕະລາງ 12 ເດືອນ × ໝວດ ── */}
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-slate-600">
                <th className="px-4 py-2.5 font-semibold">ເດືອນ</th>
                {REV_CATEGORIES.map((category) => (
                  <th key={category} className="px-4 py-2.5 text-right font-semibold">
                    {LABEL[category]}
                  </th>
                ))}
                <th className="px-4 py-2.5 text-right font-semibold">ລວມ (ບາດ)</th>
                <th className="w-40 px-4 py-2.5 font-semibold">ສັດສ່ວນ</th>
              </tr>
            </thead>
            <tbody>
              {months.map((row) => (
                <tr key={row.key} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="whitespace-nowrap px-4 py-2 font-semibold text-slate-700">{row.label}</td>
                  {REV_CATEGORIES.map((category) => (
                    <td
                      key={category}
                      className={`px-4 py-2 text-right tabular-nums ${
                        row.values[category] > 0 ? "text-slate-700" : "text-slate-300"
                      }`}
                    >
                      {row.values[category] > 0 ? money(row.values[category]) : "—"}
                    </td>
                  ))}
                  <td className="px-4 py-2 text-right font-bold tabular-nums text-slate-800">{money(row.total)}</td>
                  <td className="px-4 py-2">
                    {/* ແຖບແບ່ງສ່ວນ — ເຫັນອົງປະກອບຂອງເດືອນນັ້ນທັນທີ ໂດຍບໍ່ຕ້ອງອ່ານ 5 ຕົວເລກ */}
                    <span
                      className="flex h-2 w-full overflow-hidden rounded-full bg-slate-100"
                      style={{ opacity: row.total > 0 ? Math.max(0.35, row.total / peak) : 0.25 }}
                    >
                      {REV_CATEGORIES.map((category) => (
                        <span
                          key={category}
                          className={TONE[category]}
                          style={{ width: `${row.total > 0 ? (row.values[category] / row.total) * 100 : 0}%` }}
                        />
                      ))}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-200 bg-slate-50 font-bold text-slate-800">
                <td className="px-4 py-2.5">ລວມທັງປີ</td>
                {REV_CATEGORIES.map((category) => (
                  <td key={category} className="px-4 py-2.5 text-right tabular-nums">
                    {money(yearTotal[category])}
                  </td>
                ))}
                <td className="px-4 py-2.5 text-right tabular-nums">{money(grand)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      <p className="text-[11px] text-slate-400">
        ຄ່າເປັນ <b>ບາດ</b> · ໃຊ້ສູດດຽວກັບລາຍງານປະຈຳເດືອນຂອງຜູ້ຈັດການ (lib/monthly-report) ⇒ ຕົວເລກບໍ່ຂັດກັນ.
        ຝັ່ງຕິດຕັ້ງທີ່ນີ້ນັບຈາກ <b>ບິນຂາຍ ERP ຕາມວັນທີບິນ</b>; ໜ້າ “ລາຍຮັບງານຕິດຕັ້ງ” ນັບຈາກ
        <b> ໃບງານ ຕາມວັນປິດງານ</b> ⇒ 2 ໜ້ານັ້ນຈະບໍ່ເທົ່າກັນໂດຍທຳມະຊາດ.
      </p>
    </div>
  );
}
