import { LinkPending } from "@/components/link-pending";
import { NoticeDeleteButton } from "@/components/service/notice-delete-button";
import { SortHeader, type SortDir } from "@/components/sort-header";
import { query } from "@/lib/db";
import { ArrowLeft, ChevronLeft, ChevronRight, ImageIcon, Search } from "lucide-react";
import Link from "next/link";

/**
 * ຄື /cust_reciept ຂອງ ods — ໃບແຈ້ງສ້ອມອອນລາຍທີ່ຍັງບໍ່ທັນຮັບເຂົ້າ.
 *
 * ຕ່າງຈາກເກົ່າ:
 *  - ເກົ່າດຶງທຸກແຖວມາໜ້າດຽວ → ດຽວນີ້ ຄົ້ນຫາ · ຈັດຮຽງ · ແບ່ງໜ້າ ຢູ່ຝັ່ງ server (20 ແຖວ/ໜ້າ)
 *  - ເກົ່າສະແດງຮູບຫຍໍ້ທຸກແຖວ → ແຕ່ລະຮູບຄື 1 request ໄປ /api/uploads (20 ແຖວ = 20 request)
 *    ດຽວນີ້ເປັນລິ້ງ "ເບິ່ງຮູບ" — ໂຫຼດຮູບຕໍ່ເມື່ອກົດເທົ່ານັ້ນ
 */
const PAGE_SIZE = 20;

type Row = {
  code: string;
  noticed: string | null;
  name_1: string | null;
  issue: string | null;
  sn: string | null;
  remark: string | null;
  telephone: string | null;
  creator_name: string | null;
  custname: string | null;
  product_url: string | null;
};

type Props = { searchParams: Promise<{ q?: string; page?: string; sort?: string; dir?: string }> };

/** ໃບແຈ້ງທີ່ຍັງບໍ່ໄດ້ຖືກຮັບເຂົ້າເປັນໃບຮັບເຄື່ອງ */
const PENDING = "a.code not in (select ref_notice from tb_product where ref_notice is not null)";

const SEARCH = `(a.code ilike $Q or a.name_1 ilike $Q or a.sn ilike $Q or a.issue ilike $Q
  or a.remark ilike $Q or a.telephone ilike $Q or a.creator_name ilike $Q or a.p_brand ilike $Q)`;

/** ຖັນທີ່ຈັດຮຽງໄດ້ — whitelist ກັນ SQL injection */
const SORT_SQL: Record<string, string> = {
  code: "a.code",
  noticed: "a.time_notice",
  product: "a.name_1",
  sn: "a.sn",
  creator: "a.creator_name",
  telephone: "a.telephone",
};

const COLUMNS: { key: string; label: string; defaultDir: SortDir }[] = [
  { key: "code", label: "ລະຫັດເເຈ້ງສ້ອມ", defaultDir: "desc" },
  { key: "noticed", label: "ວັນ/ເວລາ", defaultDir: "desc" },
  { key: "creator", label: "ຊື່ຜູ້ເເຈ້ງ", defaultDir: "asc" },
  { key: "telephone", label: "ເບີໂທ", defaultDir: "asc" },
  { key: "product", label: "ຊື່ເຄືອງ", defaultDir: "asc" },
  { key: "sn", label: "SN", defaultDir: "asc" },
];

