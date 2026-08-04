"use server";
import { getSession } from "@/lib/auth";
import { installTimeline } from "@/lib/install-timeline";
import type { TimelineStep } from "@/lib/repair-timeline";

/** ດຶງ timeline ຂອງງານຕິດຕັ້ງ (lazy) — ຄູ່ຂະໜານກັບ fetchRepairTimeline. */
export async function fetchInstallTimeline(code: string): Promise<{ steps: TimelineStep[]; cancelledAt: string | null }> {
  const session = await getSession();
  if (!session) return { steps: [], cancelledAt: null };
  return installTimeline(code.trim());
}
