import { guardApi } from "@/lib/api-guard";
import { safeDate } from "@/lib/report-sql";
import {
  auditSheets,
  fetchRepairAudit,
  filterByTab,
  isAuditTab,
  searchAudit,
  sortAudit,
  type AuditScope,
  type AuditTab,
} from "@/lib/repair-audit";
import { REPAIR_SERVICE_TYPES } from "@/lib/repair-sla";
import { respondXlsxMulti, type XlsxColumn } from "@/lib/xlsx";
import { NextRequest } from "next/server";

export const runtime = "nodejs";

/**
 * **Excel ຂອງລາຍງານກວດສອບງານສ້ອມ** — 3 sheet ເພື່ອເອົາໄປ pivot ຕໍ່:
 *   ① ໃບງານ (1 ແຖວ = 1 ໃບ · ພ້ອມຄຳຊີ້ແຈງ)
 *   ② ຂັ້ນທີ່ເກີນ SLA (1 ແຖວ = 1 ຂັ້ນ) — ຫາຄໍຂວດ / ຮັບຜິດຊອບຕໍ່ຝ່າຍ
 *   ③ timeline ຜິດປົກກະຕິ (1 ແຖວ = 1 ຈຸດຜິດ) — ໄປແກ້ການບັນທຶກ
 * ໃຊ້ຕົວກອງ ແລະ ແທັບ **ອັນດຽວກັບໜ້າຈໍ** ⇒ ຕົວເລກໃນໄຟລ໌ຕົງກັບທີ່ຄົນເຫັນສະເໝີ.
 */

const jobColumns: XlsxColumn[] = [
  { header: "ໃບງານ", key: "code", width: 12 },
  { header: "ຜົນກວດ (ເວລາ)", key: "flag", width: 22 },
  { header: "timeline", key: "timeline", width: 14 },
  { header: "ເຄື່ອງ", key: "product", width: 28 },
  { header: "SN", key: "sn", width: 18 },
  { header: "ຫຍີ່ຫໍ້", key: "brand", width: 14 },
  { header: "ລູກຄ້າ", key: "customer", width: 26 },
  { header: "ບໍລິການ", key: "service", width: 10 },
  { header: "ຂັ້ນປັດຈຸບັນ", key: "stage", width: 26 },
  { header: "ຝ່າຍຮັບຜິດຊອບ", key: "owner", width: 22 },
  { header: "ຕ້ອງລົງມືຕໍ່", key: "next", width: 26 },
  { header: "ຊ່າງ", key: "tech", width: 16 },
  { header: "ຮັບເຄື່ອງ", key: "registered", width: 18 },
  { header: "ສົ່ງຄືນ", key: "returned", width: 18 },
  { header: "ລວມທັງງານ", key: "total", width: 16 },
  { header: "ຂັ້ນທີ່ຊ້າສຸດ", key: "worst", width: 34 },
  { header: "ເກີນ SLA (ເທົ່າ)", key: "ratio", width: 14 },
  { header: "ຈຳນວນຂັ້ນທີ່ເກີນ", key: "breaches", width: 14 },
  { header: "ຈຸດ timeline ຜິດ", key: "anomalies", width: 14 },
  { header: "ໝວດສາເຫດ", key: "cause", width: 24 },
  { header: "ຄຳຊີ້ແຈງ", key: "reason", width: 50 },
  { header: "ຜູ້ຮັບຜິດຊອບ (ບັນທຶກ)", key: "responsible", width: 24 },
  { header: "ບັນທຶກໂດຍ", key: "notedBy", width: 22 },
  { header: "ໄຟລ໌ແນບ", key: "files", width: 10 },
];

const stageColumns: XlsxColumn[] = [
  { header: "ໃບງານ", key: "code", width: 12 },
  { header: "ບໍລິການ", key: "service", width: 10 },
  { header: "ຂັ້ນ", key: "stage", width: 8 },
  { header: "ຊື່ຂັ້ນ", key: "stageLabel", width: 28 },
  { header: "ຝ່າຍຮັບຜິດຊອບ", key: "owner", width: 24 },
  { header: "ສະຖານະຂັ້ນ", key: "state", width: 20 },
  { header: "ໃຊ້ເວລາ", key: "used", width: 16 },
  { header: "SLA (ຊມ)", key: "sla", width: 12 },
  { header: "ເກີນ", key: "over", width: 16 },
  { header: "ເກີນ (ເທົ່າ)", key: "ratio", width: 12 },
];

const anomalyColumns: XlsxColumn[] = [
  { header: "ໃບງານ", key: "code", width: 12 },
  { header: "ບໍລິການ", key: "service", width: 10 },
  { header: "ຂັ້ນ", key: "stage", width: 8 },
  { header: "ຊະນິດ", key: "kind", width: 16 },
  { header: "ລະດັບ", key: "severity", width: 12 },
  { header: "ລາຍລະອຽດ", key: "detail", width: 70 },
  { header: "ໝວດສາເຫດ", key: "cause", width: 24 },
  { header: "ຄຳຊີ້ແຈງ", key: "reason", width: 50 },
];

export async function GET(request: NextRequest) {
  // ສິດຕາມໜ້າ /reports/repair-audit — /api ຢູ່ນອກ matcher ຂອງ proxy (ເບິ່ງ lib/api-guard)
  const denied = await guardApi("/reports/repair-audit");
  if (denied) return denied;

  const search = request.nextUrl.searchParams;
  const scope: AuditScope = search.get("scope") === "all" ? "all" : "open";
  const svc = search.get("svc") ?? "";
  const requested = search.get("tab") ?? undefined;
  const tab: AuditTab = isAuditTab(requested) ? requested : "problem";

  const all = await fetchRepairAudit({
    from: safeDate(search.get("from") ?? undefined),
    to: safeDate(search.get("to") ?? undefined),
    scope,
    service: REPAIR_SERVICE_TYPES.includes(svc as never) ? svc : "",
  });
  // ຕົວກອງ · ຄົ້ນຫາ · ແທັບ · ການຮຽງ **ອັນດຽວກັບໜ້າຈໍ** ⇒ ໄຟລ໌ຕົງກັບທີ່ຄົນເຫັນ
  const rows = sortAudit(filterByTab(searchAudit(all, search.get("q") ?? ""), tab));

  const sheets = auditSheets(rows);
  return respondXlsxMulti(
    [
      { name: "ໃບງານ", columns: jobColumns, rows: sheets.jobs },
      { name: "ຂັ້ນທີ່ເກີນ SLA", columns: stageColumns, rows: sheets.stages },
      { name: "timeline ຜິດປົກກະຕິ", columns: anomalyColumns, rows: sheets.anomalies },
    ],
    "repair_audit.xlsx",
  );
}
