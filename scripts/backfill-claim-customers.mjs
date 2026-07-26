#!/usr/bin/env node
/**
 * Backfill ຮ້ານ/ລູກຄ້າ ໃສ່ໃບເຄມເກົ່າ.
 *
 * ບັນຫາ: ໃບເຄມ CLM-B ທີ່ເປີດຈາກ "ບິນ ERP" ເກັບ customer_code = ລະຫັດ ERP,
 * ແຕ່ລູກຄ້ານັ້ນອາດຍັງບໍ່ມີໃນ ODS ar_customer ⇒ join ຊື່ບໍ່ໄດ້ ⇒ ລາຍການຂຶ້ນ "-".
 * (ໃບໃໝ່ຖືກ copy ໃຫ້ອັດຕະໂນມັດແລ້ວຜ່ານ ensureOdsCustomer — script ນີ້ແກ້ໃບເກົ່າ.)
 *
 * ໃຊ້: DATABASE_URL + ODG_DATABASE_URL ຈາກ env (ຫຼື .env.local ຖ້າມີ).
 *   node scripts/backfill-claim-customers.mjs          # copy ຈິງ
 *   node scripts/backfill-claim-customers.mjs --dry     # ເບິ່ງກ່ອນ ບໍ່ຂຽນ
 *
 * ⚠️ ERP ar_customer ໃຊ້ຖັນ `telephone` (ບໍ່ມີ `tel` ຄື ODS).
 * idempotent: on conflict do nothing — run ຊ້ຳໄດ້.
 */
import { readFileSync } from "node:fs";
import pg from "pg";

// ໂຫຼດ .env.local ຖ້າມີ (dev) — prod ໃຊ້ env ໂດຍກົງ
try {
  for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
} catch {
  /* ບໍ່ມີ .env.local — ໃຊ້ env ໂດຍກົງ (prod) */
}

const DRY = process.argv.includes("--dry");
const { DATABASE_URL, ODG_DATABASE_URL } = process.env;
if (!DATABASE_URL || !ODG_DATABASE_URL) {
  console.error("✗ ຕ້ອງມີ DATABASE_URL ແລະ ODG_DATABASE_URL");
  process.exit(1);
}

const ods = new pg.Pool({ connectionString: DATABASE_URL });
const erp = new pg.Pool({ connectionString: ODG_DATABASE_URL });

try {
  await ods.query("set search_path to ods,public");
  const missing = (
    await ods.query(
      `select distinct customer_code from ods_claim cl
        where customer_code is not null
          and not exists (select 1 from ar_customer c where c.code = cl.customer_code)`,
    )
  ).rows.map((r) => r.customer_code);

  if (!missing.length) {
    console.log("✓ ບໍ່ມີໃບເຄມທີ່ຂາດຮ້ານ — ບໍ່ຕ້ອງ backfill");
    process.exit(0);
  }
  console.log(`ພົບ ${missing.length} ລູກຄ້າ ທີ່ຂາດໃນ ODS${DRY ? " (dry-run)" : ""}:`);

  let copied = 0;
  let notFound = 0;
  for (const code of missing) {
    const e = (
      await erp.query(
        `select name_1, coalesce(telephone,'') tel, coalesce(address,'') address
           from ar_customer where code = $1 limit 1`,
        [code],
      )
    ).rows[0];
    if (!e) {
      console.log(`  - ${code}  (ບໍ່ພົບໃນ ERP — ຂ້າມ)`);
      notFound++;
      continue;
    }
    const name = (e.name_1 ?? "").trim();
    if (DRY) {
      console.log(`  ~ ${code} → ${name}`);
    } else {
      await ods.query(
        `insert into ar_customer(code, name_1, tel, address, ref_code, ar_type)
         values ($1, $2, $3, $4, $1, 'erp') on conflict (code) do nothing`,
        [code, e.name_1 ?? "", e.tel ?? "", e.address ?? ""],
      );
      console.log(`  ✓ ${code} → ${name}`);
    }
    copied++;
  }
  console.log(DRY ? `\ndry-run: ຈະ copy ${copied} · ບໍ່ພົບ ERP ${notFound}` : `\nສຳເລັດ: copy ${copied} · ບໍ່ພົບ ERP ${notFound}`);
} catch (err) {
  console.error("✗ ລົ້ມເຫລວ:", err.message);
  process.exit(1);
} finally {
  await ods.end().catch(() => {});
  await erp.end().catch(() => {});
}
