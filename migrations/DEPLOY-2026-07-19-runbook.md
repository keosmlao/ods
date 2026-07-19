# Deploy runbook — Repair workflow (session 18–19/07/2026)

ຄູ່ມື deploy ສຳລັບວຽກ session ນີ້ (PS/IH workflow · ອາໄຫຼ່ · ຄົງເຫຼືອສາງສ້ອມ · KPI · login audit · i18n phase 1).

---

## 1. Database migration (ODS)

Run ໜຶ່ງ script (idempotent — run ຊ້ຳໄດ້):

```bash
psql "$DATABASE_URL" -f migrations/DEPLOY-2026-07-19-repair-workflow.sql
```

ເພີ່ມ: `tb_product.pickup_at / pickup_start / dispatch_at` · ຕາຕະລາງ `ods_login_log` · `ods_repair_stock_cache`.
**ບໍ່ແຕະ ERP (odg).**

## 2. Environment variable

```
CRON_KEY=<ກະແຈລັບ>     # ຖ້າມີ /api/cron/sla ຢູ່ແລ້ວ = ໃຊ້ອັນເກົ່າ
```

## 3. Cron (ພາຍນອກ — crontab / scheduler)

```bash
# ① ເຕືອນ SLA (install + PS/IH ຄ້າງຂັ້ນໜ້າ) — ທຸກ 30 ນາທີ
*/30 * * * *  curl -s -H "x-cron-key: $CRON_KEY" https://<host>/api/cron/sla

# ② Refresh cache ຄົງເຫຼືອ ສາງສ້ອມ — ວັນລະຄັ້ງ ຕອນເຊົ້າ (ໃຊ້ ~11–25ວິ)
0 7 * * *     curl -s -H "x-cron-key: $CRON_KEY" https://<host>/api/cron/repair-stock
```

## 4. Post-deploy (ຄັ້ງດຽວ)

- ໜ້າ **ຄົງເຫຼືອ ສາງສ້ອມ** (`/stock/balance/repair`) → ກົດ **"ດຶງໃໝ່ຈາກ ERP"** ຄັ້ງທຳອິດ (ຫຼືລໍ cron ①)

---

## ຄຸນສົມບັດ ↔ ສິ່ງທີ່ຕ້ອງການ

| ຄຸນສົມບັດ | migration | env | cron |
|-----------|-----------|-----|------|
| PS ໄປຮັບ / IH ໄປສ້ອມ / ນຳເຂົ້າສູນ | pickup_*, dispatch_at | — | — |
| ຂໍເບີກເພີ່ມ · ໂອນມາຫ້ອງສ້ອມ · ຍົກເລີກ-parts | — | — | — |
| ຄົງເຫຼືອ ສາງສ້ອມ (browse cache) | ods_repair_stock_cache | — | ② |
| ຕິດຕາມການເຂົ້າລະບົບ | ods_login_log | — | — |
| ແຈ້ງເຕືອນ PS/IH ຄ້າງ | — | CRON_KEY | ① |
| KPI ຊ່າງ (SLA/ແຍກປະເພດ/front-stage) | dispatch_at | — | — |
| i18n phase 1 (ຫົວກຸ່ມ menu) | — | — | — |

## ໝາຍເຫດ

- **ຖັນ dispatch_at ໃໝ່** → KPI front-stage IH ເລີ່ມເກັບຂໍ້ມູນ**ຈາກ deploy ໄປ** (ໃບເກົ່າ null).
- Mobile app: build/ຢືນຢັນ APK ໃໝ່ (ມີ ນຳເຂົ້າສູນ · ຂໍເບີກເພີ່ມ · ສິນຄ້າຄົງເຫຼືອ · ຄົງເຫຼືອສາງສ້ອມ).
- Rollback: ຖັນ/ຕາຕະລາງໃໝ່ **add-only** (ບໍ່ລຶບຂໍ້ມູນເກົ່າ) — ຖ້າ rollback code, schema ຄ້າງໄວ້ໄດ້ ບໍ່ກະທົບ.
- ໃບໂອນມາຫ້ອງສ້ອມ (124) **ບໍ່ຕັດສະຕ໋ອກ** — ຕ້ອງໃຫ້ສາງໃຫຍ່ອອກໃບ FT ໃນ ERP ຈຶ່ງຮັບໄດ້.
