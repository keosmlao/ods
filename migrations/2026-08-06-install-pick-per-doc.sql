-- ═══════════════════════════════════════════════════════════════════════════
-- ແກ້ຂໍ້ມູນ: ງານຕິດຕັ້ງທີ່ຖືກໝາຍວ່າ "ຊ່າງຮັບອາໄຫຼ່ແລ້ວ" ທັງທີ່ຍັງມີ**ໃບເບີກຄ້າງຮັບ**
--
-- ── ເຫດ ──
-- syncErpDispatch (ຮຸ່ນ 04-08-2026) stamp `pick_finish` ໃຫ້ພ້ອມ `reg_finish` ຕອນ
-- ສາງເບີກຄົບ ⇒ ງານທີ່ມີໃບເບີກຫຼາຍໃບ ຂ້າມໄປ "ລໍຖ້າຕິດຕັ້ງ" ທັງທີ່ຊ່າງຍັງບໍ່ໄດ້ໄປຮັບອີກໃບ.
-- ໂຄດຖືກແກ້ແລ້ວ (lib/erp-dispatch) — ອັນນີ້ລ້າງ**ຂໍ້ມູນທີ່ຄ້າງຜິດ**ຢູ່ກ່ອນໜ້າ.
--
-- ⚠️ ສະເພາະງານທີ່ **ຍັງບໍ່ເລີ່ມຕິດຕັ້ງ ແລະ ຍັງບໍ່ປິດ** — ງານທີ່ຜ່ານໄປແລ້ວປະໄວ້ຄືເກົ່າ
-- (ດຶງກັບຈະເຮັດໃຫ້ປະຫວັດ ແລະ ຄ່າຄອມທີ່ຈ່າຍໄປແລ້ວປ່ຽນ).
-- ວັດ 06-08-2026: ກະທົບ 1 ໃບ (INST-7208 — ຮັບ 1 ໃນ 2 ໃບເບີກ).
-- ═══════════════════════════════════════════════════════════════════════════

update ods_tb_install a
   set pick_finish = null
 where a.pick_finish is not null
   and a.cancel_date is null
   and a.job_finish is null
   and a.start_install is null
   and exists (
     select 1 from ic_trans sw
      where sw.trans_flag = 56
        and sw.doc_ref in (select r.doc_no from ic_trans r
                            where r.trans_flag = 122 and r.product_code = a.code)
        and not exists (select 1 from ic_trans p
                         where p.trans_flag = 166 and p.doc_ref = sw.doc_no));
