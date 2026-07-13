"use server";

import { logChange } from "@/app/actions/chatter";
import { notify } from "@/app/actions/notification";
import { ROLE_WAREHOUSE } from "@/lib/chatter";
import { db, odgDb } from "@/lib/db";
import { docPrefix, nextDocNo } from "@/lib/doc-no";
import { deleteErpRequest, writeErpRequest } from "@/lib/erp-request";
import { requirePermissionOrRedirect, requireRole, requireRoleOrRedirect } from "@/lib/guard";
import { RETURN_SIDE, SERVICE_SIDE, STOCK_SIDE, TECH_SIDE } from "@/lib/roles";
import { getBalances } from "@/lib/stock-balance";
import { createSpareRequest, pickupSpares } from "@/lib/tech-flow";
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
  // ໃບຂໍເບີກ: ຊ່າງເປັນຄົນສ້າງ · ສາງເປັນຄົນຈ່າຍ (ເບິ່ງ lib/roles ແຖວ /stock/requests)
  await requireRoleOrRedirect(TECH_SIDE);
  if (!db) return;

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
  await requireRoleOrRedirect(TECH_SIDE);
  if (!db) return;

  const roworder = text(formData, "roworder");
  const rowId = text(formData, "row_id");
  const qty = Number(text(formData, "reg_qty"));
  if (!rowId || !Number.isFinite(qty) || qty <= 0) redirect(`/stock/requests/${roworder}`);

  await db.query(`update tb_used_spare set qty=$1 where roworder=$2`, [qty, rowId]);
  redirect(`/stock/requests/${roworder}`);
}

/** ods: /delete_itemfromreg — ລຶບອາໄຫຼ່ອອກຈາກໃບຂໍເບີກ */
export async function deleteSpareFromRequest(formData: FormData): Promise<void> {
  await requireRoleOrRedirect(TECH_SIDE);
  if (!db) return;

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
  const guard = await requireRole(TECH_SIDE, "ບໍ່ມີສິດສ້າງໃບຂໍເບີກອາໄຫຼ່");
  if (!guard.ok) return { error: guard.error };

  /**
   * ຕົວອອກເອກະສານຢູ່ lib/tech-flow ບ່ອນດຽວ — **ອັນດຽວກັບທີ່ແອັບມືຖືເອີ້ນ**.
   * ຂໍສະເພາະ "ຈຳນວນທີ່ຍັງຄ້າງ" (OUTSTANDING_SPARES) ⇒ ບໍ່ຂໍຊ້ຳຂອງທີ່ເບີກອອກໄປແລ້ວ
   * ເຊິ່ງເປັນບັກຂອງ ods ທີ່ພາໃຫ້ສາງຕັດສະຕັອກ ERP ອາໄຫຼ່ຕົວດຽວກັນສອງເທື່ອ.
   */
  const result = await createSpareRequest(guard.session, {
    code: text(formData, "Product_code"),
    remark: text(formData, "remark"),
    wh_code: text(formData, "wh_code"),
    shelf_code: text(formData, "shelf_code"),
  });
  if (!result.ok) return { error: result.error };

  redirect("/stock/requests");
}

