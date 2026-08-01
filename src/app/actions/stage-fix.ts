"use server";
import { logChange } from "@/lib/chatter-log";
import { query } from "@/lib/db";
import { requireRole } from "@/lib/guard";
import { STAGE_LABEL, STAGE_SQL } from "@/lib/stage";
import { FIXABLE_STAGES, stageFixSql, type FixableStage } from "@/lib/stage-fix";
import { revalidatePath } from "next/cache";

/**
 * **ແກ້ຂັ້ນຂອງໃບງານໃຫ້ຕົງກັບຄວາມຈິງ** — ສະເພາະຜູ້ຈັດການ.
 *
 * ມີໃບເກົ່າຄ້າງຢູ່ຂັ້ນຜິດເປັນຮ້ອຍໆໃບ (ເກົ່າສຸດ 346 ມື້) ເພາະຄົນລືມກົດຂັ້ນຕໍ່ໄປ
 * ຫຼື ຂໍ້ມູນຍ້າຍມາຈາກລະບົບເກົ່າ ⇒ ຄິວ ແລະ ລາຍງານທັງໝົດຜິດຕາມ. ເມື່ອກ່ອນແກ້ໄດ້
 * ພຽງ **ຂຽນ SQL ໃສ່ຖານໂດຍກົງ** ເຊິ່ງບໍ່ມີໃຜກວດ ແລະ ບໍ່ມີບັນທຶກ.
 *
 * ── ດ່ານ ──
 * ① ຜູ້ຈັດການເທົ່ານັ້ນ  ② ຕ້ອງມີເຫດຜົນ  ③ ບັນທຶກລົງ chatter ທຸກເທື່ອ (ຈາກຂັ້ນໃດ→ຂັ້ນໃດ)
 * ④ ໃບທີ່ **ອອກໃບຮັບເງິນ** ຫຼື **ຢູ່ຂັ້ນຕອນຍົກເລີກ** ແລ້ວ ຫ້າມແຕະ — ຕົວເລກເງິນ/ຄິວ
 *    ຍົກເລີກຈະຂັດກັນຢ່າງງຽບໆ (ຫຼັກການດຽວກັບ blockedBy ຂອງ actions/checking).
 */
export type StageFixState = { ok?: string; error?: string };

const NOW = "localtimestamp(0)";
const INVOICE = 44;

export async function fixJobStage(code: string, stage: number, reason: string): Promise<StageFixState> {
  const guard = await requireRole(["manager"], "ສະເພາະຜູ້ຈັດການເທົ່ານັ້ນທີ່ແກ້ຂັ້ນໄດ້");
  if (!guard.ok) return { error: guard.error };

  if (!FIXABLE_STAGES.includes(stage as FixableStage)) {
    return { error: "ຂັ້ນນີ້ຕັ້ງໂດຍກົງບໍ່ໄດ້ — ຂັ້ນສະເໜີລາຄາ/ເບີກ/ສັ່ງຊື້ ຄິດຈາກເອກະສານຈິງ" };
  }
  const note = reason.trim();
  if (!note) return { error: "ຕ້ອງໃສ່ເຫດຜົນ — ເປັນບັນທຶກວ່າເປັນຫຍັງຈຶ່ງແກ້" };

  const job = (
    await query<{ stage: number; status: number | null; invoice_doc: string | null }>(
      `select (${STAGE_SQL})::int stage, a.status,
          (select t.doc_no from ic_trans t
            where t.trans_flag = ${INVOICE} and t.product_code = a.code order by t.doc_no limit 1) invoice_doc
        from tb_product a where a.code = $1 limit 1`,
      [code],
    )
  ).rows[0];
  if (!job) return { error: "ບໍ່ພົບໃບງານນີ້" };

  // ④ ດ່ານ — ຂໍ້ຄວາມບອກ**ເລກເອກະສານ**ທີ່ຂວາງຢູ່ ໃຫ້ຮູ້ວ່າຕ້ອງໄປຈັດການໃບໃດກ່ອນ
  if (job.invoice_doc) {
    return { error: `ໃບນີ້ອອກໃບຮັບເງິນ ${job.invoice_doc} ໄປແລ້ວ — ແກ້ຂັ້ນບໍ່ໄດ້` };
  }
  if (job.status === 6) {
    return { error: "ໃບນີ້ຢູ່ໃນຂັ້ນຕອນຍົກເລີກ — ຈັດການຄິວຍົກເລີກກ່ອນ" };
  }
  if (job.stage === stage) {
    return { error: `ໃບນີ້ຢູ່ຂັ້ນ "${STAGE_LABEL[stage]}" ຢູ່ແລ້ວ` };
  }

  const before = STAGE_LABEL[job.stage] ?? String(job.stage);
  await query(
    `update tb_product set ${stageFixSql(stage as FixableStage, NOW)} where code = $1`,
    [code],
  );

  // ອ່ານຂັ້ນຄືນ **ຈາກຖານ** ບໍ່ແມ່ນເຊື່ອວ່າຕັ້ງໄດ້ — ຖ້າຖັນອື່ນດຶງໄວ້ ຈະໄດ້ຮູ້ທັນທີ
  const after = (
    await query<{ stage: number }>(`select (${STAGE_SQL})::int stage from tb_product a where a.code = $1`, [code])
  ).rows[0]?.stage;

  await logChange(
    "tb_product",
    code,
    `ແກ້ຂັ້ນໃບງານ: "${before}" → "${STAGE_LABEL[after ?? stage] ?? after}" · ເຫດຜົນ: ${note}`,
    { roles: ["manager", "headtechnical", "admin"] },
  );

  revalidatePath(`/service/${code}`);
  revalidatePath("/dashboard");
  revalidatePath("/overview");

  /**
   * ອ່ານຄືນແລ້ວບໍ່ຕົງກັບທີ່ຕັ້ງ = **ບໍ່ແມ່ນຄວາມຜິດພາດສະເໝີໄປ** — STAGE_SQL ມີກົດອື່ນ
   * ທີ່ຊະນະ. ວັດແທ້: ງານ IH/PS ທີ່ລ້າງເວລາກວດອອກ ຈະຕົກເປັນ **ຂັ້ນ 0** (ລໍໄປຮັບ /
   * ລໍນັດໝາຍ) ບໍ່ແມ່ນຂັ້ນ 1 ເພາະຍັງບໍ່ມີ pickup_at / appoint_date — ອັນນັ້ນຖືກແລ້ວ.
   * ຈຶ່ງບອກ**ຜົນຈິງ**ໃຫ້ຮູ້ ແທນທີ່ຈະບອກວ່າສຳເລັດ ຫຼື ລົ້ມເຫຼວລ້າໆ.
   */
  if (after !== stage) {
    return {
      ok: `ແກ້ແລ້ວ — ໃບໄປຢູ່ຂັ້ນ "${STAGE_LABEL[after ?? 0] ?? after}" (ບໍ່ແມ່ນ "${STAGE_LABEL[stage]}") ເພາະເງື່ອນໄຂອື່ນຂອງໃບນີ້ ເຊັ່ນ ງານນອກສະຖານທີ່ທີ່ຍັງບໍ່ມີວັນນັດ ຫຼື ໃບຂໍເບີກທີ່ຍັງຄ້າງ`,
    };
  }
  return { ok: `ຍ້າຍໄປຂັ້ນ "${STAGE_LABEL[stage]}" ແລ້ວ` };
}
