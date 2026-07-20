"use server";
import { query } from "@/lib/db";
import { requireRole } from "@/lib/guard";
import { APPROVER_SIDE } from "@/lib/roles";
import { revalidatePath } from "next/cache";

export async function setBrandClaim(brand: string, supplier: string, active: boolean): Promise<{ error?: string }> {
  const g = await requireRole(APPROVER_SIDE, "ບໍ່ມີສິດ");
  if (!g.ok) return { error: g.error };
  const b = brand.trim();
  if (!b) return { error: "ເລືອກ ຫຍີ່ຫໍ້" };
  await query(
    `insert into ods_claim_brand(brand_code, supplier_code, active, created_by)
       values ($1, nullif($2,''), $3, $4)
     on conflict (brand_code) do update set supplier_code = excluded.supplier_code, active = excluded.active`,
    [b, supplier, active, g.session.username],
  );
  revalidatePath("/manage/claim-brands");
  revalidatePath("/claims");
  return {};
}

export async function removeBrandClaim(brand: string): Promise<{ error?: string }> {
  const g = await requireRole(APPROVER_SIDE, "ບໍ່ມີສິດ");
  if (!g.ok) return { error: g.error };
  await query(`delete from ods_claim_brand where brand_code = $1`, [brand]);
  revalidatePath("/manage/claim-brands");
  revalidatePath("/claims");
  return {};
}
