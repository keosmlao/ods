import pg from "pg";
import { readFileSync } from "fs";
const env = Object.fromEntries(readFileSync(".env.local","utf8").split("\n").filter(l=>l.includes("=")).map(l=>{const i=l.indexOf("=");return [l.slice(0,i),l.slice(i+1)]}));
const pool = new pg.Pool({ connectionString: env.DATABASE_URL, options: "-c search_path=ods,public" });
const t = async (label, sql, params=[]) => {
  const s = Date.now(); const r = await pool.query(sql, params);
  console.log(`${label}: ${Date.now()-s} ms (${r.rows.length} rows)`);
  return r;
};
const from = "2025-01-01", to = "2027-01-01";
const AC = "'970101-0001','970101-0015','970101-0016','970101-0017','970101-0018','970101-0019','970102-0012','970102-0013'";
const OTH = "'970101-0004','970101-0020'";
const line = `coalesce(nullif(d.sum_amount, 0),
      d.qty * coalesce(
        (select pr.sale_price1 from public.ic_inventory_price pr where pr.ic_code = d.item_code and pr.currency_code = '01' and coalesce(pr.sale_price1,0) > 0 order by pr.from_date desc nulls last, pr.roworder desc limit 1),
        (select p2.price from public.ic_trans_detail p2 join public.ic_trans t2 on t2.doc_no = p2.doc_no where p2.item_code = d.item_code and coalesce(p2.price,0) > 0 and t2.doc_date <= anc.price_date order by t2.doc_date desc limit 1),
        0))`;
const s = Date.now();
const r = await pool.query(
  `with jobs as (
      select trim(a.doc_ref_1) bill, a.job_finish
        from ods.ods_tb_install a
       where a.cancel_date is null and nullif(trim(coalesce(a.doc_ref_1,'')),'') is not null
         and a.job_finish::date between $1 and $2
   ), anchor as (
      select j.bill, max(j.job_finish) price_date,
             max(case when j.job_finish::date between $1 and $2 then j.job_finish end) finished
        from jobs j group by j.bill
   ), bills as (
      select d.doc_no, anc.finished,
             bool_or(d.item_code = '970101-0004') kip,
             sum(${line})::float8 baht,
             sum(case when d.item_code in (${AC}) then ${line} else 0 end)::float8 ac,
             sum(case when d.item_code like '9701%' and d.item_code not in (${AC}) and d.item_code not in (${OTH}) then ${line} else 0 end)::float8 app,
             sum(case when d.item_code in (${OTH}) then ${line} else 0 end)::float8 oth
        from public.ic_trans_detail d
        join anchor anc on anc.bill = d.doc_no
       where d.item_code like '9701%'
       group by d.doc_no, anc.finished
   )
   select to_char(b.finished,'YYYY-MM') as month, count(*)::int bills,
          sum(b.baht)::float8 baht, sum(b.ac)::float8 ac, sum(b.app)::float8 app, sum(b.oth)::float8 oth,
          sum(case when b.kip then b.baht else 0 end)::float8 kip_raw
     from bills b where b.finished is not null
    group by 1 order by 1`, [from, to]);
console.log(`NEW install linked-matrix: ${Date.now()-s} ms (${r.rows.length} months)`);
const jul = r.rows.find(x=>x.month==="2026-07");
console.log("ກໍລະກົດ 2026 linked:", jul);
// unlinked matrix (1 scan)
await t("NEW unlinked matrix",
  `select to_char(t.doc_date,'YYYY-MM') as month, t.doc_no,
      bool_or(d.item_code = '970101-0004') kip,
      sum(coalesce(nullif(d.sum_amount,0), d.qty*coalesce(
        (select pr.sale_price1 from public.ic_inventory_price pr where pr.ic_code=d.item_code and pr.currency_code='01' and coalesce(pr.sale_price1,0)>0 order by pr.from_date desc nulls last, pr.roworder desc limit 1),
        (select p2.price from public.ic_trans_detail p2 join public.ic_trans t2 on t2.doc_no=p2.doc_no where p2.item_code=d.item_code and coalesce(p2.price,0)>0 and t2.doc_date <= t.doc_date order by t2.doc_date desc limit 1),0)))::float8 baht
    from public.ic_trans t
    join public.ic_trans_detail d on d.doc_no = t.doc_no and d.item_code like '9701%'
   where t.trans_flag = 44 and t.side_code = '400'
     and t.doc_date::date between $1 and $2
     and not exists (select 1 from ods.ods_tb_install a where trim(a.doc_ref_1) = t.doc_no and a.cancel_date is null)
   group by 1, 2 having sum(coalesce(nullif(d.sum_amount,0),0)) > 0 or count(*) > 0
   order by 1`, [from, to]);
// repair matrix — ໃຊ້ search_path=ods,public ຄື production query()
await t("repair matrix (2y)",
  `select to_char(x.d,'YYYY-MM') as month, sum(x.quoted)::float8 amount
     from (select max(q.doc_date) d, sum(q.total_amount) quoted
             from ic_trans q join tb_product a on a.code = q.product_code
            where q.trans_flag = 17 and coalesce(q.aprove_status,0) = 1 and coalesce(q.aprove_status_2,0) = 1
              and q.doc_date >= $1 and q.doc_date < $2 group by a.code) x
    group by 1`, [from, to]);
await pool.end();
