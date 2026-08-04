import { employeeNameMap, resolveName } from "@/lib/employee-names";
import { kipPerBaht } from "@/lib/monthly-report";
import { installRevenueBetween, techPayoutByMonth } from "@/lib/service-money";
import { ChevronLeft, ChevronRight, Trophy, Wallet, Wrench } from "lucide-react";
import Link from "next/link";

/**
 * **ລາຍຮັບຊ່າງ — ເບິ່ງເປັນເດືອນ**.
 *
 * ບໍ່ໃຊ້ຕາຕະລາງລາຍງານທົ່ວໄປ (ReportShell) ເພາະຄຳຖາມຂອງຄົນໃຊ້ບໍ່ແມ່ນ "ແຖວຫຍັງແດ່"
 * ແຕ່ແມ່ນ **"ເດືອນນີ້ ໃຜເຮັດໄດ້ເທົ່າໃດ ແລະ ຍັງຄ້າງເກັບເທົ່າໃດ"** ⇒ ໜ້າຈຶ່ງເປັນ
 * ① ເລືອກເດືອນ ② ຍອດລວມ 3 ກ້ອນ ③ ບັນຊີຊ່າງຮຽງຈາກຫຼາຍໄປໜ້ອຍ ພ້ອມແຖບສ່ວນແບ່ງ.
 *
 * ຍອດ = ໃບສະເໜີລາຄາທີ່ລູກຄ້າຮັບແລ້ວ (ic_trans flag 17 · ອະນຸມັດ 1/1) ຂອງໃບງານທີ່ຊ່າງຄົນນັ້ນຖື.
 * ⚠️ "ຮັບແລ້ວ" ມາຈາກ ods_service_payment ທີ່ຫາກໍ່ເລີ່ມບັນທຶກ 17-07-2026 ⇒ ເດືອນເກົ່າຈະເປັນ 0.
 */
export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ month?: string }> };

const MONTH_RE = /^\d{4}-\d{2}$/;

