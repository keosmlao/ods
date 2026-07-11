"use server";

import { logChange } from "@/app/actions/chatter";
import { notify } from "@/app/actions/notification";
import { getSession } from "@/lib/auth";
import { ROLE_WAREHOUSE } from "@/lib/chatter";
import { db, odgDb } from "@/lib/db";
import { docPrefix, nextDocNo } from "@/lib/doc-no";
import { ppDb, PP_NOT_CONFIGURED } from "@/lib/stock-db";
import {
  CALC_IN,
  CALC_OUT,
  DEFAULT_SHELF,
  DEFAULT_WH,
  ERP,
  LINE_STATUS,
  MAIN_WH,
  RETURN_SHELF,
  RETURN_WH,
  TRANS,
  branchOf,
} from "@/lib/stock-constants";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

/*
 * ຖອດແບບຈາກ ods/stock.py, ods/spare_part.py, ods/newspare.py
 *
 * ຄວາມແຕກຕ່າງທີ່ຕັ້ງໃຈ (ບໍ່ໄດ້ລອກ bug ຂອງ ods):
 *  - ods ເກັບ roworder / product_code ໄວ້ໃນ Flask session ລະຫວ່າງ GET ກັບ POST
 *    → ເປີດສອງແທັບພ້ອມກັນແລ້ວຂໍ້ມູນຂ້າມກັນ. ຢູ່ນີ້ສົ່ງຜ່ານ form field ແທນ.
 *  - ods ອອກເລກເອກະສານດ້ວຍ max()+1 ນອກ transaction → ຊ້ຳກັນໄດ້.
 *    ຢູ່ນີ້ອອກເລກໃນ transaction ທີ່ຖື pg_advisory_xact_lock().
 *  - ods ຂຽນ ODS ກັບ ERP ແບບ autocommit ໃນບາງ route → ຄ້າງເຄິ່ງທາງໄດ້.
 *    ຢູ່ນີ້ begin/commit/rollback ທັງສອງຖານ.
 */

export type StockState = { error?: string; ok?: string };

/** ລັອກຕອນອອກເລກເອກະສານ ກັນສອງຄົນກົດພ້ອມກັນແລ້ວໄດ້ເລກຊ້ຳ */
const DOC_LOCK = 734211;

/**
 * trans_flag 166 = "ຊ່າງຮັບອາໄຫຼ່" (PISP) — ເອກະສານຢູ່ ODS ຢ່າງດຽວ ບໍ່ຕັດສະຕັອກ
 * (ສະຕັອກຕັດໄປແລ້ວຕອນສາງເບີກ 56). ງານຕິດຕັ້ງໃຊ້ flag ນີ້ຢູ່ແລ້ວ (installation.ts)
 * — ບ່ອນນີ້ເອົາຂັ້ນດຽວກັນມາໃຫ້ງານສ້ອມ ເຊິ່ງແຕ່ກ່ອນບໍ່ມີເລີຍ (tb_used_spare.pick_finish
 * ຂອງວຽກສ້ອມເປັນ null ທຸກແຖວ ⇒ ປ້າຍ/ການປ້ອງກັນຢູ່ໜ້າສ້ອມແປງບໍ່ເຄີຍເຮັດວຽກ).
 * ບໍ່ໄດ້ໃສ່ໃນ lib/stock-constants.ts ເພາະໄຟລ໌ນັ້ນຢູ່ນອກຂອບເຂດການແກ້ໄຂຄັ້ງນີ້.
 */
const TRANS_PICK = 166;

/**
 * ອາໄຫຼ່ຂອງວຽກນຶ່ງ ທີ່ "ຍັງບໍ່ທັນຖືກຂໍເບີກ" — ຄິດເປັນ **ຈຳນວນ** ບໍ່ແມ່ນເປັນແຖວ.
 *
 * ເປັນຫຍັງຈຶ່ງອີງໃສ່ເອກະສານ (ic_trans_detail) ບໍ່ແມ່ນຖັນຂອງ tb_used_spare:
 *   • tb_used_spare.status  — ເຊື່ອບໍ່ໄດ້: ວຽກສ້ອມ 2,945 ແຖວມີ status='1' ແຕ່ມີພຽງ 2,107
 *     ແຖວທີ່ມີໃບເບີກ (56) ຈິງ ແລະ ຍັງມີ 60 ແຖວ status='0' ທີ່ຖືກເບີກອອກໄປແລ້ວ.
 *   • pick_finish           — ວຽກສ້ອມ 0/3,384 ແຖວ (ນີ້ຄືຕົວບັນຫາທີ່ກຳລັງແກ້ຢູ່).
 *   • reg_finish            — ວຽກສ້ອມ 148/3,384 ແຖວ, ສາຍງານສ້ອມບໍ່ເຄີຍຂຽນລົງ.
 * ⇒ ມີແຕ່ບັນຊີເອກະສານເທົ່ານັ້ນທີ່ບອກຄວາມຈິງໄດ້ວ່າ "ຂໍໄປແລ້ວ / ເບີກອອກແລ້ວ".
 *
 * ນັບໃບຂໍເບີກ (122) ທັງໝົດເປັນ "ຂໍໄປແລ້ວ" — ລວມແຖວທີ່ສາງເບີກອອກໄປແລ້ວນຳ ເພາະຕອນເບີກ
 * ແຖວ 122 ພຽງແຕ່ປ່ຽນ status ເປັນ 1 (ບໍ່ໄດ້ຖືກລຶບ) — ແລ້ວຫັກຄືນດ້ວຍໃບຂໍສົ່ງຄືນ (59)
 * ເພາະອາໄຫຼ່ທີ່ສົ່ງຄືນສາງແລ້ວ ຂໍເບີກໃໝ່ໄດ້ອີກ.
 * ໃບຂໍເບີກທີ່ຖືກຍົກເລີກ (deleteRequest) ລຶບແຖວອອກ ⇒ ກັບມາຂໍໄດ້ເອງ.
 */
const OUTSTANDING_SPARES = `
  select n.item_code, n.item_name, n.unit_code, (n.qty - coalesce(c.qty, 0))::numeric qty
  from (
    select item_code, min(roworder) rn, max(item_name) item_name, max(unit_code) unit_code, sum(qty) qty
    from tb_used_spare where product_code = $1 group by item_code
  ) n
  left join (
    select item_code,
      sum(case when trans_flag = ${TRANS.REQUEST} then qty else -qty end) qty
    from ic_trans_detail
    where product_code = $1 and trans_flag in (${TRANS.REQUEST}, ${TRANS.RETURN_REQUEST})
    group by item_code
  ) c on c.item_code = n.item_code
  where n.qty - coalesce(c.qty, 0) > 0
  order by n.rn`;

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

/**
 * ເອກະສານສາງຜູກກັບວຽກສ້ອມ (tb_product) ເປັນສ່ວນຫຼາຍ ແຕ່ງານຕິດຕັ້ງກໍ່ໃຊ້ product_code ຄືກັນ
 * (INST-xxxx) → ເລືອກ model ໃຫ້ຖືກ ຈຶ່ງບັນທຶກ log ລົງເອກະສານທີ່ຖືກຕ້ອງ.
 */
function jobModel(code: string) {
  return code.startsWith("INST-") ? "ods_tb_install" : "tb_product";
}

