import { guardApi } from "@/lib/api-guard";
import { columns, fetchStatusExport } from "@/lib/report-sql";
import { respondXlsx } from "@/lib/xlsx";
import { NextRequest } from "next/server";

export const runtime = "nodejs";

/* ods: /download/report/<id> — home.py (ແຜນທີ່ id → ຊື່ໄຟລ໌ ຢູ່ report-sql.ts) */
export async function GET(request: NextRequest) {
  // ສິດຕາມໜ້າ /dashboard — /api ຢູ່ນອກ matcher ຂອງ proxy (ເບິ່ງ lib/api-guard)
  const denied = await guardApi("/dashboard");
  if (denied) return denied;
  const id = request.nextUrl.searchParams.get("id") ?? "0";
  const { config, rows } = await fetchStatusExport(id);
  // ods ຂອງ id=12 ເພີ່ມຄໍລຳ "ສະຖານະ"; ຄໍລຳຊຸດດຽວກັນໃຊ້ໄດ້ກັບທຸກ id
  const list = id === "12" || id === "1" ? columns.pending : columns.pending.filter((column) => column.key !== "status_name");
  return respondXlsx(config.title, list, rows, config.filename);
}
