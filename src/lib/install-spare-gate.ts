import { TRANS } from "@/lib/stock-constants";

/**
 * **ດ່ານອາໄຫຼ່ຂອງງານຕິດຕັ້ງ** — ງານຈະໄປຂັ້ນ "ລໍຖ້າຕິດຕັ້ງ" (4) ໄດ້ກໍ່ຕໍ່ເມື່ອ
 * **ທຸກໃບຂໍເບີກຖືກເບີກອອກຄົບ** ແລະ **ທຸກໃບເບີກຖືກຊ່າງຮັບຄົບ**.
 *
 * ── ເປັນຫຍັງຕ້ອງມີໄຟລ໌ນີ້ ──
 * ຕັ້ງແຕ່ແບ່ງເບີກເປັນ 1 ສາງ ຕໍ່ 1 ໃບຂໍ ງານໜຶ່ງມີໄດ້ຫຼາຍໃບ. ແຕ່ບ່ອນທີ່ stamp
 * `ods_tb_install.pick_finish` ນັບແຕ່ **ໃບເບີກ (56) ທີ່ຍັງບໍ່ມີໃບຮັບ (166)** ຢ່າງດຽວ
 * ⇒ ຖ້າສາງທີ 1 ຈ່າຍແລ້ວ ຊ່າງກົດຮັບ ໃນຂະນະທີ່ສາງທີ 2 ຍັງບໍ່ທັນຈ່າຍ
 * ຈຳນວນ "ໃບເບີກທີ່ຍັງບໍ່ຮັບ" ຈະເປັນ 0 ⇒ ງານເດັ້ງໄປ "ລໍຖ້າຕິດຕັ້ງ" ທັງທີ່ອາໄຫຼ່ຍັງມາບໍ່ຄົບ.
 *
 * ⇒ ຕ້ອງນັບ **ສອງຂາ** ພ້ອມກັນ (ຂາທຳອິດຄືອັນທີ່ຂາດໄປ):
 *   ① ແຖວໃບຂໍ (122) ທີ່ status=0 = ຍັງບໍ່ທັນເບີກ  — ນິຍາມດຽວກັບ lib/erp-dispatch
 *   ② ໃບເບີກ (56) ທີ່ຍັງບໍ່ມີໃບຮັບ PISP (166) ອ້າງອີງ — ນິຍາມດຽວກັບໜ້າ spare-pickup
 *
 * ໃຊ້ຮ່ວມກັນລະຫວ່າງ **ເວັບ** (actions/installation savePickSpare) ແລະ **ແອັບມືຖື**
 * (lib/tech-flow pickupSpares) — ສອງທາງນີ້ເຄີຍມີສຳເນົາເງື່ອນໄຂຄົນລະສະບັບ.
 */

/** trans_flag ຂອງໃບ "ຊ່າງຮັບອາໄຫຼ່" (PISP) — ເອກະສານຢູ່ ODS ຢ່າງດຽວ ບໍ່ຕັດສະຕັອກ */
export const TRANS_PICK = 166;

export type SpareOutstanding = {
  /** ແຖວໃບຂໍທີ່ສາງຍັງບໍ່ທັນເບີກອອກ */
  notDispatched: number;
  /** ໃບເບີກທີ່ຊ່າງຍັງບໍ່ທັນກົດຮັບ */
  notReceived: number;
  /** ຄົບທັງສອງຂາ ⇒ stamp pick_finish ໄດ້ */
  done: boolean;
};

/**
 * ນັບອາໄຫຼ່ທີ່ຍັງຄ້າງຂອງງານໜຶ່ງ.
 * ຮັບ `run` ແທນທີ່ຈະ import db ເອງ ⇒ ເອີ້ນຢູ່ໃນ transaction ດຽວກັບຜູ້ເອີ້ນໄດ້
 * (ບໍ່ດັ່ງນັ້ນຈະນັບຈາກ connection ອື່ນ ແລ້ວເຫັນຂໍ້ມູນກ່ອນ commit ບໍ່ຄົບ).
 */
export async function installSpareOutstanding(
  run: (sql: string, params: unknown[]) => Promise<{ rows: { not_dispatched: number; not_received: number }[] }>,
  productCode: string,
): Promise<SpareOutstanding> {
  const { rows } = await run(
    `select
       (select count(*) from ic_trans_detail d
         where d.product_code = $1 and d.trans_flag = $2 and d.status = 0)::int as not_dispatched,
       (select count(*) from ic_trans t
         where t.trans_flag = $3 and t.product_code = $1
           and not exists (select 1 from ic_trans p
                            where p.trans_flag = $4 and p.doc_ref = t.doc_no))::int as not_received`,
    [productCode, TRANS.REQUEST, TRANS.DISPATCH, TRANS_PICK],
  );
  const notDispatched = rows[0]?.not_dispatched ?? 0;
  const notReceived = rows[0]?.not_received ?? 0;
  return { notDispatched, notReceived, done: notDispatched === 0 && notReceived === 0 };
}
