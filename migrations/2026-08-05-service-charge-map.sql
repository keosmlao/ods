-- ═══════════════════════════════════════════════════════════════════════════
-- ຕາຕະລາງຈັບຄູ່ **ປະເພດເຄື່ອງ → ລາຍການຄ່າບໍລິການສ້ອມແປງ (9702xx ຂອງ ERP)**
--
-- ── ເປັນຫຍັງຕ້ອງມີ ──
-- ໜ້າໃບຮັບເງິນ (/returns/<ລະຫັດ>) ຕື່ມ **ອາໄຫຼ່** ໃສ່ບິນໃຫ້ອັດຕະໂນມັດຢູ່ແລ້ວ ແຕ່
-- **ຄ່າບໍລິການ** ຄົນຕ້ອງໄປເລືອກເອງຈາກລາຍການ 9702xx ທຸກໃບ (ມີເກືອບ 20 ລະຫັດ —
-- ກວດເຊັກ/ລ້າງ/ແປງ ແຍກຕາມຊະນິດ ແລະ BTU) ⇒ ເລືອກຜິດ ຫຼື ລືມໃສ່ ແລ້ວລາຍຮັບຫາຍ.
--
-- ⚠️ **ບໍ່ແມ່ນອັນດຽວກັບ `ods_service_rate`** — ອັນນັ້ນຄື **ຄ່າຄອມທີ່ຈ່າຍໃຫ້ພະນັກງານ**,
-- ອັນນີ້ຄື **ລາຍການທີ່ເກັບຈາກລູກຄ້າ**. ໂຄງສ້າງມິຕິຄືກັນ (ໝວດ/ແບບ/ຂະໜາດ/ປະເພດບໍລິການ)
-- ແລະ ໃຊ້ **ສູດຈັບຄູ່ອັນດຽວກັນ**: null = "ທຸກອັນ", ແຖວທີ່ລະອຽດກວ່າຊະນະ.
--
-- ລາຄາ: ງານ **ໃນປະກັນ** ໃສ່ 0 ສະເໝີ (ບໍ່ເກັບລູກຄ້າ) — ບັງຄັບຢູ່ໂຄດ ບໍ່ແມ່ນຢູ່ຕາຕະລາງນີ້
-- ⇒ ແຖວດຽວກັນໃຊ້ໄດ້ທັງສອງກໍລະນີ ບໍ່ຕ້ອງຕັ້ງສອງເທື່ອ.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists ods_service_charge_map (
  id            serial primary key,
  -- ມິຕິຈັບຄູ່ — ຫວ່າງ (null) = ໃຊ້ກັບທຸກຄ່າຂອງມິຕິນັ້ນ
  service_type  varchar(10),
  category_code varchar(20),
  design_code   varchar(20),
  size_code     varchar(20),
  -- ລາຍການທີ່ຈະຕື່ມໃສ່ບິນ (ic_inventory ຝັ່ງ ERP — ຂຶ້ນຕົ້ນ 9702)
  service_code  varchar(30) not null,
  service_name  text,
  unit_code     varchar(20),
  /** ລາຄາທີ່ເກັບລູກຄ້າ (ບາດ) ຕອນ **ນອກປະກັນ** — ໃນປະກັນລະບົບໃສ່ 0 ໃຫ້ເອງ */
  price_thb     numeric(14,2) not null default 0,
  is_active     boolean not null default true,
  updated_by    varchar(50),
  updated_at    timestamp not null default localtimestamp
);

create index if not exists idx_service_charge_map_active
  on ods_service_charge_map (is_active, category_code, design_code, size_code);
