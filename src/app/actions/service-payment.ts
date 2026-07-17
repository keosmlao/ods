"use server";
import { logChange } from "@/lib/chatter-log";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/guard";
import { SERVICE_SIDE } from "@/lib/roles";
import { ACCEPTED_QUOTE, type CustKind } from "@/lib/service-money";
import { revalidatePath } from "next/cache";
import { z } from "zod";

/**
 * **ບັນທຶກການຊຳລະຄ່າສ້ອມ** — ບ່ອນດຽວທີ່ເງິນເຂົ້າຂອງງານສ້ອມຖືກບັນທຶກ.
 *
 * ── ເປັນຫຍັງຕ້ອງມີ (17-07-2026) ──
 * ລະບົບເກົ່າ**ບໍ່ເຄີຍບັນທຶກວ່າໃຜຈ່າຍ**: ໃບຮັບເງິນ (ic_trans trans_flag=44, SIN)
 * ມີ 4,456 ໃບ ແຕ່ຍອດ **0.00 ທຸກໃບ** ແລະ ບໍ່ເຄີຍໄປຮອດ ERP ⇒ ຄຳຖາມ "ໃຜຄ້າງເງິນ"
 * ຕອບບໍ່ໄດ້ຈັກເທື່ອ. ຕາຕະລາງ `ods_service_payment` ຄືຄຳຕອບ (migration 2026-07-17).
 *
 * ⚠️ ຂໍ້ມູນເກົ່າ: ງານກ່ອນມື້ນີ້ **ບໍ່ມີບັນທຶກການຈ່າຍ** ຈຶ່ງຂຶ້ນເປັນ "ຄ້າງ" ໝົດ
 * (1,044 ງານ = 3.2 ລ້ານບາດ) ເຖິງແມ່ນສ່ວນຫຼາຍຈ່າຍສົດຕອນຮັບເຄື່ອງໄປແລ້ວ.
 * ບໍ່ backfill ໃຫ້ອັດຕະໂນມັດ — ຈະເປັນການແຕ່ງຂໍ້ມູນເງິນ. ໃຫ້ຄົນບັນທຶກເອງເທື່ອລະໃບ.
 */

export type PayState = { error?: string; ok?: boolean };

const METHODS = ["cash", "transfer", "other"] as const;
export const METHOD_LABEL: Record<(typeof METHODS)[number], string> = {
  cash: "ເງິນສົດ",
  transfer: "ໂອນ",
  other: "ອື່ນໆ",
};

const schema = z.object({
  job: z.string().trim().min(1, "ບໍ່ພົບລະຫັດງານ"),
  amount: z.coerce.number().positive("ຍອດຕ້ອງຫຼາຍກວ່າ 0"),
  paid_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "ວັນທີບໍ່ຖືກຮູບແບບ"),
  method: z.enum(METHODS),
  reference: z.string().trim().max(100),
  note: z.string().trim().max(300),
});

