import { Empty, PageTitle, Table } from "@/components/ui";
import { repeatRepairs, REPEAT_DAYS } from "@/lib/repeat-repairs";
import { RotateCcw, TriangleAlert } from "lucide-react";
import Link from "next/link";

/**
 * **ເຄື່ອງທີ່ກັບມາສ້ອມຊ້ຳ** ພາຍໃນ 60 ມື້ — ສ້ອມບໍ່ຫາຍແຕ່ເທື່ອທຳອິດ.
 *
 * ງານທີ່ໄວແຕ່ຕ້ອງກັບມາ = ຈ່າຍຄ່າຊ່າງ 2 ເທື່ອ · ອາໄຫຼ່ອາດເສຍຖິ້ມ · ລູກຄ້າເສຍຄວາມເຊື່ອ.
 * ໜ້ານີ້ຈັບຄູ່ **ໃບໃໝ່ ↔ ໃບກ່ອນໜ້າ** ຂອງເຄື່ອງໜ່ວຍດຽວກັນ (S/N + ລູກຄ້າ) ພ້ອມບອກວ່າ
 * **ຊ່າງຄົນເກົ່າ** ຫຼືບໍ່ ແລະ **ອາການຊ້ຳກັນ** ຫຼືບໍ່ — ສອງອັນນີ້ຄືເບາະແສຂອງສາເຫດ.
 */
export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ d?: string }> };

const PERIODS = [90, 180, 365];

export default async function RepeatRepairsPage({ searchParams }: Props) {
  const params = await searchParams;
  const days = PERIODS.includes(Number(params.d)) ? Number(params.d) : 180;

  const rows = await repeatRepairs(days);
  const sameTech = rows.filter((row) => row.same_tech).length;

  return (
    <div className="w-full space-y-4">
      <PageTitle sub={`ເຄື່ອງໜ່ວຍດຽວກັນ (S/N + ລູກຄ້າ) ກັບມາພາຍໃນ ${REPEAT_DAYS} ມື້ — ສ້ອມບໍ່ຫາຍແຕ່ເທື່ອທຳອິດ`}>
        ເຄື່ອງທີ່ກັບມາສ້ອມຊ້ຳ
      </PageTitle>

      <div className="flex flex-wrap items-center gap-1">
        {PERIODS.map((period) => (
          <Link
            key={period}
            href={`/reports/repeat-repairs?d=${period}`}
            className={`inline-flex h-9 items-center rounded-lg px-3 text-xs font-semibold transition ${
              days === period ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            {period} ມື້
          </Link>
        ))}
      </div>

      {rows.length > 0 && (
        <p className="flex flex-wrap items-center gap-2 rounded-xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
          <TriangleAlert className="size-4" />
          {rows.length} ໃບ — ໃນນັ້ນ <b>{sameTech} ໃບເປັນຊ່າງຄົນເກົ່າ</b> (ສ້ອມແລ້ວກັບມາອີກ ⇒ ຄວນຖາມສາເຫດ)
        </p>
      )}

      {rows.length === 0 ? (
        <Empty>ບໍ່ມີເຄື່ອງທີ່ກັບມາສ້ອມຊ້ຳໃນໄລຍະນີ້</Empty>
      ) : (
        <Table
          head={["ໃບໃໝ່", "ລູກຄ້າ / ເຄື່ອງ", "ອາການເທື່ອນີ້", "ໃບກ່ອນໜ້າ", "ອາການເທື່ອກ່ອນ", "ກັບມາຫຼັງ", "ຊ່າງ"]}
          minWidth={1200}
        >
          {rows.map((row) => {
            // ອາການຄ້າຍກັນ + ຊ່າງຄົນເກົ່າ = ສັນຍານແຮງທີ່ສຸດວ່າສ້ອມບໍ່ຫາຍແທ້
            const sameIssue =
              Boolean(row.issue && row.prev_issue) &&
              row.issue!.trim().toLowerCase() === row.prev_issue!.trim().toLowerCase();
            return (
              <tr key={row.code} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="whitespace-nowrap px-3 py-2.5">
                  <Link href={`/service/${row.code}`} className="font-bold text-teal-700 hover:underline">
                    {row.code}
                  </Link>
                  <span className="block text-[11px] text-slate-400">{row.registered}</span>
                </td>
                <td className="px-3 py-2.5">
                  <span className="block truncate text-sm text-slate-700">{row.customer ?? "-"}</span>
                  <span className="block truncate text-[11px] text-slate-500">{row.product ?? "-"}</span>
                  <span className="block text-[11px] text-slate-400">S/N {row.sn}</span>
                </td>
                <td className="px-3 py-2.5 text-xs text-slate-700">
                  {row.issue ?? "-"}
                  {sameIssue && (
                    <span className="ml-1 rounded bg-red-100 px-1 py-0.5 text-[10px] font-bold text-red-700">
                      ອາການຊ້ຳ
                    </span>
                  )}
                </td>
                <td className="whitespace-nowrap px-3 py-2.5">
                  <Link href={`/service/${row.prev_code}`} className="font-semibold text-slate-600 hover:underline">
                    {row.prev_code}
                  </Link>
                  <span className="block text-[11px] text-slate-400">ຈົບ {row.prev_done}</span>
                </td>
                <td className="px-3 py-2.5 text-xs text-slate-500">{row.prev_issue ?? "-"}</td>
                <td className="whitespace-nowrap px-3 py-2.5 text-center">
                  <span
                    className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-bold ${
                      row.days_after <= 14 ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    <RotateCcw className="size-3" />
                    {row.days_after} ມື້
                  </span>
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 text-center text-xs">
                  <span className="block font-semibold text-slate-700">{row.tech ?? "-"}</span>
                  {row.same_tech ? (
                    <span className="rounded bg-amber-100 px-1 py-0.5 text-[10px] font-bold text-amber-800">
                      ຊ່າງຄົນເກົ່າ
                    </span>
                  ) : (
                    <span className="text-[11px] text-slate-400">ເທື່ອກ່ອນ: {row.prev_tech ?? "-"}</span>
                  )}
                </td>
              </tr>
            );
          })}
        </Table>
      )}
    </div>
  );
}
