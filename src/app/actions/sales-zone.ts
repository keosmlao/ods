"use server";
import { getSession } from "@/lib/auth";
import { query } from "@/lib/db";
import { roleOf } from "@/lib/roles";
import { revalidatePath } from "next/cache";
import { z } from "zod";

/**
 * ຈັດການເຂດຮັບຜິດຊອບຂອງພະນັກງານຂາຍ (ods_sales_zone) — /manage/sales-zones.
 * ຜູ້ຈັດການເທົ່ານັ້ນ. ຂຽນລົງຖານ ODS ເທົ່ານັ້ນ (ERP ອ່ານຢ່າງດຽວ).
 * ເບິ່ງການໃຊ້ເຂດຢູ່ lib/sales-zone (salesZonesFor / zoneWhere).
 */

export type SalesZoneState = { ok?: string; error?: string };

const codeSchema = z.string().trim().min(1).max(32);

async function requireManager(): Promise<{ username: string } | { error: string }> {
  const session = await getSession();
  if (!session) return { error: "Session ໝົດອາຍຸ" };
  if (roleOf(session) !== "manager") return { error: "ບໍ່ມີສິດຈັດການເຂດຂາຍ" };
  return { username: session.username };
}

/** ເພີ່ມເຂດ — city ຫວ່າງ = ຮັບຜິດຊອບທັງແຂວງ. ຊ້ຳ = ບໍ່ເຮັດຫຍັງ. */
export async function addSalesZone(employeeCode: string, provine: string, city: string): Promise<SalesZoneState> {
  const auth = await requireManager();
  if ("error" in auth) return auth;

  const emp = codeSchema.safeParse(employeeCode);
  const prov = codeSchema.safeParse(provine);
  if (!emp.success || !prov.success) return { error: "ກະລຸນາເລືອກ ພະນັກງານ ແລະ ແຂວງ" };
  const cityValue = city.trim() || null;

  await query(
    `insert into ods_sales_zone (employee_code, provine, city, created_by)
     values ($1, $2, $3, $4)
     on conflict (employee_code, provine, city) do nothing`,
    [emp.data, prov.data, cityValue, auth.username],
  );

  revalidatePath("/manage/sales-zones");
  return { ok: "ເພີ່ມເຂດແລ້ວ" };
}

/** ລົບເຂດ — city ຫວ່າງ = ແຖວທັງແຂວງ (city is null). */
export async function removeSalesZone(employeeCode: string, provine: string, city: string): Promise<SalesZoneState> {
  const auth = await requireManager();
  if ("error" in auth) return auth;

  const cityValue = city.trim() || null;
  await query(
    `delete from ods_sales_zone
      where employee_code = $1 and provine = $2 and city is not distinct from $3`,
    [employeeCode, provine, cityValue],
  );

  revalidatePath("/manage/sales-zones");
  return { ok: "ລົບເຂດແລ້ວ" };
}
