-- ── ຄຳຂໍ **ປ່ຽນສະຖານະການຮັບປະກັນ** (ຮັບປະກັນ → ໝົດຮັບປະກັນ) ──
--
-- ເມື່ອກ່ອນຊ່າງກົດ "ໝົດຮັບປະກັນ" ຕອນກວດເຊັກແລ້ວ **ປ່ຽນທັນທີ** (lib/tech-flow) —
-- ນັ້ນຄືການຕັດສິນວ່າ **ລູກຄ້າຕ້ອງຈ່າຍ ຫຼື ບໍ່** ຈຶ່ງບໍ່ຄວນຂຶ້ນກັບຊ່າງຄົນດຽວ
-- ໂດຍບໍ່ມີໃຜກວດ. ດຽວນີ້ເປັນ **ຄຳຂໍ** ທີ່ຜູ້ຈັດການຕ້ອງອະນຸມັດກ່ອນ (ຕົກລົງ 01-08-2026)
-- ແລະ ງານ **ໄປຕໍ່ບໍ່ໄດ້** ຈົນກວ່າຈະຕັດສິນ (ດ່ານຢູ່ lib/warranty-request.warrantyBlock).
create table if not exists ods_warranty_request (
  id            bigserial primary key,
  job_code      varchar not null,
  -- ເກັບຄ່າ **ກ່ອນ** ໄວ້ນຳ ⇒ ຖອຍຄືນໄດ້ ແລະ ຮູ້ວ່າຂໍປ່ຽນຈາກຫຍັງເປັນຫຍັງ
  from_warranty varchar not null,
  to_warranty   varchar not null,
  reason        text    not null,
  requested_by  varchar not null,
  requested_at  timestamp not null default localtimestamp,
  -- pending | approved | rejected
  state         varchar not null default 'pending',
  decided_by    varchar,
  decided_at    timestamp,
  decide_note   text
);

create index if not exists ods_warranty_request_job on ods_warranty_request(job_code);

-- ໃບງານໜຶ່ງມີຄຳຂໍ **ທີ່ຍັງບໍ່ຕັດສິນ** ໄດ້ພຽງອັນດຽວ — ກັນຊ່າງກົດຊ້ຳຈົນຄິວເຕັມ
create unique index if not exists ods_warranty_request_open_uniq
  on ods_warranty_request(job_code) where state = 'pending';
