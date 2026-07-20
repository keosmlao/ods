"use server";
import { query } from "@/lib/db";
import { requireRole } from "@/lib/guard";
import { APPROVER_SIDE } from "@/lib/roles";
import { revalidatePath } from "next/cache";

/** ຕັ້ງ report: ເປີດ/ປິດ + ເວລາສົ່ງ (HH:MM). */
export async function setReport(key: string, enabled: boolean, sendTime: string): Promise<{ error?: string }> {
  const g = await requireRole(APPROVER_SIDE, "ບໍ່ມີສິດ");
  if (!g.ok) return { error: g.error };
  const t = /^([01]\d|2[0-3]):[0-5]\d$/.test(sendTime) ? sendTime : "08:00";
  await query(`update ods_report_schedule set enabled = $1, send_time = $2 where report_key = $3`, [enabled, t, key]);
  revalidatePath("/manage/report-recipients");
  return {};
}
