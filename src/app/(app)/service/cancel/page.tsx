import { OUTSTANDING_SUMMARY_SQL, type OutstandingSummary } from "@/lib/outstanding-spares";
import { LinkPending } from "@/components/link-pending";
import { RowLink } from "@/components/row-link";
import { CancelJobButton, UndoCancelButton } from "@/components/service-cancel-buttons";
import { SortHeader, type SortDir } from "@/components/sort-header";
import { query } from "@/lib/db";
import { CANCELLED_JOBS, OPEN_JOBS } from "@/lib/stage";
import { ArrowLeft, ChevronLeft, ChevronRight, PackageCheck, Search } from "lucide-react";
import Link from "next/link";

/**
 * ຄື /ccrcpd (ລາຍການຍົກເລີກ) + /ccrcpdcreat (ເລືອກງານມາຍົກເລີກ) ຂອງ ods.
 *
 * ຕ່າງຈາກເກົ່າ:
 *  - ເກົ່າດຶງລາຍການຍົກເລີກທັງໝົດ (563 ໃບ) ມາໜ້າດຽວ ແລະ ບໍ່ມີຄົ້ນຫາ
 *    → ດຽວນີ້ 2 ແທັບ ພ້ອມ ຄົ້ນຫາ · ຈັດຮຽງ · ແບ່ງໜ້າ ຢູ່ຝັ່ງ server (20 ແຖວ/ໜ້າ)
 *  - ເກົ່າ "ລາຍການໃບຮັບເຄື່ອງ" ຕັດແຂງໄວ້ທີ່ 50 ແຖວ ໂດຍບໍ່ບອກຜູ້ໃຊ້ວ່າມີຕື່ມ → ດຽວນີ້ແບ່ງໜ້າຄົບ
 */
const PAGE_SIZE = 20;

/**
 * ⚠️ ຖອດແທັບ "ໃບຮັບເຄື່ອງ" ອອກ (17-07-2026) — ມັນໃຊ້ `OPEN_JOBS` ຄຳຕໍ່ຄຳ
 * = ກະດານ/ຕາຕະລາງຂອງ `/service` (ເມນູ "1. ລາຍການຮັບສິນຄ້າເຂົ້າສ້ອມ") ທຸກແຖວ.
 * ໜ້ານີ້ມີເຫດຜົນຢູ່ບ່ອນດຽວ: ລາຍການທີ່**ຍົກເລີກແລ້ວ**.
 */
type Tab = "cancelled";
type Props = { searchParams: Promise<{ tab?: string; q?: string; page?: string; sort?: string; dir?: string }> };

type Row = {
  code: string;
  registered: string | null;
  elapsed_seconds: number | null;
  customer: string | null;
  product: string | null;
  sn: string | null;
  brand: string | null;
  warranty: string | null;
  issue: string | null;
  technician: string | null;
  receiver: string | null;
  cancel_start: string | null;
  remark: string | null;
  approved: boolean;
  returned: string | null;
  spares: OutstandingSummary | null;
};

const CUSTOMER = "left join ar_customer b on b.code = a.cust_code";

const SEARCH = `(a.code ilike $Q or a.name_1 ilike $Q or a.sn ilike $Q or a.p_brand ilike $Q or a.p_model ilike $Q
  or a.issue ilike $Q or a.remark ilike $Q or a.emp_code ilike $Q or b.name_1 ilike $Q or b.tel ilike $Q)`;

/** ຖັນທີ່ຈັດຮຽງໄດ້ — whitelist ກັນ SQL injection */
const SORT_SQL: Record<Tab, Record<string, string>> = {
  cancelled: {
    code: "a.code",
    cancelled_at: "a.cancel_start",
    registered: "a.time_register",
    customer: "b.name_1",
    product: "a.name_1",
    brand: "a.p_brand",
  },
};

const COLUMNS: Record<Tab, { key: string; label: string; defaultDir: SortDir }[]> = {
  cancelled: [
    { key: "code", label: "ລະຫັດຮັບເຄື່ອງ", defaultDir: "desc" },
    { key: "cancelled_at", label: "ວັນທີຍົກເລີກ", defaultDir: "desc" },
    { key: "registered", label: "ວັນທີຮັບເຄື່ອງ", defaultDir: "desc" },
    { key: "customer", label: "ລູກຄ້າ", defaultDir: "asc" },
    { key: "product", label: "ຊື່ເຄືອງ / SN", defaultDir: "asc" },
    { key: "brand", label: "ຫຍີ່ຫໍ້", defaultDir: "asc" },
  ],
};

