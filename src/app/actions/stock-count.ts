"use server";
import { holdJob } from "@/app/actions/job-hold";
import { requireRole } from "@/lib/guard";
import { APPROVER_SIDE } from "@/lib/roles";
import { SETTING, settingEnabled } from "@/lib/settings";
import { inScopeCodes } from "@/lib/stock-count";
import { revalidatePath } from "next/cache";

/**
 * **ສຳເລັດການກວດນັບ** — client ສົ່ງ code ທີ່ **ສະແກນພົບ** ມາ, server ຄິດເອງວ່າ
 * ອັນໃດ "ບໍ່ພົບ" (ຢູ່ໃນຂອບເຂດ ແຕ່ບໍ່ຖືກສະແກນ) ແລ້ວ **ໝາຍ 'ຕ້ອງກວດ' ອັດຕະໂນມັດ**.
 *
 * ── ເປັນຫຍັງ server ຄິດ missing ເອງ ──
 * ຫ້າມເຊື່ອລາຍການ "ບໍ່ພົບ" ຈາກ browser (ອາດຖືກປອມ/ຄ້າງ). server ດຶງຂອບເຂດສົດ
 * ແລ້ວລົບ scanned ອອກ ⇒ missing ຈິງ. ໃຊ້ holdJob ຕົວດຽວກັບປຸ່ມ "ຕ້ອງກວດ"
 * (ກວດສິດ + setting + stamp ຂັ້ນ + log ຄືກັນ) ⇒ ບໍ່ມີ 2 ເສັ້ນທາງທີ່ຕ້ອງດູແລ.
 */
export type StockCountResult = { error?: string; held?: number; missing?: number };

export async function finalizeStockCount(scanned: string[]): Promise<StockCountResult> {
  const guard = await requireRole(APPROVER_SIDE, "ບໍ່ມີສິດກວດນັບສະຕ໋ອກ");
  if (!guard.ok) return { error: guard.error };
  if (!(await settingEnabled(SETTING.JOB_HOLD))) {
    return { error: "ຄວາມສາມາດ “ໝາຍວຽກມີບັນຫາ” ຖືກປິດຢູ່ (ຜູ້ຈັດການເປີດໄດ້ທີ່ ການຕັ້ງຄ່າລະບົບ)" };
  }

  const scannedSet = new Set(scanned.map((code) => code.trim()).filter(Boolean));
  const missing = (await inScopeCodes()).filter((code) => !scannedSet.has(code));

  let held = 0;
  for (const code of missing) {
    const fd = new FormData();
    fd.set("workflow", "repair");
    fd.set("job_code", code);
    fd.set("kind", "other");
    fd.set("reason", "ກວດນັບສະຕ໋ອກ: ບໍ່ພົບຕົວ (ບໍ່ຖືກສະແກນ)");
    const res = await holdJob({}, fd);
    if (!res?.error) held += 1;
  }

  revalidatePath("/service/stock-count");
  return { held, missing: missing.length };
}
