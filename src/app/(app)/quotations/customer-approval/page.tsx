import { Elapsed } from "@/components/elapsed";
import { LinkPending } from "@/components/link-pending";
import { SortHeader, type SortDir } from "@/components/sort-header";
import { query } from "@/lib/db";
import { elapsedTone } from "@/lib/elapsed-tone";
import { CheckCheck, ChevronLeft, ChevronRight, Clock, FileCheck2, Search } from "lucide-react";
import Link from "next/link";

/** ຖອດແບບຈາກ ods: qt.py cust_qt_approve() + templates/approve/qt/custhomeqt.html (ອອກແບບໃໝ່) */

const PAGE_SIZE = 20;

type Tab = "waiting" | "done";
type Props = { searchParams: Promise<{ tab?: string; q?: string; page?: string; sort?: string; dir?: string }> };

type Row = {
  doc_no: string;
  doc_date: string | null;
  customer: string | null;
  product: string | null;
  model: string | null;
  sn: string | null;
  brand: string | null;
  issue: string | null;
  warranty: string | null;
  issue_2: string | null;
  user_regis: string | null;
  technician: string | null;
  user_created: string | null;
  approver1: string | null;
  at_time: string | null;
  elapsed_seconds: number | null;
  status_name: string | null;
};

/** ປ້າຍສະຖານະ — ຄັດລອກຈາກ cust_qt_approve() (ຮັກສາຕົວສະກົດເດີມຂອງ ods) */
const STATUS_CASE = `case when a.aprove_status_2=0 then 'ລໍຖ້າລູກຄ້າອະນູມັດ'
    when a.aprove_status_2=1 then 'ລູກຄ່້າອະນູມັດເເລ້ວ'
    when a.aprove_status_2=2 then 'ລູກຄ່້າບໍ່ອະນຸມັດ'
    else '-' end`;

/** ໃບສະເໜີລາຄາທີ່ຜ່ານການອະນຸມັດພາຍໃນແລ້ວ — ຄອຍລູກຄ້າຕອບກັບ */
const BASE = "a.trans_flag = 17 and a.aprove_status = 1";
const BUCKET: Record<Tab, string> = {
  waiting: `${BASE} and a.aprove_status_2 = 0`,
  done: `${BASE} and a.aprove_status_2 in (1,2)`,
};

const SEARCH = `(a.doc_no ilike $Q or a.user_created ilike $Q or a.approver1 ilike $Q
  or b.name_1 ilike $Q or b.tel ilike $Q
  or c.name_1 ilike $Q or c.sn ilike $Q or c.p_brand ilike $Q or c.p_model ilike $Q
  or c.issue ilike $Q or c.issue_2 ilike $Q or c.emp_code ilike $Q)`;

/** ຖັນທີ່ຈັດຮຽງໄດ້ — whitelist ກັນ SQL injection */
const SORT_SQL: Record<string, string> = {
  doc_no: "a.doc_no",
  doc_date: "a.doc_date",
  elapsed: "at_col",
  customer: "b.name_1",
  product: "c.name_1",
  brand: "c.p_brand",
  warranty: "c.warrunty",
  technician: "c.emp_code",
  user_created: "a.user_created",
};

/** "ລໍຖ້າມາແລ້ວ" ນັບຈາກເວລາອະນຸມັດພາຍໃນ (aprove_date1) */
const TIME_COL = "a.aprove_date1";

async function getRows(tab: Tab, q: string, page: number, sort: string, dir: SortDir) {
  const where = [BUCKET[tab]];
  const params: (string | number)[] = [];
  if (q) {
    params.push(`%${q}%`);
    where.push(SEARCH.replaceAll("$Q", `$${params.length}`));
  }
  const filter = where.join(" and ");

  const column = SORT_SQL[sort] ?? "a.doc_no";
  // ຄ້າງດົນສຸດກ່ອນ = ເວລາເກົ່າສຸດກ່ອນ ຈຶ່ງກັບທິດໃຫ້
  const orderBy =
    column === "at_col" ? `${TIME_COL} ${dir === "desc" ? "asc" : "desc"} nulls last` : `${column} ${dir}`;

  const rowsSql = `select a.doc_no, to_char(a.doc_date,'DD-MM-YYYY') doc_date, concat_ws('-', b.name_1, b.tel) customer,
      c.name_1 product, c.p_model model, c.sn, c.p_brand brand, c.issue, c.warrunty warranty, c.issue_2,
      c.user_regis, c.emp_code technician, a.user_created, a.approver1,
      to_char(${TIME_COL},'DD-MM-YYYY HH24:MI') at_time,
      greatest(0, round(extract(epoch from (localtimestamp - ${TIME_COL}))))::int elapsed_seconds,
      ${STATUS_CASE} status_name
    from ic_trans a
    left join ar_customer b on b.code = a.cust_code
    left join tb_product c on c.code = a.product_code
    where ${filter}
    order by ${orderBy}
    limit $${params.length + 1} offset $${params.length + 2}`;

  const countSql = `select count(*)::int total from ic_trans a
    left join ar_customer b on b.code = a.cust_code
    left join tb_product c on c.code = a.product_code
    where ${filter}`;

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
      `select count(*) filter (where a.aprove_status_2 = 0)::int waiting,
          count(*) filter (where a.aprove_status_2 in (1,2))::int done
        from ic_trans a where ${BASE}`,
    )
  ).rows[0];
  return { waiting: row?.waiting ?? 0, done: row?.done ?? 0 };
}

