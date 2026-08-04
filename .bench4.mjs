import pg from "pg";
import { readFileSync } from "fs";
const env = Object.fromEntries(readFileSync(".env.local","utf8").split("\n").filter(l=>l.includes("=")).map(l=>{const i=l.indexOf("=");return [l.slice(0,i),l.slice(i+1)]}));
const pool = new pg.Pool({ connectionString: env.DATABASE_URL, options: "-c search_path=ods,public" });
const from = "2025-01-01", to = "2027-01-01";
const AC = "'970101-0001','970101-0015','970101-0016','970101-0017','970101-0018','970101-0019','970102-0012','970102-0013'";
const OTH = "'970101-0004','970101-0020'";
const ANCHOR = `with jobs as (
    select trim(a.doc_ref_1) bill, a.job_finish from ods.ods_tb_install a
     where a.cancel_date is null and nullif(trim(coalesce(a.doc_ref_1,'')),'') is not null
       and a.job_finish::date between $1 and $2
  ), anchor as (
    select j.bill, max(j.job_finish) finished from jobs j group by j.bill
  )`;
const s0 = Date.now();
const [matrix, pending, unlinked] = await Promise.all([
  // ① matrix — fallback ຂັ້ນດຽວ (std price CTE) ບໍ່ມີ scan ຊ້າ
  pool.query(`${ANCHOR}, std as (
      select distinct on (d.item_code) d.item_code, pr.sale_price1
        from public.ic_trans_detail d
        left join public.ic_inventory_price pr on pr.ic_code = d.item_code and pr.currency_code = '01' and coalesce(pr.sale_price1,0) > 0
       where d.item_code like '9701%' and d.doc_date >= $1 and d.doc_date < $2
       order by d.item_code, pr.from_date desc nulls last, pr.roworder desc
    ), bills as (
      select anc.finished, bool_or(d.item_code = '970101-0004') kip,
          sum(coalesce(nullif(d.sum_amount,0), d.qty * coalesce(std.sale_price1, 0)))::float8 baht,
          sum(case when d.item_code in (${AC}) then coalesce(nullif(d.sum_amount,0), d.qty*coalesce(std.sale_price1,0)) else 0 end)::float8 ac,
          sum(case when d.item_code like '9701%' and d.item_code not in (${AC}) and d.item_code not in (${OTH}) then coalesce(nullif(d.sum_amount,0), d.qty*coalesce(std.sale_price1,0)) else 0 end)::float8 app,
          sum(case when d.item_code in (${OTH}) then coalesce(nullif(d.sum_amount,0), d.qty*coalesce(std.sale_price1,0)) else 0 end)::float8 oth
        from public.ic_trans_detail d
        join anchor anc on anc.bill = d.doc_no
        left join std on std.item_code = d.item_code
       where d.item_code like '9701%'
       group by d.doc_no, anc.finished
    )
    select to_char(finished,'YYYY-MM') as month, sum(baht)::float8 baht, sum(ac)::float8 ac,
        sum(app)::float8 app, sum(oth)::float8 oth, sum(case when kip then baht else 0 end)::float8 kip_raw
      from bills group by 1 order by 1`, [from, to]),
  // ② pending — ແຖວ sum=0 ທີ່ບໍ່ມີ std price ຕ້ອງ fallback ②
  pool.query(`${ANCHOR}
    select d.item_code, d.qty::float8 qty, anc.finished::date anchor_date
      from public.ic_trans_detail d join anchor anc on anc.bill = d.doc_no
     where d.item_code like '9701%' and coalesce(d.sum_amount,0) = 0
       and not exists (select 1 from public.ic_inventory_price pr where pr.ic_code = d.item_code and pr.currency_code='01' and coalesce(pr.sale_price1,0)>0)`, [from, to]),
  // ③ unlinked matrix
  pool.query(`select to_char(t.doc_date,'YYYY-MM') as month, t.doc_no, bool_or(d.item_code='970101-0004') kip,
      sum(coalesce(nullif(d.sum_amount,0), d.qty*coalesce(
        (select pr.sale_price1 from public.ic_inventory_price pr where pr.ic_code=d.item_code and pr.currency_code='01' and coalesce(pr.sale_price1,0)>0 order by pr.from_date desc nulls last, pr.roworder desc limit 1),
        (select p2.price from public.ic_trans_detail p2 join public.ic_trans t2 on t2.doc_no=p2.doc_no where p2.item_code=d.item_code and coalesce(p2.price,0)>0 and t2.doc_date <= t.doc_date order by t2.doc_date desc limit 1),0)))::float8 baht
    from public.ic_trans t join public.ic_trans_detail d on d.doc_no=t.doc_no and d.item_code like '9701%'
   where t.trans_flag=44 and t.side_code='400' and t.doc_date::date between $1 and $2
     and not exists (select 1 from ods.ods_tb_install a where trim(a.doc_ref_1)=t.doc_no and a.cancel_date is null)
   group by 1,2 order by 1`, [from, to]),
]);
console.log(`wave1 parallel: ${Date.now()-s0} ms — matrix ${matrix.rows.length}m, pending ${pending.rows.length} rows, unlinked ${unlinked.rows.length} docs`);
const codes = [...new Set(pending.rows.map(r=>r.item_code))];
console.log("codes ຕ້ອງ fallback②:", codes);
const s1 = Date.now();
const hist = await pool.query(
  `select p2.item_code, t2.doc_date::date dt, max(p2.price)::float8 price
     from public.ic_trans_detail p2 join public.ic_trans t2 on t2.doc_no = p2.doc_no
    where p2.item_code = any($1::varchar[]) and coalesce(p2.price,0) > 0 and t2.doc_date <= $2
    group by 1, 2`, [codes, to]);
console.log(`hist: ${Date.now()-s1} ms (${hist.rows.length} rows)`);
// ປະກອບ JS: patch pending ເຂົ້າ matrix
const series = new Map();
for (const r of hist.rows) { if (!series.has(r.item_code)) series.set(r.item_code, []); series.get(r.item_code).push({ dt: r.dt, price: r.price }); }
for (const arr of series.values()) arr.sort((a,b)=>a.dt-b.dt);
const priceAsOf = (code, dt) => {
  const arr = series.get(code); if (!arr) return 0;
  for (let i = arr.length - 1; i >= 0; i--) if (arr[i].dt <= dt) return arr[i].price;
  return 0;
};
const byMonth = new Map(matrix.rows.map(r=>[r.month, {...r}]));
for (const p of pending.rows) {
  const m = p.anchor_date.toISOString().slice(0,7);
  const val = p.qty * priceAsOf(p.item_code, p.anchor_date);
  const cell = byMonth.get(m); if (!cell) continue;
  cell.baht += val;
  if (AC.includes(`'${p.item_code}'`)) cell.ac += val;
  else if (!OTH.includes(`'${p.item_code}'`)) cell.app += val;
  else cell.oth += val;
}
console.log("ກໍລະກົດ 2026 ສຸດທ້າຍ:", byMonth.get("2026-07"));
console.log("ລວມທັງໝົດ pipeline:", Date.now()-s0, "ms");
await pool.end();
