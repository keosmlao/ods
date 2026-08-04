import { queryOdg } from "@/lib/db";
import { INSTALL_AC_ITEMS, INSTALL_OTHER_ITEMS } from "@/lib/monthly-report";
import { ERP } from "@/lib/stock-constants";
import { ChevronDown, ChevronLeft, ChevronRight, Receipt, Search } from "lucide-react";
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
type Props = { searchParams: Promise<{ q?: string; page?: string; month?: string }> };

const MONTH_RE = /^\d{4}-\d{2}$/;

/** ບວກ/ລົບເດືອນຈາກ string — ໃຫ້ລິ້ງ ‹ › ຄິດໄດ້ໂດຍບໍ່ພຶ່ງ Date ຝັ່ງ SQL */
function shiftMonth(month: string, step: number) {
  const [year, mon] = month.split("-").map(Number);
  const total = year * 12 + (mon - 1) + step;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}`;
}

const LAO_MONTH = [
  "ມັງກອນ", "ກຸມພາ", "ມີນາ", "ເມສາ", "ພຶດສະພາ", "ມິຖຸນາ",
  "ກໍລະກົດ", "ສິງຫາ", "ກັນຍາ", "ຕຸລາ", "ພະຈິກ", "ທັນວາ",
];

/** ກົດແຍກ ແອ/ໄຟຟ້າ ດຽວກັບລາຍງານປະຈຳເດືອນ (lib/monthly-report) — ບໍ່ຊ້ຳກັນແຕ່ລະໜ້າ */
const sqlIn = (set: Set<string>) => [...set].map((code) => `'${code}'`).join(", ");
const AC_IN = sqlIn(INSTALL_AC_ITEMS);
const OTH_IN = sqlIn(INSTALL_OTHER_ITEMS);
/** ລາຍການຕິດຕັ້ງໄຟຟ້າ = 9701xx ທີ່ບໍ່ແມ່ນ ແອ ແລະ ບໍ່ແມ່ນໝວດໂຄງການ/ໄລຍະທາງ */
const APP_CASE = `d.item_code like '9701%' and d.item_code not in (${AC_IN}) and d.item_code not in (${OTH_IN})`;

type Row = {
  doc_no: string;
  doc_date: string | null;
  job: string | null;
  product: string | null;
  customer: string | null;
  items: string | null;
  lines: number;
  amount: number;
  ac: number;
  app: number;
  user_created: string | null;
};

const BATCH = 10;

export default async function ReceiptsPage({ searchParams }: Props) {
  const params = await searchParams;
  const q = (params.q ?? "").trim();
  const page = Math.max(1, Number(params.page) || 1);
  // ກັ່ນເດືອນ (YYYY-MM) — ບໍ່ລະບຸ = ເດືອນນີ້ ຄືກັບ /install-revenue ແລະ /tech-revenue
  const today = new Date();
  const current = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  const month = MONTH_RE.test(params.month ?? "") ? params.month! : current;
  const shown = BATCH * page;

  const [year, mon] = month.split("-").map(Number);

  const args: (string | number)[] = [];
  /**
   * **ສະເພາະຝ່າຍບໍລິການ**: `side_code = '400'` — ຄ່າດຽວກັບ `ERP.SIDE_CODE` ທີ່ລະບົບໃຊ້
   * ຕອນຂຽນເອກະສານເຂົ້າ ERP ຢູ່ແລ້ວ. ວັດ 120 ວັນຫຼ້າສຸດ: 400 = 207 ບິນ (CAHS · CAKS ·
   * INHS · INKS) ສ່ວນ 200 = 23,044 ບິນຂອງຝ່າຍຂາຍ (ລວມ POS2) ⇒ ບໍ່ກັ່ນຈະປົນກັນທັງໝົດ.
   */
  const where = [`t.trans_flag = 44`, `t.side_code = '${ERP.SIDE_CODE}'`];
  if (q) {
    args.push(`%${q}%`);
    where.push(`(t.doc_no ilike $${args.length} or coalesce(t.cust_code,'') ilike $${args.length}
       or coalesce(c.name_1,'') ilike $${args.length} or coalesce(t.remark,'') ilike $${args.length})`);
  }
  args.push(`${month}-01`);
  where.push(`t.doc_date >= $${args.length}::date and t.doc_date < ($${args.length}::date + interval '1 month')`);

  const list = await queryOdg<Row>(
    `select t.doc_no, to_char(t.doc_date,'DD-MM-YYYY') doc_date,
        nullif(t.doc_ref,'') job, nullif(t.remark,'') product, coalesce(nullif(c.name_1,''), nullif(t.cust_code,'')) customer,
        (select string_agg(d.item_name, ' · ' order by d.line_number)
           from ic_trans_detail d where d.doc_no = t.doc_no and d.trans_flag = 44) items,
        (select count(*) from ic_trans_detail d where d.doc_no = t.doc_no and d.trans_flag = 44)::int lines,
        coalesce(t.total_amount,0)::float8 amount,
        (select coalesce(sum(d.sum_amount),0) from ic_trans_detail d
          where d.doc_no = t.doc_no and d.trans_flag = 44 and d.item_code in (${AC_IN}))::float8 ac,
        (select coalesce(sum(d.sum_amount),0) from ic_trans_detail d
          where d.doc_no = t.doc_no and d.trans_flag = 44 and ${APP_CASE})::float8 app,
        nullif(t.department_code,'') user_created
      from ic_trans t
      left join ar_customer c on c.code = t.cust_code
     where ${where.join(" and ")}
     order by t.doc_date desc, t.doc_no desc
     limit $${args.length + 1}`,
    [...args, shown + 1],
  );
  // ດຶງເກີນ 1 ແຖວ ⇒ ຮູ້ວ່າຍັງມີຕໍ່ ໂດຍບໍ່ຕ້ອງ count ທັງຕາຕະລາງ
  const hasMore = list.rows.length > shown;
  const rows = list.rows.slice(0, shown);

  // ສະຫຼຸບ = ທັງເງື່ອນໄຂ (ບໍ່ແມ່ນສະເພາະແຖວທີ່ໂຫຼດມາ) ⇒ ຄົນເຫັນຍອດລວມຈິງຂອງເດືອນ
  const sum = await queryOdg<{ bills: number; baht: number }>(
    `select count(*)::int bills, coalesce(sum(t.total_amount),0)::float8 baht
       from ic_trans t
       left join ar_customer c on c.code = t.cust_code
      where ${where.join(" and ")}`,
    args,
  );
  const totals = sum.rows[0] ?? { bills: 0, baht: 0 };

  // ແຍກ ແອ/ໄຟຟ້າ/ອື່ນໆ ຂອງເດືອນ — ນັບລະດັບ **ລາຍການໃນໃບ** ດ້ວຍກົດດຽວກັບລາຍງານປະຈຳເດືອນ
  const splitSum = await queryOdg<{ ac: number; app: number; rest: number }>(
    `select coalesce(sum(case when d.item_code in (${AC_IN}) then d.sum_amount else 0 end),0)::float8 ac,
        coalesce(sum(case when ${APP_CASE} then d.sum_amount else 0 end),0)::float8 app,
        coalesce(sum(case when d.item_code in (${OTH_IN}) or d.item_code not like '9701%' then d.sum_amount else 0 end),0)::float8 rest
       from ic_trans t
       join ic_trans_detail d on d.doc_no = t.doc_no and d.trans_flag = 44
      where ${where.join(" and ")}`,
    args,
  );
  const split = splitSum.rows[0] ?? { ac: 0, app: 0, rest: 0 };
  const pct = (value: number) => (totals.baht > 0 ? Math.round((value / totals.baht) * 100) : 0);

  const monthHref = (value: string) =>
    `/receipts?${new URLSearchParams({ ...(q && { q }), month: value })}`;

  return (
    <div className="w-full space-y-4 pb-10">
      {/* ຫົວໜ້າ + ເລືອກເດືອນ ‹ › — ວາງແບບດຽວກັບ /install-revenue ແລະ /tech-revenue */}
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="flex items-center gap-2 text-xl font-bold text-slate-700">
          <Receipt className="size-5 text-teal-600" />
          ບິນຂາຍຂອງຝ່າຍບໍລິການ
        </h1>
        <div className="flex items-center gap-1 rounded-xl border border-slate-300 bg-white px-1 py-1">
          <Link
            href={monthHref(shiftMonth(month, -1))}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
            aria-label="ເດືອນກ່ອນ"
          >
            <ChevronLeft className="size-4" />
          </Link>
          <span className="min-w-36 text-center text-sm font-bold text-slate-700">
            {LAO_MONTH[mon - 1]} {year}
          </span>
          <Link
            href={monthHref(shiftMonth(month, 1))}
            aria-disabled={month >= current}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 aria-disabled:pointer-events-none aria-disabled:opacity-30"
            aria-label="ເດືອນຕໍ່ໄປ"
          >
            <ChevronRight className="size-4" />
          </Link>
        </div>
        {month !== current && (
          <Link href={monthHref(current)} className="text-xs font-semibold text-teal-700 hover:underline">
            ກັບເດືອນນີ້
          </Link>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {[
          { label: "ຈຳນວນບິນ", value: totals.bills.toLocaleString(), tone: "text-slate-800" },
          { label: "ລວມ (ບາດ)", value: Math.round(totals.baht).toLocaleString(), tone: "text-emerald-700" },
        ].map((card) => (
          <div key={card.label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-[11px] text-slate-400">{card.label}</p>
            <p className={`mt-1 text-2xl font-bold tabular-nums ${card.tone}`}>{card.value}</p>
          </div>
        ))}
      </div>

      {/* ແຍກ ແອ / ໄຟຟ້າ / ອື່ນໆ — ກົດດຽວກັບໜ້າລາຍຮັບງານຕິດຕັ້ງ */}
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { label: "ຕິດຕັ້ງແອ", value: Math.round(split.ac), tone: "text-teal-700" },
          { label: "ຕິດຕັ້ງເຄື່ອງໃຊ້ໄຟຟ້າ", value: Math.round(split.app), tone: "text-indigo-700" },
          { label: "ອື່ນໆ", value: Math.round(split.rest), tone: "text-slate-600" },
        ].map((card) => (
          <div key={card.label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-[11px] text-slate-400">{card.label}</p>
            <p className={`mt-1 text-2xl font-bold tabular-nums ${card.tone}`}>{card.value.toLocaleString()}</p>
            <p className="text-[10px] text-slate-400">{pct(card.value)}% ຂອງຍອດລວມ</p>
          </div>
        ))}
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
        {/* ເດືອນຍຶດຈາກປຸ່ມ ‹ › ຂ້າງເທິງ — ສົ່ງຕໍ່ໃຫ້ຄົ້ນຫາຢູ່ໃນເດືອນດຽວກັນ */}
        <input type="hidden" name="month" value={month} />
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
                <th className="px-4 py-2.5 font-semibold">ໝວດ</th>
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
                  <td className="whitespace-nowrap px-4 py-2">
                    <KindBadge ac={row.ac} app={row.app} baht={row.amount} />
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
            href={`/receipts?${new URLSearchParams({ ...(q && { q }), month, page: String(page + 1) })}`}
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
        ຍອດເປັນ <b>ບາດ</b> ຕາມທີ່ບັນທຶກໃນ ERP (ຍົກເວັ້ນໃບຕະກູນ HSV ທີ່ປ້ອນເປັນກີບ) ·
        ແຍກ ແອ/ໄຟຟ້າ ຕາມລະຫັດບໍລິການໃນໃບ ກົດດຽວກັບລາຍງານປະຈຳເດືອນ
      </p>
    </div>
  );
}

/**
 * ປ້າຍໝວດຂອງບິນ — ຕັດສິນຈາກສ່ວນ ແອ/ໄຟຟ້າ ຂອງບິນນັ້ນ:
 * ໝວດໃດມີຄ່າສູງສຸດເອົາໝວດນັ້ນ · ຫຼາຍໝວດພໍກັນ = "ປົນ" · ບໍ່ມີທັງສອງ = ອື່ນໆ
 */
function KindBadge({ ac, app, baht }: { ac: number; app: number; baht: number }) {
  const other = Math.max(0, baht - ac - app);
  const entries = [
    { label: "ແອ", value: ac, className: "bg-teal-50 text-teal-700 border-teal-200" },
    { label: "ໄຟຟ້າ", value: app, className: "bg-indigo-50 text-indigo-700 border-indigo-200" },
    { label: "ອື່ນໆ", value: other, className: "bg-slate-100 text-slate-500 border-slate-200" },
  ].filter((entry) => entry.value > 0);
  const top = entries.reduce((best, entry) => (entry.value > best.value ? entry : best), entries[0]);
  if (!top) return <span className="text-slate-300">-</span>;
  const mixed = entries.filter((entry) => Math.abs(entry.value - top.value) < 0.005).length > 1;
  return (
    <span
      className={`inline-flex rounded-md border px-1.5 py-0.5 text-[10px] font-semibold ${mixed ? "bg-amber-50 text-amber-700 border-amber-200" : top.className}`}
    >
      {mixed ? "ປົນ" : top.label}
    </span>
  );
}
