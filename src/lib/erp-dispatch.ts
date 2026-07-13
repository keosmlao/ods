import { db, queryOdg } from "@/lib/db";
import { CALC_IN, CALC_OUT, LINE_STATUS, TRANS } from "@/lib/stock-constants";

/**
 * **ດຶງໃບເບີກ (56) ທີ່ສາງອອກໃນ ERP ກັບຄືນມາໃສ່ ODS** — ບ່ອນດຽວຂອງລະບົບ.
 *
 * ── ນະໂຍບາຍ (13-07-2026) ──
 * ລະບົບນີ້ **ອອກໃບເບີກເອງບໍ່ໄດ້ອີກ** — ສາງເບີກຢູ່ **ERP** (ບ່ອນທີ່ສະຕັອກຈິງຢູ່).
 * ODS ຈຶ່ງເປັນຝ່າຍ **ອ່ານ** ວ່າສາງເບີກໃຫ້ແລ້ວຫຼືຍັງ ແລ້ວເລື່ອນຂັ້ນຂອງງານໃຫ້ເອງ.
 *
 * ── ຜູກກັນແນວໃດ ──
 * ERP ຜູກໃບເບີກກັບໃບຂໍຜ່ານ **doc_ref** ຢູ່ແລ້ວ (ຂໍ້ມູນຈິງ: SWC2026070069 → SIO2026070040)
 * ⇒ ຫາໃບ 56 ໃນ ERP ທີ່ doc_ref **ຂຶ້ນຕົ້ນດ້ວຍເລກໃບຂໍຂອງເຮົາ** (ບາງໃບຕໍ່ຂໍ້ຄວາມທ້າຍເລກ).
 *
 * ⚠️ **ບໍ່ຕັດສະຕັອກ ERP** — ໃບຂອງ ERP ຕັດໄປແລ້ວຕອນສາງບັນທຶກ. ບ່ອນນີ້ພຽງແຕ່:
 *   ① ກ໋ອບຫົວ/ລາຍລະອຽດໃບເບີກລົງ ODS (ໃຫ້ໜ້າຈໍ ແລະ ບັນຊີອາໄຫຼ່ຂອງງານຄືເກົ່າ)
 *   ② ຫັກສະຕັອກ **ເງົາ** ຂອງ ODS (ic_inventory) ໃຫ້ຕົງກັບຂອງຈິງ
 *   ③ stamp reg_finish / spare_finish ⇒ ງານໄຫຼໄປຂັ້ນ "ຮັບອາໄຫຼ່" ເອງ
 *
 * idempotent: ໃບທີ່ດຶງມາແລ້ວ (doc_no ມີໃນ ODS) ຈະຖືກຂ້າມ ⇒ ເອີ້ນຊ້ຳໄດ້ທຸກເທື່ອທີ່ເປີດໜ້າ.
 */

type ErpHead = {
  doc_no: string;
  doc_date: string;
  doc_ref: string;
  remark: string | null;
  creator_code: string | null;
};

type ErpLine = {
  doc_no: string;
  item_code: string;
  item_name: string | null;
  unit_code: string | null;
  qty: string;
};

/** ໃບຂໍຂອງເຮົາ = ເລກຂຶ້ນຕົ້ນດ້ວຍ SIO (ຕິດຕັ້ງ SIO… · ສ້ອມ SION…) */
const OUR_REQUEST = "SIO";

export type SyncResult = { imported: number; jobs: string[] };

/**
 * ດຶງໃບເບີກຂອງ **ໃບຂໍທີ່ຍັງຄ້າງ** — ເອີ້ນຈາກໜ້າຄິວ (ສາງເບີກ · ຮັບອາໄຫຼ່ · ໃບຂໍເບີກ).
 * ບໍ່ໂຍນ error ອອກ: ໜ້າຈໍຕ້ອງເປີດໄດ້ ເຖິງ ERP ຈະລົ້ມ (ພຽງແຕ່ຈະບໍ່ເຫັນໃບໃໝ່ຮອບນີ້).
 */
