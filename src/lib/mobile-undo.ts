import { logChange } from "@/lib/chatter-log";
import { db, query } from "@/lib/db";
import { ownJob, type FlowResult } from "@/lib/job-flow";
import type { Session } from "@/lib/auth";
import { STAGE_SQL } from "@/lib/stage";

/**
 * **ຖອຍຫຼັງ 1 ຂັ້ນ** (undo) ຝັ່ງແອັບຊ່າງ — ຍົກເລີກ action ຫຼ້າສຸດຂອງຊ່າງ:
 *   ຈົບສ້ອມ (10) → ກຳລັງສ້ອມ (9) · ເລີ່ມສ້ອມ (9) → ລໍຖ້າສ້ອມ (8) ·
 *   ຜົນກວດເຊັກ (3–8) → ກຳລັງກວດ (2) · ເລີ່ມກວດ (2) → ລໍຖ້າກວດ (1)
 *
 * ⚠️ ຄັດລອກ guard + SQL ຈາກ actions/checking & repair (web) ໃຫ້ຕົງກັນ — ແຕ່ຮັບ
 * session ຈາກ Bearer (ບໍ່ແມ່ນ cookie). ມີໃບເບີກ/ໃບລາຄາແລ້ວ = ຖອຍບໍ່ໄດ້ (ຕິດຕໍ່ CS).
 */

const POST_CHECK_STATUS = `case
  when coalesce(used_spare,0)=1 then (case when warrunty='ຮັບປະກັນ' then 3 else 2 end)
  else (case when warrunty='ຮັບປະກັນ' then 4 else 2 end)
end`;

type Row = {
  repair_confirm: Date | null;
  time_check: Date | null;
  time_finish_check: Date | null;
  time_repair: Date | null;
  time_finish_repair: Date | null;
  qc_finish: Date | null;
  /** ຖືກ QC ສົ່ງກັບມາແກ້ຈັກເທື່ອແລ້ວ (ຫວ່າງ = ບໍ່ເຄີຍ) — ເບິ່ງ lib/qc-flow */
  qc_reject_at: Date | null;
  qt_start: Date | null;
  spare_reg: Date | null;
  status: number | null;
  return_complete: Date | null;
};

const CHANGED = { ok: false as const, error: "ຖອນຄືນບໍ່ສຳເລັດ — ວຽກຖືກປ່ຽນໄປແລ້ວ" };

