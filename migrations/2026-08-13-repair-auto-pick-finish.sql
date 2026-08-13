-- ── ສ້ອມ: ສາງເບີກອອກ = ຊ່າງໄດ້ຮັບ (13-08-2026 ຕາມຄຳສັ່ງ) ─────────────────────────
--
-- ຊ່າງສ້ອມ **ບໍ່ຈຳເປັນຕ້ອງກົດຮັບອາໄຫຼ່** ອີກຕໍ່ໄປ. ໂຄ້ດຈັດການໃບໃໝ່ໃຫ້ແລ້ວ:
--   lib/erp-dispatch  — ດຶງໃບເບີກ (56) ຈາກ ERP ແລ້ວ stamp `pick_finish` ໃຫ້ເລີຍ (ສະເພາະສ້ອມ)
--   lib/job-flow      — ດ່ານ "ຕ້ອງກົດຮັບກ່ອນຈົບສ້ອມ" ຖືກຖອນອອກ
--
-- ໄຟລ໌ນີ້ແມ່ນ **ຂໍ້ມູນເກົ່າ**: ໃບທີ່ສາງເບີກອອກໄປກ່ອນການປ່ຽນນີ້ ຍັງມີ pick_finish ຫວ່າງ
-- ⇒ ຄິວ "ຮັບອາໄຫຼ່" (ເວັບ ແລະ ແອັບ) ຍັງຄ້າງລາຍການພວກນັ້ນ ແລະ ປ້າຍ "ລໍຖ້າອາໄຫຼ່ n/m"
-- ຢູ່ໜ້າສ້ອມແປງຍັງນັບຜິດ. ຈົບການສ້ອມໄດ້ຢູ່ແລ້ວ (ດ່ານຖືກຖອນ) — ອັນນີ້ພຽງລ້າງໜ້າຈໍໃຫ້ຕົງ.
--
-- ຂອບເຂດ: ແຖວຂອງ**ວຽກສ້ອມ** (ມີໃນ tb_product ແລະ ບໍ່ແມ່ນລະຫັດງານຕິດຕັ້ງ) ທີ່
-- **ມີໃບເບີກ 56 ແລ້ວ** ເທົ່ານັ້ນ. ບໍ່ແຕະຝັ່ງຕິດຕັ້ງ — ຊ່າງຕິດຕັ້ງຍັງຕ້ອງກົດຮັບທຸກໃບ
-- (ເອົາຂອງອອກໜ້າງານຈິງ · 1 ງານມີຫຼາຍໃບເບີກ — ເບິ່ງ lib/install-spare-gate).
--
-- ບໍ່ສ້າງໃບ PISP (166) ຍ້ອນຫຼັງ: ໃບນັ້ນໝາຍວ່າ "ຊ່າງກົດຮັບ" ຈິງໆ ⇒ ຢ່າປອມເອກະສານ.
-- ແລ່ນຊ້ຳໄດ້ (idempotent — ແຖວທີ່ stamp ແລ້ວບໍ່ຖືກແຕະ).
--
-- ⚠️ ເວລາທີ່ໃສ່ = **ວັນທີ່ໃບເບີກລ່າສຸດຂອງລາຍການນັ້ນ** ບໍ່ແມ່ນ localtimestamp:
-- ໃສ່ "ດຽວນີ້" = ລາຍງານ ແລະ ໜ້າ /dashboard/tracking ("ຊ່າງຮັບອາໄຫຼ່") ຈະຂຶ້ນວ່າ
-- ວຽກເກົ່າ 1,851 ໃບ ຮັບອາໄຫຼ່ພ້ອມກັນມື້ນີ້ — ຕົວເລກທີ່ບໍ່ມີໃນຄວາມຈິງ.
-- ວັນທີ່ສາງເບີກອອກ = ຈັງຫວະທີ່ຂອງເຖິງມືຊ່າງແທ້ ⇒ ໃກ້ຄວາມຈິງທີ່ສຸດທີ່ຂໍ້ມູນມີ.
--
-- ⚠️ ໃນໂໝດ single-db (odg + schema ods) ຕ້ອງແລ່ນດ້ວຍ `search_path=ods`
-- ບໍ່ດັ່ງນັ້ນ ic_trans_detail ຈະໄປໂດນ **ຂອງ ERP (public)** ເຊິ່ງເປັນຄົນລະຊຸດ:
--   PGOPTIONS="-c search_path=ods" psql "$DATABASE_URL" -f <ໄຟລ໌ນີ້>

begin;

update tb_used_spare s
   set pick_finish = doc.at
  from (
    select d.product_code, d.item_code, max(d.doc_date)::timestamp as at
      from ic_trans_detail d
     where d.trans_flag = 56   -- TRANS.DISPATCH (lib/stock-constants)
     group by d.product_code, d.item_code
  ) doc
 where s.pick_finish is null
   and doc.product_code = s.product_code
   and doc.item_code = s.item_code
   and exists (select 1 from tb_product p where p.code = s.product_code)
   and not exists (select 1 from ods_tb_install i where i.code = s.product_code);

commit;
