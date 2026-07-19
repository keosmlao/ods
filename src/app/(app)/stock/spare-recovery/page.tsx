import { Elapsed } from "@/components/elapsed";
import { LinkPending } from "@/components/link-pending";
import { RowLink } from "@/components/row-link";
import { SortHeader, type SortDir } from "@/components/sort-header";
import { query } from "@/lib/db";
import { elapsedTone } from "@/lib/elapsed-tone";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getLocale } from "@/lib/i18n/locale";
import { HAS_OUTSTANDING_SPARES, OUTSTANDING_SUMMARY_SQL, type OutstandingSummary } from "@/lib/outstanding-spares";
import { CANCELLED_JOBS } from "@/lib/stage";
import { ChevronLeft, ChevronRight, PackageX, Search } from "lucide-react";
import Link from "next/link";

/**
 * **ອາໄຫຼ່ຄ້າງນອກສາງ** — ອາໄຫຼ່ທີ່ເບີກອອກໄປແລ້ວ ແຕ່ວຽກຖືກຍົກເລີກ ⇒ ຕ້ອງເກັບຄືນສາງ.
 *
 * ── ເປັນຫຍັງແຍກອອກມາເປັນໜ້າຂອງຕົນ (17-07-2026) ──
 * ເມື່ອກ່ອນເປັນ**ແທັບ**ຢູ່ໜ້າ "ອະນຸມັດຍົກເລີກເຄື່ອງສ້ອມ" ເຊິ່ງຜິດ 2 ຢ່າງ:
 *   ① ມັນ**ບໍ່ແມ່ນວຽກອະນຸມັດ** — ມັນຄືວຽກສາງ (ໄປເອົາຂອງຄືນ)
 *   ② `/approvals/*` ເປີດໃຫ້ແຕ່ **ຜູ້ຈັດການ + ຫົວໜ້າຊ່າງ** ⇒ **ຄົນສາງເປີດບໍ່ໄດ້ເລີຍ**
 *      ທັງທີ່ເປັນຄົນທີ່ຕ້ອງລົງມື
 * ⇒ ຍ້າຍມາຢູ່ກຸ່ມສາງ ພ້ອມແກ້ຊື່ "ຄ້າງສາງ" (ຊວນເຂົ້າໃຈຜິດວ່າຢູ່ໃນສາງ) ເປັນ "ຄ້າງນອກສາງ".
 *
 * ບໍ່ຍ້າຍສະຕັອກເອງ — ພາໄປຂັ້ນຕອນເກົ່າ (ໜ້າລາຍລະອຽດ → ຂໍສົ່ງຄືນ → ສາງຮັບເຂົ້າ).
 */
export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

type Props = { searchParams: Promise<{ q?: string; page?: string; sort?: string; dir?: string }> };

type Row = {
  code: string;
  registered: string | null;
  cancel_at: string | null;
  elapsed_seconds: number | null;
  customer: string | null;
  product: string | null;
  model: string | null;
  sn: string | null;
  brand: string | null;
  technician: string | null;
  returned: string | null;
  spares: OutstandingSummary | null;
};

const WHERE = `${CANCELLED_JOBS} and ${HAS_OUTSTANDING_SPARES}`;
const TIME_COL = "coalesce(a.cancel_start, a.time_register)";

const SEARCH = `(a.code ilike $Q or a.sn ilike $Q or a.name_1 ilike $Q or a.p_brand ilike $Q
  or a.p_model ilike $Q or a.emp_code ilike $Q or b.name_1 ilike $Q or b.tel ilike $Q)`;

/** ຖັນທີ່ຈັດຮຽງໄດ້ — whitelist ກັນ SQL injection */
const SORT_SQL: Record<string, string> = {
  code: "a.code",
  elapsed: "at_col",
  product: "a.name_1",
  brand: "a.p_brand",
  customer: "b.name_1",
  technician: "a.emp_code",
};

type Dict = Record<string, string>;

