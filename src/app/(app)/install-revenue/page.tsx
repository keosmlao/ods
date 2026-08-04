import { installRevenueBetween, installRevenueDetail } from "@/lib/service-money";
import { ChevronDown, HardHat } from "lucide-react";
import Link from "next/link";

/**
 * **ລາຍຮັບງານຕິດຕັ້ງ** — ນັບຈາກ **ໃບງານຕິດຕັ້ງ** ບໍ່ແມ່ນຈາກບິນລອຍໆ.
 *
 * ຜູກຜ່ານ `ods_tb_install.doc_ref_1` = ເລກບິນຂາຍ ERP ຂອງໃບງານນັ້ນ (ວັດ 04-08-2026:
 * ມີຄົບ 100% ຂອງໃບງານ · join ຕິດ 6,503/6,972 · **6,393 ໃບ (92%) ມີຄ່າບໍລິການ 9701xx**)
 * ⇒ ບອກໄດ້ວ່າເງິນກ້ອນນີ້ມາຈາກໃບງານໃດ ບໍ່ຕ້ອງເດົາຈາກລູກຄ້າ+ວັນທີ.
 *
 * ນັບຕາມ **ວັນປິດງານ** (job_finish). ຍອດເປັນ **ບາດ** ຕາມທີ່ບັນທຶກໃນ ERP (ບໍ່ແປງໜ່ວຍ).
 */
export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ month?: string; page?: string }> };

const BATCH = 20;
const MONTH_RE = /^\d{4}-\d{2}$/;

export default async function InstallRevenuePage({ searchParams }: Props) {
  const params = await searchParams;
  const today = new Date();
  const current = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  const month = MONTH_RE.test(params.month ?? "") ? params.month! : current;
  const page = Math.max(1, Number(params.page) || 1);
  const shown = BATCH * page;

  const [year, mon] = month.split("-").map(Number);
  const from = `${month}-01`;
  const to = `${month}-${String(new Date(year, mon, 0).getDate()).padStart(2, "0")}`;

  let total = { jobs: 0, baht: 0 };
  let rows: Awaited<ReturnType<typeof installRevenueDetail>> = [];
  let error: string | null = null;
  try {
    [total, rows] = await Promise.all([
      installRevenueBetween(from, to),
      installRevenueDetail(from, to, shown + 1),
    ]);
  } catch (exception) {
    error = exception instanceof Error ? exception.message : "ດຶງຂໍ້ມູນບໍ່ສຳເລັດ";
  }
  const hasMore = rows.length > shown;
  const list = rows.slice(0, shown);

  return (
    <div className="w-full space-y-4 pb-10">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="flex items-center gap-2 text-xl font-bold text-slate-700">
          <HardHat className="size-5 text-teal-600" />
          ລາຍຮັບງານຕິດຕັ້ງ
        </h1>
        {/* ກັ່ນເປັນເດືອນ — ສົ່ງດ້ວຍ form ທຳມະດາ ບໍ່ຕ້ອງໃຊ້ client component */}
        <form action="/install-revenue" className="flex items-center gap-2">
          <input
            type="month"
            name="month"
            defaultValue={month}
            className="h-9 rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-700"
          />
          <button type="submit" className="h-9 rounded-xl bg-slate-800 px-4 text-xs font-semibold text-white">
            ເບິ່ງ
          </button>
        </form>
      </div>

      {error && <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">{error}</p>}

      {/* ── ສະຫຼຸບຂອງເດືອນ (ທັງເດືອນ ບໍ່ແມ່ນສະເພາະແຖວທີ່ໂຫຼດ) ── */}
      <div className="grid gap-3 sm:grid-cols-2">
        {[
          { label: "ໃບງານທີ່ປິດ", value: total.jobs.toLocaleString(), tone: "text-slate-800" },
          { label: "ລາຍຮັບ (ບາດ)", value: Math.round(total.baht).toLocaleString(), tone: "text-emerald-700" },
        ].map((card) => (
          <div key={card.label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-[11px] text-slate-400">{card.label}</p>
            <p className={`mt-1 text-2xl font-bold tabular-nums ${card.tone}`}>{card.value}</p>
          </div>
        ))}
      </div>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px] border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-slate-600">
                <th className="px-4 py-2.5 font-semibold">ໃບງານ</th>
                <th className="px-4 py-2.5 font-semibold">ວັນປິດງານ</th>
                <th className="px-4 py-2.5 font-semibold">ລູກຄ້າ</th>
                <th className="px-4 py-2.5 font-semibold">ຊ່າງ</th>
                <th className="px-4 py-2.5 font-semibold">ບິນຂາຍ ERP</th>
                <th className="px-4 py-2.5 font-semibold">ຄ່າບໍລິການ</th>
                <th className="px-4 py-2.5 text-right font-semibold">ບາດ</th>
              </tr>
            </thead>
            <tbody>
              {list.map((row) => (
                <tr key={row.code} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="whitespace-nowrap px-4 py-2">
                    <Link
                      href={`/installations/${encodeURIComponent(row.code)}`}
                      className="font-bold text-blue-700 hover:underline"
                    >
                      {row.code}
                    </Link>
                  </td>
                  <td className="whitespace-nowrap px-4 py-2 text-slate-500">{row.finished ?? "-"}</td>
                  <td className="max-w-56 truncate px-4 py-2 text-slate-700">{row.customer ?? "-"}</td>
                  <td className="whitespace-nowrap px-4 py-2 text-slate-600">{row.tech ?? "-"}</td>
                  <td className="whitespace-nowrap px-4 py-2 font-mono text-[11px] text-slate-500">
                    {row.bill_no ?? "-"}
                  </td>
                  <td className="max-w-72 px-4 py-2 text-slate-600">
                    <span className="block truncate" title={row.items ?? ""}>
                      {row.items ?? "-"}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-2 text-right font-bold tabular-nums text-slate-800">
                    {Math.round(row.baht).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {list.length === 0 && !error && (
          <p className="py-12 text-center text-xs text-slate-400">ເດືອນນີ້ຍັງບໍ່ມີໃບງານຕິດຕັ້ງທີ່ປິດພ້ອມຄ່າບໍລິການ</p>
        )}
      </section>

      {hasMore && (
        <nav className="flex items-center justify-center gap-3 text-xs">
          <Link
            href={`/install-revenue?month=${month}&page=${page + 1}`}
            scroll={false}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2 font-semibold text-slate-700 hover:bg-slate-50"
          >
            <ChevronDown className="size-3.5" />
            ໂຫຼດເພີ່ມ {BATCH} ໃບງານ
          </Link>
          <span className="text-slate-400">ສະແດງ {list.length.toLocaleString()} ຈາກ {total.jobs.toLocaleString()}</span>
        </nav>
      )}

      <p className="text-[11px] text-slate-400">
        ຜູກຜ່ານ <b>ods_tb_install.doc_ref_1</b> = ເລກບິນຂາຍ ERP ຂອງໃບງານ ແລ້ວເອົາສະເພາະລາຍການ
        ຄ່າບໍລິການຕິດຕັ້ງ (ລະຫັດ 9701xx) · ນັບຕາມວັນປິດງານ · ຍອດເປັນບາດ ຕາມທີ່ບັນທຶກໃນ ERP · 1 ບິນທີ່ຄຸມຫຼາຍໃບງານ ນັບຍອດເທື່ອດຽວ
      </p>
    </div>
  );
}
