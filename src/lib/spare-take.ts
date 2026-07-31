/**
 * **ຈຳນວນທີ່ໃບຂໍເບີກໃບນີ້ຈະເອົາ** — ນິຍາມບ່ອນດຽວ ໃຊ້ທັງສາຍງານ**ສ້ອມ** ແລະ **ຕິດຕັ້ງ**.
 *
 * ── ເປັນຫຍັງຕ້ອງມີ (28-07-2026) ──
 * ກົດເກນຄື **1 ສາງ ຕໍ່ 1 ໃບຂໍເບີກ** (ເອກະສານ ERP ມີ wh_code/shelf_code ອັນດຽວ).
 * ແຕ່ອາໄຫຼ່ຕົວດຽວກັນມັກກະຈາຍຢູ່ຫຼາຍສາງ ⇒ ຖ້າໃບນຶ່ງບັງຄັບເອົາ "ຄ້າງທັງໝົດ" ຄົນຈະ
 * ເບີກບໍ່ໄດ້ຈັກໜ່ວຍ ທັງທີ່ລວມທຸກສາງມີພໍ. ຟອມຈຶ່ງສົ່ງ `take_<item_code>` ມາບອກວ່າ
 * **ໃບນີ້ເອົາຈັກໜ່ວຍ** (ຕັ້ງຕົ້ນ = ເທົ່າທີ່ສາງທີ່ເລືອກມີ) ສ່ວນທີ່ເຫຼືອຍັງຄ້າງໄວ້
 * ໃຫ້ອອກໃບໃໝ່ຈາກສາງອື່ນ.
 *
 * ⚠️ ຄ່າຈາກ browser ເຊື່ອບໍ່ໄດ້ — ຝັ່ງ server ຕ້ອງຕັດໃຫ້ບໍ່ເກີນ "ຈຳນວນຄ້າງ" ທີ່ຄິດເອງ
 * ສະເໝີ (ເບິ່ງ createSpareRequest / saveSpareRequest). ບ່ອນນີ້ພຽງແຕ່ອ່ານ+ລ້າງຮູບແບບ.
 *
 * ບໍ່ມີຊ່ອງ `take_*` ຈັກອັນ = ຄືນຄ່າ `undefined` ⇒ ຜູ້ເອີ້ນໃຊ້ພຶດຕິກຳເກົ່າ
 * (ເອົາຄ້າງທັງໝົດ) ⇒ **ແອັບມືຖື ແລະ API ເກົ່າບໍ່ຕ້ອງແກ້**.
 */
export const TAKE_PREFIX = "take_";

/** ຊື່ຊ່ອງຂອງລາຍການນຶ່ງ — ໃຊ້ຮ່ວມກັນລະຫວ່າງຟອມ ແລະ action ຈຶ່ງບໍ່ຫຼົງກັນ */
export const takeField = (itemCode: string) => `${TAKE_PREFIX}${itemCode}`;

export function takeFromForm(formData: FormData): Record<string, number> | undefined {
  const take: Record<string, number> = {};
  let found = false;
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith(TAKE_PREFIX) || typeof value !== "string") continue;
    found = true;
    const itemCode = key.slice(TAKE_PREFIX.length);
    const qty = Number(value);
    // ຊ່ອງຫວ່າງ/ຕົວອັກສອນ = 0 (ບໍ່ເອົາລາຍການນີ້) ບໍ່ແມ່ນ NaN ທີ່ຈະລາມໄປເປັນ qty ຜິດ
    take[itemCode] = Number.isFinite(qty) && qty > 0 ? qty : 0;
  }
  return found ? take : undefined;
}

/**
 * **ຈຳນວນທີ່ໃບນີ້ຈະເອົາ ຂອງລາຍການນຶ່ງ** — ກົດເກນຢູ່ບ່ອນດຽວ ໃຊ້ທັງສ້ອມ ແລະ ຕິດຕັ້ງ.
 *
 * ⚠️ ບັກເກົ່າ (ພົບ 31-07-2026): ຜູ້ເອີ້ນຂຽນ `take?.[code]` ແລ້ວ "undefined ⇒ ເອົາຄ້າງທັງໝົດ"
 * ⇒ ລາຍການທີ່ **ຄົນເອົາອອກຈາກຟອມແລ້ວ** (ບໍ່ມີຊ່ອງ take_ ສົ່ງມາ) ຍັງຖືກໃສ່ໃນໃບເຕັມຈຳນວນ
 * ⇒ ຟອມສະແດງ 2 ແຖວ ແຕ່ໃບທີ່ບັນທຶກອອກມາ 14 ແຖວ (ງານ INST-7082 / SION2026072406).
 *
 * ກົດທີ່ຖືກ:
 *   ຟອມສົ່ງ take_ ມາ (ເວັບ) ⇒ ລາຍການທີ່ **ບໍ່ຢູ່ໃນຟອມ = ບໍ່ເອົາ** (0)
 *   ບໍ່ສົ່ງມາຈັກອັນ (ແອັບມືຖື/API ເກົ່າ) ⇒ ເອົາຄ້າງທັງໝົດ ຄືເກົ່າ
 * ຕັດບໍ່ໃຫ້ເກີນ `outstanding` ທີ່ server ຄິດເອງສະເໝີ.
 */
export function takeQty(
  take: Record<string, number> | undefined,
  itemCode: string,
  outstanding: number,
): number {
  if (!take) return outstanding;
  return Math.min(outstanding, Math.max(0, take[itemCode] ?? 0));
}
