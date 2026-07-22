"use server";
import { getSession } from "@/lib/auth";
import { repairTimeline, type TimelineStep } from "@/lib/repair-timeline";

/** ດຶງ timeline ຂອງງານສ້ອມ (lazy) — ໃຫ້ drawer ໃນ list ໂຫຼດຕອນກາງອອກ. */
export async function fetchRepairTimeline(code: string): Promise<{ steps: TimelineStep[]; cancelledAt: string | null }> {
  const session = await getSession();
  if (!session) return { steps: [], cancelledAt: null };
  return repairTimeline(code.trim());
}