/** ວັນທີ/ເວລາຕາມເຂດເວລາ Asia/Vientiane (ods ໃຊ້ Asia/Bangkok ເຊິ່ງເປັນ UTC+7 ຄືກັນ) */
function nowParts() {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = Object.fromEntries(formatter.formatToParts(new Date()).map((p) => [p.type, p.value]));
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour}:${parts.minute}`,
    /** ໃຊ້ອອກເລກເອກະສານ ໃຫ້ປີ/ເດືອນຕົງກັບ doc_date */
    at: new Date(`${parts.year}-${parts.month}-${parts.day}T00:00:00`),
  };
}

/* ─────────────────────────── ກະຕ່າອາໄຫຼ່ (tb_used_spare) ─────────────────────────── */

/** ods: /additemtoreg — ເພີ່ມອາໄຫຼ່ໃສ່ໃບຂໍເບີກ (ຍັງບໍ່ທັນບັນທຶກເປັນເອກະສານ) */
export async function addSpareToRequest(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session || !db) return;

  const roworder = text(formData, "roworder");
  const productCode = text(formData, "product_code");
  const itemCode = text(formData, "code");
  const itemName = text(formData, "name_1");
  const unitCode = text(formData, "unit_code");
  if (!roworder || !productCode || !itemCode) return;

  await db.query(
    `insert into tb_used_spare(product_code, item_code, item_name, qty, unit_code) values($1,$2,$3,1,$4)`,
    [productCode, itemCode, itemName, unitCode],
  );
  redirect(`/stock/requests/${roworder}`);
}

/** ods: /updateqtytoreg — ແກ້ຈຳນວນອາໄຫຼ່ */
export async function updateSpareQty(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session || !db) return;

  const roworder = text(formData, "roworder");
  const rowId = text(formData, "row_id");
  const qty = Number(text(formData, "reg_qty"));
  if (!rowId || !Number.isFinite(qty) || qty <= 0) redirect(`/stock/requests/${roworder}`);

  await db.query(`update tb_used_spare set qty=$1 where roworder=$2`, [qty, rowId]);
  redirect(`/stock/requests/${roworder}`);
}

/** ods: /delete_itemfromreg — ລຶບອາໄຫຼ່ອອກຈາກໃບຂໍເບີກ */
export async function deleteSpareFromRequest(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session || !db) return;

  const roworder = text(formData, "roworder");
  const rowId = text(formData, "row_id");
  if (rowId) await db.query(`delete from tb_used_spare where roworder=$1`, [rowId]);
  redirect(`/stock/requests/${roworder}`);
}

/* ─────────────────────────── ໃບຂໍເບີກ (trans_flag 122) ─────────────────────────── */

/**
 * ods: /save_req — ສ້າງໃບຂໍເບີກຈາກກະຕ່າ tb_used_spare
 *
 * BUG ທີ່ແກ້ຢູ່ນີ້ (ods ກໍ່ເປັນ): ໃບຂໍເບີກກ໋ອບ **ທຸກ** ແຖວຂອງ tb_used_spare ໂດຍບໍ່ກອງ
 * ອາໄຫຼ່ທີ່ສາງເບີກອອກໄປແລ້ວ. /stock/requests/again ແມ່ນທາງເຂົ້າທີ່ຖືກຕ້ອງສຳລັບອາໄຫຼ່
 * ທີ່ຫາກໍ່ພົບຕອນສ້ອມ ⇒ ໃບທີສອງຈຶ່ງຂໍອາໄຫຼ່ຊຸດເກົ່າຄືນອີກ ແລ້ວສາງເບີກ (ແລະ ຕັດສະຕັອກ ERP)
 * ອາໄຫຼ່ຕົວດຽວກັນສອງເທື່ອ. ດຽວນີ້ຂໍສະເພາະ "ຈຳນວນທີ່ຍັງຄ້າງ" ເທົ່ານັ້ນ (OUTSTANDING_SPARES).
 */
export async function saveRequest(_: StockState, formData: FormData): Promise<StockState> {
  const session = await getSession();
  if (!session) return { error: "Session ໝົດອາຍຸ" };
  if (!db) return { error: "ບໍ່ພົບ DATABASE_URL" };

  const productCode = text(formData, "Product_code");
  const remark = text(formData, "remark");
  const whCode = text(formData, "wh_code");
  const shelfCode = text(formData, "shelf_code");
  if (!productCode) return { error: "ບໍ່ພົບລະຫັດສິນຄ້າ" };
  if (!whCode || !shelfCode) return { error: "ກະລຸນາເລືອກສາງ ແລະ ທີ່ເກັບ" };

  const { date: docDate, at } = nowParts();
  const client = await db.connect();
  let docNo = "";
  let lineCount = 0;
  try {
    await client.query("begin");
    await client.query("select pg_advisory_xact_lock($1)", [DOC_LOCK]);

    const cart = await client.query<{ count: number }>(
      `select count(*)::int count from tb_used_spare where product_code=$1`,
      [productCode],
    );
    if (!cart.rows[0]?.count) {
      await client.query("rollback");
      return { error: "ຍັງບໍ່ມີອາໄຫຼ່ໃນລາຍການ" };
    }

    // ສະເພາະຈຳນວນທີ່ຍັງບໍ່ທັນຂໍເບີກ/ເບີກອອກ — ກັນຂໍຊ້ຳແລ້ວສາງເບີກອາໄຫຼ່ຕົວດຽວກັນສອງເທື່ອ
    const lines = await client.query<{
      item_code: string;
      item_name: string | null;
      unit_code: string | null;
      qty: string;
    }>(OUTSTANDING_SPARES, [productCode]);
    if (lines.rows.length === 0) {
      await client.query("rollback");
      return { error: "ອາໄຫຼ່ທຸກລາຍການຂອງວຽກນີ້ ຖືກຂໍເບີກ ຫຼື ເບີກອອກໄປແລ້ວ" };
    }
    lineCount = lines.rows.length;

    docNo = await nextDocNo(client, "SIO", at);

    await client.query(
      `insert into ic_trans(trans_flag, doc_date, doc_no, product_code, remark, user_created, wh_code, shelf_code)
       values($1,$2,$3,$4,$5,$6,$7,$8)`,
      [TRANS.REQUEST, docDate, docNo, productCode, remark, session.username, whCode, shelfCode],
    );
    for (const line of lines.rows) {
      await client.query(
        `insert into ic_trans_detail(trans_flag, doc_date, doc_no, product_code, item_code, item_name, qty, unit_code, calc_flag, user_created, status)
         values($1,$2,$3,$4,$5,$6,$7,$8,1,$9,$10)`,
        [
          TRANS.REQUEST, docDate, docNo, productCode, line.item_code, line.item_name, line.qty, line.unit_code,
          session.username, LINE_STATUS.PENDING,
        ],
      );
    }
    // ໝາຍແຖວກະຕ່າຂອງອາໄຫຼ່ທີ່ຢູ່ໃນໃບນີ້ວ່າ "ຂໍເບີກແລ້ວ" (ຄືສາຍງານຕິດຕັ້ງ)
    await client.query(
      `update tb_used_spare set reg_start=localtimestamp(0)
       where product_code=$1 and reg_start is null and item_code = any($2::varchar[])`,
      [productCode, lines.rows.map((line) => line.item_code)],
    );
    await client.query(`update tb_product set spare_reg=localtimestamp(0) where code=$1`, [productCode]);

    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    console.error("saveRequest failed", error);
    return { error: "ບັນທຶກບໍ່ສຳເລັດ" };
  } finally {
    client.release();
  }

  // ສາງຕ້ອງເບີກອາໄຫຼ່ໃຫ້ (ods ຍິງ LINE Notify ຫາສາງຢູ່ຈຸດນີ້)
  await logChange(
    jobModel(productCode),
    productCode,
    `ສ້າງໃບຂໍເບີກ ${docNo} · ອາໄຫຼ່ ${lineCount} ລາຍການ${remark ? ` · ${remark}` : ""}`,
    { roles: ROLE_WAREHOUSE },
  );

  redirect("/stock/requests");
}

/** ods: /del_request/<product_code>/<doc_no> — ຍົກເລີກໃບຂໍເບີກ */
export async function deleteRequest(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session || !db) return;

  const productCode = text(formData, "product_code");
  const docNo = text(formData, "doc_no");
  if (!productCode || !docNo) return;

  const client = await db.connect();
  let deleted = false;
  try {
    await client.query("begin");
    // ຖ້າສິນຄ້າມີໃບຂໍເບີກຫຼາຍໃບ ຢ່າລ້າງ spare_reg (ods ກໍ່ເຮັດແບບນີ້)
    const other = await client.query<{ count: number }>(
      `select count(*)::int count from ic_trans where product_code=$1 and trans_flag=$2`,
      [productCode, TRANS.REQUEST],
    );
    if ((other.rows[0]?.count ?? 0) <= 1) {
      await client.query(`update tb_product set spare_reg=null where code=$1`, [productCode]);
    }
    await client.query(`delete from ic_trans where product_code=$1 and trans_flag=$2 and doc_no=$3`, [
      productCode,
      TRANS.REQUEST,
      docNo,
    ]);
    await client.query(`delete from ic_trans_detail where product_code=$1 and trans_flag=$2 and doc_no=$3`, [
      productCode,
      TRANS.REQUEST,
      docNo,
    ]);
    await client.query("commit");
    deleted = true;
  } catch (error) {
    await client.query("rollback");
    console.error("deleteRequest failed", error);
  } finally {
    client.release();
  }
  if (deleted) await logChange(jobModel(productCode), productCode, `ຍົກເລີກໃບຂໍເບີກ ${docNo}`);
  revalidatePath("/stock/requests");
}

/* ─────────────────────────── ເບີກອາໄຫຼ່ (trans_flag 56) ─────────────────────────── */

/**
 * ods: /save_dispatch — ຫົວໃຈຂອງການເຄື່ອນໄຫວສາງ.
 * ຂຽນທັງຖານ ODS ແລະ ຖານ ERP (odg) ພ້ອມກັນ ແລະ ຕັດ ic_inventory ທັງສອງຖານ.
 * ຖ້າຝັ່ງໃດຜິດພາດ rollback ທັງສອງ.
 *
 * BUG ທີ່ແກ້ຢູ່ນີ້ (ods ກໍ່ເປັນ): ເບີກສະເພາະແຖວທີ່ມີຂອງໃນສາງ ແຕ່ໄປ stamp
 * tb_product.spare_finish + status=4 ທຸກເທື່ອ ⇒ ມີອາໄຫຼ່ພຽງ 1 ໃນ 5 ລາຍການ
 * ວຽກກໍ່ຍ້າຍຈາກ "ກຳລັງເບີກອາໄຫຼ່" ໄປ "ລໍຖ້າສ້ອມແປງ" ທັງທີ່ຍັງຂາດອາໄຫຼ່ 4 ລາຍການ.
 * ດຽວນີ້ stamp ໃຫ້ກໍ່ຕໍ່ເມື່ອ **ທຸກ** ແຖວຂອງທຸກໃບຂໍເບີກຂອງວຽກນັ້ນຖືກເບີກອອກແລ້ວ.
 */
export async function saveDispatch(_: StockState, formData: FormData): Promise<StockState> {
  const session = await getSession();
  if (!session) return { error: "Session ໝົດອາຍຸ" };
  if (!db) return { error: "ບໍ່ພົບ DATABASE_URL" };
  if (!odgDb) return { error: "ບໍ່ພົບ ODG_DATABASE_URL" };

  const docRef = text(formData, "doc_ref");
  const remark = text(formData, "remark");
  if (!docRef) return { error: "ບໍ່ພົບເລກທີໃບຂໍເບີກ" };

  const { date: docDate, time: docTime, at } = nowParts();

  const ods = await db.connect();
  const odg = await odgDb.connect();
  let dispatchNo = "";
  let dispatchLines = 0;
  let productCode = "";
  let outstanding = 0;
  let technician: string | null = null;
  try {
    await ods.query("begin");
    await odg.query("begin");
    await ods.query("select pg_advisory_xact_lock($1)", [DOC_LOCK]);

    // ສາງ/ທີ່ເກັບ ແລະ ວຽກເຈົ້າຂອງ ເອົາຈາກໃບຂໍເບີກ (ບໍ່ເຊື່ອ product_code ທີ່ມາຈາກ form)
    const head = await ods.query<{
      doc_no: string;
      doc_date: Date;
      user_created: string | null;
      wh_code: string | null;
      shelf_code: string | null;
      product_code: string | null;
    }>(
      `select doc_no, doc_date, user_created, wh_code, shelf_code, product_code
       from ic_trans where doc_no=$1 limit 1`,
      [docRef],
    );
    const ref = head.rows[0];
    if (!ref) {
      await ods.query("rollback");
      await odg.query("rollback");
      return { error: "ບໍ່ພົບໃບຂໍເບີກ" };
    }
    productCode = ref.product_code ?? "";
    const whCode = ref.wh_code || DEFAULT_WH;
    const shelfCode = ref.shelf_code || DEFAULT_SHELF;
    const branchCode = branchOf(whCode);

    // ເອົາສະເພາະແຖວທີ່ຍັງບໍ່ທັນເບີກ ແລະ ມີຂອງໃນສາງນັ້ນຈິງ
    const lines = await ods.query<{ roworder: number; item_code: string; item_name: string; unit_code: string; qty: string }>(
      `select a.roworder, a.item_code, a.item_name, a.unit_code, a.qty
       from ic_trans_detail a
       left join ic_trans b on a.doc_no = b.doc_no
       where a.doc_no=$1 and a.status in ($2,$3)
         and (select round(balance_qty,2) from odg_stock_balance_location(a.item_code, b.wh_code, b.shelf_code) limit 1) > 0`,
      [docRef, LINE_STATUS.PENDING, LINE_STATUS.ON_PURCHASE_ORDER],
    );
    if (lines.rows.length === 0) {
      await ods.query("rollback");
      await odg.query("rollback");
      return { error: "ບໍ່ມີອາໄຫຼ່ທີ່ເບີກໄດ້ໃນສາງນີ້" };
    }
    const rowOrders = lines.rows.map((row) => row.roworder);

    const docNo = await nextDocNo(ods, "SWC", at);
    dispatchNo = docNo;
    dispatchLines = lines.rows.length;

    // ── ODS: ຫົວບິນ + ລາຍລະອຽດ
    await ods.query(
      `insert into ic_trans(trans_flag, doc_date, doc_no, doc_ref, doc_ref_date, cust_code, product_code, issue, remark,
         wanrunty, isue_2, waranty_request, emp, w_reason, used_spare, wh_code, shelf_code)
       select $1,$2,$3, doc_no, doc_date, cust_code, product_code, issue, $4,
         wanrunty, isue_2, waranty_request, emp, w_reason, used_spare, wh_code, shelf_code
       from ic_trans where doc_no=$5`,
      [TRANS.DISPATCH, docDate, docNo, remark, docRef],
    );
    await ods.query(
      `insert into ic_trans_detail(trans_flag, doc_date, doc_no, doc_ref_date, doc_ref, cust_code, product_code,
         item_code, item_name, qty, unit_code, calc_flag, user_created, status)
       select $1,$2,$3, doc_date, doc_no, cust_code, product_code,
         item_code, item_name, qty, unit_code, $4, $5, $6
       from ic_trans_detail where roworder = any($7::int[])`,
      [TRANS.DISPATCH, docDate, docNo, CALC_OUT, session.username, LINE_STATUS.PENDING, rowOrders],
    );

    // ── ODS: ຕັດສະຕັອກ (ສາງຫຼັກ 1103 ຕັດ wh_qty ນຳ)
    for (const line of lines.rows) {
      if (whCode === MAIN_WH) {
        await ods.query(`update ic_inventory set balance_qty=balance_qty-$1, wh_qty=wh_qty-$1 where code=$2`, [
          line.qty,
          line.item_code,
        ]);
      } else {
        await ods.query(`update ic_inventory set balance_qty=balance_qty-$1 where code=$2`, [line.qty, line.item_code]);
      }
    }

    await ods.query(`update ic_trans_detail set status=$1 where roworder = any($2::int[])`, [
      LINE_STATUS.ISSUED,
      rowOrders,
    ]);

    // ໝາຍແຖວກະຕ່າ (tb_used_spare) ວ່າສາງຈ່າຍອອກແລ້ວ — ແຖວລະໜຶ່ງລາຍການທີ່ເບີກ
    for (const line of lines.rows) {
      await ods.query(
        `update tb_used_spare set reg_finish=localtimestamp(0)
         where roworder = (
           select roworder from tb_used_spare
           where product_code=$1 and item_code=$2 and reg_finish is null
           order by (qty = $3::numeric) desc, roworder asc limit 1)`,
        [productCode, line.item_code, line.qty],
      );
    }

    /*
     * ວຽກນີ້ "ໄດ້ອາໄຫຼ່ຄົບ" ແທ້ບໍ? — ນັບແຖວທີ່ຍັງຄ້າງຂອງ **ທຸກ** ໃບຂໍເບີກຂອງວຽກນີ້
     * (ວຽກນຶ່ງອາດມີຫຼາຍໃບ: ຂໍຮອບທຳອິດ + ຂໍເບີກຊ້ຳຕອນສ້ອມ).
     * ຍັງຄ້າງ = ລໍຖ້າ (0) ຫຼື ກຳລັງສັ່ງຊື້ (5).
     */
    outstanding =
      (
        await ods.query<{ count: number }>(
          `select count(*)::int count from ic_trans_detail
           where trans_flag=$1 and product_code=$2 and status in ($3,$4)`,
          [TRANS.REQUEST, productCode, LINE_STATUS.PENDING, LINE_STATUS.ON_PURCHASE_ORDER],
        )
      ).rows[0]?.count ?? 0;

    if (outstanding === 0) {
      await ods.query(`update tb_product set spare_finish=localtimestamp(0), status=4 where code=$1`, [productCode]);
    } else {
      /*
       * ຍັງຂາດອາໄຫຼ່ຢູ່ → ວຽກຕ້ອງຄ້າງຢູ່ຂັ້ນ "ກຳລັງເບີກອາໄຫຼ່" (lib/stage: spare_finish is null).
       * ລ້າງ spare_finish ຖ້າໃບກ່ອນໜ້າ stamp ໄວ້ຜິດ (ຂໍ້ມູນເກົ່າ) — ວຽກທີ່ຊ່າງລົງມືສ້ອມແລ້ວ
       * (time_repair) ບໍ່ຖືກກະທົບ ເພາະ STAGE_SQL ອ່ານ time_repair ກ່ອນ spare_finish.
       */
      await ods.query(`update tb_product set spare_finish=null where code=$1`, [productCode]);
    }
    technician =
      (await ods.query<{ emp_code: string | null }>(`select emp_code from tb_product where code=$1`, [productCode]))
        .rows[0]?.emp_code ?? null;

    // ── ERP (odg): ຫົວບິນ
    await odg.query(
      `insert into ic_trans(trans_type, trans_flag, doc_no, doc_date, doc_ref, doc_ref_date, sale_code, doc_time,
         doc_format_code, wh_from, location_from, creator_code, branch_code, remark, side_code, department_code)
       values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
      [
        ERP.TRANS_TYPE, TRANS.DISPATCH, docNo, docDate, ref.doc_no, ref.doc_date, ref.user_created, docTime,
        ERP.FORMAT_DISPATCH, whCode, shelfCode, session.username, branchCode, remark, ERP.SIDE_CODE, ERP.DEPARTMENT_CODE,
      ],
    );

    // ── ERP (odg): ລາຍລະອຽດ + ຕັດສະຕັອກ
    for (const line of lines.rows) {
      const cost = await odg.query<{ average_cost: string }>(
        `select coalesce(average_cost,0) average_cost from ic_inventory where code=$1`,
        [line.item_code],
      );
      const avgCost = Number(cost.rows[0]?.average_cost ?? 0);
      const sumCost = avgCost * Number(line.qty);

      await odg.query(
        `insert into ic_trans_detail(trans_type, trans_flag, doc_no, doc_date, doc_ref, item_code, item_name, unit_code,
           qty, wh_code, shelf_code, stand_value, divide_value, doc_date_calc, doc_time_calc, calc_flag,
           sum_of_cost, average_cost, sum_of_cost_1, average_cost_1)
         values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,1,1,$12,$13,$14,$15,$16,$15,$16)`,
        [
          ERP.TRANS_TYPE, TRANS.DISPATCH, docNo, docDate, ref.doc_no, line.item_code, line.item_name, line.unit_code,
          line.qty, whCode, shelfCode, docDate, docTime, CALC_OUT, sumCost, avgCost,
        ],
      );
      await odg.query(`update ic_inventory set balance_qty=balance_qty-$1 where code=$2`, [line.qty, line.item_code]);
    }

    await odg.query("commit");
    await ods.query("commit");
  } catch (error) {
    await odg.query("rollback").catch(() => {});
    await ods.query("rollback").catch(() => {});
    console.error("saveDispatch failed", error);
    return { error: "ເບີກບໍ່ສຳເລັດ" };
  } finally {
    odg.release();
    ods.release();
  }

  if (productCode) {
    const head = `ສາງເບີກອາໄຫຼ່ອອກ ${dispatchNo} · ${dispatchLines} ລາຍການ (ອ້າງອີງໃບຂໍເບີກ ${docRef})`;
    if (outstanding > 0) {
      // ເບີກໄດ້ບໍ່ຄົບ — ວຽກຍັງຄ້າງຢູ່ຂັ້ນອາໄຫຼ່ ແລະ ສາງຍັງຕ້ອງລົງມືຕໍ່
      await logChange(jobModel(productCode), productCode, `${head} · ຍັງຂາດ ${outstanding} ລາຍການ`, {
        roles: ROLE_WAREHOUSE,
      });
    } else {
      // ຄົບແລ້ວ — ຊ່າງໄປຮັບອາໄຫຼ່ໄດ້ (ຂັ້ນ "ຊ່າງຮັບອາໄຫຼ່")
      await logChange(jobModel(productCode), productCode, `${head} · ອາໄຫຼ່ຄົບແລ້ວ — ຊ່າງໄປຮັບອາໄຫຼ່ໄດ້`, {
        users: technician ? [technician] : [],
      });
    }
  }

  revalidatePath("/repair");
  revalidatePath("/stock/requests");
  revalidatePath("/stock/requests/pickup");
  redirect("/stock/dispatch");
}

