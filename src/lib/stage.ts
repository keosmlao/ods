/**
 * ຂັ້ນຕອນຂອງໃບຮັບເຄື່ອງສ້ອມ (tb_product) — ຄິດຈາກຖັນເວລາໂດຍກົງ.
 *
 * ── ເປັນຫຍັງບໍ່ໃຊ້ view tracking_tb_product ──
 * view ນັ້ນຜູກ warrunty ເຂົ້າກັບ qt_* ແລະ used_spare ເຂົ້າກັບ spare_* ຢ່າງແໜ້ນ:
 * ຖ້າຂ້າມຂັ້ນໃດຂັ້ນນຶ່ງ (ກົດ "ຈົບ" ໂດຍບໍ່ໄດ້ກົດ "ເລີ່ມ"), ຫຼື ອອກໃບສະເໜີລາຄາ
 * ໃຫ້ວຽກທີ່ຍັງຮັບປະກັນ → ບໍ່ເຂົ້າກິ່ງໃດເລີຍ ໄດ້ status_real = 0
 * ແລ້ວວຽກນັ້ນ "ຫາຍ" ອອກຈາກທຸກໜ້າ. ປັດຈຸບັນມີ 5 ໃບຕິດຢູ່ແບບນັ້ນ
 * (668, 1303, 1580, 3953, 4619 — ສົ່ງຄືນລູກຄ້າໄປແລ້ວ ແຕ່ບໍ່ມີໃນລາຍງານໃດເລີຍ).
 *
 * ຕົວນີ້ເປັນ case ແບບ "ອັນທຳອິດທີ່ຖືກ ຊະນະ" ຈຶ່ງ **ບໍ່ມີທາງຕົກຫຼົ່ນ**:
 * ທຸກໃບຕ້ອງໄດ້ຂັ້ນນຶ່ງສະເໝີ (-1 ຫຼື 1..11).
 */

/** ໃຊ້ໃນ SQL — ຕ້ອງ alias ຕາຕະລາງ tb_product ເປັນ a */
export const STAGE_SQL = `case
  when a.status = 6                                            then -1
  when a.return_complete is not null                           then 11
  when a.time_finish_repair is not null                        then 10
  when a.time_repair is not null                               then 9
  when a.time_check is null and a.time_finish_check is null    then 1
  when a.time_finish_check is null                             then 2
  when a.warrunty = 'ໝົດຮັບປະກັນ' and a.qt_start is null
       and a.qt_finish is null                                 then 3
  when a.warrunty = 'ໝົດຮັບປະກັນ' and a.qt_finish is null      then 4
  when coalesce(a.used_spare,0) = 1 and a.spare_reg is null    then 5
  when coalesce(a.used_spare,0) = 1 and a.spare_finish is null
       and a.spare_order is not null
       and a.spare_order_finish is null                        then 7
  when coalesce(a.used_spare,0) = 1 and a.spare_finish is null then 6
  else 8
end`;

export const STAGE_LABEL: Record<number, string> = {
  [-1]: "ຍົກເລີກ",
  1: "ລໍຖ້າກວດເຊັກ",
  2: "ກຳລັງກວດເຊັກ",
  3: "ລໍຖ້າສະເໜີລາຄາ",
  4: "ກຳລັງສະເໜີລາຄາ",
  5: "ລໍຖ້າຂໍເບີກອາໄຫຼ່",
  6: "ກຳລັງເບີກອາໄຫຼ່",
  7: "ກຳລັງສັ່ງຊື້ອາໄຫຼ່",
  8: "ລໍຖ້າສ້ອມແປງ",
  9: "ກຳລັງສ້ອມແປງ",
  10: "ລໍຖ້າສົ່ງຄືນ",
  11: "ສົ່ງຄືນສຳເລັດ",
};

/** ເງື່ອນໄຂ 3 ກຸ່ມໃຫຍ່ — ລວມກັນແລ້ວໄດ້ທຸກແຖວຂອງ tb_product ພໍດີ */
export const OPEN_JOBS = "a.status <> 6 and a.return_complete is null";
export const DONE_JOBS = "a.status <> 6 and a.return_complete is not null";
export const CANCELLED_JOBS = "a.status = 6";
