"use server";
import { logChange } from "@/app/actions/chatter";
import { getSession } from "@/lib/auth";
import { ROLE_APPROVER } from "@/lib/chatter";
import { db, odgDb, query } from "@/lib/db";
import { nextDocNo } from "@/lib/doc-no";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

/**
 * ຂໍສັ່ງຊື່ອາໄຫຼ່ — ຖອດແບບຈາກ ods/order.py + ods/orderspare.py
 *
 * ຂັ້ນຕອນ: RQ (trans_flag 78, ຂໍອະນຸມັດ) → ອະນຸມັດແລ້ວກາຍເປັນ SPR (trans_flag 2)
 * ເຊິ່ງຂຽນລົງທັງຖານ ODS ແລະ ຖານ ERP (ODG).
 *
 * ບໍ່ໄດ້ copy ການແຈ້ງເຕືອນ LINE Notify ມາ (ບໍລິການປິດແລ້ວ + token ຝັງໃນ code).
 */

const uploadsDir = process.env.ODS_UPLOADS_DIR;
const ALLOWED = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp"]);
const MAX_BYTES = 16 * 1024 * 1024;

function secureFilename(name: string) {
  const cleaned = name.normalize("NFKD").replace(/[^\w.-]+/g, "_").replace(/^[._]+/, "").slice(-120);
  return cleaned || "image";
}

/** ໂມງ HH:MM ຕາມເຂດເວລາ Asia/Bangkok (ods ໃຊ້ pytz timezone ດຽວກັນ) */
function bangkokTime() {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Bangkok",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date());
}

/**
 * ສາຂາຂອງອາໄຫຼ່ — ods ໃຊ້ COALESCE(ic_branch_code,'05') ເສີຍໆ ແຕ່ໃນຖານມີຄ່າ '' (ຫວ່າງ) ຢູ່
 * ເຊິ່ງ COALESCE ຈັບບໍ່ໄດ້ → ກາຍເປັນສາຂາທີ 3 ແລ້ວແຖວນັ້ນຕົກຫຼົ່ນ. ໃຊ້ nullif() ຄຸມກ່ອນ.
 */
const BRANCH = `coalesce(nullif(ib.ic_branch_code,''),'05')`;

/** ໃບຂໍຊື້ຜູກກັບວຽກສ້ອມເປັນສ່ວນຫຼາຍ ແຕ່ງານຕິດຕັ້ງກໍ່ໃຊ້ product_code ຄືກັນ (INST-xxxx) */
function jobModel(code: string) {
  return code.startsWith("INST-") ? "ods_tb_install" : "tb_product";
}

export type PurchaseState = { error?: string };

/* ------------------------------------------------- /add_price_rqorder */

