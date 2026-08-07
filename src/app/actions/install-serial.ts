"use server";

import { requireRole } from "@/lib/guard";
import { runInstallSerialBackfill } from "@/lib/install-serial-backfill";
import { revalidatePath } from "next/cache";

/**
 * ຕື່ມ ISN/SN ຄືນໃຫ້ໃບງານຕິດຕັ້ງເກົ່າ — **ຜູ້ຈັດການເທົ່ານັ້ນ**.
 * ເຫດຜົນ ແລະ ກົດການຈັບຄູ່ຢູ່ lib/install-serial-backfill (ບ່ອນດຽວ).
 */
export async function backfillInstallSerials(): Promise<{ written?: number; error?: string }> {
  const guard = await requireRole(["manager"]);
  if (!guard.ok) return { error: guard.error };
  try {
    const result = await runInstallSerialBackfill(guard.session.username);
    revalidatePath("/manage/install-serials");
    return { written: result.written };
  } catch (error) {
    console.error("backfillInstallSerials failed", error);
    return { error: "ຕື່ມບໍ່ສຳເລັດ — ລອງໃໝ່ ຫຼື ແຈ້ງຜູ້ດູແລລະບົບ" };
  }
}
