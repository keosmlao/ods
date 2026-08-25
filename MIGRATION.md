# ຍ້າຍ ODS ຈາກ Flask ມາ Next.js

ແອັບ Flask ເດີມຢູ່ `../ods`. ແອັບນີ້ຕໍ່ຖານ PostgreSQL ອັນເກົ່າ **ໂດຍບໍ່ປ່ຽນ schema ເດີມ**
(ຕາຕະລາງໃໝ່ຕື່ມຜ່ານ `migrations/*.sql` — ເບິ່ງ `SCHEMA-CHANGES.md`).

## ແລ່ນ

1. `cp .env.example .env.local` ແລ້ວຕື່ມ `DATABASE_URL` ຂອງຖານ ODS
2. ຕັ້ງ `AUTH_SECRET` ໃຫ້ຍາວ ແລະ ບໍ່ຊ້ຳໃຜ (ຢ່າງໜ້ອຍ 32 ຕົວອັກສອນ — `openssl rand -base64 48`)
3. `npm run dev`

## ຄວາມຄືບໜ້າ

- [x] ພື້ນຖານ Next.js App Router + TypeScript
- [x] connection pool ຂອງ PostgreSQL (ພ້ອມໂໝດ database ດຽວ ແຍກ schema)
- [x] Login ຮັບໄດ້ທັງລະຫັດແບບ plaintext ເກົ່າ ແລະ Werkzeug PBKDF2
- [x] session cookie ແບບ HTTP-only ທີ່ເຊັນແລ້ວ
- [x] ດ່ານກຳນົດສິດ (RBAC) ຢູ່ `src/proxy.ts` + ກວດຊ້ຳໃນ layout
- [x] ໂຄງໜ້າຈໍ ແລະ ເມນູ ທີ່ຮັບໄດ້ທັງຈໍໃຫຍ່-ຈໍມືຖື
- [x] Dashboard ຕໍ່ກັບຕາຕະລາງສ້ອມ ແລະ ຕິດຕັ້ງ
- [x] ຮັບເຄື່ອງ ແລະ ຂັ້ນຕອນສ້ອມ (`service/` · `checking/` · `repair/` · `qc/` · `close-jobs/`)
- [x] ຂັ້ນຕອນຕິດຕັ້ງ (`installations/` — ນັດ · ຈ່າຍວຽກ · ເບີກອາໄຫຼ່ · ຮັບງານ · ໃບບິນ)
- [x] ສະຕັອກ ແລະ ອາໄຫຼ່ (`stock/` · `spare-parts/` · ນັບສະຕັອກ · ໂອນ · ຮັບຄືນ)
- [x] ໃບຂໍຊື້ ແລະ ການອະນຸມັດ (`purchase-requests/` · `purchase-orders/` · `approvals/` · `quotations/`)
- [x] ລູກຄ້າ ແລະ ຂໍ້ມູນຫຼັກ (`customers/` · `manage/` — ພະນັກງານ · ຊ່າງ · ອັດຕາຄ່າແຮງ · ຕັ້ງຄ່າລະບົບ)
- [x] ລາຍງານ ແລະ ໃບພິມ (`reports/` 10+ ລາຍງານ · ໜ້າພິມ 12 ແບບ · export Excel)
- [x] ເຄລມ (`claims/`) · ບຳລຸງຮັກສາ (`maintenance/`) · ກິດຈະກຳປະຈຳວັນ (`activities/`)
- [x] ແອັບຊ່າງ Flutter + API ມືຖື (`src/app/api/mobile/`) · ແຈ້ງເຕືອນ FCM · ບັງຄັບອັບເດດ

### ຍັງເຫຼືອ

- [ ] ຕາຕະລາງບັນທຶກວ່າ migration ອັນໃດແລ່ນໄປແລ້ວ (ດຽວນີ້ແລ່ນດ້ວຍມື ບໍ່ມີບ່ອນຈື່)
- [ ] CI ແລ່ນ `npm run check` ໃຫ້ອັດຕະໂນມັດຕອນ push
- [ ] test ຍັງບາງ (62 ເຄສ ຄຸມສະເພາະກົດເກນໃນ `src/lib/`) — ບໍ່ມີ e2e