export default async function ServiceNotices({ searchParams }: Props) {
  const params = await searchParams;
  const q = (params.q ?? "").trim();
  const page = Math.max(1, Number(params.page) || 1);
  const dir: SortDir = params.dir === "asc" ? "asc" : "desc";
  const sort = (params.sort ?? "noticed").trim();

  const where = [PENDING];
  const args: (string | number)[] = [];
  if (q) {
    args.push(`%${q}%`);
    where.push(SEARCH.replaceAll("$Q", `$${args.length}`));
  }
  const filter = where.join(" and ");
  const orderBy = `${SORT_SQL[sort] ?? SORT_SQL.noticed} ${dir} nulls last, a.code ${dir}`;

  const [list, count] = await Promise.all([
    query<Row>(
      `select a.code, to_char(a.time_notice,'dd-mm-yyyy HH24:MI:SS') noticed, a.name_1, a.issue, a.sn, a.remark,
         a.telephone,
         case when a.creator_code is not null then (select name_1 from odg_erp_user where code = a.creator_code)
              else a.creator_name end creator_name,
         (select name_1 from ar_customer where ref_code = a.ref_code limit 1) custname,
         -- ແກ້ບັກ: ເກົ່າ join product_image ໂດຍກົງ — ຖ້າໃບແຈ້ງນຶ່ງມີຫຼາຍຮູບທີ່ line_number = 0
         -- ແຖວຈະຊໍ້າ ແລະ ຈຳນວນທີ່ນັບໄດ້ຈະບໍ່ຕົງກັບແຖວທີ່ສະແດງ
         (select i.product_url from product_image i
           where i.ref_code = a.code and i.line_number = 0 and coalesce(i.product_url,'') <> ''
           order by i.roworder desc limit 1) product_url
       from tb_product_notice a
       where ${filter}
       order by ${orderBy}
       limit $${args.length + 1} offset $${args.length + 2}`,
      [...args, PAGE_SIZE, (page - 1) * PAGE_SIZE],
    ),
    query<{ total: number }>(`select count(*)::int total from tb_product_notice a where ${filter}`, args),
  ]);

  const total = count.rows[0]?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const base = () => ({ ...(q && { q }) });
  const sortHref = (key: string, nextDir: SortDir) =>
    `/service/notices?${new URLSearchParams({ ...base(), sort: key, dir: nextDir })}`;
  const pageHref = (n: number) =>
    `/service/notices?${new URLSearchParams({ ...base(), sort, dir, ...(n > 1 && { page: String(n) }) })}`;

  return (
    <div className="w-full space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/service" className="mb-2 inline-flex items-center gap-1.5 text-xs font-medium text-teal-600 hover:underline">
            <ArrowLeft className="size-3.5" />
            ກັບລາຍການຮັບສິນຄ້າເຂົ້າສ້ອມ
            <LinkPending className="size-3" />
          </Link>
          <h1 className="text-xl font-bold text-slate-700">ລາຍການລູກຄ້າເເຈ້ງສ້ອມ</h1>
          <p className="mt-0.5 text-xs text-slate-500">
            ຍັງບໍ່ໄດ້ຮັບເຂົ້າ {total.toLocaleString()} ລາຍການ · ໜ້າ {page}/{pages}
          </p>
        </div>
      </div>

      <form className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm">
        <input type="hidden" name="sort" value={sort} />
        <input type="hidden" name="dir" value={dir} />
        <div className="flex h-9 min-w-56 flex-1 items-center gap-2 rounded-lg border border-slate-300 px-2.5">
          <Search className="size-3.5 shrink-0 text-slate-400" />
          <input
            name="q"
            defaultValue={q}
            placeholder="ຄົ້ນຫາ ລະຫັດ, ຊື່ເຄື່ອງ, SN, ຜູ້ເເຈ້ງ, ເບີໂທ, ອາການ..."
            className="w-full text-xs outline-none"
          />
        </div>
        <button className="h-9 rounded-lg bg-slate-900 px-4 text-xs font-medium text-white">ຄົ້ນຫາ</button>
      </form>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1200px] border-collapse text-xs">
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
                <th className="whitespace-nowrap px-3 py-2.5 font-semibold">ລູກຄ້າ</th>
                <th className="whitespace-nowrap px-3 py-2.5 font-semibold">ອາການເບື້ອງຕົ້ນ</th>
                <th className="whitespace-nowrap px-3 py-2.5 font-semibold">ໝາຍເຫດ</th>
                <th className="whitespace-nowrap px-3 py-2.5 font-semibold">ຮູບ</th>
                <th className="px-3 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {list.rows.map((row) => (
                <tr key={row.code} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="whitespace-nowrap px-3 py-2.5 font-bold text-[#0536a9]">{row.code}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-slate-500">{row.noticed ?? "-"}</td>
                  <td className="max-w-40 truncate px-3 py-2.5" title={row.creator_name ?? ""}>{row.creator_name || "-"}</td>
                  <td className="whitespace-nowrap px-3 py-2.5">{row.telephone || "-"}</td>
                  <td className="max-w-52 truncate px-3 py-2.5 font-medium text-slate-800" title={row.name_1 ?? ""}>
                    {row.name_1 || "-"}
                  </td>
                  <td className="max-w-40 truncate px-3 py-2.5 text-slate-500" title={row.sn ?? ""}>{row.sn || "-"}</td>
                  <td className="max-w-40 truncate px-3 py-2.5" title={row.custname ?? ""}>{row.custname || "-"}</td>
                  <td className="max-w-56 truncate px-3 py-2.5 font-semibold text-red-600" title={row.issue ?? ""}>
                    {row.issue || "-"}
                  </td>
                  <td className="max-w-40 truncate px-3 py-2.5 text-slate-600" title={row.remark ?? ""}>
                    {row.remark || "-"}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5">
                    {/* ບໍ່ດຶງຮູບຫຍໍ້ຢູ່ນີ້ — ໂຫຼດຕໍ່ເມື່ອກົດ ຈຶ່ງບໍ່ມີ request ຮູບຕໍ່ແຖວ */}
                    {row.product_url ? (
                      <a
                        href={`/api/uploads/${encodeURIComponent(row.product_url)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700 hover:bg-blue-100"
                      >
                        <ImageIcon className="size-3" />
                        ເບິ່ງຮູບ
                      </a>
                    ) : (
                      <span className="text-[10px] text-slate-400">ບໍ່ມີຮູບ</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5">
                    <div className="flex items-center justify-end gap-2">
                      <Link
                        href={`/service/notices/${encodeURIComponent(row.code)}`}
                        className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-xs font-semibold text-white hover:bg-emerald-700"
                      >
                        ເປີດງານ
                        <LinkPending className="size-3" />
                      </Link>
                      {/* ລຶບ**ຄຳແຈ້ງ** (ບໍ່ແມ່ນລຶບງານ — ອັນນັ້ນຍັງຫ້າມ). ຄຳແຈ້ງທີ່ເປີດງານແລ້ວ server ກັນໃຫ້ */}
                      <NoticeDeleteButton code={row.code} />
                    </div>
                  </td>
                </tr>
              ))}
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
