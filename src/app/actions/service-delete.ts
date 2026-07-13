"use server";
import { logChange } from "@/app/actions/chatter";
import { db, query } from "@/lib/db";
import { requirePermission } from "@/lib/guard";
import { revalidatePath } from "next/cache";

/**
 * ລຶບໃບຮັບເຄື່ອງ (ງານສ້ອມ) — **ອັນຕະລາຍ ແລະ ຍ້ອນຄືນບໍ່ໄດ້**.
 *
 * ── ອ່ານກ່ອນແກ້ ──
 * ຜູ້ຈັດການສັ່ງໃຫ້ເປີດປຸ່ມນີ້ໂດຍຮູ້ຄວາມສ່ຽງແລ້ວ (13-07-2026). ຄວາມສ່ຽງທີ່ແທ້ຈິງ:
 *
 *   ① ເອກະສານທີ່ຜູກກັບໃບນີ້ (ໃບສະເໜີລາຄາ · ໃບຂໍເບີກ · ໃບເບີກ · ໃບຮັບເງິນ)
 *      ຖືກລຶບຕາມ — ບໍ່ດັ່ງນັ້ນມັນຈະກາຍເປັນເອກະສານກຳພ້າທີ່ຊີ້ໄປຫາໃບທີ່ບໍ່ມີຕົວຕົນ.
 *   ② **ສະຕັອກ ERP ທີ່ຖືກຕັດໄປແລ້ວ ບໍ່ຄືນມາ** — ລະບົບນີ້ບໍ່ໄດ້ຄຸມ ic_inventory ຂອງ ERP
 *      ແລະ ການ "ຄືນສະຕັອກ" ຕ້ອງເຮັດຜ່ານໃບຮັບຄືນຂອງສາງເທົ່ານັ້ນ ⇒ ຖ້າລຶບໃບທີ່ເບີກ
 *      ອາໄຫຼ່ໄປແລ້ວ ອາໄຫຼ່ຈະຫາຍຈາກສາງໂດຍບໍ່ມີເອກະສານໃດອະທິບາຍ.
 *
 * ⇒ ດ້ວຍເຫດນັ້ນ:
 *   · ຜູ້ຈັດການເທົ່ານັ້ນ
 *   · ຕ້ອງໃສ່ເຫດຜົນ
 *   · ບັນທຶກ **ຫຼັກຖານເຕັມ** ໄວ້ໃນ chatter ຂອງລູກຄ້າ (ໃຜລຶບ · ໃບໃດ · ເອກະສານກີ່ໃບ
 *     ເລກທີຫຍັງແດ່ · ອາໄຫຼ່ກີ່ລາຍການ) ກ່ອນລຶບ — ຕົວໃບຫາຍໄປແລ້ວ ແຕ່ຮ່ອງຮອຍຍັງຢູ່.
 *
 * ຖ້າພຽງແຕ່ຢາກໃຫ້ງານ "ບໍ່ຢູ່ໃນຄິວ" → ໃຊ້ **ຍົກເລີກງານ** (/service/cancel) ແທນ:
 * ມັນເກັບປະຫວັດ, ຜ່ານການອະນຸມັດ ແລະ ພາໄປສ້າງໃບຄືນອາໄຫຼ່ໃຫ້.
 */
export type DeleteState = { error?: string; ok?: string };

