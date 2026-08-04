-- ปลດງານຕິດຕັ້ງທີ່ຄ້າງຂັ້ນ 3 "ລໍຖ້າຮັບອາໄຫຼ່ຈາກການເບີກ" ໂດຍບໍ່ມີໃບໃຫ້ຮັບອີກແລ້ວ
--
-- ເຫດ: ດ່ານເກົ່າ (lib/install-spare-gate) ບັງຄັບ "ຂໍຄົບຕາມມາດຕະຖານ" ນຳ ⇒ ແຖວກະຕ່າ
-- (tb_used_spare) ທີ່ຊ່າງປ່ຽນຂອງແທນແລ້ວປະຄ້າງໄວ້ ບໍ່ມີເອກະສານຈັກໃບ ⇒ ບໍ່ມີໃບເບີກໃຫ້ຮັບ
-- ⇒ ບໍ່ມີປຸ່ມໃດ stamp ods_tb_install.pick_finish ໄດ້ ⇒ ງານຄ້າງຕະຫຼອດ.
--
-- ກົດເກນໃໝ່ (04-08-2026): ເບີກຄົບທຸກໃບຂໍ + ຮັບຄົບທຸກໃບເບີກ = ຜ່ານຂັ້ນ 3.
-- ໄຟລ໌ນີ້ເອົາກົດເກນໃໝ່ໄປໃສ່ໃບທີ່ຄ້າງຢູ່ກ່ອນແກ້ໂຄດ (ໂຄດໃໝ່ stamp ໃຫ້ແຕ່ຕອນກົດຮັບ).
--
-- ແລ່ນຊ້ຳໄດ້ (ໃບທີ່ stamp ແລ້ວຈະບໍ່ເຂົ້າເງື່ອນໄຂ pick_finish is null ອີກ).
-- ຢາກເບິ່ງກ່ອນ: ປ່ຽນ `update ... set` ເປັນ `select a.code, a.appoint_date from ods_tb_install a`.

update ods_tb_install a
   set pick_finish = localtimestamp(0)
 where a.cancel_date is null
   and a.job_finish is null
   and a.start_install is null
   and a.finish_install is null
   and a.tech_code is not null and a.tech_code <> ''
   and a.tech_confirm is not null
   and coalesce(a.used_spare, 0) = 1
   and a.reg_start is not null
   and a.pick_finish is null
   -- ຕ້ອງມີໃບເບີກ (56) ຢ່າງໜ້ອຍ 1 ໃບ — ບໍ່ດັ່ງນັ້ນຄືງານທີ່ຍັງບໍ່ເຄີຍໄດ້ຮັບຫຍັງເລີຍ
   and exists (
     select 1 from ic_trans t where t.product_code = a.code and t.trans_flag = 56
   )
   -- ບໍ່ເຫຼືອ item ໃດທີ່ "ຂໍ > ເບີກ" (ສາງຍັງບໍ່ຈ່າຍ) ຫຼື "ເບີກ > ຮັບ" (ຊ່າງຍັງບໍ່ກົດຮັບ)
   and not exists (
     select 1 from (
       select d.item_code,
              sum(case when d.trans_flag = 122 then d.qty
                       when d.trans_flag = 59  then -d.qty else 0 end) as requested,
              sum(case when d.trans_flag = 56  then d.qty else 0 end) as dispatched,
              sum(case when d.trans_flag = 166 then d.qty else 0 end) as received
         from ic_trans_detail d
        where d.product_code = a.code
          and d.trans_flag in (122, 59, 56, 166)
        group by d.item_code
     ) x
      where x.requested > x.dispatched or x.dispatched > x.received
   );