async function getRows(tab: Tab, q: string, page: number, sort: string, dir: SortDir) {
  // ຍົກເລີກແລ້ວ = status 6 · ໃບຮັບເຄື່ອງທີ່ຍັງຍົກເລີກໄດ້ = ວຽກຄ້າງ (ຍັງບໍ່ສົ່ງຄືນ ແລະ ຍັງບໍ່ຍົກເລີກ)
  const where = [tab === "cancelled" ? CANCELLED_JOBS : OPEN_JOBS];
  const params: (string | number)[] = [];
  if (q) {
    params.push(`%${q}%`);
    where.push(SEARCH.replaceAll("$Q", `$${params.length}`));
  }
  const filter = where.join(" and ");

  const map = SORT_SQL[tab];
  const fallback = tab === "cancelled" ? map.cancelled_at : map.registered;
  const column = map[sort] ?? fallback;
  // ຮັບເຄື່ອງມາແລ້ວ / ວັນທີຍົກເລີກ: ໃໝ່ສຸດກ່ອນເປັນຄ່າຕັ້ງຕົ້ນ
  const orderBy = `${column} ${dir} nulls last, a.roworder ${dir}`;

  const rowsSql = `select a.code,
      to_char(a.time_register,'DD-MM-YYYY HH24:MI') registered,
      greatest(0, round(extract(epoch from (localtimestamp - a.time_register))))::int elapsed_seconds,
      concat_ws('-', b.name_1, b.tel) customer, a.name_1 product, a.sn, a.p_brand brand, a.warrunty warranty,
      a.issue, a.emp_code technician, a.user_regis receiver,
      to_char(a.cancel_start,'DD-MM-YYYY HH24:MI') cancel_start, a.remark,
      (a.cancel_finish is not null) approved,
      to_char(a.return_complete,'DD-MM-YYYY HH24:MI') returned,
      ${OUTSTANDING_SUMMARY_SQL} spares
    from tb_product a ${CUSTOMER}
    where ${filter}
    order by ${orderBy}
    limit $${params.length + 1} offset $${params.length + 2}`;

  const countSql = `select count(*)::int total from tb_product a ${CUSTOMER} where ${filter}`;

  const [rows, count] = await Promise.all([
    query<Row>(rowsSql, [...params, PAGE_SIZE, (page - 1) * PAGE_SIZE]),
    query<{ total: number }>(countSql, params),
  ]);
  return { rows: rows.rows, total: count.rows[0]?.total ?? 0 };
}

