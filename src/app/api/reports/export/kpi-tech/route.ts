import { guardApi } from "@/lib/api-guard";
import { technicianKpi, technicianServiceMix, technicianSla, type Period } from "@/lib/kpi";
import { respondXlsx, type XlsxRow } from "@/lib/xlsx";
import type { NextRequest } from "next/server";

export const runtime = "nodejs";

/** Excel ຜົນງານຕໍ່ຊ່າງ (KPI) — ຜົນງານ + ທັນເວລາ SLA + ແຍກປະເພດ ໃນໄຟລ໌ດຽວ. */
export async function GET(request: NextRequest) {
  const denied = await guardApi("/reports/kpi");
  if (denied) return denied;

  const d = Number(request.nextUrl.searchParams.get("d"));
  const days = ([30, 90, 180, 365].includes(d) ? d : 90) as Period;

  const [techs, sla, mix] = await Promise.all([
    technicianKpi(days),
    technicianSla(days),
    technicianServiceMix(days),
  ]);
  const slaMap = new Map(sla.map((item) => [item.tech, item]));
  const mixMap = new Map(mix.map((item) => [item.tech, item]));

  const rows: XlsxRow[] = techs.map((tech) => {
    const s = slaMap.get(tech.tech);
    const m = mixMap.get(tech.tech);
    return {
      ຊ່າງ: tech.tech,
      ຕິດຕັ້ງ: tech.install_done,
      ສ້ອມ: tech.repair_done,
      ລວມ: tech.install_done + tech.repair_done,
      "ເວລາຕໍ່ງານ (ຊມ)": tech.median_hours,
      "ທັນເວລາ SLA %": s?.pct ?? null,
      ຊ້າ: s?.late ?? 0,
      CI: m?.ci ?? 0,
      ST: m?.st ?? 0,
      IH: m?.ih ?? 0,
      PS: m?.ps ?? 0,
      ປະຕິເສດ: tech.rejects,
      "QC ບໍ່ຜ່ານ": tech.qc_failed,
    };
  });

  const columns = [
    { header: "ຊ່າງ", key: "ຊ່າງ", width: 16 },
    { header: "ຕິດຕັ້ງ", key: "ຕິດຕັ້ງ", width: 10 },
    { header: "ສ້ອມ", key: "ສ້ອມ", width: 10 },
    { header: "ລວມ", key: "ລວມ", width: 10 },
    { header: "ເວລາຕໍ່ງານ (ຊມ)", key: "ເວລາຕໍ່ງານ (ຊມ)", width: 16 },
    { header: "ທັນເວລາ SLA %", key: "ທັນເວລາ SLA %", width: 14 },
    { header: "ຊ້າ", key: "ຊ້າ", width: 8 },
    { header: "CI", key: "CI", width: 8 },
    { header: "ST", key: "ST", width: 8 },
    { header: "IH", key: "IH", width: 8 },
    { header: "PS", key: "PS", width: 8 },
    { header: "ປະຕິເສດ", key: "ປະຕິເສດ", width: 10 },
    { header: "QC ບໍ່ຜ່ານ", key: "QC ບໍ່ຜ່ານ", width: 10 },
  ];

  const stamp = new Date().toISOString().slice(0, 10);
  return respondXlsx(`KPI-ຊ່າງ-${days}ມື້`, columns, rows, `kpi-tech-${days}d-${stamp}.xlsx`);
}
