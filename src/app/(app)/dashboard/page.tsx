import { Elapsed } from "@/components/elapsed";
import { LinkPending } from "@/components/link-pending";
import { installStatuses, repairStatuses } from "@/lib/dashboard-status";
import { query } from "@/lib/db";
import { elapsedTone } from "@/lib/elapsed-tone";
import { OPEN_JOBS, STAGE_SQL } from "@/lib/stage";
import { AlertCircle, ClipboardList, Clock3, Radar, Wrench } from "lucide-react";
import Link from "next/link";

/**
 * ໜ້າລວມ — ວຽກທີ່ຕ້ອງດຳເນີນການ.
 *
 * ຕົວເລກໃນແຕ່ລະຊ່ອງ ນັບດ້ວຍ "ເງື່ອນໄຂອັນດຽວກັນ" ກັບໜ້າລາຍລະອຽດ (lib/dashboard-status.ts)
 * ຈຶ່ງບໍ່ມີທາງທີ່ຕົວເລກຢູ່ໜ້ານີ້ ກັບ ຈຳນວນແຖວຢູ່ໜ້າລາຍລະອຽດ ຈະບໍ່ຕົງກັນ.
 * ຂັ້ນຂອງວຽກສ້ອມ ມາຈາກ STAGE_SQL (ບໍ່ຜ່ານ view tracking_tb_product ອີກຕໍ່ໄປ).
 */

type Counts = Record<string, number>;
type RecentRepair = { code: string; customer: string | null; product: string | null; sn: string | null; registered: string | null; elapsed_seconds: number | null; status: string };
type RecentInstall = { code: string; customer: string | null; product: string | null; technician: string | null; registered: string | null; elapsed_seconds: number | null; status: string };
type DashboardData = { repair: Counts; install: Counts; recentRepairs: RecentRepair[]; recentInstalls: RecentInstall[] };

/** ນັບທຸກຂັ້ນຂອງ workflow ດຽວ ດ້ວຍ query ດຽວ — ບໍ່ດຶງແຖວ */
function countsSql(statuses: Record<string, { condition: string }>, from: string, extra = "true") {
  const filters = Object.entries(statuses)
    .map(([slug, { condition }], index) => `count(*) filter (where ${condition})::int c${index} /* ${slug} */`)
    .join(", ");
  return `select ${filters}, count(*)::int total from ${from} where ${extra}`;
}

function readCounts(statuses: Record<string, unknown>, row: Record<string, number> | undefined): Counts {
  const out: Counts = { total: row?.total ?? 0 };
  Object.keys(statuses).forEach((slug, index) => { out[slug] = row?.[`c${index}`] ?? 0; });
  return out;
}

