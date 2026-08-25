# Deploy ຂຶ້ນ server

## ຄຳສັ່ງດຽວ

ເຂົ້າ server → ໄປໂຟນເດີໂປຣເຈັກ → ແລ່ນ:

```bash
bash scripts/deploy.sh
```

ສະຄິບເຮັດ: ດຶງໂຄດ (`git pull`) → `npm ci` → **ພິມລາຍການ migration ໃໝ່** → `npm run build` → restart (pm2 ຫຼື systemd).

ຖ້າຊື່ process ບໍ່ແມ່ນ `odss`:

```bash
ODSS_PM2_NAME=ຊື່ຂອງທ່ານ bash scripts/deploy.sh
# ຫຼື
ODSS_SERVICE=ຊື່ service bash scripts/deploy.sh
```

## Migration — ຕ້ອງແລ່ນເອງ

ລະບົບ**ບໍ່ມີຕາຕະລາງບັນທຶກ migration** ⇒ ສະຄິບພຽງແຕ່**ບອກ**ວ່າມີໄຟລ໌ໃໝ່ ບໍ່ໄດ້ແລ່ນໃຫ້
(ແລ່ນຊ້ຳໂດຍບໍ່ຕັ້ງໃຈ = ອັນຕະລາຍກວ່າ). ແລ່ນເອງ:

```bash
psql "$DATABASE_URL" -f migrations/2026-07-31-xxxx.sql
```

⚠️ **server ນີ້ບໍ່ມີ psql ແລະ ໃຊ້ schema `ods`** (ODS_SCHEMA=ods ໃນ .env.local) —
ແລ່ນຜ່ານ node ພ້ອມ `search_path` ບໍ່ດັ່ງນັ້ນຕາຕະລາງຈະຖືກສ້າງໃນ `public` ແລ້ວ
ແອັບຫາບໍ່ພົບ (`relation ... does not exist` — ພົບຈິງ 26-08-2026):

```bash
node --env-file-if-exists=.env.local -e '
const fs=require("fs"),{Client}=require("pg");
(async()=>{const c=new Client({connectionString:process.env.DATABASE_URL,options:"-c search_path=ods"});
await c.connect();await c.query(fs.readFileSync("migrations/ຊື່ໄຟລ໌.sql","utf8"));await c.end();})()'
```

ທຸກໄຟລ໌ຂຽນແບບ `if not exists` ⇒ ແລ່ນຊ້ຳບໍ່ພັງ ແຕ່ໃຫ້ກວດກ່ອນສະເໝີ.

**ຮອບ 31-07-2026** (ແລ່ນໃສ່ຖານແລ້ວຈາກເຄື່ອງພັດທະນາ — ຢືນຢັນກ່ອນແລ່ນຊ້ຳ):

| ໄຟລ໌ | ເຮັດຫຍັງ |
|---|---|
| `2026-07-31-service-loaner.sql` | ຕາຕະລາງ `ods_loaner` (ເຄື່ອງສຳຮອງໃຫ້ລູກຄ້າໃຊ້ກ່ອນ) |
| `2026-07-31-intake-center.sql` | ຖັນ `tb_product.intake_center` (ບ່ອນຮັບເຄື່ອງ) + index ຄິວລໍຮັບໂອນ |

## ສິ່ງທີ່ **ບໍ່ຢູ່ໃນ git** ⇒ deploy ບໍ່ໄດ້ເອົາໄປໃຫ້

| ຂອງ | ຕ້ອງເຮັດ |
|---|---|
| **APK ແອັບຊ່າງ** | `./scripts/publish-apk.sh` — ວາງ `public/downloads/ods.apk` **ພ້ອມ** `ods.apk.version` (ໃຫຍ່ ~27MB ⇒ ຢູ່ນອກ git) |
| **ໄຟລ໌ upload** | `ODS_UPLOADS_DIR` ຕ້ອງຊີ້ບ່ອນເກົ່າ (ຮູບຮັບເຄື່ອງ · ຮູບຜົນງານ) |
| **.env.local** | ບໍ່ຢູ່ໃນ git — ຢູ່ server ຂອງມັນເອງ |

ບໍ່ copy APK = ຊ່າງໂຫຼດໄດ້**ຕົວເກົ່າ** ໂດຍທີ່ໜ້າເວັບບອກວ່າອັບເດດແລ້ວ.

### ບັງຄັບອັບເດດແອັບຊ່າງ

