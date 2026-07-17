-- ປິດງານຍົກເລີກເກົ່າ: ໝາຍ "ສົ່ງຄືນສຳເລັດ" ໃຫ້ໃບທີ່ຍົກເລີກແຕ່ຍັງບໍ່ໄດ້ຄືນ (570 ໃບ)
--
-- ── ເປັນຫຍັງ ──
-- ນິຍາມ "ວຽກຄ້າງ" ກຳລັງຈະປ່ຽນເປັນ "ທຸກໃບ ຍົກເວັ້ນສົ່ງຄືນສຳເລັດ" ⇒ ໃບຍົກເລີກ 570 ໃບ
-- ທີ່ບໍ່ເຄີຍຖືກໝາຍວ່າຄືນ (ເກົ່າສຸດ 1,397 ມື້) ຈະໄຫຼເຂົ້າມາເປັນວຽກຄ້າງທັງໝົດ ແລະ
-- ກາຍເປັນຄ້າງ 673 ໃບ ແທນ 103 ໃບ. ຄວາມຈິງຄື ເຄື່ອງເຫຼົ່ານັ້ນຈົບເລື່ອງໄປດົນແລ້ວ
-- ພຽງແຕ່ບໍ່ມີໃຜກົດປິດໃນລະບົບ (ຂັ້ນຕອນ "ຄືນເຄື່ອງ" ຫາກໍ່ມີເມື່ອບໍ່ດົນມານີ້).
--
-- ── ວັນທີ່ໃສ່ ──
-- `coalesce(cancel_finish, cancel_start)` = **ວັນທີ່ຍົກເລີກຈິງ** ບໍ່ແມ່ນວັນທີ່ແລ່ນ
-- migration ນີ້. ຖ້າໃສ່ວັນນີ້ໝົດ ລາຍງານຈະບອກວ່າ "ຄືນເຄື່ອງ 570 ໜ່ວຍມື້ດຽວ" ເຊິ່ງບໍ່ຈິງ
-- ແລະ ຈະໄປບິດເບືອນລາຍງານທຸກຕົວທີ່ແຍກຕາມວັນ. ທັງ 570 ໃບມີ cancel_start ຄົບ
-- (261 ໃບມີ cancel_finish ນຳ) ⇒ ບໍ່ມີໃບໃດຕ້ອງເດົາວັນທີ.
--
-- ── ຍ້ອນກັບແນວໃດ ──
-- ຕາຕະລາງ ods_return_backfill ເກັບລະຫັດໃບໄວ້ຄົບ. ຄືນຄ່າ:
--   update tb_product p set return_complete = null
--     from ods_return_backfill b where b.code = p.code;

create table if not exists ods_return_backfill (
  code          varchar primary key,
  return_set_to timestamp   not null,
  reason        varchar     not null,
  created_at    timestamp   not null default localtimestamp(0)
);

comment on table ods_return_backfill is
  'ໃບທີ່ຖືກໝາຍ return_complete ໂດຍ migration (ບໍ່ແມ່ນໂດຍຄົນ) — ໄວ້ຍ້ອນກັບ ແລະ ໄວ້ຮູ້ວ່າຕົວເລກມາຈາກໃສ';

-- ບັນທຶກກ່ອນຂຽນ (ຖ້າແລ່ນຊ້ຳ ໃບເກົ່າຈະບໍ່ຖືກນັບຊ້ຳ)
insert into ods_return_backfill(code, return_set_to, reason)
select a.code,
       coalesce(a.cancel_finish, a.cancel_start),
       'ຍົກເລີກແລ້ວແຕ່ບໍ່ເຄີຍໝາຍຄືນ — ປິດຕອນປ່ຽນນິຍາມວຽກຄ້າງ 17-07-2026'
  from tb_product a
 where a.status = 6
   and a.return_complete is null
   and coalesce(a.cancel_finish, a.cancel_start) is not null
on conflict (code) do nothing;

update tb_product a
   set return_complete = coalesce(a.cancel_finish, a.cancel_start)
 where a.status = 6
   and a.return_complete is null
   and coalesce(a.cancel_finish, a.cancel_start) is not null;
