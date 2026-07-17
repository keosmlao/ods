import { Elapsed } from "@/components/elapsed";
import { LinkPending } from "@/components/link-pending";
import { QuoteRowActions } from "@/components/quotation/quote-row-actions";
import { RowLink } from "@/components/row-link";
import { SortHeader, type SortDir } from "@/components/sort-header";
import { query } from "@/lib/db";
import { elapsedTone } from "@/lib/elapsed-tone";
import { OPEN_JOBS, STAGE_SQL } from "@/lib/stage";
import { ChevronLeft, ChevronRight, Clock, FileCheck2, Files, Loader, Printer, Search } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

/** ຖອດແບບຈາກ ods: qt.py home_qt() + templates/Qutation/home.html (ອອກແບບໃໝ່) */

const PAGE_SIZE = 20;

type Tab = "waiting" | "progress" | "all";
type Props = { searchParams: Promise<{ tab?: string; q?: string; page?: string; sort?: string; dir?: string }> };

type WaitingRow = {
  code: string;
  customer: string | null;
  product: string | null;
  model: string | null;
  sn: string | null;
  brand: string | null;
  warranty: string | null;
  at_time: string | null;
  elapsed_seconds: number | null;
  issue: string | null;
  technician: string | null;
  product_url: string | null;
  /* ໃບສະເໜີລາຄາທີ່ຄ້າງຢູ່ກັບເຄື່ອງໜ່ວຍນີ້ (ປົກກະຕິ = ໃບທີ່ຖືກ "ບໍ່ອະນຸມັດ") */
  quote_doc_no: string | null;
  quote_status: number | null;
  quote_remark: string | null;
  quote_approver: string | null;
};

type QuoteRow = {
  doc_no: string;
  doc_date: string | null;
  customer: string | null;
  product: string | null;
  model: string | null;
  sn: string | null;
  brand: string | null;
  warranty: string | null;
  issue_2: string | null;
  at_time: string | null;
  elapsed_seconds: number | null;
  qt_finish: string | null;
  duration: string | null;
  user_created: string | null;
  status_name: string;
  product_url: string | null;
  /** ຍອດຕາມຫົວບິນ (ຫຼັງສ່ວນຫຼຸດ) — ເກັບຢູ່ ic_trans ແຕ່ລາຍການບໍ່ເຄີຍສະແດງເງິນເລີຍ */
  total_amount: string;
  total_discount: string;
};

/** ຕາຕະລາງປ້າຍສະຖານະ — ຄັດລອກຈາກ home_qt() */
const STATUS_CASE = `case when a.aprove_status=0 and a.aprove_status_2=0 then 'ລໍຖ້າອະນຸມັດ'
    when a.aprove_status=1 and a.aprove_status_2=0 then 'ລໍຖ້າລູກຄ້າອະນຸມັດ'
    when a.aprove_status=1 and a.aprove_status_2=1 then 'ອະນຸມັດເເລ້ວ'
    when a.aprove_status=2 and a.aprove_status_2=0 then 'ບໍ່ອະນຸມັດ'
    when a.aprove_status=1 and a.aprove_status_2=2 then 'ລູກຄ້າບໍ່ອະນຸມັດ'
    else '-' end`;

/**
 * ລໍຖ້າອອກໃບສະເໜີລາຄາ = ຂັ້ນ 3 ຂອງ STAGE_SQL (ເຄື່ອງໝົດປະກັນ ກວດເຊັກຈົບ ແຕ່ຍັງບໍ່ທັນສະເໜີລາຄາ).
 * ods ຂຽນເງື່ອນໄຂນີ້ດ້ວຍມື — ບ່ອນນີ້ອີງໃສ່ຂັ້ນ ຈຶ່ງບໍ່ມີວຽກຕົກຫຼົ່ນ.
 */
const WAITING = `${OPEN_JOBS} and (${STAGE_SQL}) = 3`;