/** ໃສ່ລາຄາໃຫ້ແຖວອາໄຫຼ່ກ່ອນສ້າງໃບຂໍອະນຸມັດ */
export async function addPriceRqOrder(_: PurchaseState, formData: FormData): Promise<PurchaseState> {
  const session = await getSession();
  if (!session) return { error: "Session ໝົດອາຍຸ" };
  if (!db) return { error: "ບໍ່ພົບ DATABASE_URL" };

  const parsed = z
    .object({
      roworder: z.coerce.number().int(),
      price: z.string(),
      product_code: z.string().min(1),
      doc_ref: z.string().min(1),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "ຂໍ້ມູນບໍ່ຄົບ" };

  const price = Number(parsed.data.price.replace(/,/g, ""));
  if (!Number.isFinite(price) || price < 0) return { error: "ລາຄາບໍ່ຖືກຕ້ອງ" };

  // ods ຕັ້ງ sum_amount = price (ບໍ່ຄູນ qty). ບ່ອນນີ້ຄູນ qty ໃຫ້ຖືກ.
  await db.query(
    `update ic_trans_detail set price=$1, sum_amount=$1*coalesce(qty,1) where roworder=$2`,
    [price, parsed.data.roworder],
  );
  revalidatePath(`/purchase-requests/new/${parsed.data.product_code}/${parsed.data.doc_ref}`);
  return {};
}

/* ---------------------------------------------- /save_request_order (RQ) */

const rqSchema = z.object({
  doc_date: z.string().min(1),
  doc_ref: z.string().min(1),
  remark: z.string().optional().default(""),
  product_code: z.string().min(1),
  cust_code: z.string().optional().default(""),
  wanrunty: z.string().min(1),
  status_doc: z.string().min(1),
});

/** ຄື /save_request_order — ສ້າງໃບຂໍອະນຸມັດສະເໜີຊື້ (RQ, trans_flag 78) */
export async function saveRequestOrder(_: PurchaseState, formData: FormData): Promise<PurchaseState> {
  const session = await getSession();
  if (!session) return { error: "Session ໝົດອາຍຸ" };
  if (!db) return { error: "ບໍ່ພົບ DATABASE_URL" };

  const parsed = rqSchema.safeParse(
    Object.fromEntries([...formData.entries()].filter(([, value]) => typeof value === "string")),
  );
  if (!parsed.success) return { error: "ກະລຸນາປ້ອນຊ່ອງທີ່ຈຳເປັນໃຫ້ຄົບ" };
  const d = parsed.data;

  let upload: { filename: string; bytes: Buffer } | null = null;
  const file = formData.get("file1");
  if (file instanceof File && file.size > 0) {
    if (!uploadsDir) return { error: "ບໍ່ໄດ້ຕັ້ງຄ່າ ODS_UPLOADS_DIR — ອັບໂຫລດຮູບບໍ່ໄດ້" };
    if (file.size > MAX_BYTES) return { error: "ຮູບໃຫຍ່ເກີນ 16MB" };
    const filename = secureFilename(file.name);
    if (!ALLOWED.has(extname(filename).toLowerCase())) return { error: "ໄຟລ໌ທີ່ເລືອກບໍ່ແມ່ນຮູບ" };
    upload = { filename, bytes: Buffer.from(await file.arrayBuffer()) };
  }

  const client = await db.connect();
  const written: string[] = [];
  let requestNo = "";

  try {
    await client.query("begin");
    await client.query("select pg_advisory_xact_lock(734278)");
    const docNo = await nextDocNo(client, "RQ");
    requestNo = docNo;

    // ແຖວອາໄຫຼ່ຂອງໃບຂໍເບີກທີ່ stock ໝົດ ແລະ ຍັງບໍ່ທັນຖືກຂໍຊື້
    const lines = await client.query<{ roworder: number }>(
      `select a.roworder
       from ic_trans_detail a
       left join ic_inventory ic on ic.code = a.item_code
       where a.product_code=$1 and a.doc_no=$2
         and coalesce(ic.balance_qty,0) = 0 and a.status not in (1,7,5)`,
      [d.product_code, d.doc_ref],
    );
    if (lines.rows.length === 0) {
      await client.query("rollback");
      return { error: "ບໍ່ມີລາຍການອາໄຫຼ່ທີ່ຕ້ອງສັ່ງຊື້" };
    }
    const rows = lines.rows.map((row) => row.roworder);

    await client.query(
      `insert into ic_trans(trans_flag, doc_date, doc_no, doc_ref, doc_ref_date, product_code, issue, remark,
         wanrunty, isue_2, waranty_request, emp, w_reason, used_spare, user_created, cust_code, status_doc)
       select 78,$1,$2, doc_no, doc_date, product_code, issue, $3, $4, isue_2, waranty_request, emp, w_reason,
         used_spare, $5, $6, $7
       from ic_trans where doc_no=$8`,
      [d.doc_date, docNo, d.remark, d.wanrunty, session.username, d.cust_code, d.status_doc, d.doc_ref],
    );

    // ods ຍິງ INSERT ນີ້ຄືນລະແຖວໃນ loop — ບ່ອນນີ້ຍິງເທື່ອດຽວດ້ວຍ any($1)
    await client.query(
      `insert into ic_trans_detail(trans_flag, doc_date, doc_no, doc_ref_date, doc_ref, cust_code, product_code,
         item_code, item_name, qty, unit_code, calc_flag, user_created, price, sum_amount)
       select 78,$1,$2, a.doc_date, a.doc_no, a.cust_code, a.product_code, a.item_code, a.item_name, a.qty,
         a.unit_code, 1, $3, a.price, a.sum_amount
       from ic_trans_detail a where a.roworder = any($4::int[])`,
      [d.doc_date, docNo, session.username, rows],
    );

    // ໝາຍແຖວຕົ້ນທາງວ່າ "ກຳລັງສັ່ງຊື້"
    await client.query(`update ic_trans_detail set status=7 where roworder = any($1::int[])`, [rows]);

    if (upload && uploadsDir) {
      const stored = `${docNo}_0${extname(upload.filename).toLowerCase()}`;
      const path = join(uploadsDir, stored);
      await mkdir(uploadsDir, { recursive: true });
      await writeFile(path, upload.bytes);
      written.push(path);
      await client.query(
        `insert into product_image(iteme_code, product_url, line_number) values($1,$2,0)`,
        [docNo, stored],
      );
    }

    await client.query("commit");
  } catch (error) {
    await client.query("rollback").catch(() => {});
    await Promise.all(written.map((path) => unlink(path).catch(() => {})));
    console.error("save_request_order failed", error);
    return { error: "ບັນທຶກບໍ່ສຳເລັດ ກະລຸນາກວດຂໍ້ມູນ" };
  } finally {
    client.release();
  }

  // ໃບຂໍຊື້ລໍຖ້າອະນຸມັດ (ods ຍິງ LINE Notify ຫາຜູ້ອະນຸມັດຢູ່ຈຸດນີ້)
  await logChange(
    jobModel(d.product_code),
    d.product_code,
    `ສ້າງໃບຂໍອະນຸມັດສັ່ງຊື້ອາໄຫຼ່ ${requestNo} (ອ້າງອີງໃບຂໍເບີກ ${d.doc_ref}) — ລໍຖ້າອະນຸມັດ`,
    { roles: ROLE_APPROVER },
  );

  revalidatePath("/purchase-requests");
  redirect("/purchase-requests");
}

/* ------------------------------------------------- /approverqorder (SPR) */

const approveSchema = z.object({
  doc_date: z.string().min(1),
  doc_ref: z.string().min(1), // ເລກ RQ
  remark: z.string().optional().default(""),
  product_code: z.string().optional().default(""),
});

type RqLine = {
  item_code: string;
  item_name: string;
  qty: string;
  unit_code: string;
  price: string | null;
  sum_amount: string | null;
  branch: string;
};

/**
 * ຄື /approverqorder — ອະນຸມັດ RQ ແລ້ວອອກ SPR (trans_flag 2) ລົງທັງ ODS ແລະ ERP.
 * ຖ້າອາໄຫຼ່ຄາບກ່ຽວ 2 ສາຂາ ('00' ແລະ '05') ຈະແຍກເປັນ 2 ໃບ SPR.
 *
 * ແກ້ bug ຂອງ ods (order.py 417-422): ໃນເສັ້ນທາງສາຂາດຽວ ods ຢູ່ໃນ loop ຂອງແຕ່ລະລາຍການ
 * ແຕ່ຍິງ INSERT..SELECT ທີ່ດຶງ "ທຸກແຖວ" ຂອງ doc_ref ທຸກຮອບ → ic_trans_detail ຊ້ຳ N ເທົ່າ
 * (ເຫັນຢູ່ໃນຂໍ້ມູນຈິງ: SPR26070004 ມີ 4 ແຖວ ແຕ່ມີແຕ່ 2 ລາຍການ). ບ່ອນນີ້ຍິງເທື່ອດຽວຕໍ່ສາຂາ.
 */
export async function approveRqOrder(_: PurchaseState, formData: FormData): Promise<PurchaseState> {
  const session = await getSession();
  if (!session) return { error: "Session ໝົດອາຍຸ" };
  if (!db || !odgDb) return { error: "ບໍ່ພົບການເຊື່ອມຕໍ່ຖານຂໍ້ມູນ" };

  const parsed = approveSchema.safeParse(
    Object.fromEntries([...formData.entries()].filter(([, value]) => typeof value === "string")),
  );
  if (!parsed.success) return { error: "ຂໍ້ມູນບໍ່ຄົບ" };
  const d = parsed.data;
  const docTime = bangkokTime();

  const client = await db.connect();
  const erp = await odgDb.connect();

  try {
    await client.query("begin");
    await erp.query("begin");
    await client.query("select pg_advisory_xact_lock(734202)");

    const ref = await client.query<{ doc_no: string; doc_date: string; doc_ref: string | null }>(
      `select doc_no, doc_date, doc_ref from ic_trans where doc_no=$1 and trans_flag=78`,
      [d.doc_ref],
    );
    const rq = ref.rows[0];
    if (!rq) {
      await client.query("rollback");
      await erp.query("rollback");
      return { error: "ບໍ່ພົບໃບຂໍອະນຸມັດ" };
    }

    const detail = await client.query<RqLine>(
      `select a.item_code, a.item_name, coalesce(a.qty,0) qty, a.unit_code,
              coalesce(a.price,0) price, coalesce(a.sum_amount,0) sum_amount, ${BRANCH} branch
       from ic_trans_detail a
       left join ic_inventory_branch ib on ib.code = a.item_code
       where a.doc_no=$1`,
      [d.doc_ref],
    );
    if (detail.rows.length === 0) {
      await client.query("rollback");
      await erp.query("rollback");
      return { error: "ໃບຂໍອະນຸມັດບໍ່ມີລາຍການອາໄຫຼ່" };
    }

    // ຈັດກຸ່ມຕາມສາຂາ — '00' ກ່ອນ ແລ້ວຄ່ອຍສາຂາອື່ນ (ຄືລຳດັບຂອງ ods)
    const groups = new Map<string, RqLine[]>();
    for (const line of detail.rows) {
      const list = groups.get(line.branch) ?? [];
      list.push(line);
      groups.set(line.branch, list);
    }
    const branches = [...groups.keys()].sort((a, b) => (a === "00" ? -1 : b === "00" ? 1 : a.localeCompare(b)));

    // ແຖວຕົ້ນທາງ (ໃບຂໍເບີກ) ຂອງອາໄຫຼ່ທີ່ຖືກອະນຸມັດ → status=5
    if (rq.doc_ref) {
      await client.query(
        `update ic_trans_detail set status=5 where doc_no=$1 and item_code = any($2::varchar[])`,
        [rq.doc_ref, detail.rows.map((line) => line.item_code)],
      );
    }

    for (const branch of branches) {
      const lines = groups.get(branch) ?? [];
      // ອອກເລກໃໝ່ຕໍ່ໃບ — ເອີ້ນຫຼັງ insert ໃບກ່ອນໜ້າ ຈຶ່ງບໍ່ຊ້ຳ
      // (ods ເອົາເລກໃບທີ 2 ດ້ວຍການ +1 ໃສ່ຕົວເລກຂອງໃບທຳອິດ → ພັງງ່າຍ)
      const docNo = await nextDocNo(client, "SPR");

      await client.query(
        `insert into ic_trans(trans_flag, doc_date, doc_no, doc_ref, doc_ref_date, cust_code, product_code, issue,
           remark, wanrunty, isue_2, waranty_request, emp, w_reason, used_spare, status_doc, user_created)
         select 2,$1,$2, doc_no, doc_date, cust_code, product_code, issue, $3, wanrunty, isue_2, waranty_request,
           emp, w_reason, used_spare, status_doc, $4
         from ic_trans where doc_no=$5`,
        [d.doc_date, docNo, d.remark, session.username, d.doc_ref],
      );

      // ✅ ຍິງເທື່ອດຽວຕໍ່ສາຂາ (ods ຍິງຄືນລະລາຍການ → ຂໍ້ມູນຊ້ຳ)
      await client.query(
        `insert into ic_trans_detail(trans_flag, doc_date, doc_no, doc_ref_date, doc_ref, cust_code, product_code,
           item_code, item_name, qty, unit_code, calc_flag, user_created, price, sum_amount)
         select 2,$1,$2, doc_date, doc_no, cust_code, product_code, item_code, item_name, qty, unit_code, 1, $3,
           price, sum_amount
         from ic_trans_detail where doc_no=$4 and item_code = any($5::varchar[])`,
        [d.doc_date, docNo, session.username, d.doc_ref, lines.map((line) => line.item_code)],
      );

      // ---- ຂຽນລົງ ERP (SML) ----
      await erp.query(
        `insert into ic_trans(trans_type, trans_flag, doc_no, doc_date, doc_ref, doc_ref_date, vat_type, remark,
           user_request, branch_code, doc_format_code, doc_time)
         values(1,2,$1,$2,$3,$4,2,$5,$6,$7,'SPR',$8)`,
        [docNo, d.doc_date, rq.doc_no, rq.doc_date, d.remark, session.username, branch, docTime],
      );
      for (const line of lines) {
        await erp.query(
          `insert into ic_trans_detail(trans_type, trans_flag, doc_no, doc_date, inquiry_type, item_code, item_name,
             qty, unit_code, price, sum_amount, branch_code, stand_value, divide_value, calc_flag, vat_type, doc_time_calc)
           values(1,2,$1,$2,0,$3,$4,$5,$6,$7,$8,$9,1,1,1,2,$10)`,
          [docNo, d.doc_date, line.item_code, line.item_name, line.qty, line.unit_code, line.price,
            line.sum_amount, branch, docTime],
        );
      }
    }

    await client.query(
      `update ic_trans set remark_2=$1, approver1=$2, aprove_date1=localtimestamp(0), aprove_status=1 where doc_no=$3`,
      [d.remark, session.username, d.doc_ref],
    );

    if (d.product_code) {
      await client.query(`update tb_product set spare_order=localtimestamp(0) where code=$1`, [d.product_code]);
    }

    // ຂຽນຄົບທັງສອງຖານແລ້ວຈຶ່ງ commit — ຜິດພາດຢູ່ບ່ອນໃດກໍ່ rollback ໄດ້ທັງຄູ່
    await client.query("commit");
    await erp.query("commit");
  } catch (error) {
    await client.query("rollback").catch(() => {});
    await erp.query("rollback").catch(() => {});
    console.error("approverqorder failed", error);
    return { error: "ອະນຸມັດບໍ່ສຳເລັດ ກະລຸນາລອງໃໝ່" };
  } finally {
    client.release();
    erp.release();
  }

  // ຜູ້ຂໍ (ຜູ້ຕິດຕາມວຽກ) ຮູ້ວ່າໃບຂໍຊື້ຜ່ານແລ້ວ — ອອກໃບສັ່ງຊື້ SPR ໃຫ້ ERP ແລ້ວ
  if (d.product_code) {
    await logChange(
      jobModel(d.product_code),
      d.product_code,
      `ອະນຸມັດໃບຂໍສັ່ງຊື້ອາໄຫຼ່ ${d.doc_ref}${d.remark ? ` · ${d.remark}` : ""}`,
    );
  }

  revalidatePath("/approvals/purchase-requests");
  redirect("/approvals/purchase-requests");
}

/* --------------------------------------------- /not_approverqorder */

/**
 * ຄື /not_approverqorder — ບໍ່ອະນຸມັດ RQ ແລ້ວປົດ status ຂອງແຖວຕົ້ນທາງຄືນ
 *
 * ── ວຽກຄ້າງ "ກຳລັງສັ່ງຊື້ອາໄຫຼ່" ຕະຫຼອດໄປ (GAP) ──
 * ods (ແລະ code ອັນເກົ່າຢູ່ນີ້) ປົດແຕ່ ic_trans_detail.status ຄືນ ແຕ່ **ບໍ່ລ້າງ tb_product.spare_order**
 * ⇒ STAGE_SQL (lib/stage.ts) ຍັງເຫັນ spare_order ຢູ່ ຈຶ່ງຄາໃບໄວ້ຂັ້ນ 7 "ກຳລັງສັ່ງຊື້ອາໄຫຼ່"
 * ທັງທີ່ບໍ່ມີໃບສັ່ງຊື້ໃດຄ້າງຢູ່ເລີຍ — ບໍ່ມີໜ້າໃດຮັບວຽກຕໍ່ ແລະ ບໍ່ມີໃຜຮູ້ວ່າຕ້ອງລົງມືຫຍັງ.
 *
 * ດຽວນີ້ລ້າງ spare_order (+ spare_arrive ຖ້າມີ) ⇒ ວຽກຕົກກັບໄປຂັ້ນອາໄຫຼ່ (5/6) ໃຫ້ຄົນລົງມືຕໍ່ໄດ້.
 * ລ້າງໄດ້ສະເພາະເມື່ອ **ບໍ່ມີໃບສັ່ງຊື້ອື່ນຄ້າງຢູ່** (SPR ອື່ນ ຫຼື RQ ອື່ນທີ່ອະນຸມັດແລ້ວ)
 * ບໍ່ດັ່ງນັ້ນຈະດຶງວຽກທີ່ຍັງລໍຖ້າຂອງຈາກໃບອື່ນອອກຈາກຂັ້ນ 7 ຜິດ.
 */
export async function notApproveRqOrder(_: PurchaseState, formData: FormData): Promise<PurchaseState> {
  const session = await getSession();
  if (!session) return { error: "Session ໝົດອາຍຸ" };
  if (!db) return { error: "ບໍ່ພົບ DATABASE_URL" };

  const docNo = String(formData.get("doc_no") ?? "");
  if (!docNo) return { error: "ຂໍ້ມູນບໍ່ຄົບ" };

  const client = await db.connect();
  let productCode = "";
  let requester = "";
  let technician = "";
  let released = false;
  try {
    await client.query("begin");
    // returning → ໄດ້ລະຫັດວຽກ + ຜູ້ຂໍ ມາຂຽນ log/ແຈ້ງເຕືອນ ໂດຍບໍ່ຕ້ອງ query ຊ້ຳ
    const rejected = await client.query<{ product_code: string | null; user_created: string | null }>(
      `update ic_trans set aprove_status=2 where doc_no=$1 returning product_code, user_created`,
      [docNo],
    );
    productCode = rejected.rows[0]?.product_code ?? "";
    requester = rejected.rows[0]?.user_created ?? "";

    // ods ປົດ status=0 ໃຫ້ "ທຸກ" ແຖວຂອງໃບຂໍເບີກຕົ້ນທາງ → ລ້າງ status ຂອງແຖວທີ່ບໍ່ກ່ຽວນຳ.
    // ບ່ອນນີ້ປົດສະເພາະອາໄຫຼ່ທີ່ຢູ່ໃນໃບ RQ ນີ້ເທົ່ານັ້ນ.
    await client.query(
      `update ic_trans_detail set status=0
       where doc_no = (select doc_ref from ic_trans where doc_no=$1 limit 1)
         and item_code in (select item_code from ic_trans_detail where doc_no=$1)`,
      [docNo],
    );

    // ວຽກສ້ອມ (tb_product) ເທົ່ານັ້ນ — ງານຕິດຕັ້ງ (INST-) ບໍ່ໄດ້ໃຊ້ຖັນເຫຼົ່ານີ້
    if (productCode && jobModel(productCode) === "tb_product") {
      // ໃບສັ່ງຊື້ (SPR) ທີ່ອອກມາຈາກໃບ RQ ໃບນີ້ເອງ (doc_ref = RQ) ບໍ່ນັບ — ໃບນີ້ຖືກປະຕິເສດແລ້ວ.
      // ນັບແຕ່ໃບຂໍຊື້ອື່ນທີ່ຍັງມີຜົນ ⇒ ຖ້າຍັງມີ ວຽກຕ້ອງຄ້າງຂັ້ນ 7 ຕໍ່ໄປ (ຂອງຍັງມາບໍ່ຮອດ)
      const others = await client.query<{ n: number }>(
        `select count(*)::int n from ic_trans
         where product_code=$1 and doc_no <> $2 and coalesce(doc_ref,'') <> $2
           and (trans_flag = 2 or (trans_flag = 78 and coalesce(aprove_status,0) = 1))`,
        [productCode, docNo],
      );
      if ((others.rows[0]?.n ?? 0) === 0) {
        const cleared = await client.query<{ emp_code: string | null }>(
          `update tb_product
              set spare_order = null, spare_arrive = null, spare_arrive_by = null
            where code = $1 and spare_order is not null
            returning emp_code`,
          [productCode],
        );
        released = (cleared.rowCount ?? 0) > 0;
        technician = cleared.rows[0]?.emp_code ?? "";
      }
    }
    await client.query("commit");
  } catch (error) {
    await client.query("rollback").catch(() => {});
    console.error("not_approverqorder failed", error);
    return { error: "ບັນທຶກບໍ່ສຳເລັດ" };
  } finally {
    client.release();
  }

  if (productCode) {
    // ຊ່າງ (ຄົນລໍອາໄຫຼ່) + ຜູ້ຂໍ ຕ້ອງຮູ້ວ່າໃບຂໍຊື້ຕົກ ແລະ ວຽກກັບມາຢູ່ຂັ້ນອາໄຫຼ່ແລ້ວ
    const users = [technician, requester].filter((name) => name && name !== session.username);
    await logChange(
      jobModel(productCode),
      productCode,
      `ບໍ່ອະນຸມັດໃບຂໍສັ່ງຊື້ອາໄຫຼ່ ${docNo}` +
        (released
          ? " — ຍົກເລີກສະຖານະ “ກຳລັງສັ່ງຊື້ອາໄຫຼ່” ວຽກກັບໄປຂັ້ນອາໄຫຼ່ ລໍຖ້າການລົງມືໃໝ່"
          : ""),
      { users },
    );
  }

  revalidatePath("/approvals/purchase-requests");
  revalidatePath("/purchase-requests");
  revalidatePath("/stock/arrivals");
  revalidatePath("/stock/dispatch");
  revalidatePath("/dashboard");
  if (productCode) revalidatePath(`/service/${productCode}`);
  redirect("/approvals/purchase-requests");
}

/* ------------------------------------------------ /save_pr (orderspare.py) */

const prSchema = z.object({
  doc_date: z.string().min(1),
  doc_ref: z.string().min(1),
  remark: z.string().optional().default(""),
  product_code: z.string().min(1),
  item_code: z.string().min(1),
});

/**
 * ຄື /save_pr — ອອກ SPR ໃຫ້ອາໄຫຼ່ 1 ລາຍການ ຈາກໃບຂໍເບີກ ໂດຍບໍ່ຜ່ານ RQ.
 * ods ຝັງ branch_code='00' ໄວ້ຕາຍຕົວຕອນຂຽນລົງ ERP — ບ່ອນນີ້ເອົາສາຂາຈິງຂອງອາໄຫຼ່
 * (ຄືກັບທີ່ approverqorder ເຮັດ) ບໍ່ດັ່ງນັ້ນອາໄຫຼ່ສາຂາ 05 ຈະໄປໂຜ່ຢູ່ສາຂາ 00.
 */
export async function savePr(_: PurchaseState, formData: FormData): Promise<PurchaseState> {
  const session = await getSession();
  if (!session) return { error: "Session ໝົດອາຍຸ" };
  if (!db || !odgDb) return { error: "ບໍ່ພົບການເຊື່ອມຕໍ່ຖານຂໍ້ມູນ" };

  const parsed = prSchema.safeParse(
    Object.fromEntries([...formData.entries()].filter(([, value]) => typeof value === "string")),
  );
  if (!parsed.success) return { error: "ຂໍ້ມູນບໍ່ຄົບ" };
  const d = parsed.data;
  const docTime = bangkokTime();

  const client = await db.connect();
  const erp = await odgDb.connect();
  let orderNo = "";

  try {
    await client.query("begin");
    await erp.query("begin");
    await client.query("select pg_advisory_xact_lock(734202)");
    const docNo = await nextDocNo(client, "SPR");
    orderNo = docNo;

    const head = await client.query<{ doc_no: string; doc_date: string }>(
      `select doc_no, doc_date from ic_trans where doc_no=$1`,
      [d.doc_ref],
    );
    const source = head.rows[0];
    const lines = await client.query<RqLine>(
      `select a.item_code, a.item_name, coalesce(a.qty,0) qty, a.unit_code,
              coalesce(a.price,0) price, coalesce(a.sum_amount,0) sum_amount, ${BRANCH} branch
       from ic_trans_detail a
       left join ic_inventory_branch ib on ib.code = a.item_code
       where a.doc_no=$1 and a.item_code=$2`,
      [d.doc_ref, d.item_code],
    );
    if (!source || lines.rows.length === 0) {
      await client.query("rollback");
      await erp.query("rollback");
      return { error: "ບໍ່ພົບລາຍການອາໄຫຼ່" };
    }

    await client.query(
      `insert into ic_trans(trans_flag, doc_date, doc_no, doc_ref, doc_ref_date, cust_code, product_code, issue,
         remark, wanrunty, isue_2, waranty_request, emp, w_reason, used_spare, user_created)
       select 2,$1,$2, doc_no, doc_date, cust_code, product_code, issue, $3, wanrunty, isue_2, waranty_request,
         emp, w_reason, used_spare, $4
       from ic_trans where doc_no=$5`,
      [d.doc_date, docNo, d.remark, session.username, d.doc_ref],
    );
    await client.query(
      `insert into ic_trans_detail(trans_flag, doc_date, doc_no, doc_ref_date, doc_ref, cust_code, product_code,
         item_code, item_name, qty, unit_code, calc_flag, user_created)
       select 2,$1,$2, doc_date, doc_no, cust_code, product_code, item_code, item_name, qty, unit_code, 1, $3
       from ic_trans_detail where doc_no=$4 and item_code=$5`,
      [d.doc_date, docNo, session.username, d.doc_ref, d.item_code],
    );

    await client.query(`update ic_trans set used_status=3 where doc_no=$1`, [d.doc_ref]);
    await client.query(`update ic_trans_detail set status=5 where doc_no=$1 and item_code=$2`, [
      d.doc_ref,
      d.item_code,
    ]);
    await client.query(`update tb_product set spare_order=localtimestamp(0) where code=$1`, [d.product_code]);

    const branch = lines.rows[0].branch;
    await erp.query(
      `insert into ic_trans(trans_type, trans_flag, doc_no, doc_date, doc_ref, doc_ref_date, vat_type, remark,
         user_request, branch_code, doc_format_code, doc_time)
       values(1,2,$1,$2,$3,$4,2,$5,$6,$7,'SPR',$8)`,
      [docNo, d.doc_date, source.doc_no, source.doc_date, d.remark, session.username, branch, docTime],
    );
    for (const line of lines.rows) {
      await erp.query(
        `insert into ic_trans_detail(trans_type, trans_flag, doc_no, doc_date, inquiry_type, item_code, item_name,
           qty, unit_code, branch_code, stand_value, divide_value, calc_flag, vat_type, doc_time_calc)
         values(1,2,$1,$2,0,$3,$4,$5,$6,$7,1,1,1,2,$8)`,
        [docNo, d.doc_date, line.item_code, line.item_name, line.qty, line.unit_code, branch, docTime],
      );
    }

    await client.query("commit");
    await erp.query("commit");
  } catch (error) {
    await client.query("rollback").catch(() => {});
    await erp.query("rollback").catch(() => {});
    console.error("save_pr failed", error);
    return { error: "ບັນທຶກບໍ່ສຳເລັດ ກະລຸນາລອງໃໝ່" };
  } finally {
    client.release();
    erp.release();
  }

  await logChange(
    jobModel(d.product_code),
    d.product_code,
    `ອອກໃບສັ່ງຊື້ອາໄຫຼ່ ${orderNo}: ${d.item_code} (ອ້າງອີງໃບຂໍເບີກ ${d.doc_ref})`,
  );

  revalidatePath("/purchase-requests");
  redirect("/purchase-requests");
}

/* ------------------------------------------- ອາໄຫຼ່ມາຮອດແລ້ວ (/stock/arrivals) */

/**
 * ຂັ້ນ "ກຳລັງສັ່ງຊື້ອາໄຫຼ່" ບໍ່ເຄີຍມີທາງອອກ.
 *
 * ໃບຮັບເຄື່ອງເຂົ້າຂັ້ນ 7 ຕອນໃບຂໍຊື້ຖືກອະນຸມັດ (spare_order) ແຕ່ຖັນທີ່ໝາຍວ່າ "ຂອງມາຮອດແລ້ວ"
 * (spare_order_finish) ບໍ່ມີ code ບ່ອນໃດຂຽນເລີຍ ແລະ ຍັງເປັນ `time` (ບໍ່ມີວັນທີ) ນຳ
 * ⇒ ວຽກຄ້າງຢູ່ຂັ້ນ 7 ຈົນກວ່າສາງຈະເບີກອາໄຫຼ່ໃຫ້ (spare_finish) ໂດຍບໍ່ມີໃຜຮູ້ວ່າຂອງມາຮອດຫຼືຍັງ.
 *
 * ດຽວນີ້ສາງກົດຢືນຢັນເອງ → ຂຽນ spare_arrive / spare_arrive_by (ຖັນໃໝ່ timestamp)
 * ⇒ ຂັ້ນຕົກເປັນ 6 (ກຳລັງເບີກອາໄຫຼ່) ທັນທີ ແລ້ວວຽກໄປໂຜ່ຢູ່ /stock/dispatch ໃຫ້ເບີກຕໍ່.
 * ບໍ່ໄປແຕະ ic_trans_detail.status ເລີຍ — ໜ້າເບີກອາໄຫຼ່ບໍ່ໄດ້ອີງໃສ່ຂັ້ນຂອງໃບ ຈຶ່ງບໍ່ກະທົບກັນ.
 */
const arrivalSchema = z.object({ code: z.string().trim().min(1).max(50) });

/** ຊ່າງທີ່ລໍຖ້າອາໄຫຼ່ຕົວນີ້ຢູ່ — ໃຫ້ໄດ້ຮັບການແຈ້ງເຕືອນກ່ອນໃຜ */
type ArrivalJob = { emp_code: string | null; spare_arrive_by: string | null };

export async function confirmSpareArrival(rawCode: string): Promise<PurchaseState> {
  const session = await getSession();
  if (!session) return { error: "Session ໝົດອາຍຸ" };
  if (!db) return { error: "ບໍ່ພົບ DATABASE_URL" };

  const parsed = arrivalSchema.safeParse({ code: rawCode });
  if (!parsed.success) return { error: "ລະຫັດວຽກບໍ່ຖືກຕ້ອງ" };
  const { code } = parsed.data;

  let job: ArrivalJob | undefined;
  try {
    // ເງື່ອນໄຂໃນ where ຄຸມໃຫ້ກົດຊ້ຳບໍ່ໄດ້ (spare_arrive is null) ແລະ ກົດໃສ່ໃບທີ່ບໍ່ໄດ້ສັ່ງຊື້ບໍ່ໄດ້
    const updated = await query<ArrivalJob>(
      `update tb_product
          set spare_arrive = localtimestamp(0), spare_arrive_by = $2
        where code = $1 and spare_order is not null and spare_arrive is null
          and status <> 6 and return_complete is null
        returning emp_code, spare_arrive_by`,
      [code, session.username],
    );
    job = updated.rows[0];
  } catch (error) {
    console.error("confirmSpareArrival failed", error);
    return { error: "ບັນທຶກບໍ່ສຳເລັດ ກະລຸນາລອງໃໝ່" };
  }
  if (!job) return { error: "ໃບນີ້ບໍ່ໄດ້ລໍຖ້າອາໄຫຼ່ ຫຼື ຢືນຢັນໄປແລ້ວ" };

  // ຊ່າງລໍຖ້າອາໄຫຼ່ຕົວນີ້ມາດົນ — ແຈ້ງລາວ + ຜູ້ຕິດຕາມໃບນີ້ (logChange ຍິງ notify ໃຫ້ໃນຕົວ)
  await logChange(
    "tb_product",
    code,
    `ອາໄຫຼ່ມາຮອດແລ້ວ — ພ້ອມເບີກໃຫ້ຊ່າງ (ຢືນຢັນໂດຍ ${session.username})`,
    { users: job.emp_code ? [job.emp_code] : [] },
  );

  revalidatePath("/stock/arrivals");
  revalidatePath("/stock/dispatch");
  revalidatePath("/purchase-requests");
  revalidatePath(`/service/${code}`);
  revalidatePath("/dashboard");
  return {};
}

/** ກົດຜິດໃບ → ຖອນຄືນ ແລ້ວວຽກກັບໄປຂັ້ນ 7 ຄືເກົ່າ */
export async function undoSpareArrival(rawCode: string): Promise<PurchaseState> {
  const session = await getSession();
  if (!session) return { error: "Session ໝົດອາຍຸ" };
  if (!db) return { error: "ບໍ່ພົບ DATABASE_URL" };

  const parsed = arrivalSchema.safeParse({ code: rawCode });
  if (!parsed.success) return { error: "ລະຫັດວຽກບໍ່ຖືກຕ້ອງ" };
  const { code } = parsed.data;

  let job: ArrivalJob | undefined;
  try {
    // ເບີກອາໄຫຼ່ໄປແລ້ວ (spare_finish) ຖອນບໍ່ໄດ້ — ຈະດຶງວຽກກັບຫຼັງຂ້າມຂັ້ນ
    const updated = await query<ArrivalJob>(
      `update tb_product
          set spare_arrive = null, spare_arrive_by = null
        where code = $1 and spare_arrive is not null and spare_finish is null
        returning emp_code, spare_arrive_by`,
      [code],
    );
    job = updated.rows[0];
  } catch (error) {
    console.error("undoSpareArrival failed", error);
    return { error: "ຖອນຄືນບໍ່ສຳເລັດ ກະລຸນາລອງໃໝ່" };
  }
  if (!job) return { error: "ຖອນຄືນບໍ່ໄດ້ — ເບີກອາໄຫຼ່ໄປແລ້ວ ຫຼື ຍັງບໍ່ໄດ້ຢືນຢັນ" };

  await logChange("tb_product", code, `ຖອນຄືນການຢືນຢັນ "ອາໄຫຼ່ມາຮອດແລ້ວ" — ກັບໄປລໍຖ້າອາໄຫຼ່ຕາມເກົ່າ`, {
    users: job.emp_code ? [job.emp_code] : [],
  });

  revalidatePath("/stock/arrivals");
  revalidatePath("/stock/dispatch");
  revalidatePath("/purchase-requests");
  revalidatePath(`/service/${code}`);
  revalidatePath("/dashboard");
  return {};
}
