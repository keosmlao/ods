import pg from "pg";
const c = new pg.Client({user:"postgres",password:"odglao2026",host:"db.odienmall.com",port:5432,database:"odg"});
await c.connect();
// ໃບຂໍເບີກຕິດຕັ້ງລ່າສຸດ — ຢູ່ ODS ແລະ ERP ຫຼືບໍ່
for (const [schema, label] of [["ods","ODS"],["public","ERP"]]) {
  const h = await c.query(
    `select doc_no, trans_flag, to_char(doc_date,'YYYY-MM-DD') d, ${schema==="ods"?"product_code":"doc_ref"} job,
        ${schema==="ods"?"wh_code, shelf_code":"wh_from wh_code, location_from shelf_code"}, remark
       from ${schema}.ic_trans
      where trans_flag in (122) and doc_date >= current_date - 1
      order by doc_no desc limit 8`);
  console.log(`\n=== ${label}.ic_trans (122, 2 ມື້ຫຼ້າສຸດ) — ${h.rowCount} ໃບ`);
  console.table(h.rows);
  const d = await c.query(
    `select doc_no, item_code, item_name, qty, unit_code from ${schema}.ic_trans_detail
      where trans_flag = 122 and doc_date >= current_date - 1 order by doc_no desc, item_code limit 12`);
  console.log(`${label}.ic_trans_detail — ${d.rowCount} ແຖວ`);
  console.table(d.rows);
}
await c.end();
