import { query } from "@/lib/db";
import type { PoolClient } from "pg";

/**
 * **ວຽກ ↔ ໃບ ERP ທີ່ລະບົບນີ້ອອກເອງ — ດັດຊະນີຢູ່ ODS.**
 *
 * ── ເປັນຫຍັງບໍ່ເຊື່ອ ERP ຢ່າງດຽວ ──
 * ຕອນອອກໃບ ເຮົາຂຽນເລກວຽກໄວ້ໃນ `doc_ref` (+ `remark`) ຂອງ ERP — ແຕ່ **ຄົນ ERP
 * ແກ້ຊ່ອງນັ້ນໄດ້**. ເກີດຂຶ້ນຈິງ 17-07-2026: SPR26070008 ຂອງວຽກ 7521 ຖືກເປີດແກ້
 * ໃນ ERP ຫຼັງອະນຸມັດ ⇒ doc_ref ຖືກລ້າງ ⇒ ວຽກກັບໃບຂາດຈາກກັນ ⇒ ໜ້າຈໍຂຶ້ນ
 * "ບໍ່ພົບໃນ ERP" ແລ້ວຍື່ນປຸ່ມ "ຍົກເລີກສັ່ງຊື້" ໃຫ້ກົດ (ກົດແລ້ວລຶບການສັ່ງຊື້ຈິງຖິ້ມ).
 *
 * ── ນີ້ບໍ່ຂັດກັບ "ທຸກຢ່າງຢູ່ ERP" ──
 * ເອກະສານຍັງຢູ່ ERP ບ່ອນດຽວ. ບ່ອນນີ້ເກັບພຽງ**ຕົວຊີ້** (ວຽກ → ເລກໃບ): ບໍ່ມີລາຍການ,
 * ບໍ່ມີລາຄາ, ບໍ່ມີຈຳນວນ ⇒ ຂັດແຍ້ງກັບ ERP ບໍ່ໄດ້ ເພາະບໍ່ໄດ້ເກັບຄວາມຈິງອັນດຽວກັນຊ້ຳ.
 *
 * ⚠️ ໃບເກົ່າ (ກ່ອນ 17-07-2026) ບໍ່ມີໃນນີ້ ⇒ ຜູ້ອ່ານຕ້ອງໃຊ້ doc_ref/remark/RQ
 * ເປັນທາງສຳຮອງຕໍ່ໄປ. ຢ່າຖືວ່າ "ບໍ່ມີໃນຕາຕະລາງນີ້ = ບໍ່ມີໃບ".
 */

/** ຜູກໃບກັບວຽກ — ເອີ້ນ**ໃນ transaction ດຽວກັນກັບທີ່ຂຽນ ERP** (ERP ລົ້ມ ⇒ ຜູກກໍ່ຫາຍນຳ) */
export async function linkErpDoc(
  client: PoolClient,
  input: { docNo: string; transFlag: number; jobCode: string; by?: string },
): Promise<void> {
  const docNo = input.docNo.trim();
  const jobCode = input.jobCode.trim();
  // ໃບທີ່ບໍ່ຜູກວຽກ (ຊື້ຕຸນເຂົ້າສາງ) ບໍ່ຕ້ອງມີແຖວ — ບໍ່ແມ່ນຄວາມຜິດພາດ
  if (!docNo || !jobCode) return;
  await client.query(
    `insert into ods_erp_doc_link(doc_no, trans_flag, job_code, created_by)
     values($1,$2,$3,$4)
     on conflict (doc_no, trans_flag) do update set job_code = excluded.job_code`,
    [docNo, input.transFlag, jobCode, input.by ?? ""],
  );
}

/** ເລກໃບທັງໝົດທີ່ຜູກກັບວຽກເຫຼົ່ານີ້ — ໃຊ້ຕື່ມເປັນກະແຈຕອນຄົ້ນຕ່ອງໂສ້ຢູ່ ERP */
export async function docsForJobs(jobCodes: string[]): Promise<string[]> {
  const jobs = [...new Set(jobCodes.filter(Boolean))];
  if (!jobs.length) return [];
  try {
    return (
      await query<{ doc_no: string }>(
        `select distinct doc_no from ods_erp_doc_link where job_code = any($1::text[])`,
        [jobs],
      )
    ).rows.map((row) => row.doc_no);
  } catch (error) {
    // ຊ່ວງ deploy ກ່ອນ migration: ຢ່າໃຫ້ໜ້າລົ້ມ — ຕົກໄປໃຊ້ທາງສຳຮອງ (doc_ref/remark)
    console.error("docsForJobs failed", error);
    return [];
  }
}

/** ເລກໃບ → ເລກວຽກ — ໃຫ້ໜ້າລາຍການໃບບອກໄດ້ວ່າໃບນີ້ຂອງງານໃດ */
export async function jobsForDocs(docNos: string[]): Promise<Map<string, string>> {
  const docs = [...new Set(docNos.filter(Boolean))];
  if (!docs.length) return new Map();
  try {
    const rows = (
      await query<{ doc_no: string; job_code: string }>(
        `select doc_no, job_code from ods_erp_doc_link where doc_no = any($1::text[])`,
        [docs],
      )
    ).rows;
    return new Map(rows.map((row) => [row.doc_no, row.job_code]));
  } catch (error) {
    console.error("jobsForDocs failed", error);
    return new Map();
  }
}