/** ໃບສະເໜີລາຄາ — ic_trans trans_flag 17 */
const QUOTES = "a.trans_flag = 17";
/** ກຳລັງດຳເນີນການ — ອອກໃບແລ້ວ ແຕ່ຍັງບໍ່ທັນອະນຸມັດພາຍໃນ */
const IN_PROGRESS = `${QUOTES} and a.aprove_status = 0`;

const WAIT_SEARCH = `(a.code ilike $Q or a.sn ilike $Q or a.name_1 ilike $Q or a.p_brand ilike $Q
  or a.p_model ilike $Q or a.issue ilike $Q or a.emp_code ilike $Q or b.name_1 ilike $Q or b.tel ilike $Q)`;

const QUOTE_SEARCH = `(a.doc_no ilike $Q or a.user_created ilike $Q or b.name_1 ilike $Q or b.tel ilike $Q
  or c.name_1 ilike $Q or c.sn ilike $Q or c.p_brand ilike $Q or c.p_model ilike $Q or c.issue_2 ilike $Q)`;

/** ຖັນທີ່ຈັດຮຽງໄດ້ — whitelist ກັນ SQL injection */
const WAIT_SORT: Record<string, string> = {
  code: "a.code",
  elapsed: "at_col",
  product: "a.name_1",
  brand: "a.p_brand",
  customer: "b.name_1",
  warranty: "a.warrunty",
  technician: "a.emp_code",
};

const QUOTE_SORT: Record<string, string> = {
  doc_no: "a.doc_no",
  doc_date: "a.doc_date",
  elapsed: "at_col",
  amount: "a.total_amount",
  customer: "b.name_1",
  product: "c.name_1",
  brand: "c.p_brand",
  warranty: "c.warrunty",
  user_created: "a.user_created",
};

const WAIT_TIME = "a.time_register";
const QUOTE_TIME = "c.qt_start";

async function getWaiting(q: string, page: number, sort: string, dir: SortDir) {
  const where = [WAITING];
  const params: (string | number)[] = [];
  if (q) {
    params.push(`%${q}%`);
    where.push(WAIT_SEARCH.replaceAll("$Q", `$${params.length}`));
  }
  const filter = where.join(" and ");

  const column = WAIT_SORT[sort] ?? "at_col";
  // ຄ້າງດົນສຸດກ່ອນ = ເວລາເກົ່າສຸດກ່ອນ ຈຶ່ງກັບທິດໃຫ້
  const orderBy =
    column === "at_col" ? `${WAIT_TIME} ${dir === "desc" ? "asc" : "desc"} nulls last` : `${column} ${dir}`;

  const rowsSql = `select a.code, concat_ws('-', b.name_1, b.tel) customer, a.name_1 product, a.p_model model, a.sn,
      a.p_brand brand, a.warrunty warranty,
      to_char(${WAIT_TIME}, 'DD-MM-YYYY HH24:MI') at_time,
      greatest(0, round(extract(epoch from (localtimestamp - ${WAIT_TIME}))))::int elapsed_seconds,
      a.issue, a.emp_code technician, c.product_url,
      d.doc_no quote_doc_no, d.aprove_status quote_status, d.remark_2 quote_remark, d.approver1 quote_approver
    from tb_product a
    left join ar_customer b on b.code = a.cust_code
    left join product_image c on c.iteme_code = a.code and c.line_number = 0
    left join lateral (
      select t.doc_no, coalesce(t.aprove_status,0)::int aprove_status, t.remark_2, t.approver1
        from ic_trans t
       where t.trans_flag = 17 and t.product_code = a.code and coalesce(t.aprove_status_2,0) = 0
       order by t.doc_no desc limit 1
    ) d on true
    where ${filter}
    order by ${orderBy}
    limit $${params.length + 1} offset $${params.length + 2}`;

  const countSql = `select count(*)::int total from tb_product a
    left join ar_customer b on b.code = a.cust_code where ${filter}`;

  const [rows, count] = await Promise.all([
    query<WaitingRow>(rowsSql, [...params, PAGE_SIZE, (page - 1) * PAGE_SIZE]),
    query<{ total: number }>(countSql, params),
  ]);
  return { rows: rows.rows, total: count.rows[0]?.total ?? 0 };
}

