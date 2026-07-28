#!/usr/bin/env node
/**
 * **ຫາແຖວທີ່ຍັງຄ້າງຢູ່ odservice ເກົ່າ ແຕ່ບໍ່ມີໃນ odg.ods** — ອ່ານຢ່າງດຽວ ບໍ່ຂຽນຫຍັງ.
 *
 * ── ເປັນຫຍັງມີໄຟລ໌ນີ້ ──
 * 24-07-2026 ຍ້າຍ odservice ທັງຖານ → schema `ods` ໃນ odg (docs/migrate-odservice-to-ods-schema.sh)
 * ການຍ້າຍນັ້ນເປັນ "ກ໋ອບປີ້ ณ ຈຸດເວລານຶ່ງ" ⇒ ເອກະສານທີ່ຖືກສ້າງຢູ່ຖານເກົ່າ**ຫຼັງຈາກນັ້ນ**
 * (ເຄື່ອງທີ່ຍັງຊີ້ຖານເກົ່າ) ຈະຄ້າງຢູ່ພຸ້ນ ບໍ່ມີໃຜເຫັນໃນລະບົບປັດຈຸບັນ.
 *
 * ── ໃຊ້ແນວໃດ ──
 *   OLD_URL='postgresql://user:pass@host:5432/odservice' \
 *   NEW_URL='postgresql://user:pass@host:5432/odg' \
 *   node scripts/odservice-diff.mjs                 # ສະຫຼຸບທຸກຕາຕະລາງ
 *   node scripts/odservice-diff.mjs tb_product      # ເບິ່ງລາຍລະອຽດຂອງຕາຕະລາງດຽວ (20 ແຖວທຳອິດ)
 *
 * ⚠️ ລະຫັດຜ່ານທີ່ມີ `%` ຫຼື `@` — ຢ່າ encode, ໃສ່ດິບໆໃນ URL ໄດ້ເລີຍ (parse ເອງຢູ່ລຸ່ມ
 * ບໍ່ໄດ້ໃຊ້ new URL() ເພາະມັນຈະ decode `%40` ເປັນ `@` ແລ້ວ auth ບໍ່ຜ່ານ).
 */
import pg from "pg";

const parse = (url, name) => {
  const m = /^postgres(?:ql)?:\/\/([^:]+):(.*)@([^:/]+):(\d+)\/(.+)$/.exec(url ?? "");
  if (!m) throw new Error(`${name} ບໍ່ຖືກຮູບແບບ: postgresql://user:pass@host:port/db`);
  return { user: m[1], password: m[2], host: m[3], port: +m[4], database: m[5] };
};

const OLD = parse(process.env.OLD_URL, "OLD_URL");
const NEW = parse(process.env.NEW_URL, "NEW_URL");
const only = process.argv[2] ?? null;

/**
 * ກະແຈທຸລະກິດຂອງແຕ່ລະຕາຕະລາງ — ຮຽງຕາມລຳດັບຄວາມໜ້າເຊື່ອຖື.
 * `roworder` ເປັນທາງເລືອກສຸດທ້າຍເທົ່ານັ້ນ: ມັນເປັນ serial ⇒ ສອງຖານແລ່ນຄົນລະຊຸດເລກ
 * ⇒ ຖ້າໃຊ້ມັນເປັນກະແຈ ຈະນັບຜິດ (ເລກຊ້ຳກັນແຕ່ຄົນລະໃບ). ບອກໄວ້ໃນຜົນລັບວ່າ "ບໍ່ໜ້າເຊື່ອ".
 */
const KEY_ORDER = ["doc_no", "code", "roworder"];

const client = async (cfg) => {
  const c = new pg.Client(cfg);
  await c.connect();
  return c;
};

const tablesOf = async (c, schema) =>
  (
    await c.query(
      `select table_name from information_schema.tables
        where table_schema = $1 and table_type = 'BASE TABLE' order by table_name`,
      [schema],
    )
  ).rows.map((r) => r.table_name);

const columnsOf = async (c, schema, table) =>
  (
    await c.query(
      `select column_name from information_schema.columns where table_schema=$1 and table_name=$2`,
      [schema, table],
    )
  ).rows.map((r) => r.column_name);

const old = await client(OLD);
const next = await client(NEW);

const [oldTables, newTables] = await Promise.all([tablesOf(old, "public"), tablesOf(next, "ods")]);
const shared = oldTables.filter((t) => newTables.includes(t) && (!only || t === only));
if (only && shared.length === 0) {
  console.error(`ບໍ່ພົບຕາຕະລາງ ${only} ຢູ່ທັງສອງຖານ`);
  process.exit(1);
}

const report = [];
for (const table of shared) {
  const cols = await columnsOf(old, "public", table);
  const key = KEY_ORDER.find((k) => cols.includes(k));
  if (!key) continue; // ບໍ່ມີກະແຈທຽບໄດ້ (ຕາຕະລາງ lookup/ຕັ້ງຄ່າ) — ຂ້າມ
  const [oldRows, newRows] = await Promise.all([
    old.query(`select ${key}::text k from public.${table} where ${key} is not null`),
    next.query(`select ${key}::text k from ods.${table} where ${key} is not null`),
  ]);
  const have = new Set(newRows.rows.map((r) => r.k));
  const missing = [...new Set(oldRows.rows.map((r) => r.k))].filter((k) => !have.has(k));
  if (missing.length === 0) continue;
  report.push({ table, key, old: oldRows.rowCount, new: newRows.rowCount, missing });
}

report.sort((a, b) => b.missing.length - a.missing.length);

if (only) {
  const row = report[0];
  if (!row) {
    console.log(`✅ ${only}: ບໍ່ມີແຖວຄ້າງ`);
  } else {
    console.log(`${only} — ຄ້າງ ${row.missing.length} (ກະແຈ ${row.key})`);
    const sample = row.missing.slice(0, 20);
    const detail = await old.query(
      `select * from public.${only} where ${row.key}::text = any($1::text[]) limit 20`,
      [sample],
    );
    console.log(JSON.stringify(detail.rows, null, 1));
    if (row.missing.length > 20) console.log(`… ແລະ ອີກ ${row.missing.length - 20}`);
  }
} else {
  console.log("ຕາຕະລາງ".padEnd(34), "ກະແຈ".padEnd(10), "ເກົ່າ".padStart(8), "ໃໝ່".padStart(8), "ຄ້າງ".padStart(8));
  for (const r of report) {
    const warn = r.key === "roworder" ? " ⚠️ກະແຈບໍ່ໜ້າເຊື່ອ" : "";
    console.log(
      r.table.padEnd(34),
      r.key.padEnd(10),
      String(r.old).padStart(8),
      String(r.new).padStart(8),
      String(r.missing.length).padStart(8),
      warn,
    );
  }
  if (report.length === 0) console.log("✅ ບໍ່ມີແຖວຄ້າງ — ສອງຖານກົງກັນ");
  console.log("\nເບິ່ງລາຍລະອຽດ: node scripts/odservice-diff.mjs <ຊື່ຕາຕະລາງ>");
}

await Promise.all([old.end(), next.end()]);
