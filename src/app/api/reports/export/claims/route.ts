import { guardApi } from "@/lib/api-guard";
import { CLAIM_TYPE_LABEL, listClaims, type ClaimType } from "@/lib/claim";
import { respondXlsx, type XlsxRow } from "@/lib/xlsx";
import type { NextRequest } from "next/server";

export const runtime = "nodejs";

/** Excel ຂອງ ລະບົບເຄມ (/claims) — ຕາມຕົວກອງໜ້າຈໍ (type/status/q). */
export async function GET(request: NextRequest) {
  const denied = await guardApi("/claims");
  if (denied) return denied;

  const p = request.nextUrl.searchParams;
  const type = ["A", "B", "C"].includes(p.get("type") ?? "") ? (p.get("type") as ClaimType) : undefined;
  const status = p.get("status")?.trim() || undefined;
  const q = p.get("q")?.trim() || undefined;

  const rows = await listClaims({ type, status, q });
  const xlsx: XlsxRow[] = rows.map((r) => ({
    "ເລກເຄມ": r.claim_no,
    "ປະເພດ": `CLM-${r.claim_type} · ${CLAIM_TYPE_LABEL[r.claim_type]}`,
    "ສະຖານະ": r.status_label,
    "Supplier": r.supplier_code ?? "-",
    "ຮ້ານ / ລູກຄ້າ": r.customer_name ?? r.customer_code ?? "-",
    "ຫຍີ່ຫໍ້": r.brand_code ?? "-",
    "ເລກງານ": r.ref_job ?? "-",
    "ຍອດ": r.amount || 0,
    "ເຫດຜົນ": r.reason ?? "-",
    "ເປີດເມື່ອ": r.created_at ?? "-",
    "ເປີດໂດຍ": r.created_by ?? "-",
  }));

  const columns = [
    { header: "ເລກເຄມ", key: "ເລກເຄມ", width: 12 },
    { header: "ປະເພດ", key: "ປະເພດ", width: 26 },
    { header: "ສະຖານະ", key: "ສະຖານະ", width: 16 },
    { header: "Supplier", key: "Supplier", width: 14 },
    { header: "ຮ້ານ / ລູກຄ້າ", key: "ຮ້ານ / ລູກຄ້າ", width: 26 },
    { header: "ຫຍີ່ຫໍ້", key: "ຫຍີ່ຫໍ້", width: 14 },
    { header: "ເລກງານ", key: "ເລກງານ", width: 12 },
    { header: "ຍອດ", key: "ຍອດ", width: 14 },
    { header: "ເຫດຜົນ", key: "ເຫດຜົນ", width: 30 },
    { header: "ເປີດເມື່ອ", key: "ເປີດເມື່ອ", width: 18 },
    { header: "ເປີດໂດຍ", key: "ເປີດໂດຍ", width: 14 },
  ];

  const stamp = new Date().toISOString().slice(0, 10);
  return respondXlsx("ເຄມ", columns, xlsx, `claims-${type ?? "all"}-${stamp}.xlsx`);
}