async function getQuotes(bucket: string, q: string, page: number, sort: string, dir: SortDir) {
  const where = [bucket];
  const params: (string | number)[] = [];
  if (q) {
    params.push(`%${q}%`);
    where.push(QUOTE_SEARCH.replaceAll("$Q", `$${params.length}`));
  }
  const filter = where.join(" and ");

  const column = QUOTE_SORT[sort] ?? "a.doc_no";
  const orderBy =
    column === "at_col" ? `${QUOTE_TIME} ${dir === "desc" ? "asc" : "desc"} nulls last` : `${column} ${dir}`;

  const rowsSql = `select a.doc_no, to_char(a.doc_date,'DD-MM-YYYY') doc_date, concat_ws('-', b.name_1, b.tel) customer,
      c.name_1 product, c.p_model model, c.sn, c.p_brand brand, c.warrunty warranty, c.issue_2,
      to_char(${QUOTE_TIME}, 'DD-MM-YYYY HH24:MI') at_time,
      greatest(0, round(extract(epoch from (localtimestamp - ${QUOTE_TIME}))))::int elapsed_seconds,
      to_char(c.qt_finish, 'DD-MM-YYYY HH24:MI') qt_finish,
      (c.qt_finish - c.qt_start)::text duration,
      a.user_created, ${STATUS_CASE} status_name, e.product_url,
      coalesce(a.total_amount,0)::text total_amount, coalesce(a.total_discount,0)::text total_discount
    from ic_trans a
    left join ar_customer b on b.code = a.cust_code
    left join tb_product c on c.code = a.product_code
    left join product_image e on e.iteme_code = c.code and e.line_number = 0
    where ${filter}
    order by ${orderBy}
    limit $${params.length + 1} offset $${params.length + 2}`;

  const countSql = `select count(*)::int total from ic_trans a
    left join ar_customer b on b.code = a.cust_code
    left join tb_product c on c.code = a.product_code
    where ${filter}`;

  const [rows, count] = await Promise.all([
    query<QuoteRow>(rowsSql, [...params, PAGE_SIZE, (page - 1) * PAGE_SIZE]),
    query<{ total: number }>(countSql, params),
  ]);
  return { rows: rows.rows, total: count.rows[0]?.total ?? 0 };
}

/** ນັບຫົວແທັບ — ບໍ່ດຶງແຖວ */
async function getCounts() {
  const [waiting, quotes] = await Promise.all([
    query<{ n: number }>(`select count(*)::int n from tb_product a where ${WAITING}`),
    query<{ progress: number; total_all: number }>(
      `select count(*) filter (where a.aprove_status = 0)::int progress, count(*)::int total_all
       from ic_trans a where ${QUOTES}`,
    ),
  ]);
  return {
    waiting: waiting.rows[0]?.n ?? 0,
    progress: quotes.rows[0]?.progress ?? 0,
    all: quotes.rows[0]?.total_all ?? 0,
  };
}

const WAIT_COLUMNS: { key: string; label: string; defaultDir: SortDir }[] = [
  { key: "code", label: "ເລກທີ", defaultDir: "desc" },
  { key: "elapsed", label: "ເວລາລໍຖ້າ", defaultDir: "desc" },
  { key: "product", label: "ລາຍການ / SN", defaultDir: "asc" },
  { key: "brand", label: "ຫຍີ່ຫໍ້", defaultDir: "asc" },
  { key: "customer", label: "ລູກຄ້າ", defaultDir: "asc" },
  { key: "warranty", label: "ປະກັນ", defaultDir: "asc" },
  { key: "technician", label: "ຊ່າງສ້ອມ", defaultDir: "asc" },
];

