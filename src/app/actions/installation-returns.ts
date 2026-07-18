"use server";
import { logChange } from "@/lib/chatter-log";
import type { ActionState } from "@/app/actions/installation";
import { ROLE_WAREHOUSE } from "@/lib/chatter";
import { db, odgDb } from "@/lib/db";
import { nextDocNo } from "@/lib/doc-no";
import { requireRole, requireRoleOrRedirect } from "@/lib/guard";
import { RETURN_SIDE, STOCK_SIDE } from "@/lib/roles";
import {
  CALC_IN,
  CALC_OUT,
  ERP,
  LINE_STATUS,
  RETURN_SHELF,
  RETURN_WH,
  TRANS,
  branchOf,
} from "@/lib/stock-constants";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

/* ─────────────────────────────────────────────────────────────
   ສົ່ງຄືນອາໄຫຼ່ຂອງ "ງານຕິດຕັ້ງ" (job_type = 'install')
   ຖອດແບບຈາກ ods/tech_install.py:
     /return_req_check_inst/<doc_no>   → startInstallReturnRequest
     /show_return_req_inst/<doc_no>    → ໜ້າ /installations/spare-returns/[docNo]
     /not_choose_req_inst/<id>/<doc>   → removeInstallReturnLine
     /save_return_req_inst             → saveInstallReturnRequest  (SRI, trans_flag 59)
     /show_return_inst/<doc_no>        → ໜ້າ /installations/spare-returns/receive/[docNo]
                                         + saveInstallReceiveReturn (SRT, trans_flag 58)

   ຄວາມແຕກຕ່າງທີ່ຕັ້ງໃຈ (ບໍ່ໄດ້ລອກ bug ຂອງ ods):
    • ods ອອກເລກເອກະສານດ້ວຍ max()+1 ຢູ່ໜ້າ GET ແລ້ວສົ່ງມາທາງ form → ສອງຄົນກົດພ້ອມກັນໄດ້ເລກຊ້ຳ.
      ຢູ່ນີ້ອອກເລກຢູ່ຝັ່ງ server ພາຍໃນ transaction ທີ່ຖື pg_advisory_xact_lock()
      (ໃຊ້ lock ດຽວກັບ src/app/actions/stock.ts ເພາະແບ່ງເລກ SRI/SRT ຊຸດດຽວກັນກັບຝັ່ງສ້ອມ).
    • ods ເກັບ doc_ref / cust_code ໄວ້ໃນ Flask session ລະຫວ່າງ GET ກັບ POST → ເປີດສອງແທັບແລ້ວຂໍ້ມູນຂ້າມກັນ.
      ຢູ່ນີ້ສົ່ງຜ່ານ hidden field ແທນ.
    • ods ຂຽນ `update tb_product set spare_reg=...` ດ້ວຍລະຫັດ INST-xxxx ເຊິ່ງບໍ່ມີໃນ tb_product
      (ງານຕິດຕັ້ງຢູ່ຕາຕະລາງ ods_tb_install ແລະ ຕາຕະລາງນັ້ນກໍ່ບໍ່ມີຖັນ spare_reg) → ເປັນ no-op. ຕັດອອກ.
    • ods ບໍ່ກັນການບັນທຶກຊ້ຳ — ໃບເບີກໜຶ່ງໃບຂໍສົ່ງຄືນໄດ້ຫຼາຍເທື່ອ. ຢູ່ນີ້ກວດກ່ອນ.
   ───────────────────────────────────────────────────────────── */

/** ລັອກຕອນອອກເລກເອກະສານ — ຄ່າດຽວກັບ DOC_LOCK ໃນ actions/stock.ts (SRI/SRT ໃຊ້ຊຸດເລກຮ່ວມກັນ) */
const DOC_LOCK = 734211;

const RETURN_PATHS = ["/stock/returns", "/stock/receive-returns"];

function revalidateReturns() {
  for (const path of RETURN_PATHS) revalidatePath(path);
}

