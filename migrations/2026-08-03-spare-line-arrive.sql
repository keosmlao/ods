-- ─── ຄວາມຈິງລະດັບແຖວ: ວັນຮັບເຂົ້າສາງຂອງແຕ່ລະແຖວໃບຂໍເບີກ (03-08-2026) ───
--
-- ບັນຫາ: tb_product ເກັບວັນຮັບເຂົ້າຄືນດຽວ (spare_arrive) ສຳລັບທຸກຮອບການສັ່ງຊື້
-- ⇒ ວຽກທີ່ສັ່ງຊື້ຫຼາຍຮອບ (ຂໍ້ມູນຈິງ: 81 ວຽກມີ RQ ຫຼາຍຮອບ) ຖານເກົ່າບອກໄດ້ແຕ່
-- "ຮອບທຳອິດຮັບເຂົ້າແລ້ວຫຼືຍັງ" — ແຖວ status=5 ຂອງຮອບໃໝ່ຖືກຖືວ່າ "ມາຮອດແລ້ວ"
-- ຕາມທຸງຂອງວຽກ ທັງທີ່ຂອງຮອບນັ້ນຍັງບໍ່ທັນສັ່ງ/ມາຮອດ (ກວດພົບ 8 ວຽກ 11 ແຖວ
-- ປ້າຍຜິດເປັນ "ລໍຖ້າເບີກ" ທັງທີ່ຍັງລໍການສັ່ງຊື້).
--
-- ແກ້: ຄວາມຈິງຢູ່ແຖວເອກະສານ — arrive_at ຂອງແຕ່ລະແຖວ ຄືວັນທີ່ລາຍການນັ້ນ
-- ຮັບເຂົ້າສາງຈິງ (syncErpPurchase ສະແຕມໃຫ້ຈາກໃບຮັບເຂົ້າ PUIT ຂອງ ERP).
-- STAGE_SQL ຂັ້ນ 7 ແລະ ປ້າຍ "ກຳລັງສັ່ງຊື້" ທຸກບ່ອນ ອ່ານຈາກແຖວນີ້ ບໍ່ແມ່ນທຸງວຽກ.
-- ຖັນເກົ່າ spare_arrive ຍັງຖືກຂຽນ (coalesce) ເພື່ອ backward compat.

alter table ic_trans_detail add column if not exists arrive_at timestamp;

-- backfill: ວຽກທີ່ມີ spare_arrive ແລ້ວ = ERP ຢືນຢັນຮັບເຂົ້າ**ຄົບທຸກໃບຂໍຊື້**
-- (syncErpPurchase ບັງຄັບ items_received >= items ກ່ອນສະແຕມ) ⇒ ແຖວ status=5
-- ທັງໝົດຂອງວຽກນັ້ນ ຄືລາຍການທີ່ມາຮອດແລ້ວ ໃສ່ວັນດຽວກັບທຸງວຽກໃຫ້ຕົງກັນ.
-- ⚠️ ກັ້ນ **ວັນຂອງໃບ SIO ຕ້ອງບໍ່ຫຼັງວັນຮັບ**: ໃບທີ່ອອກຫຼັງນັ້ນ ຄືການສັ່ງຊື້
-- **ຮອບໃໝ່** ທີ່ຍັງບໍ່ທັນໄດ້ຮັບເຂົ້າ (ຂໍ້ມູນຈິງ: ວຽກ 6683 — SIO2026060128 ອອກ
-- 25-06 ຫຼັງຮັບຮອບທຳອິດ 23-06 ⇒ ຖ້າບໍ່ກັ້ນ ແຖວຮອບໃໝ່ຈະຖືກປ້າຍຜິດວ່າມາຮອດແລ້ວ).
update ic_trans_detail d
   set arrive_at = a.spare_arrive
  from tb_product a
 where d.product_code = a.code
   and d.trans_flag = 122
   and coalesce(d.status,0) = 5
   and a.spare_arrive is not null
   and exists (select 1 from ic_trans t
                where t.doc_no = d.doc_no and t.trans_flag = 122
                  and t.doc_date <= a.spare_arrive);

-- ແກ້ຄືນແຖວຮອບໃໝ່ທີ່ backfill ລຸ້ນທຳອິດ (ບໍ່ກັ້ນວັນ) ເຄີຍປ້າຍຜິດໄວ້
update ic_trans_detail d
   set arrive_at = null
  from tb_product a
 where d.product_code = a.code
   and d.trans_flag = 122
   and coalesce(d.status,0) = 5
   and d.arrive_at is not null
   and exists (select 1 from ic_trans t
                where t.doc_no = d.doc_no and t.trans_flag = 122
                  and t.doc_date > a.spare_arrive);
