import { countBy, defaultFromIso, ReportShell, reportState } from "@/components/report-shell";
import { SelectField } from "@/components/select-field";
import {
  checkingFlags,
  columns,
  fetchChecking,
  one,
  safeDate,
  safeFlag,
  toTableColumns,
  todayIso,
  type Row,
  type SearchParams,
} from "@/lib/report-sql";

/* ods: /checking_report + /checking_reportprint (122) + /checking_reportprint1 (56) — check_report.py */
export default async function CheckingReport({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const from = safeDate(one(params.from), defaultFromIso());
  const to = safeDate(one(params.to), todayIso());
  const flag = safeFlag(one(params.flag));
  const state = reportState(params);

  let rows: Row[] = [];
  let error: string | null = null;
  try {
    rows = await fetchChecking(from, to, flag);
  } catch (exception) {
    error = exception instanceof Error ? exception.message : "ດຶງຂໍ້ມູນບໍ່ສຳເລັດ";
  }

  return (
    <ReportShell
      title="ລາຍງານການກວດເຊັກປະຈຳວັນ"
      subtitle={`${checkingFlags[flag]} — ແຕ່ວັນທີ ${from} ຫາ ${to}`}
      basePath="/reports/checking"
      query={{ from, to, flag }}
      omitFromForm={["flag"]}
      state={state}
      dateRange={{ from, to }}
      filters={
        <label className="block w-48">
          <span className="mb-1 block text-[11px] text-slate-500">ປະເພດເອກະສານ</span>
          <SelectField
            name="flag"
            defaultValue={flag}
            options={Object.entries(checkingFlags).map(([value, label]) => ({ value, label }))}
          />
        </label>
      }
      columns={toTableColumns(columns.checking)}
      rows={rows}
      error={error}
      /* ສະຫຼຸບ: ໃຊ້ອາໄຫຼ່ / ບໍໃຊ້ອາໄຫຼ່ ແລະ ການຮັບປະກັນ — ນັບຈາກແຖວຊຸດດຽວກັນກັບຕາຕະລາງ */
      summary={[...countBy(rows, "used_spare"), ...countBy(rows, "warrunty")]}
      exportHref={`/api/reports/export/checking?${new URLSearchParams({ from, to, flag, ...(state.q && { q: state.q }) })}`}
      printHref={`/reports/checking/print?from=${from}&to=${to}&flag=${flag}`}
      minWidth={1700}
      searchPlaceholder="ຄົ້ນຫາ ເລກບີນ, ໃບຮັບເຄື່ອງ, ລູກຄ້າ, ຊ່າງ..."
    />
  );
}
