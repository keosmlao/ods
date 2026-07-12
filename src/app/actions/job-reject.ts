"use server";
import type { Workflow } from "@/lib/commission";
import { requireRole } from "@/lib/guard";
import { rejectJob } from "@/lib/job-flow";
import { TECH_SIDE } from "@/lib/roles";
import { revalidatePath } from "next/cache";

/**
 * ຊ່າງປະຕິເສດງານ — ຈາກ **ເວັບ** (ແອັບມືຖືຍິງ /api/mobile/jobs/... ມາຫາ lib/job-flow ອັນດຽວກັນ).
 * ຢ່າຂຽນ SQL ຢູ່ນີ້ — ຕົວປ່ຽນຂັ້ນຢູ່ lib/job-flow ບ່ອນດຽວ ຈຶ່ງບໍ່ມີວັນຫຼົ້ນກັນ.
 */
export type RejectState = { error?: string; ok?: string };

export async function rejectJobAction(
  workflow: Workflow,
  code: string,
  reason: string,
): Promise<RejectState> {
  const guard = await requireRole(TECH_SIDE);
  if (!guard.ok) return { error: guard.error };

  const result = await rejectJob(guard.session, workflow, code, reason);
  if (!result.ok) return { error: result.error };

  for (const path of ["/installations/accept", "/installations", "/installations/assign", "/checking", "/dashboard"]) {
    revalidatePath(path);
  }
  return { ok: result.message };
}
