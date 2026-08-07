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
  /** ຈຳນວນທີ່ສາງເບີກແລ້ວ ແຕ່ຊ່າງຍັງບໍ່ທັນກົດຮັບ (ນັບເປັນ**ຈຳນວນຂອງ**) */
  notReceived: number;
  /**
   * **ໃບເບີກ (56) ທີ່ຍັງບໍ່ມີໃບຮັບ (PISP)** — ນັບເປັນ**ໃບ** ບໍ່ແມ່ນຈຳນວນຂອງ.
   * ນີ້ຄືຕົວທີ່ກັ້ນຂັ້ນ: ຄຳສັ່ງ 06-08-2026 ວ່າ "ຕ້ອງກົດຮັບທຸກເອກະສານກ່ອນ".
   * ນັບເປັນໃບ ຈຶ່ງຕົງກັບໜ້າ /installations/spare-pickup ທີ່ລາຍການເປັນ "ໃບ".
   */
  notReceivedDocs: number;
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

  /**
   * ນັບ **ໃບເບີກທີ່ຍັງບໍ່ມີໃບຮັບ** — ຖາມແຍກເພາະເປັນຄຳຖາມລະດັບ**ເອກະສານ**
   * (ອັນຂ້າງເທິງທຽບເປັນຈຳນວນຂອງຕໍ່ item_code ⇒ PISP ທີ່ລົງບໍ່ຄົບແຖວຈະນັບຄ້າງຄ້າຍກັນ
   * ແຕ່ບອກບໍ່ໄດ້ວ່າ "ຍັງເຫຼືອໃບໃດໃຫ້ໄປຮັບ").
   */
  const docs = await run(
    `select 0 not_requested, 0 not_dispatched,
        (select count(*) from ic_trans sw
          where sw.trans_flag = $2
            and sw.doc_ref in (select r.doc_no from ic_trans r
                                where r.trans_flag = $3 and r.product_code = $1)
            and not exists (select 1 from ic_trans p
                             where p.trans_flag = $4 and p.doc_ref = sw.doc_no))::float8 not_received`,
    [productCode, TRANS.DISPATCH, TRANS.REQUEST, TRANS_PICK],
  );
  const notReceivedDocs = docs.rows[0]?.not_received ?? 0;
  return {
    notRequested,
    notDispatched,
    notReceived,
    notReceivedDocs,
    // notRequested ບໍ່ຢູ່ໃນສູດ — ເບິ່ງເຫດຜົນຢູ່ຫົວໄຟລ໌ (ປ່ຽນກົດເກນ 04-08-2026)
    /**
     * ── ⚠️ ກັບມາບັງຄັບ "**ຮັບຄົບທຸກໃບເບີກ**" (06-08-2026 ຕາມຄຳສັ່ງ) ──
     * ຮຸ່ນ 04-08-2026 ປ່ອຍໃຫ້ "ສາງເບີກແລ້ວ = ຜ່ານ" ເພາະຕອນນັ້ນໃບເບີກ 2,508 ໃບ
     * ບໍ່ເຄີຍມີໃບຮັບ ⇒ ຂັ້ນຮັບຄືກັກວຽກໄວ້ລ້າໆ. ແຕ່ຜົນຂ້າງຄຽງຄື: ງານທີ່ມີ**ຫຼາຍໃບເບີກ**
     * ພໍຊ່າງກົດຮັບໃບໜຶ່ງ ງານກໍ່ໄປຂັ້ນຕໍ່ໄປ ທັງທີ່ອີກໃບຍັງຄາຢູ່ສາງ ⇒ ຊ່າງໄປໜ້າງານ
     * ໂດຍຂາດຂອງ. ດຽວນີ້ນັບເປັນ **ໃບ**: ຍັງເຫຼືອໃບໃດທີ່ບໍ່ມີ PISP ⇒ ຍັງບໍ່ຜ່ານ.
     * (`notReceived` ທີ່ນັບເປັນຈຳນວນຂອງ ຍັງໃຫ້ເບິ່ງ ແຕ່ບໍ່ໃຊ້ຕັດສິນ — ຂໍ້ມູນເກົ່າ
     * ບາງໃບ PISP ບໍ່ມີແຖວລາຍການ ⇒ ນັບເປັນຈຳນວນຈະຄ້າງຕະຫຼອດ.)
     */
    done: notDispatched === 0 && notReceivedDocs === 0,
  };
}