async function getDashboard(): Promise<{ data: DashboardData | null; error: boolean }> {
  try {
    const [repair, install, recentRepairs, recentInstalls] = await Promise.all([
      query<Record<string, number>>(countsSql(repairStatuses, "tb_product a", OPEN_JOBS)),
      query<Record<string, number>>(countsSql(installStatuses, "ods_tb_install a", "a.cancel_date is null and a.job_finish is null")),
      query<RecentRepair>(`select a.code, b.name_1 customer, concat_ws(' ',a.name_1,a.p_brand,a.p_model) product, a.sn,
        to_char(a.time_register,'DD-MM-YYYY HH24:MI') registered,
        greatest(0, round(extract(epoch from (localtimestamp - a.time_register))))::int elapsed_seconds,
        case (${STAGE_SQL})
          when 1 then 'ລໍຖ້າກວດເຊັກ' when 2 then 'ກຳລັງກວດເຊັກ' when 3 then 'ລໍຖ້າສະເໜີລາຄາ' when 4 then 'ກຳລັງສະເໜີລາຄາ'
          when 5 then 'ລໍຖ້າເບີກອາໄຫຼ່' when 6 then 'ກຳລັງເບີກອາໄຫຼ່' when 7 then 'ກຳລັງສັ່ງຊື້ອາໄຫຼ່' when 8 then 'ລໍຖ້າສ້ອມແປງ'
          when 9 then 'ກຳລັງສ້ອມແປງ' when 10 then 'ລໍຖ້າສົ່ງຄືນ' when 11 then 'ສຳເລັດ' when -1 then 'ຍົກເລີກ' else '-' end status
        from tb_product a left join ar_customer b on b.code=a.cust_code
        where ${OPEN_JOBS} order by a.time_register desc nulls last limit 8`),
      query<RecentInstall>(`select a.code, c.name_1 customer, concat_ws(' ',a.item_name,a.pro_brand,a.pro_model) product, a.tech_code technician,
        to_char(a.time_register,'DD-MM-YYYY HH24:MI') registered,
        greatest(0, round(extract(epoch from (localtimestamp - a.time_register))))::int elapsed_seconds,
        case when a.tech_code is null then 'ລໍຖ້າຈັດຊ່າງ' when a.tech_confirm is null then 'ລໍຖ້າຊ່າງຮັບງານ'
          when a.reg_start is null and a.used_spare=1 then 'ລໍຖ້າຂໍເບີກ' when a.reg_finish is null and a.used_spare=1 then 'ລໍຖ້າສາງເບີກ'
          when a.reg_finish is not null and a.pick_finish is null and a.used_spare=1 then 'ລໍຖ້າຮັບອາໄຫຼ່'
          when a.start_install is null then 'ລໍຖ້າຕິດຕັ້ງ' when a.finish_install is null then 'ກຳລັງຕິດຕັ້ງ'
          when a.complain_finish is null then 'ລໍຖ້າ feedback' when a.job_finish is null then 'ລໍຖ້າປິດງານ' else 'ສຳເລັດ' end status
        from ods_tb_install a left join ar_customer c on c.code=a.cust_code
        where a.cancel_date is null and a.job_finish is null order by a.time_register desc nulls last limit 8`),
    ]);

    return {
      data: {
        repair: readCounts(repairStatuses, repair.rows[0]),
        install: readCounts(installStatuses, install.rows[0]),
        recentRepairs: recentRepairs.rows,
        recentInstalls: recentInstalls.rows,
      },
      error: false,
    };
  } catch (error) {
    console.error("Dashboard query failed", error);
    return { data: null, error: true };
  }
}

/** ຊ່ອງຂັ້ນຕອນ — ກົດແລ້ວໄປໜ້າລາຍລະອຽດຂອງຂັ້ນນັ້ນ */
function StatusGrid({ workflow, statuses, counts }: { workflow: "repair" | "install"; statuses: Record<string, { label: string }>; counts: Counts }) {
  return (
    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
      {Object.entries(statuses).map(([slug, { label }]) => {
        const value = counts[slug] ?? 0;
        return (
          <Link
            key={slug}
            href={`/dashboard/status/${workflow}/${slug}`}
            className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 transition hover:border-teal-300 hover:bg-teal-50"
          >
            <span className="truncate text-xs text-slate-600" title={label}>{label}</span>
            <span className="flex items-center gap-1">
              <LinkPending className="size-3 text-slate-400" />
              <b className={`rounded px-1.5 py-0.5 text-xs ${value > 0 ? "bg-white text-slate-900" : "text-slate-400"}`}>
                {value.toLocaleString()}
              </b>
            </span>
          </Link>
        );
      })}
    </div>
  );
}

