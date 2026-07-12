"use server";
import { db, odgDb } from "@/lib/db";
import {
  computePayout,
  ERP_DIMS_SQL,
  JOB_DIMS_INSTALL_SQL,
  JOB_DIMS_REPAIR_SQL,
  type JobDims,
  type Workflow,
} from "@/lib/commission";

/**
 * ຄິດ ແລະ ແຊ່ຄ່າຄອມຂອງງານທີ່ຫາກໍ່ປິດ.
 *
 * ── ຫ້າມພັງ ──
 * ການປິດງານ **ຫ້າມລົ້ມເພາະເລື່ອງເງິນ**. ທຸກຄວາມຜິດພາດຢູ່ນີ້ຖືກກືນ (log ໄວ້)
 * ແລ້ວປ່ອຍໃຫ້ງານປິດຕາມປົກກະຕິ — ງານທີ່ຄິດເງິນບໍ່ໄດ້ຈະຂຶ້ນຢູ່ລາຍງານ
 * "ຍັງບໍ່ໄດ້ຄິດຄ່າບໍລິການ" ໃຫ້ໄປແກ້ (ບໍ່ມີເງິນຫາຍງຽບໆ).
 *
 * ── ເປັນຫຍັງບໍ່ຢູ່ໃນ transaction ຂອງການປິດງານ ──
 * ມິຕິ (ໝວດ/ແບບ/ຂະໜາດ) ຢູ່ຖານ ERP ຄົນລະຖານ ⇒ join ຂ້າມຖານບໍ່ໄດ້ ແລະ ດຶງ ERP
 * ຢູ່ໃນ transaction ຂອງ ODS ຈະຖືວ່າຖື lock ໄວ້ດົນໂດຍບໍ່ຈຳເປັນ.
 * ຄິດຊ້ຳກໍ່ບໍ່ເປັນຫຍັງ — unique(workflow, job_code, role) ກັນເງິນຊ້ຳໄວ້ແລ້ວ.
 */
export async function recordPayout(workflow: Workflow, jobCode: string): Promise<void> {
  if (!db || !odgDb) return;

  try {
    const jobSql = workflow === "install" ? JOB_DIMS_INSTALL_SQL : JOB_DIMS_REPAIR_SQL;
    const job = (
      await db.query<JobDims & { item_code: string | null }>(jobSql, [jobCode])
    ).rows[0];
    if (!job) return;

    // ບໍ່ມີລະຫັດສິນຄ້າ ERP ⇒ ຮູ້ ໝວດ/ແບບ/ຂະໜາດ ບໍ່ໄດ້ (ງານເກົ່າ ຫຼື ສິນຄ້າທີ່ພິມຊື່ເອງ)
    let dims: JobDims = { ...job, category_code: null, design_code: null, size_code: null };
    if (job.item_code) {
      const erp = (
        await odgDb.query<{ category_code: string | null; design_code: string | null; size_code: string | null }>(
          ERP_DIMS_SQL,
          [job.item_code],
        )
      ).rows[0];
      if (erp) dims = { ...dims, ...erp };
    }

    const client = await db.connect();
    try {
      await client.query("begin");
      await computePayout(client, workflow, dims);
      await client.query("commit");
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    // ກືນໄວ້ — ການປິດງານຕ້ອງສຳເລັດຢູ່ດີ
    console.error(`recordPayout(${workflow}, ${jobCode}) failed`, error);
  }
}