/* ─────────────────────── ຊ່າງຮັບອາໄຫຼ່ — ວຽກສ້ອມ (trans_flag 166) ─────────────────────── */

/**
 * ຊ່າງມາຮັບອາໄຫຼ່ທີ່ສາງເບີກອອກໃຫ້ແລ້ວ — ຂັ້ນນີ້ມີຢູ່ໃນສາຍງານຕິດຕັ້ງ (installation.ts
 * savePickSpare) ແຕ່ **ບໍ່ເຄີຍມີໃນສາຍງານສ້ອມ**: tb_used_spare.pick_finish ຂອງວຽກສ້ອມ
 * ເປັນ null ທຸກແຖວ (0/3,384) ທັງທີ່ໜ້າສ້ອມແປງອ່ານມັນຢູ່ແລ້ວ —
 *   /repair            → ປ້າຍ "ລໍຖ້າອາໄຫຼ່ n/m" ຈຶ່ງບໍ່ເຄີຍຖືກ
 *   /repair/[code]     → ທຸງ picked (ກັນຊ່າງລຶບອາໄຫຼ່ທີ່ສາງເບີກອອກໄປແລ້ວ) ຈຶ່ງບໍ່ເຄີຍກັນ
 * ບ່ອນນີ້ຈຶ່ງເພີ່ມຂັ້ນນັ້ນໃຫ້ຄົບ: ອອກໃບ PISP (166) ອ້າງອີງໃບເບີກ SWC ແລ້ວ stamp pick_finish.
 * ບໍ່ແຕະ ic_inventory — ສະຕັອກຖືກຕັດໄປແລ້ວຕອນສາງເບີກ (56).
 */
