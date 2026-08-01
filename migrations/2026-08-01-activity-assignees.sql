-- ── ກິດຈະກຳ **ມອບໃຫ້ຫຼາຍຄົນ** ໄດ້ (01-08-2026) ──
--
-- `ods_activity.assigned_to` ເປັນຄໍລຳດຽວ ⇒ ວຽກທີ່ຕ້ອງການຫຼາຍຄົນ (ເຊັ່ນ CS ນັດ
-- ແລ້ວຢາກໃຫ້ຜູ້ຈັດການຕິດຕາມນຳ) ຕ້ອງສ້າງກິດຈະກຳຊ້ຳຫຼາຍອັນ ຫຼື ບໍ່ດັ່ງນັ້ນຄົນທີ 2
-- ກໍ່ບໍ່ເຫັນມັນເລີຍ.
--
-- ⚠️ **ຮັກສາ `assigned_to` ໄວ້** ເປັນຜູ້ຮັບຜິດຊອບຫຼັກ (ຄົນທຳອິດ) — ໜ້າຈໍ ·
-- notification · ແລະ ຂໍ້ມູນເກົ່າ ອ້າງອີງມັນຢູ່. ຕາຕະລາງນີ້ເປັນ **ສ່ວນເພີ່ມ**
-- ບໍ່ແມ່ນສິ່ງທົດແທນ ⇒ ບໍ່ມີໜ້າໃດພັງຈາກການປ່ຽນນີ້.
-- ⚠️ ຊື່ `ods_activity_assignee` ໃຊ້ບໍ່ໄດ້ — ມີຢູ່ແລ້ວເປັນ **index** ຂອງ ods_activity
-- (ຊື່ index ກັບ ຊື່ຕາຕະລາງ ຢູ່ namespace ດຽວກັນໃນ PG)
create table if not exists ods_activity_person (
  activity_id bigint  not null references ods_activity(id) on delete cascade,
  username    varchar not null,
  primary key (activity_id, username)
);

create index if not exists ods_activity_person_user on ods_activity_person(username);

-- ຂໍ້ມູນເກົ່າ: ຜູ້ຮັບຜິດຊອບຄົນດຽວທີ່ມີຢູ່ ⇒ ໃສ່ເປັນແຖວທຳອິດ
insert into ods_activity_person(activity_id, username)
select id, assigned_to from ods_activity
 where coalesce(assigned_to,'') <> ''
on conflict do nothing;
