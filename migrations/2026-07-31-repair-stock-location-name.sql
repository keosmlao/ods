-- ຊື່ຂອງ **ທີ່ຈັດເກັບ** (shelf) ໃນ cache ຄົງເຫຼືອສາງສ້ອມ.
--
-- ໜ້າ /stock/balance/repair ສະແດງແຕ່ລະຫັດ (110411 · 110412 …) ເຊິ່ງບໍ່ມີໃຜຈື່ໄດ້
-- ວ່າອັນໃດແມ່ນຫຍັງ. ERP ມີຊື່ຢູ່ ic_shelf.name_1 ແລ້ວ (110411 = ສາງສ້ອມແປງ ·
-- 110413 = ເຄື່ອງມືຊ່າງ · 120603 = AREA 2-ຫ້ອງສ້ອມ …) ⇒ ເກັບລົງ cache ຕອນດຶງ
-- ເພື່ອບໍ່ຕ້ອງ join ຂ້າມຖານທຸກເທື່ອທີ່ເປີດໜ້າ.
alter table ods_repair_stock_cache add column if not exists location_name varchar;