export async function savePickSpare(_: StockState, formData: FormData): Promise<StockState> {
  const session = await getSession();
  if (!session) return { error: "Session ໝົດອາຍຸ" };
  if (!db) return { error: "ບໍ່ພົບ DATABASE_URL" };

  const docRef = text(formData, "doc_ref"); // ເລກທີໃບເບີກ (SWC)
  const remark = text(formData, "remark");
  if (!docRef) return { error: "ບໍ່ພົບເລກທີໃບເບີກ" };

  const { date: docDate, at } = nowParts();

  const client = await db.connect();
  let pickNo = "";
  let pickLines = 0;
  let productCode = "";
  try {
    await client.query("begin");
    await client.query("select pg_advisory_xact_lock($1)", [DOC_LOCK]);

    const head = (
      await client.query<{ product_code: string | null }>(
        `select product_code from ic_trans
         where doc_no=$1 and trans_flag=$2 and (job_type is null or job_type <> 'install') limit 1`,
        [docRef, TRANS.DISPATCH],
      )
    ).rows[0];
    if (!head?.product_code) {
      await client.query("rollback");
      return { error: "ບໍ່ພົບໃບເບີກອາໄຫຼ່" };
    }
    productCode = head.product_code;

    // ກັນຮັບຊ້ຳ — ໃບເບີກນຶ່ງໃບຮັບໄດ້ເທື່ອດຽວ
    const already = await client.query<{ count: number }>(
      `select count(*)::int count from ic_trans where trans_flag=$1 and doc_ref=$2`,
      [TRANS_PICK, docRef],
    );
    if (already.rows[0]?.count) {
      await client.query("rollback");
      return { error: "ໃບນີ້ຮັບອາໄຫຼ່ໄປແລ້ວ" };
    }

    const lines = await client.query<{
      item_code: string;
      item_name: string | null;
      unit_code: string | null;
      qty: string;
    }>(
      `select item_code, item_name, unit_code, qty from ic_trans_detail
       where doc_no=$1 and trans_flag=$2 order by roworder asc`,
      [docRef, TRANS.DISPATCH],
    );
    if (lines.rows.length === 0) {
      await client.query("rollback");
      return { error: "ບໍ່ມີອາໄຫຼ່ໃນໃບນີ້" };
    }

    const docNo = await nextDocNo(client, "PISP", at);
    pickNo = docNo;
    pickLines = lines.rows.length;

    await client.query(
      `insert into ic_trans(trans_flag, doc_date, doc_no, doc_ref, product_code, remark, user_created, status)
       values($1,$2,$3,$4,$5,$6,$7,$8)`,
      [TRANS_PICK, docDate, docNo, docRef, productCode, remark, session.username, LINE_STATUS.PENDING],
    );

    for (const line of lines.rows) {
      await client.query(
        `insert into ic_trans_detail(trans_flag, doc_date, doc_no, doc_ref, product_code,
           item_code, item_name, qty, unit_code, calc_flag, user_created, status)
         values($1,$2,$3,$4,$5,$6,$7,$8,$9,1,$10,$11)`,
        [
          TRANS_PICK, docDate, docNo, docRef, productCode, line.item_code, line.item_name, line.qty, line.unit_code,
          session.username, LINE_STATUS.ISSUED,
        ],
      );
      // ແຖວກະຕ່າອັນທີ່ຕົງກັບອາໄຫຼ່ແຖວນີ້ (ເລືອກແຖວທີ່ສາງຈ່າຍແລ້ວ ແລະ ຈຳນວນຕົງກັນກ່ອນ)
      await client.query(
        `update tb_used_spare
           set pick_finish=localtimestamp(0), reg_finish=coalesce(reg_finish, localtimestamp(0))
         where roworder = (
           select roworder from tb_used_spare
           where product_code=$1 and item_code=$2 and pick_finish is null
           order by (reg_finish is not null) desc, (qty = $3::numeric) desc, roworder asc limit 1)`,
        [productCode, line.item_code, line.qty],
      );
    }

    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    console.error("savePickSpare failed", error);
    return { error: "ບັນທຶກບໍ່ສຳເລັດ" };
  } finally {
    client.release();
  }

  await logChange(
    jobModel(productCode),
    productCode,
    `ຊ່າງຮັບອາໄຫຼ່ ${pickNo} · ${pickLines} ລາຍການ (ອ້າງອີງໃບເບີກ ${docRef})`,
  );

  revalidatePath("/repair");
  revalidatePath(`/repair/${productCode}`);
  revalidatePath("/stock/requests/pickup");
  redirect("/stock/requests/pickup");
}

