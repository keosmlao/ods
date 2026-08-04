import pg from "pg";
import { readFileSync } from "fs";
const env = Object.fromEntries(readFileSync(".env.local","utf8").split("\n").filter(l=>l.includes("=")).map(l=>{const i=l.indexOf("=");return [l.slice(0,i),l.slice(i+1)]}));
const pool = new pg.Pool({ connectionString: env.DATABASE_URL });
const t = async (label, sql, params) => {
  const s = Date.now(); const r = await pool.query(sql, params);
  console.log(`${label}: ${Date.now()-s} ms (${r.rows.length} rows)`);
  return r;
};
const from = "2025-01-01", to = "2027-01-01";
// ① ເກົ່າ: install scan ic_trans_detail ທຸກແຖວ 2 ປີ + fallback subquery
await t("OLD install (2y scan)",
  `select to_char(d.doc_date,'YYYY-MM') as month, d.item_code, t.doc_format_code fmt,
          sum(coalesce(nullif(d.sum_amount, 0), d.qty * coalesce(
            (select pr.sale_price1 from ic_inventory_price pr where pr.ic_code = d.item_code and pr.currency_code = '01' and coalesce(pr.sale_price1,0) > 0 order by pr.from_date desc nulls last, pr.roworder desc limit 1),
            (select p2.price from ic_trans_detail p2 join ic_trans t2 on t2.doc_no = p2.doc_no where p2.item_code = d.item_code and coalesce(p2.price,0) > 0 and t2.doc_date <= d.doc_date order by t2.doc_date desc limit 1), 0)))::float8 amount
     from ic_trans_detail d
     join ic_trans t on t.doc_no = d.doc_no and t.trans_flag = 44
    where d.trans_flag = 44 and d.item_code like '9701%' and d.doc_date >= $1 and d.doc_date < $2
    group by 1, 2, 3`, [from, to]);
// ② ໃໝ່: job-anchored ຈາກ in (ນ້ອຍ) + ລວມບິນທຸກໃບຕາມເດືອນ
await t("NEW jobs anchor (2y)",
  `with jobs as (select a.code, trim(a.doc_ref_1) bill, a.job_finish
     from ods.ods_tb_install a
    where a.cancel_date is null and a.job_finish::date between $1 and $2
      and nullif(trim(coalesce(a.doc_ref_1,'')),'') is not null)
   select to_char(anc.finished,'YYYY-MM') m, count(*) n
     from (select j.bill, max(j.job_finish) finished from jobs j group by j.bill) anc group by 1 order by 1`, [from, to]);
await t("NEW all-bills/month (2y)",
  `select to_char(d.doc_date,'YYYY-MM') as month, d.item_code,
          sum(coalesce(nullif(d.sum_amount, 0), d.qty * coalesce(
            (select pr.sale_price1 from ic_inventory_price pr where pr.ic_code = d.item_code and pr.currency_code = '01' and coalesce(pr.sale_price1,0) > 0 order by pr.from_date desc nulls last, pr.roworder desc limit 1),
            (select p2.price from ic_trans_detail p2 join ic_trans t2 on t2.doc_no = p2.doc_no where p2.item_code = d.item_code and coalesce(p2.price,0) > 0 and t2.doc_date <= d.doc_date order by t2.doc_date desc limit 1), 0)))::float8 amount
     from ic_trans_detail d
     join ic_trans t on t.doc_no = d.doc_no and t.trans_flag = 44
    where d.item_code like '9701%' and d.doc_date >= $1 and d.doc_date < $2
    group by 1, 2`, [from, to]);
// ③ repair (accepted quotes 2y)
await t("OLD repair (2y)",
  `select to_char(x.d,'YYYY-MM') as month, sum(x.quoted)::float8 amount
     from (select max(q.doc_date) d, sum(q.total_amount) quoted
             from ic_trans q join tb_product a on a.code = q.product_code
            where q.trans_flag = 17 and coalesce(q.aprove_status,0) = 1 and coalesce(q.aprove_status_2,0) = 1
              and q.doc_date >= $1 and q.doc_date < $2 group by a.code) x
    group by 1`, [from, to]);
await pool.end();
