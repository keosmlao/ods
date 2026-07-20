import { guardApi } from "@/lib/api-guard";
import { stockCountReport } from "@/lib/stock-count";
import { respondXlsx, type XlsxRow } from "@/lib/xlsx";

export const runtime = "nodejs";

/**
 * Excel ຂອງ "ລາຍງານຜົນການກວດນັບສະຕັອກ" (/reports/stock-count) — **ທັງ** ເຄື່ອງທີ່ນັບພົບແລ້ວ
 * **ແລະ** pending ທີ່ຍັງບໍ່ນັບ (ຜ່ານ stockCountReport ບ່ອນດຽວກັບໜ້າຈໍ ⇒ ບໍ່ຕ່າງກັນ).
 */
export async function GET() {
  const denied = await guardApi("/reports/stock-count");
  if (denied) return denied;

  const items = await stockCountReport();
  const rows: XlsxRow[] = items.map((it) => ({
    "ສະຖານະນັບ": it.counted ? "ນັບແລ້ວ" : "ຍັງບໍ່ນັບ",
    "ເລກງານ": it.code,
    "ສິນຄ້າ": it.product ?? "-",
    "ຍີ່ຫໍ້": it.brand ?? "-",
    "Serial": it.sn ?? "-",
    "ລູກຄ້າ": it.customer ?? "-",
    "ອາການ": it.issue ?? "-",
    "ປະເພດບໍລິການ": it.service_type_label,
    "ຂັ້ນປັດຈຸບັນ": it.stage_label,
    "ຂັ້ນຕອນນັບ": it.counted_stage_label ?? "-",
    "ສົ່ງຄືນແລ້ວ": it.returned ? "ແມ່ນ" : "",
    "ນັບເມື່ອ": it.counted_at ?? "-",
    "ຜູ້ນັບ": it.counted_by ?? "-",
  }));

  const columns = [
    { header: "ສະຖານະນັບ", key: "ສະຖານະນັບ", width: 12 },
    { header: "ເລກງານ", key: "ເລກງານ", width: 10 },
    { header: "ສິນຄ້າ", key: "ສິນຄ້າ", width: 22 },
    { header: "ຍີ່ຫໍ້", key: "ຍີ່ຫໍ້", width: 14 },
    { header: "Serial", key: "Serial", width: 20 },
    { header: "ລູກຄ້າ", key: "ລູກຄ້າ", width: 26 },
    { header: "ອາການ", key: "ອາການ", width: 30 },
    { header: "ປະເພດບໍລິການ", key: "ປະເພດບໍລິການ", width: 24 },
    { header: "ຂັ້ນປັດຈຸບັນ", key: "ຂັ້ນປັດຈຸບັນ", width: 20 },
    { header: "ຂັ້ນຕອນນັບ", key: "ຂັ້ນຕອນນັບ", width: 20 },
    { header: "ສົ່ງຄືນແລ້ວ", key: "ສົ່ງຄືນແລ້ວ", width: 12 },
    { header: "ນັບເມື່ອ", key: "ນັບເມື່ອ", width: 18 },
    { header: "ຜູ້ນັບ", key: "ຜູ້ນັບ", width: 14 },
  ];

  const stamp = new Date().toISOString().slice(0, 10);
  return respondXlsx("ຜົນກວດນັບສະຕັອກ", columns, rows, `stock-count-${stamp}.xlsx`);
}