const PROGRESS_COLUMNS: { key: string; label: string; defaultDir: SortDir }[] = [
  { key: "doc_no", label: "ໃບສະເໜີລາຄາ", defaultDir: "desc" },
  { key: "doc_date", label: "ວັນທີ", defaultDir: "desc" },
  { key: "elapsed", label: "ເລີ່ມສນຄ / ໄລຍະ", defaultDir: "desc" },
  { key: "amount", label: "ຍອດ (ບາດ)", defaultDir: "desc" },
  { key: "product", label: "ລາຍການ / SN", defaultDir: "asc" },
  { key: "brand", label: "ຫຍີ່ຫໍ້", defaultDir: "asc" },
  { key: "customer", label: "ລູກຄ້າ", defaultDir: "asc" },
  { key: "warranty", label: "ປະກັນ", defaultDir: "asc" },
  { key: "user_created", label: "ຜູ້ອອກບິນ", defaultDir: "asc" },
];

const ALL_COLUMNS: { key: string; label: string; defaultDir: SortDir }[] = [
  { key: "doc_no", label: "ໃບສະເໜີລາຄາ", defaultDir: "desc" },
  { key: "doc_date", label: "ວັນທີ", defaultDir: "desc" },
  { key: "elapsed", label: "ເລີ່ມສນຄ", defaultDir: "desc" },
  { key: "amount", label: "ຍອດ (ບາດ)", defaultDir: "desc" },
  { key: "product", label: "ລາຍການ / SN", defaultDir: "asc" },
  { key: "brand", label: "ຫຍີ່ຫໍ້", defaultDir: "asc" },
  { key: "customer", label: "ລູກຄ້າ", defaultDir: "asc" },
  { key: "warranty", label: "ປະກັນ", defaultDir: "asc" },
  { key: "user_created", label: "ຜູ້ອອກບິນ", defaultDir: "asc" },
];

const money = (v: string | null) => {
  const n = Number(v ?? 0);
  return (Number.isFinite(n) ? n : 0).toLocaleString("en-US", { maximumFractionDigits: 2 });
};

/** ປ້າຍສະຖານະໃບສະເໜີລາຄາ */
const STATUS_TONE: Record<string, string> = {
  ລໍຖ້າອະນຸມັດ: "bg-amber-50 text-amber-700",
  ລໍຖ້າລູກຄ້າອະນຸມັດ: "bg-blue-50 text-blue-700",
  ອະນຸມັດເເລ້ວ: "bg-emerald-50 text-emerald-700",
  ບໍ່ອະນຸມັດ: "bg-red-50 text-red-700",
  ລູກຄ້າບໍ່ອະນຸມັດ: "bg-red-50 text-red-700",
};

function Thumb({ url }: { url: string | null }) {
  if (!url) return <span className="text-[10px] text-slate-400">-</span>;
  return (
    <a
      href={`/api/uploads/${encodeURIComponent(url)}`}
      target="_blank"
      rel="noreferrer"
      className="inline-block overflow-hidden rounded"
    >
      <Image
        src={`/api/uploads/${encodeURIComponent(url)}`}
        alt=""
        width={32}
        height={32}
        unoptimized
        className="size-8 object-cover transition hover:scale-125"
      />
    </a>
  );
}

