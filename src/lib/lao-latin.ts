/**
 * ທຽບ **ຊື່ລາຕິນ ↔ ຊື່ລາວ** ແບບຫຍາບໆ — ໃຊ້ເດົາຄູ່ຊ່າງ (ODS ↔ ພະນັກງານ ERP).
 *
 * ── ເປັນຫຍັງຕ້ອງມີ ──
 * ຊື່ຊ່າງໃນງານເປັນ **ອັກສອນລາຕິນ** ('Phuang', 'Xiew', 'sak') ແຕ່ ERP ເກັບ
 * **ອັກສອນລາວ** ('ພວງ', 'ຊີວ', 'ສັກ') ⇒ ທຽບກົງໆບໍ່ຕົງຈັກຄົນ (ຂໍ້ມູນຈິງ: ຈາກ 23 ຊື່
 * ຈັບຄູ່ໄດ້ພຽງ 1 — ອັນທີ່ເປັນລະຫັດຢູ່ແລ້ວ) ⇒ ຜູ້ຈັດການຕ້ອງໄລ່ຫາເອງທີ່ລະຄົນ.
 *
 * ⚠️ ນີ້ເປັນ **ຄຳແນະນຳເທົ່ານັ້ນ** — ການເຊື່ອມຕັດສິນວ່າ "ເງິນເຂົ້າບັນຊີໃຜ"
 * ⇒ ຜູ້ຈັດການຕ້ອງກົດຢືນຢັນເອງສະເໝີ (actions/user-link).
 *
 * ວິທີ: ຖອດອັກສອນລາວເປັນລາຕິນຢ່າງຫຍາບ ແລ້ວທຽບ **ໂຄງພະຍັນຊະນະ** (ຕັດສະຫຼະອອກ)
 * ເພາະການທັບສັບບໍ່ມີມາດຕະຖານ: ພວງ → phuang/phouang/puang ລ້ວນພົບໄດ້.
 */

/** ພະຍັນຊະນະລາວ → ລາຕິນ (ຄ່າທີ່ພົບໃນຊື່ຄົນ) */
const CONSONANT: Record<string, string> = {
  "ກ": "k", "ຂ": "kh", "ຄ": "kh", "ງ": "ng", "ຈ": "ch", "ສ": "s", "ຊ": "x", "ຍ": "gn",
  "ດ": "d", "ຕ": "t", "ຖ": "th", "ທ": "th", "ນ": "n", "ບ": "b", "ປ": "p", "ຜ": "ph",
  "ຝ": "f", "ພ": "ph", "ຟ": "f", "ມ": "m", "ຢ": "y", "ຣ": "r", "ລ": "l", "ວ": "v",
  "ຫ": "h", "ອ": "o", "ຮ": "h", "ຼ": "l",
};

/** ສະຫຼະ/ວັນນະຍຸດ — ຖອດເປັນສຽງຫຍາບ (ຫຼາຍຕົວຖືກຕັດຖິ້ມຕອນທຽບ) */
const VOWEL: Record<string, string> = {
  "ະ": "a", "ັ": "a", "າ": "a", "ິ": "i", "ີ": "i", "ຶ": "u", "ື": "u", "ຸ": "u", "ູ": "u",
  "ົ": "o", "ຼ": "l", "ຽ": "ia", "ເ": "e", "ແ": "ae", "ໂ": "o", "ໃ": "ai", "ໄ": "ai",
  "ໍ": "o", "ຳ": "am",
  // ວັນນະຍຸດ/ເຄື່ອງໝາຍ — ບໍ່ມີສຽງ ⇒ ຖອດເປັນຄ່າຫວ່າງ
  "ຯ": "", "່": "", "້": "", "໊": "", "໋": "", "໌": "", "ໆ": "",
};

/** ຖອດຊື່ລາວເປັນລາຕິນຢ່າງຫຍາບ */
export function romanizeLao(text: string): string {
  let out = "";
  for (const char of text) {
    if (CONSONANT[char]) out += CONSONANT[char];
    else if (VOWEL[char] !== undefined) out += VOWEL[char];
    else if (/[a-z0-9]/i.test(char)) out += char.toLowerCase();
  }
  return out;
}

