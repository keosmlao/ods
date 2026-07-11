import { Elapsed } from "@/components/elapsed";
import { LinkPending } from "@/components/link-pending";
import { SortHeader, type SortDir } from "@/components/sort-header";
import { query } from "@/lib/db";
import { elapsedTone } from "@/lib/elapsed-tone";
import { CANCELLED_JOBS } from "@/lib/stage";
import { CheckCheck, ChevronLeft, ChevronRight, Clock, FileCheck2, Search } from "lucide-react";
import Link from "next/link";

/** ຖອດແບບຈາກ ods: Services.py home_cc_approve() + templates/Service/approve_cc.html (ອອກແບບໃໝ່) */

const PAGE_SIZE = 20;

type Tab = "waiting" | "done";
type Props = { searchParams: Promise<{ tab?: string; q?: string; page?: string; sort?: string; dir?: string }> };

type Row = {
  code: string;
  registered: string | null;
  cancel_start: string | null;
  cancel_finish: string | null;
  at_time: string | null;
  elapsed_seconds: number | null;
  customer: string | null;
  product: string | null;
  model: string | null;
  sn: string | null;
  brand: string | null;
  warranty: string | null;
  issue: string | null;
  issue_2: string | null;
  technician: string | null;
  user_regis: string | null;
  request_cancel: string | null;
  approve_cancel: string | null;
};

/** ວຽກທີ່ຖືກຍົກເລີກ (status = 6 ຕາມ CANCELLED_JOBS ຂອງ lib/stage) */
const BUCKET: Record<Tab, { where: string; timeCol: string }> = {
  waiting: {
    where: `${CANCELLED_JOBS} and a.cancel_start is not null and a.cancel_finish is null`,
    timeCol: "a.cancel_start",
  },
  done: {
    where: `${CANCELLED_JOBS} and a.cancel_start is not null and a.cancel_finish is not null`,
    timeCol: "a.cancel_finish",
  },
};

const SEARCH = `(a.code ilike $Q or a.sn ilike $Q or a.name_1 ilike $Q or a.p_brand ilike $Q or a.p_model ilike $Q
  or a.issue ilike $Q or a.issue_2 ilike $Q or a.emp_code ilike $Q
  or a.request_cancel ilike $Q or a.approve_cancel ilike $Q
  or b.name_1 ilike $Q or b.tel ilike $Q)`;

/** ຖັນທີ່ຈັດຮຽງໄດ້ — whitelist ກັນ SQL injection */
const SORT_SQL: Record<string, string> = {
  code: "a.code",
  elapsed: "at_col",
  product: "a.name_1",
  brand: "a.p_brand",
  customer: "b.name_1",
  warranty: "a.warrunty",
  request_cancel: "a.request_cancel",
};

async function getRows(tab: Tab, q: string, page: number, sort: string, dir: SortDir) {
  const { where: bucket, timeCol } = BUCKET[tab];
  const where = [bucket];
  const params: (string | number)[] = [];
  if (q) {
    params.push(`%${q}%`);
    where.push(SEARCH.replaceAll("$Q", `$${params.length}`));
  }
  const filter = where.join(" and ");

  const column = SORT_SQL[sort] ?? "at_col";
  // ຄ້າງດົນສຸດກ່ອນ = ເວລາເກົ່າສຸດກ່ອນ ຈຶ່ງກັບທິດໃຫ້
  const orderBy =
    column === "at_col" ? `${timeCol} ${dir === "desc" ? "asc" : "desc"} nulls last` : `${column} ${dir}`;

  const rowsSql = `select a.code,
      to_char(a.time_register,'DD-MM-YYYY HH24:MI') registered,
      to_char(a.cancel_start,'DD-MM-YYYY HH24:MI') cancel_start,
      to_char(a.cancel_finish,'DD-MM-YYYY HH24:MI') cancel_finish,
      to_char(${timeCol},'DD-MM-YYYY HH24:MI') at_time,
      greatest(0, round(extract(epoch from (localtimestamp - ${timeCol}))))::int elapsed_seconds,
      concat_ws('-', b.name_1, b.tel) customer, a.name_1 product, a.p_model model, a.sn, a.p_brand brand,
      a.warrunty warranty, a.issue, a.issue_2, a.emp_code technician, a.user_regis,
      a.request_cancel, a.approve_cancel
    from tb_product a
    left join ar_customer b on b.code = a.cust_code
    where ${filter}
    order by ${orderBy}
    limit $${params.length + 1} offset $${params.length + 2}`;

  const countSql = `select count(*)::int total from tb_product a
    left join ar_customer b on b.code = a.cust_code where ${filter}`;

  const [rows, count] = await Promise.all([
    query<Row>(rowsSql, [...params, PAGE_SIZE, (page - 1) * PAGE_SIZE]),
    query<{ total: number }>(countSql, params),
  ]);
  return { rows: rows.rows, total: count.rows[0]?.total ?? 0 };
}

/** ນັບຫົວແທັບ — ບໍ່ດຶງແຖວ */
async function getCounts() {
  const row = (
    await query<{ waiting: number; done: number }>(
      `select count(*) filter (where ${BUCKET.waiting.where})::int waiting,
          count(*) filter (where ${BUCKET.done.where})::int done
        from tb_product a`,
    )
  ).rows[0];
  return { waiting: row?.waiting ?? 0, done: row?.done ?? 0 };
}

const COLUMNS: { key: string; label: string; defaultDir: SortDir }[] = [
  { key: "code", label: "ເລກທີ", defaultDir: "desc" },
  { key: "elapsed", label: "ຂໍຍົກເລີກມາແລ້ວ", defaultDir: "desc" },
  { key: "product", label: "ລາຍການ / SN", defaultDir: "asc" },
  { key: "brand", label: "ຫຍີ່ຫໍ້", defaultDir: "asc" },
  { key: "customer", label: "ລູກຄ້າ", defaultDir: "asc" },
  { key: "warranty", label: "ປະກັນ", defaultDir: "asc" },
  { key: "request_cancel", label: "ຜູ້ຂໍຍົກເລີກ", defaultDir: "asc" },
];