/**
 * ໃບຂໍສົ່ງຄືນສ້າງໄດ້ໂດຍ: ຊ່າງ (ຄົນເບີກ), ສາງ (ຄົນຮັບຄືນ) ແລະ **CS**
 * — ປ້າຍເຕືອນ "ອາໄຫຼ່ຂອງງານທີ່ຍົກເລີກ" ຢູ່ໜ້າ /installations ເປັນໜ້າຂອງ CS.
 * ເບິ່ງ RETURN_SIDE ໃນ lib/roles.
 */
async function requireSession() {
  return requireRoleOrRedirect(RETURN_SIDE);
}

function draftPath(docNo: string) {
  return `/installations/spare-returns/${encodeURIComponent(docNo)}`;
}

/* ── ເປີດ/ສ້າງໃບຮ່າງ (return_req_check_inst) ──────────────── */

const startSchema = z.object({ doc_no: z.string().min(1) });

/**
 * ກ໋ອບແຖວອາໄຫຼ່ຂອງໃບເບີກ SWC ມາເປັນແຖວຮ່າງ (ic_trans_detail_draft, trans_flag 33)
 * ແລ້ວເປີດໜ້າຂໍສົ່ງຄືນ. ຖ້າມີແຖວຮ່າງຂອງຜູ້ໃຊ້ນີ້ຢູ່ແລ້ວກໍ່ຂ້າມການກ໋ອບ (ຄືກັບ ods).
 *
 * BUG ທີ່ແກ້ຢູ່ນີ້ (B5): ods (ແລະ ສະບັບກ່ອນໜ້າ) ກ໋ອບສະເພາະແຖວ status=1 (ຊ່າງຮັບແລ້ວ — PISP).
 * ແຕ່ສະຕັອກຖືກຕັດອອກຕັ້ງແຕ່ **ສາງເບີກ (56)** ບໍ່ແມ່ນຕອນຊ່າງມາຮັບ ⇒ ແຖວ status=0
 * (ຈ່າຍອອກແລ້ວ ຊ່າງຍັງບໍ່ມາຮັບ) ກໍ່ຢູ່ນອກສາງຄືກັນ ແລະ ຕ້ອງສົ່ງຄືນໄດ້.
 * ຂໍ້ມູນຈິງຂອງ 3 ງານທີ່ຍົກເລີກ: 36 ແຖວຄ້າງ = status 0 ຈຳນວນ 33 ແຖວ + status 1 ພຽງ 3 ແຖວ
 * ⇒ ຖ້າກ໋ອບແຕ່ status=1 ໜ້າຂໍສົ່ງຄືນຈະຫວ່າງເປົ່າ ແລະ ອາໄຫຼ່ 33 ແຖວຄືນສາງບໍ່ໄດ້ຈັກເທື່ອ.
 * ດຽວນີ້ກ໋ອບ status ∈ (0,1) — ຕົງກັບນິຍາມ "ຄ້າງນອກສາງ" ໃນ lib/outstanding-spares.
 */
export async function startInstallReturnRequest(formData: FormData): Promise<void> {
  const session = await requireSession();
  if (!db) return;

  const parsed = startSchema.safeParse({ doc_no: formData.get("doc_no") });
  if (!parsed.success) redirect("/stock/returns?job=install");
  const docNo = parsed.data.doc_no;

  // ກັນທີ່ server ອີກຊັ້ນ: ເຊື່ອມໃບເບີກກັບງານຈິງ ແລະ ບໍ່ອະນຸຍາດຖ້າຕິດຕັ້ງສຳເລັດແລ້ວ.
  const returnable = await db.query<{ count: number }>(
    `select count(*)::int count
       from ic_trans d
       join ods_tb_install i on i.code = d.product_code
      where d.doc_no=$1 and d.trans_flag=$2 and d.job_type='install' and i.finish_install is null`,
    [docNo, TRANS.DISPATCH],
  );
  if (!returnable.rows[0]?.count) redirect("/stock/returns?job=install");

  // ods ບໍ່ກວດ — ໃບເບີກທີ່ຂໍສົ່ງຄືນແລ້ວກົດຊ້ຳໄດ້ອີກ
  const requested = await db.query<{ count: number }>(
    "select count(*)::int count from ic_trans where trans_flag=$1 and doc_ref=$2",
    [TRANS.RETURN_REQUEST, docNo],
  );
  if (requested.rows[0]?.count) redirect("/stock/returns?job=install");

  const existing = await db.query<{ count: number }>(
    "select count(*)::int count from ic_trans_detail_draft where doc_no=$1 and trans_flag=$2 and user_created=$3",
    [docNo, TRANS.DRAFT, session.username],
  );
  if (!existing.rows[0]?.count) {
    await db.query(
      `insert into ic_trans_detail_draft(doc_no,product_code,item_code,item_name,qty,unit_code,row_ref,user_created,trans_flag)
       select doc_no,product_code,item_code,item_name,qty,unit_code,roworder,$1,$2
       from ic_trans_detail
       where doc_no=$3 and trans_flag=$4 and status = any($5::int[]) order by roworder asc`,
      [session.username, TRANS.DRAFT, docNo, TRANS.DISPATCH, [LINE_STATUS.PENDING, LINE_STATUS.ISSUED]],
    );
  }
  redirect(draftPath(docNo));
}

