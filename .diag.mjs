import pg from "pg";
import { readFileSync } from "fs";
const env = Object.fromEntries(readFileSync(".env.local","utf8").split("\n").filter(l=>l.includes("=")).map(l=>{const i=l.indexOf("=");return [l.slice(0,i),l.slice(i+1)]}));
const pool = new pg.Pool({ connectionString: env.DATABASE_URL, options: "-c search_path=ods,public" });
// ① std price ຂອງ 0013 ມີບໍ?
console.log("ic_inventory_price 0013:", (await pool.query(
  `select * from public.ic_inventory_price where ic_code = '970101-0013'`)).rows);
// ② std CTE ຄືນຄ່າຫຍັງໃຫ້ 0013
const std = await pool.query(`select distinct on (d.item_code) d.item_code, pr.sale_price1
    from public.ic_trans_detail d
    left join public.ic_inventory_price pr on pr.ic_code = d.item_code and pr.currency_code = '01' and coalesce(pr.sale_price1,0) > 0
   where d.item_code = '970101-0013' and d.doc_date >= '2025-01-01' and d.doc_date < '2027-01-01'
   order by d.item_code, pr.from_date desc nulls last, pr.roworder desc`);
console.log("std CTE ສຳລັບ 0013:", std.rows);
// ③ ແຖວ 0013 ໃນບິນ linked ເດືອນ ກລ 2026 — ວັດແບບ production vs std
const rows = await pool.query(`
  with jobs as (select trim(a.doc_ref_1) bill, a.job_finish from ods.ods_tb_install a
     where a.cancel_date is null and nullif(trim(coalesce(a.doc_ref_1,'')),'') is not null
       and a.job_finish::date between '2026-07-01' and '2026-07-31'),
    anchor as (select j.bill, max(j.job_finish) finished from jobs j group by j.bill)
  select d.doc_no, d.qty::float8 qty, d.sum_amount::float8 sum_amount, anc.finished
    from public.ic_trans_detail d join anchor anc on anc.bill = d.doc_no
   where d.item_code = '970101-0013'`);
console.log("ແຖວ 0013 ໃນບິນ linked ກລ 2026:", rows.rows.length);
for (const r of rows.rows) console.log(" ", r.doc_no, "qty:", r.qty, "sum:", r.sum_amount, "finish:", r.finished?.toISOString().slice(0,10));
// ④ hist price ຂອງ 0013
console.log("hist 0013:", (await pool.query(
  `select t2.doc_date::date dt, max(p2.price)::float8 price from public.ic_trans_detail p2 join public.ic_trans t2 on t2.doc_no=p2.doc_no where p2.item_code='970101-0013' and coalesce(p2.price,0)>0 group by 1 order by 1`)).rows);
await pool.end();