/** ຕາຕະລາງວຽກລ່າສຸດ — ຂະໜາດດຽວກັບໜ້າ ກວດເຊັກ/ສ້ອມແປງ */
function RecentTable({ type, rows }: { type: "repair" | "install"; rows: (RecentRepair | RecentInstall)[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] border-collapse text-xs">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50 text-left text-slate-600">
            <th className="whitespace-nowrap px-3 py-2.5 font-semibold">ເລກທີ</th>
            <th className="whitespace-nowrap px-3 py-2.5 font-semibold">ຄ້າງມາ</th>
            <th className="whitespace-nowrap px-3 py-2.5 font-semibold">ລູກຄ້າ</th>
            <th className="whitespace-nowrap px-3 py-2.5 font-semibold">ສິນຄ້າ</th>
            <th className="whitespace-nowrap px-3 py-2.5 font-semibold">{type === "repair" ? "Serial Number" : "ຊ່າງ"}</th>
            <th className="whitespace-nowrap px-3 py-2.5 font-semibold">ສະຖານະ</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const tone = elapsedTone(row.elapsed_seconds);
            return (
              <tr key={row.code} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                <td className="relative whitespace-nowrap px-3 py-2.5 font-bold text-[#0536a9]">
                  <span className={`absolute inset-y-0 left-0 w-1 ${tone.bar}`} aria-hidden />
                  {type === "repair" ? (
                    <Link href={`/service/${row.code}`} className="hover:underline">{row.code}</Link>
                  ) : (
                    row.code
                  )}
                </td>
                <td className="whitespace-nowrap px-3 py-2.5">
                  <Elapsed seconds={row.elapsed_seconds} className={`inline-block rounded px-1.5 py-0.5 text-[11px] font-semibold ${tone.chip}`} />
                  <span className="mt-0.5 block text-[10px] text-slate-400">{row.registered || "-"}</span>
                </td>
                <td className="max-w-44 truncate px-3 py-2.5 text-slate-600" title={row.customer ?? ""}>{row.customer || "-"}</td>
                <td className="max-w-56 truncate px-3 py-2.5 text-slate-600" title={row.product ?? ""}>{row.product || "-"}</td>
                <td className="whitespace-nowrap px-3 py-2.5 text-slate-600">
                  {"sn" in row ? row.sn || "-" : row.technician || "-"}
                </td>
                <td className="whitespace-nowrap px-3 py-2.5">
                  <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">{row.status}</span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {rows.length === 0 && <p className="py-12 text-center text-xs text-slate-400">ບໍ່ມີລາຍການ</p>}
    </div>
  );
}

export default async function Dashboard() {
  const { data, error } = await getDashboard();
  const repair = data?.repair ?? {};
  const install = data?.install ?? {};

  // ວຽກສ້ອມຄ້າງ = ຂັ້ນ 1..10 ທັງໝົດ (= total ຂອງ query ທີ່ກອງດ້ວຍ OPEN_JOBS ແລ້ວ)
  const summaries = [
    { label: "ວຽກສ້ອມຄ້າງ", value: repair.total ?? 0, icon: Wrench, tone: "bg-amber-50 text-amber-600" },
    { label: "ລໍຖ້າສ້ອມ", value: repair["wait-repair"] ?? 0, icon: Clock3, tone: "bg-blue-50 text-blue-600" },
    { label: "ວຽກຕິດຕັ້ງຄ້າງ", value: install.total ?? 0, icon: ClipboardList, tone: "bg-violet-50 text-violet-600" },
    { label: "ກຳລັງຕິດຕັ້ງ", value: install.installing ?? 0, icon: Clock3, tone: "bg-teal-50 text-teal-600" },
  ];

  return (
    <div className="w-full space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-700">ໜ້າລວມ</h1>
          <p className="mt-0.5 text-xs text-slate-500">ສະແດງສະເພາະວຽກຄ້າງ ແລະ ວຽກທີ່ກຳລັງດຳເນີນ</p>
        </div>
        <Link
          href="/dashboard/tracking"
          className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50"
        >
          <Radar className="size-4" />
          ຕິດຕາມວຽກ
          <LinkPending className="size-3.5" />
        </Link>
      </div>

      {error && (
        <p className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          <AlertCircle className="size-4 shrink-0" />
          ບໍ່ສາມາດໂຫຼດຂໍ້ມູນ dashboard ໄດ້
        </p>
      )}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {summaries.map(({ label, value, icon: Icon, tone }) => (
          <article key={label} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm">
            <div className="min-w-0">
              <p className="truncate text-xs text-slate-500">{label}</p>
              <p className="mt-1 text-2xl font-bold text-slate-800">{value.toLocaleString()}</p>
            </div>
            <span className={`grid size-9 shrink-0 place-items-center rounded-lg ${tone}`}>
              <Icon className="size-4" />
            </span>
          </article>
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-bold text-slate-700">ວຽກສ້ອມແປງທີ່ຍັງຄ້າງ</h2>
          <StatusGrid workflow="repair" statuses={repairStatuses} counts={repair} />
        </article>
        <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-bold text-slate-700">ວຽກຕິດຕັ້ງທີ່ຍັງຄ້າງ</h2>
          <StatusGrid workflow="install" statuses={installStatuses} counts={install} />
        </article>
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <h2 className="border-b border-slate-100 px-4 py-2.5 text-sm font-bold text-slate-700">ວຽກສ້ອມທີ່ຍັງຄ້າງລ່າສຸດ</h2>
        <RecentTable type="repair" rows={data?.recentRepairs ?? []} />
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <h2 className="border-b border-slate-100 px-4 py-2.5 text-sm font-bold text-slate-700">ວຽກຕິດຕັ້ງທີ່ຍັງຄ້າງລ່າສຸດ</h2>
        <RecentTable type="install" rows={data?.recentInstalls ?? []} />
      </section>
    </div>
  );
}
