/**
 * ກົດເກນຂອງ **ເຄື່ອງສຳຮອງ** ທີ່ບໍ່ແຕະຖານຂໍ້ມູນ — ແຍກອອກມາເພື່ອ:
 *   ① ທົດສອບໄດ້ (tests/ ແລ່ນດ້ວຍ node ລ້ວນ ⇒ import @/lib/db ບໍ່ໄດ້)
 *   ② client component import ໄດ້ໂດຍບໍ່ດຶງ pg ເຂົ້າ bundle
 * ເບິ່ງພາກທີ່ຖາມຖານຂໍ້ມູນຢູ່ lib/loaner.ts
 */

/** ຂໍ້ຄວາມຫ້າມສົ່ງເຄື່ອງຄືນ ຈາກລາຍການທີ່ຍັງບໍ່ຄືນ — null ຄື ຜ່ານ */
export function loanerHoldMessage(open: { item_name: string; isn: string }[]): string | null {
  if (!open.length) return null;
  const list = open.map((row) => `${row.item_name} (ISN ${row.isn})`).join(", ");
  return `ຍັງບໍ່ໄດ້ຮັບເຄື່ອງສຳຮອງຄືນ: ${list} — ຮັບຄືນຢູ່ໜ້າໃບງານກ່ອນ ຈຶ່ງສົ່ງເຄື່ອງຄືນລູກຄ້າໄດ້`;
}

/**
 * ລາຍການທີ່ຢູ່ **ນອກມາດຕະຖານ** — ນອກຊຸດ/ນອກນິຍາມ **ແລະ** ບໍ່ຢູ່ໃນກະຕ່າຂອງງານແລ້ວ.
 * (ຢູ່ໄຟລ໌ນີ້ເພາະເຫດຜົນດຽວກັນ: ດ່ານຂອງ addSpareLine(s) ຕ້ອງທົດສອບໄດ້ໂດຍບໍ່ຕ້ອງມີຖານ)
 *
 * ເປັນຫຍັງນັບ "ຢູ່ໃນກະຕ່າແລ້ວ" ວ່າຜ່ານ: ແຖວເກົ່າຖືກເພີ່ມມາກ່ອນປິດສະວິດ ຫຼື ມາຈາກ
 * ລະບົບເກົ່າ ⇒ ຫ້າມຕອນນີ້ = ແກ້ໃບຂໍເບີກທີ່ຄ້າງຢູ່ບໍ່ໄດ້.
 */
export function outsideStandardCodes(
  known: Iterable<string>,
  requested: readonly string[],
): string[] {
  const allowed = new Set(known);
  return requested.filter((code) => !allowed.has(code));
}
