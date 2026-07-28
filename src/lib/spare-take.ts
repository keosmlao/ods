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
