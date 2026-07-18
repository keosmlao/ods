import type { Session } from "@/lib/auth";
import { logChange } from "@/lib/chatter-log";
import { query } from "@/lib/db";
import { ownMobileJob, type FlowResult } from "@/lib/job-flow";
import { STAGE_SQL } from "@/lib/stage";
import { TRANS } from "@/lib/stock-constants";

/**
 * ອາໄຫຼ່ **ຕອນສ້ອມ (ຂັ້ນ 9)** ສຳລັບແອັບຊ່າງ — ຄູ່ກັບ action ຝັ່ງເວັບ (repair.ts addUsedSpare).
 * ຝັ່ງເວັບໃຊ້ cookie session (loadJob); ແອັບໃຊ້ Bearer (ownMobileJob) ⇒ ຕ້ອງມີສະບັບຮັບ session.
 * SQL ອັນດຽວກັນ: ເພີ່ມ/ຖອດ tb_used_spare ໄດ້ສະເພາະ (${STAGE_SQL})=9 ແລະ ແຖວທີ່ຍັງບໍ່ເຂົ້າໃບ.
 */
const NOW = "localtimestamp(0)";
const NOT_ON_DOC = `pick_finish is null and not exists (
  select 1 from ic_trans_detail d
  where d.product_code = tb_used_spare.product_code and d.item_code = tb_used_spare.item_code
    and d.trans_flag in (${TRANS.REQUEST}, ${TRANS.DISPATCH}))`;

export type RepairSpareLine = {
  roworder: number;
  item_code: string;
  item_name: string;
  qty: number;
  unit_code: string | null;
  /** ຢູ່ໃບຂໍເບີກແລ້ວ (reg_start) */
  requested: boolean;
  /** ເບີກ/ຈ່າຍອອກແລ້ວ ⇒ ແກ້/ຖອດບໍ່ໄດ້ */
  locked: boolean;
};

/** ລາຍການອາໄຫຼ່ຂອງໃບສ້ອມ — locked/requested ໃຫ້ແອັບຮູ້ວ່າແຖວໃດຖອດໄດ້/ຄ້າງເບີກ */
export async function listRepairSpares(code: string): Promise<RepairSpareLine[]> {
  return (
    await query<RepairSpareLine>(
      `select s.roworder, s.item_code, s.item_name, coalesce(s.qty,0)::int qty, s.unit_code,
          (s.reg_start is not null) as "requested",
          (s.pick_finish is not null or exists (
             select 1 from ic_trans_detail d
             where d.product_code = s.product_code and d.item_code = s.item_code
               and d.trans_flag in (${TRANS.REQUEST}, ${TRANS.DISPATCH}))) as "locked"
        from tb_used_spare s where s.product_code = $1 order by s.roworder`,
      [code],
    )
  ).rows;
}

export async function addRepairSpare(
  session: Session,
  code: string,
  item: { code: string; name_1: string; unit_code: string | null },
  qty: number,
): Promise<FlowResult> {
  const own = await ownMobileJob(session, "repair", code);
  if (!own.ok) return own;
  if (!Number.isFinite(qty) || qty <= 0 || qty > 9999) return { ok: false, error: "ຈຳນວນບໍ່ຖືກຕ້ອງ" };

  // ຢ່າເຊື່ອຊື່/ໜ່ວຍຈາກແອັບ — ອ່ານ master ຄືນ
  const atStage9 = await query(`select 1 from tb_product a where a.code=$1 and (${STAGE_SQL})=9`, [code]);
  if (!atStage9.rowCount) return { ok: false, error: "ວຽກບໍ່ໄດ້ຢູ່ຂັ້ນ ກຳລັງສ້ອມ — ເພີ່ມອາໄຫຼ່ບໍ່ໄດ້" };

  const canonical = (
    await query<{ code: string; name_1: string; unit_code: string | null }>(
      "select code, name_1, unit_code from ic_inventory where code=$1 limit 1",
      [item.code],
    )
  ).rows[0];
  if (!canonical) return { ok: false, error: "ບໍ່ພົບອາໄຫຼ່ໃນລາຍການສິນຄ້າ" };

  // ຕົວດຽວກັນ ຍັງບໍ່ເຂົ້າໃບ → ບວກເຂົ້າແຖວເກົ່າ; ບໍ່ດັ່ງນັ້ນເພີ່ມແຖວໃໝ່ (stage 9 ກວດຂ້າງເທິງແລ້ວ)
  const merged = await query(
    `update tb_used_spare set qty = coalesce(qty,0) + $1
      where product_code=$2 and item_code=$3 and ${NOT_ON_DOC}`,
    [qty, code, canonical.code],
  );
  if (!merged.rowCount) {
    await query(
      `insert into tb_used_spare(product_code, item_code, item_name, qty, unit_code, status, create_date_time_now)
       values($1, $2, $3, $4, $5, '0', ${NOW})`,
      [code, canonical.code, canonical.name_1, qty, canonical.unit_code],
    );
  }

  await query("update tb_product set used_spare=1 where code=$1", [code]);
  await logChange("tb_product", code, `ເພີ່ມອາໄຫຼ່ທີ່ໃຊ້ສ້ອມ: ${canonical.name_1} × ${qty}`);
  return { ok: true, message: "ເພີ່ມແລ້ວ" };
}

export async function removeRepairSpare(session: Session, code: string, roworder: number): Promise<FlowResult> {
  const own = await ownMobileJob(session, "repair", code);
  if (!own.ok) return own;

  const atStage9 = await query(`select 1 from tb_product a where a.code=$1 and (${STAGE_SQL})=9`, [code]);
  if (!atStage9.rowCount) return { ok: false, error: "ວຽກບໍ່ໄດ້ຢູ່ຂັ້ນ ກຳລັງສ້ອມ — ຖອດອາໄຫຼ່ບໍ່ໄດ້" };

  const removed = await query<{ item_name: string | null }>(
    `delete from tb_used_spare where roworder=$1 and product_code=$2 and ${NOT_ON_DOC}
     returning item_name`,
    [roworder, code],
  );
  const name = removed.rows[0]?.item_name;
  if (!name) return { ok: false, error: "ອາໄຫຼ່ນີ້ເຂົ້າໃບຂໍເບີກແລ້ວ — ຖອດບໍ່ໄດ້" };

  // ບໍ່ເຫຼືອອາໄຫຼ່ → ຍົກທຸງ used_spare ລົງ
  await query(
    `update tb_product set used_spare=0
      where code=$1 and not exists (select 1 from tb_used_spare where product_code=$1)`,
    [code],
  );
  await logChange("tb_product", code, `ຖອດອາໄຫຼ່ອອກຈາກລາຍການສ້ອມ: ${name}`);
  return { ok: true, message: "ຖອດອອກແລ້ວ" };
}
