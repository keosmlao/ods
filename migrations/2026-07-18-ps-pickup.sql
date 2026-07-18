-- ── PS: ຂັ້ນ "ໄປຮັບເຄື່ອງບ້ານລູກຄ້າມາສ້ອມຢູ່ສູນ" (18-07-2026) ──
--
-- PS (service_type='PS') ເຄື່ອງຢູ່ **ບ້ານລູກຄ້າ** ຈົນກວ່າຈະຖືກໄປຮັບເຂົ້າສູນ.
-- ຄົນໄປຮັບ = ຂົນສົ່ງ · CS ເປັນຄົນກົດ "ຮັບເຂົ້າສູນ" ຕອນເຄື່ອງມາຮອດ.
--
-- pickup_at = ເວລາທີ່ຮັບເຄື່ອງເຂົ້າສູນ (null = ຍັງບໍ່ຮັບ = ຢູ່ບ້ານ).
-- STAGE_SQL: PS ທີ່ pickup_at null ⇒ **ຂັ້ນ 0 "ລໍໄປຮັບເຄື່ອງ"** (ກ່ອນຂັ້ນ 1 ລໍກວດເຊັກ).
-- ⇒ ກວດນັບສະຕ໋ອກ (ຂັ້ນ 1-11) ບໍ່ນັບ PS ທີ່ຍັງຢູ່ບ້ານ ໂດຍອັດຕະໂນມັດ.

-- pickup_start = ເວລາ "ອອກໄປຮັບ" (ຂົນສົ່ງອອກເດີນທາງ). null = ຍັງບໍ່ອອກ.
--   pickup_start null              ⇒ "ລໍໄປຮັບເຄື່ອງ"  (ຄິວ, ຍັງບໍ່ອອກ)
--   pickup_start notnull, pickup_at null ⇒ "ກຳລັງໄປຮັບ" (ຂົນສົ່ງກຳລັງເດີນທາງ)
--   pickup_at notnull             ⇒ ຮັບເຂົ້າສູນແລ້ວ ⇒ ຂັ້ນ 1 "ລໍຖ້າກວດເຊັກ"
alter table tb_product add column if not exists pickup_at timestamp;
alter table tb_product add column if not exists pickup_start timestamp;

-- ຄິວ "ລໍໄປຮັບເຄື່ອງ" ກອງດ້ວຍ service_type + pickup_at ⇒ index ຊ່ວຍ
create index if not exists idx_tb_product_ps_pickup
  on tb_product (service_type, pickup_at)
  where service_type = 'PS';
