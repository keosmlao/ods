import { query } from "@/lib/db";
import { outsideStandardCodes } from "@/lib/loaner-shared";
import { SETTING, settingEnabled } from "@/lib/settings";
// ດ່ານ "ນອກມາດຕະຖານ" ຢູ່ໄຟລ໌ -shared (ບໍ່ແຕະຖານ ⇒ ທົດສອບໄດ້) — ສົ່ງຕໍ່ໃຫ້ຜູ້ໃຊ້ເກົ່າ
export { outsideStandardCodes } from "@/lib/loaner-shared";

/**
 * ── ອາໄຫຼ່ "ຕາມມາດຕະຖານ" ຂອງງານຕິດຕັ້ງ = **ຊຸດຕິດຕັ້ງ** (used_spare_install) ──
 *
 * ຄີ = `ods_tb_install.install_type` (ລະຫັດ 9900-00xx ແບ່ງຕາມ **ຂະໜາດ BTU**) ⇒ ແອແຕ່ລະ
 * ຂະໜາດມີຊຸດຂອງຕົນ 13 ລາຍການ (ຂາເຫລັກແຜງຮ້ອນ · ນ໋ອດລະເບີດ · ເທບຄຽນ · ສະກ໋ອດດຳ ·
 * ລາງວາຍເວ · ຫົວຄອບ · ຂໍ້ຕໍ່ · ຂໍ້ງໍ · ທໍ່ PVC · ນ໋ອດສະກູ …).
 *
 * ນີ້ຄື**ຕາຕະລາງດຽວກັນທີ່ createInstall ໃຊ້ຕື່ມກະຕ່າ**ຕອນເປີດງານ (actions/installation)
 * ⇒ "ມາດຕະຖານ" ທີ່ສະແດງ ກັບ ແຖວໃນກະຕ່າ ຈຶ່ງເປັນອັນດຽວກັນສະເໝີ.
 *
 * ⚠️ **ຢ່າ**ເອົາ `ic_inventory_set_detail` ຂອງສິນຄ້າມາໃຊ້ເປັນມາດຕະຖານ (ເຄີຍໃຊ້ ແລະ ຖອດ
 * ອອກແລ້ວ 31-07-2026): ຊຸດຂອງສິນຄ້າຄື **ອົງປະກອບຂອງຕົວເຄື່ອງ** (ແອ [SET] → ໜ່ວຍໃນ ·
 * ໜ່ວຍນອກ · ກ່ອງທໍ່) ບໍ່ແມ່ນອາໄຫຼ່ທີ່ຊ່າງເບີກໄປຕິດຕັ້ງ.
 *
 * ບໍ່ໃຊ້ ods.tb_used_spare ເປັນມາດຕະຖານ ເພາະມັນເປັນ **ກະຕ່າຂອງງານ** (ຊ່າງເພີ່ມ/ລຶບໄດ້).
 * ຈຳນວນ "ຂໍແລ້ວ" ຄິດຈາກ **ບັນຊີເອກະສານ** (122 ລົບ 59) — ນິຍາມດຽວກັບ saveSpareRequest.
 */

export type StandardSpare = {
  item_code: string;
  item_name: string;
  unit_code: string | null;
  standard_qty: number;
  requested_qty: number;
  remaining_qty: number;
};

/**
 * ຊຸດຕິດຕັ້ງຂອງໃບງານນຶ່ງ — join ຜ່ານ install_type ຂອງໃບງານເອງ.
 * ລວມແຖວຊ້ຳ (ບາງຊຸດລົງລາຍການດຽວກັນ 2 ແຖວ ເຊັ່ນ 9900-0018 ນ໋ອດລະເບີດ 4+1).
 */
const KIT_LINES = `
  select k.ic_code as item_code,
      coalesce(nullif(max(k.name_1), ''), k.ic_code) as item_name,
      nullif(max(k.unit_code), '') as unit_code,
      sum(k.qty)::float8 as standard_qty,
      min(k.line_number) as line_number
    from ods_tb_install a
    join used_spare_install k on k.install_type = a.install_type
   where a.code = $1 and coalesce(a.install_type,'') <> ''
   group by k.ic_code
   order by line_number`;

/** ຂໍໄປແລ້ວເທົ່າໃດ = ໃບຂໍ (122) ລົບໃບສົ່ງຄືນ (59) — ຄືກັບ OUTSTANDING ຂອງກະຕ່າ */
const REQUESTED = `
  select item_code, sum(case when trans_flag = 122 then qty else -qty end)::float8 as qty
    from ic_trans_detail
   where product_code = $1 and trans_flag in (122, 59)
   group by item_code`;