/** ods: /update_stock_new — ດຶງຍອດຄົງເຫຼືອຈາກ view ມາອັບເດດ ic_inventory */
export async function refreshInventory(): Promise<void> {
  const session = await getSession();
  if (!session || !db) return;

  const scope = `(select a.item_code from ic_trans_detail a
      where a.trans_flag = ${TRANS.REQUEST} and a.status = ${LINE_STATUS.PENDING} or a.status = ${LINE_STATUS.ON_PURCHASE_ORDER})`;

  const client = await db.connect();
  try {
    await client.query("begin");
    await client.query(
      `update ic_inventory a set owh_qty=coalesce(owh.balance_qty,0)
       from (select odm2022_code code, round(sum(balance_qty),2) balance_qty from show_oqty_dispatch group by odm2022_code) owh
       where owh.code=a.code and a.code in ${scope}`,
    );
    await client.query(
      `update ic_inventory a set wh_qty=coalesce(wh.balance_qty,0)
       from (select odm2022_code code, case when balance_qty<0 then 0 else round(balance_qty,2) end balance_qty from show_qty_dispatch) wh
       where wh.code=a.code and a.code in ${scope}`,
    );
    await client.query(
      `update ic_inventory a set balance_qty=coalesce(wh_qty,0)+coalesce(owh_qty,0) where a.code in ${scope}`,
    );
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    console.error("refreshInventory failed", error);
  } finally {
    client.release();
  }
  revalidatePath("/stock/dispatch");
}

/* ─────────────────────────── ໃບຂໍສົ່ງຄືນ (trans_flag 59) ─────────────────────────── */

/**
 * ods: /return_req_check/<doc_no> — ກ໋ອບແຖວຂອງໃບເບີກມາເປັນແຖວຮ່າງ (trans_flag 33)
 * ແລ້ວເປີດໜ້າຂໍສົ່ງຄືນ. ຖ້າມີແຖວຮ່າງຢູ່ແລ້ວກໍ່ຂ້າມການກ໋ອບ.
 */
export async function startReturnRequest(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session || !db) return;

  const docNo = text(formData, "doc_no");
  if (!docNo) return;

  const existing = await db.query<{ count: number }>(
    `select count(*)::int count from ic_trans_detail_draft where doc_no=$1 and trans_flag=$2 and user_created=$3`,
    [docNo, TRANS.DRAFT, session.username],
  );
  if (!existing.rows[0]?.count) {
    await db.query(
      `insert into ic_trans_detail_draft(doc_no, product_code, item_code, item_name, qty, unit_code, row_ref, user_created, trans_flag)
       select doc_no, product_code, item_code, item_name, qty, unit_code, roworder, $1, $2
       from ic_trans_detail where doc_no=$3 and status=$4 order by roworder asc`,
      [session.username, TRANS.DRAFT, docNo, LINE_STATUS.PENDING],
    );
  }
  redirect(`/stock/returns/${encodeURIComponent(docNo)}`);
}

/** ods: /not_choose_req — ເອົາອາໄຫຼ່ແຖວນຶ່ງອອກຈາກໃບຂໍສົ່ງຄືນ */
export async function removeReturnDraftLine(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session || !db) return;

  const rowId = text(formData, "row_id");
  const docNo = text(formData, "doc_no");
  if (rowId) {
    await db.query(`delete from ic_trans_detail_draft where roworder=$1 and user_created=$2`, [rowId, session.username]);
  }
  redirect(`/stock/returns/${encodeURIComponent(docNo)}`);
}

/** ods: /back_stock_return — ຖິ້ມແຖວຮ່າງທັງໝົດຂອງຜູ້ໃຊ້ ແລ້ວກັບຄືນ */
export async function cancelReturnRequest(): Promise<void> {
  const session = await getSession();
  if (!session || !db) return;

  await db.query(`delete from ic_trans_detail_draft where trans_flag=$1 and user_created=$2`, [
    TRANS.DRAFT,
    session.username,
  ]);
  redirect("/stock/returns");
}

