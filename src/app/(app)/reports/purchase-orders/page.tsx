import { countBy, defaultFromIso, ReportShell, reportState } from "@/components/report-shell";
import { columns, fetchPurchaseOrders, one, safeDate, toTableColumns, todayIso, type Row, type SearchParams } from "@/lib/report-sql";

/* ods: /purchase_order_rp — orderspare.py */
export default async function PurchaseOrdersReport({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const from = safeDate(one(params.from), defaultFromIso());
  const to = safeDate(one(params.to), todayIso());
  const state = reportState(params);

  let rows: Row[] = [];
  let error: string | null = null;
  try {
    rows = await fetchPurchaseOrders(from, to);
  } catch (exception) {
    error = exception instanceof Error ? exception.message : "ດຶງຂໍ້ມູນບໍ່ສຳເລັດ";
  }

  return (
    <ReportShell
      title="ລາຍງານການສັ່ງຊື້ອາໄຫຼ່"
      subtitle={`ແຕ່ວັນທີ ${from} ຫາ ${to}`}
      basePath="/reports/purchase-orders"
      query={{ from, to }}
      state={state}
      dateRange={{ from, to }}
      columns={toTableColumns(columns.purchaseOrders)}
      rows={rows}
      error={error}
      /* ສະຫຼຸບຕາມການຮັບປະກັນຂອງເຄື່ອງທີ່ສັ່ງອາໄຫຼ່ໃຫ້ — ນັບຈາກແຖວຊຸດດຽວກັນກັບຕາຕະລາງ */
      summary={countBy(rows, "warrunty")}
      exportHref={`/api/reports/export/purchase-orders?${new URLSearchParams({ from, to, ...(state.q && { q: state.q }) })}`}
      minWidth={1800}
      searchPlaceholder="ຄົ້ນຫາ ເລກບີນ, ໃບຮັບເຄື່ອງ, ລູກຄ້າ, ຊ່າງ..."
    />
  );
}
