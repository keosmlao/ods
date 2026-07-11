import { Elapsed } from "@/components/elapsed";
import { LinkPending } from "@/components/link-pending";
import { SortHeader, type SortDir } from "@/components/sort-header";
import { query } from "@/lib/db";
import { elapsedTone } from "@/lib/elapsed-tone";
import { CheckCheck, ChevronLeft, ChevronRight, Clock, Eye, FileCheck2, Search } from "lucide-react";
import Link from "next/link";

/**
 * ຖອດແບບຈາກ ods: order.py approve_request_order() + templates/request_order/approve_request_order.html
 * ods ຈຳກັດໜ້າ /approve_rq_order_page ໄວ້ສະເພາະ role manager — ໂຄງການນີ້ຕັດ role gating ອອກໝົດ.
 */

const PAGE_SIZE = 20;

type Tab = "waiting" | "approved";
type Props = { searchParams: Promise<{ tab?: string; q?: string; page?: string; sort?: string; dir?: string }> };

type Row = {
  doc_no: string;
  doc_ref: string | null;
  at_time: string | null;
  elapsed_seconds: number | null;
  customer: string | null;
  product: string | null;
  model: string | null;
  sn: string | null;
  brand: string | null;
  issue: string | null;
  issue_2: string | null;
  emp_code: string | null;
  warranty: string | null;
  status_doc: string | null;
  requester: string | null;
  user_created: string | null;
};

/** ລໍຖ້າອະນຸມັດ = ໃບຂໍອະນຸມັດສະເໜີຊື້ (RQ, trans_flag 78) · ອະນຸມັດແລ້ວ = ໃບສະເໜີຊື້ (SPR, trans_flag 2) ທີ່ອ້າງອີງ RQ */
const BUCKET: Record<Tab, string> = {
  waiting: "a.trans_flag = 78 and a.aprove_status = 0",
  approved: "a.trans_flag = 2 and a.doc_ref like 'RQ%'",
};

const SEARCH = `(a.doc_no ilike $Q or a.doc_ref ilike $Q or a.user_created ilike $Q
  or b.name_1 ilike $Q or b.tel ilike $Q
  or c.name_1 ilike $Q or c.sn ilike $Q or c.p_brand ilike $Q or c.p_model ilike $Q
  or c.issue ilike $Q or c.issue_2 ilike $Q or c.emp_code ilike $Q)`;

/** ຖັນທີ່ຈັດຮຽງໄດ້ — whitelist ກັນ SQL injection */
const SORT_SQL: Record<string, string> = {
  doc_no: "a.doc_no",
  elapsed: "at_col",
  customer: "b.name_1",
  product: "c.name_1",
  brand: "c.p_brand",
  technician: "c.emp_code",
  status_doc: "a.status_doc",
  user_created: "a.user_created",
};