/** ods: /save_return_req — ບັນທຶກໃບຂໍສົ່ງຄືນຈາກແຖວຮ່າງ */
export async function saveReturnRequest(_: StockState, formData: FormData): Promise<StockState> {
  const session = await getSession();
  if (!session) return { error: "Session ໝົດອາຍຸ" };
  if (!db) return { error: "ບໍ່ພົບ DATABASE_URL" };

  const docRef = text(formData, "doc_ref");
  const docRefDate = text(formData, "doc_ref_date");
  const productCode = text(formData, "Product_code");
  const remark = text(formData, "remark");
  if (!docRef) return { error: "ບໍ່ພົບເລກທີໃບເບີກ" };

  const { date: docDate, at } = nowParts();
  const client = await db.connect();
  let returnNo = "";
  let returnLines = 0;
  try {
    await client.query("begin");
    await client.query("select pg_advisory_xact_lock($1)", [DOC_LOCK]);

    const draft = await client.query<{ row_ref: number }>(
      `select row_ref from ic_trans_detail_draft where trans_flag=$1 and doc_no=$2 and user_created=$3`,
      [TRANS.DRAFT, docRef, session.username],
    );
    if (draft.rows.length === 0) {
      await client.query("rollback");
      return { error: "ຍັງບໍ່ມີອາໄຫຼ່ໃນລາຍການ" };
    }
    const rowRefs = draft.rows.map((row) => row.row_ref);

    const docNo = await nextDocNo(client, "SRI", at);
    returnNo = docNo;
    returnLines = draft.rows.length;

    await client.query(
      `insert into ic_trans(trans_flag, doc_date, doc_no, doc_ref, doc_ref_date, product_code, remark, user_created, status)
       values($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        TRANS.RETURN_REQUEST, docDate, docNo, docRef, docRefDate, productCode, remark, session.username,
        LINE_STATUS.RETURN_REQUESTED,
      ],
    );
    await client.query(
      `insert into ic_trans_detail(trans_flag, doc_date, doc_no, doc_ref, doc_ref_date, product_code,
         item_code, item_name, qty, unit_code, calc_flag, user_created, status)
       select $1,$2,$3,$4,$5, product_code, item_code, item_name, qty, unit_code, 1, $6, $7
       from ic_trans_detail_draft where trans_flag=$8 and doc_no=$9 and user_created=$10::varchar`,
      [
        TRANS.RETURN_REQUEST, docDate, docNo, docRef, docRefDate, session.username,
        LINE_STATUS.RETURN_REQUESTED, TRANS.DRAFT, docRef, session.username,
      ],
    );

    // ແຖວຂອງໃບເບີກທີ່ຖືກເລືອກສົ່ງຄືນ → ປິດ
    await client.query(`update ic_trans_detail set status=$1 where roworder = any($2::int[])`, [
      LINE_STATUS.ISSUED,
      rowRefs,
    ]);
    await client.query(`update tb_product set spare_reg=localtimestamp(0) where code=$1`, [productCode]);

    // ods ລຶບແຖວຮ່າງໃນ route ຕ່າງຫາກ (/back_stock_return) — ຢູ່ນີ້ລຶບໃນ transaction ດຽວກັນ
    await client.query(`delete from ic_trans_detail_draft where trans_flag=$1 and user_created=$2`, [
      TRANS.DRAFT,
      session.username,
    ]);

    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    console.error("saveReturnRequest failed", error);
    return { error: "ບັນທຶກບໍ່ສຳເລັດ" };
  } finally {
    client.release();
  }

  if (productCode) {
    // ສາງຕ້ອງອະນຸຍາດ ແລະ ຮັບຄືນ (ods ມີໂຄດ LINE Notify comment ໄວ້ຢູ່ຈຸດນີ້)
    await logChange(
      jobModel(productCode),
      productCode,
      `ສ້າງໃບຂໍສົ່ງອາໄຫຼ່ຄືນສາງ ${returnNo} · ${returnLines} ລາຍການ (ອ້າງອີງໃບເບີກ ${docRef})`,
      { roles: ROLE_WAREHOUSE },
    );
  }

  redirect("/stock/returns");
}

/* ─────────────────────────── ຮັບຄືນເຂົ້າສາງ (trans_flag 58) ─────────────────────────── */

/**
 * ods: /save_com_return — ສາງຮັບອາໄຫຼ່ຄືນ.
 * ຂຽນທັງ ODS ແລະ ERP (odg) ແລະ ບວກ ic_inventory ຄືນທັງສອງຖານ.
 */
export async function saveReceiveReturn(_: StockState, formData: FormData): Promise<StockState> {
  const session = await getSession();
  if (!session) return { error: "Session ໝົດອາຍຸ" };
  if (!db) return { error: "ບໍ່ພົບ DATABASE_URL" };
  if (!odgDb) return { error: "ບໍ່ພົບ ODG_DATABASE_URL" };

  const docRef = text(formData, "doc_ref");
  const remark = text(formData, "remark");
  const productCode = text(formData, "Product_code");
  if (!docRef) return { error: "ບໍ່ພົບເລກທີໃບຂໍສົ່ງຄືນ" };

  const { date: docDate, time: docTime, at } = nowParts();

  const ods = await db.connect();
  const odg = await odgDb.connect();
  let receiveNo = "";
  let receiveLines = 0;
  try {
    await ods.query("begin");
    await odg.query("begin");
    await ods.query("select pg_advisory_xact_lock($1)", [DOC_LOCK]);

    const head = await ods.query<{ doc_no: string; doc_date: Date; user_created: string | null }>(
      `select doc_no, doc_date, user_created from ic_trans where doc_no=$1 limit 1`,
      [docRef],
    );
    const ref = head.rows[0];
    if (!ref) {
      await ods.query("rollback");
      await odg.query("rollback");
      return { error: "ບໍ່ພົບໃບຂໍສົ່ງຄືນ" };
    }

    // ກັນບັນທຶກຊ້ຳ — ໃບຂໍສົ່ງຄືນນຶ່ງໃບຮັບຄືນໄດ້ເທື່ອດຽວ
    const already = await ods.query<{ count: number }>(
      `select count(*)::int count from ic_trans where trans_flag=$1 and doc_ref=$2`,
      [TRANS.RECEIVE_BACK, docRef],
    );
    if (already.rows[0]?.count) {
      await ods.query("rollback");
      await odg.query("rollback");
      return { error: "ໃບນີ້ຮັບຄືນແລ້ວ" };
    }

    const lines = await ods.query<{ item_code: string; item_name: string; unit_code: string; qty: string }>(
      `select item_code, item_name, unit_code, qty from ic_trans_detail where doc_no=$1`,
      [docRef],
    );
    if (lines.rows.length === 0) {
      await ods.query("rollback");
      await odg.query("rollback");
      return { error: "ບໍ່ມີອາໄຫຼ່ໃນໃບນີ້" };
    }

    const docNo = await nextDocNo(ods, "SRT", at);
    receiveNo = docNo;
    receiveLines = lines.rows.length;

    // ── ODS: ຫົວບິນ + ລາຍລະອຽດ
    await ods.query(
      `insert into ic_trans(trans_flag, doc_date, doc_no, doc_ref, doc_ref_date, cust_code, product_code, issue, remark,
         wanrunty, isue_2, waranty_request, emp, w_reason, used_spare)
       select $1,$2,$3, doc_no, doc_date, cust_code, product_code, issue, $4,
         wanrunty, isue_2, waranty_request, emp, w_reason, used_spare
       from ic_trans where doc_no=$5`,
      [TRANS.RECEIVE_BACK, docDate, docNo, remark, docRef],
    );
    await ods.query(
      `insert into ic_trans_detail(trans_flag, doc_date, doc_no, doc_ref_date, doc_ref, cust_code, product_code,
         item_code, item_name, qty, unit_code, calc_flag, user_created)
       select $1,$2,$3, doc_date, doc_no, cust_code, product_code,
         item_code, item_name, qty, unit_code, $4, $5
       from ic_trans_detail where doc_no=$6`,
      [TRANS.RECEIVE_BACK, docDate, docNo, CALC_OUT, session.username, docRef],
    );

    await ods.query(`update tb_used_spare set status='2' where product_code=$1`, [productCode]);

    // ── ODS: ບວກສະຕັອກຄືນ
    for (const line of lines.rows) {
      await ods.query(`update ic_inventory set balance_qty=balance_qty+$1, wh_qty=wh_qty+$1 where code=$2`, [
        line.qty,
        line.item_code,
      ]);
    }

    // ── ERP (odg): ຫົວບິນ + ລາຍລະອຽດ + ບວກສະຕັອກຄືນ
    await odg.query(
      `insert into ic_trans(trans_type, trans_flag, doc_no, doc_date, doc_ref, doc_ref_date, sale_code, doc_time,
         doc_format_code, wh_from, location_from, creator_code, branch_code, remark, side_code, department_code)
       values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
      [
        ERP.TRANS_TYPE, TRANS.RECEIVE_BACK, docNo, docDate, docRef, ref.doc_date, ref.user_created, docTime,
        ERP.FORMAT_RECEIVE, RETURN_WH, RETURN_SHELF, session.username, branchOf(RETURN_WH), remark,
        ERP.SIDE_CODE, ERP.DEPARTMENT_CODE,
      ],
    );
    for (const line of lines.rows) {
      await odg.query(
        `insert into ic_trans_detail(trans_type, trans_flag, doc_no, doc_date, doc_ref, item_code, item_name, unit_code,
           qty, wh_code, shelf_code, stand_value, divide_value, doc_date_calc, doc_time_calc, calc_flag)
         values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,1,1,$12,$13,$14)`,
        [
          ERP.TRANS_TYPE, TRANS.RECEIVE_BACK, docNo, docDate, ref.doc_no, line.item_code, line.item_name,
          line.unit_code, line.qty, RETURN_WH, RETURN_SHELF, docDate, docTime, CALC_IN,
        ],
      );
      await odg.query(`update ic_inventory set balance_qty=balance_qty+$1 where code=$2`, [line.qty, line.item_code]);
    }

    await odg.query("commit");
    await ods.query("commit");
  } catch (error) {
    await odg.query("rollback").catch(() => {});
    await ods.query("rollback").catch(() => {});
    console.error("saveReceiveReturn failed", error);
    return { error: "ບັນທຶກບໍ່ສຳເລັດ" };
  } finally {
    odg.release();
    ods.release();
  }

  if (productCode) {
    await logChange(
      jobModel(productCode),
      productCode,
      `ສາງຮັບອາໄຫຼ່ຄືນ ${receiveNo} · ${receiveLines} ລາຍການ (ອ້າງອີງໃບຂໍສົ່ງຄືນ ${docRef})`,
    );
  }

  redirect("/stock/receive-returns");
}

