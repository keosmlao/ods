-- ══════════════════════════════════════════════════════════════════════════════
--  ລວມແຖວຊ້ຳໃນ tb_used_spare — 1 ວຽກ + 1 ສິນຄ້າ = 1 ແຖວ (ຈຳນວນບວກກັນ)
-- ══════════════════════════════════════════════════════════════════════════════
--  ວັດ 04-08-2026: 80 ຄູ່ (ວຽກ+ສິນຄ້າ) ມີຫຼາຍກວ່າ 1 ແຖວ
--  ຕົວຢ່າງ ວຽກ 7530: ມໍເຕີ້ 140301-0226 ມີ 2 ແຖວ ×1 (roworder 42209 · 42397)
--  ເວລາສ້າງດຽວກັນທຸກມິນລິວິນາທີ ⇒ ຂຽນຊ້ຳ.
--
--  ວິທີ: ເກັບແຖວ roworder ນ້ອຍສຸດໄວ້ ບວກຈຳນວນຂອງແຖວອື່ນເຂົ້າ ແລ້ວລຶບແຖວທີ່ເຫຼືອ.
--  ຮັກສາຄ່າ "ໄກສຸດ" ຂອງເສັ້ນເວລາໄວ້ (reg_start · reg_finish · pick_finish) ບໍ່ໃຫ້ຖອຍຫຼັງ.
--
--  ປອດໄພ: ບໍ່ມີໃຜອ້າງ tb_used_spare.roworder ຂ້າມຕາຕະລາງ —
--    ic_trans / ic_trans_detail ຜູກດ້ວຍ product_code + item_code
--    lib/erp-dispatch ອັບເດດດ້ວຍ product_code + item_code
--    ມີແຕ່ removeRepairSpare ທີ່ໃຊ້ roworder ພາຍໃນຄຳຂໍດຽວ
--
--  ຍ້ອນກັບ: ແຖວທີ່ລຶບເກັບເຕັມຮູບແບບໄວ້ ods.fix_used_spare_dup_20260804
-- ══════════════════════════════════════════════════════════════════════════════

begin;

create table if not exists ods.fix_used_spare_dup_20260804 as
  select *, now() as fixed_at from ods.tb_used_spare where false;

with dup as (
  select product_code, item_code, min(roworder) keep_row,
         sum(coalesce(qty, 0)) total_qty, count(*) n
    from ods.tb_used_spare
   group by product_code, item_code
  having count(*) > 1
)
-- ① ເກັບແຖວທີ່ຈະລຶບໄວ້ກ່ອນ
insert into ods.fix_used_spare_dup_20260804
select s.*, now()
  from ods.tb_used_spare s
  join dup d on d.product_code = s.product_code and d.item_code = s.item_code
 where s.roworder <> d.keep_row;

-- ② ແຖວທີ່ເກັບໄວ້ ຮັບຈຳນວນລວມ + ເສັ້ນເວລາໄກສຸດ
update ods.tb_used_spare s
   set qty = d.total_qty,
       reg_start   = greatest(s.reg_start,   d.reg_start),
       reg_finish  = greatest(s.reg_finish,  d.reg_finish),
       pick_finish = greatest(s.pick_finish, d.pick_finish)
  from (
    select product_code, item_code, min(roworder) keep_row,
           sum(coalesce(qty, 0)) total_qty,
           max(reg_start) reg_start, max(reg_finish) reg_finish, max(pick_finish) pick_finish
      from ods.tb_used_spare
     group by product_code, item_code
    having count(*) > 1
  ) d
 where s.roworder = d.keep_row;

-- ③ ລຶບແຖວຊ້ຳ
delete from ods.tb_used_spare s
 using (
   select product_code, item_code, min(roworder) keep_row
     from ods.tb_used_spare
    group by product_code, item_code
   having count(*) > 1
 ) d
 where s.product_code = d.product_code
   and s.item_code = d.item_code
   and s.roworder <> d.keep_row;

commit;
