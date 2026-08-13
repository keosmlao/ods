"use server";
import { getSession } from "@/lib/auth";
import { installTimeline, type InstallTimeline } from "@/lib/install-timeline";

/** ດຶງ timeline ຂອງງານຕິດຕັ້ງ (lazy) — ຄູ່ຂະໜານກັບ fetchRepairTimeline (ພ້ອມຮອບເຂົ້າໜ້າງານ). */
export async function fetchInstallTimeline(code: string): Promise<InstallTimeline> {
  const session = await getSession();
  if (!session) return { steps: [], cancelledAt: null, visits: [] };
  return installTimeline(code.trim());
}