const TIME_COL = "a.create_date_time_now";

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

  const rowsSql = `select a.doc_no, a.doc_ref,
      to_char(${TIME_COL},'DD-MM-YYYY HH24:MI') at_time,
      greatest(0, round(extract(epoch from (localtimestamp - ${TIME_COL}))))::int elapsed_seconds,
      concat_ws('-', b.name_1, b.tel) customer, c.name_1 product, c.p_model model, c.sn, c.p_brand brand,
      c.issue, c.issue_2, c.emp_code, a.user_created,
      (select user_created from ic_trans r where r.doc_no = a.doc_ref limit 1) requester,
      case when a.wanrunty = 'Warranty' then 'ຮັບປະກັນ' else 'ໝົດຮັບປະກັນ' end warranty,
      case when a.status_doc = 'Urgent' then 'ດ່ວນ' else 'ປົກກະຕິ' end status_doc
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
    await query<{ waiting: number; approved: number }>(
      `select count(*) filter (where ${BUCKET.waiting})::int waiting,
          count(*) filter (where ${BUCKET.approved})::int approved
        from ic_trans a`,
    )
  ).rows[0];
  return { waiting: row?.waiting ?? 0, approved: row?.approved ?? 0 };
}

const COLUMNS: { key: string; label: string; defaultDir: SortDir }[] = [
  { key: "doc_no", label: "ເລກທິຂໍສັ່ງຊື້", defaultDir: "desc" },
  { key: "elapsed", label: "ລໍຖ້າມາແລ້ວ", defaultDir: "desc" },
  { key: "product", label: "ລາຍການ / SN", defaultDir: "asc" },
  { key: "brand", label: "ຫຍີ່ຫໍ້", defaultDir: "asc" },
  { key: "customer", label: "ລູກຄ້າ", defaultDir: "asc" },
  { key: "technician", label: "ຊ່າງ", defaultDir: "asc" },
  { key: "status_doc", label: "ສະຖານະ", defaultDir: "asc" },
  { key: "user_created", label: "ຜູ້ຂໍອະນຸມັດ", defaultDir: "asc" },
];

export default async function ApprovePurchaseRequestsPage({ searchParams }: Props) {
  const params = await searchParams;
  const tab: Tab = params.tab === "approved" ? "approved" : "waiting";
  const q = (params.q ?? "").trim();
  const page = Math.max(1, Number(params.page) || 1);
  const dir: SortDir = params.dir === "asc" ? "asc" : "desc";
  const sort = (params.sort ?? (tab === "approved" ? "doc_no" : "elapsed")).trim();

  const [counts, list] = await Promise.all([getCounts(), getRows(tab, q, page, sort, dir)]);
  const total = list.total;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const base = () => ({ ...(tab !== "waiting" && { tab }), ...(q && { q }) });
  const tabHref = (target: Tab) =>
    `/approvals/purchase-requests?${new URLSearchParams({ ...(target !== "waiting" && { tab: target }), ...(q && { q }) })}`;
  const sortHref = (key: string, nextDir: SortDir) =>
    `/approvals/purchase-requests?${new URLSearchParams({ ...base(), sort: key, dir: nextDir })}`;
  const pageHref = (n: number) =>
    `/approvals/purchase-requests?${new URLSearchParams({ ...base(), sort, dir, ...(n > 1 && { page: String(n) }) })}`;

  const TABS: { key: Tab; label: string; icon: typeof Clock; count: number }[] = [
    { key: "waiting", label: "ລໍຖ້າອະນຸມັດຂໍສັ່ງຊື້", icon: Clock, count: counts.waiting },
    { key: "approved", label: "ອະນຸມັດຂໍສັ່ງຊື້ເເລ້ວ", icon: CheckCheck, count: counts.approved },
  ];

  const docLabel = tab === "waiting" ? "ເລກທິຂໍສັ່ງຊື້" : "ເລກທິສະເໜີຊື້";
  const timeLabel = tab === "waiting" ? "ລໍຖ້າມາແລ້ວ" : "ວັນທີສະເໜີຊື້";
  // ໃນແທັບ "ອະນຸມັດແລ້ວ" ຜູ້ສ້າງໃບ SPR ຄືຜູ້ອະນຸມັດ; ຜູ້ຂໍແມ່ນຜູ້ສ້າງໃບ RQ ທີ່ອ້າງອີງ
  const userLabel = tab === "waiting" ? "ຜູ້ຂໍອະນຸມັດ" : "ຜູ້ອະນຸມັດ";

  return (
    <div className="w-full space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-700">ອະນຸມັດຂໍສັ່ງຊື້ອາໄຫຼ່</h1>
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
              placeholder="ຄົ້ນຫາ ເລກທີ, ອ້າງອີງ, SN, ລູກຄ້າ, ຊ່າງ..."
              className="w-full text-xs outline-none"
            />
          </div>
          <button className="h-9 rounded-lg bg-slate-900 px-4 text-xs font-medium text-white">ຄົ້ນຫາ</button>
        </form>
      </div>

      {/* ຕາຕະລາງ */}
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1300px] border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-slate-600">
                {COLUMNS.map((column) => (
                  <SortHeader
                    key={column.key}
                    label={
                      column.key === "doc_no"
                        ? docLabel
                        : column.key === "elapsed"
                          ? timeLabel
                          : column.key === "user_created"
                            ? userLabel
                            : column.label
                    }
                    sortKey={column.key}
                    current={sort}
                    dir={dir}
                    href={sortHref}
                    defaultDir={column.defaultDir}
                    className="py-2.5"
                  />
                ))}
                <th className="whitespace-nowrap px-3 py-2.5 font-semibold">ປະກັນ</th>
                <th className="whitespace-nowrap px-3 py-2.5 font-semibold">ອາການຊ່າງ / ອາການເບື້ອງຕົ້ນ</th>
                {tab === "approved" && (
                  <>
                    <th className="whitespace-nowrap px-3 py-2.5 font-semibold">ເລກທິອ້າງອີງ</th>
                    <th className="whitespace-nowrap px-3 py-2.5 font-semibold">ຜູ້ຂໍ</th>
                  </>
                )}
                <th className="px-3 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {list.rows.map((row) => {
                const tone = elapsedTone(row.elapsed_seconds);
                const urgent = row.status_doc === "ດ່ວນ";
                const inWarranty = row.warranty === "ຮັບປະກັນ";
                return (
                  <tr key={row.doc_no} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="relative whitespace-nowrap px-3 py-2.5 font-bold text-[#0536a9]">
                      <span className={`absolute inset-y-0 left-0 w-1 ${tone.bar}`} aria-hidden />
                      {row.doc_no}
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
                    <td className="whitespace-nowrap px-3 py-2.5">{row.emp_code || "-"}</td>
                    <td className="whitespace-nowrap px-3 py-2.5">
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                          urgent ? "bg-red-50 text-red-700" : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {row.status_doc ?? "-"}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5">{row.user_created || "-"}</td>
                    <td className="whitespace-nowrap px-3 py-2.5">
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                          inWarranty ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {row.warranty ?? "-"}
                      </span>
                    </td>
                    <td className="max-w-64 px-3 py-2.5">
                      <span className="block truncate font-semibold text-red-600" title={row.issue_2 ?? ""}>
                        {row.issue_2 || "-"}
                      </span>
                      <span className="block truncate text-[10px] text-slate-400" title={row.issue ?? ""}>
                        ເບື້ອງຕົ້ນ: {row.issue || "-"}
                      </span>
                    </td>

                    {tab === "approved" && (
                      <>
                        <td className="whitespace-nowrap px-3 py-2.5">{row.doc_ref ?? "-"}</td>
                        <td className="whitespace-nowrap px-3 py-2.5">{row.requester ?? "-"}</td>
                      </>
                    )}

                    <td className="whitespace-nowrap px-3 py-2.5 text-center">
                      {tab === "waiting" ? (
                        <Link
                          href={`/approvals/purchase-requests/${encodeURIComponent(row.doc_no)}`}
                          className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-teal-600 px-3 text-xs font-semibold text-white hover:bg-teal-700"
                        >
                          <FileCheck2 className="size-3.5" />
                          ລາຍລະອຽດ
                          <LinkPending className="size-3" />
                        </Link>
                      ) : (
                        <Link
                          href={`/pr-view/${encodeURIComponent(row.doc_no)}`}
                          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50"
                        >
                          <Eye className="size-3.5" />
                          ເບິ່ງ
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
