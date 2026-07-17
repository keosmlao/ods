"use server";
import { logChange } from "@/lib/chatter-log";
import { db, query } from "@/lib/db";
import { requirePermission } from "@/lib/guard";
import { revalidatePath } from "next/cache";

/**
 * ລຶບງານຕິດຕັ້ງ — **ອັນຕະລາຍ ແລະ ຍ້ອນຄືນບໍ່ໄດ້** (ຄູ່ກັບ actions/service-delete ຂອງຝັ່ງສ້ອມ).
 *
 * ຜູ້ຈັດການສັ່ງໃຫ້ເປີດປຸ່ມນີ້ໂດຍຮູ້ຄວາມສ່ຽງແລ້ວ. ຄວາມສ່ຽງທີ່ແທ້ຈິງ:
 *   ① ເອກະສານທີ່ຜູກກັບງານ (ໃບຂໍເບີກ · ໃບເບີກ · ໃບຮັບອາໄຫຼ່ · ໃບສົ່ງຄືນ) ຖືກລຶບຕາມ
 *      ບໍ່ດັ່ງນັ້ນມັນຈະກາຍເປັນເອກະສານກຳພ້າທີ່ຊີ້ໄປຫາງານທີ່ບໍ່ມີຕົວຕົນ.
 *   ② **ສະຕັອກ ERP ທີ່ຖືກຕັດໄປແລ້ວ ບໍ່ຄືນມາ** — ການຄືນສະຕັອກຕ້ອງເຮັດຜ່ານໃບຮັບຄືນ
 *      ຂອງສາງເທົ່ານັ້ນ ⇒ ລຶບງານທີ່ເບີກອາໄຫຼ່ໄປແລ້ວ = ອາໄຫຼ່ຫາຍຈາກສາງໂດຍບໍ່ມີເອກະສານ.
 *
 * ⇒ ຜູ້ຈັດການເທົ່ານັ້ນ · ຕ້ອງໃສ່ເຫດຜົນ · ບັນທຶກຫຼັກຖານເຕັມກ່ອນລຶບ.
 *
 * ຢາກໃຫ້ງານອອກຈາກຄິວແຕ່ຮັກສາປະຫວັດ ⇒ ໃຊ້ **ຍົກເລີກງານ** (cancelInstall) ແທນ:
 * ມັນເກັບເຫດຜົນ, ແຈ້ງສາງ ແລະ ພາໄປສ້າງໃບຄືນອາໄຫຼ່ໃຫ້.
 */
export type DeleteInstallState = { error?: string; ok?: string };

export async function deleteInstall(code: string, reason: string): Promise<DeleteInstallState> {
  const guard = await requirePermission("/installations", "delete", ["manager"], "ບໍ່ມີສິດລຶບງານຕິດຕັ້ງ");
  if (!guard.ok) return { error: guard.error };
  if (!db) return { error: "ບໍ່ພົບ DATABASE_URL" };

  const clean = reason.trim();
  if (clean.length < 3) return { error: "ກະລຸນາໃສ່ເຫດຜົນທີ່ລຶບ (ເປັນຫຼັກຖານ)" };

  // ພາບລວມກ່ອນລຶບ — ຂຽນລົງ chatter ໃຫ້ໄດ້ ບໍ່ດັ່ງນັ້ນຫຼັກຖານຫາຍໄປພ້ອມກັບງານ
  const job = (
    await query<{
      code: string;
      cust_code: string | null;
      customer: string | null;
      item: string | null;
      tech: string | null;
      docs: string | null;
      doc_count: number;
    }>(
      `select a.code, a.cust_code,
          c.name_1 as customer,
          concat_ws(' ', a.item_name, a.pro_brand, a.pro_model) as item,
          nullif(a.tech_code,'') as tech,
          (select string_agg(distinct t.doc_no, ', ') from ic_trans t where t.product_code = a.code) as docs,
          (select count(*)::int from ic_trans t where t.product_code = a.code) as doc_count
        from ods_tb_install a
        left join ar_customer c on c.code = a.cust_code
       where a.code = $1`,
      [code],
    )
  ).rows[0];
  if (!job) return { error: "ບໍ່ພົບງານຕິດຕັ້ງນີ້" };

  const client = await db.connect();
  try {
    await client.query("begin");

    // ເອກະສານສາງຂອງງານນີ້
    await client.query("delete from ic_trans_detail where product_code = $1", [code]);
    await client.query("delete from ic_trans where product_code = $1", [code]);
    await client.query("delete from ic_trans_detail_draft where product_code = $1", [code]);
    // ອາໄຫຼ່ · ລາຍລະອຽດ · ຄຳຕິຊົມ ຂອງງານນີ້
    await client.query("delete from tb_used_spare where product_code = $1", [code]);
    await client.query("delete from ods_tb_install_detail where code = $1", [code]);
    await client.query("delete from cust_complain where product_code = $1", [code]);
    // QC · ຮູບຜົນງານ · check-in · ການປະຕິເສດ · ຄ່າຄອມ
    await client.query("delete from ods_qc_result where workflow = 'install' and job_code = $1", [code]);
    await client.query("delete from ods_qc_signature where workflow = 'install' and job_code = $1", [code]);
    await client.query("delete from ods_job_photo where workflow = 'install' and job_code = $1", [code]);
    await client.query("delete from ods_job_checkin where workflow = 'install' and job_code = $1", [code]);
    await client.query("delete from ods_job_reject where workflow = 'install' and job_code = $1", [code]);
    await client.query("delete from ods_service_payout where workflow = 'install' and job_code = $1", [code]);

    const removed = await client.query("delete from ods_tb_install where code = $1", [code]);
    if (!removed.rowCount) {
      await client.query("rollback");
      return { error: "ບໍ່ພົບງານຕິດຕັ້ງນີ້" };
    }

    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    console.error("deleteInstall failed", error);
    return { error: "ລຶບບໍ່ສຳເລັດ" };
  } finally {
    client.release();
  }

  /**
   * ຫຼັກຖານ — ບັນທຶກໃສ່ **ລູກຄ້າ** ເພາະ chatter ຂອງງານເອງຈະບໍ່ມີໃຜເປີດເບິ່ງໄດ້ອີກ
   * (ງານຫາຍໄປແລ້ວ). ແຈ້ງສາງນຳ — ອາໄຫຼ່ທີ່ເບີກໄປແລ້ວກາຍເປັນຂອງທີ່ບໍ່ມີງານຮອງຮັບ.
   */
  const detail =
    `ລຶບງານຕິດຕັ້ງ ${code} (${job.item ?? "-"}) ໂດຍ ${guard.session.username} · ເຫດຜົນ: ${clean}` +
    (job.tech ? ` · ຊ່າງ ${job.tech}` : "") +
    ` · ເອກະສານທີ່ຖືກລຶບຕາມ ${job.doc_count} ໃບ${job.docs ? ` (${job.docs})` : ""}` +
    (job.doc_count > 0 ? " · ⚠️ ສະຕັອກ ERP ທີ່ຕັດໄປແລ້ວ **ບໍ່ຖືກຄືນ**" : "");

  await logChange(job.cust_code ? "ar_customer" : "ods_tb_install", job.cust_code ?? code, detail, {
    roles: ["manager", "stock"],
  });

  revalidatePath("/installations");
  revalidatePath("/dashboard");
  return { ok: `ລຶບງານຕິດຕັ້ງ ${code} ແລ້ວ` };
}
