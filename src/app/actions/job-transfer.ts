"use server";
import { logChange } from "@/lib/chatter-log";
import { db, query } from "@/lib/db";
import { requireRole } from "@/lib/guard";
import { centerLabel, REPAIR_CENTERS } from "@/lib/repair-center";
import { STOCK_COUNT_SIDE } from "@/lib/roles";
import { revalidatePath } from "next/cache";

export type JobTransferState = { error?: string; ok?: boolean };

function revalidate() {
  revalidatePath("/reports/stock-count");
  revalidatePath("/dashboard");
  revalidatePath("/(app)/dashboard/status/[workflow]/[status]", "page");
}

/**
 * ໂອນງານໄປສ້ອມ **ສູນອື່ນ** — ເປີດ job ບ່ອນນຶ່ງ ແລ້ວ ສົ່ງເຄື່ອງໄປສ້ອມສູນອື່ນ.
 * ບັນທຶກ ods_job_transfer (received_at null = ກຳລັງໂອນ) + ບັງຄັບເຫດຜົນ. ຄາຢູ່ຂັ້ນເດີມ.
 */
export async function transferJob(code: string, toCenter: string, reason: string): Promise<JobTransferState> {
  const g = await requireRole(STOCK_COUNT_SIDE, "ບໍ່ມີສິດໂອນງານ");
  if (!g.ok) return { error: g.error };
  if (!db) return { error: "ບໍ່ພົບ DATABASE_URL" };
  if (!REPAIR_CENTERS.includes(toCenter)) return { error: "ເລືອກສູນປາຍທາງ" };
  const r = reason.trim();
  if (r.length < 3) return { error: "ກະລຸນາບອກເຫດຜົນ (ຢ່າງໜ້ອຍ 3 ຕົວອັກສອນ)" };

  const job = (
    await query<{ product: string | null; center: string | null }>(
      `select a.name_1 product, a.service_center center from tb_product a where a.code = $1 and a.return_complete is null`,
      [code],
    )
  ).rows[0];
  if (!job) return { error: "ບໍ່ພົບໃບຮັບເຄື່ອງນີ້ ຫຼື ງານຈົບໄປແລ້ວ" };
  if (job.center === toCenter) return { error: `ງານຢູ່ສູນ ${centerLabel(toCenter)} ຢູ່ແລ້ວ` };

  await db.query(
    `insert into ods_job_transfer(job_code, from_center, to_center, reason, created_by)
       values($1, $2, $3, $4, $5)
     on conflict (job_code) where received_at is null
       do update set to_center = excluded.to_center, reason = excluded.reason, created_by = excluded.created_by, created_at = now()`,
    [code, job.center, toCenter, r, g.session.username],
  );
  await logChange("tb_product", code, `ໂອນໄປສ້ອມສູນ ${centerLabel(toCenter)} — ${r} (ໂດຍ ${g.session.username}, ລໍສູນປາຍທາງຮັບ)`, {
    roles: ["manager", "stock"],
  });
  revalidate();
  return { ok: true };
}

/** ສູນປາຍທາງ **ຮັບເຂົ້າ** — ເຄື່ອງມາຮອດ ⇒ ปิดการโอน + ตั้ง service_center = สูนใหม่. */
export async function receiveJobTransfer(code: string): Promise<JobTransferState> {
  const g = await requireRole(STOCK_COUNT_SIDE, "ບໍ່ມີສິດຮັບໂອນ");
  if (!g.ok) return { error: g.error };
  if (!db) return { error: "ບໍ່ພົບ DATABASE_URL" };

  const done = await db.query<{ to_center: string }>(
    `update ods_job_transfer set received_at = now(), received_by = $2
      where job_code = $1 and received_at is null returning to_center`,
    [code, g.session.username],
  );
  const to = done.rows[0]?.to_center;
  if (!to) return { error: "ບໍ່ມີການໂອນທີ່ລໍຮັບຢູ່" };
  await db.query(`update tb_product set service_center = $2 where code = $1`, [code, to]);
  await logChange("tb_product", code, `ຮັບເຂົ້າສູນ ${centerLabel(to)} — ໂດຍ ${g.session.username}`, { roles: ["manager", "stock"] });
  revalidate();
  return { ok: true };
}
