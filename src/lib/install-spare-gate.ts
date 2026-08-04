import { TRANS } from "@/lib/stock-constants";

/**
 * **ດ່ານອາໄຫຼ່ຂອງງານຕິດຕັ້ງ** — ງານໄປຂັ້ນ "ລໍຖ້າຕິດຕັ້ງ" (4) ເມື່ອ
 * **ສາງເບີກຄົບທຸກໃບຂໍ** ແລະ **ຊ່າງຮັບຄົບທຸກໃບເບີກ**.
 *
 * ⚠️ ປ່ຽນກົດເກນ 04-08-2026: **"ຂໍຄົບຕາມມາດຕະຖານ" ບໍ່ກັ້ນອີກແລ້ວ.**
 * ຂໍເບີກໃບໃດ → ສາງເບີກ → ຊ່າງກົດຮັບ ⇒ ໄປຂັ້ນຕໍ່ໄປເລີຍ.
 *
 * ເປັນຫຍັງ: ຊ່າງປ່ຽນຂອງແທນກັນເປັນປົກກະຕິ (ຂາເຫລັກ AAA → SVT · ນ໋ອດ 3/8 → 5/16)
 * ແລ້ວປະແຖວມາດຕະຖານເກົ່າຄ້າງໄວ້ໃນກະຕ່າ. ແຖວພວກນັ້ນ **ບໍ່ມີເອກະສານຈັກໃບ** ⇒ ບໍ່ມີໃບເບີກ
 * ໃຫ້ຮັບ ⇒ ບໍ່ມີປຸ່ມໃດໃນລະບົບ stamp `pick_finish` ໄດ້ອີກ ⇒ **ງານຄ້າງຂັ້ນ 3 ຕະຫຼອດ**
 * (04-08-2026 ຄ້າງແບບນີ້ 5 ໃບ: INST-7111 ຄ້າງ 12 ວັນ · 7147 · 7167 · 7170 · 7171).
 * ຢາກໃຫ້ຄົບມາດຕະຖານແມ່ນເລື່ອງຂອງ **ໜ້າຂໍເບີກ** (ຍັງເຫັນສ່ວນທີ່ຍັງບໍ່ຂໍຢູ່) ບໍ່ແມ່ນເອົາງານໄປລັອກໄວ້.
 * `notRequested` ຈຶ່ງຍັງນັບໃຫ້ເບິ່ງ ແຕ່ບໍ່ມີຜົນຕໍ່ `done`.
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
  /** ຈຳນວນຕາມມາດຕະຖານທີ່ຍັງບໍ່ທັນອອກໃບຂໍ — **ໃຫ້ເບິ່ງເທົ່ານັ້ນ ບໍ່ກັ້ນ `done`** */
  notRequested: number;
  /** ຈຳນວນໃນໃບຂໍທີ່ສາງຍັງບໍ່ທັນເບີກອອກ */
  notDispatched: number;
  /** ຈຳນວນທີ່ສາງເບີກແລ້ວ ແຕ່ຊ່າງຍັງບໍ່ທັນກົດຮັບ */
  notReceived: number;
  /** ເບີກຄົບທຸກໃບຂໍ ແລະ ຮັບຄົບທຸກໃບເບີກ ⇒ stamp pick_finish ໄດ້ */
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
    // notRequested ບໍ່ຢູ່ໃນສູດ — ເບິ່ງເຫດຜົນຢູ່ຫົວໄຟລ໌ (ປ່ຽນກົດເກນ 04-08-2026)
    /**
     * **ສາງເບີກແລ້ວ = ຜ່ານ** — ນຳໃຊ້ທັງສ້ອມ ແລະ **ຕິດຕັ້ງ** (ຢືນຢັນ 04-08-2026).
     * ຫຼັກຖານ: ໃບສາງເບີກ 2,508 ໃບບໍ່ເຄີຍມີໃບຮັບ (PISP) — 97% ວຽກເລີ່ມ/ຈົບໄປແລ້ວ
     * ⇒ ຂັ້ນ "ຊ່າງກົດຮັບ" ບໍ່ໄດ້ຖືກໃຊ້ຈິງ ພຽງແຕ່ກັກວຽກໄວ້ໃນຄິວ.
     * `notReceived` ຍັງນັບໃຫ້ເບິ່ງ ແຕ່ບໍ່ກັ້ນ `done` ອີກແລ້ວ.
     */
    done: notDispatched === 0,
  };
}
