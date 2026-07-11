import { Elapsed } from "@/components/elapsed";
import { LinkPending } from "@/components/link-pending";
import { StartRepairButton } from "@/components/repair/repair-actions";
import { SortHeader, type SortDir } from "@/components/sort-header";
import { getSession } from "@/lib/auth";
import { query } from "@/lib/db";
import { elapsedTone } from "@/lib/elapsed-tone";
import { ownJobsOnly } from "@/lib/scope";
import { SERVICE_TYPE_LABEL } from "@/lib/sla";
import { OPEN_JOBS, STAGE_SQL } from "@/lib/stage";
import { CheckCircle2, ChevronLeft, ChevronRight, Clock, Package, Search, Wrench } from "lucide-react";
import Link from "next/link";

/** ຖອດແບບຈາກ ods: repair.py repair() + templates/repair/home_repair.html (ອອກແບບໃໝ່) */

const PAGE_SIZE = 20;

type Tab = "waiting" | "progress";
type Props = { searchParams: Promise<{ tab?: string; q?: string; page?: string; sort?: string; dir?: string }> };

type JobRow = {
  code: string;
  customer: string | null;
  product: string | null;
  model: string | null;
  sn: string | null;
  brand: string | null;
  warranty: string | null;
  issue: string | null;
  /** ອາການທີ່ຊ່າງວິເຄາະຕອນກວດເຊັກ */
  issue_2: string | null;
  at_time: string | null;
  elapsed_seconds: number | null;
  technician: string | null;
  service_type: string | null;
  /** ສະຖານະອາໄຫຼ່: ຕ້ອງການອາໄຫຼ່ບໍ, ຂໍເບີກແລ້ວບໍ, ໄດ້ຮັບຄົບບໍ */
  spare_lines: number;
  spare_requested: boolean;
  spare_pending: number;
};

const CUSTOMER = "left join ar_customer b on b.code = a.cust_code";
const SEARCH = `(a.code ilike $Q or a.sn ilike $Q or a.name_1 ilike $Q or a.p_brand ilike $Q
  or a.p_model ilike $Q or a.issue ilike $Q or a.issue_2 ilike $Q or a.emp_code ilike $Q
  or b.name_1 ilike $Q or b.tel ilike $Q)`;

/**
 * ຖັງງານ — ອີງໃສ່ຂັ້ນຂອງ STAGE_SQL (ບໍ່ຜ່ານ view ອີກຕໍ່ໄປ):
 *   8 = ລໍຖ້າສ້ອມແປງ (ກວດເຊັກຈົບແລ້ວ) · 9 = ກຳລັງສ້ອມແປງ
 * ທັງສອງຖັງຢູ່ໃນວຽກຄ້າງ (OPEN_JOBS) ເທົ່ານັ້ນ — ວຽກສົ່ງຄືນ/ຍົກເລີກແລ້ວບໍ່ນັບ.
 */
const BUCKET: Record<Tab, { where: string; timeCol: string }> = {
  waiting: {
    where: `${OPEN_JOBS} and (${STAGE_SQL}) = 8`,
    timeCol: "a.time_finish_check",
  },
  progress: {
    where: `${OPEN_JOBS} and a.time_repair is not null and a.time_finish_repair is null`,
    timeCol: "a.time_repair",
  },
};

/** ຖັນທີ່ຈັດຮຽງໄດ້ — whitelist ກັນ SQL injection */
const SORT_SQL: Record<string, string> = {
  code: "a.code",
  customer: "b.name_1",
  product: "a.name_1",
  brand: "a.p_brand",
  warranty: "a.warrunty",
  technician: "a.emp_code",
  elapsed: "at_col",
};