/** ods: /del_request/<product_code>/<doc_no> — ຍົກເລີກໃບຂໍເບີກ */
export async function deleteRequest(formData: FormData): Promise<void> {
  await requirePermissionOrRedirect("/stock/requests", "delete", TECH_SIDE);
  if (!db) return;

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
    /**
     * ລຶບຢູ່ **ERP** ນຳ — ໃບຂໍເບີກຢູ່ທັງສອງຖານແລ້ວ (13-07-2026).
     * ລຶບແຕ່ ODS = ໃບກຳພ້າຄ້າງໃນ ERP ແລະ ສາງອາດເບີກຕາມໃບທີ່ຖືກລຶບໄປແລ້ວ.
     * ERP ເບີກໄປແລ້ວ ⇒ deleteErpRequest ໂຍນ error ⇒ ລຶບບໍ່ໄດ້ (ຖືກຕ້ອງ).
     */
    await deleteErpRequest(docNo);

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
/**
 * ── **ຖອດອອກແລ້ວ** ──
 * ນະໂຍບາຍ (13-07-2026): ລະບົບນີ້ **ອອກໃບເບີກເອງບໍ່ໄດ້ອີກ** — ສາງເບີກຢູ່ **ERP**
 * (ບ່ອນທີ່ສະຕັອກຈິງຢູ່). ODS ດຶງໃບເບີກກັບຄືນມາເອງ (lib/erp-dispatch) ແລ້ວເລື່ອນຂັ້ນງານ.
 * ເກັບຊື່ຟັງຊັນໄວ້ບອກເຫດຜົນ — action ຖືກຍິງໂດຍກົງໄດ້ ຈຶ່ງຕ້ອງປະຕິເສດຢູ່ server ບໍ່ແມ່ນເຊື່ອງປຸ່ມ.
 */
export async function saveDispatch(_: StockState): Promise<StockState> {
  return { error: "ລະບົບນີ້ອອກໃບເບີກບໍ່ໄດ້ອີກ — ສາງເບີກຢູ່ ERP ແລ້ວລະບົບຈະດຶງມາເອງ" };
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
  const guard = await requireRole(TECH_SIDE, "ບໍ່ມີສິດຮັບອາໄຫຼ່");
  if (!guard.ok) return { error: guard.error };

  // lib/tech-flow ບ່ອນດຽວ (ອອກໃບ PISP 166 ອ້າງອີງໃບເບີກ SWC + stamp pick_finish)
  const result = await pickupSpares(guard.session, text(formData, "doc_ref"), text(formData, "remark"));
  if (!result.ok) return { error: result.error };

  revalidatePath("/repair");
  revalidatePath("/stock/requests/pickup");
  redirect("/stock/requests/pickup");
}

/** ods: /update_stock_new — ດຶງຍອດຄົງເຫຼືອຈາກ view ມາອັບເດດ ic_inventory */
export async function refreshInventory(): Promise<void> {
  await requireRoleOrRedirect(STOCK_SIDE);
  if (!db) return;

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
  const session = await requireRoleOrRedirect(RETURN_SIDE);
  if (!db) return;

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
  const session = await requireRoleOrRedirect(RETURN_SIDE);
  if (!db) return;

  const rowId = text(formData, "row_id");
  const docNo = text(formData, "doc_no");
  if (rowId) {
    await db.query(`delete from ic_trans_detail_draft where roworder=$1 and user_created=$2`, [rowId, session.username]);
  }
  redirect(`/stock/returns/${encodeURIComponent(docNo)}`);
}

/** ods: /back_stock_return — ຖິ້ມແຖວຮ່າງທັງໝົດຂອງຜູ້ໃຊ້ ແລ້ວກັບຄືນ */
export async function cancelReturnRequest(): Promise<void> {
  const session = await requireRoleOrRedirect(RETURN_SIDE);
  if (!db) return;

  await db.query(`delete from ic_trans_detail_draft where trans_flag=$1 and user_created=$2`, [
    TRANS.DRAFT,
    session.username,
  ]);
  redirect("/stock/returns");
}

/** ods: /save_return_req — ບັນທຶກໃບຂໍສົ່ງຄືນຈາກແຖວຮ່າງ */
export async function saveReturnRequest(_: StockState, formData: FormData): Promise<StockState> {
  const guard = await requireRole(RETURN_SIDE, "ບໍ່ມີສິດສ້າງໃບຂໍສົ່ງຄືນອາໄຫຼ່");
  if (!guard.ok) return { error: guard.error };
  const session = guard.session;
  if (!db) return { error: "ບໍ່ພົບ DATABASE_URL" };

  const docRef = text(formData, "doc_ref");
  const docRefDate = text(formData, "doc_ref_date");
  const productCode = text(formData, "Product_code");
  const remark = text(formData, "remark");
  if (!docRef) return { error: "ບໍ່ພົບເລກທີໃບເບີກ" };

  if (!odgDb) return { error: "ບໍ່ພົບ ODG_DATABASE_URL" };

  const { date: docDate, at } = nowParts();
  const client = await db.connect();
  // ໃບຂໍສົ່ງຄືນລົງທັງ ODS ແລະ ERP — ERP ບໍ່ຮັບ = ບໍ່ບັນທຶກເລີຍ (ຄືໃບຂໍເບີກ)
  const odgReturn = await odgDb.connect();
  let returnNo = "";
  let returnLines = 0;
  try {
    await client.query("begin");
    await odgReturn.query("begin");
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

    /*
     * BUG ທີ່ແກ້ຢູ່ນີ້ (ods ກໍ່ເປັນ): ບ່ອນນີ້ ods ຂຽນ `update tb_product set spare_reg=now()`.
     * spare_reg = "ເວລາທີ່ຊ່າງຂໍເບີກອາໄຫຼ່" ເຊິ່ງເປັນໂມງຈັບເວລາ (SLA) ຂອງໜ້າ /stock/dispatch,
     * /stock/requests ແລະ ເປັນເງື່ອນໄຂຂອງຂັ້ນວຽກ (lib/stage: spare_reg is null → ຂັ້ນ 5).
     * ການ "ຂໍສົ່ງອາໄຫຼ່ຄືນ" ຈຶ່ງໄປຕັ້ງໂມງ SLA ຄືນໃໝ່ ແລະ ຍ້າຍຂັ້ນຂອງວຽກໄດ້ —
     * ຂໍ້ມູນຈິງ: 40 ວຽກມີ spare_reg ຕົງກັບເວລາອອກໃບຂໍສົ່ງຄືນ (ບາງວຽກ spare_reg > spare_finish
     * ເຊິ່ງເປັນໄປບໍ່ໄດ້ຕາມທຳມະຊາດ). ໃບຂໍສົ່ງຄືນມີໂມງຂອງມັນເອງຢູ່ແລ້ວ
     * (ic_trans.create_date_time_now default now() — 84/84 ແຖວມີຄ່າ, ໜ້າ /stock/receive-returns
     * ໃຊ້ຖັນນີ້ນັບ "ຄ້າງມາ") ⇒ ບໍ່ຕ້ອງ stamp ຫຍັງລົງ tb_product ອີກ.
     */

    /**
     * ── ໃບ**ຂໍສົ່ງຄືນ** ລົງ ERP ນຳ (13-07-2026) ──
     * ຫຼັກການດຽວກັບໃບຂໍເບີກ: "ຄຳຂໍ" ຢູ່ທັງສອງຖານ ⇒ ສາງທີ່ເຮັດວຽກໃນ ERP ເຫັນວ່າ
     * ມີອາໄຫຼ່ຈະສົ່ງຄືນ ແລ້ວຮັບຄືນ (ໃບ 58) ຢູ່ ERP. ERP ບໍ່ຮັບ ⇒ rollback ທັງສອງ.
     */
    const returnLinesForErp = await client.query<{
      item_code: string; item_name: string | null; unit_code: string | null; qty: string;
    }>(
      "select item_code, item_name, unit_code, qty::text as qty from ic_trans_detail where doc_no=$1 and trans_flag=$2",
      [docNo, TRANS.RETURN_REQUEST],
    );
    await writeErpRequest(
      {
        trans_flag: TRANS.RETURN_REQUEST,
        format: ERP.FORMAT_RETURN,
        doc_no: docNo,
        doc_date: docDate,
        // ໂມງ:ນາທີ ຕາມເຂດເວລາລາວ (ບໍ່ແມ່ນເວລາເຄື່ອງແມ່ຂ່າຍ)
        doc_time: new Intl.DateTimeFormat("en-GB", {
          timeZone: "Asia/Bangkok", hour: "2-digit", minute: "2-digit", hour12: false,
        }).format(new Date()),
        job_code: productCode,
        wh_code: RETURN_WH,
        shelf_code: RETURN_SHELF,
        remark: remark || `ສົ່ງຄືນຕາມໃບເບີກ ${docRef}`,
        requester: session.username,
        lines: returnLinesForErp.rows,
      },
      odgReturn,
    );

    // ods ລຶບແຖວຮ່າງໃນ route ຕ່າງຫາກ (/back_stock_return) — ຢູ່ນີ້ລຶບໃນ transaction ດຽວກັນ
    await client.query(`delete from ic_trans_detail_draft where trans_flag=$1 and user_created=$2`, [
      TRANS.DRAFT,
      session.username,
    ]);

    await client.query("commit");
    await odgReturn.query("commit");
  } catch (error) {
    await client.query("rollback").catch(() => {});
    await odgReturn.query("rollback").catch(() => {});
    console.error("saveReturnRequest failed", error);
    return { error: "ບັນທຶກບໍ່ສຳເລັດ — ERP ບໍ່ຮັບໃບຂໍສົ່ງຄືນນີ້ (ບໍ່ໄດ້ບັນທຶກຫຍັງເລີຍ)" };
  } finally {
    client.release();
    odgReturn.release();
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
/**
 * ── **ຖອດອອກແລ້ວ** (13-07-2026) ──
 * ໃບ**ຮັບຄືນ** (58) ຍ້າຍສະຕັອກຈິງ ⇒ ຕ້ອງອອກຢູ່ **ERP** ຄືກັບໃບເບີກ (56).
 * ODS ດຶງມາເອງ (lib/erp-dispatch → syncErpReturns) ແລ້ວປິດໃບຂໍສົ່ງຄືນໃຫ້.
 */
export async function saveReceiveReturn(_: StockState): Promise<StockState> {
  return { error: "ລະບົບນີ້ອອກໃບຮັບຄືນບໍ່ໄດ້ອີກ — ສາງຮັບຄືນຢູ່ ERP ແລ້ວລະບົບຈະດຶງມາເອງ" };
}
/* ─────────────────────────── ຂໍໂອນອາໄຫຼ່ຂ້າມສາງ (trans_flag 124) ─────────────────────────── */

/**
 * ສາງຕົ້ນທາງຂອງໃບຂໍໂອນ — ods ຝັງໄວ້ຕາຍຕົວ (ສາງອາໄຫຼ່ໃຫຍ່ 1204). ຢູ່ນີ້ຕັ້ງຊື່ໃຫ້ ບໍ່ໄດ້ປ່ຽນຄ່າ.
 *
 * ສາງ **ປາຍທາງ** ບໍ່ຝັງຕາຍຕົວອີກແລ້ວ: ods ໂອນເຂົ້າ 1103 ສະເໝີ ແຕ່ໜ້າ /stock/dispatch
 * ເບີກຈາກ **ສາງຂອງໃບຂໍເບີກ** (ic_trans.wh_code — ຂໍ້ມູນຈິງມີ 1206: 677 ໃບ, 1204: 528,
 * 1203: 192, 1104: 27) ⇒ ຖ້າໃບຂໍເບີກຢູ່ສາງ 1206 ແລ້ວໂອນຂອງເຂົ້າ 1103 ຂອງກໍ່ໄປຜິດສາງ
 * ແລະ ເບີກບໍ່ໄດ້ຕະຫຼອດໄປ. ດຽວນີ້ປາຍທາງ = ສາງຂອງໃບຂໍເບີກ (ບໍ່ໄດ້ລະບຸ → 1103 ຄືເກົ່າ).
 */
const TRANSFER_FROM_WH = "1204";
const TRANSFER_FROM_SHELF = "120401";
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

const receiveTransferSchema = z.object({
  /** ເລກທີໃບຂໍໂອນ (SFRK) */
  doc_no: z.string().min(1),
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
  const guard = await requireRole(STOCK_SIDE, "ບໍ່ມີສິດຂໍໂອນອາໄຫຼ່");
  if (!guard.ok) return { error: guard.error };
  const session = guard.session;
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
      wh_code: string | null;
      shelf_code: string | null;
    }>(
      `select doc_no, doc_date, user_created, cust_code, product_code, wh_code, shelf_code
       from ic_trans where doc_no=$1 and trans_flag=$2 limit 1`,
      [docRef, TRANS.REQUEST],
    );
    const ref = head.rows[0];
    if (!ref) {
      await ods.query("rollback");
      await odg.query("rollback");
      return { error: "ບໍ່ພົບໃບຂໍເບີກ" };
    }
    // ປາຍທາງ = ສາງທີ່ໃບຂໍເບີກຈະເບີກອອກ (saveDispatch ໃຊ້ສາງນີ້) ⇒ ຂອງໂອນມາຮອດແລ້ວເບີກໄດ້ທັນທີ
    const toWh = ref.wh_code || DEFAULT_WH;
    const toShelf = ref.shelf_code || DEFAULT_SHELF;

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

    /*
     * ກັນຂໍໂອນຊ້ຳ — ນັບສະເພາະໃບຂໍໂອນທີ່ **ຍັງບໍ່ທັນຮັບຂອງ** (head.status = 0).
     * ໃບທີ່ຮັບຂອງແລ້ວບໍ່ຄວນລັອກໄວ້ຕະຫຼອດ: ຖ້າຂອງທີ່ໂອນມາຖືກເບີກໄປໃຫ້ວຽກອື່ນກ່ອນ
     * ສາງຕ້ອງຂໍໂອນໃໝ່ໄດ້ອີກ.
     */
    const already = await ods.query<{ count: number }>(
      `select count(*)::int count from ic_trans_detail d
       join ic_trans t on t.doc_no = d.doc_no and t.trans_flag = d.trans_flag
       where d.trans_flag=$1 and d.doc_ref=$2 and d.item_code=$3 and coalesce(t.status,0) = $4`,
      [TRANS.TRANSFER, docRef, line.item_code, LINE_STATUS.PENDING],
    );
    if (already.rows[0]?.count) {
      await ods.query("rollback");
      await odg.query("rollback");
      return { error: "ອາໄຫຼ່ລາຍການນີ້ຂໍໂອນໄປແລ້ວ ແລະ ຍັງລໍຖ້າຂອງມາຮອດ" };
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
        remark, session.username, toWh, toShelf, LINE_STATUS.PENDING,
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
        TRANSFER_FORMAT, TRANSFER_FROM_WH, TRANSFER_FROM_SHELF, toWh, toShelf,
        session.username, branchOf(toWh), remark,
      ],
    );
    await odg.query(
      `insert into ic_trans_detail(trans_type, trans_flag, doc_no, doc_date, doc_ref, item_code, item_name, unit_code,
         qty, wh_code, shelf_code, wh_code_2, shelf_code_2, stand_value, divide_value, doc_date_calc, doc_time_calc, calc_flag)
       values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,1,1,$14,$15,0)`,
      [
        ERP.TRANS_TYPE, TRANS.TRANSFER, docNo, docDate, ref.doc_no, line.item_code, line.item_name, line.unit_code,
        line.qty, TRANSFER_FROM_WH, TRANSFER_FROM_SHELF, toWh, toShelf, docDate, docTime,
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
  revalidatePath("/stock/transfers");
  redirect("/stock/dispatch");
}

/**
 * ຮັບຂອງທີ່ໂອນມາ — ປິດໃບຂໍໂອນ (124) ແລ້ວປ່ອຍແຖວກັບເຂົ້າຄິວເບີກ.
 *
 * ── ເປັນຫຍັງບໍ່ຕັດ/ບວກສະຕັອກຢູ່ຂັ້ນນີ້ ──
 * ໃບ trans_flag 124 ເປັນ "ໃບຂໍໂອນ" ບໍ່ແມ່ນ "ໃບໂອນ". ໃນ ERP (SML):
 *   • 124 (doc_format FR/IO) — calc_flag = 0 ທຸກແຖວ (45,364/45,364 ແຖວ) ແລະ trans_flag 124
 *     **ບໍ່ຢູ່ໃນລາຍການທຸງທີ່ຟັງຊັນຄິດຍອດ (sml_ic_function_stock_balance_warehouse_location)
 *     ນັບເລີຍ** ⇒ ໃບນີ້ບໍ່ຂະຫຍັບສະຕັອກແມ່ນແຕ່ໜ່ວຍດຽວ ບໍ່ວ່າຈະຂຽນຫຍັງລົງໄປ.
 *   • ການໂອນຈິງເກີດຕອນ ERP ອອກໃບໂອນ (doc_format FT): ຄູ່ trans_flag 72 (calc_flag -1,
 *     ສາງຕົ້ນທາງ) + 70 (calc_flag +1, ສາງປາຍທາງ) ໂດຍ doc_ref ຊີ້ກັບມາໃບ 124.
 * ⇒ ແອັບນີ້ຕ້ອງ **ບໍ່** ສ້າງການເຄື່ອນໄຫວສະຕັອກເອງ (ຈະກາຍເປັນນັບສອງເທື່ອ). ຂັ້ນນີ້ຈຶ່ງເປັນ
 * ການ "ຢືນຢັນວ່າຂອງມາຮອດແລ້ວ" ເທົ່ານັ້ນ ແລະ ຢືນຢັນໄດ້ກໍ່ຕໍ່ເມື່ອ ERP ອອກໃບໂອນ (FT) ແລ້ວຈິງ —
 * ກວດດ້ວຍຍອດຄົງເຫຼືອຂອງ ERP ໃນສາງປາຍທາງ (ເງື່ອນໄຂດຽວກັນກັບທີ່ saveDispatch ໃຊ້ຕອນເບີກ)
 * ຈຶ່ງບໍ່ມີທາງທີ່ຈະ "ປິດ" ໃບຂໍໂອນທີ່ຂອງຍັງບໍ່ມາ ແລ້ວແຖວກັບໄປຄ້າງຢູ່ຄິວເບີກຄືເກົ່າ.
 */
export async function saveReceiveTransfer(_: StockState, formData: FormData): Promise<StockState> {
  const guard = await requireRole(STOCK_SIDE, "ບໍ່ມີສິດຢືນຢັນການຮັບໂອນ");
  if (!guard.ok) return { error: guard.error };
  if (!db) return { error: "ບໍ່ພົບ DATABASE_URL" };

  const parsed = receiveTransferSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "ຂໍ້ມູນບໍ່ຄົບ" };
  const { doc_no: docNo, remark } = parsed.data;

  const client = await db.connect();
  let productCode = "";
  let docRef = "";
  let itemNames = "";
  let lineCount = 0;
  try {
    const head = (
      await client.query<{
        doc_no: string;
        doc_ref: string | null;
        product_code: string | null;
        wh_code: string | null;
        status: number | null;
      }>(`select doc_no, doc_ref, product_code, wh_code, status from ic_trans where doc_no=$1 and trans_flag=$2 limit 1`, [
        docNo,
        TRANS.TRANSFER,
      ])
    ).rows[0];
    if (!head) return { error: "ບໍ່ພົບໃບຂໍໂອນ" };
    if ((head.status ?? 0) === LINE_STATUS.ISSUED) return { error: "ໃບນີ້ຮັບຂອງໄປແລ້ວ" };
    productCode = head.product_code ?? "";
    docRef = head.doc_ref ?? "";
    const toWh = head.wh_code || DEFAULT_WH;

    const lines = (
      await client.query<{ item_code: string; item_name: string | null; qty: string }>(
        `select item_code, item_name, qty from ic_trans_detail where doc_no=$1 and trans_flag=$2 order by roworder`,
        [docNo, TRANS.TRANSFER],
      )
    ).rows;
    if (lines.length === 0) return { error: "ບໍ່ມີອາໄຫຼ່ໃນໃບນີ້" };
    lineCount = lines.length;
    itemNames = lines.map((line) => line.item_name ?? line.item_code).join(", ");

    // ຂອງມາຮອດແທ້ບໍ? — ຖາມຍອດ ERP ໃນສາງປາຍທາງ (ອ່ານຢ່າງດຽວ ບໍ່ຂຽນຫຍັງລົງ ERP)
    const balances = await getBalances(lines.map((line) => line.item_code));
    const missing = lines.filter(
      (line) => (balances.get(line.item_code)?.byWarehouse.get(toWh) ?? 0) <= 0,
    );
    if (missing.length > 0) {
      return {
        error:
          `ຍັງບໍ່ເຫັນຍອດຂອງ ${missing.map((line) => line.item_name ?? line.item_code).join(", ")} ໃນສາງ ${toWh} — ` +
          `ສາງໃຫຍ່ຕ້ອງອອກໃບໂອນ (FT) ໃນ ERP ກ່ອນ ຈຶ່ງຈະຮັບຂອງໄດ້`,
      };
    }

    await client.query("begin");
    // ປິດໃບຂໍໂອນ (ຫົວ + ລາຍລະອຽດ) — ບໍ່ແຕະ ic_inventory ແລະ ບໍ່ຂຽນ ERP
    await client.query(`update ic_trans set status=$1, remark_2=$2 where doc_no=$3 and trans_flag=$4`, [
      LINE_STATUS.ISSUED,
      remark || null,
      docNo,
      TRANS.TRANSFER,
    ]);
    await client.query(`update ic_trans_detail set status=$1 where doc_no=$2 and trans_flag=$3`, [
      LINE_STATUS.ISSUED,
      docNo,
      TRANS.TRANSFER,
    ]);
    // ໃບຂໍເບີກບໍ່ຄ້າງຢູ່ສະຖານະ "ຂໍໂອນແລ້ວ" ອີກ ຖ້າບໍ່ມີໃບຂໍໂອນອື່ນຂອງມັນທີ່ຍັງລໍຖ້າຢູ່
    if (docRef) {
      await client.query(
        `update ic_trans set used_status=0
         where doc_no=$1 and trans_flag=$2
           and not exists (select 1 from ic_trans t
                           where t.trans_flag=$3 and t.doc_ref=$1 and coalesce(t.status,0)=$4)`,
        [docRef, TRANS.REQUEST, TRANS.TRANSFER, LINE_STATUS.PENDING],
      );
    }
    await client.query("commit");
  } catch (error) {
    await client.query("rollback").catch(() => {});
    console.error("saveReceiveTransfer failed", error);
    return { error: "ບັນທຶກບໍ່ສຳເລັດ" };
  } finally {
    client.release();
  }

  if (productCode) {
    // ຂອງມາຮອດແລ້ວ — ສາງເບີກໃຫ້ວຽກນີ້ໄດ້ແລ້ວ
    await logChange(
      jobModel(productCode),
      productCode,
      `ຮັບຂອງທີ່ໂອນມາ ${docNo} · ${lineCount} ລາຍການ (${itemNames})${docRef ? ` (ອ້າງອີງໃບຂໍເບີກ ${docRef})` : ""}${
        remark ? ` · ${remark}` : ""
      }`,
      { roles: ROLE_WAREHOUSE },
    );
  } else {
    await notify("ic_trans", docNo, `ຮັບຂອງທີ່ໂອນມາ ${docNo} · ${lineCount} ລາຍການ`, "log", { roles: ROLE_WAREHOUSE });
  }

  revalidatePath("/stock/transfers");
  revalidatePath("/stock/dispatch");
  redirect("/stock/transfers");
}

/* ─────────────────────────── ລາຍການອາໄຫຼ່ ─────────────────────────── */

/** ods: /loadspa — ດຶງອາໄຫຼ່ໃໝ່ຈາກ sparepart_list ເຂົ້າ ic_inventory */
export async function loadSpareParts(): Promise<void> {
  await requireRoleOrRedirect(STOCK_SIDE);
  if (!db) return;

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
  // ຕົງກັບກົດ /spare-parts/new ໃນ lib/roles: ຜູ້ຈັດການ · CS · ສາງ
  const guard = await requireRole([...SERVICE_SIDE, "stock"], "ບໍ່ມີສິດຂໍສ້າງລະຫັດອາໄຫຼ່");
  if (!guard.ok) return { error: guard.error };
  const session = guard.session;
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