/** ບວກ/ລົບເດືອນ ໂດຍບໍ່ພຶ່ງ Date ໃນຝັ່ງ SQL — ໃຫ້ລິ້ງ ‹ › ຄິດໄດ້ຈາກ string */
function shiftMonth(month: string, step: number) {
  const [year, mon] = month.split("-").map(Number);
  const total = year * 12 + (mon - 1) + step;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}`;
}

const LAO_MONTH = [
  "ມັງກອນ", "ກຸມພາ", "ມີນາ", "ເມສາ", "ພຶດສະພາ", "ມິຖຸນາ",
  "ກໍລະກົດ", "ສິງຫາ", "ກັນຍາ", "ຕຸລາ", "ພະຈິກ", "ທັນວາ",
];

export default async function TechRevenueMonthPage({ searchParams }: Props) {
  const params = await searchParams;
  const today = new Date();
  const current = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  const month = MONTH_RE.test(params.month ?? "") ? params.month! : current;

  // ວັນສຸດທ້າຍຂອງເດືອນ = ວັນທີ 0 ຂອງເດືອນຖັດໄປ
  const [year, mon] = month.split("-").map(Number);
  const from = `${month}-01`;
  const to = `${month}-${String(new Date(year, mon, 0).getDate()).padStart(2, "0")}`;

  let rows: Awaited<ReturnType<typeof techPayoutByMonth>> = [];
  /**
   * **ລາຍຮັບຕິດຕັ້ງ** ບໍ່ໄດ້ຢູ່ຝັ່ງ ODS ເລີຍ — ວັດ 04-08-2026: ໃບງານ INST- ມີແຕ່ເອກະສານ
   * ອາໄຫຼ່ (122/56/166) **ບໍ່ມີບິນຈັກໃບ** ⇒ ຄ່າບໍລິການຕິດຕັ້ງອອກເປັນ **ບິນຂາຍຝັ່ງ ERP**
   * ດ້ວຍລະຫັດບໍລິການ 9701xx (ic_inventory). ໃຊ້ສູດດຽວກັບລາຍງານປະຈຳເດືອນ (lib/monthly-report)
   * ຈຶ່ງບໍ່ຂັດກັນລະຫວ່າງ 2 ໜ້າ.
   */
  let install = { jobs: 0, kip: 0 };
  let error: string | null = null;
  try {
    const [techRows, erpInstall, rate] = await Promise.all([
      techPayoutByMonth(from, to),
      installRevenueBetween(from, to),
      kipPerBaht(),
    ]);
    rows = techRows;
    // ຄ່າຈາກ ERP ເປັນບາດ ⇒ ຄູນອັດຕາໃຫ້ເປັນກີບ ຄືກັບຍອດສ້ອມທັງໜ້າ
    install = { jobs: erpInstall.jobs, kip: Math.round(erpInstall.baht * rate) };
  } catch (exception) {
    error = exception instanceof Error ? exception.message : "ດຶງຂໍ້ມູນບໍ່ສຳເລັດ";
  }

  // ແຫຼ່ງດຽວກັບແອັບ: ods_service_payout ⇒ ມີແຕ່ "ຈ່າຍຈິງ" ບໍ່ມີ ຕົກລົງ/ຄ້າງ
  // ຈັດກຸ່ມຕາມລະຫັດ (ຢ່າງກັບ /commission) ແຕ່ຕອນໂຊ້ **ຕ້ອງເປັນຊື່** — ແປຈາກ odg_employee
  const techNames = await employeeNameMap(rows.map((row) => row.technician));
  const ranked = rows
    .map((row) => ({ ...row, technician: resolveName(row.technician, techNames), quotedNum: row.thb }))
    .sort((a, b) => b.thb - a.thb);
  const top = ranked[0]?.quotedNum ?? 0;
  const totals = {
    jobs: ranked.reduce((sum, row) => sum + row.jobs, 0),
    thb: ranked.reduce((sum, row) => sum + row.thb, 0),
  };

  const monthHref = (value: string) => `/tech-revenue?month=${value}`;

  return (
    <div className="w-full space-y-5 pb-10">
      {/* ── ① ເລືອກເດືອນ ── */}
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="flex items-center gap-2 text-xl font-bold text-slate-700">
          <Wallet className="size-5 text-teal-600" />
          ລາຍຮັບຊ່າງ
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

      {error && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">{error}</p>
      )}

      {/* ── ② ຍອດລວມ ── */}
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { label: "ວຽກທີ່ຕົກລົງ", value: totals.jobs.toLocaleString(), tone: "text-slate-800" },
          { label: "ລາຍຮັບຊ່າງ (ບາດ)", value: totals.thb.toLocaleString(), tone: "text-emerald-700" },
        ].map((card) => (
          <div key={card.label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-[11px] text-slate-400">{card.label}</p>
            <p className={`mt-1 text-2xl font-bold tabular-nums ${card.tone}`}>{card.value}</p>
          </div>
        ))}
      </div>

      {/* ── ③ ລາຍຮັບຕິດຕັ້ງ (ຈາກບິນຂາຍ ERP) ── */}
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 flex flex-wrap items-center gap-2 border-b border-slate-100 pb-2 text-sm font-bold text-slate-700">
          <Wrench className="size-4 text-indigo-600" />
          ລາຍຮັບຈາກການຕິດຕັ້ງ
          <span className="text-[11px] font-medium text-slate-400">
            {install.jobs.toLocaleString()} ໃບງານປິດໃນເດືອນນີ້ · ຄ່າບໍລິການ 9701xx ຈາກບິນ ERP ຂອງໃບງານ
          </span>
          <span className="ml-auto text-lg font-bold tabular-nums text-slate-800">
            {install.kip.toLocaleString()}
          </span>
        </h2>
        <p className="text-[11px] text-slate-400">
          ຜູກຜ່ານ <b>ods_tb_install.doc_ref_1</b> = ເລກບິນຂາຍ ERP ຂອງໃບງານນັ້ນ (ມີຄົບ 100% ຂອງໃບງານ ·
          92% ມີຄ່າບໍລິການ 9701xx). ນັບຕາມວັນປິດງານ · ແປງບາດ→ກີບ ດ້ວຍອັດຕາ tb_bill_rate.
        </p>
      </section>

      {/* ── ④ ບັນຊີຊ່າງ ຮຽງຈາກຫຼາຍໄປໜ້ອຍ ── */}
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-semibold text-slate-600">
          <Trophy className="size-3.5 text-amber-500" />
          ຮຽງຕາມຍອດຕົກລົງ · {ranked.length} ຄົນ
        </div>

        {ranked.length === 0 && !error && (
          <p className="py-12 text-center text-xs text-slate-400">ເດືອນນີ້ຍັງບໍ່ມີໃບສະເໜີລາຄາທີ່ລູກຄ້າຮັບ</p>
        )}

        <ul className="divide-y divide-slate-100">
          {ranked.map((row, index) => (
            <li key={row.technician} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
              <span
                className={`flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                  index === 0 ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-500"
                }`}
              >
                {index + 1}
              </span>
              <div className="min-w-40 flex-1">
                <p className="text-sm font-bold text-slate-700">{row.technician}</p>
                <p className="text-[11px] text-slate-400">{row.jobs.toLocaleString()} ວຽກ</p>
                {/* ແຖບສ່ວນແບ່ງທຽບກັບຄົນສູງສຸດ — ເຫັນຄວາມຕ່າງໄດ້ໂດຍບໍ່ຕ້ອງອ່ານເລກ */}
                <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-teal-500"
                    style={{ width: `${top > 0 ? Math.max(2, (row.quotedNum / top) * 100) : 0}%` }}
                  />
                </div>
              </div>
              <dl className="text-right text-xs tabular-nums">
                <dt className="text-[10px] text-slate-400">ລາຍຮັບ (ບາດ)</dt>
                <dd className="text-base font-bold text-emerald-700">{row.thb.toLocaleString()}</dd>
              </dl>
            </li>
          ))}
        </ul>
      </section>

      <p className="text-[11px] text-slate-400">
        ອ່ານຈາກ <b>ods_service_payout</b> — ແຫຼ່ງດຽວກັບໜ້າ “ລາຍຮັບຂອງຂ້ອຍ” ໃນແອັບ (ແຊ່ໄວ້ຕອນປິດງານ) ⇒ ຕົວເລກຕົງກັນ
      </p>
    </div>
  );
}