/* ─────────────────────────── ຂໍໂອນອາໄຫຼ່ຂ້າມສາງ (trans_flag 124) ─────────────────────────── */

/**
 * ສາງຕົ້ນທາງ/ປາຍທາງຂອງໃບຂໍໂອນ — ods ຝັງໄວ້ຕາຍຕົວໃນ /save_reqest_trans
 * (ສາງອາໄຫຼ່ໃຫຍ່ 1204 → ສາງສ້ອມ 1103). ຢູ່ນີ້ຕັ້ງຊື່ໃຫ້ ບໍ່ໄດ້ປ່ຽນຄ່າ.
 */
const TRANSFER_FROM_WH = "1204";
const TRANSFER_FROM_SHELF = "120401";
const TRANSFER_TO_WH = "1103";
const TRANSFER_TO_SHELF = "110301";
/** doc_format_code ຂອງໃບໂອນຢູ່ ERP (ods: 'IO') */
const TRANSFER_FORMAT = "IO";
/** ໃບຂໍເບີກທີ່ຂໍໂອນແລ້ວ — ods ໝາຍ ic_trans.used_status=4 */
const TRANSFER_REQUESTED_STATUS = 4;

const transferSchema = z.object({
  /** roworder ຂອງແຖວອາໄຫຼ່ (ic_trans_detail) ທີ່ບໍ່ມີຢູ່ໃນສາງຂອງໃບຂໍເບີກ */
  roworder: z.coerce.number().int().positive(),
  doc_ref: z.string().min(1),
  remark: z.string().default(""),
});

/**
 * ods: /save_reqest_trans (stock.py:1207) — ຂໍໂອນອາໄຫຼ່ຈາກສາງອື່ນເຂົ້າສາງສ້ອມ.
 *
 * ຄວາມແຕກຕ່າງທີ່ຕັ້ງໃຈ (ods ມີ bug):
 *  - ods ອອກເລກ SFRK ຈາກ ic_trans ຂອງ ODS ແຕ່ບັນທຶກໃບໂອນລົງ ERP ຢ່າງດຽວ
 *    → max() ເປັນ null ທຸກເທື່ອ ເລກຈຶ່ງເປັນ ...0001 ຊ້ຳກັນ.
 *    ຢູ່ນີ້ບັນທຶກຫົວ/ລາຍລະອຽດລົງ ODS ນຳ ແລ້ວອອກເລກດ້ວຍ nextDocNo ພາຍໃນ transaction ທີ່ລັອກແລ້ວ.
 *  - insert ລາຍລະອຽດຂອງ ods ມີຈຳນວນຄ່າບໍ່ຕົງກັບຖັນ (ຂາດ wh_code_2/shelf_code_2)
 *    → ໃບໂອນຢູ່ ERP ບໍ່ເຄີຍມີລາຍລະອຽດເລີຍ. ຢູ່ນີ້ຂຽນຄົບ (ຕົ້ນທາງ = wh_code, ປາຍທາງ = wh_code_2).
 *  - ods ສະແດງອາໄຫຼ່ແຖວດຽວ (roworder) ແຕ່ໄປກ໋ອບທຸກແຖວຂອງໃບຂໍເບີກ
 *    → ໂອນເກີນ ລວມທັງອາໄຫຼ່ທີ່ມີໃນສາງຢູ່ແລ້ວ. ຢູ່ນີ້ໂອນສະເພາະແຖວທີ່ຜູ້ໃຊ້ກົດ.
 *  - ບໍ່ຕັດ/ບວກ ic_inventory (ຄືກັບ ods) — ໃບນີ້ເປັນພຽງ "ຄຳຂໍ" ໃຫ້ສາງໃຫຍ່ໂອນ (calc_flag=0).
 */