const columns = (t: Dict): { key: string; label: string; defaultDir: SortDir }[] => [
  { key: "code", label: t.colCode, defaultDir: "desc" },
  { key: "elapsed", label: t.colElapsed, defaultDir: "desc" },
  { key: "product", label: t.colProduct, defaultDir: "asc" },
  { key: "brand", label: t.colBrand, defaultDir: "asc" },
  { key: "customer", label: t.colCustomer, defaultDir: "asc" },
  { key: "technician", label: t.colTechnician, defaultDir: "asc" },
];

async function getRows(q: string, page: number, sort: string, dir: SortDir) {
  const where = [WHERE];
  const params: (string | number)[] = [];
  if (q) {
    params.push(`%${q}%`);
    where.push(SEARCH.replaceAll("$Q", `$${params.length}`));
  }
  const filter = where.join(" and ");

  const column = SORT_SQL[sort] ?? "at_col";
  // ຄ້າງດົນສຸດກ່ອນ = ເວລາເກົ່າສຸດກ່ອນ ຈຶ່ງກັບທິດໃຫ້
  const orderBy = column === "at_col" ? `${TIME_COL} ${dir === "desc" ? "asc" : "desc"} nulls last` : `${column} ${dir}`;

  const [rows, count] = await Promise.all([
    query<Row>(
      `select a.code,
          to_char(a.time_register,'DD-MM-YYYY HH24:MI') registered,
          to_char(${TIME_COL},'DD-MM-YYYY HH24:MI') cancel_at,
          greatest(0, round(extract(epoch from (localtimestamp - ${TIME_COL}))))::int elapsed_seconds,
          concat_ws('-', b.name_1, b.tel) customer, a.name_1 product, a.p_model model, a.sn, a.p_brand brand,
          a.emp_code technician,
          to_char(a.return_complete,'DD-MM-YYYY') returned,
          ${OUTSTANDING_SUMMARY_SQL} spares
        from tb_product a
        left join ar_customer b on b.code = a.cust_code
       where ${filter}
       order by ${orderBy}
       limit $${params.length + 1} offset $${params.length + 2}`,
      [...params, PAGE_SIZE, (page - 1) * PAGE_SIZE],
    ),
    query<{ total: number; lines: number; units: number }>(
      `select count(*)::int total,
          coalesce(sum((${OUTSTANDING_SUMMARY_SQL}->>'lines')::int),0)::int lines,
          coalesce(sum((${OUTSTANDING_SUMMARY_SQL}->>'units')::float),0)::int units
        from tb_product a
        left join ar_customer b on b.code = a.cust_code where ${filter}`,
      params,
    ),
  ]);
  return { rows: rows.rows, ...(count.rows[0] ?? { total: 0, lines: 0, units: 0 }) };
}

