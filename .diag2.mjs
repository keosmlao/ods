import pg from "pg";
import { readFileSync } from "fs";
const env = Object.fromEntries(readFileSync(".env.local","utf8").split("\n").filter(l=>l.includes("=")).map(l=>{const i=l.indexOf("=");return [l.slice(0,i),l.slice(i+1)]}));
const pool = new pg.Pool({ connectionString: env.DATABASE_URL, options: "-c search_path=ods,public" });
// ບິນທີ່ມີໃບງານປິດຫຼາຍເດືອນ (straddle) ໃນຊ່ວງ 2 ປີ
const r = await pool.query(`
  with jobs as (select trim(a.doc_ref_1) bill, a.job_finish::date finish
    from ods.ods_tb_install a
   where a.cancel_date is null and nullif(trim(coalesce(a.doc_ref_1,'')),'') is not null
     and a.job_finish::date between '2025-01-01' and '2026-12-31')
  select bill, count(*)::int jobs, count(distinct to_char(finish,'YYYY-MM'))::int months,
      min(finish) mn, max(finish) mx
    from jobs group by bill having count(distinct to_char(finish,'YYYY-MM')) > 1
    order by months desc, bill`);
console.log("ບິນຄອບຫຼາຍເດືອນ:", r.rows.length, "ໃບ (ຈາກ 2 ປີ)");
for (const row of r.rows.slice(0, 12)) console.log(" ", row.bill, row.jobs, "ວຽກ", row.months, "ເດືອນ", row.mn?.toISOString().slice(0,10), "→", row.mx?.toISOString().slice(0,10));
// ຍອດບາດຂອງບິນ straddle ເຫຼົ່ານີ້
if (r.rows.length) {
  const bills = r.rows.map(x=>x.bill);
  const s = await pool.query(`select count(*), sum(x)::float8 from (
    select sum(coalesce(nullif(d.sum_amount,0),0)) x from public.ic_trans_detail d where d.doc_no = any($1::varchar[]) and d.item_code like '9701%' group by d.doc_no) z`, [bills]);
  console.log("ຍອດ 9701xx ຂອງບິນ straddle (sum_amount ດິບ):", s.rows[0]);
}
await pool.end();