/* ── ແກ້ໄຂແຖວຮ່າງ ────────────────────────────────────────── */

/**
 * ແກ້ຈຳນວນທີ່ຈະສົ່ງຄືນ — ods ບໍ່ມີ (ສົ່ງຄືນໄດ້ແຕ່ຈຳນວນເຕັມ ຫຼື ຖິ້ມແຖວ).
 * ຈຳກັດບໍ່ໃຫ້ເກີນຈຳນວນທີ່ເບີກອອກໄປຈິງ (ອີງຕາມ row_ref → ic_trans_detail).
 */
export async function updateInstallReturnQty(docNo: string, roworder: number, qty: number): Promise<ActionState> {
  const session = await requireSession();
  if (!db) return { error: "ບໍ່ພົບ DATABASE_URL" };
  if (!Number.isFinite(qty) || qty <= 0) return { error: "ຈຳນວນບໍ່ຖືກຕ້ອງ" };

  const line = await db.query<{ max_qty: string | null }>(
    `select d.qty max_qty from ic_trans_detail_draft dr
     left join ic_trans_detail d on d.roworder = dr.row_ref
     where dr.roworder=$1 and dr.user_created=$2 and dr.trans_flag=$3`,
    [roworder, session.username, TRANS.DRAFT],
  );
  if (line.rowCount === 0) return { error: "ບໍ່ພົບລາຍການ" };

  const maxQty = Number(line.rows[0].max_qty ?? qty);
  if (qty > maxQty) return { error: `ສົ່ງຄືນໄດ້ບໍ່ເກີນ ${maxQty}` };

  await db.query("update ic_trans_detail_draft set qty=round($1,2) where roworder=$2 and user_created=$3", [
    qty,
    roworder,
    session.username,
  ]);
  revalidatePath(draftPath(docNo));
  return { ok: "ສຳເລັດ" };
}

/** ods: /not_choose_req_inst — ຖິ້ມອາໄຫຼ່ແຖວນຶ່ງອອກຈາກໃບຂໍສົ່ງຄືນ */
export async function removeInstallReturnLine(docNo: string, roworder: number): Promise<ActionState> {
  const session = await requireSession();
  if (!db) return { error: "ບໍ່ພົບ DATABASE_URL" };

  // ods ລຶບດ້ວຍ roworder ຢ່າງດຽວ → ລຶບແຖວຮ່າງຂອງຄົນອື່ນໄດ້. ຢູ່ນີ້ຜູກກັບຜູ້ໃຊ້ນຳ.
  await db.query("delete from ic_trans_detail_draft where roworder=$1 and user_created=$2 and trans_flag=$3", [
    roworder,
    session.username,
    TRANS.DRAFT,
  ]);
  revalidatePath(draftPath(docNo));
  return { ok: "ສຳເລັດ" };
}

