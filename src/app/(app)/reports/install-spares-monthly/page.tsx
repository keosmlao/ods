import { Button, Card, Empty, LinkButton, PageTitle, Table } from "@/components/ui";
import {
  fetchMonthlyInstallSpares,
  filterInstallSpareItems,
  ISO_MONTH,
} from "@/lib/install-spare-report";
import { Download, Search } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ month?: string; q?: string }> };

const qty = (value: string | number) =>
  Number(value).toLocaleString("en-US", { maximumFractionDigits: 2 });

function shiftMonth(month: string, delta: number) {
  const [year, value] = month.split("-").map(Number);
  return new Date(Date.UTC(year, value - 1 + delta, 1)).toISOString().slice(0, 7);
}

export default async function InstallSpareMonthlyReport({ searchParams }: Props) {
  const params = await searchParams;
  const month = ISO_MONTH.test(params.month ?? "") ? (params.month as string) : new Date().toISOString().slice(0, 7);
  const q = (params.q ?? "").trim();
  const report = await fetchMonthlyInstallSpares(month);
  const items = filterInstallSpareItems(report.items, q);
  const exportHref = `/api/reports/export/install-spares-monthly?${new URLSearchParams({ month, ...(q && { q }) })}`;

  return (
    <div className="w-full space-y-5">
      <PageTitle sub="ອ່ານຈາກໃບເບີກອາໄຫຼ່ຈາກສາງຂອງງານຕິດຕັ້ງ">
        ສະຫຼຸບອາໄຫຼ່ຕິດຕັ້ງປະຈຳເດືອນ
      </PageTitle>

      <div className="flex flex-wrap items-center gap-2">
        <Link
          href={`/reports/install-spares-monthly?month=${shiftMonth(month, -1)}`}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
        >
          ← ເດືອນກ່ອນ
        </Link>
        <form className="flex flex-1 flex-wrap items-center gap-2">
          <input
            type="month"
            name="month"
            defaultValue={month}
            className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-xs outline-none focus:border-teal-500"
          />
          <div className="flex h-9 min-w-56 flex-1 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3">
            <Search className="size-3.5 text-slate-400" />
            <input
              name="q"
              defaultValue={q}
              placeholder="ຄົ້ນຫາລະຫັດ ຫຼື ຊື່ອາໄຫຼ່..."
              className="w-full text-xs outline-none"
            />
          </div>
          <Button type="submit" size="sm">ສະແດງ</Button>
        </form>
        <Link
          href={`/reports/install-spares-monthly?month=${shiftMonth(month, 1)}`}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
        >
          ເດືອນຕໍ່ໄປ →
        </Link>
        <LinkButton href={exportHref} tone="success" size="sm">
          <Download className="size-3.5" /> Excel
        </LinkButton>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <Stat label="ໃບເບີກ" value={report.totals.documents} />
        <Stat label="ງານຕິດຕັ້ງ" value={report.totals.jobs} />
        <Stat label="ປະເພດອາໄຫຼ່" value={report.totals.item_types} />
        <Stat label="ເບີກລວມ" value={qty(report.totals.issued_qty)} tone="blue" />
        <Stat label="ຮັບຄືນ" value={qty(report.totals.returned_qty)} tone="amber" />
        <Stat label="ໃຊ້ສຸດທິ" value={qty(report.totals.net_qty)} tone="green" />
      </div>

      <Card title={`ສະຫຼຸບຕາມອາໄຫຼ່ · ${items.length} ລາຍການ`}>
        {items.length === 0 ? (
          <Empty>ບໍ່ມີການເບີກອາໄຫຼ່ຕິດຕັ້ງໃນເດືອນນີ້</Empty>
        ) : (
          <Table head={["ລະຫັດ", "ລາຍການອາໄຫຼ່", "ໜ່ວຍ", "ໃບເບີກ", "ງານ", "ເບີກ", "ຮັບຄືນ", "ໃຊ້ສຸດທິ"]} minWidth={1050}>
            {items.map((row) => (
              <tr key={`${row.item_code}-${row.unit_code}`} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="whitespace-nowrap px-3 py-2 text-xs font-bold text-[#0536a9]">{row.item_code}</td>
                <td className="px-3 py-2 text-xs text-slate-700">{row.item_name}</td>
                <td className="whitespace-nowrap px-3 py-2 text-center text-xs text-slate-500">{row.unit_code}</td>
                <td className="px-3 py-2 text-center text-xs tabular-nums">{row.documents}</td>
                <td className="px-3 py-2 text-center text-xs tabular-nums">{row.jobs}</td>
                <td className="px-3 py-2 text-right text-xs font-semibold tabular-nums text-blue-700">{qty(row.issued_qty)}</td>
                <td className="px-3 py-2 text-right text-xs font-semibold tabular-nums text-amber-700">{qty(row.returned_qty)}</td>
                <td className="px-3 py-2 text-right text-xs font-bold tabular-nums text-emerald-700">{qty(row.net_qty)}</td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      <Card title="ສະຫຼຸບຕາມຊ່າງ">
        {report.techs.length === 0 ? (
          <Empty />
        ) : (
          <Table head={["ຊ່າງ", "ຈຳນວນງານ", "ໃບເບີກ", "ປະເພດອາໄຫຼ່", "ເບີກ", "ຮັບຄືນ", "ໃຊ້ສຸດທິ"]} minWidth={850}>
            {report.techs.map((row) => (
              <tr key={row.tech_code} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="px-3 py-2 text-xs font-semibold text-slate-800">
                  {row.tech_name} <span className="text-[10px] font-normal text-slate-400">({row.tech_code})</span>
                </td>
                <td className="px-3 py-2 text-center text-xs tabular-nums">{row.jobs}</td>
                <td className="px-3 py-2 text-center text-xs tabular-nums">{row.documents}</td>
                <td className="px-3 py-2 text-center text-xs tabular-nums">{row.item_types}</td>
                <td className="px-3 py-2 text-right text-xs tabular-nums text-blue-700">{qty(row.issued_qty)}</td>
                <td className="px-3 py-2 text-right text-xs tabular-nums text-amber-700">{qty(row.returned_qty)}</td>
                <td className="px-3 py-2 text-right text-xs font-bold tabular-nums text-emerald-700">{qty(row.net_qty)}</td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </div>
  );
}

function Stat({ label, value, tone = "plain" }: { label: string; value: string | number; tone?: "plain" | "blue" | "amber" | "green" }) {
  const colors = {
    plain: "border-slate-200 bg-white text-slate-800",
    blue: "border-blue-200 bg-blue-50 text-blue-800",
    amber: "border-amber-200 bg-amber-50 text-amber-800",
    green: "border-emerald-200 bg-emerald-50 text-emerald-800",
  };
  return (
    <div className={`rounded-xl border p-4 shadow-sm ${colors[tone]}`}>
      <p className="text-[11px] font-semibold opacity-70">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
    </div>
  );
}
