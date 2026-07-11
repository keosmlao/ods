/**
 * ຄ່າຄົງທີ່ຂອງສາງ/ອາໄຫຼ່ — ຖອດແບບຈາກ ods/stock.py, ods/spare_part.py, ods/newspare.py.
 * ໃນ ods ຄ່າພວກນີ້ຖືກຂຽນຝັງໄວ້ຫຼາຍບ່ອນ (hardcode) — ຢູ່ນີ້ລວມໄວ້ບ່ອນດຽວ.
 */

/** trans_flag ຂອງ ic_trans / ic_trans_detail */
export const TRANS = {
  /** ໃບຂໍເບີກ (ຊ່າງຂໍ) */
  REQUEST: 122,
  /** ໃບເບີກອາໄຫຼ່ (ສາງຈ່າຍ) */
  DISPATCH: 56,
  /** ຮັບຄືນເຂົ້າສາງ */
  RECEIVE_BACK: 58,
  /** ໃບຂໍສົ່ງຄືນ */
  RETURN_REQUEST: 59,
  /** ໂອນຍ້າຍສາງ */
  TRANSFER: 124,
  /** ແຖວຮ່າງໃນ ic_trans_detail_draft */
  DRAFT: 33,
} as const;

/** status ຂອງແຖວ ic_trans_detail */
export const LINE_STATUS = {
  /** ລໍຖ້າ */
  PENDING: 0,
  /** ເບີກແລ້ວ */
  ISSUED: 1,
  /** ຂໍສົ່ງຄືນ */
  RETURN_REQUESTED: 3,
  /** ກຳລັງສັ່ງຊື້ */
  ON_PURCHASE_ORDER: 5,
} as const;

/** ສາງທີ່ຊ່າງເລືອກໄດ້ຕອນຂໍເບີກ (ods: show_req → ic_warehouse where code in (...)) */
export const REQUEST_WAREHOUSES = ["1103", "1204", "1206", "1104"] as const;

/** ສາງທີ່ໜ້າ "ເບີກອາໄຫຼ່" ເບິ່ງເຫັນ ຖ້າຜູ້ໃຊ້ບໍ່ໄດ້ຜູກສາງໄວ້ (ods: spdispatch) */
export const DISPATCH_WAREHOUSES = ["1103", "1204", "1206", "1203"] as const;

/** ທີ່ເກັບທີ່ອະນຸຍາດ (ods: fetch_data_shelfx) */
export const ALLOWED_SHELVES = [
  "110301",
  "120401",
  "120601",
  "120602",
  "120603",
  "120604",
  "120605",
  "120606",
  "120301",
  "110413",
  "110411",
] as const;

/** ຄ່າຕັ້ງຕົ້ນເມື່ອໃບຂໍເບີກບໍ່ໄດ້ລະບຸສາງ (ods: save_dispatch) */
export const DEFAULT_WH = "1103";
export const DEFAULT_SHELF = "110301";

/** ສາງທີ່ຕັດ wh_qty ນຳ (ods: save_dispatch — ສາງອື່ນຕັດແຕ່ balance_qty) */
export const MAIN_WH = "1103";

/** ສາງ/ທີ່ເກັບຂອງໃບຮັບຄືນ (ods: save_com_return — ຝັງໄວ້ຕາຍຕົວ) */
export const RETURN_WH = "1103";
export const RETURN_SHELF = "110301";

/** ສາຂາ ERP: ດອນຕີ້ວ(1204) = '00', ນອກນັ້ນ = '01' (ods: save_dispatch) */
export function branchOf(whCode: string) {
  return whCode === "1204" ? "00" : "01";
}

/** ຄ່າຄົງທີ່ຂອງເອກະສານຝັ່ງ ERP (odg) */
export const ERP = {
  TRANS_TYPE: 3,
  SIDE_CODE: "400",
  DEPARTMENT_CODE: "4001",
  /** doc_format_code ຂອງໃບເບີກ */
  FORMAT_DISPATCH: "SWC",
  /** doc_format_code ຂອງໃບຮັບຄືນ */
  FORMAT_RECEIVE: "RIM",
} as const;

/** calc_flag: -1 = ຕັດອອກຈາກສາງ, 1 = ບວກເຂົ້າສາງ */
export const CALC_OUT = -1;
export const CALC_IN = 1;
