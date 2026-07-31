-- ── ນິຍາມ "ອາໄຫຼ່ມາດຕະຖານ" ຂອງງານຕິດຕັ້ງ (ຢູ່ ODS) ────────────────────────────
--
-- ບັນຫາ: ລະບົບຖືເອົາ `ic_inventory_set_detail` ຂອງ ERP ເປັນ "ມາດຕະຖານ" ແຕ່ຊຸດນັ້ນ
-- ຄື **ອົງປະກອບຂອງຕົວເຄື່ອງເອງ** (ແອ [SET] → [C] ໜ່ວຍໃນ · [H] ໜ່ວຍນອກ · ກ່ອງທໍ່)
-- ບໍ່ແມ່ນອາໄຫຼ່ຕິດຕັ້ງ. ວັດຈາກຂໍ້ມູນຈິງ 1 ປີ (31-07-2026):
--     ງານຕິດຕັ້ງ 2,580 ງານ · ສິນຄ້າມີ "ຊຸດ" ໃນ ERP ພຽງ 18% ຂອງງານ
--     ແຖວອາໄຫຼ່ໃນກະຕ່າ 2,439 ແຖວ — **ຢູ່ໃນຊຸດ 0 ແຖວ**
-- ⇒ ສະວິດ "ຫ້າມເບີກນອກມາດຕະຖານ" (SETTING.INSTALL_SPARE_FREE_SEARCH) ປິດບໍ່ໄດ້ຈິງ
--   ເພາະຈະກາຍເປັນ "ຫ້າມເບີກທຸກຢ່າງ".
--
-- ວິທີແກ້: ນິຍາມມາດຕະຖານເອງຢູ່ ODS **ຕໍ່ໝວດສິນຄ້າ (+ຂະໜາດ)** ບໍ່ແມ່ນຕໍ່ລະຫັດສິນຄ້າ
-- (ສິນຄ້າ 376 ລະຫັດ/ປີ ດູແລບໍ່ໄຫວ · ໝວດມີສິບກວ່າ). ຂະໜາດຫວ່າງ = ໃຊ້ກັບທຸກຂະໜາດ
-- ຂອງໝວດນັ້ນ (ຄ່າຕັ້ງຕົ້ນ) ແລະ ແຖວທີ່ລະບຸຂະໜາດຈະຖືກໃຊ້ກ່ອນ (ເບິ່ງ lib/install-standard).
--
-- ບໍ່ມີແຖວ = ພຶດຕິກຳເກົ່າ (ຕົກໄປໃຊ້ຊຸດ ERP) ⇒ ຕິດຕັ້ງ migration ນີ້ແລ້ວບໍ່ມີຫຍັງປ່ຽນ
-- ຈົນກວ່າຜູ້ຈັດການຈະເລີ່ມນິຍາມຢູ່ /manage/install-standard.

create table if not exists ods_install_spare_standard (
  id            serial primary key,
  /** ໝວດສິນຄ້າ — tb_category.code (ອັນດຽວກັບ ods_tb_install.pro_type_code) */
  pro_type_code varchar(20)  not null,
  /** ຂະໜາດ — ods_tb_install.pro_size · '' = ທຸກຂະໜາດຂອງໝວດນີ້ */
  pro_size      varchar(50)  not null default '',
  item_code     varchar(50)  not null,
  item_name     varchar(255) not null,
  unit_code     varchar(20),
  qty           numeric      not null default 1,
  updated_by    varchar(100),
  updated_at    timestamp    not null default localtimestamp(0)
);

create unique index if not exists ods_install_spare_standard_uniq
  on ods_install_spare_standard (pro_type_code, pro_size, item_code);