export default async function CancellationsPage({ searchParams }: Props) {
  const params = await searchParams;
  const tab: Tab = params.tab === "done" ? "done" : "waiting";
  const q = (params.q ?? "").trim();
  const page = Math.max(1, Number(params.page) || 1);
  const dir: SortDir = params.dir === "asc" ? "asc" : "desc";
  const sort = (params.sort ?? "elapsed").trim();

  const [counts, list] = await Promise.all([getCounts(), getRows(tab, q, page, sort, dir)]);
  const total = list.total;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const base = () => ({ ...(tab !== "waiting" && { tab }), ...(q && { q }) });
  const tabHref = (target: Tab) =>
    `/approvals/cancellations?${new URLSearchParams({ ...(target !== "waiting" && { tab: target }), ...(q && { q }) })}`;
  const sortHref = (key: string, nextDir: SortDir) =>
    `/approvals/cancellations?${new URLSearchParams({ ...base(), sort: key, dir: nextDir })}`;
  const pageHref = (n: number) =>
    `/approvals/cancellations?${new URLSearchParams({ ...base(), sort, dir, ...(n > 1 && { page: String(n) }) })}`;

  const TABS: { key: Tab; label: string; icon: typeof Clock; count: number }[] = [
    { key: "waiting", label: "ລໍຖ້າອະນຸມັດຍົກເລີກເຄື່ອງສ້ອມ", icon: Clock, count: counts.waiting },
    { key: "done", label: "ອະນຸມັດຍົກເລີກເຄື່ອງສ້ອມເເລ້ວ", icon: CheckCheck, count: counts.done },
  ];

  const timeLabel = tab === "waiting" ? "ຂໍຍົກເລີກມາແລ້ວ" : "ອະນຸມັດມາແລ້ວ";

  return (
    <div className="w-full space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-700">ອະນຸມັດຍົກເລີກເຄື່ອງສ້ອມ</h1>
        <p className="mt-0.5 text-xs text-slate-500">
          {total.toLocaleString()} ລາຍການ · ໜ້າ {page}/{pages}
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
              placeholder="ຄົ້ນຫາ ເລກທີ, SN, ລູກຄ້າ, ຫຍີ່ຫໍ້, ຜູ້ຂໍຍົກເລີກ..."
              className="w-full text-xs outline-none"
            />
          </div>
          <button className="h-9 rounded-lg bg-slate-900 px-4 text-xs font-medium text-white">ຄົ້ນຫາ</button>
        </form>
      </div>

      {/* ຕາຕະລາງ */}
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1250px] border-collapse text-xs">
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
                <th className="whitespace-nowrap px-3 py-2.5 font-semibold">ອາການເບື້ອງຕົ້ນ</th>
                <th className="whitespace-nowrap px-3 py-2.5 font-semibold">ວັນ/ເວລາຮັບເຄື່ອງ</th>
                {tab === "done" ? (
                  <>
                    <th className="whitespace-nowrap px-3 py-2.5 font-semibold">ວັນ/ເວລາຂໍຍົກເລີກ</th>
                    <th className="whitespace-nowrap px-3 py-2.5 font-semibold">ຜູ້ອະນຸມັດ</th>
                  </>
                ) : (
                  <th className="px-3 py-2.5" />
                )}
              </tr>
            </thead>
            <tbody>
              {list.rows.map((row) => {
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
                      <span className="mt-0.5 block text-[10px] text-slate-400">{row.at_time ?? "-"}</span>
                    </td>
                    <td className="max-w-64 px-3 py-2.5">
                      <span className="block truncate font-medium text-slate-800" title={row.product ?? ""}>
                        {row.product || "-"} {row.model && <span className="text-slate-400">{row.model}</span>}
                      </span>
                      <span className="block truncate text-[10px] font-bold text-[#790404]">{row.sn || "-"}</span>
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
                    <td className="whitespace-nowrap px-3 py-2.5">{row.request_cancel || "-"}</td>
                    <td className="max-w-52 px-3 py-2.5">
                      <span className="block truncate font-semibold text-red-600" title={row.issue ?? ""}>
                        {row.issue || "-"}
                      </span>
                      {row.issue_2 && (
                        <span className="block truncate text-[10px] text-slate-400" title={row.issue_2}>
                          ຊ່າງ: {row.issue_2}
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-slate-500">{row.registered ?? "-"}</td>

                    {tab === "done" ? (
                      <>
                        <td className="whitespace-nowrap px-3 py-2.5 text-slate-500">{row.cancel_start ?? "-"}</td>
                        <td className="whitespace-nowrap px-3 py-2.5">{row.approve_cancel ?? "-"}</td>
                      </>
                    ) : (
                      <td className="whitespace-nowrap px-3 py-2.5 text-center">
                        <Link
                          href={`/approvals/cancellations/${encodeURIComponent(row.code)}`}
                          className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-teal-600 px-3 text-xs font-semibold text-white hover:bg-teal-700"
                        >
                          <FileCheck2 className="size-3.5" />
                          ລາຍລະອຽດ
                          <LinkPending className="size-3" />
                        </Link>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {total === 0 && <p className="py-12 text-center text-xs text-slate-400">ບໍ່ພົບລາຍການ</p>}
      </section>

      {pages > 1 && (
        <nav className="flex items-center justify-between gap-3 text-xs">
          <span className="text-slate-500">
            ສະແດງ {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} ຈາກ {total.toLocaleString()}
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
