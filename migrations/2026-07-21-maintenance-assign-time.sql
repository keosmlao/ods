-- ເວລາ "ຈັດຊ່າງ" ຂອງງານສ້ອມບໍລຸງ — ຈັບໄວ້ເພື່ອຄິດ duration ຂັ້ນ 0 (ຮັບແຈ້ງ→ຈັດຊ່າງ)
-- ແລະ ຂັ້ນ 1 (ລໍຊ່າງຮັບ) ໃນ timeline ໄດ້ຖືກຕ້ອງ. ບໍ່ໃຊ້ appoint_date (ນັ້ນແມ່ນວັນນັດ ບໍ່ແມ່ນເວລາຈັດ).
alter table ods_tb_maintenance add column if not exists assign_time timestamp;
