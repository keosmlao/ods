-- ກວດນັບສະຕັອກ: ໝາຍ "ນັບບໍ່ພົບ / ຫາຍ" ໄດ້ (reversible).
-- found = true  ⇒ ນັບພົບ (ມີເຄື່ອງຈິງ, ຄ່າ default ⇒ ແຖວເກົ່າ = ພົບ)
-- found = false ⇒ ນັບບໍ່ພົບ/ຫາຍ (ປິດຈາກຄິວກວດນັບ ແຕ່ຍ້ອນຄືນໄດ້ ໂດຍລຶບແຖວ)
alter table ods_stock_count add column if not exists found boolean not null default true;