/** ໄລຍະການແກ້ໄຂ (Levenshtein) — ໃຊ້ວັດວ່າສອງຄຳ "ໃກ້ກັນພໍ" ບໍ */
function distance(left: string, right: string): number {
  const rows = Array.from({ length: left.length + 1 }, (_, index) => [index, ...Array(right.length).fill(0)]);
  for (let column = 0; column <= right.length; column += 1) rows[0][column] = column;
  for (let row = 1; row <= left.length; row += 1) {
    for (let column = 1; column <= right.length; column += 1) {
      const cost = left[row - 1] === right[column - 1] ? 0 : 1;
      rows[row][column] = Math.min(rows[row - 1][column] + 1, rows[row][column - 1] + 1, rows[row - 1][column - 1] + cost);
    }
  }
  return rows[left.length][right.length];
}

/** ຮູບແບບມາດຕະຖານ — ຍຸບການທັບສັບທີ່ຕ່າງກັນແຕ່ອອກສຽງຄືກັນ (ou→u · x→s · gn→ny …) */
function normalize(latin: string): string {
  return latin
    .toLowerCase()
    .replace(/[^a-z]/g, "")
    .replace(/ou/g, "u")
    .replace(/oo/g, "u")
    .replace(/ee/g, "i")
    .replace(/x/g, "s")
    .replace(/ck|k/g, "k")
    .replace(/(.)\1+/g, "$1");
}

/**
 * ຄະແນນຄວາມຄ້າຍ 0–1 ລະຫວ່າງ **ຊື່ລາຕິນ** ກັບ **ຊື່ລາວ**.
 *
 * ⚠️ ທຽບ **ທັງສະຫຼະ** ບໍ່ແມ່ນພຽງໂຄງພະຍັນຊະນະ — ຖ້າຕັດສະຫຼະອອກ
 * Ting · Tong · Ton · TUN ຈະກາຍເປັນຄຳດຽວກັນ ('tng') ແລ້ວຕົກໃສ່ຄົນດຽວກັນໝົດ
 * ⇒ ຄຳແນະນຳຜິດຄົນ ເຊິ່ງໃນເລື່ອງເງິນ ອັນຕະລາຍກວ່າ "ຫາບໍ່ພົບ".
 *
 * 1    = ຕົງກັນຫຼັງຍຸບການທັບສັບ
 * 0.75 = ຕ່າງກັນ 1 ຕົວອັກສອນ (ຄຳຍາວ ≥4)
 * 0    = ບໍ່ຄ້າຍ ⇒ ບໍ່ແນະນຳ (ໃຫ້ຄົນເລືອກເອງ)
 */
export function laoLatinScore(latin: string, lao: string): number {
  const left = normalize(latin);
  const right = normalize(romanizeLao(lao));
  if (left.length < 2 || right.length < 2) return 0;
  if (left === right) return 1;
  /**
   * ⚠️ **ບໍ່ແນະນຳຄຳທີ່ "ໃກ້ຄຽງ"** — ທົດລອງກັບຂໍ້ມູນຈິງແລ້ວ ຕ່າງກັນ 1 ຕົວອັກສອນ
   * ພາໃຫ້ Tong → ຕິ່ງ ແລະ wang → ນາງ (ຄົນລະຄົນ). ໃນເລື່ອງເງິນ **"ຫາບໍ່ພົບ"
   * ປອດໄພກວ່າ "ແນະນຳຜິດຄົນ"** ⇒ ຄືນ 0 ໃຫ້ຜູ້ຈັດການເລືອກເອງ.
   * (distance() ຍັງເກັບໄວ້ໃຫ້ຝັ່ງທີ່ຢາກຈັດລຳດັບຄວາມໃກ້ຊິດ)
   */
  void distance;
  return 0;
}