async function getJobs(tab: Tab, emp: string | null, q: string, page: number, sort: string, dir: SortDir) {
  const { where: bucket, timeCol } = BUCKET[tab];
  const where = [bucket];
  const params: (string | number)[] = [];
  if (emp) { params.push(emp); where.push(`a.emp_code = $${params.length}`); }
  if (q) { params.push(`%${q}%`); where.push(SEARCH.replaceAll("$Q", `$${params.length}`)); }
  const filter = where.join(" and ");

  const column = SORT_SQL[sort] ?? "at_col";
  // ຄ້າງດົນສຸດກ່ອນ = ເວລາເກົ່າສຸດກ່ອນ ຈຶ່ງກັບທິດໃຫ້
  const orderBy =
    column === "at_col" ? `${timeCol} ${dir === "desc" ? "asc" : "desc"} nulls last` : `${column} ${dir}`;

  const rowsSql = `select a.code,
      concat_ws('-', b.name_1, b.tel) customer, a.name_1 product, a.p_model model, a.sn, a.p_brand brand,
      a.warrunty warranty, a.issue, a.issue_2, a.emp_code technician, a.service_type,
      to_char(${timeCol},'DD-MM-YYYY HH24:MI') at_time,
      greatest(0, round(extract(epoch from (localtimestamp - ${timeCol}))))::int elapsed_seconds,
      (select count(*) from tb_used_spare s where s.product_code=a.code)::int spare_lines,
      (a.spare_reg is not null) spare_requested,
      (select count(*) from tb_used_spare s where s.product_code=a.code and s.pick_finish is null)::int spare_pending
    from tb_product a ${CUSTOMER}
    where ${filter}
    order by ${orderBy}
    limit $${params.length + 1} offset $${params.length + 2}`;

  const countSql = `select count(*)::int total from tb_product a ${CUSTOMER} where ${filter}`;

  const [rows, count] = await Promise.all([
    query<JobRow>(rowsSql, [...params, PAGE_SIZE, (page - 1) * PAGE_SIZE]),
    query<{ total: number }>(countSql, params),
  ]);
  return { rows: rows.rows, total: count.rows[0]?.total ?? 0 };
}

/** ນັບຫົວແທັບ — ບໍ່ດຶງແຖວ */
async function getCounts(emp: string | null) {
  const scope = emp ? "and a.emp_code = $1" : "";
  const sql = `select
      count(*) filter (where ${BUCKET.waiting.where})::int waiting,
      count(*) filter (where ${BUCKET.progress.where})::int progress
    from tb_product a where true ${scope}`;
  const row = (await query<{ waiting: number; progress: number }>(sql, emp ? [emp] : [])).rows[0];
  return { waiting: row?.waiting ?? 0, progress: row?.progress ?? 0 };
}

const COLUMNS: { key: string; label: string; defaultDir: SortDir }[] = [
  { key: "code", label: "ເລກທີ", defaultDir: "desc" },
  { key: "elapsed", label: "ເວລາ", defaultDir: "desc" },
  { key: "product", label: "ຊື່ເຄື່ອງ / SN", defaultDir: "asc" },
  { key: "brand", label: "ຫຍີ່ຫໍ້", defaultDir: "asc" },
  { key: "customer", label: "ລູກຄ້າ", defaultDir: "asc" },
  { key: "warranty", label: "ປະກັນ", defaultDir: "asc" },
  { key: "technician", label: "ຊ່າງ", defaultDir: "asc" },
];

/** ປ້າຍສະຖານະອາໄຫຼ່ຂອງວຽກນຶ່ງ */
function SpareBadge({ row }: { row: JobRow }) {
  if (row.spare_lines === 0) return <span className="text-[10px] text-slate-400">ບໍ່ໃຊ້ອາໄຫຼ່</span>;
  if (!row.spare_requested)
    return (
      <span className="inline-flex items-center gap-1 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
        <Package className="size-3" />
        ຍັງບໍ່ໄດ້ຂໍເບີກ ({row.spare_lines})
      </span>
    );
  if (row.spare_pending > 0)
    return (
      <span className="inline-flex items-center gap-1 rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700">
        <Package className="size-3" />
        ລໍຖ້າອາໄຫຼ່ {row.spare_pending}/{row.spare_lines}
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
      <Package className="size-3" />
      ໄດ້ຮັບອາໄຫຼ່ຄົບ
    </span>
  );
}

