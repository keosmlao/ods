-- ═══════════════════════════════════════════════════════════════════════════
-- **1 ໃບງານ = ຊ່າງໄດ້ຫຼາຍຄົນ** (10-08-2026 ຕາມຄຳສັ່ງ) — ຕິດຕັ້ງ · ສ້ອມ · ບຳລຸງຮັກສາ
--
-- ── ເປັນຫຍັງ ──
-- ວຽກຈິງໄປກັນເປັນທີມ (ແອຂຶ້ນຝາຄົນດຽວບໍ່ໄດ້ · ຕູ້ເຢັນໜັກ · ບ້ານໄກຕ້ອງມີຄົນຊ່ວຍ) ແຕ່
-- ຖານມີຊ່ອງຊ່າງ**ຊ່ອງດຽວ** (`ods_tb_install.tech_code` · `tb_product.emp_code` ·
-- `ods_tb_maintenance.emp_code`) ⇒ ຄົນທີ 2 **ບໍ່ເຫັນງານໃນແອັບເລີຍ** ⇒ ໄປນຳກັນແທ້ໆ
-- ແຕ່ check-in ບໍ່ໄດ້ ⇒ ບໍ່ມີຫຼັກຖານວ່າໄປ ແລະ ບໍ່ໄດ້ສ່ວນແບ່ງຄ່າຄອມ.
--
-- ── ວິທີ: ບໍ່ແຕະຊ່ອງເກົ່າ ──
-- ຊ່ອງເກົ່າ = **ຫົວໜ້າງານ** (ຄົນຮັບຜິດຊອບ · ຄົນກົດຮັບງານ/ຈົບງານ) ⇒ ລາຍງານ · ຄິວ ·
-- ERP · ໜ້າເວັບທັງໝົດທີ່ອ່ານຊ່ອງນັ້ນ **ເຮັດວຽກຄືເກົ່າ 100%**.
-- ຕາຕະລາງນີ້ເກັບແຕ່ **ຊ່າງຮ່ວມ** (ຄົນທີ 2 ຂຶ້ນໄປ) ⇒ ເພີ່ມສິດເຫັນງານ + check-in.
--
-- ── ຄ່າຄອມ ──
-- ບໍ່ຕ້ອງແກ້ຫຍັງ: `lib/commission` ແບ່ງຕາມ **ຮອບ check-in ຈິງ** (group by tech_code
-- ຂອງ `ods_job_checkin`) ຢູ່ແລ້ວ ⇒ ໃຜເຂົ້າໜ້າງານຈິງໄດ້ສ່ວນແບ່ງເອງອັດຕະໂນມັດ.
--
-- ── ວິທີແລ່ນ ──
--   psql "$DATABASE_URL" -f migrations/2026-08-10-job-helpers.sql
-- ແລ່ນຊ້ຳໄດ້ (if not exists). ຊື່ຕາຕະລາງລະບຸ schema `ods.` ໄວ້ຊັດ — psql ຕໍ່ເຂົ້າມາ
-- search_path ເປັນ "$user",public ບໍ່ແມ່ນ ods ຄືກັບ pool ຂອງແອັບ.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists ods.ods_job_tech (
  -- 'install' | 'repair' | 'maintenance' — ຄ່າດຽວກັບ `ods_job_checkin.workflow`
  workflow  varchar(12) not null,
  job_code  varchar(30) not null,
  -- ລະຫັດ login ຂອງຊ່າງ (ຄືກັບທີ່ຢູ່ຊ່ອງຫົວໜ້າ ແລະ `ods_job_checkin.tech_code`)
  tech_code varchar(50) not null,
  added_by  varchar(50),
  added_at  timestamp not null default localtimestamp,
  -- ຄົນດຽວກັນໃສ່ 2 ເທື່ອບໍ່ໄດ້
  primary key (workflow, job_code, tech_code)
);

-- ແອັບຖາມ "ວຽກຂອງຂ້ອຍມີຫຍັງແດ່" ດ້ວຍ tech_code ທຸກຄັ້ງທີ່ເປີດ ⇒ ຕ້ອງມີ index
create index if not exists idx_job_tech_person on ods.ods_job_tech (tech_code, workflow);

comment on table ods.ods_job_tech is
  'ຊ່າງຮ່ວມ (ຄົນທີ 2 ຂຶ້ນໄປ) ຂອງໃບງານ — ຫົວໜ້າຍັງຢູ່ຊ່ອງເກົ່າຂອງແຕ່ລະຕາຕະລາງ';
