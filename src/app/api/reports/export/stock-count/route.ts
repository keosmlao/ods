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

  // ── ສະຫຼຸບ: ບໍລິການ × ສະຖານະ ──
  const summaryRows: XlsxRow[] = services.map((svc) => {
    const rs = rows.filter((r) => (r.service_type ?? "?") === svc);
    const found = rs.filter((r) => r.counted).length;
    const notCounted = rs.filter((r) => !r.counted && !r.missing).length;
    const missing = rs.filter((r) => r.missing).length;
    return { "ບໍລິການ": svc, "ນັບພົບ": found, "ຍັງບໍ່ນັບ": notCounted, "ນັບບໍ່ພົບ": missing, "ລວມ": rs.length };
  });
  summaryRows.push({
    "ບໍລິການ": "ລວມ",
    "ນັບພົບ": rows.filter((r) => r.counted).length,
    "ຍັງບໍ່ນັບ": rows.filter((r) => !r.counted && !r.missing).length,
    "ນັບບໍ່ພົບ": rows.filter((r) => r.missing).length,
    "ລວມ": rows.length,
  });

  const sheets: XlsxSheet[] = [
    {
      name: "ສະຫຼຸບ",
      columns: [
        { header: "ບໍລິການ", key: "ບໍລິການ", width: 12 },
        { header: "ນັບພົບ", key: "ນັບພົບ", width: 10 },
        { header: "ຍັງບໍ່ນັບ", key: "ຍັງບໍ່ນັບ", width: 12 },
        { header: "ນັບບໍ່ພົບ", key: "ນັບບໍ່ພົບ", width: 12 },
        { header: "ລວມ", key: "ລວມ", width: 10 },
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