export default async function RepairPage({ searchParams }: Props) {
  const session = await getSession();
  // ຊ່າງເຫັນສະເພາະວຽກຕົນເອງ · ຜູ້ຈັດການເຫັນທຸກວຽກ
  const emp = ownJobsOnly(session);

  const params = await searchParams;
  const tab: Tab = params.tab === "progress" ? "progress" : "waiting";
  const q = (params.q ?? "").trim();
  const page = Math.max(1, Number(params.page) || 1);
  const dir: SortDir = params.dir === "asc" ? "asc" : "desc";
  const sort = (params.sort ?? "elapsed").trim();

  const [counts, jobs] = await Promise.all([getCounts(emp), getJobs(tab, emp, q, page, sort, dir)]);
  const pages = Math.max(1, Math.ceil(jobs.total / PAGE_SIZE));

  const base = () => ({ ...(tab !== "waiting" && { tab }), ...(q && { q }) });
  const tabHref = (target: Tab) =>
    `/repair?${new URLSearchParams({ ...(target !== "waiting" && { tab: target }), ...(q && { q }) })}`;
  const sortHref = (key: string, nextDir: SortDir) =>
    `/repair?${new URLSearchParams({ ...base(), sort: key, dir: nextDir })}`;
  const pageHref = (n: number) =>
    `/repair?${new URLSearchParams({ ...base(), sort, dir, ...(n > 1 && { page: String(n) }) })}`;

  const TABS: { key: Tab; label: string; icon: typeof Clock; count: number }[] = [
    { key: "waiting", label: "ລໍຖ້າສ້ອມແປງ", icon: Clock, count: counts.waiting },
    { key: "progress", label: "ກຳລັງສ້ອມແປງ", icon: Wrench, count: counts.progress },
  ];

  const timeLabel = tab === "waiting" ? "ຄ້າງມາ" : "ສ້ອມມາແລ້ວ";

  return (
    <div className="w-full space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-700">ສ້ອມແປງ</h1>
        <p className="mt-0.5 text-xs text-slate-500">
          {emp ? "ສະແດງສະເພາະວຽກຂອງທ່ານ" : "ສະແດງທຸກວຽກ"} · {jobs.total.toLocaleString()} ລາຍການ · ໜ້າ {page}/{pages}
        </p>
      </div>

      {/* ແທັບ + ຄົ້ນຫາ */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm">
        <div className="flex overflow-hidden rounded-lg border border-slate-300">
          {TABS.map(({ key, label, icon: Icon, count }) => (
            <Link
              key={key}
              href={tabHref(key)}
              className={`inline-flex h-9 items-center gap-1.5 border-l border-slate-300 px-3 text-xs font-medium first:border-l-0 ${
                tab === key ? "bg-slate-900 text-white" : "bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              <Icon className="size-3.5" />
              {label}
              <span className={`rounded px-1 text-[10px] font-bold ${tab === key ? "bg-white/20" : "bg-slate-100 text-slate-600"}`}>
                {count}
              </span>
              <LinkPending className="size-3" />
            </Link>
          ))}
        </div>

        <form className="flex flex-1 items-center gap-2">
          {tab !== "waiting" && <input type="hidden" name="tab" value={tab} />}
          <input type="hidden" name="sort" value={sort} />
          <input type="hidden" name="dir" value={dir} />
          <div className="flex h-9 min-w-56 flex-1 items-center gap-2 rounded-lg border border-slate-300 px-2.5">
            <Search className="size-3.5 shrink-0 text-slate-400" />
            <input
              name="q"
              defaultValue={q}
              placeholder="ຄົ້ນຫາ ເລກທີ, SN, ລູກຄ້າ, ຫຍີ່ຫໍ້, ຊ່າງ, ອາການ..."
              className="w-full text-xs outline-none"
            />
          </div>
          <button className="h-9 rounded-lg bg-slate-900 px-4 text-xs font-medium text-white">ຄົ້ນຫາ</button>
        </form>
      </div>

      {/* ຕາຕະລາງ */}
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-slate-600">
                {COLUMNS.map((column) => (
                  <SortHeader
                    key={column.key}
                    label={column.key === "elapsed" ? timeLabel : column.label}
                    sortKey={column.key}
                    current={sort}
                    dir={dir}
                    href={sortHref}
                    defaultDir={column.defaultDir}
                    className="py-2.5"
                  />
                ))}
                <th className="whitespace-nowrap px-3 py-2.5 font-semibold">ອາໄຫຼ່</th>
                <th className="whitespace-nowrap px-3 py-2.5 font-semibold">ອາການ</th>
                <th className="px-3 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {jobs.rows.map((row) => {
                const tone = elapsedTone(row.elapsed_seconds);
                const inWarranty = row.warranty === "ຮັບປະກັນ";
                return (
                  <tr key={row.code} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="relative whitespace-nowrap px-3 py-2.5 font-bold text-[#0536a9]">
                      <span className={`absolute inset-y-0 left-0 w-1 ${tone.bar}`} aria-hidden />
                      <Link href={`/service/${row.code}`} className="hover:underline">
                        {row.code}
                      </Link>
                    </td>

                    <td className="whitespace-nowrap px-3 py-2.5">
                      <Elapsed
                        seconds={row.elapsed_seconds}
                        className={`inline-block rounded px-1.5 py-0.5 text-[11px] font-semibold ${tone.chip}`}
                      />
                      <span className="mt-0.5 block text-[10px] text-slate-400">{row.at_time}</span>
                    </td>

                    <td className="max-w-64 px-3 py-2.5">
                      <span className="block truncate font-medium text-slate-800" title={row.product ?? ""}>
                        {row.product || "-"} {row.model && <span className="text-slate-400">{row.model}</span>}
                      </span>
                      <span className="block truncate text-[10px] text-slate-400">
                        {row.sn || "-"}
                        {row.service_type && (
                          <span className="ml-1">· {SERVICE_TYPE_LABEL[row.service_type] ?? row.service_type}</span>
                        )}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5">{row.brand || "-"}</td>
                    <td className="max-w-44 truncate px-3 py-2.5" title={row.customer ?? ""}>
                      {row.customer || "-"}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5">
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                          inWarranty ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {row.warranty || "-"}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5">{row.technician || "-"}</td>
                    <td className="whitespace-nowrap px-3 py-2.5">
                      <SpareBadge row={row} />
                    </td>

                    {/* ອາການຊ່າງວິເຄາະ (ຖ້າກວດແລ້ວ) ຫຼື ອາການເບື້ອງຕົ້ນ */}
                    <td className="max-w-52 px-3 py-2.5">
                      <span className="block truncate font-semibold text-red-600" title={row.issue_2 || row.issue || ""}>
                        {row.issue_2 || row.issue || "-"}
                      </span>
                      {row.issue_2 && row.issue && (
                        <span className="block truncate text-[10px] text-slate-400" title={row.issue}>
                          ເບື້ອງຕົ້ນ: {row.issue}
                        </span>
                      )}
                    </td>

                    <td className="whitespace-nowrap px-3 py-2.5 text-center">
                      {tab === "waiting" ? (
                        <StartRepairButton code={row.code} />
                      ) : (
                        <Link
                          href={`/repair/${row.code}`}
                          className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-teal-600 px-3 text-xs font-semibold text-white hover:bg-teal-700"
                        >
                          <CheckCircle2 className="size-3.5" />
                          ເປີດວຽກ
                          <LinkPending className="size-3" />
                        </Link>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {jobs.total === 0 && <p className="py-12 text-center text-xs text-slate-400">ບໍ່ພົບລາຍການ</p>}
      </section>

      {pages > 1 && (
        <nav className="flex items-center justify-between gap-3 text-xs">
          <span className="text-slate-500">
            ສະແດງ {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, jobs.total)} ຈາກ {jobs.total.toLocaleString()}
          </span>
          <div className="flex items-center gap-1">
            <Link
              href={pageHref(page - 1)}
              aria-disabled={page === 1}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 hover:bg-slate-50 aria-disabled:pointer-events-none aria-disabled:opacity-40"
            >
              <ChevronLeft className="size-3.5" />
              ກ່ອນໜ້າ
            </Link>
            <span className="px-3 font-medium text-slate-700">
              {page} / {pages}
            </span>
            <Link
              href={pageHref(page + 1)}
              aria-disabled={page >= pages}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 hover:bg-slate-50 aria-disabled:pointer-events-none aria-disabled:opacity-40"
            >
              ຕໍ່ໄປ
              <ChevronRight className="size-3.5" />
            </Link>
          </div>
        </nav>
      )}
    </div>
  );
}
