-- ═══════════════════════════════════════════════════════════════════
--  ແອັບມືຖືຂອງຊ່າງ — ຮັບ/ປະຕິເສດງານ · check-in/out ໜ້າງານ · ແຈ້ງເຕືອນ
--  ຖານ: ODS ເທົ່ານັ້ນ · ເພີ່ມຢ່າງດຽວ (ບໍ່ລົບ ບໍ່ແກ້ຂໍ້ມູນເກົ່າ)
--
--  ── 3 ຢ່າງທີ່ລະບົບຍັງບໍ່ມີ ──
--  ① ຊ່າງ **ປະຕິເສດງານບໍ່ໄດ້** — ມີແຕ່ "ຮັບງານ" (tech_confirm). ຊ່າງທີ່ຕິດວຽກ
--     ຫຼື ຢູ່ໄກ ໄດ້ແຕ່ປະງານໄວ້ ⇒ ງານນອນລໍຢູ່ໂດຍບໍ່ມີໃຜຮູ້ວ່າຊ່າງບໍ່ຮັບ.
--  ② **ບໍ່ມີຫຼັກຖານວ່າຊ່າງໄປຮອດໜ້າງານ** ສຳລັບວຽກນອກສະຖານທີ່ (ຕິດຕັ້ງ ແລະ ສ້ອມນອກ).
--     ຕາຕະລາງເກົ່າ ods_checkin_checkout_install ມີຢູ່ ແຕ່ຮອງຮັບແຕ່ຝັ່ງຕິດຕັ້ງ
--     ແລະ ຖືກໃຊ້ຈິງພຽງ 1 ງານ (INST-2516) ແລ້ວປະຖິ້ມ ⇒ ບໍ່ແຕະຂອງເກົ່າ ສ້າງອັນລວມໃໝ່.
--  ③ ບໍ່ມີບ່ອນເກັບ push token ⇒ ແຈ້ງເຕືອນອອກມືຖືບໍ່ໄດ້.
-- ═══════════════════════════════════════════════════════════════════

begin;

-- ── 1) ປະຕິເສດງານ ────────────────────────────────────────────────
--
-- ປະຕິເສດ = ຊ່າງບໍ່ຮັບງານນີ້ ພ້ອມເຫດຜົນ ⇒ ງານກັບໄປຄິວ "ລໍຖ້າຈັດຊ່າງ" ຂອງ CS
-- (ລ້າງ tech_code / emp_code ອອກ) ແລະ CS ໄດ້ຮັບການແຈ້ງເຕືອນ.
-- ເກັບປະຫວັດທຸກຄັ້ງ — ຊ່າງຄົນໃດປະຕິເສດຫຼາຍ ຫົວໜ້າຕ້ອງເຫັນ.
create table if not exists ods_job_reject (
  id         bigserial primary key,
  workflow   varchar(10) not null,
  job_code   varchar(50) not null,
  tech_code  varchar(100) not null,
  reason     text not null,
  created_at timestamp not null default localtimestamp(0),
  constraint ods_job_reject_workflow check (workflow in ('repair','install')));

create index if not exists ods_job_reject_job on ods_job_reject(workflow, job_code);
create index if not exists ods_job_reject_tech on ods_job_reject(tech_code);


-- ── 2) check-in / check-out ໜ້າງານ ──────────────────────────────
--
-- ໃຊ້ໄດ້ **ທັງສອງສາຍງານ**: ຕິດຕັ້ງ (ລົງໜ້າງານສະເໝີ) ແລະ ສ້ອມນອກສະຖານທີ່
-- (service_type ທີ່ບໍ່ແມ່ນຮັບເຂົ້າສູນ). ພິກັດ ແລະ ຮູບ = ຫຼັກຖານວ່າໄປຮອດຈິງ.
--
-- ⚠️ ຮູບເປັນ base64 ຄືກັບ QC ⇒ ແອັບບີບກ່ອນສົ່ງ ແລະ API ຈຳກັດຂະໜາດ.
create table if not exists ods_job_checkin (
  id          bigserial primary key,
  workflow    varchar(10) not null,
  job_code    varchar(50) not null,
  tech_code   varchar(100) not null,
  checkin_at  timestamp not null default localtimestamp(0),
  checkin_lat double precision,
  checkin_lng double precision,
  checkin_photo text,
  checkout_at  timestamp,
  checkout_lat double precision,
  checkout_lng double precision,
  note        text,
  constraint ods_job_checkin_workflow check (workflow in ('repair','install')));

-- ງານນຶ່ງງານ ຊ່າງຄົນນຶ່ງ ເປີດ check-in ຄ້າງໄວ້ໄດ້ອັນດຽວ (ຍັງບໍ່ check-out)
create unique index if not exists ods_job_checkin_open
  on ods_job_checkin(workflow, job_code, tech_code)
  where checkout_at is null;


-- ── 3) ອຸປະກອນຂອງຊ່າງ (push) ─────────────────────────────────────
--
-- token ຂອງ Expo (ExponentPushToken[...]) — ຄົນນຶ່ງມີຫຼາຍເຄື່ອງໄດ້.
-- ລຶບ token ເມື່ອ push ຖືກຕີກັບວ່າ DeviceNotRegistered (API ຈັດການໃຫ້).
create table if not exists ods_push_token (
  token      varchar(200) primary key,
  user_code  varchar(100) not null,
  platform   varchar(10),
  updated_at timestamp not null default localtimestamp(0));

create index if not exists ods_push_token_user on ods_push_token(user_code);

commit;