export async function recordServicePayment(_: PayState, formData: FormData): Promise<PayState> {
  const guard = await requirePermission("/reports/service-debts", "update", SERVICE_SIDE, "ບໍ່ມີສິດບັນທຶກການຊຳລະ");
  if (!guard.ok) return { error: guard.error };
  if (!db) return { error: "ບໍ່ພົບ DATABASE_URL" };

  const parsed = schema.safeParse({
    job: formData.get("job"),
    amount: formData.get("amount"),
    paid_on: formData.get("paid_on"),
    method: formData.get("method"),
    reference: String(formData.get("reference") ?? ""),
    note: String(formData.get("note") ?? ""),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "ຂໍ້ມູນບໍ່ຄົບ" };
  const d = parsed.data;

  /**
   * ຍອດທີ່ຍັງຄ້າງ — ຄິດຢູ່ **server** ຈາກໃບສະເໜີລາຄາທີ່ລູກຄ້າຕົກລົງ ລົບ ທີ່ຈ່າຍແລ້ວ.
   * ຮັບເກີນຍອດບໍ່ໄດ້ (ພິມຜິດ 1 ຕົວ = ບັນຊີຜິດ) — ຢ່າເຊື່ອຄ່າທີ່ browser ສົ່ງມາ.
   */
  const state = (
    await db.query<{ quoted: string; paid: string }>(
      `select coalesce(sum(q.total_amount),0)::text quoted,
          coalesce((select sum(amount_thb) from ods_service_payment where job_code = $1),0)::text paid
        from ic_trans q where q.product_code = $1 and ${ACCEPTED_QUOTE}`,
      [d.job],
    )
  ).rows[0];
  const quoted = Number(state?.quoted ?? 0);
  const paid = Number(state?.paid ?? 0);
  if (quoted <= 0) return { error: "ງານນີ້ບໍ່ມີໃບສະເໜີລາຄາທີ່ລູກຄ້າຕົກລົງ — ບັນທຶກການຊຳລະບໍ່ໄດ້" };
  const due = quoted - paid;
  if (due <= 0) return { error: "ງານນີ້ຈ່າຍຄົບແລ້ວ" };
  if (d.amount > due + 0.001) return { error: `ຍອດເກີນທີ່ຄ້າງ (ຄ້າງ ${due.toLocaleString()} ບາດ)` };

  await db.query(
    `insert into ods_service_payment(job_code, amount_thb, paid_on, method, reference, note, created_by)
     values($1,$2,$3,$4,$5,$6,$7)`,
    [d.job, d.amount, d.paid_on, d.method, d.reference || null, d.note || null, guard.session.username],
  );

  const left = due - d.amount;
  await logChange(
    "tb_product",
    d.job,
    `ຮັບຊຳລະ ${d.amount.toLocaleString()} ບາດ (${METHOD_LABEL[d.method]}${d.reference ? ` · ${d.reference}` : ""})` +
      (left > 0.001 ? ` — ຍັງຄ້າງ ${left.toLocaleString()} ບາດ` : " — ຈ່າຍຄົບແລ້ວ"),
  );
  revalidatePath("/reports/service-debts");
  revalidatePath("/reports/service-revenue");
  revalidatePath(`/service/${d.job}`);
  return { ok: true };
}

/**
 * ຖອນລາຍການຊຳລະ — ບັນທຶກຜິດແກ້ໄດ້ (ຜູ້ຈັດການ/ແອດມິນ ເທົ່ານັ້ນ ຄືການບັນທຶກ).
 * ບໍ່ລຶບງຽບໆ: ລົງ timeline ວ່າຖອນຫຍັງ ຂອງໃຜ ເທົ່າໃດ.
 */
export async function undoServicePayment(_: PayState, formData: FormData): Promise<PayState> {
  const guard = await requirePermission("/reports/service-debts", "update", SERVICE_SIDE, "ບໍ່ມີສິດຖອນການຊຳລະ");
  if (!guard.ok) return { error: guard.error };
  if (!db) return { error: "ບໍ່ພົບ DATABASE_URL" };

  const id = String(formData.get("id") ?? "").trim();
  if (!/^\d+$/.test(id)) return { error: "ບໍ່ພົບລາຍການ" };

  const row = (
    await db.query<{ job_code: string; amount_thb: string }>(
      `delete from ods_service_payment where id = $1 returning job_code, amount_thb::text`,
      [id],
    )
  ).rows[0];
  if (!row) return { error: "ບໍ່ພົບລາຍການ (ອາດຖືກຖອນໄປແລ້ວ)" };

  await logChange("tb_product", row.job_code, `ຖອນລາຍການຊຳລະ ${Number(row.amount_thb).toLocaleString()} ບາດ`);
  revalidatePath("/reports/service-debts");
  revalidatePath("/reports/service-revenue");
  revalidatePath(`/service/${row.job_code}`);
  return { ok: true };
}

/**
 * ລະບຸປະເພດລູກຄ້າ (ຮ້ານຄ້າ / ທົ່ວໄປ) — ໃຊ້ແຍກລາຍງານງານສ້ອມ.
 * ບໍ່ມີໃນຖານໃດເລີຍມາກ່ອນ (ODS ar_type null 10,040/10,045 · ERP ar_type ເປັນປະເພດບັນຊີ)
 * ⇒ ຄົນຕ້ອງລະບຸເອງ. ແກ້ໄດ້ຕະຫຼອດ (ຮ້ານປິດ/ຄົນເປີດຮ້ານ).
 */
export async function setCustomerKind(_: PayState, formData: FormData): Promise<PayState> {
  const guard = await requirePermission("/customers", "update", SERVICE_SIDE, "ບໍ່ມີສິດແກ້ຂໍ້ມູນລູກຄ້າ");
  if (!guard.ok) return { error: guard.error };
  if (!db) return { error: "ບໍ່ພົບ DATABASE_URL" };

  const code = String(formData.get("code") ?? "").trim();
  const raw = String(formData.get("kind") ?? "").trim();
  if (!code) return { error: "ບໍ່ພົບລູກຄ້າ" };
  const kind: CustKind | null = raw === "shop" || raw === "general" ? raw : null;

  const done = await db.query(`update ar_customer set cust_kind = $2 where code = $1`, [code, kind]);
  if (!done.rowCount) return { error: `ບໍ່ພົບລູກຄ້າ ${code}` };
  revalidatePath("/customers");
  revalidatePath("/reports/service-by-kind");
  revalidatePath("/reports/service-debts");
  return { ok: true };
}