/** ປຸ່ມ "ອອກ" — ຖິ້ມແຖວຮ່າງທັງໝົດຂອງຜູ້ໃຊ້ ແລ້ວກັບຄືນ (ods: /back_stock_return) */
export async function cancelInstallReturnRequest(): Promise<void> {
  const session = await requireSession();
  if (db) {
    await db.query("delete from ic_trans_detail_draft where trans_flag=$1 and user_created=$2", [
      TRANS.DRAFT,
      session.username,
    ]);
  }
  redirect("/stock/returns?job=install");
}

/* ── ບັນທຶກໃບຂໍສົ່ງຄືນ SRI (save_return_req_inst) ─────────── */

const saveRequestSchema = z.object({
  doc_ref: z.string().min(1),
  product_code: z.string().min(1),
  doc_date: z.string().min(1),
  remark: z.string(),
});

export async function saveInstallReturnRequest(_: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireSession();
  if (!db) return { error: "ບໍ່ພົບ DATABASE_URL" };

  const parsed = saveRequestSchema.safeParse({
    doc_ref: formData.get("doc_ref"),
    product_code: formData.get("product_code"),
    doc_date: formData.get("doc_date"),
    remark: formData.get("remark") ?? "",
  });
  if (!parsed.success) return { error: "ຂໍ້ມູນບໍ່ຄົບ" };
  const { doc_ref: docRef, product_code: productCode, doc_date: docDate, remark } = parsed.data;

  const client = await db.connect();
  let returnNo = "";
  let returnLines = 0;
  try {
    await client.query("begin");
    await client.query("select pg_advisory_xact_lock($1)", [DOC_LOCK]);

    const already = await client.query<{ count: number }>(
      "select count(*)::int count from ic_trans where trans_flag=$1 and doc_ref=$2",
      [TRANS.RETURN_REQUEST, docRef],
    );
    if (already.rows[0]?.count) {
      await client.query("rollback");
      return { error: "ໃບເບີກນີ້ຂໍສົ່ງຄືນແລ້ວ" };
    }

    const returnable = await client.query<{ code: string }>(
      `select i.code
         from ic_trans d
         join ods_tb_install i on i.code = d.product_code
        where d.doc_no=$1 and d.trans_flag=$2 and d.job_type='install'
          and i.code=$3 and i.finish_install is null
        limit 1 for update of i`,
      [docRef, TRANS.DISPATCH, productCode],
    );
    if (!returnable.rowCount) {
      await client.query("rollback");
      return { error: "ງານນີ້ຕິດຕັ້ງສຳເລັດແລ້ວ — ບໍ່ຕ້ອງສົ່ງຄືນອາໄຫຼ່" };
    }

    // ວັນທີໃບເບີກ — ods ສົ່ງມາທາງ hidden field (ແກ້ໄດ້ຈາກ browser). ຢູ່ນີ້ອ່ານຈາກຖານຂໍ້ມູນເອງ.
    const swc = await client.query<{ doc_ref_date: string | null }>(
      "select to_char(doc_date,'YYYY-MM-DD') doc_ref_date from ic_trans where doc_no=$1 and trans_flag=$2 limit 1",
      [docRef, TRANS.DISPATCH],
    );
    const docRefDate = swc.rows[0]?.doc_ref_date ?? null;

    const draft = await client.query<{ row_ref: number }>(
      "select row_ref from ic_trans_detail_draft where trans_flag=$1 and doc_no=$2 and user_created=$3",
      [TRANS.DRAFT, docRef, session.username],
    );
    if (draft.rowCount === 0) {
      await client.query("rollback");
      return { error: "ຍັງບໍ່ມີອາໄຫຼ່ໃນລາຍການ" };
    }
    const rowRefs = draft.rows.map((row) => row.row_ref);

    const docNo = await nextDocNo(client, "SRI");
    returnNo = docNo;
    returnLines = rowRefs.length;

    await client.query(
      `insert into ic_trans(trans_flag,doc_date,doc_no,doc_ref,doc_ref_date,product_code,remark,user_created,status,job_type)
       values($1,$2,$3,$4,$5,$6,$7,$8,$9,'install')`,
      [
        TRANS.RETURN_REQUEST, docDate, docNo, docRef, docRefDate, productCode, remark, session.username,
        LINE_STATUS.RETURN_REQUESTED,
      ],
    );
    await client.query(
      `insert into ic_trans_detail(trans_flag,doc_date,doc_no,doc_ref,doc_ref_date,product_code,item_code,item_name,
         qty,unit_code,calc_flag,user_created,status,job_type)
       select $1,$2,$3,$4,$5,product_code,item_code,item_name,qty,unit_code,$6,$7,$8,'install'
       from ic_trans_detail_draft where trans_flag=$9 and doc_no=$10 and user_created=$11`,
      [
        TRANS.RETURN_REQUEST, docDate, docNo, docRef, docRefDate, CALC_IN, session.username,
        LINE_STATUS.RETURN_REQUESTED, TRANS.DRAFT, docRef, session.username,
      ],
    );

    // ແຖວຂອງໃບເບີກທີ່ຖືກເລືອກສົ່ງຄືນ → ໝາຍວ່າຂໍສົ່ງຄືນ.
    // ods ຕັ້ງເປັນ 1 ເຊິ່ງເປັນຄ່າເກົ່າຢູ່ແລ້ວ (no-op) → ຂໍສົ່ງຄືນແຖວເກົ່າຊ້ຳໄດ້ບໍ່ຈຳກັດ.
    await client.query("update ic_trans_detail set status=$1 where roworder = any($2::int[])", [
      LINE_STATUS.RETURN_REQUESTED,
      rowRefs,
    ]);

    // ods ລຶບແຖວຮ່າງໃນ route ຕ່າງຫາກ (/back_stock_return) — ຢູ່ນີ້ລຶບໃນ transaction ດຽວກັນ
    await client.query("delete from ic_trans_detail_draft where trans_flag=$1 and user_created=$2", [
      TRANS.DRAFT,
      session.username,
    ]);

    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    console.error("saveInstallReturnRequest failed", error);
    return { error: "ບັນທຶກບໍ່ສຳເລັດ" };
  } finally {
    client.release();
  }

  // ສາງຕ້ອງອະນຸຍາດ ແລະ ຮັບຄືນ (ods ມີໂຄດ LINE Notify comment ໄວ້ຢູ່ຈຸດນີ້)
  await logChange(
    "ods_tb_install",
    productCode,
    `ສ້າງໃບຂໍສົ່ງອາໄຫຼ່ຄືນສາງ ${returnNo} · ${returnLines} ລາຍການ (ອ້າງອີງໃບເບີກ ${docRef})`,
    { roles: ROLE_WAREHOUSE },
  );

  revalidateReturns();
  redirect("/stock/returns?job=install");
}

