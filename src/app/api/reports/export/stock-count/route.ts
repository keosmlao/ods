import { guardApi } from "@/lib/api-guard";
import { type StockCountReportRow, stockCountReport } from "@/lib/stock-count";
import { respondXlsxMulti, type XlsxColumn, type XlsxRow, type XlsxSheet } from "@/lib/xlsx";

export const runtime = "nodejs";

const SERVICE_ORDER = ["CI", "ST", "IH", "PS"];
const stateOf = (r: StockCountReportRow) => (r.counted ? "ນັບພົບ" : r.missing ? "ນັບບໍ່ພົບ (ຫາຍ)" : "ຍັງບໍ່ນັບ");

const DETAIL_COLS: XlsxColumn[] = [
  { header: "ສະຖານະນັບ", key: "ສະຖານະນັບ", width: 14 },
  { header: "ເລກງານ", key: "ເລກງານ", width: 10 },
  { header: "ສິນຄ້າ", key: "ສິນຄ້າ", width: 22 },
  { header: "ຍີ່ຫໍ້", key: "ຍີ່ຫໍ້", width: 14 },
  { header: "Serial", key: "Serial", width: 20 },
  { header: "ລູກຄ້າ", key: "ລູກຄ້າ", width: 24 },
  { header: "ອາການ", key: "ອາການ", width: 28 },
  { header: "ຂັ້ນປັດຈຸບັນ", key: "ຂັ້ນປັດຈຸບັນ", width: 18 },
  { header: "ຂັ້ນຕອນນັບ", key: "ຂັ້ນຕອນນັບ", width: 18 },
  { header: "ນັບເມື່ອ", key: "ນັບເມື່ອ", width: 18 },
  { header: "ຜູ້ນັບ", key: "ຜູ້ນັບ", width: 14 },
];
const detailRow = (r: StockCountReportRow): XlsxRow => ({
  "ສະຖານະນັບ": stateOf(r),
  "ເລກງານ": r.code,
  "ສິນຄ້າ": r.product ?? "-",
  "ຍີ່ຫໍ້": r.brand ?? "-",
  "Serial": r.sn ?? "-",
  "ລູກຄ້າ": r.customer ?? "-",
  "ອາການ": r.issue ?? "-",
  "ຂັ້ນປັດຈຸບັນ": r.stage_label,
  "ຂັ້ນຕອນນັບ": r.counted_stage_label ?? "-",
  "ນັບເມື່ອ": r.counted_at ?? "-",
  "ຜູ້ນັບ": r.counted_by ?? "-",
});

/** Excel: sheet "ສະຫຼຸບ" (ບໍລິການ × ສະຖານະ) + 1 sheet ຕໍ່ບໍລິການ (ລາຍລະອຽດ). */
export async function GET() {
  const denied = await guardApi("/reports/stock-count");
  if (denied) return denied;

  const rows = await stockCountReport();
  const services = [...new Set(rows.map((r) => r.service_type ?? "?"))].sort(
    (a, b) => (SERVICE_ORDER.indexOf(a) + 1 || 99) - (SERVICE_ORDER.indexOf(b) + 1 || 99),
  );

  // ── ສະຫຼຸບ: (ນັບ/ບໍ່ນັບ) → ບໍລິການ → ຂັ້ນ (long format, pivot ໄດ້) ──
  const rowStage = (r: StockCountReportRow) => (r.counted ? r.counted_stage_label ?? r.stage_label : r.stage_label) || "-";
  const groups: { label: string; rows: StockCountReportRow[] }[] = [
    { label: "ນັບພົບ", rows: rows.filter((r) => r.counted) },
    { label: "ຍັງບໍ່ນັບ", rows: rows.filter((r) => !r.counted && !r.missing) },
    { label: "ນັບບໍ່ພົບ", rows: rows.filter((r) => r.missing) },
  ];
  const summaryRows: XlsxRow[] = [];
  for (const g of groups) {
    const svcs = [...new Set(g.rows.map((r) => r.service_type ?? "?"))].sort(
      (a, b) => (SERVICE_ORDER.indexOf(a) + 1 || 99) - (SERVICE_ORDER.indexOf(b) + 1 || 99),
    );
    for (const sv of svcs) {
      const srows = g.rows.filter((r) => (r.service_type ?? "?") === sv);
      const svName = sv === "?" ? "ບໍ່ລະບຸ" : srows[0]?.service_type_label ?? sv;
      for (const st of [...new Set(srows.map(rowStage))]) {
        summaryRows.push({ "ສະຖານະການນັບ": g.label, "ບໍລິການ": svName, "ຂັ້ນ": st, "ຈຳນວນ": srows.filter((r) => rowStage(r) === st).length });
      }
      summaryRows.push({ "ສະຖານະການນັບ": g.label, "ບໍລິການ": svName, "ຂັ້ນ": "— ລວມ —", "ຈຳນວນ": srows.length });
    }
  }

  const sheets: XlsxSheet[] = [
    {
      name: "ສະຫຼຸບ",
      columns: [
        { header: "ສະຖານະການນັບ", key: "ສະຖານະການນັບ", width: 16 },
        { header: "ບໍລິການ", key: "ບໍລິການ", width: 12 },
        { header: "ຂັ້ນ", key: "ຂັ້ນ", width: 26 },
        { header: "ຈຳນວນ", key: "ຈຳນວນ", width: 10 },
      ],
      rows: summaryRows,
    },
    ...services.map((svc) => ({
      name: svc === "?" ? "ບໍ່ລະບຸ" : svc,
      columns: DETAIL_COLS,
      rows: rows.filter((r) => (r.service_type ?? "?") === svc).map(detailRow),
    })),
  ];

  const stamp = new Date().toISOString().slice(0, 10);
  return respondXlsxMulti(sheets, `stock-count-${stamp}.xlsx`);
}
