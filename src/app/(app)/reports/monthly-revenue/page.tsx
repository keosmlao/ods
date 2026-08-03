import { Button, Card, PageTitle } from "@/components/ui";
import { getSession } from "@/lib/auth";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getLocale } from "@/lib/i18n/locale";
import { monthlyRevenueMatrix, type MonthRevenue, type RevCategory } from "@/lib/monthly-report";
import { roleOf } from "@/lib/roles";
import Link from "next/link";

/**
 * **ລາຍງານປະຈຳເດືອນ — ສູນບໍລິການ** ແບບ dashboard:
 * ແຖວ stat tiles → bar chart ລາຍເດືອນ (ປີນີ້/ປີກາຍ + ຂີດເປົ້າ) → bar chart ແຍກໝວດ
 * → ຕາຕະລາງລະອຽດ (table view ຂອງ chart — ຕາມກົດ accessibility).
 *
 * ສີ series ຜ່ານ validator ຂອງ dataviz skill (ຟ້າ #2a78d6 / ສົ້ມ #eb6834, ພື້ນຂາວ):
 * lightness · chroma · CVD ΔE 24.7 · normal ΔE 33.6 · contrast ≥3:1 — ຫ້າມປ່ຽນຕາມໃຈ.
 * ຕົວໜັງສື/ຕົວເລກໃຊ້ສີ text (slate) ສະເໝີ — ສີ series ຢູ່ແຕ່ແທ່ງ/chip.
 */
export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ month?: string }> };

const SERIES_NOW = "#2a78d6";  // ປີນີ້
const SERIES_LAST = "#eb6834"; // ປີກາຍ

const fmt = (value: number) => Math.round(value).toLocaleString("en-US");
const pct = (actual: number, base: number) =>
  base > 0 ? `${Math.round((actual / base) * 100)}%` : "—";

function shiftMonth(month: string, delta: number) {
  const [year, value] = month.split("-").map(Number);
  return new Date(Date.UTC(year, value - 1 + delta, 1)).toISOString().slice(0, 7);
}

/** ເພດານແກນ Y ມົນງາມ (1/2/5 × 10^k) — ໃຫ້ gridline ເປັນເລກຖ້ວນ */
function niceMax(value: number) {
  if (value <= 0) return 1;
  const power = 10 ** Math.floor(Math.log10(value));
  for (const step of [1, 2, 5, 10]) if (value <= step * power) return step * power;
  return 10 * power;
}

function ytdOf(matrix: Map<string, MonthRevenue>, year: number, throughMonth: number) {
  const sum = { install_ac: 0, install_app: 0, repair_ac: 0, repair_app: 0, other: 0, total: 0, target: 0 };
  for (let m = 1; m <= throughMonth; m++) {
    const row = matrix.get(`${year}-${String(m).padStart(2, "0")}`);
    if (!row) continue;
    sum.install_ac += row.install_ac;
    sum.install_app += row.install_app;
    sum.repair_ac += row.repair_ac;
    sum.repair_app += row.repair_app;
    sum.other += row.other;
    sum.total += row.total;
    sum.target += row.target;
  }
  return sum;
}

/** ປ້າຍ % ພ້ອມສີທິດທາງ (ຂຶ້ນ=ດີ) — ໃຊ້ຄູ່ emerald/rose ຄື UI ສ່ວນອື່ນຂອງລະບົບ */
function Delta({ actual, base, label }: { actual: number; base: number; label: string }) {
  if (base <= 0) return <span className="text-xs text-slate-400">{label}: —</span>;
  const ratio = actual / base;
  const up = ratio >= 1;
  return (
    <span className={`text-xs font-semibold ${up ? "text-emerald-600" : "text-rose-600"}`}>
      {up ? "▲" : "▼"} {Math.round(ratio * 100)}% <span className="font-normal text-slate-400">{label}</span>
    </span>
  );
}