/**
 * **ຈຳນວນ ແລະ ຫົວໜ່ວຍ ຕາມຊຸດ** — ໃຊ້ຕອນເພີ່ມລາຍການເຂົ້າກະຕ່າ ເພື່ອບໍ່ຕ້ອງເຊື່ອຄ່າທີ່
 * browser ສົ່ງມາ ແລະ ໃຊ້ເປັນ **ດ່ານ "ນອກມາດຕະຖານ"** (blockNonStandard).
 *
 * ⚠️ ຫົວໜ່ວຍເອົາຈາກ **ຊຸດ** ບໍ່ແມ່ນ ic_inventory.unit_standard — ຫົວໜ່ວຍມາດຕະຖານຂອງ
 * ສິນຄ້າມັກເປັນຫົວໜ່ວຍຊື້/ຊັ່ງ (140507-0334 = **ກິໂລ** ເພາະຂາຍເປັນເປົາ 50KG) ແຕ່ຕອນ
 * ຕິດຕັ້ງເບີກເປັນ **ຕົວ** ຕາມທີ່ຊຸດກຳນົດ ⇒ ໃຊ້ຫົວໜ່ວຍສິນຄ້າ = ຈຳນວນຜິດຄວາມໝາຍ.
 */
export async function getStandardKitLines(
  jobCode: string,
): Promise<Map<string, { qty: number; unit_code: string | null }>> {
  try {
    const rows = (
      await query<{ item_code: string; unit_code: string | null; standard_qty: number }>(
        KIT_LINES,
        [jobCode],
      )
    ).rows;
    return new Map(
      rows.map((row) => [row.item_code, { qty: row.standard_qty, unit_code: row.unit_code }]),
    );
  } catch (error) {
    console.error("getStandardKitLines failed", error);
    return new Map();
  }
}

/**
 * ລາຍການມາດຕະຖານພ້ອມຄວາມຄືບໜ້າຂອງງານ (ໜ້າໃບຂໍເບີກ).
 * ງານທີ່ບໍ່ມີ install_type (ໂທລະທັດ · ຈັກຊັກ …) = ບໍ່ມີຊຸດ ⇒ ຄືນຫວ່າງ ຄືເກົ່າ.
 */
export async function getStandardSpares(jobCode: string): Promise<StandardSpare[]> {
  let kit: (StandardSpare & { line_number: number })[];
  try {
    kit = (await query<StandardSpare & { line_number: number }>(KIT_LINES, [jobCode])).rows;
  } catch (error) {
    // ຖານບໍ່ພ້ອມ → ຢ່າໃຫ້ໜ້າລົ້ມ, ສະແດງບໍ່ມີມາດຕະຖານໄປກ່ອນ
    console.error("getStandardSpares failed", error);
    return [];
  }
  if (!kit.length) return [];

  const requested = new Map(
    (await query<{ item_code: string; qty: number }>(REQUESTED, [jobCode])).rows.map(
      (row) => [row.item_code, row.qty],
    ),
  );
  return kit.map((row) => {
    const already = requested.get(row.item_code) ?? 0;
    return {
      item_code: row.item_code,
      item_name: row.item_name,
      unit_code: row.unit_code,
      standard_qty: row.standard_qty,
      requested_qty: already,
      remaining_qty: Math.max(0, row.standard_qty - already),
    };
  });
}

/**
 * ── ດ່ານ "ເບີກອາໄຫຼ່ນອກມາດຕະຖານ" (SETTING.INSTALL_SPARE_FREE_SEARCH) ──
 *
 * ປິດແລ້ວ = ເພີ່ມໄດ້ແຕ່ລາຍການທີ່ **ຢູ່ໃນຊຸດຕິດຕັ້ງຂອງໃບງານ** (used_spare_install ຕາມ
 * install_type) ຫຼື **ຢູ່ໃນກະຕ່າຂອງງານແລ້ວ**. ກວດຢູ່ຝັ່ງ server ບໍ່ແມ່ນເຊື່ອງແຕ່ຊ່ອງ
 * ຄົ້ນຫາ — action/API ຖືກຍິງໂດຍກົງໄດ້ (lib/guard).
 *
 * ⚠️ ຢູ່ **lib** ບໍ່ແມ່ນ actions ເພາະດຽວນີ້ມີສອງທາງເຂົ້າ: ຟອມເວັບ (actions/installation)
 * ແລະ **ແອັບຊ່າງ** (lib/install-spare) ⇒ ສຳເນົາເງື່ອນໄຂສອງສະບັບ = ດ່ານຄົນລະຊຸດ.
 *
 * @returns ຂໍ້ຄວາມຜິດພາດ ຖ້າມີລາຍການທີ່ຫ້າມ · null ຖ້າຜ່ານ
 */
export async function blockNonStandard(
  code: string,
  itemCodes: string[],
): Promise<string | null> {
  if (await settingEnabled(SETTING.INSTALL_SPARE_FREE_SEARCH)) return null;

  const [setLines, cart] = await Promise.all([
    getStandardKitLines(code),
    query<{ item_code: string }>(
      "select distinct item_code from tb_used_spare where product_code=$1",
      [code],
    ),
  ]);
  const outside = outsideStandardCodes(
    [...setLines.keys(), ...cart.rows.map((row) => row.item_code)],
    itemCodes,
  );
  if (!outside.length) return null;
  return `ປິດການເບີກອາໄຫຼ່ນອກມາດຕະຖານໄວ້ — ເພີ່ມ ${outside.join(", ")} ບໍ່ໄດ້ (ເປີດຄືນທີ່ ການຕັ້ງຄ່າລະບົບ)`;
}
