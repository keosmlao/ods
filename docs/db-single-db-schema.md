# รวม DB: odg เดียว + แยก schema (`ods` / `public`)

เป้าหมาย: **ไม่แยก database odservice** อีก — ใช้ **odg database เดียว** แต่แยก ODS ไว้ใน **schema `ods`**, ERP อยู่ `public`.
ได้ประโยชน์: join ข้ามระบบใน query เดียว, backup ที่เดียว, ไม่มีปัญหา "stock เงา" 3 จุดวัดไม่ตรง.

---

## ฝั่ง code — ✅ พร้อมแล้ว (`src/lib/db.ts`)

`query()` และ `queryOdg()` ยังเหมือนเดิม แต่ pool อ่าน `search_path` จาก env:

| env | ค่า (โหมด single-db) | ผล |
|-----|----------------------|-----|
| `DATABASE_URL` | connection ของ **odg** | `query()` → odg |
| `ODG_DATABASE_URL` | connection ของ **odg** (อันเดียวกัน) | `queryOdg()` → odg |
| `ODS_SCHEMA` | `ods` | `query()` มองหา table ใน schema `ods` ก่อน |
| `ODG_SCHEMA` | `public` | `queryOdg()` มองหา table ใน `public` |

> ไม่ตั้ง `ODS_SCHEMA`/`ODG_SCHEMA` = พฤติกรรมเดิม (2 database) ไม่เปลี่ยนเลย → ปลอดภัย, roll back ได้ทันที.
> SQL เดิม **ไม่ต้องแก้** (ชื่อ table resolve ตาม search_path). ถ้าต้อง join ข้าม schema ในอนาคต ค่อยใส่ชื่อ qualify เช่น `public.ic_inventory`.

---

## ฝั่ง ops/DBA — ต้องทำเอง (มี DB access)

### 1. เลือก strategy กับ "table เงา"
ODS มี table เงาของ ERP (เช่น `ic_inventory`) ที่ซ้ำกับของจริงใน odg. ตอนย้ายต้องเลือก:
- **(ก) เก็บเงาไว้ใน `ods`** — `search_path=ods,public` แล้ว query ODS จะเจอเงาก่อน (พฤติกรรมเดิม)
- **(ข) ทิ้งเงา ใช้ของจริง** — ไม่ย้าย `ic_inventory` เงา, ให้ query ODS อ่าน `public.ic_inventory` ตรงๆ (แนะนำระยะยาว — หมดปัญหา sync)

### 2. หา list ของ table ที่ ODS เป็นเจ้าของ (รันบน odservice db)
```sql
select table_name from information_schema.tables
where table_schema = 'public' order by table_name;
```
คัดเอาเฉพาะ table ที่ ODS เป็นเจ้าของ (`ods_*`, `ic_trans_detail_draft`, `users`,
`ods_user_menu_permission`, `ods_employee_role` ฯลฯ). ตัด table เงาของ ERP ออกตามข้อ 1.

### 3. ย้ายเข้า schema `ods` ใน odg
```bash
# บน odg: สร้าง schema
psql "$ODG_URL" -c 'create schema if not exists ods;'

# dump เฉพาะ table ที่เลือกจาก odservice → restore เข้า odg schema ods
pg_dump "$ODS_URL" --schema=public --table='ods_*' --table='ic_trans_detail_draft' ... \
  | sed 's/public\./ods./g' \        # เปลี่ยน schema เป้าหมาย (ตรวจให้ดีก่อนรัน)
  | psql "$ODG_URL"
```
> ⚠️ ทดสอบบน **staging/สำเนา** ก่อนเสมอ. sed แบบ global อันตราย — แนะนำใช้
> `pg_dump --schema=public ...` แล้ว `ALTER ... SET SCHEMA ods` ต่อ table แทน หรือ dump→restore ใน schema แยก.

### 4. ตั้ง env (production)
```
DATABASE_URL=<odg connection>
ODG_DATABASE_URL=<odg connection>   # อันเดียวกัน
ODS_SCHEMA=ods                       # หรือ "ods,public" ถ้าเลือกข้อ 1(ข)
ODG_SCHEMA=public
```

### 5. verify
- `search_path` ต่อ connection: `psql "$ODG_URL" -c 'show search_path;'`
- ทดสอบหน้า /service, /returns, QC, เบิกอาไหล่ — ต้องเห็นข้อมูลเหมือนเดิม.
- ถ้าพัง → ลบ `ODS_SCHEMA`/`ODG_SCHEMA` + ชี้ `DATABASE_URL` กลับ odservice เดิม = กลับสภาพเดิมทันที.

---

## หมายเหตุ
- Transaction (`db.connect()`) ก็ได้ `search_path` เดียวกัน (ตั้งที่ระดับ pool).
- ถ้าชื่อ table ซ้ำใน 2 schema ให้ระวัง — คนละ pool คนละ `search_path` จึงแยกกันอยู่แล้ว
  แต่ query ที่ join ข้าม schema ต้อง qualify ชื่อให้ชัด.