export default async function SpareRecoveryPage({ searchParams }: Props) {
  const t = (await getDictionary(await getLocale())).spareRecovery;

  const params = await searchParams;
  const q = (params.q ?? "").trim();
  const page = Math.max(1, Number(params.page) || 1);
  const dir: SortDir = params.dir === "asc" ? "asc" : "desc";
  const sort = (params.sort ?? "elapsed").trim();

  const list = await getRows(q, page, sort, dir);
  const pages = Math.max(1, Math.ceil(list.total / PAGE_SIZE));

  const base = () => ({ ...(q && { q }) });
  const sortHref = (key: string, nextDir: SortDir) =>
    `/stock/spare-recovery?${new URLSearchParams({ ...base(), sort: key, dir: nextDir })}`;
  const pageHref = (n: number) =>
    `/stock/spare-recovery?${new URLSearchParams({ ...base(), sort, dir, ...(n > 1 && { page: String(n) }) })}`;

  return (
    <div className="w-full space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-700">{t.title}</h1>
        <p className="mt-0.5 text-xs text-slate-500">{t.subtitle}</p>
      </div>

      {/* ຍອດລວມ — ນີ້ຄື "ໜີ້ອາໄຫຼ່" ທັງໝົດ */}
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { label: t.statReceipts, value: list.total.toLocaleString() },
          { label: t.statSpareLines, value: list.lines.toLocaleString() },
          { label: t.statUnits, value: list.units.toLocaleString() },
        ].map((item) => (
          <div key={item.label} className="rounded-xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-xs text-amber-700">{item.label}</p>
            <p className="mt-1 text-xl font-bold tabular-nums text-amber-800">{item.value}</p>
          </div>
        ))}
      </div>

      <form className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm">
        <input type="hidden" name="sort" value={sort} />
        <input type="hidden" name="dir" value={dir} />
        <div className="flex h-9 min-w-56 flex-1 items-center gap-2 rounded-lg border border-slate-300 px-2.5">
          <Search className="size-3.5 shrink-0 text-slate-400" />
          <input
            name="q"
            defaultValue={q}
            placeholder={t.searchPlaceholder}
            className="w-full text-xs outline-none"
          />
        </div>
        <button className="h-9 rounded-lg bg-slate-900 px-4 text-xs font-medium text-white">{t.search}</button>
      </form>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-slate-600">
                {columns(t).map((column) => (
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
                <th className="whitespace-nowrap px-3 py-2.5 font-semibold">{t.colToRecover}</th>
                <th className="whitespace-nowrap px-3 py-2.5 font-semibold">{t.colReturnedToCustomer}</th>
                <th className="px-3 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {list.rows.map((row) => {
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
                      <span className="mt-0.5 block text-[10px] text-slate-400">{row.cancel_at ?? "-"}</span>
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
                    <td className="whitespace-nowrap px-3 py-2.5">{row.technician || "-"}</td>
                    <td className="whitespace-nowrap px-3 py-2.5">
                      <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">
                        {row.spares?.lines ?? 0} {t.lines} · {(row.spares?.units ?? 0).toLocaleString()} {t.units}
                      </span>
                      <span className="mt-0.5 block text-[10px] text-slate-400">
                        {row.spares?.docs ?? 0} {t.issueSlips}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5">
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                          row.returned ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {row.returned ?? t.notReturned}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-center">
                      {/* ປຸ່ມຂໍສົ່ງຄືນຢູ່ໜ້າລາຍລະອຽດ (ຂັ້ນຕອນເກົ່າ) — ໜ້ານີ້ບໍ່ຍ້າຍສະຕັອກເອງ */}
                      <Link
                        href={`/stock/spare-recovery/${encodeURIComponent(row.code)}`}
                        className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-amber-600 px-3 text-xs font-semibold text-white hover:bg-amber-700"
                      >
                        <PackageX className="size-3.5" />
                        {t.manageSpares}
                        <LinkPending className="size-3" />
                      </Link>
                    </td>
                  </RowLink>
                );
              })}
            </tbody>
          </table>
        </div>
        {list.total === 0 && (
          <p className="py-12 text-center text-xs text-slate-400">
            <PackageX className="mx-auto mb-2 size-6 text-slate-300" />
            {t.empty}
          </p>
        )}
      </section>

      {pages > 1 && (
        <nav className="flex items-center justify-between gap-3 text-xs">
          <span className="text-slate-500">
            {t.showing} {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, list.total)} {t.of}{" "}
            {list.total.toLocaleString()}
          </span>
          <div className="flex items-center gap-1">
            <Link
              href={pageHref(page - 1)}
              aria-disabled={page === 1}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 hover:bg-slate-50 aria-disabled:pointer-events-none aria-disabled:opacity-40"
            >
              <ChevronLeft className="size-3.5" />
              {t.prev}
            </Link>
            <span className="px-3 font-medium text-slate-700">
              {page} / {pages}
            </span>
            <Link
              href={pageHref(page + 1)}
              aria-disabled={page >= pages}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 hover:bg-slate-50 aria-disabled:pointer-events-none aria-disabled:opacity-40"
            >
              {t.next}
              <ChevronRight className="size-3.5" />
            </Link>
          </div>
        </nav>
      )}
    </div>
  );
}
