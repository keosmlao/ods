# ການປ່ຽນແປງຖານຂໍ້ມູນ (ODS)

ບັນຊີການປ່ຽນແປງທັງໝົດທີ່ odss-next ເຮັດກັບຖານ **ODS** (`odservice`).
ທຸກອັນ **ຖືກ apply ໃສ່ຖານຈິງແລ້ວ** ແລະ ໄດ້ຮັບການອະນຸມັດຈາກຜູ້ໃຊ້ກ່ອນລົງມື.

> ຖານ **ERP** (`odg`) ເປັນ **ອ່ານຢ່າງດຽວ** — ລະບົບນີ້ບໍ່ເຄີຍຂຽນລົງ ERP ຈັກຄັ້ງ.
> ຂໍ້ມູນຫຼັກ (ລູກຄ້າ, ສິນຄ້າ, ຫຍີ່ຫໍ້, ພະນັກງານ, SN) ດຶງຈາກ ERP ສົດໆ.

ການປ່ຽນແປງທັງໝົດເປັນການ **ເພີ່ມຢ່າງດຽວ** (ບໍ່ລຶບ, ບໍ່ແກ້ຂໍ້ມູນເກົ່າ)
ຈຶ່ງລະບົບເກົ່າ (ods / Flask) ຍັງແລ່ນຄຽງຄູ່ໄດ້ໂດຍບໍ່ພັງ.

---

## 1. `tb_product.repair_note` (ຄໍລຳໃໝ່)

```sql
alter table tb_product add column if not exists repair_note varchar;
```

**ເປັນຫຍັງ:** ods ຮັບ "ໝາຍເຫດ/ວິທີແກ້ໄຂ" ຈາກຊ່າງຕອນສ້ອມແປງສຳເລັດ ແລ້ວ **ຖິ້ມຖິ້ມ**
(ບໍ່ໄດ້ບັນທຶກລົງ DB ເລີຍ) ເພາະ `tb_product.remark` ຖືກໃຊ້ເປັນເຫດຜົນຍົກເລີກໄປແລ້ວ.
ດຽວນີ້ວິທີແກ້ໄຂຂອງຊ່າງຖືກເກັບໄວ້ ແລະ ສະແດງຢູ່ໜ້າໃບຮັບເຄື່ອງ.

---

## 2. Chatter ແລະ ກິດຈະກຳ (ແບບ Odoo) — 3 ຕາຕະລາງໃໝ່

ໃຊ້ໄດ້ກັບທຸກເອກະສານຜ່ານຄູ່ `(model, res_id)`:
`tb_product` (ໃບຮັບເຄື່ອງ) · `ods_tb_install` (ງານຕິດຕັ້ງ) · `ic_trans` (ເອກະສານສາງ) · `ar_customer` (ລູກຄ້າ)

```sql
create table ods_chatter_message (
  id bigserial primary key,
  model varchar(50) not null,
  res_id varchar(50) not null,
  kind varchar(10) not null default 'comment',   -- comment = ຄົນພິມ · log = ລະບົບບັນທຶກເອງ
  body text not null,
  author varchar(100) not null,
  created_at timestamp not null default localtimestamp(0));
create index ods_chatter_message_res on ods_chatter_message(model, res_id, id desc);

create table ods_chatter_follower (
  id bigserial primary key,
  model varchar(50) not null,
  res_id varchar(50) not null,
  username varchar(100) not null,
  created_at timestamp not null default localtimestamp(0),
  unique (model, res_id, username));

create table ods_activity (
  id bigserial primary key,
  model varchar(50) not null,
  res_id varchar(50) not null,
  kind varchar(20) not null default 'todo',      -- todo | call | visit | meeting
  summary varchar(200) not null,
  note text,
  assigned_to varchar(100) not null,
  due_date date not null,
  state varchar(10) not null default 'planned',  -- planned | done | cancelled
  created_by varchar(100) not null,
  created_at timestamp not null default localtimestamp(0),
  done_at timestamp,
  done_note text);
create index ods_activity_res on ods_activity(model, res_id, state);
create index ods_activity_assignee on ods_activity(assigned_to, state, due_date);
```