export async function syncErpDispatch(): Promise<SyncResult> {
  const empty: SyncResult = { imported: 0, jobs: [] };
  if (!db) return empty;

  try {
    // ໃບຂໍທີ່ຍັງບໍ່ໄດ້ຮັບໃບເບີກຄົບ — ມີແຖວທີ່ status=0 (ຍັງບໍ່ຖືກເບີກ)
    const open = await db.query<{ doc_no: string }>(
      `select distinct t.doc_no
         from ic_trans t
         join ic_trans_detail d on d.doc_no = t.doc_no and d.trans_flag = t.trans_flag
        where t.trans_flag = $1 and d.status = 0
          and t.doc_no like $2 || '%'
          and t.doc_date >= current_date - 180`,
      [TRANS.REQUEST, OUR_REQUEST],
    );
    if (open.rows.length === 0) return empty;

    const requestNos = open.rows.map((row) => row.doc_no);

    // ໃບເບີກຂອງ ERP ທີ່ອ້າງອີງໃບຂໍເຫຼົ່ານີ້ (doc_ref ອາດມີຂໍ້ຄວາມຕໍ່ທ້າຍ ⇒ ທຽບຄຳທຳອິດ)
    const heads = await queryOdg<ErpHead>(
      `select doc_no, to_char(doc_date,'YYYY-MM-DD') as doc_date,
          split_part(trim(doc_ref), ' ', 1) as doc_ref, remark, creator_code
        from ic_trans
       where trans_flag = $1
         and split_part(trim(doc_ref), ' ', 1) = any($2::text[])`,
      [TRANS.DISPATCH, requestNos],
    );
    if (heads.rows.length === 0) return empty;

    // ໃບທີ່ດຶງມາແລ້ວ ⇒ ຂ້າມ (idempotent)
    const known = await db.query<{ doc_no: string }>(
      "select doc_no from ic_trans where trans_flag = $1 and doc_no = any($2::varchar[])",
      [TRANS.DISPATCH, heads.rows.map((row) => row.doc_no)],
    );
    const seen = new Set(known.rows.map((row) => row.doc_no));
    const fresh = heads.rows.filter((row) => !seen.has(row.doc_no));
    if (fresh.length === 0) return empty;

    const lines = await queryOdg<ErpLine>(
      `select doc_no, item_code, item_name, unit_code, qty::text as qty
         from ic_trans_detail
        where trans_flag = $1 and doc_no = any($2::text[])
        order by line_number`,
      [TRANS.DISPATCH, fresh.map((row) => row.doc_no)],
    );

    const jobs: string[] = [];
    let imported = 0;

    for (const head of fresh) {
      const docLines = lines.rows.filter((row) => row.doc_no === head.doc_no);
      if (docLines.length === 0) continue;

      const client = await db.connect();
      try {
        await client.query("begin");

        // ໃບຂໍຕົ້ນທາງ (ODS) — ໃຫ້ຮູ້ວ່າໃບເບີກນີ້ຂອງງານໃດ ແລະ ຝັ່ງໃດ (ຕິດຕັ້ງ/ສ້ອມ)
        const request = await client.query<{ product_code: string; job_type: string | null }>(
          "select product_code, job_type from ic_trans where doc_no = $1 and trans_flag = $2 limit 1",
          [head.doc_ref, TRANS.REQUEST],
        );
        const job = request.rows[0];
        if (!job?.product_code) {
          await client.query("rollback");
          continue;
        }
        const install = job.job_type === "install";

        // ① ຫົວ/ລາຍລະອຽດຂອງໃບເບີກ ລົງ ODS (ກ໋ອບຄ່າຂອງງານມາຈາກໃບຂໍ ຄືເກົ່າ)
        await client.query(
          `insert into ic_trans(trans_flag,doc_date,doc_no,doc_ref,doc_ref_date,cust_code,product_code,issue,remark,
             wanrunty,isue_2,waranty_request,emp,w_reason,used_spare,job_type,wh_code,shelf_code,user_created)
           select $1,$2,$3,doc_no,doc_date,cust_code,product_code,issue,$4,
             wanrunty,isue_2,waranty_request,emp,w_reason,used_spare,job_type,wh_code,shelf_code,$5
           from ic_trans where doc_no=$6 and trans_flag=$7`,
          [TRANS.DISPATCH, head.doc_date, head.doc_no, head.remark ?? "", head.creator_code ?? "", head.doc_ref,
            TRANS.REQUEST],
        );

        for (const line of docLines) {
          await client.query(
            `insert into ic_trans_detail(trans_flag,doc_date,doc_no,doc_ref,product_code,item_code,item_name,qty,
               unit_code,calc_flag,status,user_created,job_type)
             values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,0,$11,$12)`,
            [TRANS.DISPATCH, head.doc_date, head.doc_no, head.doc_ref, job.product_code, line.item_code,
              line.item_name, line.qty, line.unit_code, CALC_OUT, head.creator_code ?? "", job.job_type],
          );

          // ② ບັນຊີອາໄຫຼ່ຂອງງານ: ແຖວນີ້ຖືກເບີກແລ້ວ · ③ ສະຕັອກເງົາຂອງ ODS ຫັກຕາມ
          await client.query(
            `update tb_used_spare set reg_finish=localtimestamp(0)
              where product_code=$1 and item_code=$2 and reg_finish is null`,
            [job.product_code, line.item_code],
          );
          await client.query(
            "update ic_inventory set balance_qty=balance_qty-$1, wh_qty=wh_qty-$1 where code=$2",
            [Number(line.qty), line.item_code],
          );
          // ແຖວຂອງໃບຂໍ = ເບີກແລ້ວ (ສູດ outstanding ອ່ານຄ່ານີ້)
          await client.query(
            "update ic_trans_detail set status=1 where doc_no=$1 and trans_flag=$2 and item_code=$3 and status=0",
            [head.doc_ref, TRANS.REQUEST, line.item_code],
          );
        }

        // ④ ໃບຂໍນີ້ຖືກເບີກຄົບແລ້ວ ⇒ ງານເລື່ອນໄປຂັ້ນ "ຮັບອາໄຫຼ່"
        const pending = await client.query<{ count: number }>(
          "select count(*)::int count from ic_trans_detail where doc_no=$1 and trans_flag=$2 and status=0",
          [head.doc_ref, TRANS.REQUEST],
        );
        if ((pending.rows[0]?.count ?? 0) === 0) {
          if (install) {
            await client.query("update ods_tb_install set reg_finish=localtimestamp(0) where code=$1 and reg_finish is null", [
              job.product_code,
            ]);
          } else {
            await client.query(
              "update tb_product set spare_finish=localtimestamp(0), status=4 where code=$1 and spare_finish is null",
              [job.product_code],
            );
          }
        }

        await client.query("commit");
        imported += 1;
        jobs.push(job.product_code);
      } catch (error) {
        await client.query("rollback").catch(() => {});
        console.error("syncErpDispatch failed", head.doc_no, error);
      } finally {
        client.release();
      }
    }

    return { imported, jobs };
  } catch (error) {
    // ERP ລົ້ມ ⇒ ໜ້າຈໍຍັງເປີດໄດ້ (ພຽງແຕ່ຍັງບໍ່ເຫັນໃບໃໝ່)
    console.error("syncErpDispatch failed", error);
    return empty;
  }
}


