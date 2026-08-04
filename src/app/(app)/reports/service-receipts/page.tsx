import { ReportShell, reportState } from "@/components/report-shell";
import { receiptDocs, receiptsByPeriod } from "@/lib/receipt-summary";
import { one, safeDate, todayIso, type SearchParams } from "@/lib/report-sql";
import Link from "next/link";

/**
 * **ສະຫຼຸບໃບຮັບເງິນ (SIN)** — ປະຈຳວັນ / ປະຈຳເດືອນ / ລາຍໃບ.
 *
 * ສະຫຼັບມຸມມອງດ້ວຍ `?view=day|month|doc` (ຄ່າຕັ້ງຕົ້ນ = ວັນ).
 * ຊ່ວງວັນທີ່ຕັ້ງຕົ້ນ = **ເດືອນນີ້** (ບໍ່ແມ່ນມື້ນີ້) — ສະຫຼຸບເງິນມີຄວາມໝາຍເມື່ອເຫັນທັງເດືອນ.
 */
export const dynamic = "force-dynamic";

const VIEWS = [
  { key: "day", label: "ປະຈຳວັນ" },
  { key: "month", label: "ປະຈຳເດືອນ" },
  { key: "doc", label: "ລາຍໃບ" },
] as const;

const PERIOD_COLUMNS = [
  { key: "period", label: "ຊ່ວງ" },
  { key: "receipts", label: "ໃບຮັບເງິນ" },
  { key: "charged", label: "ໃບທີ່ເກັບເງິນ" },
  { key: "free", label: "ໃບຍອດ 0 (ປະກັນ)" },
  { key: "total", label: "ຍອດລວມ" },
];

const DOC_COLUMNS = [
  { key: "doc_no", label: "ເລກໃບ" },
  { key: "doc_date", label: "ວັນທີ" },
  { key: "job", label: "ໃບງານ" },
  { key: "customer", label: "ລູກຄ້າ" },
  { key: "cashier", label: "ຜູ້ອອກໃບ" },
  { key: "amount", label: "ຍອດ" },
];

/** ວັນທີ 1 ຂອງເດືອນນີ້ */
function monthStart() {
  return `${todayIso().slice(0, 7)}-01`;
}

export default async function ServiceReceiptsReport({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const from = safeDate(one(params.from), monthStart());
  const to = safeDate(one(params.to), todayIso());
  const raw = one(params.view);
  const view = VIEWS.some((v) => v.key === raw) ? (raw as "day" | "month" | "doc") : "day";
  const state = reportState(params);

  let rows: Record<string, string | number | null>[] = [];
  let error: string | null = null;
  let receipts = 0;
  let charged = 0;
  let totalAmount = 0;

  try {
    // ສະຫຼຸບຍອດລວມໃຊ້ຊຸດ "ລາຍໃບ" ສະເໝີ ⇒ ຕົວເລກຫົວໜ້າບໍ່ປ່ຽນຕາມມຸມມອງ
    const docs = await receiptDocs(from, to);
    receipts = docs.length;
    charged = docs.filter((d) => Number(d.amount.replace(/,/g, "")) > 0).length;
    totalAmount = docs.reduce((sum, d) => sum + (Number(d.amount.replace(/,/g, "")) || 0), 0);

    rows =
      view === "doc"
        ? docs.map((d) => ({ ...d, job: d.job ?? "-", customer: d.customer ?? "-", cashier: d.cashier ?? "-" }))
        : (await receiptsByPeriod(from, to, view)).map((r) => ({ ...r }));
  } catch (exception) {
    error = exception instanceof Error ? exception.message : "ໂຫຼດຂໍ້ມູນບໍ່ສຳເລັດ";
  }

  const tab = (key: string) =>
    `/reports/service-receipts?${new URLSearchParams({ from, to, ...(key !== "day" && { view: key }) })}`;

  return (
    <div className="w-full space-y-4">
      {/* ສະຫຼັບມຸມມອງ — ຮັກສາຊ່ວງວັນທີ່ໄວ້ */}
      <div className="flex gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
        {VIEWS.map((item) => (
          <Link
            key={item.key}
            href={tab(item.key)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
              view === item.key ? "bg-brand-900 text-white" : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            {item.label}
          </Link>
        ))}
      </div>

      <ReportShell
        title="ສະຫຼຸບໃບຮັບເງິນ"
        subtitle={`${from} ຫາ ${to} · ${receipts} ໃບ`}
        basePath="/reports/service-receipts"
        query={{ from, to, ...(view !== "day" && { view }) }}
        state={state}
        dateRange={{ from, to }}
        columns={view === "doc" ? DOC_COLUMNS : PERIOD_COLUMNS}
        rows={rows}
        error={error}
        summary={[
          { label: "ໃບຮັບເງິນ", value: receipts.toLocaleString() },
          { label: "ໃບທີ່ເກັບເງິນ", value: charged.toLocaleString() },
          { label: "ໃບຍອດ 0 (ປະກັນ)", value: (receipts - charged).toLocaleString() },
          { label: "ຍອດລວມ", value: totalAmount.toLocaleString() },
        ]}
        minWidth={760}
        searchPlaceholder="ຄົ້ນຫາ ເລກໃບ, ໃບງານ, ລູກຄ້າ..."
      />
    </div>
  );
}