**ເປັນຫຍັງ:** ods ບໍ່ມີບ່ອນຄຸຍກັນເທິງເອກະສານ ແລະ ບໍ່ມີປະຫວັດວ່າໃຜເຮັດຫຍັງເມື່ອໃດ
(ຮູ້ໄດ້ແຕ່ຈາກຖັນເວລາ ເຊັ່ນ `time_check`). ດຽວນີ້ທຸກຂັ້ນວຽກຂຽນ log ອັດຕະໂນມັດ.

---

## 3. `ods_notification` — ແທນ LINE Notify

```sql
create table ods_notification (
  id bigserial primary key,
  username varchar(100) not null,
  model varchar(50) not null,
  res_id varchar(50) not null,
  kind varchar(20) not null default 'message',
  body text not null,
  actor varchar(100) not null,
  created_at timestamp not null default localtimestamp(0),
  read_at timestamp);
create index ods_notification_inbox on ods_notification(username, read_at, id desc);
```

**ເປັນຫຍັງ:** ods ຍິງ LINE Notify ຢູ່ 11 ຈຸດຂອງສາຍງານ ແຕ່ **LINE ປິດບໍລິການ
`notify-api.line.me` ວັນທີ 31-03-2025** ⇒ ການແຈ້ງເຕືອນຂອງລະບົບເກົ່າຕາຍໄປໝົດແລ້ວ.
ດຽວນີ້ແຈ້ງເຕືອນໃນແອັບ ຫາຜູ້ຕິດຕາມເອກະສານ + ຄົນທີ່ຖືກມອບໝາຍ + ກຸ່ມທີ່ຕ້ອງລົງມືຕໍ່ (ສາງ, ຜູ້ອະນຸມັດ).

---

## 4. `ods_employee_role` — ກຳນົດສິດພະນັກງານ

```sql
create table ods_employee_role (
  employee_code varchar(50) primary key,   -- odg_employee.employee_code
  identity varchar(100) not null,          -- ຊື່ເຂົ້າລະບົບ (= ຊື່ຫຼິ້ນ, ຄືກັບ session.username)
  app_role varchar(30) not null,           -- '' = ບໍ່ກຳນົດເອງ (ໃຊ້ສິດຕາມຕຳແໜ່ງ)
  active boolean not null default true,    -- false = login ບໍ່ໄດ້
  updated_by varchar(100) not null,
  updated_at timestamp not null default localtimestamp(0));
create index ods_employee_role_identity on ods_employee_role(identity);
```

**ເປັນຫຍັງ:** ຜູ້ຈັດການຕ້ອງກຳນົດສິດພະນັກງານໄດ້ເອງ ໂດຍ **ບໍ່ຂຽນລົງ ERP**.
ລຳດັບຄວາມສຳຄັນຂອງສິດ:

1. `ods_employee_role.app_role` (ຜູ້ຈັດການກຳນົດ) — ຊະນະສະເໝີ
2. `users.roles` (ຜູ້ໃຊ້ເກົ່າຂອງ ODS)
3. ຄິດຈາກ ERP: **ຕຳແໜ່ງ** (11 ຜູ້ຈັດການ · 12 ຫົວໜ້າໜວຍງານ · 13 ພະນັກງານ)
   ບວກ **ພະແນກ** (401-403 ຊ່າງ · 501 ສາງ · 405 CS) — ເບິ່ງ `src/lib/erp-auth.ts`

---

## ສິ່ງທີ່ **ບໍ່** ໄດ້ແຕະ

- **view `tracking_tb_product`** — ຍັງຢູ່ຄືເກົ່າ ເພື່ອບໍ່ໃຫ້ລະບົບເກົ່າພັງ,
  ແຕ່ odss-next **ບໍ່ໃຊ້ມັນອີກແລ້ວ** (ເງື່ອນໄຂຂອງມັນບໍ່ຄົບກໍລະນີ ⇒ ວຽກ 5 ໃບ
  ຫາຍອອກຈາກທຸກໜ້າ ແລະ ທຸກລາຍງານ). ແທນດ້ວຍ `STAGE_SQL` ໃນ `src/lib/stage.ts`
  ເຊິ່ງຄອບຄຸມທຸກແຖວ 100% (5,065/5,065).