/**
 * **ດຶງໃບຮັບຄືນ (58) ທີ່ສາງຮັບໃນ ERP ກັບຄືນມາໃສ່ ODS.**
 *
 * ຄູ່ກັບ syncErpDispatch — ຫຼັກການດຽວກັນ: ເອກະສານທີ່ **ຍ້າຍສະຕັອກ** ອອກຢູ່ ERP,
 * ODS ເປັນຝ່າຍອ່ານ. ຜູກກັນຜ່ານ doc_ref = ເລກໃບ**ຂໍສົ່ງຄືນ** (SRI…) ຂອງເຮົາ.
 *
 * ເຮັດໃຫ້: ① ໃບຮັບຄືນລົງ ODS  ② ບວກສະຕັອກເງົາຄືນ  ③ ໝາຍອາໄຫຼ່ວ່າ "ສົ່ງຄືນແລ້ວ"
 * (tb_used_spare.status='2') **ແຖວລະລາຍການ** ບໍ່ແມ່ນທັງງານ (ບັກເກົ່າຂອງ ods)
 * ④ ປິດແຖວຂອງໃບຂໍສົ່ງຄືນ ⇒ ໃບຫຼຸດອອກຈາກຄິວ "ລໍສາງຮັບຄືນ" ເອງ.
 */