export default async function QuotationsPage({ searchParams }: Props) {
  const params = await searchParams;
  const tab: Tab = params.tab === "progress" ? "progress" : params.tab === "all" ? "all" : "waiting";
  const q = (params.q ?? "").trim();
  const page = Math.max(1, Number(params.page) || 1);
  const dir: SortDir = params.dir === "asc" ? "asc" : "desc";
  const sort = (params.sort ?? (tab === "all" ? "doc_no" : "elapsed")).trim();

  const [counts, list] = await Promise.all([
    getCounts(),
    tab === "waiting"
      ? getWaiting(q, page, sort, dir)
      : getQuotes(tab === "progress" ? IN_PROGRESS : QUOTES, q, page, sort, dir),
  ]);

  const total = list.total;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const base = () => ({ ...(tab !== "waiting" && { tab }), ...(q && { q }) });
  const tabHref = (target: Tab) =>
    `/quotations?${new URLSearchParams({ ...(target !== "waiting" && { tab: target }), ...(q && { q }) })}`;
  const sortHref = (key: string, nextDir: SortDir) =>
    `/quotations?${new URLSearchParams({ ...base(), sort: key, dir: nextDir })}`;
  const pageHref = (n: number) =>
    `/quotations?${new URLSearchParams({ ...base(), sort, dir, ...(n > 1 && { page: String(n) }) })}`;

  const TABS: { key: Tab; label: string; icon: typeof Clock; count: number }[] = [
    { key: "waiting", label: "ລໍຖ້າອອກໃບສະເໜີລາຄາ", icon: Clock, count: counts.waiting },
    { key: "progress", label: "ກຳລັງດຳເນີນການ", icon: Loader, count: counts.progress },
    { key: "all", label: "ໃບສະເໜີລາຄາ", icon: Files, count: counts.all },
  ];

  const columns = tab === "waiting" ? WAIT_COLUMNS : tab === "progress" ? PROGRESS_COLUMNS : ALL_COLUMNS;
  const waitingRows = tab === "waiting" ? (list.rows as WaitingRow[]) : [];
  const quoteRows = tab === "waiting" ? [] : (list.rows as QuoteRow[]);

  return (
    <div className="w-full space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-700">ໃບສະເໜີລາຄາ</h1>
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
              placeholder="ຄົ້ນຫາ ເລກທີ, SN, ລູກຄ້າ, ຫຍີ່ຫໍ້, ອາການ..."
              className="w-full text-xs outline-none"
            />
          </div>
          <button className="h-9 rounded-lg bg-slate-900 px-4 text-xs font-medium text-white">ຄົ້ນຫາ</button>
        </form>
      </div>

      {/* ຕາຕະລາງ */}
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1200px] border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-slate-600">
                {columns.map((column) => (
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
                <th className="whitespace-nowrap px-3 py-2.5 font-semibold">
                  {tab === "waiting" ? "ອາການເບື້ອງຕົ້ນ" : "ອາການຊ່າງ"}
                </th>
                {tab === "waiting" && <th className="whitespace-nowrap px-3 py-2.5 font-semibold">ໃບສະເໜີລາຄາຄ້າງ</th>}
                {tab === "all" && <th className="whitespace-nowrap px-3 py-2.5 font-semibold">ສະຖານະ</th>}
                {tab !== "all" && <th className="whitespace-nowrap px-3 py-2.5 font-semibold">ຮູບ</th>}
                <th className="px-3 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {waitingRows.map((row) => {
                const tone = elapsedTone(row.elapsed_seconds);
                return (
                  <RowLink key={row.code} href={`/service/${row.code}`} className="border-b border-slate-100 hover:bg-slate-50">
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
                      <span className="block truncate text-[10px] text-slate-400">{row.sn || "-"}</span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5">{row.brand || "-"}</td>
                    <td className="max-w-44 truncate px-3 py-2.5" title={row.customer ?? ""}>
                      {row.customer || "-"}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5">
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
                        {row.warranty || "-"}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5">{row.technician || "-"}</td>
                    <td className="max-w-52 truncate px-3 py-2.5 font-semibold text-red-600" title={row.issue ?? ""}>
                      {row.issue || "-"}
                    </td>

                    {/* ໃບເກົ່າທີ່ຖືກ "ບໍ່ອະນຸມັດ" — ສະແດງເລກທີ ແລະ ເຫດຜົນ ບໍ່ດັ່ງນັ້ນຜູ້ຮັບຜິດຊອບບໍ່ຮູ້ວ່າຕ້ອງແກ້ຫຍັງ */}
                    <td className="max-w-56 px-3 py-2.5">
                      {row.quote_doc_no ? (
                        <>
                          <span className="inline-block rounded bg-red-50 px-1.5 py-0.5 text-[10px] font-semibold text-red-700">
                            {row.quote_status === 2 ? "ບໍ່ອະນຸມັດ" : "ຄ້າງລໍຖ້າອະນຸມັດ"} · {row.quote_doc_no}
                          </span>
                          <span
                            className="mt-0.5 block truncate text-[10px] text-slate-500"
                            title={row.quote_remark ?? ""}
                          >
                            {row.quote_remark?.trim() ? `ເຫດຜົນ: ${row.quote_remark}` : "ບໍ່ໄດ້ລະບຸເຫດຜົນ"}
                            {row.quote_approver ? ` · ${row.quote_approver}` : ""}
                          </span>
                        </>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>

                    <td className="px-3 py-2.5 text-center">
                      <Thumb url={row.product_url} />
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-center">
                      {row.quote_doc_no ? (
                        <QuoteRowActions docNo={row.quote_doc_no} variant="rejected" />
                      ) : (
                        <Link
                          href={`/quotations/new/${encodeURIComponent(row.code)}`}
                          className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-teal-600 px-3 text-xs font-semibold text-white hover:bg-teal-700"
                        >
                          <FileCheck2 className="size-3.5" />
                          ສະເໜີລາຄາ
                          <LinkPending className="size-3" />
                        </Link>
                      )}
                    </td>
                  </RowLink>
                );
              })}

              {quoteRows.map((row) => {
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
                      {tab === "progress" ? (
                        <Elapsed
                          seconds={row.elapsed_seconds}
                          className={`inline-block rounded px-1.5 py-0.5 text-[11px] font-semibold ${tone.chip}`}
                        />
                      ) : (
                        <span className="block text-[11px] text-slate-600">
                          {row.qt_finish ? `ອະນຸມັດ ${row.qt_finish}` : (row.duration ?? "-")}
                        </span>
                      )}
                      <span className="mt-0.5 block text-[10px] text-slate-400">{row.at_time ?? "-"}</span>
                    </td>
                    {/* ຍອດຫຼັງສ່ວນຫຼຸດ — ຕົວເລກທີ່ພິມໃສ່ໃບ ແລະ ທີ່ໃບຮັບເງິນຈະອີງໃສ່ */}
                    <td className="whitespace-nowrap px-3 py-2.5 text-right">
                      <span className="font-bold text-[#e75555]">{money(row.total_amount)}</span>
                      {Number(row.total_discount) > 0 && (
                        <span className="mt-0.5 block text-[10px] text-emerald-700">
                          ສ່ວນຫຼຸດ {money(row.total_discount)}
                        </span>
                      )}
                    </td>
                    <td className="max-w-64 px-3 py-2.5">
                      <span className="block truncate font-medium text-slate-800" title={row.product ?? ""}>
                        {row.product || "-"} {row.model && <span className="text-slate-400">{row.model}</span>}
                      </span>
                      <span className="block truncate text-[10px] text-slate-400">{row.sn || "-"}</span>
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
                    <td className="whitespace-nowrap px-3 py-2.5">{row.user_created || "-"}</td>
                    <td className="max-w-52 truncate px-3 py-2.5 font-semibold text-red-600" title={row.issue_2 ?? ""}>
                      {row.issue_2 || "-"}
                    </td>

                    {tab === "all" && (
                      <td className="whitespace-nowrap px-3 py-2.5">
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                            STATUS_TONE[row.status_name] ?? "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {row.status_name}
                        </span>
                      </td>
                    )}
                    {tab === "progress" && (
                      <td className="px-3 py-2.5 text-center">
                        <Thumb url={row.product_url} />
                      </td>
                    )}

                    <td className="whitespace-nowrap px-3 py-2.5">
                      <div className="flex items-center justify-center gap-3">
                        {tab === "progress" && <QuoteRowActions docNo={row.doc_no} />}
                        <Link
                          href={`/quotations/${encodeURIComponent(row.doc_no)}/print`}
                          target="_blank"
                          title="ພິມໃບສະເໜີລາຄາ"
                          className="inline-block text-[#D35400] hover:opacity-70"
                        >
                          <Printer className="size-4" />
                        </Link>
                      </div>
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
