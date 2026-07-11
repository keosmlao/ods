/**
 * ຕົວຊ່ວຍ SQL ຂອງງານຕິດຕັ້ງ.
 *
 * ໝາຍເຫດ: ຂັ້ນ (stage) ແລະ ຊື່ສະຖານະຂອງງານຕິດຕັ້ງ ຍ້າຍໄປຢູ່ src/lib/install-stage.ts ໝົດແລ້ວ
 * (INSTALL_STAGE_SQL / installStageLabel) — ບ່ອນນີ້ເຫຼືອພຽງ remainingCase ທີ່ຍັງໃຊ້ຮ່ວມກັນ
 * ຢູ່ໜ້າ ຈັດຊ່າງ / ຂໍເບີກ / ສາງເບີກ / ຮັບອາໄຫຼ່.
 */

/** "ຮອດປະຈຸບັນ" — ໄລຍະເວລານັບແຕ່ timestamp ໜຶ່ງມາຮອດດຽວນີ້ (ຄື remaining ຂອງ ods) */
export function remainingCase(column: string) {
  return `case when ${column} > localtimestamp(0) then '00:00:00'
    else (localtimestamp(0) - ${column})::text end`;
}
