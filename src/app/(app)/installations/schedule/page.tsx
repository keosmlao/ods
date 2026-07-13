import { Empty, PageTitle } from "@/components/ui";
import { getSession } from "@/lib/auth";
import { query } from "@/lib/db";
import { INSTALL_STAGE_LABEL_SQL, INSTALL_STAGE_SQL } from "@/lib/install-stage";
import { roleOf } from "@/lib/roles";
import { ownJobsOnly } from "@/lib/scope";
import { STAGE_LABEL_SQL, STAGE_SQL } from "@/lib/stage";
import { listTechnicians } from "@/lib/technicians";
import { CalendarDays, ChevronLeft, ChevronRight, ExternalLink, MapPin, Navigation, Phone, UserRound } from "lucide-react";
import Link from "next/link";

/**
 * ຄິວງານຊ່າງປະຈຳວັນ — ປະຕິທິນຢູ່ຊ້າຍ, ລາຍລະອຽດຂອງວັນທີ່ເລືອກຢູ່ຂວາ.
 * ຊ່າງເຫັນສະເພາະຄິວຂອງຕົນ; ຜູ້ຈັດງານເຫັນທຸກຄົນ.
 */
export const dynamic = "force-dynamic";

type Row = {
  workflow: "install" | "repair";
  code: string;
  tech: string | null;
  customer: string | null;
  tel: string | null;
  location: string | null;
  item: string | null;
  stage: number;
  stage_label: string;
  remark: string | null;
  lat: number | null;
  lng: number | null;
};

type DayCount = { day: string; jobs: number };
type Props = { searchParams: Promise<{ d?: string }> };

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const WEEKDAYS = ["ຈ", "ອ", "ພ", "ພຫ", "ສຸ", "ສ", "ອາ"];

function isoDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

function shift(iso: string, days: number) {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return isoDate(date);
}

function shiftMonth(iso: string, months: number) {
  const [year, month] = iso.split("-").map(Number);
  return isoDate(new Date(Date.UTC(year, month - 1 + months, 1)));
}

function calendarDays(monthStart: string) {
  const first = new Date(`${monthStart}T00:00:00Z`);
  const mondayOffset = (first.getUTCDay() + 6) % 7;
  const start = shift(monthStart, -mondayOffset);
  return Array.from({ length: 42 }, (_, index) => shift(start, index));
}