export async function undoLastStep(session: Session, code: string): Promise<FlowResult> {
  const own = await ownJob(session, "repair", code);
  if (!own.ok) return own;
  const author = session.username;

  const job = (
    await query<Row>(
      `select a.repair_confirm, a.time_check, a.time_finish_check, a.time_repair, a.time_finish_repair,
          a.qc_finish, a.qc_reject_at, a.qt_start, a.spare_reg, a.status, a.return_complete
        from tb_product a where a.code=$1`,
      [code],
    )
  ).rows[0];
  if (!job) return { ok: false, error: "ບໍ່ພົບໃບຮັບເຄື່ອງ" };
  if (job.status === 6) return { ok: false, error: "ໃບນີ້ຢູ່ຂັ້ນຍົກເລີກ — ຖອຍບໍ່ໄດ້" };
  if (job.return_complete) return { ok: false, error: "ສົ່ງເຄື່ອງຄືນລູກຄ້າໄປແລ້ວ — ຖອຍບໍ່ໄດ້" };

  /**
   * ── ວຽກທີ່ **QC ຕີກັບມາແກ້** ຖອຍບໍ່ໄດ້ (26-08-2026) ──
   * ຕົກ QC = ລ້າງ time_repair/time_finish_repair ⇒ ໃບຕົກລົງມາເປັນ "ລໍຖ້າສ້ອມແປງ"
   * ທີ່ **ໜ້າຕາຄືກັນເປັ໊ະ** ກັບໃບທີ່ຫາກໍ່ຈົບການກວດເຊັກ (ຂໍ້ ③ ຂ້າງລຸ່ມ) ⇒ ກົດ "ຖອຍຄືນ"
   * ຈະໄປລຶບ **ຜົນກວດເຊັກ** (time_finish_check · issue_2 · used_spare) ແລະ ຍ້າຍອາໄຫຼ່
   * ຄືນກະຕ່າຮ່າງ ຂອງງານທີ່ສ້ອມໄປແລ້ວຮອບນຶ່ງ. ດ່ານ qt_start/spare_reg ກັນບໍ່ຢູ່:
   * ວັດ 26-08-2026 — ໃບທີ່ສ້ອມຈົບແລ້ວໂດຍບໍ່ມີໃບສະເໜີລາຄາ ແລະ ບໍ່ມີໃບຂໍເບີກ ມີ **2,238 ໃບ**
   * (48/76 ຂອງວຽກຄ້າງປັດຈຸບັນ).
   * ⇒ ຕອນລໍແກ້ຄືນ **ບໍ່ມີຂັ້ນໃຫ້ຖອຍ**: ຂັ້ນຕໍ່ໄປຄືສ້ອມໃຫ້ຜ່ານ QC ບໍ່ແມ່ນຍ້ອນກັບ.
   */
  if (job.qc_reject_at && !job.time_repair && !job.time_finish_repair) {
    return { ok: false, error: "ຖອຍບໍ່ໄດ້ — QC ສົ່ງງານກັບມາແກ້ (ສ້ອມໃຫ້ຄົບແລ້ວສົ່ງ QC ຄືນ)" };
  }

  // ① ຈົບການສ້ອມແປງ → ກຳລັງສ້ອມແປງ
  if (job.time_finish_repair && !job.qc_finish) {
    const done = await query(
      `update tb_product set time_finish_repair=null, status=(${POST_CHECK_STATUS})
        where code=$1 and time_finish_repair is not null and qc_finish is null
          and return_complete is null and status<>6`,
      [code],
    );
    if (!done.rowCount) return CHANGED;
    await logChange("tb_product", code, 'ຖອຍ 1 ຂັ້ນ: ຈົບການສ້ອມແປງ → ກຳລັງສ້ອມແປງ', { author });
    return { ok: true, message: "ຖອຍຄືນ → ກຳລັງສ້ອມແປງ" };
  }

  // ② ເລີ່ມສ້ອມແປງ → ລໍຖ້າສ້ອມແປງ
  if (job.time_repair && !job.time_finish_repair) {
    const done = await query(
      `update tb_product set time_repair=null
        where code=$1 and time_repair is not null and time_finish_repair is null
          and return_complete is null and status<>6`,
      [code],
    );
    if (!done.rowCount) return CHANGED;
    await logChange("tb_product", code, 'ຖອຍ 1 ຂັ້ນ: ເລີ່ມສ້ອມແປງ → ລໍຖ້າສ້ອມແປງ', { author });
    return { ok: true, message: "ຖອຍຄືນ → ລໍຖ້າສ້ອມແປງ" };
  }

  // ③ ບັນທຶກຜົນກວດເຊັກ → ກຳລັງກວດເຊັກ (ຍ້າຍອາໄຫຼ່ຄືນກະຕ່າຮ່າງ)
  if (job.time_finish_check && !job.time_repair) {
    if (job.qt_start) return { ok: false, error: "ຖອຍບໍ່ໄດ້: ເລີ່ມສະເໜີລາຄາໄປແລ້ວ — ຕິດຕໍ່ CS" };
    if (job.spare_reg) return { ok: false, error: "ຖອຍບໍ່ໄດ້: ມີໃບຂໍເບີກອາໄຫຼ່ແລ້ວ — ຕິດຕໍ່ CS" };
    if (!db) return { ok: false, error: "ບໍ່ພົບ DATABASE_URL" };
    const client = await db.connect();
    try {
      await client.query("begin");
      const done = await client.query(
        `update tb_product set time_finish_check=null, issue_2=null, used_spare=0, status=2
          where code=$1 and time_finish_check is not null and time_repair is null
            and qt_start is null and spare_reg is null and status<>6`,
        [code],
      );
      if (!done.rowCount) {
        await client.query("rollback");
        return CHANGED;
      }
      // ອາໄຫຼ່ກັບເຂົ້າກະຕ່າຮ່າງ (trans_flag 12) ແລ້ວລຶບຕົວຈິງ — ຄືກັບ cancelChecking
      await client.query(
        `insert into ic_trans_detail_draft(trans_flag, cust_code, product_code, item_code, item_name, qty, unit_code, user_created)
         select 12, p.cust_code, s.product_code, s.item_code, s.item_name, s.qty, s.unit_code, $2
           from tb_used_spare s join tb_product p on p.code = s.product_code
          where s.product_code=$1`,
        [code, author],
      );
      await client.query("delete from tb_used_spare where product_code=$1", [code]);
      await client.query("commit");
    } catch (error) {
      await client.query("rollback");
      console.error("undoLastStep(check) failed", error);
      return { ok: false, error: "ຖອນຄືນບໍ່ສຳເລັດ" };
    } finally {
      client.release();
    }
    await logChange("tb_product", code, 'ຖອຍ 1 ຂັ້ນ: ບັນທຶກຜົນກວດເຊັກ → ກຳລັງກວດເຊັກ', { author });
    return { ok: true, message: "ຖອຍຄືນ → ກຳລັງກວດເຊັກ" };
  }

  // ④ ເລີ່ມກວດເຊັກ → ລໍຖ້າກວດເຊັກ
  if (job.time_check && !job.time_finish_check) {
    const done = await query(
      `update tb_product set time_check=null, status=1
        where code=$1 and time_check is not null and time_finish_check is null and status<>6`,
      [code],
    );
    if (!done.rowCount) return CHANGED;
    await logChange("tb_product", code, 'ຖອຍ 1 ຂັ້ນ: ເລີ່ມກວດເຊັກ → ລໍຖ້າກວດເຊັກ', { author });
    return { ok: true, message: "ຖອຍຄືນ → ລໍຖ້າກວດເຊັກ" };
  }

  // ⑤ ຮັບງານ → ຍັງບໍ່ຮັບງານ (ຂັ້ນ 1 ຮັບແລ້ວ ຍັງບໍ່ເລີ່ມກວດ) — ລ້າງ repair_confirm ຢ່າງດຽວ
  if (job.repair_confirm && !job.time_check) {
    const done = await query(
      `update tb_product set repair_confirm=null
        where code=$1 and repair_confirm is not null and time_check is null and status<>6`,
      [code],
    );
    if (!done.rowCount) return CHANGED;
    await logChange("tb_product", code, 'ຖອຍ 1 ຂັ້ນ: ຮັບງານ → ຍັງບໍ່ຮັບງານ', { author });
    return { ok: true, message: "ຖອຍຄືນ → ຍັງບໍ່ຮັບງານ" };
  }

  return { ok: false, error: "ບໍ່ມີຂັ້ນໃຫ້ຖອຍຄືນ" };
}

