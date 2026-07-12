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
 *
 * ── ທາງອອກຂອງຂັ້ນ 7 (ກຳລັງສັ່ງຊື້ອາໄຫຼ່) ──
 * ເດີມຂັ້ນ 7 ອອກໄດ້ດ້ວຍ spare_order_finish ເທົ່ານັ້ນ ແຕ່ຖັນນັ້ນເປັນ `time` (ບໍ່ມີວັນທີ)
 * ແລະ **ບໍ່ມີ code ບ່ອນໃດຂຽນມັນເລີຍ** (505 ໃບມີ spare_order, ມີແຕ່ 2 ໃບທີ່ມີ spare_order_finish)
 * ⇒ ວຽກຄ້າງຢູ່ຂັ້ນ 7 ຕະຫຼອດ (27 ໃບ, ເກົ່າສຸດ 225 ມື້) ຈົນກວ່າສາງຈະເບີກອາໄຫຼ່ໃຫ້.
 * ດຽວນີ້ສາງກົດ "ອາໄຫຼ່ມາຮອດແລ້ວ" (/stock/arrivals) → ຂຽນ spare_arrive (timestamp)
 * ⇒ ວຽກຕົກລົງຂັ້ນ 6 (ກຳລັງເບີກອາໄຫຼ່) ແລ້ວໄປໂຜ່ຢູ່ /stock/dispatch ຕາມປົກກະຕິ.
 * ຍັງນັບ spare_order_finish ຄືເກົ່າ ຈຶ່ງບໍ່ມີໃບເກົ່າໃບໃດປ່ຽນຂັ້ນ.
 */

/** ໃຊ້ໃນ SQL — ຕ້ອງ alias ຕາຕະລາງ tb_product ເປັນ a */
/**
 * ── ດ່ານກວດຮັບຄຸນນະພາບ (QC) — ຂັ້ນ 10 ໃໝ່ ──
 * ກຳລັງສ້ອມ → **ລໍກວດ QC** → ລໍສົ່ງຄືນ → ສົ່ງຄືນສຳເລັດ
 * ຂັ້ນ 10/11 ເກົ່າ ເລື່ອນເປັນ 11/12. ງານທີ່ QC ຍັງບໍ່ຜ່ານ ອອກໃບຮັບເງິນ/ສົ່ງຄືນບໍ່ໄດ້.
 */
export const STAGE_SQL = `case
  when a.status = 6                                            then -1
  when a.return_complete is not null                           then 12
  when a.time_finish_repair is not null
   and a.qc_finish is not null                                 then 11
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
       and a.spare_order_finish is null
       and a.spare_arrive is null                              then 7
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
  10: "ລໍກວດຮັບຄຸນນະພາບ",
  11: "ລໍຖ້າສົ່ງຄືນ",
  12: "ສົ່ງຄືນສຳເລັດ",
};

/**
 * ຊື່ຂັ້ນ ໃນຮູບ SQL — **ສ້າງຈາກ STAGE_LABEL ບ່ອນດຽວ**.
 * ແຕ່ກ່ອນ 3 ໄຟລ໌ຂຽນ `case … when 10 then 'ລໍຖ້າສົ່ງຄືນ' …` ຊ້ຳກັນເອງ
 * ⇒ ພໍເພີ່ມຂັ້ນ QC ເລກເລື່ອນໝົດ ແລະ ລາຍງານຈະສະແດງຊື່ຂັ້ນຜິດຢ່າງງຽບໆ.
 */
export const STAGE_LABEL_SQL = `case (${STAGE_SQL})
${Object.entries(STAGE_LABEL).map(([stage, label]) => `  when ${stage} then '${label}'`).join("\n")}
  else '-' end`;

/** ເງື່ອນໄຂ 3 ກຸ່ມໃຫຍ່ — ລວມກັນແລ້ວໄດ້ທຸກແຖວຂອງ tb_product ພໍດີ */
export const OPEN_JOBS = "a.status <> 6 and a.return_complete is null";
export const DONE_JOBS = "a.status <> 6 and a.return_complete is not null";
export const CANCELLED_JOBS = "a.status = 6";

/**
 * ເວລາທີ່ **ເຂົ້າຂັ້ນປັດຈຸບັນ** — ຄູ່ກັບ INSTALL_STAGE_TIME_COL ຂອງຝັ່ງຕິດຕັ້ງ.
 *
 * ຝັ່ງຕິດຕັ້ງມີອັນນີ້ມາແຕ່ຕົ້ນ ແຕ່ຝັ່ງສ້ອມບໍ່ມີ ⇒ ວັດ "ຄ້າງຢູ່ຂັ້ນນີ້ດົນປານໃດ" ບໍ່ໄດ້
 * ໄດ້ແຕ່ວັດ "ເປີດງານມາດົນປານໃດ" ເຊິ່ງບອກຄໍຂວດບໍ່ໄດ້: ວຽກທີ່ເປີດມາ 300 ມື້ ອາດຫາກໍ່
 * ຍ້າຍມາຂັ້ນນີ້ມື້ວານກໍ່ໄດ້. ແຕ່ລະຂັ້ນນັບຈາກເວລາທີ່ຂັ້ນກ່ອນໜ້າຈົບ.
 *
 * ຂັ້ນ 3/4 (ສະເໜີລາຄາ) ແລະ 5/8: ຖ້າຖັນທີ່ຄວນມີເປັນ null (ຂໍ້ມູນເກົ່າຂອງ ods)
 * ໃຫ້ຖອຍໄປໃຊ້ຖັນກ່ອນໜ້າ ດ້ວຍ coalesce — ບໍ່ດັ່ງນັ້ນຈະໄດ້ null ແລ້ວແຖວນັ້ນຫາຍຈາກການນັບ.
 */
export const STAGE_TIME_COL = `case (${STAGE_SQL})
  when 12 then a.return_complete
  when 11 then a.qc_finish
  when 10 then a.time_finish_repair
  when 9  then a.time_repair
  when 8  then coalesce(a.spare_finish, a.qt_finish, a.time_finish_check)
  when 7  then a.spare_order
  when 6  then coalesce(a.spare_arrive, a.spare_reg)
  when 5  then coalesce(a.qt_finish, a.time_finish_check)
  when 4  then coalesce(a.qt_start, a.time_finish_check)
  when 3  then a.time_finish_check
  when 2  then a.time_check
  when -1 then coalesce(a.cancel_start, a.time_register)
  else a.time_register
end`;

/** ວິນາທີທີ່ຄ້າງຢູ່ຂັ້ນປັດຈຸບັນ (ບໍ່ແມ່ນ "ຕັ້ງແຕ່ເປີດງານ") */
export const STAGE_ELAPSED_SQL = `greatest(0, round(extract(epoch from (localtimestamp - (${STAGE_TIME_COL})))))::int`;