export default async function SchedulePage({ searchParams }: Props) {
  const params = await searchParams;
  const today = isoDate(new Date());
  const day = ISO.test(params.d ?? "") ? params.d! : today;
  const monthStart = `${day.slice(0, 7)}-01`;
  const monthEnd = shiftMonth(monthStart, 1);

  const session = await getSession();
  const tech = ownJobsOnly(session);
  const values = tech ? [day, tech] : [day];
  const monthValues = tech ? [monthStart, monthEnd, tech] : [monthStart, monthEnd];

  const [jobsResult, countResult, technicians] = await Promise.all([
    query<Row>(
      `select 'install' as workflow, a.code,
          nullif(a.tech_code,'') as tech,
          c.name_1 as customer, c.tel,
          coalesce(nullif(a.location_inst,''), c.address) as location,
          a.item_name as item,
          (${INSTALL_STAGE_SQL}) as stage,
          (${INSTALL_STAGE_LABEL_SQL}) as stage_label,
          nullif(a.remark,'') as remark,
          a.location_lat as lat, a.location_lng as lng
        from ods_tb_install a
        left join ar_customer c on c.code = a.cust_code
       where a.appoint_date = $1::date
         and a.cancel_date is null
         and a.job_finish is null
         ${tech ? "and a.tech_code = $2" : ""}

       union all

       select 'repair' as workflow, a.code,
          nullif(a.emp_code,'') as tech,
          c.name_1 as customer, c.tel,
          coalesce(nullif(a.location_repair,''), c.address) as location,
          a.name_1 as item,
          (${STAGE_SQL}) as stage,
          (${STAGE_LABEL_SQL}) as stage_label,
          nullif(a.remark,'') as remark,
          a.location_lat as lat, a.location_lng as lng
        from tb_product a
        left join ar_customer c on c.code = a.cust_code
       where a.appoint_date = $1::date
         and a.cancel_start is null
         and a.return_complete is null
         ${tech ? "and a.emp_code = $2" : ""}

       order by tech nulls last, code`,
      values,
    ),
    query<DayCount>(
      `select to_char(q.appoint_date,'YYYY-MM-DD') as day, count(*)::int as jobs
         from (
           select a.appoint_date
             from ods_tb_install a
            where a.appoint_date >= $1::date and a.appoint_date < $2::date
              and a.cancel_date is null and a.job_finish is null
              ${tech ? "and a.tech_code = $3" : ""}
           union all
           select a.appoint_date
             from tb_product a
            where a.appoint_date >= $1::date and a.appoint_date < $2::date
              and a.cancel_start is null and a.return_complete is null
              ${tech ? "and a.emp_code = $3" : ""}
         ) q
        group by q.appoint_date
        order by q.appoint_date`,
      monthValues,
    ),
    listTechnicians(),
  ]);

  const rows = jobsResult.rows;
  const counts = new Map(countResult.rows.map((row) => [row.day, Number(row.jobs)]));
  const monthTotal = countResult.rows.reduce((sum, row) => sum + Number(row.jobs), 0);
  const installTotal = rows.filter((row) => row.workflow === "install").length;
  const repairTotal = rows.length - installTotal;
  const cells = calendarDays(monthStart);
  const selectedLabel = new Intl.DateTimeFormat("lo-LA", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${day}T00:00:00Z`));
  const monthLabel = new Intl.DateTimeFormat("lo-LA", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${monthStart}T00:00:00Z`));

  const byTech = new Map<string, Row[]>();
  for (const row of rows) {
    const who = row.tech ?? "(ຍັງບໍ່ມີຊ່າງ)";
    byTech.set(who, [...(byTech.get(who) ?? []), row]);
  }
  const technicianNames = new Map<string, string>();
  for (const technician of technicians) {
    technicianNames.set(technician.code.toLowerCase(), technician.name);
    technicianNames.set(technician.employee_code.toLowerCase(), technician.name);
  }
  const technicianName = (code: string) =>
    code === "(ຍັງບໍ່ມີຊ່າງ)" ? code : technicianNames.get(code.toLowerCase()) ?? code;
  const canSeeAll = roleOf(session) !== "technical";

  return (
    <div className="space-y-5">
      <PageTitle sub="ເລືອກວັນຈາກປະຕິທິນ ເພື່ອເບິ່ງຄິວຕິດຕັ້ງ ແລະສ້ອມຂອງຊ່າງ">
        ຄິວງານຊ່າງປະຈຳວັນ
      </PageTitle>

      <div className="grid items-start gap-4 lg:grid-cols-[390px_minmax(0,1fr)]">
        {/* ຊ້າຍ: ປະຕິທິນ */}
        <aside className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm lg:sticky lg:top-20">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <Link
              href={`/installations/schedule?d=${shiftMonth(monthStart, -1)}`}
              title="ເດືອນກ່ອນ"
              className="grid size-8 place-items-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50"
            >
              <ChevronLeft className="size-4" />
            </Link>
            <div className="text-center">
              <h2 className="text-sm font-bold text-slate-800">{monthLabel}</h2>
              <p className="text-[10px] font-semibold text-slate-400">ລວມ {monthTotal} ງານ</p>
            </div>
            <Link
              href={`/installations/schedule?d=${shiftMonth(monthStart, 1)}`}
              title="ເດືອນຕໍ່ໄປ"
              className="grid size-8 place-items-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50"
            >
              <ChevronRight className="size-4" />
            </Link>
          </div>

          <div className="p-3">
            <div className="mb-1 grid grid-cols-7">
              {WEEKDAYS.map((label, index) => (
                <span key={`${label}-${index}`} className={`py-2 text-center text-[10px] font-bold ${index >= 5 ? "text-red-500" : "text-slate-400"}`}>
                  {label}
                </span>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {cells.map((date) => {
                const inMonth = date.startsWith(day.slice(0, 7));
                const selected = date === day;
                const isToday = date === today;
                const count = counts.get(date) ?? 0;
                return (
                  <Link
                    key={date}
                    href={`/installations/schedule?d=${date}`}
                    aria-current={selected ? "date" : undefined}
                    className={`relative flex h-12 flex-col items-center justify-center rounded-xl text-xs font-semibold transition ${
                      selected
                        ? "bg-teal-600 text-white shadow-sm"
                        : inMonth
                          ? "text-slate-700 hover:bg-teal-50 hover:text-teal-700"
                          : "text-slate-300 hover:bg-slate-50"
                    } ${isToday && !selected ? "ring-1 ring-inset ring-teal-400" : ""}`}
                  >
                    <span>{Number(date.slice(-2))}</span>
                    {count > 0 && (
                      <span className={`mt-0.5 min-w-4 rounded-full px-1 text-center text-[9px] font-bold ${selected ? "bg-white/20 text-white" : "bg-amber-100 text-amber-700"}`}>
                        {count}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50 px-4 py-3">
            <span className="text-[10px] text-slate-500">ຕົວເລກສີເຫຼືອງ = ຈຳນວນງານ</span>
            {day !== today && (
              <Link href="/installations/schedule" className="text-xs font-bold text-teal-700 hover:underline">
                ມື້ນີ້
              </Link>
            )}
          </div>
        </aside>

        {/* ຂວາ: ລາຍລະອຽດວັນທີ່ເລືອກ */}
        <section className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50/60 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-5 py-4">
            <div>
              <h2 className="flex items-center gap-2 text-base font-bold text-slate-800">
                <CalendarDays className="size-5 text-teal-600" />
                {selectedLabel}
              </h2>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] font-bold">
                <span className="text-slate-500">ລວມ {rows.length} ງານ · {byTech.size} ຊ່າງ</span>
                <span className="rounded-full bg-teal-100 px-2 py-0.5 text-teal-700">ຕິດຕັ້ງ {installTotal}</span>
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-700">ສ້ອມ {repairTotal}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Link href={`/installations/schedule?d=${shift(day, -1)}`} className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50">
                ມື້ກ່ອນ
              </Link>
              <Link href={`/installations/schedule?d=${shift(day, 1)}`} className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50">
                ມື້ຕໍ່ໄປ
              </Link>
            </div>
          </div>

          {rows.length > 0 && (
            <div className="border-b border-slate-200 bg-white px-4 py-4">
              <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-500">ສະຫຼຸບຈຳນວນງານຕາມຊ່າງ</h3>
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {[...byTech.entries()].map(([who, techJobs]) => {
                  const installs = techJobs.filter((job) => job.workflow === "install").length;
                  const repairs = techJobs.length - installs;
                  const displayName = technicianName(who);
                  return (
                    <div key={who} className={`rounded-xl border p-3 ${techJobs.length >= 4 ? "border-red-200 bg-red-50" : "border-slate-200 bg-slate-50"}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-slate-800">{displayName}</p>
                          {displayName !== who && <p className="truncate text-[10px] text-slate-400">ລະຫັດ: {who}</p>}
                        </div>
                        <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-black ${techJobs.length >= 4 ? "bg-red-600 text-white" : "bg-teal-600 text-white"}`}>
                          {techJobs.length} ງານ
                        </span>
                      </div>
                      <div className="mt-2 flex items-center gap-2 text-[10px] font-semibold">
                        <span className="rounded-full bg-teal-100 px-2 py-0.5 text-teal-700">ຕິດຕັ້ງ {installs}</span>
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-700">ສ້ອມ {repairs}</span>
                        {techJobs.length >= 4 && canSeeAll && <span className="ml-auto text-red-600">ວຽກຫຼາຍ</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {rows.length === 0 ? (
            <div className="bg-white p-8"><Empty>ບໍ່ມີງານນັດໃນວັນທີ່ເລືອກ</Empty></div>
          ) : (
            <div className="space-y-4 p-4">
              {[...byTech.entries()].map(([who, techJobs]) => (
                <section key={who}>
                  <div className="mb-2 flex items-center gap-2 px-1">
                    <UserRound className="size-4 text-teal-600" />
                    <h3 className="text-sm font-bold text-slate-700">{technicianName(who)}</h3>
                    {technicianName(who) !== who && <span className="text-[10px] text-slate-400">({who})</span>}
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${techJobs.length >= 4 ? "bg-red-100 text-red-700" : "bg-slate-200 text-slate-600"}`}>
                      {techJobs.length} ງານ
                    </span>
                    {techJobs.length >= 4 && canSeeAll && <span className="text-[10px] font-semibold text-red-600">ນັດຫຼາຍເກີນ?</span>}
                  </div>

                  <div className="space-y-2">
                    {techJobs.map((job) => (
                      <article
                        key={`${job.workflow}:${job.code}`}
                        className="grid gap-3 rounded-xl border border-slate-200 bg-white p-3 transition hover:border-slate-300 hover:shadow-sm md:grid-cols-[minmax(0,1fr)_auto] md:items-center"
                      >
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <Link href={job.workflow === "install" ? `/installations/${job.code}` : `/service/${job.code}`} className="font-bold text-teal-700 hover:underline">
                              {job.code}
                            </Link>
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${job.workflow === "install" ? "bg-teal-50 text-teal-700" : "bg-amber-50 text-amber-700"}`}>
                              {job.workflow === "install" ? "ຕິດຕັ້ງ" : "ສ້ອມ"}
                            </span>
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">{job.stage_label}</span>
                          </div>
                          <div className="mt-1.5 grid min-w-0 gap-x-5 gap-y-1 lg:grid-cols-[minmax(220px,1fr)_minmax(180px,0.8fr)]">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-bold text-slate-800" title={job.item ?? undefined}>{job.item ?? "-"}</p>
                              <p className="truncate text-xs text-slate-500" title={job.customer ?? undefined}>{job.customer ?? "-"}</p>
                            </div>
                            <div className="min-w-0">
                              {job.location && <p className="truncate text-xs text-slate-600" title={job.location}><MapPin className="mr-1 inline size-3.5 text-slate-400" />{job.location}</p>}
                              {job.remark && <p className="truncate text-[11px] text-slate-400" title={job.remark}>{job.remark}</p>}
                            </div>
                          </div>
                        </div>

                        <div className="flex shrink-0 flex-wrap gap-2 border-t border-slate-100 pt-2 md:border-l md:border-t-0 md:pl-3 md:pt-0">
                          <Link href={job.workflow === "install" ? `/installations/${job.code}` : `/service/${job.code}`} className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1.5 text-[11px] font-bold text-slate-700 hover:bg-slate-200">
                            <ExternalLink className="size-3.5" /> ເບິ່ງວຽກ
                          </Link>
                          {job.tel && <a href={`tel:${job.tel}`} className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1.5 text-[11px] font-bold text-emerald-700"><Phone className="size-3.5" /> {job.tel}</a>}
                          {job.lat != null && job.lng != null && (
                            <a href={`https://www.google.com/maps/dir/?api=1&destination=${job.lat},${job.lng}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-lg bg-blue-50 px-2.5 py-1.5 text-[11px] font-bold text-blue-700">
                              <Navigation className="size-3.5" /> ນຳທາງ
                            </a>
                          )}
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