export async function syncErpReturns(): Promise<SyncResult> {
  const empty: SyncResult = { imported: 0, jobs: [] };
  if (!db) return empty;

  try {
    const open = await db.query<{ doc_no: string }>(
      `select distinct t.doc_no
         from ic_trans t
         join ic_trans_detail d on d.doc_no = t.doc_no and d.trans_flag = t.trans_flag
        where t.trans_flag = $1 and d.status = $2
          and t.doc_date >= current_date - 180`,
      [TRANS.RETURN_REQUEST, LINE_STATUS.RETURN_REQUESTED],
    );
    if (open.rows.length === 0) return empty;

    const heads = await queryOdg<{ doc_no: string; doc_date: string; doc_ref: string; remark: string | null; creator_code: string | null }>(
      `select doc_no, to_char(doc_date,'YYYY-MM-DD') as doc_date,
          split_part(trim(doc_ref), ' ', 1) as doc_ref, remark, creator_code
        from ic_trans
       where trans_flag = $1 and split_part(trim(doc_ref), ' ', 1) = any($2::text[])`,
      [TRANS.RECEIVE_BACK, open.rows.map((row) => row.doc_no)],
    );
    if (heads.rows.length === 0) return empty;

    const known = await db.query<{ doc_no: string }>(
      "select doc_no from ic_trans where trans_flag = $1 and doc_no = any($2::varchar[])",
      [TRANS.RECEIVE_BACK, heads.rows.map((row) => row.doc_no)],
    );
    const seen = new Set(known.rows.map((row) => row.doc_no));
    const fresh = heads.rows.filter((row) => !seen.has(row.doc_no));
    if (fresh.length === 0) return empty;

    const lines = await queryOdg<ErpLine>(
      `select doc_no, item_code, item_name, unit_code, qty::text as qty
         from ic_trans_detail where trans_flag = $1 and doc_no = any($2::text[]) order by line_number`,
      [TRANS.RECEIVE_BACK, fresh.map((row) => row.doc_no)],
    );

    const jobs: string[] = [];
    let imported = 0;

    for (const head of fresh) {
      const docLines = lines.rows.filter((row) => row.doc_no === head.doc_no);
      if (docLines.length === 0) continue;

      const client = await db.connect();
      try {
        await client.query("begin");

        const request = await client.query<{ product_code: string | null }>(
          "select product_code from ic_trans where doc_no = $1 and trans_flag = $2 limit 1",
          [head.doc_ref, TRANS.RETURN_REQUEST],
        );
        const job = request.rows[0]?.product_code ?? "";

        await client.query(
          `insert into ic_trans(trans_flag,doc_date,doc_no,doc_ref,doc_ref_date,product_code,remark,user_created)
           values($1,$2,$3,$4,$2,$5,$6,$7)`,
          [TRANS.RECEIVE_BACK, head.doc_date, head.doc_no, head.doc_ref, job || null, head.remark ?? "",
            head.creator_code ?? ""],
        );

        for (const line of docLines) {
          await client.query(
            `insert into ic_trans_detail(trans_flag,doc_date,doc_no,doc_ref,product_code,item_code,item_name,qty,
               unit_code,calc_flag,user_created)
             values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
            [TRANS.RECEIVE_BACK, head.doc_date, head.doc_no, head.doc_ref, job || null, line.item_code,
              line.item_name, line.qty, line.unit_code, CALC_IN, head.creator_code ?? ""],
          );

          // ບວກສະຕັອກເງົາຂອງ ODS ຄືນ (ERP ບວກໄປແລ້ວຕອນສາງຮັບ)
          await client.query(
            "update ic_inventory set balance_qty=balance_qty+$1, wh_qty=wh_qty+$1 where code=$2",
            [Number(line.qty), line.item_code],
          );

          // ໝາຍ **ແຖວລະລາຍການ** ວ່າສົ່ງຄືນແລ້ວ (ods ໝາຍທັງງານ ⇒ ອາໄຫຼ່ 1 ໃນ 5 ກໍ່ຖືວ່າຄືນໝົດ)
          if (job) {
            await client.query(
              `update tb_used_spare set status='2'
                where roworder = (
                  select roworder from tb_used_spare
                   where product_code=$1 and item_code=$2 and coalesce(status,'') <> '2'
                   order by (reg_finish is not null) desc, roworder asc limit 1)`,
              [job, line.item_code],
            );
          }

          // ແຖວຂອງໃບຂໍສົ່ງຄືນ = ຮັບຄືນແລ້ວ ⇒ ຫຼຸດອອກຈາກຄິວ
          await client.query(
            "update ic_trans_detail set status=$1 where doc_no=$2 and trans_flag=$3 and item_code=$4 and status=$5",
            [LINE_STATUS.ISSUED, head.doc_ref, TRANS.RETURN_REQUEST, line.item_code, LINE_STATUS.RETURN_REQUESTED],
          );
        }

        await client.query("commit");
        imported += 1;
        if (job) jobs.push(job);
      } catch (error) {
        await client.query("rollback").catch(() => {});
        console.error("syncErpReturns failed", head.doc_no, error);
      } finally {
        client.release();
      }
    }

    return { imported, jobs };
  } catch (error) {
    console.error("syncErpReturns failed", error);
    return empty;
  }
}
