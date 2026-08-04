import { BackLink } from "@/components/back-link";
import { query } from "@/lib/db";
import { ChevronDown, Receipt, Search } from "lucide-react";
import Link from "next/link";

/**
 * **ໃບຮັບເງິນຂອງພະແນກບໍລິການ (SIN · trans_flag 44)**.
 *
 * ── ວັດຂໍ້ມູນຈິງ 04-08-2026 ກ່ອນອອກແບບ ──
 * ໃບຮັບເງິນ **4,564 ໃບ** (13-06-2023 → 03-08-2026) ທຸກໃບຜູກກັບໃບງານ (product_code).
 * ແຕ່ຍອດເງິນ **ເກືອບບໍ່ໄດ້ບັນທຶກໄວ້ໃນ ODS**:
 *   ແຖວລາຍການ 3,533 ແຖວ ມີລາຄາພຽງ **13 ແຖວ** (ລວມ 16,900 ກີບ)
 *   ໃບທີ່ມີແຖວລາຍການ 2,342/4,564 ໃບ — ທີ່ເຫຼືອອອກໃບເປົ່າ
 * ⇒ ໜ້ານີ້ຈຶ່ງ **ບໍ່ເອົາຍອດເງິນເປັນຫຼັກ** (ຈະໂຊ້ວ 0 ເກືອບໝົດ ແລ້ວຄົນເຂົ້າໃຈຜິດວ່າບໍ່ໄດ້ເກັບເງິນ);
 * ໂຊ້ວຍອດສະເພາະໃບທີ່ມີຈິງ. ຍອດເງິນແທ້ຢູ່ຝັ່ງ SML (ເບິ່ງ docs/sml-receipt-sync-gap).
 *
 * ໂຫຼດທີລະ 10 ແລ້ວ "ໂຫຼດເພີ່ມ" (ຄືໜ້າ /returns/completed) — 4,564 ແຖວ ບໍ່ຄວນດຶງໝົດ.
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
    where.push(
      `(t.doc_no ilike $${args.length} or t.product_code ilike $${args.length}
        or coalesce(c.name_1,'') ilike $${args.length} or coalesce(a.name_1,'') ilike $${args.length})`,
    );
  }
  const filter = where.join(" and ");

  const [list, count] = await Promise.all([
    query<Row>(
      `select t.doc_no, to_char(t.doc_date,'DD-MM-YYYY') doc_date,
          t.product_code job, a.name_1 product, c.name_1 customer,
          (select string_agg(d.item_name, ' · ' order by d.roworder)
             from ic_trans_detail d where d.doc_no = t.doc_no) items,
          (select count(*) from ic_trans_detail d where d.doc_no = t.doc_no)::int lines,
          (select coalesce(sum(d.sum_amount),0) from ic_trans_detail d where d.doc_no = t.doc_no)::float8 amount,
          nullif(t.user_created,'') user_created
        from ic_trans t
        left join tb_product a on a.code = t.product_code
        left join ar_customer c on c.code = t.cust_code
       where ${filter}
       order by t.doc_date desc, t.doc_no desc
       limit $${args.length + 1}`,
      [...args, shown],
    ),
    query<{ total: number }>(
      `select count(*)::int total from ic_trans t
        left join tb_product a on a.code = t.product_code
        left join ar_customer c on c.code = t.cust_code
       where ${filter}`,
      args,
    ),
  ]);
  const rows = list.rows;
  const total = count.rows[0]?.total ?? 0;

  return (
    <div className="w-full space-y-4 pb-10">
      <div>
        <BackLink fallback="/returns/completed" label="ກັບລາຍການ" />
        <h1 className="flex items-center gap-2 text-xl font-bold text-slate-700">
          <Receipt className="size-5 text-teal-600" />
          ໃບຮັບເງິນ
        </h1>
        <p className="mt-0.5 text-xs text-slate-500">
          {total.toLocaleString()} ໃບ · ສະແດງ {rows.length.toLocaleString()} — ໃບຮັບເງິນຂອງພະແນກບໍລິການ (SIN)
        </p>
      </div>

      <form className="flex flex-wrap items-center gap-2" action="/returns/receipts">
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
                <th className="px-4 py-2.5 font-semibold">ເລກວຽກ</th>
                <th className="px-4 py-2.5 font-semibold">ລູກຄ້າ</th>
                <th className="px-4 py-2.5 font-semibold">ລາຍການ</th>
                <th className="px-4 py-2.5 text-right font-semibold">ຍອດ (ກີບ)</th>
                <th className="px-4 py-2.5 font-semibold">ຜູ້ອອກ</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.doc_no} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="whitespace-nowrap px-4 py-2 font-mono font-semibold text-slate-700">{row.doc_no}</td>
                  <td className="whitespace-nowrap px-4 py-2 text-slate-500">{row.doc_date ?? "-"}</td>
                  <td className="whitespace-nowrap px-4 py-2">
                    {row.job ? (
                      <Link href={`/service/${encodeURIComponent(row.job)}`} className="font-bold text-blue-700 hover:underline">
                        {row.job}
                      </Link>
                    ) : (
                      "-"
                    )}
                    {row.product && <span className="ml-1.5 text-[10px] text-slate-400">{row.product}</span>}
                  </td>
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
        {total === 0 && <p className="py-12 text-center text-xs text-slate-400">ບໍ່ພົບໃບຮັບເງິນ</p>}
      </section>

      {rows.length < total && (
        <nav className="flex items-center justify-center gap-3 text-xs">
          <Link
            href={`/returns/receipts?${new URLSearchParams({ ...(q && { q }), page: String(page + 1) })}`}
            scroll={false}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2 font-semibold text-slate-700 hover:bg-slate-50"
          >
            <ChevronDown className="size-3.5" />
            ໂຫຼດເພີ່ມ {Math.min(BATCH, total - rows.length)} ໃບ
          </Link>
          <span className="text-slate-400">
            ສະແດງ {rows.length.toLocaleString()} ຈາກ {total.toLocaleString()}
          </span>
        </nav>
      )}

      <p className="text-[11px] text-slate-400">
        ⚠️ ຍອດເງິນໃນ ODS ບັນທຶກໄວ້ພຽງ 13 ແຖວຈາກ 3,533 ແຖວ — ຍອດແທ້ຢູ່ຝັ່ງ SML. ຖັນ “ຍອດ” ຈຶ່ງໂຊ້ວສະເພາະໃບທີ່ມີຈິງ.
      </p>
    </div>
  );
}
