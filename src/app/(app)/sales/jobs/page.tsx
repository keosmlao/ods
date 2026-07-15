import { PageTitle, Table, Empty } from "@/components/ui";
import { getSession } from "@/lib/auth";
import { query } from "@/lib/db";
import { salesZonesFor, zoneWhere } from "@/lib/sales-zone";
import { DONE_JOBS, OPEN_JOBS, STAGE_LABEL_SQL, STAGE_SQL } from "@/lib/stage";
import { redirect } from "next/navigation";
import Link from "next/link";

/**
 * ຕິດຕາມງານສ້ອມ **ຕາມເຂດຮັບຜິດຊອບ** ຂອງພະນັກງານຂາຍ — ອ່ານຢ່າງດຽວ.
 * ກອງດ້ວຍ ar_customer.provine/city ຕາມ ods_sales_zone (ເບິ່ງ lib/sales-zone).
 * ບໍ່ມີເຂດ = ເຫັນ 0 ລາຍການ (ບໍ່ແມ່ນເຫັນໝົດ).
 */
export const dynamic = "force-dynamic";
const PAGE_SIZE = 20;

type Row = {
  code: string;
  name_1: string | null;
  sn: string | null;
  p_brand: string | null;
  custname: string;
  tel: string;
  province: string;
  city: string;
  opened: string;
  stage_label: string;
  stage: number;
};

type Props = { searchParams: Promise<{ q?: string; tab?: string; page?: string }> };

export default async function SalesJobsPage({ searchParams }: Props) {
  const session = await getSession();
  if (!session) redirect("/login");

  const params = await searchParams;
  const q = (params.q ?? "").trim();
  const done = params.tab === "done";
  const page = Math.max(1, Number(params.page) || 1);

  const zones = await salesZonesFor(session);
  const zone = zoneWhere(zones, "b", 0);

  const where: string[] = [done ? DONE_JOBS : OPEN_JOBS, zone.sql];
  const args: (string | number)[] = [...zone.params];
  if (q) {
    args.push(`%${q}%`);
    where.push(
      `(a.code ilike $${args.length} or a.name_1 ilike $${args.length} or a.sn ilike $${args.length} or b.name_1 ilike $${args.length})`,
    );
  }
  const filter = where.join(" and ");

  const [list, count] = await Promise.all([
    query<Row>(
      `select a.code, a.name_1, a.sn, a.p_brand,
         coalesce(b.name_1,'') custname, coalesce(b.tel,'') tel,
         coalesce(p.name_1,'') province, coalesce(c.name_1,'') city,
         coalesce(to_char(a.time_register,'dd-mm-yyyy'),'') opened,
         (${STAGE_LABEL_SQL}) stage_label, (${STAGE_SQL}) stage
       from tb_product a
       join ar_customer b on b.code = a.cust_code
       left join province p on p.code = b.provine
       left join city c on c.code = b.city and c.province = b.provine
       where ${filter}
       order by a.time_register desc nulls last, a.code desc
       limit $${args.length + 1} offset $${args.length + 2}`,
      [...args, PAGE_SIZE, (page - 1) * PAGE_SIZE],
    ),
    query<{ total: number }>(`select count(*)::int total from tb_product a join ar_customer b on b.code = a.cust_code where ${filter}`, args),
  ]);

  const total = count.rows[0]?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const tabHref = (tab: string) => `/sales/jobs?${new URLSearchParams({ ...(q && { q }), ...(tab !== "open" && { tab }) })}`;
  const pageHref = (n: number) =>
    `/sales/jobs?${new URLSearchParams({ ...(q && { q }), ...(done && { tab: "done" }), ...(n > 1 && { page: String(n) }) })}`;

  return (
    <div className="w-full space-y-4">
      <PageTitle sub="ງານສ້ອມຂອງລູກຄ້າ ໃນເຂດຮັບຜິດຊອບຂອງທ່ານ">ຕິດຕາມງານສ້ອມ</PageTitle>

      {zones.length === 0 && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
          ທ່ານຍັງບໍ່ໄດ້ຮັບມອບເຂດຮັບຜິດຊອບ — ຕິດຕໍ່ຜູ້ຈັດການໃຫ້ກຳນົດເຂດຢູ່ໜ້າ “ຈັດການເຂດຂາຍ”.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <form className="flex flex-1 gap-2" action="/sales/jobs">
          {done && <input type="hidden" name="tab" value="done" />}
          <input
            name="q"
            defaultValue={q}
            placeholder="ຄົ້ນຫາ ລະຫັດ / ຊື່ເຄື່ອງ / SN / ລູກຄ້າ"
            className="h-10 w-full max-w-md rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-teal-500"
          />
          <button className="h-10 rounded-lg bg-teal-600 px-4 text-sm font-semibold text-white hover:bg-teal-700">ຄົ້ນຫາ</button>
        </form>
        <div className="flex gap-1 rounded-lg bg-slate-100 p-1 text-sm">
          <Link href={tabHref("open")} className={`rounded px-3 py-1.5 font-medium ${!done ? "bg-white text-slate-700 shadow-sm" : "text-slate-500"}`}>
            ກຳລັງດຳເນີນ
          </Link>
          <Link href={tabHref("done")} className={`rounded px-3 py-1.5 font-medium ${done ? "bg-white text-slate-700 shadow-sm" : "text-slate-500"}`}>
            ສຳເລັດແລ້ວ
          </Link>
        </div>
      </div>

      {list.rows.length === 0 ? (
        <Empty>ບໍ່ພົບງານໃນເຂດຂອງທ່ານ</Empty>
      ) : (
        <Table head={["ລະຫັດ", "ລູກຄ້າ", "ເບີໂທ", "ເຄື່ອງ", "ເຂດ", "ຮັບເມື່ອ", "ສະຖານະ", ""]} minWidth={900}>
          {list.rows.map((row) => (
            <tr key={row.code} className="border-b border-slate-100 text-center hover:bg-slate-50">
              <td className="px-3 py-2 font-semibold text-[#0536a9]">{row.code}</td>
              <td className="px-3 py-2 text-left">{row.custname || "-"}</td>
              <td className="px-3 py-2">{row.tel || "-"}</td>
              <td className="px-3 py-2 text-left">{[row.name_1, row.p_brand].filter(Boolean).join(" · ") || "-"}</td>
              <td className="px-3 py-2 text-xs text-slate-500">{[row.city, row.province].filter(Boolean).join(", ") || "-"}</td>
              <td className="px-3 py-2 text-xs">{row.opened || "-"}</td>
              <td className="px-3 py-2">
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">{row.stage_label}</span>
              </td>
              <td className="px-3 py-2">
                <Link href={`/service/${row.code}`} className="text-xs font-medium text-teal-600 hover:underline">
                  ເບິ່ງ
                </Link>
              </td>
            </tr>
          ))}
        </Table>
      )}

      {pages > 1 && (
        <div className="flex items-center justify-center gap-2 text-sm">
          {page > 1 && <Link href={pageHref(page - 1)} className="rounded-lg border border-slate-300 px-3 py-1.5 hover:bg-slate-50">ກ່ອນໜ້າ</Link>}
          <span className="text-slate-500">ໜ້າ {page} / {pages} · {total} ລາຍການ</span>
          {page < pages && <Link href={pageHref(page + 1)} className="rounded-lg border border-slate-300 px-3 py-1.5 hover:bg-slate-50">ຕໍ່ໄປ</Link>}
        </div>
      )}
    </div>
  );
}
