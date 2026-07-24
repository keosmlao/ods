#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# ย้าย odservice (89 tables) → เข้า schema `ods` ภายใน odg (same server)
# กลยุทธ์: ย้ายทั้งหมดเป็น ods.* (รวม 14 table ที่ชนชื่อกับ ERP → เก็บแยก, พฤติกรรมเดิม)
#
# ⚠️⚠️  PRODUCTION (db.odienmall.com) — ห้ามรันตรงบน prod รอบแรก  ⚠️⚠️
#   1. รันบน **สำเนา/staging** ก่อนเสมอ
#   2. มี **backup** ก่อนทุกครั้ง (ขั้นที่ 1 ทำให้)
#   3. verify ครบ แล้วค่อยสลับ env + ขึ้น prod ในช่วง maintenance
#   4. rollback = ไม่แตะ odservice เดิมเลย (script นี้ copy เข้า odg เท่านั้น ไม่ลบ odservice)
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

# กรอก connection (อย่า commit ค่าจริง):
ODS_URL="${ODS_URL:?ตั้ง ODS_URL= (odservice)}"     # เช่น postgres://user:pass@db.odienmall.com:5432/odservice
ODG_URL="${ODG_URL:?ตั้ง ODG_URL= (odg)}"           # เช่น postgres://user:pass@db.odienmall.com:5432/odg
ADMIN_URL="${ADMIN_URL:?ตั้ง ADMIN_URL= (ต่อ db 'postgres' เพื่อ createdb/dropdb)}"
TMPDB="ods_migrate_tmp"
STAMP="$(date +%F_%H%M)"

echo "▶ 1/6  Backup odservice → odservice_${STAMP}.dump"
pg_dump -Fc "$ODS_URL" -f "odservice_${STAMP}.dump"

echo "▶ 2/6  สร้าง temp db แล้ว restore odservice เข้าไป"
psql "$ADMIN_URL" -v ON_ERROR_STOP=1 -c "drop database if exists ${TMPDB};"
psql "$ADMIN_URL" -v ON_ERROR_STOP=1 -c "create database ${TMPDB};"
TMP_URL="$(echo "$ADMIN_URL" | sed -E "s#/[^/]+$#/${TMPDB}#")"
pg_restore --no-owner --no-privileges -d "$TMP_URL" "odservice_${STAMP}.dump"

echo "▶ 3/6  เปลี่ยนชื่อ schema public → ods (ใน temp db)"
psql "$TMP_URL" -v ON_ERROR_STOP=1 -c "alter schema public rename to ods;"

echo "▶ 4/6  ตรวจว่า odg ยังไม่มี schema ods (กันทับ) แล้วสร้าง"
psql "$ODG_URL" -v ON_ERROR_STOP=1 -c \
  "do \$\$ begin if exists(select 1 from information_schema.schemata where schema_name='ods') then raise exception 'odg มี schema ods อยู่แล้ว — หยุด'; end if; end \$\$;"

echo "▶ 5/6  Dump schema ods จาก temp → restore เข้า odg"
pg_dump -Fc -n ods --no-owner --no-privileges "$TMP_URL" -f "ods_schema_${STAMP}.dump"
pg_restore --no-owner --no-privileges -d "$ODG_URL" "ods_schema_${STAMP}.dump"

echo "▶ 6/6  ลบ temp db"
psql "$ADMIN_URL" -v ON_ERROR_STOP=1 -c "drop database ${TMPDB};"

echo "✅ เสร็จ. ตรวจ:"
echo "   psql \"\$ODG_URL\" -c 'select count(*) from ods.tb_product;'  # ควรเท่า odservice.public.tb_product"
echo
echo "จากนั้นตั้ง env (แล้ว restart app):"
echo "   DATABASE_URL=<odg>      ODG_DATABASE_URL=<odg>"
echo "   ODS_SCHEMA=ods          ODG_SCHEMA=public"
echo
echo "rollback: ไม่ตั้ง ODS_SCHEMA + ชี้ DATABASE_URL กลับ odservice = เหมือนเดิม (odservice ไม่ถูกแตะ)"
