import { TRANS } from "@/lib/stock-constants";

/**
 * **ດ່ານອາໄຫຼ່ຂອງງານຕິດຕັ້ງ** — ງານຈະໄປຂັ້ນ "ລໍຖ້າຕິດຕັ້ງ" (4) ໄດ້ກໍ່ຕໍ່ເມື່ອ
 * **ຂໍຄົບຕາມມາດຕະຖານ**, **ສາງເບີກຄົບ** ແລະ **ຊ່າງຮັບຄົບ**.
 *
 * ── ເປັນຫຍັງຕ້ອງມີໄຟລ໌ນີ້ ──
 * ຕັ້ງແຕ່ແບ່ງເບີກເປັນ 1 ສາງ ຕໍ່ 1 ໃບຂໍ ງານໜຶ່ງມີໄດ້ຫຼາຍໃບ. ແຕ່ບ່ອນທີ່ stamp
 * `ods_tb_install.pick_finish` ນັບແຕ່ **ໃບເບີກ (56) ທີ່ຍັງບໍ່ມີໃບຮັບ (166)** ຢ່າງດຽວ
 * ⇒ ຖ້າສາງທີ 1 ຈ່າຍແລ້ວ ຊ່າງກົດຮັບ ໃນຂະນະທີ່ສາງທີ 2 ຍັງບໍ່ທັນຈ່າຍ
 * ຈຳນວນ "ໃບເບີກທີ່ຍັງບໍ່ຮັບ" ຈະເປັນ 0 ⇒ ງານເດັ້ງໄປ "ລໍຖ້າຕິດຕັ້ງ" ທັງທີ່ອາໄຫຼ່ຍັງມາບໍ່ຄົບ.
 *
 * ⇒ ຕ້ອງທຽບ **4 ຍອດ** ຕາມ item_code:
 *   ມາດຕະຖານ tb_used_spare → ໃບຂໍ 122 (ຫັກໃບສົ່ງຄືນ 59)
 *   → ໃບເບີກ 56 → ໃບຮັບ PISP 166.
 *
 * ໃຊ້ຮ່ວມກັນລະຫວ່າງ **ເວັບ** (actions/installation savePickSpare) ແລະ **ແອັບມືຖື**
 * (lib/tech-flow pickupSpares) — ສອງທາງນີ້ເຄີຍມີສຳເນົາເງື່ອນໄຂຄົນລະສະບັບ.
 */

/** trans_flag ຂອງໃບ "ຊ່າງຮັບອາໄຫຼ່" (PISP) — ເອກະສານຢູ່ ODS ຢ່າງດຽວ ບໍ່ຕັດສະຕັອກ */
export const TRANS_PICK = 166;

export type SpareOutstanding = {
  /** ຈຳນວນຕາມມາດຕະຖານທີ່ຍັງບໍ່ທັນອອກໃບຂໍ */
  notRequested: number;
  /** ຈຳນວນໃນໃບຂໍທີ່ສາງຍັງບໍ່ທັນເບີກອອກ */
  notDispatched: number;
  /** ຈຳນວນທີ່ສາງເບີກແລ້ວ ແຕ່ຊ່າງຍັງບໍ່ທັນກົດຮັບ */
  notReceived: number;
  /** ຄົບຕາມມາດຕະຖານທັງຂໍ · ເບີກ · ຮັບ ⇒ stamp pick_finish ໄດ້ */
  done: boolean;
};

/**
 * ນັບອາໄຫຼ່ທີ່ຍັງຄ້າງຂອງງານໜຶ່ງ.
 * ຮັບ `run` ແທນທີ່ຈະ import db ເອງ ⇒ ເອີ້ນຢູ່ໃນ transaction ດຽວກັບຜູ້ເອີ້ນໄດ້
 * (ບໍ່ດັ່ງນັ້ນຈະນັບຈາກ connection ອື່ນ ແລ້ວເຫັນຂໍ້ມູນກ່ອນ commit ບໍ່ຄົບ).
 */
export async function installSpareOutstanding(
  run: (sql: string, params: unknown[]) => Promise<{
    rows: { not_requested: number; not_dispatched: number; not_received: number }[];
  }>,
  productCode: string,
): Promise<SpareOutstanding> {
  const { rows } = await run(
    `with wanted as (
       select item_code, sum(qty)::numeric qty
         from tb_used_spare where product_code=$1 group by item_code
     ), requested as (
       select item_code,
              sum(case when trans_flag=$2 then qty else -qty end)::numeric qty
         from ic_trans_detail
        where product_code=$1 and trans_flag in ($2,$3)
        group by item_code
     ), dispatched as (
       select item_code, sum(qty)::numeric qty
         from ic_trans_detail
        where product_code=$1 and trans_flag=$4
        group by item_code
     ), received as (
       select item_code, sum(qty)::numeric qty
         from ic_trans_detail
        where product_code=$1 and trans_flag=$5
        group by item_code
     )
     select
       coalesce(sum(greatest(w.qty-coalesce(r.qty,0),0)),0)::float8 not_requested,
       coalesce(sum(greatest(coalesce(r.qty,0)-coalesce(d.qty,0),0)),0)::float8 not_dispatched,
       coalesce(sum(greatest(coalesce(d.qty,0)-coalesce(p.qty,0),0)),0)::float8 not_received
      from wanted w
      left join requested r using(item_code)
      left join dispatched d using(item_code)
      left join received p using(item_code)`,
    [productCode, TRANS.REQUEST, TRANS.RETURN_REQUEST, TRANS.DISPATCH, TRANS_PICK],
  );
  const notRequested = rows[0]?.not_requested ?? 0;
  const notDispatched = rows[0]?.not_dispatched ?? 0;
  const notReceived = rows[0]?.not_received ?? 0;
  return {
    notRequested,
    notDispatched,
    notReceived,
    done: notRequested === 0 && notDispatched === 0 && notReceived === 0,
  };
}
