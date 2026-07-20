import { Elapsed } from "@/components/elapsed";
import { getSession } from "@/lib/auth";
import { elapsedTone } from "@/lib/elapsed-tone";
import { APPROVER_SIDE, roleOf } from "@/lib/roles";
import { stockCountReport } from "@/lib/stock-count";
import { Check, CircleAlert, FileBarChart, ScanLine } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

/**
 * **ລາຍງານຜົນການກວດນັບສະຕັອກ** — pending ທັງໝົດ ພ້ອມສະຖານະ ນັບແລ້ວ/ຍັງບໍ່ນັບ (ຈາກ ods_stock_count).
 * ຍັງບໍ່ນັບ = ບໍ່ພົບຕົວ (ຄວນຕິດຕາມ). ອອກລາຍງານກ່ອນ "ລ້າງການນັບ" ຮອບໃໝ່.
 */
export const dynamic = "force-dynamic";

export default async function StockCountReportPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!APPROVER_SIDE.includes(roleOf(session))) redirect("/forbidden");

  const rows = await stockCountReport();
  const total = rows.length;
  const counted = rows.filter((r) => r.counted_at).length;
  const notCounted = total - counted;

  const stat = (label: string, value: number, tone: string) => (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <p className={`text-2xl font-black tabular-nums ${tone}`}>{value.toLocaleString()}</p>
      <p className="mt-0.5 text-[11px] font-semibold text-slate-500">{label}</p>
    </div>
  );

  return (
    <div className="w-full space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="flex items-center gap-2 text-lg font-bold text-slate-700">
          <FileBarChart className="size-5 text-teal-600" />
          ລາຍງານຜົນການກວດນັບສະຕັອກ
        </h1>
        <Link
          href="/service/stock-count"
          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 hover:bg-slate-50"
        >
          <ScanLine className="size-4 text-teal-600" />
          ໄປໜ້າກວດນັບ
        </Link>
      </div>

      <div className="grid grid-cols-3 gap-2 sm:max-w-md">
        {stat("ທັງໝົດ (pending)", total, "text-slate-800")}
        {stat("ນັບແລ້ວ", counted, "text-emerald-600")}
        {stat("ຍັງບໍ່ນັບ", notCounted, "text-rose-600")}
      </div>

      {total === 0 ? (
        <p className="py-16 text-center text-sm text-slate-400">ບໍ່ມີເຄື່ອງ pending</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full min-w-[820px] border-collapse text-[11px] leading-tight">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-[10px] uppercase tracking-wide text-slate-500">
                <th className="px-2 py-1.5 font-semibold">ສະຖານະ</th>
                <th className="px-2 py-1.5 font-semibold">ເລກງານ</th>
                <th className="px-2 py-1.5 font-semibold">ສິນຄ້າ / SN</th>
                <th className="px-2 py-1.5 font-semibold">ຍີ່ຫໍ້</th>
                <th className="px-2 py-1.5 font-semibold">ລູກຄ້າ</th>
                <th className="px-2 py-1.5 font-semibold">ບໍລິການ</th>
                <th className="px-2 py-1.5 font-semibold">ຂັ້ນ</th>
                <th className="px-2 py-1.5 font-semibold">ນັບເມື່ອ / ໂດຍ</th>
                <th className="px-2 py-1.5 font-semibold">ຄ້າງ</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const done = Boolean(row.counted_at);
                const tone = elapsedTone(row.elapsed_seconds);
                return (
                  <tr key={row.code} className={`border-b border-slate-100 ${done ? "" : "bg-rose-50/50"}`}>
                    <td className="px-2 py-1">
                      {done ? (
                        <span className="inline-flex items-center gap-1 rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700">
                          <Check className="size-3" /> ນັບແລ້ວ
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded bg-rose-50 px-1.5 py-0.5 text-[10px] font-bold text-rose-600">
                          <CircleAlert className="size-3" /> ຍັງບໍ່ນັບ
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-2 py-1 font-bold text-[#0536a9]">{row.code}</td>
                    <td className="max-w-72 px-2 py-1">
                      <span className="block truncate font-medium text-slate-800" title={row.product ?? ""}>{row.product || "-"}</span>
                      <span className="block truncate text-[10px] text-slate-400">{row.sn || "-"}</span>
                    </td>
                    <td className="whitespace-nowrap px-2 py-1">{row.brand || "-"}</td>
                    <td className="max-w-48 truncate px-2 py-1" title={row.customer ?? ""}>{row.customer || "-"}</td>
                    <td className="whitespace-nowrap px-2 py-1">
                      {row.service_type ? (
                        <span className="inline-flex items-center gap-1 rounded bg-sky-50 px-1.5 py-0.5 text-[10px] font-semibold text-sky-700">
                          <b>{row.service_type}</b>
                        </span>
                      ) : (
                        <span className="text-slate-300">-</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-2 py-1">
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">{row.stage_label}</span>
                    </td>
                    <td className="whitespace-nowrap px-2 py-1 text-slate-600">
                      {done ? (
                        <>
                          {row.counted_at}
                          {row.counted_by && <span className="ml-1 text-slate-400">· {row.counted_by}</span>}
                        </>
                      ) : (
                        <span className="text-slate-300">-</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-2 py-1">
                      <Elapsed seconds={row.elapsed_seconds} className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold ${tone.chip}`} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
