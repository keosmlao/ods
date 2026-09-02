# ODSS — ລະບົບບໍລິການ & ອາໄຫຼ່ (ODIEN Service)

ເວັບ Next.js 16 (App Router · TypeScript · Tailwind 4) ຕໍ່ຖານ PostgreSQL ຂອງ ODS ເດີມ
ພ້ອມ **ແອັບຊ່າງ** (Flutter, ໂຟນເດີ `mobile/`).

ຄອບຄຸມ: ຮັບເຄື່ອງ · ກວດ/ສ້ອມ · ຕິດຕັ້ງ · ອາໄຫຼ່ & ສະຕັອກ · ໃບຂໍຊື້/ອະນຸມັດ · ເຄລມ ·
ບຳລຸງຮັກສາ · ລູກຄ້າ · ລາຍງານ & ໃບພິມ.

## ເລີ່ມພັດທະນາ

```bash
cp .env.example .env.local   # ຕື່ມ DATABASE_URL ແລະ AUTH_SECRET ເປັນຢ່າງໜ້ອຍ
npm ci
npm run dev                  # http://localhost:3000
```

`.env.example` ຄືລາຍການ env ທັງໝົດທີ່ໂຄດອ່ານ ພ້ອມຄຳອະທິບາຍວ່າອັນໃດຈຳເປັນ/ທາງເລືອກ.
ບໍ່ຕັ້ງ `AUTH_SECRET` (ຢ່າງໜ້ອຍ 32 ຕົວອັກສອນ) = ແອັບຖິ້ມຕັ້ງແຕ່ຕອນ build — ຕັ້ງໃຈໃຫ້ເປັນແບບນັ້ນ.

## ຄຳສັ່ງ

| ຄຳສັ່ງ | ເຮັດຫຍັງ |
|---|---|
| `npm run dev` | dev server (ເປີດຈາກມືຖືໃນວົງ LAN ໄດ້ — ເບິ່ງ `next.config.ts`) |
| `npm run test:unit` | unit test (`tests/*.test.mts`, node test runner) |
| `npm run lint` · `npm run typecheck` | eslint · tsc |
| `npm test` | unit + lint + typecheck |
| `npm run check` | `npm test` + `npm run build` — **ແລ່ນອັນນີ້ກ່ອນ push** |

## ຂຶ້ນ server

```bash
bash scripts/deploy.sh      # ດຶງໂຄດ → npm ci → ເຕືອນ migration ໃໝ່ → build → restart
```

ແລ່ນ **ເທິງ server** (systemd unit `ods`, port 3007). migration ຢູ່ `migrations/*.sql`
ແລ່ນດ້ວຍມື (`psql "$DATABASE_URL" -f ...`) — deploy.sh ພຽງແຕ່ພິມລາຍການທີ່ໃໝ່ຂຶ້ນມາ.
ລາຍລະອຽດ: [`docs/06-deploy.md`](docs/06-deploy.md)

## ເອກະສານ

| ໄຟລ໌ | ເນື້ອໃນ |
|---|---|
| `AGENTS.md` | ຂໍ້ຄວນຮູ້ກ່ອນແກ້ໂຄດ (Next ຮຸ່ນນີ້ຕ່າງຈາກທີ່ຄຸ້ນເຄີຍ) |
| `docs/06-deploy.md` | ຂັ້ນຕອນ deploy · ສິ່ງທີ່ບໍ່ຢູ່ໃນ git · ບັງຄັບອັບເດດແອັບ |
| `docs/guide/` | ຄູ່ມືຜູ້ໃຊ້ · ຂັ້ນຕອນວຽກ · SOP · ແບບຟອມ |
| `SCHEMA-CHANGES.md` · `migrations/` | ການປ່ຽນແປງຖານຂໍ້ມູນ |
| `MIGRATION.md` | ຄວາມຄືບໜ້າການຍ້າຍຈາກ Flask ມາ Next.js |
| `mobile/README.md` | ແອັບຊ່າງ (Flutter) — build · ເຊັນ APK · FCM |

## ໂຄງສ້າງ

```
src/app/(app)/     ໜ້າທີ່ຕ້ອງ login (37 ໝວດວຽກ)
src/app/api/       REST endpoint (ແອັບມືຖື · cron · export)
src/app/actions/   Server Action (ບ່ອນຂຽນຂໍ້ມູນ)
src/lib/           ກົດເກນທຸລະກິດ ໃຊ້ຮ່ວມກັນ (web + mobile)
src/proxy.ts       ດ່ານກຳນົດສິດ (RBAC) — Next 16 ປ່ຽນຊື່ middleware ເປັນ proxy
migrations/        SQL ແລ່ນດ້ວຍມື
mobile/            ແອັບຊ່າງ Flutter
```