- ຕາຕະລາງເກົ່າ `tb_type`, `tb_brand`, `users` — ຍັງຢູ່ (ລະບົບເກົ່າຍັງໃຊ້)
  ແຕ່ຕົວໃໝ່ດຶງຂໍ້ມູນຫຼັກຈາກ ERP ແທນ.
- ຕາຕະລາງ `unit`, `products`, `category` ທີ່ ods ອ້າງເຖິງ — **ບໍ່ມີໃນຖານຂໍ້ມູນເລີຍ**
  (3 ໜ້ານັ້ນຂອງ ods ເປັນໂຄ້ດຕາຍ, ເປີດແລ້ວ 500).

---

## ຄ່າບໍລິການ ແລະ ຄ່າຄອມຂອງຊ່າງ — 1 ຄໍລຳ + 4 ຕາຕະລາງໃໝ່

ໄຟລ໌: `migrations/2026-07-12-service-commission.sql` (apply ແລ້ວ)

```sql
alter table tb_product add column if not exists item_code varchar;
create table ods_service_rate (...);               -- ອັດຕາຄ່າບໍລິການ (ບາທ)
create table ods_service_commission_split (...);   -- ເປີເຊັນຕໍ່ບົດບາດ
create table ods_service_commission_payee (...);   -- ໃຜຮັບເງິນຂອງແຕ່ລະບົດບາດ
create table ods_service_payout (...);             -- ເງິນທີ່ **ແຊ່ໄວ້ຕອນປິດງານ**
```

**ເປັນຫຍັງ `tb_product.item_code`:** ໜ້າ `/service/new` ຄົ້ນສິນຄ້າ ERP ຢູ່ແລ້ວ
(`/api/products` ຄືນ `item_code` ມາ) ແຕ່ `createService` **ຖິ້ມລະຫັດຖິ້ມ** ⇒ ໃບຮັບເຄື່ອງ
ໄປຫາ `ic_size` / `ic_design` ຂອງ ERP ບໍ່ໄດ້ ແລະ ຄິດຄ່າບໍລິການ (ທີ່ແບ່ງຕາມຂະໜາດ/ແບບ) ບໍ່ໄດ້.
(`master_product` ຫວ່າງ 0/5,066 · ຕາຕະລາງ serial ຂອງ ERP ວ່າງເປົ່າ ⇒ ບໍ່ມີເສັ້ນທາງອື່ນ)

**ມິຕິຂອງອັດຕາມາຈາກ ERP ບ່ອນດຽວ** (ອ່ານຢ່າງດຽວ): `ic_category` · `ic_design`
(ແອຕິດຝາ/ແອແຄັດເສັດ/ແອຕູ້ຕັ້ງ) · `ic_size` (`"11,000-14,999 btu."` — ເປັນຊ່ວງພ້ອມແລ້ວ)
⇒ ບໍ່ຕ້ອງແກະ BTU ອອກຈາກຂໍ້ຄວາມ ແລະ ບໍ່ເກັບຂະໜາດຊ້ຳໃນ ODS.

**ເປັນຫຍັງຕ້ອງແຊ່ເງິນ (`ods_service_payout`):** ຖ້າຄິດສົດທຸກຄັ້ງທີ່ເປີດລາຍງານ
ພໍປ່ຽນອັດຕາເດືອນໜ້າ **ເງິນຂອງເດືອນທີ່ຈ່າຍໄປແລ້ວຈະປ່ຽນຕາມ**.

**namespace ຂອງຜູ້ຮັບເງິນ:** ໃຊ້ `users.code` ຂອງ ODS (ຄ່າດຽວກັບ `tech_code`/`emp_code`)
**ບໍ່ແມ່ນ** `odg_employee.employee_code` ຂອງ ERP — ຄ່າຈິງໃນງານປົນກັນລະຫວ່າງ
ຊື່ຜູ້ໃຊ້ ('Xiew', 'sak') ກັບ ລະຫັດພະນັກງານ ('22040') ⇒ ຖ້າໃຊ້ຄົນລະ namespace
ລາຍງານຈະຈັດກຸ່ມເງິນບໍ່ຕົງກັນ ແລະ ເງິນຂອງບາງຄົນຫາຍ.

