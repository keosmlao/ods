"use server";
import { query } from "@/lib/db";
import { requireRole } from "@/lib/guard";
import type { Role } from "@/lib/roles";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

/** ຕັ້ງເປົ້າໄດ້ສະເພາະຜູ້ຈັດການ/ແອດມິນ — ຄືສິດເບິ່ງລາຍງານເງິນ (lib/roles /reports/monthly-revenue) */
const TARGET_SIDE: Role[] = ["manager", "admin"];

/**
 * ບັນທຶກເປົ້າ**ທັງປີ**ເທື່ອດຽວ (ຟອມ 12 ຊ່ອງ amount_1..amount_12 ຈາກໜ້າຕັ້ງເປົ້າ).
 * ຊ່ອງຫວ່າງ = **ລຶບເປົ້າ**ຂອງເດືອນນັ້ນ (ບໍ່ແມ່ນ 0 — "ບໍ່ຕັ້ງ" ກັບ "ເປົ້າສູນ" ຄົນລະຄວາມໝາຍ).
 */
export async function saveRevenueTargets(formData: FormData) {
  const guard = await requireRole(TARGET_SIDE, "ບໍ່ມີສິດຕັ້ງເປົ້າລາຍຮັບ");
  if (!guard.ok) return;

  const year = Number(String(formData.get("year") ?? ""));
  if (!Number.isInteger(year) || year < 2000 || year > 2100) return;

  for (let month = 1; month <= 12; month++) {
    const raw = String(formData.get(`amount_${month}`) ?? "").replace(/,/g, "").trim();
    if (raw === "") {
      await query(`delete from ods_revenue_target where year=$1 and month=$2`, [year, month]);
      continue;
    }
    const amount = Number(raw);
    if (!Number.isFinite(amount) || amount < 0 || amount > 999_999_999) continue;
    await query(
      `insert into ods_revenue_target (year, month, amount, updated_by)
       values ($1, $2, $3, $4)
       on conflict (year, month) do update
         set amount = excluded.amount, updated_by = excluded.updated_by, updated_at = localtimestamp(0)`,
      [year, month, amount, guard.session.username],
    );
  }

  revalidatePath("/reports/monthly-revenue");
  revalidatePath("/manage/revenue-targets");
  redirect(`/manage/revenue-targets?year=${year}`);
}