export default async function MonthlyRevenueReport({ searchParams }: Props) {
  const t = (await getDictionary(await getLocale())).monthlyRevenue;
  const session = await getSession();
  const canEdit = ["manager", "admin"].includes(roleOf(session));

  const params = await searchParams;
  const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(params.month ?? "")
    ? (params.month as string)
    : new Date().toISOString().slice(0, 7);
  const [year, monthNo] = month.split("-").map(Number);

  const matrix = await monthlyRevenueMatrix(year);
  const zero: MonthRevenue = {
    month, install_ac: 0, install_app: 0, repair_ac: 0, repair_app: 0, other: 0, total: 0, target: 0,
  };
  const cur = matrix.get(month) ?? zero;
  const prev = matrix.get(`${year - 1}-${String(monthNo).padStart(2, "0")}`) ?? zero;
  const ytd = ytdOf(matrix, year, monthNo);
  const ytdPrev = ytdOf(matrix, year - 1, monthNo);

  /* ── ຂໍ້ມູນ chart ລາຍເດືອນ ── */
  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  const trend = months.map((m) => {
    const key = `${year}-${String(m).padStart(2, "0")}`;
    return {
      m,
      key,
      now: matrix.get(key)?.total ?? 0,
      last: matrix.get(`${year - 1}-${String(m).padStart(2, "0")}`)?.total ?? 0,
      target: matrix.get(key)?.target ?? 0,
    };
  });
  const yMax = niceMax(Math.max(...trend.flatMap((r) => [r.now, r.last, r.target]), 1));
  const h = (value: number) => `${Math.max(value > 0 ? 1 : 0, (value / yMax) * 100)}%`;

  /* ── ຂໍ້ມູນ chart ແຍກໝວດ (ເດືອນທີ່ເລືອກ) ── */
  const categories: { key: RevCategory; label: string }[] = [
    { key: "install_ac", label: t.installAc },
    { key: "install_app", label: t.installApp },
    { key: "repair_ac", label: t.repairAc },
    { key: "repair_app", label: t.repairApp },
    { key: "other", label: t.other },
  ];
  const catMax = Math.max(...categories.map((c) => Math.max(cur[c.key], prev[c.key])), 1);

  const breakdownRows = [
    categories[0],
    categories[1],
    { sum: true as const, label: t.installSum, keys: ["install_ac", "install_app"] as RevCategory[], tone: "bg-orange-50" },
    categories[2],
    categories[3],
    { sum: true as const, label: t.repairSum, keys: ["repair_ac", "repair_app"] as RevCategory[], tone: "bg-sky-50" },
    categories[4],
    { sum: true as const, label: t.total, keys: ["install_ac", "install_app", "repair_ac", "repair_app", "other"] as RevCategory[], tone: "bg-fuchsia-50 font-bold" },
  ];
  const pick = (row: typeof breakdownRows[number], source: Record<RevCategory, number>) =>
    "sum" in row ? row.keys.reduce((total, key) => total + source[key], 0) : source[row.key];

  const cellRight = "px-3 py-1.5 text-right tabular-nums";
  const gridLevels = [0.25, 0.5, 0.75, 1];

  return (
    <div className="w-full space-y-5">
      <PageTitle sub={t.sub}>{t.title}</PageTitle>

      {/* ── ເລືອກເດືອນ ── */}
      <div className="flex flex-wrap items-center gap-2">
        <Link
          href={`/reports/monthly-revenue?month=${shiftMonth(month, -1)}`}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
        >
          ← {t.prevMonth}
        </Link>
        <form className="flex items-center gap-2">
          <input
            type="month"
            name="month"
            defaultValue={month}
            className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-xs outline-none focus:border-teal-500"
          />
          <Button type="submit" size="sm">{t.show}</Button>
        </form>
        <Link
          href={`/reports/monthly-revenue?month=${shiftMonth(month, 1)}`}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
        >
          {t.nextMonth} →
        </Link>
      </div>

      {/* ── ແຖວ stat tiles ── */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="text-xs text-slate-500">{t.monthTotal} · {monthNo}/{year}</div>
          <div className="mt-1 text-3xl font-semibold text-slate-800">{fmt(cur.total)}</div>
          <div className="mt-1 flex flex-col gap-0.5">
            <Delta actual={cur.total} base={cur.target} label={t.vsTarget} />
            <Delta actual={cur.total} base={prev.total} label={t.colYoY} />
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="text-xs text-slate-500">{t.ytdTotal} · 1-{monthNo}/{year}</div>
          <div className="mt-1 text-3xl font-semibold text-slate-800">{fmt(ytd.total)}</div>
          <div className="mt-1 flex flex-col gap-0.5">
            <Delta actual={ytd.total} base={ytd.target} label={t.vsTarget} />
            <Delta actual={ytd.total} base={ytdPrev.total} label={t.colYoY} />
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="text-xs text-slate-500">{t.colLastYear} · {monthNo}/{year - 1}</div>
          <div className="mt-1 text-3xl font-semibold text-slate-800">{fmt(prev.total)}</div>
          <div className="mt-1 text-xs text-slate-400">{t.rowYtd} {year - 1}: {fmt(ytdPrev.total)}</div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>{t.colTarget} · {monthNo}/{year}</span>
            {canEdit && (
              <Link href={`/manage/revenue-targets?year=${year}`} className="font-semibold text-teal-700 hover:underline">
                {t.setTargets}
              </Link>
            )}
          </div>
          <div className="mt-1 text-3xl font-semibold text-slate-800">
            {cur.target > 0 ? fmt(cur.target) : <span className="text-lg text-slate-400">{t.noTarget}</span>}
          </div>
          {cur.target > 0 && (
            <div className="mt-1 text-xs text-slate-400">{t.rowYtd}: {ytd.target ? fmt(ytd.target) : "—"}</div>
          )}
        </div>
      </div>

      {/* ── Chart: ລາຍເດືອນທັງປີ ── */}
      <Card title={`${t.trendTitle} ${year}`}>
        {/* legend — ≥2 series ຕ້ອງມີສະເໝີ */}
        <div className="mb-3 flex flex-wrap items-center gap-4 text-xs text-slate-600">
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block size-2.5 rounded-sm" style={{ background: SERIES_NOW }} /> {t.thisYear} ({year})
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block size-2.5 rounded-sm" style={{ background: SERIES_LAST }} /> {t.lastYear} ({year - 1})
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-0.5 w-3.5 bg-slate-800" /> {t.colTarget}
          </span>
          <span className="ml-auto text-slate-400">{t.unitBaht}</span>
        </div>

        <div className="flex">
          {/* ປ້າຍແກນ Y */}
          <div className="relative mr-2 h-48 w-12 text-right text-[10px] tabular-nums text-slate-400">
            {gridLevels.map((level) => (
              <span key={level} className="absolute right-0 -translate-y-1/2" style={{ bottom: `${level * 100}%`, transform: "translateY(50%)" }}>
                {fmt(yMax * level)}
              </span>
            ))}
            <span className="absolute bottom-0 right-0">0</span>
          </div>

          {/* ພື້ນ chart */}
          <div className="relative h-48 flex-1">
            {/* gridlines — hairline ສີຈາງ */}
            {gridLevels.map((level) => (
              <div key={level} className="absolute inset-x-0 border-t border-slate-100" style={{ bottom: `${level * 100}%` }} />
            ))}
            <div className="absolute inset-x-0 bottom-0 border-t border-slate-300" />

            <div className="absolute inset-0 flex items-end">
              {trend.map((row) => (
                <div key={row.key} className="group relative flex h-full flex-1 items-end justify-center">
                  {/* tooltip ຕອນ hover */}
                  <div className="pointer-events-none absolute top-0 left-1/2 z-10 hidden w-max -translate-x-1/2 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] shadow-lg group-hover:block">
                    <div className="font-semibold text-slate-700">{row.m}/{year}</div>
                    <div className="flex items-center gap-1.5 text-slate-600">
                      <span className="inline-block size-2 rounded-sm" style={{ background: SERIES_NOW }} />
                      {t.thisYear}: <b className="tabular-nums">{fmt(row.now)}</b>
                    </div>
                    <div className="flex items-center gap-1.5 text-slate-600">
                      <span className="inline-block size-2 rounded-sm" style={{ background: SERIES_LAST }} />
                      {t.lastYear}: <b className="tabular-nums">{fmt(row.last)}</b>
                    </div>
                    {row.target > 0 && (
                      <div className="text-slate-600">{t.colTarget}: <b className="tabular-nums">{fmt(row.target)}</b> · {pct(row.now, row.target)}</div>
                    )}
                  </div>

                  {/* ຄູ່ແທ່ງ — ຊ່ອງ 2px ດ້ວຍ gap, ມົນ 4px ສະເພາະປາຍເທິງ */}
                  <div className="flex h-full w-full max-w-14 items-end justify-center gap-0.5 px-1">
                    <div
                      className="w-full max-w-6 rounded-t bg-[var(--bar)] transition-opacity group-hover:opacity-80"
                      style={{ height: h(row.now), ["--bar" as string]: SERIES_NOW }}
                    />
                    <div
                      className="w-full max-w-6 rounded-t bg-[var(--bar)] transition-opacity group-hover:opacity-80"
                      style={{ height: h(row.last), ["--bar" as string]: SERIES_LAST }}
                    />
                  </div>

                  {/* ຂີດເປົ້າ */}
                  {row.target > 0 && (
                    <div className="pointer-events-none absolute inset-x-1.5 h-0.5 bg-slate-800" style={{ bottom: h(row.target) }} />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ປ້າຍເດືອນ — ກົດເພື່ອເລືອກ */}
        <div className="mt-1 flex pl-14 text-center text-[11px]">
          {trend.map((row) => (
            <Link
              key={row.key}
              href={`/reports/monthly-revenue?month=${row.key}`}
              className={`flex-1 rounded py-0.5 hover:bg-slate-100 ${row.m === monthNo ? "font-bold text-teal-700" : "text-slate-500"}`}
            >
              {row.m}
            </Link>
          ))}
        </div>
      </Card>

      {/* ── Chart: ແຍກໝວດ ເດືອນທີ່ເລືອກ ── */}
      <Card title={`${t.breakdownTitle} — ${monthNo}/${year}`}>
        <div className="mb-3 flex flex-wrap items-center gap-4 text-xs text-slate-600">
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block size-2.5 rounded-sm" style={{ background: SERIES_NOW }} /> {monthNo}/{year}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block size-2.5 rounded-sm" style={{ background: SERIES_LAST }} /> {monthNo}/{year - 1}
          </span>
          <span className="ml-auto text-slate-400">{t.unitBaht}</span>
        </div>
        <div className="space-y-3">
          {categories.map((cat) => (
            <div key={cat.key} className="group grid grid-cols-[9rem_1fr] items-center gap-3 sm:grid-cols-[13rem_1fr]">
              <div className="truncate text-right text-xs text-slate-600">{cat.label}</div>
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <div className="h-4 rounded-r bg-[var(--bar)] transition-opacity group-hover:opacity-80"
                    style={{ width: `${Math.max(cur[cat.key] > 0 ? 1 : 0, (cur[cat.key] / catMax) * 100)}%`, ["--bar" as string]: SERIES_NOW }} />
                  <span className="text-xs font-semibold tabular-nums text-slate-700">{fmt(cur[cat.key])}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-2 rounded-r bg-[var(--bar)] opacity-90"
                    style={{ width: `${Math.max(prev[cat.key] > 0 ? 0.5 : 0, (prev[cat.key] / catMax) * 100)}%`, ["--bar" as string]: SERIES_LAST }} />
                  <span className="text-[10px] tabular-nums text-slate-400">{fmt(prev[cat.key])}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* ── ຕາຕະລາງລະອຽດ (table view ຂອງ chart) ── */}
      <Card title={`${t.breakdownTitle} · ${t.rowYtd}`}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-amber-50 text-slate-600">
                <th className="px-3 py-2 text-left"></th>
                <th className="px-3 py-2 text-right">{monthNo}/{year}</th>
                <th className="px-3 py-2 text-right">{monthNo}/{year - 1}</th>
                <th className="px-3 py-2 text-right">{t.colYoY}</th>
                <th className="px-3 py-2 text-right">{t.rowYtd} {year}</th>
                <th className="px-3 py-2 text-right">{t.rowYtd} {year - 1}</th>
              </tr>
            </thead>
            <tbody>
              {breakdownRows.map((row) => {
                const c = pick(row, cur);
                const p = pick(row, prev);
                return (
                  <tr key={row.label} className={`border-b border-slate-100 ${"sum" in row ? row.tone : ""}`}>
                    <td className={`px-3 py-1.5 ${"sum" in row ? "font-semibold" : "pl-6"} text-slate-700`}>{row.label}</td>
                    <td className={`${cellRight} font-semibold`}>{fmt(c)}</td>
                    <td className={`${cellRight} text-slate-500`}>{fmt(p)}</td>
                    <td className={cellRight}>{pct(c, p)}</td>
                    <td className={cellRight}>{fmt(pick(row, ytd))}</td>
                    <td className={`${cellRight} text-slate-500`}>{fmt(pick(row, ytdPrev))}</td>
                  </tr>
                );
              })}
              <tr className="border-b border-slate-100">
                <td className="px-3 py-1.5 font-semibold text-slate-700">{t.colTarget}</td>
                <td className={`${cellRight} text-slate-500`}>{cur.target ? fmt(cur.target) : "—"}</td>
                <td className={`${cellRight} text-slate-400`}>{prev.target ? fmt(prev.target) : "—"}</td>
                <td className={cellRight}>—</td>
                <td className={`${cellRight} text-slate-500`}>{ytd.target ? fmt(ytd.target) : "—"}</td>
                <td className={`${cellRight} text-slate-400`}>{ytdPrev.target ? fmt(ytdPrev.target) : "—"}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>

      <Card title={t.noteTitle}>
        <ul className="list-disc space-y-1 pl-5 text-xs text-slate-500">
          <li>{t.note1}</li>
          <li>{t.note2}</li>
          <li>{t.note3}</li>
        </ul>
      </Card>
    </div>
  );
}
