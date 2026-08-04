import pg from "pg";
import { readFileSync } from "fs";
const env = Object.fromEntries(readFileSync(".env.local","utf8").split("\n").filter(l=>l.includes("=")).map(l=>{const i=l.indexOf("=");return [l.slice(0,i),l.slice(i+1)]}));
const pool = new pg.Pool({ connectionString: env.DATABASE_URL });
const t = async (label, sql, params=[]) => {
  const s = Date.now(); const r = await pool.query(sql, params);
  console.log(`${label}: ${Date.now()-s} ms (${r.rows.length} rows)`);
  return r;
};
const from = "2025-01-01", to = "2027-01-01";
// ວັດ raw scan ບໍ່ມີ fallback subquery
await t("scan plain sum(sum_amount)",
  `select count(*), sum(d.sum_amount)::float8
     from ic_trans_detail d join ic_trans t on t.doc_no = d.doc_no and t.trans_flag = 44
    where d.item_code like '9701%' and d.doc_date >= $1 and d.doc_date < $2`, [from, to]);
// ມີແຕ່ fallback ① (ic_inventory_price — ຕາຕະລາງນ້ອຍ)
await t("scan + fallback1 only",
  `select sum(coalesce(nullif(d.sum_amount,0), d.qty * coalesce(
     (select pr.sale_price1 from ic_inventory_price pr where pr.ic_code = d.item_code and pr.currency_code = '01' and coalesce(pr.sale_price1,0) > 0 order by pr.from_date desc nulls last, pr.roworder desc limit 1), 0)))::float8
     from ic_trans_detail d join ic_trans t on t.doc_no = d.doc_no and t.trans_flag = 44
    where d.item_code like '9701%' and d.doc_date >= $1 and d.doc_date < $2`, [from, to]);
// ຈຳນວນແຖວ sum_amount=0 ທີ່ຕ້ອງ fallback ②
const z = await t("zero-sum rows",
  `select count(*)::int n, string_agg(distinct d.item_code, ', ') codes
     from ic_trans_detail d join ic_trans t on t.doc_no = d.doc_no and t.trans_flag = 44
    where d.item_code like '9701%' and d.doc_date >= $1 and d.doc_date < $2 and coalesce(d.sum_amount,0) = 0`, [from, to]);
console.log("  →", z.rows[0]);
// index ທີ່ມີ
await t("indexes ic_trans_detail", `select indexname, indexdef from pg_indexes where tablename='ic_trans_detail'`);
await t("indexes ic_trans", `select indexname, indexdef from pg_indexes where tablename='ic_trans'`);
console.log("rows ic_trans_detail:", (await pool.query(`select count(*) from ic_trans_detail`)).rows[0]);
console.log("rows ic_trans:", (await pool.query(`select count(*) from ic_trans`)).rows[0]);
await pool.end();