export async function deleteService(code: string, reason: string): Promise<DeleteState> {
  const guard = await requirePermission("/service", "delete", ["manager"], "ບໍ່ມີສິດລຶບໃບຮັບເຄື່ອງ");
  if (!guard.ok) return { error: guard.error };
  if (!db) return { error: "ບໍ່ພົບ DATABASE_URL" };

  const clean = reason.trim();
  if (clean.length < 3) return { error: "ກະລຸນາໃສ່ເຫດຜົນທີ່ລຶບ (ເປັນຫຼັກຖານ)" };

  // ພາບລວມກ່ອນລຶບ — ຂຽນລົງ chatter ໃຫ້ໄດ້ ບໍ່ດັ່ງນັ້ນຫຼັກຖານຫາຍໄປພ້ອມກັບໃບ
  const job = (
    await query<{
      code: string;
      customer: string | null;
      cust_code: string | null;
      product: string | null;
      docs: string | null;
      doc_count: number;
      spares: number;
    }>(
      `select a.code,
          b.name_1 as customer, a.cust_code,
          concat_ws(' ', a.name_1, a.p_brand, a.p_model) as product,
          (select string_agg(distinct t.doc_no, ', ') from ic_trans t where t.product_code = a.code) as docs,
          (select count(*)::int from ic_trans t where t.product_code = a.code) as doc_count,
          (select count(*)::int from tb_used_spare s where s.product_code = a.code) as spares
        from tb_product a
        left join ar_customer b on b.code = a.cust_code
       where a.code = $1`,
      [code],
    )
  ).rows[0];
  if (!job) return { error: "ບໍ່ພົບໃບຮັບເຄື່ອງນີ້" };

  const client = await db.connect();
  try {
    await client.query("begin");

    // ເອກະສານຂອງໃບນີ້ (ໃບສະເໜີລາຄາ · ຂໍເບີກ · ເບີກ · ຮັບເງິນ · ຮັບຄືນ …)
    await client.query("delete from ic_trans_detail where product_code = $1", [code]);
    await client.query("delete from ic_trans where product_code = $1", [code]);
    await client.query("delete from ic_trans_detail_draft where product_code = $1", [code]);
    // ອາໄຫຼ່ · ຮູບ · ຜູ້ຕິດຕໍ່ · ຄຳຕິຊົມ ຂອງໃບນີ້
    await client.query("delete from tb_used_spare where product_code = $1", [code]);
    await client.query("delete from product_image where iteme_code = $1", [code]);
    await client.query("delete from cust_contactor where product_code = $1", [code]);
    await client.query("delete from cust_complain where product_code = $1", [code]);
    // ຜົນ QC · ຮູບຜົນງານ · check-in ຂອງໃບນີ້
    await client.query("delete from ods_qc_result where workflow = 'repair' and job_code = $1", [code]);
    await client.query("delete from ods_qc_signature where workflow = 'repair' and job_code = $1", [code]);
    await client.query("delete from ods_job_photo where workflow = 'repair' and job_code = $1", [code]);
    await client.query("delete from ods_job_checkin where workflow = 'repair' and job_code = $1", [code]);
    await client.query("delete from ods_job_reject where workflow = 'repair' and job_code = $1", [code]);
    // ຄ່າຄອມທີ່ແຊ່ໄວ້ (ຖ້າມີ) — ງານບໍ່ມີແລ້ວ ຈຶ່ງບໍ່ຄວນຈ່າຍ
    await client.query("delete from ods_service_payout where workflow = 'repair' and job_code = $1", [code]);

    const removed = await client.query("delete from tb_product where code = $1", [code]);
    if (!removed.rowCount) {
      await client.query("rollback");
      return { error: "ບໍ່ພົບໃບຮັບເຄື່ອງນີ້" };
    }

    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    console.error("deleteService failed", error);
    return { error: "ລຶບບໍ່ສຳເລັດ" };
  } finally {
    client.release();
  }

  /**
   * ຫຼັກຖານ — ບັນທຶກໃສ່ **ລູກຄ້າ** (ar_customer) ເພາະ chatter ຂອງໃບເອງຈະບໍ່ມີໃຜເປີດເບິ່ງ
   * ໄດ້ອີກແລ້ວ (ໃບຫາຍໄປແລ້ວ). ຖ້າໃບບໍ່ມີລູກຄ້າ ຈຶ່ງບັນທຶກໃສ່ຕົວໃບ (ຍັງເຫັນຢູ່ໜ້າກິດຈະກຳ).
   */
  const detail =
    `ລຶບໃບຮັບເຄື່ອງ #${code} (${job.product ?? "-"}) ໂດຍ ${guard.session.username} · ເຫດຜົນ: ${clean}` +
    ` · ເອກະສານທີ່ຖືກລຶບຕາມ ${job.doc_count} ໃບ${job.docs ? ` (${job.docs})` : ""}` +
    ` · ອາໄຫຼ່ ${job.spares} ລາຍການ` +
    (job.doc_count > 0 ? " · ⚠️ ສະຕັອກ ERP ທີ່ຕັດໄປແລ້ວ **ບໍ່ຖືກຄືນ**" : "");

  await logChange(job.cust_code ? "ar_customer" : "tb_product", job.cust_code ?? code, detail, {
    roles: ["manager", "stock"],
  });

  revalidatePath("/service");
  revalidatePath("/dashboard");
  return { ok: `ລຶບໃບຮັບເຄື່ອງ ${code} ແລ້ວ` };
}