ແອັບສົ່ງເວີຊັນຂອງຕົນມາທຸກຄຳຂໍ (`x-app-version`). `src/lib/app-update-gate.ts` ປຽບທຽບ
ກັບໄຟລ໌ `public/downloads/ods.apk.version` (ຄື APK ທີ່ວາງໃຫ້ໂຫຼດຢູ່) ⇒ ເກົ່າກວ່າ = ຕອບ
**426** ທຸກ route ຂອງມືຖື ⇒ ແອັບຂຶ້ນໜ້າ “ຕ້ອງອັບເດດ” ພ້ອມປຸ່ມໂຫຼດ+ຕິດຕັ້ງໃນຕົວ.

- ເປີດ/ປິດ: ຕັ້ງຄ່າລະບົບ → “ບັງຄັບແອັບຊ່າງອັບເດດເປັນເວີຊັນຫຼ້າສຸດ” (ຄ່າຕັ້ງຕົ້ນ = ເປີດ)
- **ບໍ່ມີໄຟລ໌ `.version` = ບໍ່ບັງຄັບໃຜ** — copy APK ດ້ວຍມືແລ້ວລືມໄຟລ໌ນີ້ ຄືຂໍ້ຜິດພາດທີ່ງຽບທີ່ສຸດ
  (ໜ້າ `/download` ຈຶ່ງຂຶ້ນປ້າຍເຕືອນໃຫ້ເມື່ອຂາດ) ⇒ ໃຊ້ `./scripts/publish-apk.sh` ສະເໝີ
- **ໄຟລ໌ຊື່ໃໝ່ໃນ `public/` ຕ້ອງ restart ກ່ອນຈຶ່ງໂຫຼດໄດ້** — Next 16 ສ້າງດັດຊະນີ public/
  ຕອນ server ເລີ່ມ ⇒ ວາງ `ods-beta.apk` ໃໝ່ແລ້ວກົດໂຫຼດຈະ 404 ຈົນກວ່າ `systemctl restart ods`
  (ຂຽນທັບຊື່ເກົ່າ `ods.apk` ບໍ່ຕ້ອງ restart — path ນັ້ນຢູ່ໃນດັດຊະນີແລ້ວ)
- login **ບໍ່ຖືກບລັອກ** (ຕ້ອງໃຫ້ຊ່າງເຂົ້າມາເຫັນໜ້າອັບເດດ) ແລະ ຄຳສັ່ງທີ່ຄ້າງໃນຄິວ offline
  ບໍ່ຖືກຖິ້ມເມື່ອພົບ 426 — ສົ່ງຄືນໃຫ້ຫຼັງອັບເດດແລ້ວ

## ຮູບຂຶ້ນ 404 (ແຖວມີໃນຖານ ແຕ່ເປີດຮູບບໍ່ໄດ້)

ຮອບ 16-07-2026 → 04-08-2026 ຝັ່ງ**ຂຽນ**ຫຼົບໄປໃສ່ `<project>/var/uploads` ເອງ ເມື່ອ
`ODS_UPLOADS_DIR` ຢູ່ນອກໂປຣເຈັກ/ນອກ home ແຕ່ຝັ່ງ**ອ່ານ** (`/api/uploads`) ອ່ານ
`ODS_UPLOADS_DIR` ກົງໆ ⇒ ຮູບຮັບເຄື່ອງ/ຄຳແຈ້ງ/ເຄມ ຂອງຊ່ວງນັ້ນຕົກຄ້າງຢູ່ບ່ອນຜິດ.

ດຽວນີ້ຂຽນບ່ອນດຽວ (`ODS_UPLOADS_DIR`) ແລະ ຝັ່ງອ່ານໄລ່ຫາ `var/uploads` ໃຫ້ນຳ ⇒ ຮູບເກົ່າກັບມາເປີດໄດ້.
ຢາກຍ້າຍໃຫ້ຮຽບຮ້ອຍ (ຄວນເຮັດ — `var/uploads` ຢູ່ໃນໂຟນເດີໂປຣເຈັກ, ຕິດ deploy/git clean ໄດ້):

```bash
ls var/uploads | wc -l                       # ມີຈັກໄຟລ໌ຕົກຄ້າງ
mv -n var/uploads/* "$ODS_UPLOADS_DIR"/      # ຍ້າຍໄປບ່ອນຈິງ (-n = ບໍ່ທັບຂອງເກົ່າ)
```

## ກວດຫຼັງ deploy

```bash
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3000/login    # ຄາດ 200
```

ແລ້ວເປີດເວັບກວດ 3 ໜ້າທີ່ປ່ຽນຮອບນີ້:
`/service/loaners` · `/service/transfers` · `/installations/spare-requests/<ເລກງານ>`
