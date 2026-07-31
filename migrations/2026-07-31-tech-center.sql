-- ── ຊ່າງ ↔ ສູນ (ຂົວຫຼວງ 1104 · ດອນຕີ້ວ 1206) ─────────────────────────────────
--
-- ບັນຫາ: ຮັບເຄື່ອງທີ່ຂົວຫຼວງ ແລ້ວຈັດໃຫ້ຊ່າງດອນຕີ້ວ = ເຄື່ອງຕ້ອງຍ້າຍໄປດອນຕີ້ວ ແຕ່ລະບົບ
-- ບໍ່ຮູ້ວ່າຊ່າງຄົນນັ້ນຢູ່ສູນໃດ ⇒ ຄົນຕ້ອງກົດ "ໂອນ" ເປັນຂັ້ນແຍກ ແລະ ລືມໄດ້ງ່າຍ.
-- (ກວດ 31-07-2026: ບໍ່ມີຖັນສາຂາ/ສູນ ຢູ່ users · ods_employee_role · odg_employee ມີແຕ່
--  department_code ເຊິ່ງເປັນ **ພະແນກ** ບໍ່ແມ່ນສູນບໍລິການ)
--
-- ⚠️ ຄີ = `tech_code` = **ຄ່າທີ່ຢູ່ໃນງານຈິງ** (tb_product.emp_code / ods_tb_install.tech_code
-- = session.username) ບໍ່ແມ່ນ employee_code ຂອງ ERP — ຊ່າງທີ່ຍັງບໍ່ໄດ້ເຊື່ອມຕົວຕົນ
-- (ຊື່ຫຼິ້ນ 'Mee' · 'Xiew') ຈຶ່ງຕັ້ງສູນໄດ້ຄືກັນ.
--
-- ບໍ່ມີແຖວ = ບໍ່ຮູ້ສູນ ⇒ **ບໍ່ໂອນອັດຕະໂນມັດ** (ພຶດຕິກຳເກົ່າ ບໍ່ປ່ຽນ).

create table if not exists ods_tech_center (
  tech_code  varchar(50) primary key,
  center     varchar(10) not null,
  updated_by varchar(100),
  updated_at timestamp not null default localtimestamp(0)
);

-- ຖັນທີ່ເຄີຍລອງໃສ່ ods_employee_role — ບໍ່ໃຊ້ (ຄີຄົນລະຊຸດກັບຄ່າໃນງານ)
alter table ods_employee_role drop column if exists center;
