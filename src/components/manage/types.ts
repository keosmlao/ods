/** ຜົນຂອງ server action ທີ່ຟອມໃນ /manage ແລະ /customers ໃຊ້ຮ່ວມກັນ */
export type ActionState = { error?: string; ok?: string };

/** ຂໍ້ຄວາມ — ຄັດລອກມາຈາກ ods ໂດຍກົງ */
export const MSG = {
  saved: "ບັນທຶກສຳເລັດ",
  edited: "ແກ້ໄຂສຳເລັດ",
  deleted: "ລົບສຳເລັດ",
  inUse: "ບໍ່ສາມາດລົບໄດ້ ຂໍ້ມູນຖືກນຳໃຊ້ເເລ້ວ!",
  dupCode: "ລະຫັດຊໍ້າ",
  dupUser: "ຊື່ຜູ້ໃຊ້ນີ້ມີເເລ້ວ",
  expired: "Session ໝົດອາຍຸ",
  required: "ກະລຸນາປ້ອນຊ່ອງທີ່ຈຳເປັນໃຫ້ຄົບ",
  failed: "ບັນທຶກບໍ່ສຳເລັດ ກະລຸນາກວດຂໍ້ມູນ",
} as const;

/** ສິດເຂົ້າໃຊ້ — ຄືກັບ dropdown ໃນ ods/templates/user/user.html */
export const ROLES = ["manager", "admin", "technical", "stock"] as const;
export type Role = (typeof ROLES)[number];
