"use server";
import { requireRole } from "@/lib/guard";
import { refreshRepairStock } from "@/lib/repair-stock-cache";
import { STOCK_SIDE } from "@/lib/roles";
import { revalidatePath } from "next/cache";

/** ດຶງຄົງເຫຼືອ ສາງສ້ອມ ໃໝ່ຈາກ ERP → cache (ຊ້າ ~25ວິ). ສິດ = ຝ່າຍສາງ. */
export async function refreshRepairStockAction(): Promise<{ ok?: string; error?: string }> {
  const guard = await requireRole(STOCK_SIDE, "ບໍ່ມີສິດດຶງຂໍ້ມູນ");
  if (!guard.ok) return { error: guard.error };
  try {
    const { count } = await refreshRepairStock();
    revalidatePath("/stock/balance/repair");
    return { ok: `ດຶງໃໝ່ສຳເລັດ — ${count} ລາຍການ` };
  } catch (error) {
    console.error("refreshRepairStockAction failed", error);
    return { error: "ດຶງຂໍ້ມູນບໍ່ສຳເລັດ — ERP ອາດຊ້າ ຫຼື ບໍ່ພ້ອມ, ລອງໃໝ່" };
  }
}
