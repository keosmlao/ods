/**
 * **ທຽບລາຍການສິນຄ້າ ລະຫວ່າງ 2 ຂັ້ນຂອງຕ່ອງໂສ້ເອກະສານ** (ຂໍ → ສາງເບີກ → ຊ່າງຮັບ).
 *
 * ── ເປັນຫຍັງຕ້ອງທຽບ ──
 * ຄົນເຂົ້າໃຈວ່າ "ຂໍຫຍັງ ກໍ່ໄດ້ອັນນັ້ນ" ແຕ່ຂໍ້ມູນຈິງ 04-08-2026 ບໍ່ແມ່ນ:
 * ໃນ 4,812 ຄູ່ SIO↔SWC ມີ **79 ຄູ່ຈຳນວນແຖວບໍ່ຄືກັນ** ແລະ **82 ຄູ່ຈຳນວນລວມບໍ່ຄືກັນ**
 * (ຕົວຢ່າງ INST-7170: ນ໋ອດລະເບີດ ຂໍ 1 ແຕ່ສາງເບີກ 4). ຖ້າບໍ່ໂຊ້ວ ຄົນຈະຮູ້ຕໍ່ເມື່ອອາໄຫຼ່ຂາດໜ້າງານ.
 *
 * ⚠️ ທຽບດ້ວຍ **ລະຫັດສິນຄ້າ** ບໍ່ແມ່ນລຳດັບແຖວ — ໃບ SWC ຈິງຮຽງຄົນລະລຳດັບກັບໃບ SIO
 * (ກວດແລ້ວ SWC26080003 ຮຽງກັບຂ້າມກັບ SION2026080008 ທຸກແຖວ).
 */
export type DiffItem = { item_code: string; item_name: string | null; qty: number };

export type DiffRow = DiffItem & {
  /** ຈຳນວນທີ່ຄວນເປັນ ຕາມຂັ້ນກ່ອນໜ້າ — 0 = ຂັ້ນກ່ອນບໍ່ໄດ້ຂໍເລີຍ (ເບີກເກີນ) */
  expected: number;
};

/**
 * @param items    ລາຍການຂອງຂັ້ນນີ້ (ເຊັ່ນ ທີ່ສາງເບີກອອກຈິງ)
 * @param against  ລາຍການຂັ້ນກ່ອນໜ້າທີ່ເອົາມາທຽບ (ເຊັ່ນ ທີ່ຊ່າງຂໍ)
 *
 * ສິນຄ້າທີ່ຂັ້ນກ່ອນມີແຕ່ຂັ້ນນີ້ບໍ່ມີ ⇒ ເພີ່ມແຖວ `qty: 0` ໃຫ້ເຫັນວ່າ **ຂາດ**
 * (ຖ້າບໍ່ເພີ່ມ ຂອງທີ່ບໍ່ໄດ້ເບີກຈະຫາຍໄປຈາກໜ້າຈໍ ແລ້ວບໍ່ມີໃຜເຫັນວ່າຕົກ).
 */
export function compareItems(items: DiffItem[], against: DiffItem[]): { rows: DiffRow[]; mismatch: boolean } {
  const want = new Map(against.map((item) => [item.item_code, item]));
  const rows: DiffRow[] = items.map((item) => ({ ...item, expected: want.get(item.item_code)?.qty ?? 0 }));
  for (const [code, item] of want) {
    if (!items.some((row) => row.item_code === code)) rows.push({ ...item, qty: 0, expected: item.qty });
  }
  return { rows, mismatch: rows.some((row) => row.expected !== row.qty) };
}