export async function saveTransferRequest(_: StockState, formData: FormData): Promise<StockState> {
  const session = await getSession();
  if (!session) return { error: "Session ໝົດອາຍຸ" };
  if (!db) return { error: "ບໍ່ພົບ DATABASE_URL" };
  if (!odgDb) return { error: "ບໍ່ພົບ ODG_DATABASE_URL" };

  const parsed = transferSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "ຂໍ້ມູນບໍ່ຄົບ" };
  const { roworder, doc_ref: docRef, remark } = parsed.data;

  const { date: docDate, time: docTime, at } = nowParts();

  const ods = await db.connect();
  const odg = await odgDb.connect();
  let transferNo = "";
  let transferJob = "";
  let transferItem = "";
  try {
    await ods.query("begin");
    await odg.query("begin");
    await ods.query("select pg_advisory_xact_lock($1)", [DOC_LOCK]);

    const head = await ods.query<{
      doc_no: string;
      doc_date: Date;
      user_created: string | null;
      cust_code: string | null;
      product_code: string | null;
    }>(
      `select doc_no, doc_date, user_created, cust_code, product_code
       from ic_trans where doc_no=$1 and trans_flag=$2 limit 1`,
      [docRef, TRANS.REQUEST],
    );
    const ref = head.rows[0];
    if (!ref) {
      await ods.query("rollback");
      await odg.query("rollback");
      return { error: "ບໍ່ພົບໃບຂໍເບີກ" };
    }

    const line = (
      await ods.query<{ item_code: string; item_name: string | null; unit_code: string | null; qty: string }>(
        `select item_code, item_name, unit_code, qty
         from ic_trans_detail where roworder=$1 and doc_no=$2 and trans_flag=$3 limit 1`,
        [roworder, docRef, TRANS.REQUEST],
      )
    ).rows[0];
    if (!line) {
      await ods.query("rollback");
      await odg.query("rollback");
      return { error: "ບໍ່ພົບອາໄຫຼ່ໃນໃບຂໍເບີກ" };
    }

    // ກັນຂໍໂອນຊ້ຳ — ອາໄຫຼ່ແຖວດຽວກັນຂອງໃບຂໍເບີກໃບດຽວກັນ ຂໍໂອນໄດ້ເທື່ອດຽວ
    const already = await ods.query<{ count: number }>(
      `select count(*)::int count from ic_trans_detail
       where trans_flag=$1 and doc_ref=$2 and item_code=$3`,
      [TRANS.TRANSFER, docRef, line.item_code],
    );
    if (already.rows[0]?.count) {
      await ods.query("rollback");
      await odg.query("rollback");
      return { error: "ອາໄຫຼ່ລາຍການນີ້ຂໍໂອນໄປແລ້ວ" };
    }

    // ເລກຈາກ ODS ອາດຊ້ຳກັບໃບທີ່ລະບົບເກົ່າ (Flask) ອອກໄວ້ໃນ ERP ຂອງເດືອນນີ້ → ຂ້າມໄປເລກຖັດຈາກ ERP
    const prefix = docPrefix("SFRK", at);
    const odsSeq = Number((await nextDocNo(ods, "SFRK", at)).slice(prefix.length));
    const erpSeq = (
      await odg.query<{ seq: number }>(
        `select coalesce(max(substring(doc_no from $1::int)::int), 0) seq from ic_trans
         where doc_no like $2 and substring(doc_no from $1::int) ~ '^[0-9]+$'`,
        [prefix.length + 1, `${prefix}%`],
      )
    ).rows[0].seq;
    const docNo = `${prefix}${String(Math.max(odsSeq, erpSeq + 1)).padStart(4, "0")}`;
    transferNo = docNo;
    transferJob = ref.product_code ?? "";
    transferItem = line.item_name ?? line.item_code;

    // ── ODS: ຫົວບິນ + ລາຍລະອຽດ (ods ບໍ່ໄດ້ຂຽນລົງ ODS — ເບິ່ງໝາຍເຫດຂ້າງເທິງ)
    await ods.query(
      `insert into ic_trans(trans_flag, doc_date, doc_no, doc_ref, doc_ref_date, cust_code, product_code,
         remark, user_created, wh_code, shelf_code, status)
       values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [
        TRANS.TRANSFER, docDate, docNo, ref.doc_no, ref.doc_date, ref.cust_code, ref.product_code,
        remark, session.username, TRANSFER_TO_WH, TRANSFER_TO_SHELF, LINE_STATUS.PENDING,
      ],
    );
    await ods.query(
      `insert into ic_trans_detail(trans_flag, doc_date, doc_no, doc_ref, doc_ref_date, cust_code, product_code,
         item_code, item_name, qty, unit_code, calc_flag, user_created, status)
       values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,0,$12,$13)`,
      [
        TRANS.TRANSFER, docDate, docNo, ref.doc_no, ref.doc_date, ref.cust_code, ref.product_code,
        line.item_code, line.item_name, line.qty, line.unit_code, session.username, LINE_STATUS.PENDING,
      ],
    );

    // ໝາຍໃບຂໍເບີກວ່າ "ຂໍໂອນແລ້ວ" (ods: update ic_trans set used_status=4)
    await ods.query(`update ic_trans set used_status=$1 where doc_no=$2`, [TRANSFER_REQUESTED_STATUS, docRef]);

    // ── ERP (odg): ຫົວບິນ + ລາຍລະອຽດ (calc_flag=0 → ຍັງບໍ່ຕັດສະຕັອກ)
    await odg.query(
      `insert into ic_trans(trans_type, trans_flag, doc_no, doc_date, doc_ref, doc_ref_date, sale_code, doc_time,
         doc_format_code, wh_from, location_from, wh_to, location_to, creator_code, branch_code, remark)
       values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
      [
        ERP.TRANS_TYPE, TRANS.TRANSFER, docNo, docDate, ref.doc_no, ref.doc_date, ref.user_created, docTime,
        TRANSFER_FORMAT, TRANSFER_FROM_WH, TRANSFER_FROM_SHELF, TRANSFER_TO_WH, TRANSFER_TO_SHELF,
        session.username, branchOf(TRANSFER_TO_WH), remark,
      ],
    );
    await odg.query(
      `insert into ic_trans_detail(trans_type, trans_flag, doc_no, doc_date, doc_ref, item_code, item_name, unit_code,
         qty, wh_code, shelf_code, wh_code_2, shelf_code_2, stand_value, divide_value, doc_date_calc, doc_time_calc, calc_flag)
       values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,1,1,$14,$15,0)`,
      [
        ERP.TRANS_TYPE, TRANS.TRANSFER, docNo, docDate, ref.doc_no, line.item_code, line.item_name, line.unit_code,
        line.qty, TRANSFER_FROM_WH, TRANSFER_FROM_SHELF, TRANSFER_TO_WH, TRANSFER_TO_SHELF, docDate, docTime,
      ],
    );

    await odg.query("commit");
    await ods.query("commit");
  } catch (error) {
    await odg.query("rollback").catch(() => {});
    await ods.query("rollback").catch(() => {});
    console.error("saveTransferRequest failed", error);
    return { error: "ຂໍໂອນບໍ່ສຳເລັດ" };
  } finally {
    odg.release();
    ods.release();
  }

  if (transferJob) {
    // ສາງໃຫຍ່ຕ້ອງໂອນອາໄຫຼ່ເຂົ້າສາງສ້ອມ
    await logChange(
      jobModel(transferJob),
      transferJob,
      `ສ້າງໃບຂໍໂອນອາໄຫຼ່ຂ້າມສາງ ${transferNo}: ${transferItem} (ອ້າງອີງໃບຂໍເບີກ ${docRef})`,
      { roles: ROLE_WAREHOUSE },
    );
  }

  revalidatePath("/stock/dispatch");
  redirect("/stock/dispatch");
}

/* ─────────────────────────── ລາຍການອາໄຫຼ່ ─────────────────────────── */

/** ods: /loadspa — ດຶງອາໄຫຼ່ໃໝ່ຈາກ sparepart_list ເຂົ້າ ic_inventory */
export async function loadSpareParts(): Promise<void> {
  const session = await getSession();
  if (!session || !db) return;

  await db.query(
    `insert into ic_inventory(code, name_1, part_number, unit_code, group_main, group_sub2, item_brand)
     select code, name_1, name_eng_2, unit_cost, group_main, group_sub2, item_brand
     from sparepart_list where code not in (select code from ic_inventory)`,
  );
  revalidatePath("/stock/spare-parts");
}

/* ─────────────────────────── ຂໍສ້າງລະຫັດອາໄຫຼ່ (pp_od_manage) ─────────────────────────── */

/** ods: /save_newspare — newspare.py, ຖານ pp_od_manage */
export async function createSpareDraft(_: StockState, formData: FormData): Promise<StockState> {
  const session = await getSession();
  if (!session) return { error: "Session ໝົດອາຍຸ" };
  if (!ppDb) return { error: PP_NOT_CONFIGURED };

  const docDate = text(formData, "doc_date");
  const name = text(formData, "pro_name");
  const unitCode = text(formData, "unit_code");
  if (!name || !unitCode) return { error: "ກະລຸນາປ້ອນຊື່ອາໄຫຼ່ ແລະ ຫົວໜ່ວຍ" };

  const client = await ppDb.connect();
  let draftCode = "";
  try {
    await client.query("begin");
    await client.query("select pg_advisory_xact_lock($1)", [DOC_LOCK]);

    // ods ເອົາ max(code::int)+1 ຈາກໜ້າ GET ແລ້ວສົ່ງມາທາງ form → ຊ້ຳໄດ້.
    // ຢູ່ນີ້ອອກເລກໃນ transaction ເລີຍ.
    const next = await client.query<{ code: number }>(
      `select coalesce(max(code::int),0)+1 code from ods_spare_draft where code ~ '^[0-9]+$'`,
    );
    const code = String(next.rows[0].code);
    draftCode = code;

    await client.query(
      `insert into ods_spare_draft(doc_date, code, name_1, unit_code, status, user_created) values($1,$2,$3,$4,0,$5)`,
      [docDate || null, code, name, unitCode, session.username],
    );
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    console.error("createSpareDraft failed", error);
    return { error: "ບັນທຶກບໍ່ສຳເລັດ" };
  } finally {
    client.release();
  }

  // ຮ່າງນີ້ຢູ່ຄົນລະຖານ (pp_od_manage) ຈຶ່ງບໍ່ມີ chatter ຂອງມັນເອງ —
  // ແຈ້ງເຕືອນສາງໂດຍກົງແທນ (ods ຍິງ LINE Notify ຢູ່ຈຸດນີ້)
  await notify(
    "ods_spare_draft",
    draftCode,
    `ຂໍສ້າງລະຫັດອາໄຫຼ່ໃໝ່: ${name} (${unitCode})`,
    "log",
    { roles: ROLE_WAREHOUSE },
  );

  revalidatePath("/spare-parts/new");
  return { ok: "ສຳເລັດ" };
}
