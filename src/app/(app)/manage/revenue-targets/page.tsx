import { saveRevenueTargets } from "@/app/actions/revenue-target";
import { Button, Card, PageTitle } from "@/components/ui";
import { getSession } from "@/lib/auth";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getLocale } from "@/lib/i18n/locale";
import { monthlyRevenueMatrix } from "@/lib/monthly-report";
import { roleOf } from "@/lib/roles";
import Link from "next/link";

/**
 * **ຕັ້ງເປົ້າລາຍຮັບລາຍເດືອນ** — ຟອມດຽວ 12 ຊ່ອງ ບັນທຶກທັງປີເທື່ອດຽວ.
 * ຖັນ "ຕົວຈິງ / ປີກາຍ" ສະແດງໄວ້ອ້າງອີງຕອນຕັ້ງເປົ້າ (ຮູ້ວ່າປີກາຍເຮັດໄດ້ເທົ່າໃດ).
 * ສິດເບິ່ງ = ກົດຂອງ /reports/monthly-revenue (manager/admin) · ສິດແກ້ = ຟອມສະແດງ
 * ສະເພາະ manager/admin ແລະ action ກວດຊ້ຳຝັ່ງ server ອີກຊັ້ນ.
 */
export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ year?: string }> };

const fmt = (value: number) => Math.round(value).toLocaleString("en-US");
const pct = (actual: number, base: number) =>
  base > 0 ? `${Math.round((actual / base) * 100)}%` : "—";

export default async function RevenueTargetsPage({ searchParams }: Props) {
  const t = (await getDictionary(await getLocale())).monthlyRevenue;
  const session = await getSession();
  const canEdit = ["manager", "admin"].includes(roleOf(session));

  const params = await searchParams;
  const nowYear = new Date().getUTCFullYear();
  const year = /^\d{4}$/.test(params.year ?? "") ? Number(params.year) : nowYear;

  const matrix = await monthlyRevenueMatrix(year);
  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  const rows = months.map((m) => {
    const key = `${year}-${String(m).padStart(2, "0")}`;
    const row = matrix.get(key);
    const last = matrix.get(`${year - 1}-${String(m).padStart(2, "0")}`);
    return { m, actual: row?.total ?? 0, target: row?.target ?? 0, lastYear: last?.total ?? 0 };
  });
  const total = rows.reduce(
    (sum, row) => ({ actual: sum.actual + row.actual, target: sum.target + row.target, lastYear: sum.lastYear + row.lastYear }),
    { actual: 0, target: 0, lastYear: 0 },
  );

  const cellRight = "px-3 py-1.5 text-right tabular-nums";

  return (
    <div className="w-full max-w-3xl space-y-5">
      <PageTitle sub={t.targetsSub}>{t.targetsTitle}</PageTitle>

      <div className="flex flex-wrap items-center gap-2">
        <Link
          href={`/manage/revenue-targets?year=${year - 1}`}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
        >
          ← {year - 1}
        </Link>
        <span className="rounded-lg bg-brand-800 px-4 py-2 text-sm font-bold text-white">{year}</span>
        <Link
          href={`/manage/revenue-targets?year=${year + 1}`}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
        >
          {year + 1} →
        </Link>
        <Link
          href={`/reports/monthly-revenue?month=${year}-${String(Math.min(new Date().getUTCMonth() + 1, 12)).padStart(2, "0")}`}
          className="ml-auto text-xs font-semibold text-brand-800 hover:underline"
        >
          {t.backToReport}
        </Link>
      </div>

      <Card>
        <form action={saveRevenueTargets}>
          <input type="hidden" name="year" value={year} />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-brand-orange-100 text-slate-600">
                  <th className="px-3 py-2 text-left">{t.colMonth}</th>
                  <th className="px-3 py-2 text-right">{t.colTarget} ({t.unitBaht})</th>
                  <th className="px-3 py-2 text-right">{t.colActual}</th>
                  <th className="px-3 py-2 text-right">%</th>
                  <th className="px-3 py-2 text-right">{t.colLastYear}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.m} className="border-b border-slate-100">
                    <td className="px-3 py-1.5 font-semibold text-slate-700">{row.m}/{year}</td>
                    <td className="px-2 py-1 text-right">
                      {canEdit ? (
                        <input
                          name={`amount_${row.m}`}
                          inputMode="numeric"
                          defaultValue={row.target ? String(Math.round(row.target)) : ""}
                          placeholder="—"
                          className="h-8 w-32 rounded-lg border border-slate-300 px-2 text-right text-xs tabular-nums outline-none focus:border-brand-600"
                        />
                      ) : (
                        <span className="tabular-nums">{row.target ? fmt(row.target) : "—"}</span>
                      )}
                    </td>
                    <td className={`${cellRight} font-semibold`}>{fmt(row.actual)}</td>
                    <td className={`${cellRight} ${row.target && row.actual < row.target ? "text-brand-orange-700" : "text-brand-800"}`}>
                      {pct(row.actual, row.target)}
                    </td>
                    <td className={`${cellRight} text-slate-500`}>{fmt(row.lastYear)}</td>
                  </tr>
                ))}
                <tr className="bg-brand-orange-50 font-bold">
                  <td className="px-3 py-2 text-slate-700">{t.yearTotal}</td>
                  <td className={cellRight}>{total.target ? fmt(total.target) : "—"}</td>
                  <td className={cellRight}>{fmt(total.actual)}</td>
                  <td className={cellRight}>{pct(total.actual, total.target)}</td>
                  <td className={`${cellRight} text-slate-500`}>{fmt(total.lastYear)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {canEdit && (
            <div className="mt-3 flex items-center justify-between gap-3 border-t border-slate-100 pt-3">
              <span className="text-[11px] text-slate-400">{t.hintBlank}</span>
              <Button type="submit" size="sm">{t.saveAll}</Button>
            </div>
          )}
        </form>
      </Card>
    </div>
  );
}
