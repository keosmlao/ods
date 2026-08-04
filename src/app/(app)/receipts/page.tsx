import { queryOdg } from "@/lib/db";
import { ChevronDown, Receipt, Search } from "lucide-react";
import Link from "next/link";

/**
 * **ໃບຮັບເງິນ — ອ່ານຈາກ ERP (public.ic_trans / ic_trans_detail · trans_flag 44)**.
 *
 * ⚠️ **ບໍ່ອ່ານຝັ່ງ ODS** — ໃບ SIN ຝັ່ງ ODS ບັນທຶກລາຄາພຽງ 13/3,533 ແຖວ (ວັດ 04-08-2026)
 * ⇒ ຍອດເງິນຈິງຢູ່ ERP. ອ່ານດ້ວຍ `queryOdg` ຈາກ public.ic_trans trans_flag 44 ໂດຍກົງ.
 *
 * ໂຫຼດທີລະ 10 ແລ້ວ "ໂຫຼດເພີ່ມ" — ຕາຕະລາງ ERP ໃຫຍ່ ຈຶ່ງ **ບໍ່ນັບຈຳນວນທັງໝົດ**
 * (count(*) ເຕັມຕາຕະລາງຊ້າ) ⇒ ດຶງເກີນມາ 1 ແຖວ ເພື່ອຮູ້ວ່າ "ຍັງມີຕໍ່ບໍ່".
 */
type Props = { searchParams: Promise<{ q?: string; page?: string }> };

type Row = {
  doc_no: string;
  doc_date: string | null;
  job: string | null;
  product: string | null;
  customer: string | null;
  items: string | null;
  lines: number;
  amount: number;
  user_created: string | null;
};

const BATCH = 10;

export default async function ReceiptsPage({ searchParams }: Props) {
  const params = await searchParams;
  const q = (params.q ?? "").trim();
  const page = Math.max(1, Number(params.page) || 1);
  const shown = BATCH * page;

  const args: (string | number)[] = [];
  const where = ["t.trans_flag = 44"];
  if (q) {
    args.push(`%${q}%`);
    where.push(`(t.doc_no ilike $${args.length} or coalesce(t.cust_code,'') ilike $${args.length}
       or coalesce(t.remark,'') ilike $${args.length})`);
  }

  const list = await queryOdg<Row>(
    `select t.doc_no, to_char(t.doc_date,'DD-MM-YYYY') doc_date,
        nullif(t.doc_ref,'') job, nullif(t.remark,'') product, nullif(t.cust_code,'') customer,
        (select string_agg(d.item_name, ' · ' order by d.line_number)
           from ic_trans_detail d where d.doc_no = t.doc_no and d.trans_flag = 44) items,
        (select count(*) from ic_trans_detail d where d.doc_no = t.doc_no and d.trans_flag = 44)::int lines,
        coalesce(t.total_amount,0)::float8 amount,
        nullif(t.department_code,'') user_created
      from ic_trans t
     where ${where.join(" and ")}
     order by t.doc_date desc, t.doc_no desc
     limit $${args.length + 1}`,
    [...args, shown + 1],
  );
  // ດຶງເກີນ 1 ແຖວ ⇒ ຮູ້ວ່າຍັງມີຕໍ່ ໂດຍບໍ່ຕ້ອງ count ທັງຕາຕະລາງ
  const hasMore = list.rows.length > shown;
  const rows = list.rows.slice(0, shown);

  return (
    <div className="w-full space-y-4 pb-10">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold text-slate-700">
          <Receipt className="size-5 text-teal-600" />
          ບິນຂາຍຂອງຝ່າຍບໍລິການ
        </h1>
        <p className="mt-0.5 text-xs text-slate-500">
          ສະແດງ {rows.length.toLocaleString()} ບິນຫຼ້າສຸດ — ຈາກ ERP (ic_trans · trans_flag 44)
        </p>
      </div>

      <form className="flex flex-wrap items-center gap-2" action="/receipts">
        <label className="flex min-w-64 flex-1 items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2">
          <Search className="size-4 shrink-0 text-slate-400" />
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="ຄົ້ນຫາ ເລກໃບ, ເລກວຽກ, ລູກຄ້າ, ສິນຄ້າ…"
            className="w-full bg-transparent text-sm outline-none"
          />
        </label>
        <button
          type="submit"
          className="inline-flex h-10 items-center rounded-xl bg-slate-800 px-5 text-sm font-semibold text-white hover:bg-slate-900"
        >
          ຄົ້ນຫາ
        </button>
      </form>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-slate-600">
                <th className="px-4 py-2.5 font-semibold">ເລກໃບ</th>
                <th className="px-4 py-2.5 font-semibold">ວັນທີ</th>
                <th className="px-4 py-2.5 font-semibold">ລູກຄ້າ</th>
                <th className="px-4 py-2.5 font-semibold">ລາຍການ</th>
                <th className="px-4 py-2.5 text-right font-semibold">ຍອດ (ບາດ)</th>
                <th className="px-4 py-2.5 font-semibold">ພະແນກ</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.doc_no} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="whitespace-nowrap px-4 py-2 font-mono font-semibold text-slate-700">{row.doc_no}</td>
                  <td className="whitespace-nowrap px-4 py-2 text-slate-500">{row.doc_date ?? "-"}</td>
                  <td className="max-w-56 truncate px-4 py-2 text-slate-600">{row.customer ?? "-"}</td>
                  <td className="max-w-72 px-4 py-2 text-slate-600">
                    {row.items ? (
                      <span className="block truncate" title={row.items}>
                        {row.items}
                      </span>
                    ) : (
                      /* ໃບເປົ່າ 2,222/4,564 ໃບ — ບອກຊື່ໆດີກວ່າປ່ອຍຫວ່າງໃຫ້ຄົນເດົາ */
                      <span className="text-slate-300">ບໍ່ມີລາຍການໃນໃບ</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2 text-right tabular-nums">
                    {row.amount > 0 ? (
                      <b className="text-slate-700">{row.amount.toLocaleString()}</b>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2 text-slate-500">{row.user_created ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {rows.length === 0 && <p className="py-12 text-center text-xs text-slate-400">ບໍ່ພົບໃບຮັບເງິນ</p>}
      </section>

      {hasMore && (
        <nav className="flex items-center justify-center gap-3 text-xs">
          <Link
            href={`/receipts?${new URLSearchParams({ ...(q && { q }), page: String(page + 1) })}`}
            scroll={false}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2 font-semibold text-slate-700 hover:bg-slate-50"
          >
            <ChevronDown className="size-3.5" />
            ໂຫຼດເພີ່ມ {BATCH} ໃບ
          </Link>
          <span className="text-slate-400">ສະແດງ {rows.length.toLocaleString()} ໃບແລ້ວ</span>
        </nav>
      )}

      <p className="text-[11px] text-slate-400">
        ອ່ານຈາກ ERP ໂດຍກົງ (public.ic_trans · trans_flag 44) — ບໍ່ແມ່ນສຳເນົາຝັ່ງ ODS ທີ່ບໍ່ມີລາຄາ.
        ຍອດເປັນ <b>ບາດ</b> ຕາມທີ່ບັນທຶກໃນ ERP (ຍົກເວັ້ນໃບຕະກູນ HSV ທີ່ປ້ອນເປັນກີບ).
      </p>
    </div>
  );
}