const COLUMNS: { key: string; label: string; defaultDir: SortDir }[] = [
  { key: "doc_no", label: "ໃບສະເໜີລາຄາ", defaultDir: "desc" },
  { key: "doc_date", label: "ວັນທີ", defaultDir: "desc" },
  { key: "elapsed", label: "ລໍຖ້າມາແລ້ວ", defaultDir: "desc" },
  { key: "product", label: "ລາຍການ / SN", defaultDir: "asc" },
  { key: "brand", label: "ຫຍີ່ຫໍ້", defaultDir: "asc" },
  { key: "customer", label: "ລູກຄ້າ", defaultDir: "asc" },
  { key: "warranty", label: "ປະກັນ", defaultDir: "asc" },
  { key: "technician", label: "ຊ່າງ", defaultDir: "asc" },
  { key: "user_created", label: "ຜູ້ອອກບິນ", defaultDir: "asc" },
];

const STATUS_TONE: Record<string, string> = {
  ລໍຖ້າລູກຄ້າອະນູມັດ: "bg-blue-50 text-blue-700",
  "ລູກຄ່້າອະນູມັດເເລ້ວ": "bg-emerald-50 text-emerald-700",
  "ລູກຄ່້າບໍ່ອະນຸມັດ": "bg-red-50 text-red-700",
};

export default async function CustomerApprovalPage({ searchParams }: Props) {
  const params = await searchParams;
  const tab: Tab = params.tab === "done" ? "done" : "waiting";
  const q = (params.q ?? "").trim();
  const page = Math.max(1, Number(params.page) || 1);
  const dir: SortDir = params.dir === "asc" ? "asc" : "desc";
  const sort = (params.sort ?? (tab === "done" ? "doc_no" : "elapsed")).trim();

  const [counts, list] = await Promise.all([getCounts(), getRows(tab, q, page, sort, dir)]);
  const total = list.total;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const base = () => ({ ...(tab !== "waiting" && { tab }), ...(q && { q }) });
  const tabHref = (target: Tab) =>
    `/quotations/customer-approval?${new URLSearchParams({ ...(target !== "waiting" && { tab: target }), ...(q && { q }) })}`;
  const sortHref = (key: string, nextDir: SortDir) =>
    `/quotations/customer-approval?${new URLSearchParams({ ...base(), sort: key, dir: nextDir })}`;
  const pageHref = (n: number) =>
    `/quotations/customer-approval?${new URLSearchParams({ ...base(), sort, dir, ...(n > 1 && { page: String(n) }) })}`;

  const TABS: { key: Tab; label: string; icon: typeof Clock; count: number }[] = [
    { key: "waiting", label: "ລໍຖ້າລູກຄ້າອະນຸມັດ", icon: Clock, count: counts.waiting },
    { key: "done", label: "ລູກຄ້າຕອບກັບເເລ້ວ", icon: CheckCheck, count: counts.done },
  ];

  return (
    <div className="w-full space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-700">ລູກຄ້າອະນຸມັດ</h1>
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
              placeholder="ຄົ້ນຫາ ໃບສະເໜີລາຄາ, SN, ລູກຄ້າ, ຫຍີ່ຫໍ້, ຊ່າງ..."
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
                    label={column.label}
                    sortKey={column.key}
                    current={sort}
                    dir={dir}
                    href={sortHref}
                    defaultDir={column.defaultDir}
                    className="py-2.5"
                  />
                ))}
                <th className="whitespace-nowrap px-3 py-2.5 font-semibold">ອາການຊ່າງ / ອາການເບື້ອງຕົ້ນ</th>
                {tab === "done" ? (
                  <>
                    <th className="whitespace-nowrap px-3 py-2.5 font-semibold">ຜູ້ອະນຸມັດ</th>
                    <th className="whitespace-nowrap px-3 py-2.5 font-semibold">ສະຖານະ</th>
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
                  <tr key={row.doc_no} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="relative whitespace-nowrap px-3 py-2.5 font-bold text-[#0536a9]">
                      <span className={`absolute inset-y-0 left-0 w-1 ${tone.bar}`} aria-hidden />
                      {row.doc_no}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5">{row.doc_date ?? "-"}</td>
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
                    <td className="whitespace-nowrap px-3 py-2.5">{row.technician || "-"}</td>
                    <td className="whitespace-nowrap px-3 py-2.5">{row.user_created || "-"}</td>
                    <td className="max-w-64 px-3 py-2.5">
                      <span className="block truncate font-semibold text-red-600" title={row.issue_2 ?? ""}>
                        {row.issue_2 || "-"}
                      </span>
                      <span className="block truncate text-[10px] text-slate-400" title={row.issue ?? ""}>
                        ເບື້ອງຕົ້ນ: {row.issue || "-"}
                      </span>
                    </td>

                    {tab === "done" ? (
                      <>
                        <td className="whitespace-nowrap px-3 py-2.5">{row.approver1 ?? "-"}</td>
                        <td className="whitespace-nowrap px-3 py-2.5">
                          <span
                            className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                              STATUS_TONE[row.status_name ?? ""] ?? "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {row.status_name ?? "-"}
                          </span>
                        </td>
                      </>
                    ) : (
                      <td className="whitespace-nowrap px-3 py-2.5 text-center">
                        <Link
                          href={`/quotations/customer-approval/${encodeURIComponent(row.doc_no)}`}
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