/** ປ້າຍ "ຖອຍໄປຫາ" ຕາມຂັ້ນ — ໃຫ້ແອັບສະແດງປຸ່ມ (ຮັບງານ 1 · ກວດ 2 · ຜົນກວດ 8 · ສ້ອມ 9 · ຈົບ 10) */
export const UNDO_TO_SQL = `case
  when (${STAGE_SQL})=1 and a.repair_confirm is not null then 'ຍັງບໍ່ຮັບງານ'
  when (${STAGE_SQL})=2 then 'ລໍຖ້າກວດເຊັກ'
  -- ຂັ້ນ 3 (ນອກປະກັນ ລໍສະເໜີລາຄາ ຍັງບໍ່ເລີ່ມ qt) ຖອຍຄືນຜົນກວດໄດ້; 4–7 ມີ qt/ໃບເບີກ ⇒ ຕິດຕໍ່ CS
  when (${STAGE_SQL})=3 then 'ກຳລັງກວດເຊັກ'
  -- ຂັ້ນ 8 ທີ່ມາຈາກ **QC ຕີກັບ** ບໍ່ມີຂັ້ນໃຫ້ຖອຍ (ຖອຍ = ລຶບຜົນກວດເຊັກຂອງງານທີ່ສ້ອມແລ້ວ)
  when (${STAGE_SQL})=8 and a.qc_reject_at is not null then null
  when (${STAGE_SQL})=8 then 'ກຳລັງກວດເຊັກ'
  when (${STAGE_SQL})=9 then 'ລໍຖ້າສ້ອມແປງ'
  when (${STAGE_SQL})=10 then 'ກຳລັງສ້ອມແປງ'
  else null end`;
