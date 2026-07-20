"use server";
import { query } from "@/lib/db";
import { requireRole } from "@/lib/guard";
import { APPROVER_SIDE } from "@/lib/roles";
import { revalidatePath } from "next/cache";

/**
 * ກວດນັບສະຕັອກ — ບັນທຶກ "ນັບແລ້ວ" ລົງ DB (ຕາຕະລາງ ods_stock_count) ແທນ localStorage
 * ⇒ ແບ່ງກັນຫຼາຍຄົນ/ເຄື່ອງ + ດຶງໄປເຮັດລາຍງານໄດ້. ໝາຍ/ຍົກເລີກ ຕົວຕໍ່ຕົວ (optimistic ຝັ່ງ client).
 */
export type CountState = { error?: string };

export async function markCounted(code: string): Promise<CountState> {
  const guard = await requireRole(APPROVER_SIDE, "ບໍ່ມີສິດກວດນັບສະຕັອກ");
  if (!guard.ok) return { error: guard.error };
  const c = code.trim();
  if (!c) return { error: "ບໍ່ພົບ code" };
  await query(
    `insert into ods_stock_count (job_code, counted_at, counted_by)
       values ($1, now(), $2)
     on conflict (job_code) do update set counted_at = now(), counted_by = excluded.counted_by`,
    [c, guard.session.username],
  );
  return {};
}

export async function unmarkCounted(code: string): Promise<CountState> {
  const guard = await requireRole(APPROVER_SIDE, "ບໍ່ມີສິດກວດນັບສະຕັອກ");
  if (!guard.ok) return { error: guard.error };
  await query(`delete from ods_stock_count where job_code = $1`, [code.trim()]);
  return {};
}

/** ລ້າງການນັບທັງໝົດ — ເລີ່ມກວດນັບຮອບໃໝ່ (ອອກລາຍງານກ່ອນລ້າງ) */
export async function resetStockCount(): Promise<CountState> {
  const guard = await requireRole(APPROVER_SIDE, "ບໍ່ມີສິດກວດນັບສະຕັອກ");
  if (!guard.ok) return { error: guard.error };
  await query(`delete from ods_stock_count`);
  revalidatePath("/service/stock-count");
  revalidatePath("/reports/stock-count");
  return {};
}