### ຄ່າມາດຕະຖານຂອງອັດຕາ (seed)

ໄຟລ໌: `migrations/2026-07-12-service-rate-seed.sql` (apply ແລ້ວ) — ມີຜົນ **2026-07-01 → 2026-12-31**
ຕິດຕັ້ງ 30 ອັດຕາ · ສ້ອມແປງ 32 ອັດຕາ (ເປີດໃຊ້) + ຮ່າງ 18 ອັດຕາ (ປິດໄວ້)

**⚠️ ມິຕິທີ່ບໍ່ມີໃນຂໍ້ມູນງານ:** ຕາຕະລາງຕົ້ນສະບັບແຍກລາຄາດ້ວຍ 2 ຢ່າງທີ່ລະບົບບອກເອງບໍ່ໄດ້ —
ຕິດຕັ້ງ: `(ບໍ່ຮວມ / ຮວມ ຄ່າເດີນສາຍໄຟ)` · ສ້ອມແປງ: `ແປງ / ລ້າງ / ຖອດຂຶ້ນຕຳ`.
ງານບໍ່ມີຖັນໃດບອກສິ່ງເຫຼົ່ານີ້ ⇒ ຖ້າເປີດໃຊ້ 2 ອັດຕາທີ່ມິຕິຄືກັນ ການຈັບຄູ່ຈະ **ເລືອກມົ້ວ**.
ຈຶ່ງເປີດໃຊ້ສະເພາະ **ອັດຕາພື້ນຖານ** (ແປງ · ບໍ່ຮວມສາຍໄຟ) ແລະ ໃສ່ຕົວແປອື່ນເປັນ **ຮ່າງ (is_active=false)**.
ຈະໃຫ້ຕົວແປເຮັດວຽກອັດຕະໂນມັດ ຕ້ອງເພີ່ມຖັນໃສ່ງານ ("ປະເພດວຽກ" / "ຮວມສາຍໄຟ").

### ເຊື່ອມຕົວຕົນ: ຜູ້ໃຊ້ ODS ↔ ພະນັກງານ ERP

ໄຟລ໌: `migrations/2026-07-12-user-employee-link.sql` (apply ແລ້ວ)

```sql
create table ods_user_employee (user_code varchar(50) primary key, employee_code varchar(50) not null, ...);
```

ງານບັນທຶກຊ່າງໄວ້ເປັນ `users.code` ຂອງ ODS ('Xiew','sak','Mee') ເຊິ່ງເປັນ **ຊື່ຫຼິ້ນລາວ
ທີ່ຂຽນເປັນອັກສອນລາຕິນ** (ຊີວ · ສັກ · ມີ) ສ່ວນຜູ້ຮັບເງິນບົດບາດອື່ນເປັນ
`odg_employee.employee_code` ⇒ ຄົນລະລະບົບຕົວຕົນ ແລະ ຈ່າຍເຂົ້າບັນຊີ ERP ບໍ່ໄດ້.
ຊ່າງ 25 ຄົນທີ່ປາກົດໃນງານ ຈັບຄູ່ອັດຕະໂນມັດໄດ້ພຽງ **2 ຄົນ** ⇒ ຜູ້ຈັດການຢືນຢັນເອງ
ທີ່ `/manage/technicians` (ລະບົບສະເໜີຄູ່ທີ່ນ່າຈະແມ່ນໃຫ້ ຈາກຊື່ຫຼິ້ນ).

`computePayout` ແປງຜ່ານສະພານນີ້ **ຕັ້ງແຕ່ຕອນແຊ່ເງິນ** ⇒ ຄ່າຄອມທຸກແຖວອອກມາເປັນ
`employee_code` ອັນດຽວກັນ. ຍັງບໍ່ເຊື່ອມ → ໃຊ້ຄ່າເດີມ (ເງິນບໍ່ຫາຍ ແຕ່ບໍ່ຜູກກັບ ERP).