/* ── ສາງຮັບຄືນ SRT (show_return_inst → save_com_return) ───── */

const receiveSchema = z.object({
  doc_ref: z.string().min(1),
  product_code: z.string().min(1),
  doc_date: z.string().min(1),
  remark: z.string(),
});

/**
 * ສາງຮັບອາໄຫຼ່ຄືນເຂົ້າສາງ — ຂຽນທັງ ODS ແລະ ERP (odg) ແລະ ບວກ ic_inventory ຄືນທັງສອງຖານ.
 * ຄືກັບ saveReceiveReturn ຝັ່ງສ້ອມ ແຕ່ຕິດ job_type='install' ໃສ່ເອກະສານ.
 * ສາງ/ທີ່ເກັບທີ່ຮັບຄືນ: ods ຝັງໄວ້ຕາຍຕົວ 1103/110301 → ໃຊ້ RETURN_WH/RETURN_SHELF ຄືກັນ.
 */
export async function saveInstallReceiveReturn(_: ActionState, formData: FormData): Promise<ActionState> {
  // ບວກສະຕັອກຄືນທັງ ODS ແລະ **ERP** ⇒ ສາງເທົ່ານັ້ນ (ບໍ່ແມ່ນ RETURN_SIDE ທັງກຸ່ມ)
  const guard = await requireRole(STOCK_SIDE, "ບໍ່ມີສິດຮັບອາໄຫຼ່ຄືນເຂົ້າສາງ");
  if (!guard.ok) return { error: guard.error };
  const session = guard.session;
  if (!db) return { error: "ບໍ່ພົບ DATABASE_URL" };
  if (!odgDb) return { error: "ບໍ່ພົບ ODG_DATABASE_URL" };

  const parsed = receiveSchema.safeParse({
    doc_ref: formData.get("doc_ref"),
    product_code: formData.get("product_code"),
    doc_date: formData.get("doc_date"),
    remark: formData.get("remark") ?? "",
  });
  if (!parsed.success) return { error: "ຂໍ້ມູນບໍ່ຄົບ" };
  const { doc_ref: docRef, product_code: productCode, doc_date: docDate, remark } = parsed.data;

  const docTime = new Date().toTimeString().slice(0, 5);

  const ods = await db.connect();
  const odg = await odgDb.connect();
  let receiveNo = "";
  let receiveLines = 0;
  try {
    await ods.query("begin");
    await ods.query("select pg_advisory_xact_lock($1)", [DOC_LOCK]);

    const head = await ods.query<{ doc_no: string; doc_date: Date; user_created: string | null }>(
      "select doc_no,doc_date,user_created from ic_trans where doc_no=$1 and trans_flag=$2 limit 1",
      [docRef, TRANS.RETURN_REQUEST],
    );
    const ref = head.rows[0];
    if (!ref) {
      await ods.query("rollback");
      return { error: "ບໍ່ພົບໃບຂໍສົ່ງຄືນ" };
    }

    // ກັນບັນທຶກຊ້ຳ — ໃບຂໍສົ່ງຄືນນຶ່ງໃບຮັບຄືນໄດ້ເທື່ອດຽວ (ods ບໍ່ໄດ້ກວດ)
    const already = await ods.query<{ count: number }>(
      "select count(*)::int count from ic_trans where trans_flag=$1 and doc_ref=$2",
      [TRANS.RECEIVE_BACK, docRef],
    );
    if (already.rows[0]?.count) {
      await ods.query("rollback");
      return { error: "ໃບນີ້ຮັບຄືນແລ້ວ" };
    }

    const lines = await ods.query<{ item_code: string; item_name: string; unit_code: string; qty: string }>(
      "select item_code,item_name,unit_code,qty from ic_trans_detail where doc_no=$1 order by roworder asc",
      [docRef],
    );
    if (lines.rowCount === 0) {
      await ods.query("rollback");
      return { error: "ບໍ່ມີອາໄຫຼ່ໃນໃບນີ້" };
    }

    const docNo = await nextDocNo(ods, "SRT");
    receiveNo = docNo;
    receiveLines = lines.rows.length;

    // ── ODS: ຫົວບິນ + ລາຍລະອຽດ
    await ods.query(
      `insert into ic_trans(trans_flag,doc_date,doc_no,doc_ref,doc_ref_date,cust_code,product_code,remark,user_created,job_type)
       select $1,$2,$3,doc_no,doc_date,cust_code,product_code,$4,$5,'install'
       from ic_trans where doc_no=$6`,
      [TRANS.RECEIVE_BACK, docDate, docNo, remark, session.username, docRef],
    );
    await ods.query(
      `insert into ic_trans_detail(trans_flag,doc_date,doc_no,doc_ref,doc_ref_date,cust_code,product_code,item_code,
         item_name,qty,unit_code,calc_flag,user_created,job_type)
       select $1,$2,$3,doc_no,doc_date,cust_code,product_code,item_code,item_name,qty,unit_code,$4,$5,'install'
       from ic_trans_detail where doc_no=$6`,
      [TRANS.RECEIVE_BACK, docDate, docNo, CALC_OUT, session.username, docRef],
    );

    /**
     * ໝາຍແຖວກະຕ່າວ່າ "ຄືນສາງແລ້ວ" — **ສະເພາະອາໄຫຼ່ທີ່ຢູ່ໃນໃບຂໍສົ່ງຄືນໃບນີ້**.
     *
     * ແຕ່ກ່ອນ: `where product_code=$1` ຢ່າງດຽວ ⇒ ໝາຍ **ທຸກແຖວ** ຂອງງານ. ສົ່ງຄືນ
     * 1 ໃນ 10 ລາຍການ ອີກ 9 ລາຍການທີ່ຍັງຢູ່ໃນມືຊ່າງກໍ່ຖືກໝາຍວ່າຄືນແລ້ວ ⇒ ບັນຊີອາໄຫຼ່
     * ນອກສາງຜິດທັນທີ. ດຽວນີ້ຜູກກັບແຖວທີ່ຄືນຈິງ ແລະ ໝາຍເທົ່າຈຳນວນແຖວທີ່ຄືນ
     * (ອາໄຫຼ່ຕົວດຽວກັນອາດມີຫຼາຍແຖວ — ເລືອກແຖວທີ່ຍັງບໍ່ຄືນ ຈາກເກົ່າຫາໃໝ່).
     */
    for (const line of lines.rows) {
      await ods.query(
        `update tb_used_spare set status='2'
         where roworder = (
           select roworder from tb_used_spare
           where product_code=$1 and item_code=$2 and coalesce(status,'0') <> '2'
           order by roworder asc limit 1)`,
        [productCode, line.item_code],
      );
    }

    // ── ODS: ບວກສະຕັອກຄືນ
    for (const line of lines.rows) {
      await ods.query("update ic_inventory set balance_qty=balance_qty+$1, wh_qty=wh_qty+$1 where code=$2", [
        line.qty,
        line.item_code,
      ]);
    }

    // ── ERP (odg): ຫົວບິນ + ລາຍລະອຽດ + ບວກສະຕັອກຄືນ
    await odg.query("begin");
    await odg.query(
      `insert into ic_trans(trans_type,trans_flag,doc_no,doc_date,doc_ref,doc_ref_date,sale_code,doc_time,
         doc_format_code,wh_from,location_from,creator_code,branch_code,remark,side_code,department_code)
       values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
      [
        ERP.TRANS_TYPE, TRANS.RECEIVE_BACK, docNo, docDate, docRef, ref.doc_date, ref.user_created, docTime,
        ERP.FORMAT_RECEIVE, RETURN_WH, RETURN_SHELF, session.username, branchOf(RETURN_WH), remark,
        ERP.SIDE_CODE, ERP.DEPARTMENT_CODE,
      ],
    );
    for (const line of lines.rows) {
      await odg.query(
        `insert into ic_trans_detail(trans_type,trans_flag,doc_no,doc_date,doc_ref,item_code,item_name,unit_code,qty,
           wh_code,shelf_code,stand_value,divide_value,doc_date_calc,doc_time_calc,calc_flag)
         values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,1,1,$12,$13,$14)`,
        [
          ERP.TRANS_TYPE, TRANS.RECEIVE_BACK, docNo, docDate, ref.doc_no, line.item_code, line.item_name,
          line.unit_code, line.qty, RETURN_WH, RETURN_SHELF, docDate, docTime, CALC_IN,
        ],
      );
      await odg.query("update ic_inventory set balance_qty=balance_qty+$1 where code=$2", [line.qty, line.item_code]);
    }

    await odg.query("commit");
    try {
      await ods.query("commit");
    } catch (error) {
      // ODS ລົ້ມຫຼັງ ERP commit — ERP ຄືນບໍ່ໄດ້ແລ້ວ, ຕ້ອງແກ້ດ້ວຍມື
      await odg.query("rollback").catch(() => {});
      throw error;
    }
  } catch (error) {
    await odg.query("rollback").catch(() => {});
    await ods.query("rollback").catch(() => {});
    console.error("saveInstallReceiveReturn failed", error);
    return { error: "ບັນທຶກບໍ່ສຳເລັດ" };
  } finally {
    odg.release();
    ods.release();
  }

  // ຊ່າງ (ຜູ້ຂໍສົ່ງຄືນ) ຮູ້ວ່າສາງຮັບອາໄຫຼ່ຄືນແລ້ວ
  await logChange(
    "ods_tb_install",
    productCode,
    `ສາງຮັບອາໄຫຼ່ຄືນ ${receiveNo} · ${receiveLines} ລາຍການ (ອ້າງອີງໃບຂໍສົ່ງຄືນ ${docRef})`,
  );

  revalidateReturns();
  redirect("/stock/receive-returns");
}