export default async function CancelService({ searchParams }: Props) {
  const params = await searchParams;
  const tab: Tab = "cancelled";
  const q = (params.q ?? "").trim();
  const page = Math.max(1, Number(params.page) || 1);
  const dir: SortDir = params.dir === "asc" ? "asc" : "desc";
  const sort = (params.sort ?? (tab === "cancelled" ? "cancelled_at" : "registered")).trim();

  const list = await getRows(tab, q, page, sort, dir);
  const pages = Math.max(1, Math.ceil(list.total / PAGE_SIZE));

  const base = () => ({ ...(q && { q }) });
  const sortHref = (key: string, nextDir: SortDir) =>
    `/service/cancel?${new URLSearchParams({ ...base(), sort: key, dir: nextDir })}`;
  const pageHref = (n: number) =>
    `/service/cancel?${new URLSearchParams({ ...base(), sort, dir, ...(n > 1 && { page: String(n) }) })}`;

  return (
    <div className="w-full space-y-4">
      <div>
        <Link href="/service" className="mb-2 inline-flex items-center gap-1.5 text-xs font-medium text-teal-600 hover:underline">
          <ArrowLeft className="size-3.5" />
          ກັບລາຍການຮັບສິນຄ້າເຂົ້າສ້ອມ
          <LinkPending className="size-3" />
        </Link>
        <h1 className="text-xl font-bold text-slate-700">ຍົກເລີກຮັບເຄື່ອງສ້ອມ</h1>
        <p className="mt-0.5 text-xs text-slate-500">
          ລາຍການທີ່ຍົກເລີກແລ້ວ ·{" "}
          {list.total.toLocaleString()} ລາຍການ · ໜ້າ {page}/{pages}
        </p>
      </div>

      {/* ຄົ້ນຫາ */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm">
        <form className="flex flex-1 items-center gap-2">
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

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1250px] border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-slate-600">
                {COLUMNS[tab].map((column) => (
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
                <th className="whitespace-nowrap px-3 py-2.5 font-semibold">ປະກັນ</th>
                <th className="whitespace-nowrap px-3 py-2.5 font-semibold">ອາການເບື້ອງຕົ້ນ</th>
                {tab === "cancelled" && (
                  <>
                    <th className="whitespace-nowrap px-3 py-2.5 font-semibold">ໝາຍເຫດ</th>
                    <th className="whitespace-nowrap px-3 py-2.5 font-semibold">ອາໄຫຼ່ຄ້າງນອກສາງ</th>
                    <th className="whitespace-nowrap px-3 py-2.5 font-semibold">ສະຖານະ</th>
                  </>
                )}
                <th className="px-3 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {list.rows.map((row) => {
                const inWarranty = row.warranty === "ຮັບປະກັນ";
                return (
                  <RowLink key={row.code} href={`/service/${row.code}`} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="relative whitespace-nowrap px-3 py-2.5 font-bold text-[#0536a9]">
                      <Link href={`/service/${row.code}`} className="hover:underline">
                        {row.code}
                      </Link>
                    </td>

                    <td className="whitespace-nowrap px-3 py-2.5">{row.cancel_start ?? "-"}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-slate-500">{row.registered ?? "-"}</td>

                    <td className="max-w-44 truncate px-3 py-2.5" title={row.customer ?? ""}>{row.customer || "-"}</td>
                    <td className="max-w-56 px-3 py-2.5">
                      <span className="block truncate font-medium text-slate-800" title={row.product ?? ""}>
                        {row.product || "-"}
                      </span>
                      <span className="block truncate text-[10px] text-slate-400">{row.sn || "-"}</span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5">{row.brand ?? "-"}</td>


                    <td className="whitespace-nowrap px-3 py-2.5">
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                          inWarranty ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {row.warranty || "-"}
                      </span>
                    </td>
                    <td className="max-w-52 truncate px-3 py-2.5 font-semibold text-red-600" title={row.issue ?? ""}>
                      {row.issue || "-"}
                    </td>

                    {tab === "cancelled" && (
                      <>
                        <td className="max-w-44 truncate px-3 py-2.5 text-slate-600" title={row.remark ?? ""}>
                          {row.remark || "-"}
                        </td>
                        {/* GAP B — ອາໄຫຼ່ທີ່ເບີກອອກແລ້ວ ແຕ່ຍັງບໍ່ໄດ້ສົ່ງຄືນສາງ */}
                        <td className="whitespace-nowrap px-3 py-2.5">
                          {row.spares && row.spares.lines > 0 ? (
                            <Link
                              href={`/approvals/cancellations/${encodeURIComponent(row.code)}`}
                              className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-700 hover:bg-amber-100"
                            >
                              {row.spares.lines} ລາຍການ · {row.spares.units.toLocaleString()} ໜ່ວຍ
                            </Link>
                          ) : (
                            <span className="text-[10px] text-slate-400">-</span>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5">
                          <span
                            className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                              row.returned
                                ? "bg-slate-100 text-slate-600"
                                : row.approved
                                  ? "bg-emerald-50 text-emerald-700"
                                  : "bg-amber-50 text-amber-700"
                            }`}
                          >
                            {row.returned ? "ສົ່ງຄືນລູກຄ້າແລ້ວ" : row.approved ? "ອະນຸມັດເເລ້ວ" : "ລໍຖ້າອະນຸມັດ"}
                          </span>
                        </td>
                      </>
                    )}

                    <td className="whitespace-nowrap px-3 py-2.5">
                      {tab === "cancelled" ? (
                        <>
                          {/* ຖອນຄືນໄດ້ສະເພາະໃບທີ່ຍັງບໍ່ທັນອະນຸມັດ */}
                          {!row.approved && <UndoCancelButton code={row.code} />}
                          {/* GAP A — ອະນຸມັດຍົກເລີກແລ້ວ ແຕ່ເຄື່ອງຍັງຢູ່ນຳເຮົາ → ສົ່ງຄືນລູກຄ້າ */}
                          {row.approved && !row.returned && (
                            <Link
                              href={`/returns/${encodeURIComponent(row.code)}`}
                              className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-teal-600 px-3 text-xs font-semibold text-white hover:bg-teal-700"
                            >
                              <PackageCheck className="size-3.5" />
                              ສົ່ງຄືນລູກຄ້າ
                              <LinkPending className="size-3" />
                            </Link>
                          )}
                        </>
                      ) : (
                        <CancelJobButton code={row.code} />
                      )}
                    </td>
                  </RowLink>
                );
              })}
            </tbody>
          </table>
        </div>

        {list.total === 0 && <p className="py-12 text-center text-xs text-slate-400">ບໍ່ພົບລາຍການ</p>}
      </section>

      {pages > 1 && (
        <nav className="flex items-center justify-between gap-3 text-xs">
          <span className="text-slate-500">
            ສະແດງ {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, list.total)} ຈາກ {list.total.toLocaleString()}
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
            <span className="px-3 font-medium text-slate-700">{page} / {pages}</span>
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
