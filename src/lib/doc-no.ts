import type { PoolClient } from "pg";

/**
 * ອອກເລກເອກະສານ ຄືກັບ ods (prefix + ປີເດືອນ + ລຳດັບ).
 * ods ໃຊ້ max()+1 ແບບບໍ່ລັອກ → ຊ້ຳກັນໄດ້ຖ້າສອງຄົນກົດພ້ອມກັນ.
 * ບ່ອນນີ້ໃຫ້ເອີ້ນພາຍໃນ transaction ທີ່ຖື pg_advisory_xact_lock() ແລ້ວ.
 */

export type DocKind =
  | "SIO"   // ໃບຂໍເບີກ (ສ້ອມ)        trans_flag 122
  | "SION"  // ໃບຂໍເບີກ (ຕິດຕັ້ງ)      trans_flag 122
  | "SWC"   // ເບີກອາໄຫຼ່              trans_flag 56
  | "PISP"  // ຊ່າງຮັບອາໄຫຼ່           trans_flag 166
  | "SRI"   // ໃບຂໍສົ່ງຄືນ             trans_flag 59
  | "SRT"   // ຮັບຄືນເຂົ້າສາງ          trans_flag 58
  | "SFRK"  // ໂອນຍ້າຍສາງ             trans_flag 124
  | "RQ"    // ຂໍອະນຸມັດສະເໜີຊື້        trans_flag 78
  | "SPR"   // ສະເໜີຊື້                trans_flag 2
  | "QT"    // ໃບສະເໜີລາຄາ            trans_flag 17
  | "SIN";  // ໃບຮັບເງິນ               trans_flag 44

/** ບາງຊະນິດໃຊ້ປີ 2 ຫຼັກ (YYMM) ບາງຊະນິດ 4 ຫຼັກ (YYYYMM) — ຕາມ ods */
const TWO_DIGIT_YEAR: ReadonlySet<DocKind> = new Set(["SPR", "SRT"]);

/** ຄວາມຍາວຂອງເລກລຳດັບທ້າຍ */
const SEQ_WIDTH: Partial<Record<DocKind, number>> = { QT: 5 };

/** ຄຳນຳໜ້າ + ປີເດືອນ, ຕົວຢ່າງ SWC202607 */
export function docPrefix(kind: DocKind, now = new Date()) {
  const year = TWO_DIGIT_YEAR.has(kind) ? String(now.getFullYear()).slice(-2) : String(now.getFullYear());
  return `${kind}${year}${String(now.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * ເລກເອກະສານຖັດໄປ — ນັບຕໍ່ພາຍໃນເດືອນນັ້ນ (ຂຶ້ນເດືອນໃໝ່ເລີ່ມ 1 ໃໝ່).
 * ຕ້ອງເອີ້ນຢູ່ໃນ transaction ທີ່ລັອກແລ້ວ ຈຶ່ງຈະບໍ່ຊ້ຳ.
 */
export async function nextDocNo(client: PoolClient, kind: DocKind, now = new Date()) {
  const prefix = docPrefix(kind, now);
  const width = SEQ_WIDTH[kind] ?? 4;
  const result = await client.query<{ seq: number }>(
    `select coalesce(max(substring(doc_no from ${prefix.length + 1})::int), 0) + 1 as seq
     from ic_trans
     where doc_no like $1 and substring(doc_no from ${prefix.length + 1}) ~ '^[0-9]+$'`,
    [`${prefix}%`],
  );
  return `${prefix}${String(result.rows[0].seq).padStart(width, "0")}`;
}
