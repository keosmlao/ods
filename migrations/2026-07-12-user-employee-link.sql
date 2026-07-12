-- ═══════════════════════════════════════════════════════════════════
--  ເຊື່ອມຕົວຕົນ: ຜູ້ໃຊ້ ODS ↔ ພະນັກງານ ERP
--  ຖານ: ODS ເທົ່ານັ້ນ · ເພີ່ມຢ່າງດຽວ · ບໍ່ແຕະຕາຕະລາງ users ທີ່ລະບົບເກົ່າໃຊ້ຢູ່
--
--  ── ບັນຫາ ──
--  ງານບັນທຶກຊ່າງໄວ້ເປັນ tech_code / emp_code ເຊິ່ງເປັນ **ຊື່ຜູ້ໃຊ້ ODS**:
--    ຊ່າງ 25 ຄົນທີ່ປາກົດໃນງານ — ມີພຽງ 2 ຄົນທີ່ຄ່າຕົງກັບ odg_employee.employee_code
--    ອີກ 23 ຄົນເປັນຊື່ຫຼິ້ນລາວທີ່ຂຽນເປັນອັກສອນລາຕິນ:
--        Xiew → ຊີວ (23037) · Mee → ມີ (14001) · sak → ສັກ (23031) · Phan → ແພນ (22040)
--  ⇒ ຄ່າຄອມຂອງຊ່າງຢູ່ຄົນລະລະບົບຕົວຕົນກັບ ຜູ້ຄຸມ/ຫົວໜ້າທີມ/Admin (ທີ່ໃຊ້ employee_code)
--    ແລະ ຈ່າຍເງິນເຂົ້າລະບົບບັນຊີ ERP ບໍ່ໄດ້.
--
--  ── ວິທີແກ້ ──
--  ຕາຕະລາງເຊື່ອມແຍກຕ່າງຫາກ (ບໍ່ເພີ່ມຖັນໃສ່ users ເພາະລະບົບ ods/Flask ຍັງໃຊ້ຢູ່).
--  ການທັບສັບບໍ່ແນ່ນອນ ⇒ ຈັບຄູ່ອັດຕະໂນມັດ 100% ບໍ່ໄດ້ ⇒ ຜູ້ຈັດການຢືນຢັນເອງ
--  (ໜ້າ /manage/technicians ສະເໜີຄູ່ທີ່ນ່າຈະແມ່ນໃຫ້).
-- ═══════════════════════════════════════════════════════════════════

begin;

create table if not exists ods_user_employee (
  user_code     varchar(50) primary key,   -- users.code ຂອງ ODS (= tech_code / emp_code ໃນງານ)
  employee_code varchar(50) not null,      -- odg_employee.employee_code ຂອງ ERP
  updated_by    varchar(100),
  updated_at    timestamp not null default localtimestamp(0));

create index if not exists ods_user_employee_emp on ods_user_employee(employee_code);

commit;
