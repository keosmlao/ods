"use server";
import { logChange } from "@/lib/chatter-log";
import { ROLE_APPROVER, ROLE_WAREHOUSE } from "@/lib/chatter";
import { db, odgDb, queryOdg } from "@/lib/db";
import { linkErpDoc } from "@/lib/erp-doc-link";
import { erpPurchaseForRq, PURCHASE_STAGE_LABEL } from "@/lib/erp-purchase";
import { approvePo, approvePr, createPo, issuePo, linesOf, peekPoNo, type PoShipping, type PoTerms } from "@/lib/erp-po";
import { nextSprNo, writeErpSpr } from "@/lib/erp-spr";
import { supplierByCode } from "@/lib/erp-supplier";
import { getBalances, withdrawableQty, withdrawableWhere } from "@/lib/stock-balance";
import { ERP_PURCHASE } from "@/lib/stock-constants";
import { requireRole } from "@/lib/guard";
import { APPROVER_SIDE, roleOf, type Role } from "@/lib/roles";
import { STAGE_SQL } from "@/lib/stage";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";
import type { PoolClient } from "pg";
import { PURCHASE_COUNT_TAG } from "@/lib/nav-counts";
import { revalidatePath, updateTag } from "next/cache";
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

/* ── ສິດ (RBAC) ────────────────────────────────────────────────────
 * ods ກວດແຕ່ "login ຢູ່ບໍ" ໃນທຸກ route ຂອງການສັ່ງຊື້ — ບ່ອນນີ້ບັງຄັບ role ຢູ່ຝັ່ງ server
 * ເພາະ server action ເປັນ endpoint ໃນຕົວມັນເອງ (ດ່ານ proxy ກັນໄດ້ແຕ່ເສັ້ນທາງໜ້າ).
 *   ອອກ/ຖອນ ໃບຂໍຊື້  → PURCHASE_SIDE (ຄືກົດ /purchase-requests ໃນ lib/roles)
 *   ອະນຸມັດ/ບໍ່ອະນຸມັດ → APPROVER_SIDE
 *
 * "ຮັບອາໄຫຼ່ເຂົ້າສາງ" ບໍ່ມີຢູ່ນີ້ອີກ — ບໍ່ມີໃຜກົດດ້ວຍມືແລ້ວ, ລະບົບອ່ານຈາກ ERP
 * ແລ້ວເລື່ອນຂັ້ນເອງ (lib/erp-purchase.syncErpPurchase).
 */
const PURCHASE_SIDE: Role[] = ["manager", "admin", "stock"];

const uploadsDir = process.env.ODS_UPLOADS_DIR;
const ALLOWED = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp"]);
const MAX_BYTES = 16 * 1024 * 1024;

function secureFilename(name: string) {
  const cleaned = name.normalize("NFKD").replace(/[^\w.-]+/g, "_").replace(/^[._]+/, "").slice(-120);
  return cleaned || "image";
}

/**
 * ສາຂາ ERP ທີ່ສັ່ງຊື້ຜ່ານໄດ້ — ຄ່າຕົງກັບ `erp_branch_list.code` ຂອງຖານ ERP.
 * ມີພຽງ 2 ສາຂາທີ່ອອກໃບ SPR ຈິງ (ຢືນຢັນຈາກຂໍ້ມູນ: 05 = 338 ໃບ · 00 = 211 ໃບ).
 */
// ⚠️ ຫ້າມ export — ໄຟລ໌ "use server" export ໄດ້ແຕ່ async function (Next ຈະລົ້ມທັນທີຕອນ import)
const BRANCH_LABEL: Record<string, string> = {
  "00": "ໂອດ່ຽນ (ສຳນັກງານໃຫ່ຍ)",
  "05": "ໂອດ່ຽນໄທ",
};

/** ໂມງ HH:MM ຕາມເຂດເວລາ Asia/Bangkok — ERP ເກັບ doc_time ເປັນ text (ຄື lib/erp-request) */
function bangkokTime() {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Bangkok",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date());
}

/** ໃບຂໍຊື້ຜູກກັບວຽກສ້ອມເປັນສ່ວນຫຼາຍ ແຕ່ງານຕິດຕັ້ງກໍ່ໃຊ້ product_code ຄືກັນ (INST-xxxx) */
function jobModel(code: string) {
  return code.startsWith("INST-") ? "ods_tb_install" : "tb_product";
}

/**
 * ຂໍ້ມູນຈັດສົ່ງຂອງໃບ PO — **ໃບ PO ຈິງທຸກໃບມີ** (2,188/2,188 ໃນ 1 ປີ · ແຖວ 99.97% ມີ wh_code)
 * ⇒ ບັງຄັບຢູ່ຟອມ ບໍ່ໃຫ້ອອກໃບທີ່ບໍ່ຄົບຄືໂຄ້ດເກົ່າ. ໃຊ້ຮ່ວມກັນທັງ "ອອກ PO ຈາກ WPRA"
 * ແລະ "ອອກ PO ໂດຍກົງ" — ນິຍາມບ່ອນດຽວ.
 */
const shippingSchema = z.object({
  send_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "ວັນທີຄາດວ່າຈະມາຮອດບໍ່ຖືກຮູບແບບ"),
  transport_code: z.string().trim().min(1, "ກະລຸນາເລືອກຊ່ອງທາງການຈັດສົ່ງ"),
  wh_code: z.string().trim().min(1, "ກະລຸນາເລືອກສາງທີ່ຮັບເຂົ້າ"),
});

/**
 * ສະກຸນເງິນ · ອັດຕາແລກປ່ຽນ · VAT — ຕັດສິນຢູ່ຂັ້ນ PO ຄືກັນ.
 * vat_type: **0 = VAT ແຍກນອກ** (ສາຂາໄທ 7%) · **2 = ລວມ VAT ໃນລາຄາແລ້ວ** (ລາວ 10%)
 * — ສອງແບບນີ້ຄືທີ່ໃບຈິງໃຊ້ 99.8% (0: 971 ໃບ · 2: 1,214 ໃບ ໃນ 1 ປີ).
 *
 * `credit_day` = **ສົດ ຫຼື ຕິດໜີ້**: 0 = ສົດ · >0 = ຕິດໜີ້ N ວັນ (ເບິ່ງ PoTerms ໃນ erp-po.ts).
 * ເພດານ 365 = ກັນພິມຜິດ ບໍ່ແມ່ນນະໂຍບາຍ (ຕິດໜີ້ຍາວສຸດຂອງໃບຈິງ = 90 ວັນ).
 */
const termsSchema = z.object({
  currency_code: z.string().trim().min(1, "ກະລຸນາເລືອກສະກຸນເງິນ"),
  exchange_rate: z.coerce.number().positive("ອັດຕາແລກປ່ຽນຕ້ອງຫຼາຍກວ່າ 0"),
  vat_type: z.coerce.number().refine((v) => v === 0 || v === 2, "ປະເພດ VAT ບໍ່ຖືກຕ້ອງ"),
  vat_rate: z.coerce.number().min(0).max(100),
  credit_day: z.coerce
    .number()
    .int("ຈຳນວນວັນຕິດໜີ້ຕ້ອງເປັນຈຳນວນເຕັມ")
    .min(0, "ຈຳນວນວັນຕິດໜີ້ຕິດລົບບໍ່ໄດ້")
    .max(365, "ຈຳນວນວັນຕິດໜີ້ຫຼາຍເກີນໄປ"),
});

/** ຢືນຢັນລະຫັດຈັດສົ່ງ/ສາງ ກັບ ERP — ຢ່າເຊື່ອຄ່າຈາກ form (ຄືການຢືນຢັນຜູ້ສະໜອງ) */
async function checkShipping(ship: PoShipping, terms: PoTerms): Promise<string | null> {
  try {
    const [transport, warehouse, currency] = await Promise.all([
      queryOdg(`select 1 from transport_type where code=$1 limit 1`, [ship.transport_code]),
      queryOdg(`select 1 from ic_warehouse where code=$1 limit 1`, [ship.wh_code]),
      queryOdg(`select 1 from erp_currency where code=$1 limit 1`, [terms.currency_code]),
    ]);
    if (!transport.rowCount) return `ບໍ່ພົບຊ່ອງທາງການຈັດສົ່ງ ${ship.transport_code} ໃນ ERP`;
    if (!warehouse.rowCount) return `ບໍ່ພົບສາງ ${ship.wh_code} ໃນ ERP`;
    if (!currency.rowCount) return `ບໍ່ພົບສະກຸນເງິນ ${terms.currency_code} ໃນ ERP`;
    return null;
  } catch (error) {
    console.error("checkShipping failed", error);
    return "ກວດຂໍ້ມູນຈັດສົ່ງກັບ ERP ບໍ່ໄດ້";
  }
}

/**
 * ເລກ PO ທີ່ຈະໄດ້ — ໃຫ້ຟອມສະແດງລ່ວງໜ້າ (ຄື Odoo). ຄືນ "" ຖ້າຖາມ ERP ບໍ່ໄດ້:
 * ເປັນພຽງການສະແດງ ⇒ ຫ້າມລົ້ມຟອມ (ເລກຈິງອອກຕອນບັນທຶກ ພາຍໃນ txn ທີ່ລັອກແລ້ວ).
 */
export async function previewPoNo(branch: string, doc_date: string): Promise<string> {
  const guard = await requireRole(PURCHASE_SIDE, "ບໍ່ມີສິດ");
  if (!guard.ok) return "";
  if (!["00", "05"].includes(branch) || !/^\d{4}-\d{2}-\d{2}$/.test(doc_date)) return "";
  try {
    return await peekPoNo(branch, doc_date);
  } catch (error) {
    console.error("previewPoNo failed", error);
    return "";
  }
}

/**
 * ໜ້າທີ່ອະນຸຍາດໃຫ້ກັບຄືນຫຼັງ action (whitelist ກັນ open redirect) — ປຸ່ມຂອງສາຍສັ່ງຊື້
 * ຢູ່ 3 ບ່ອນ: ໜ້າຂໍສັ່ງຊື້, ໜ້າອະນຸມັດ, ແລະ ໜ້າເອກະສານ /purchase-orders/<SPR>.
 */
function purchaseBack(formData: FormData, fallback: string): string {
  const back = String(formData.get("back") ?? "");
  if (back === "/purchase-requests" || back === "/purchase-orders") return back;
  if (/^\/purchase-orders\/[A-Za-z0-9%._-]+$/.test(back)) return back;
  return fallback;
}

/** ໃບຂໍອະນຸມັດເກົ່າຂອງ ODS (RQ) — ບໍ່ຖືກສ້າງອີກ ແຕ່ໃບເກົ່າຍັງຄ້າງຢູ່ ⇒ ຍັງຕ້ອງຫາເຫັນ */
const RQ_TRANS_FLAG = 78;

export type PurchaseState = { error?: string };

/* ------------------------------------------------- /add_price_rqorder */

/**
 * ໃສ່ລາຄາໃຫ້ແຖວອາໄຫຼ່ກ່ອນສ້າງໃບຂໍອະນຸມັດ
 *
 * ods ຍິງ `update ic_trans_detail set price=.. where roworder=%s` ດ້ວຍ roworder ທີ່ມາຈາກ form ເສີຍໆ
 * ⇒ ໃຜກໍ່ຕາມທີ່ login ຢູ່ ແກ້ລາຄາຂອງແຖວໃດກໍ່ໄດ້ໃນຕາຕະລາງ (ລວມທັງໃບເບີກທີ່ຈົບໄປແລ້ວ).
 * ບ່ອນນີ້ຜູກ roworder ໄວ້ກັບໃບຂໍເບີກ + ລະຫັດວຽກ ແລະ ແຖວທີ່ຍັງບໍ່ທັນຖືກເບີກ/ສັ່ງຊື້ເທົ່ານັ້ນ.
 */
export async function addPriceRqOrder(_: PurchaseState, formData: FormData): Promise<PurchaseState> {
  const guard = await requireRole(PURCHASE_SIDE, "ບໍ່ມີສິດໃສ່ລາຄາອາໄຫຼ່ສັ່ງຊື້");
  if (!guard.ok) return { error: guard.error };
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
  const updated = await db.query(
    `update ic_trans_detail set price=$1, sum_amount=$1*coalesce(qty,1)
      where roworder=$2 and doc_no=$3 and product_code=$4 and trans_flag=122
        and coalesce(status,0) not in (1,5,7)`,
    [price, parsed.data.roworder, parsed.data.doc_ref, parsed.data.product_code],
  );
  if ((updated.rowCount ?? 0) === 0) return { error: "ແກ້ລາຄາແຖວນີ້ບໍ່ໄດ້ — ອາດຖືກເບີກ ຫຼື ສັ່ງຊື້ໄປແລ້ວ" };

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
  source_type: z.enum(["request", "check"]).default("request"),
  /**
   * ສາຂາທີ່ຈະສັ່ງຊື້ຜ່ານ — `00` ສຳນັກງານໃຫ່ຍ (ລາວ) · `05` ສາຂາໂອດ່ຽນໄທຍ.
   * enum ຢູ່ນີ້ (ບໍ່ແມ່ນ string ລ້ວນ) ⇒ ຄ່າແປກທີ່ຍິງມາທາງ form ຖືກປະຕິເສດ
   * ບໍ່ດັ່ງນັ້ນຈະໄດ້ສາຂາທີ່ບໍ່ມີໃນ ERP ແລ້ວຝ່າຍຈັດຊື້ອອກໃບຜິດບ່ອນ.
   */
  branch_code: z.enum(["00", "05"]),
});

/** ຄື /save_request_order — ສ້າງໃບຂໍອະນຸມັດສະເໜີຊື້ (RQ, trans_flag 78) */
export async function saveRequestOrder(_: PurchaseState, formData: FormData): Promise<PurchaseState> {
  const guard = await requireRole(PURCHASE_SIDE, "ບໍ່ມີສິດອອກໃບຂໍສັ່ງຊື້ອາໄຫຼ່");
  if (!guard.ok) return { error: guard.error };
  const session = guard.session;
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

  if (!odgDb) return { error: "ບໍ່ພົບ ODG_DATABASE_URL — ອອກໃບຂໍຊື້ບໍ່ໄດ້" };

  const client = await db.connect();
  /**
   * ໃບຂໍຊື້ອອກຢູ່ **ERP** ⇒ ຕ້ອງຄຸມສອງຖານພ້ອມກັນ: **ERP ຜ່ານ = ສຳເລັດ**
   * (ຫຼັກການດຽວກັນກັບ lib/erp-request) — ERP ລົ້ມ ⇒ rollback ທັງຄູ່ ບໍ່ໃຫ້ມີໃບຄ້າງເຄິ່ງທາງ.
   */
  const odg = await odgDb.connect();
  const written: string[] = [];
  let erpDocNo = "";

  try {
    await client.query("begin");
    await odg.query("begin");
    await client.query("select pg_advisory_xact_lock(734278)");

    if (d.source_type === "check") {
      // ລຳດັບທີ່ຖືກ: ອອກໃບຂໍຊື້ຈາກຜົນກວດໂດຍກົງ — ບໍ່ສ້າງ SIO ປອມກ່ອນຊື້.
      const job = await client.query<{ cust_code: string | null }>(
        `select a.cust_code from tb_product a where a.code=$1 and (${STAGE_SQL})=5 for update`,
        [d.product_code],
      );
      if (!job.rows[0]) {
        await client.query("rollback");
        await odg.query("rollback");
        return { error: "ວຽກນີ້ບໍ່ໄດ້ຢູ່ຂັ້ນກວດ Stock / ດຳເນີນອາໄຫຼ່" };
      }
      /**
       * ກັນຂໍຊື້ຊ້ຳ — ໃບຂໍຊື້ຢູ່ **ERP** ແລ້ວ (ບໍ່ແມ່ນ RQ ຂອງ ODS ອີກ) ⇒ ຖາມ ERP:
       * ອາໄຫຼ່ທີ່ຢູ່ໃນ SPR ຂອງວຽກນີ້ແລ້ວ ບໍ່ເອົາຄືນ. (doc_ref ຂອງ SPR = ລະຫັດວຽກ)
       */
      const onSpr = new Set(
        (
          await odg.query<{ item_code: string }>(
            `select distinct item_code from ic_trans_detail where trans_flag=$1 and doc_ref=$2`,
            [2, d.product_code],
          )
        ).rows.map((row) => row.item_code),
      );
      const required = (
        await client.query<{
          roworder: number; item_code: string; item_name: string | null; qty: string; unit_code: string | null;
        }>(
          `select min(s.roworder)::int roworder, s.item_code, max(s.item_name) item_name,
              sum(coalesce(s.qty,0))::text qty, max(s.unit_code) unit_code
             from tb_used_spare s
            where s.product_code=$1
            group by s.item_code order by min(s.roworder)`,
          [d.product_code],
        )
      ).rows.filter((line) => !onSpr.has(line.item_code));
      /**
       * ບໍ່ເຫຼືອຫຍັງໃຫ້ຊື້ ມີ 2 ຄວາມໝາຍທີ່ຄົນລະເລື່ອງກັນ — ຕ້ອງແຍກບອກ:
       *   ① ທຸກຕົວຖືກຂໍຊື້ໄປແລ້ວ (ຢູ່ SPR ໃບກ່ອນ) → ບອກເລກໃບ ບໍ່ແມ່ນ "ມີພໍແລ້ວ"
       *   ② stock ມີພໍແທ້ → ບອກວ່າຢູ່ສາງໃດ ໃຫ້ໄປຂໍເບີກ
       * ແຕ່ກ່ອນທັງສອງກໍລະນີໄດ້ຂໍ້ຄວາມດຽວກັນ "ມີພໍແລ້ວ ()" — ວົງເລັບຫວ່າງ ຄົນງົງ.
       */
      if (required.length === 0) {
        await client.query("rollback");
        await odg.query("rollback");
        const prior = [...onSpr].length
          ? (
              await odg.query<{ doc_no: string }>(
                `select distinct doc_no from ic_trans_detail where trans_flag=$1 and doc_ref=$2 order by doc_no desc limit 3`,
                [ERP_PURCHASE.PR_REQUEST, d.product_code],
              )
            ).rows.map((row) => row.doc_no)
          : [];
        return {
          error: prior.length
            ? `ອາໄຫຼ່ຂອງວຽກນີ້ຖືກຂໍຊື້ໄປແລ້ວ (${prior.join(", ")}) — ຕິດຕາມໄດ້ຢູ່ຄິວ "ອະນຸມັດຂໍສັ່ງຊື້"`
            : "ວຽກນີ້ບໍ່ມີລາຍການອາໄຫຼ່ໃຫ້ຂໍຊື້",
        };
      }
      let balances: Awaited<ReturnType<typeof getBalances>>;
      try {
        balances = await getBalances(required.map((line) => line.item_code));
      } catch (error) {
        await client.query("rollback");
        await odg.query("rollback");
        console.error("Direct purchase stock verification failed", error);
        return { error: "ກວດ stock ERP ບໍ່ສຳເລັດ — ກະລຸນາລອງໃໝ່, ຍັງບໍ່ໄດ້ສ້າງໃບສັ່ງຊື້" };
      }
      const shortage = required.flatMap((line) => {
        const qty = Math.max(0, Number(line.qty) - withdrawableQty(balances.get(line.item_code)));
        if (qty <= 0) return [];
        const rawPrice = Number(String(formData.get(`price_${line.roworder}`) ?? "0").replace(/,/g, ""));
        return [{ ...line, qty, price: Number.isFinite(rawPrice) && rawPrice >= 0 ? rawPrice : 0 }];
      });
      if (shortage.length === 0) {
        await client.query("rollback");
        await odg.query("rollback");
        // ບອກວ່າຂອງຢູ່ສາງໃດ — ຄົນຈະໄດ້ໄປຂໍເບີກຈາກສາງນັ້ນ ບໍ່ແມ່ນງົມຫາ
        const where = required
          .map((line) => `${line.item_code}: ${withdrawableWhere(balances.get(line.item_code))}`)
          .filter((text) => !text.endsWith(": "))
          .join(" · ");
        return { error: `ສາງມີອາໄຫຼ່ພໍແລ້ວ — ໃຫ້ຂໍເບີກແທນການສັ່ງຊື້${where ? ` (${where})` : ""}` };
      }

      /**
       * ── ອອກໃບຂໍຊື້ລົງ **ERP ບ່ອນດຽວ** (16-07-2026) ──
       * ແຕ່ກ່ອນຂຽນໃບ RQ (trans_flag=78) ລົງ **ODS** ແລ້ວກ໋ອບເປັນ SPR ໄປ ERP ອີກໃບ.
       * ແຕ່ **ERP ບໍ່ມີ trans_flag=78 ຈັກແຖວ** — ມັນໃຊ້ trans_flag=2 ເປັນໃບຂໍຊື້ທັງໝົດ
       * ⇒ RQ ກັບ SPR ຄື**ໃບດຽວກັນ ເກັບສອງບ່ອນ** ແລະ ນັ້ນຄືຕົ້ນເຫດຂອງ SPR ຜີ
       * (SPR25110002 ຢູ່ ODS ບໍ່ມີໃນ ERP — ວຽກ 5679 ຄ້າງ 8 ເດືອນ ໂດຍບໍ່ເຄີຍມີການສັ່ງຊື້).
       *
       * ດຽວນີ້: ໃບຢູ່ ERP · ODS ເກັບແຕ່ **ຂັ້ນຂອງວຽກ** (spare_order) ເຊິ່ງເປັນຂອງ ODS ແທ້.
       * ເລກໃບກໍ່ອອກຈາກ ERP (nextSprNo) ⇒ ບໍ່ມີທາງຊ້ຳກັບເລກທີ່ຄົນ ERP ອອກເອງ.
       */
      erpDocNo = await nextSprNo(odg, d.doc_date);
      await writeErpSpr(
        {
          doc_no: erpDocNo,
          doc_date: d.doc_date,
          doc_time: bangkokTime(),
          job_code: d.product_code,
          branch_code: d.branch_code,
          remark: d.remark,
          requester: session.username,
          lines: shortage,
        },
        odg,
      );
      // ຜູກໄວ້ຝັ່ງເຮົາ — ERP ຖືກແກ້ພາຍຫຼັງກໍ່ຍັງຮູ້ວ່າໃບນີ້ຂອງວຽກໃດ (lib/erp-doc-link)
      await linkErpDoc(client, {
        docNo: erpDocNo, transFlag: ERP_PURCHASE.PR_REQUEST,
        jobCode: d.product_code, by: session.username,
      });
    } else {
      /**
       * ເສັ້ນທາງໃບຂໍເບີກ (SIO) ທີ່ອອກໄປແລ້ວ ແຕ່ stock ບໍ່ພໍ — ອອກ SPR ລົງ **ERP ບ່ອນດຽວ**
       * ຄືກັນກັບເສັ້ນທາງຈາກຜົນກວດ. ODS ເກັບແຕ່ status=7 ຂອງແຖວ SIO (ຂັ້ນຂອງແຖວ
       * ເປັນຂອງ ODS ແທ້ — ຄິວ /purchase-requests ອ່ານມັນ).
       */
      const lines = await client.query<{
        roworder: number; item_code: string; item_name: string | null; unit_code: string | null;
        qty: string; price: string;
      }>(
        `select a.roworder, a.item_code, a.item_name, a.unit_code, coalesce(a.qty,0)::text qty,
            coalesce(a.price,0)::text price
           from ic_trans_detail a left join ic_inventory ic on ic.code=a.item_code
          where a.product_code=$1 and a.doc_no=$2
            and coalesce(ic.balance_qty,0)<coalesce(a.qty,0) and a.status not in (1,7,5)`,
        [d.product_code, d.doc_ref],
      );
      if (lines.rows.length === 0) {
        await client.query("rollback");
        await odg.query("rollback");
        return { error: "ບໍ່ມີລາຍການອາໄຫຼ່ທີ່ຕ້ອງສັ່ງຊື້" };
      }
      erpDocNo = await nextSprNo(odg, d.doc_date);
      await writeErpSpr(
        {
          doc_no: erpDocNo, doc_date: d.doc_date, doc_time: bangkokTime(),
          job_code: d.product_code, branch_code: d.branch_code, remark: d.remark,
          requester: session.username,
          lines: lines.rows.map((l) => ({ ...l, price: Number(l.price) })),
        },
        odg,
      );
      await client.query(`update ic_trans_detail set status=7 where roworder=any($1::int[])`, [
        lines.rows.map((row) => row.roworder),
      ]);
    }

    if (upload && uploadsDir) {
      const stored = `${erpDocNo}_0${extname(upload.filename).toLowerCase()}`;
      const path = join(uploadsDir, stored);
      await mkdir(uploadsDir, { recursive: true });
      await writeFile(path, upload.bytes);
      written.push(path);
      await client.query(
        `insert into product_image(iteme_code, product_url, line_number) values($1,$2,0)`,
        [erpDocNo, stored],
      );
    }

    // ຂຽນຄົບທັງສອງຖານແລ້ວຈຶ່ງ commit — ERP ລົ້ມຢູ່ບ່ອນໃດກໍ່ບໍ່ມີໃບຄ້າງເຄິ່ງທາງ
    await client.query("commit");
    await odg.query("commit");
  } catch (error) {
    await client.query("rollback").catch(() => {});
    await odg.query("rollback").catch(() => {});
    await Promise.all(written.map((path) => unlink(path).catch(() => {})));
    console.error("save_request_order failed", error);
    return { error: "ບັນທຶກບໍ່ສຳເລັດ ກະລຸນາກວດຂໍ້ມູນ" };
  } finally {
    client.release();
    odg.release();
  }

  // ໃບຂໍຊື້ (SPR) ອອກລົງ ERP ແລ້ວ — ລໍຜູ້ອະນຸມັດ (ເລກດຽວທັງສອງລະບົບ ເພາະມີບ່ອນດຽວ)
  await logChange(
    jobModel(d.product_code),
    d.product_code,
    `ອອກໃບຂໍສະເໜີຊື້ ${erpDocNo} ລົງ ERP ` +
      (d.source_type === "check" ? `(ຈາກຜົນກວດ)` : `(ອ້າງອີງໃບຂໍເບີກ ${d.doc_ref})`) +
      ` · ສັ່ງຜ່ານສາຂາ ${BRANCH_LABEL[d.branch_code]} — ລໍຖ້າອະນຸມັດ`,
    { roles: ROLE_APPROVER },
  );

  revalidatePath("/purchase-requests");
  revalidatePath("/approvals/purchase-requests");
  // ຄື Odoo: ສ້າງແລ້ວເປີດເອກະສານເລີຍ — ເຫັນ statusbar "ຂໍສະເໜີຊື້" + ປຸ່ມອະນຸມັດ (ຖ້າມີສິດ)
  redirect(`/purchase-orders/${encodeURIComponent(erpDocNo)}`);
}

/* ------------------------------------------------- /approverqorder (SPR) */

const approveSchema = z.object({
  doc_date: z.string().min(1),
  doc_ref: z.string().min(1), // ເລກ RQ
  remark: z.string().optional().default(""),
  product_code: z.string().optional().default(""),
});

/**
 * ອະນຸມັດໃບຂໍສັ່ງຊື້ (RQ) — **ບໍ່ອອກໃບສັ່ງຊື້ໃຫ້ອີກຕໍ່ໄປ** (16-07-2026).
 *
 * ── ນະໂຍບາຍ: ໃບສັ່ງຊື້ອອກຢູ່ **ERP ບ່ອນດຽວ** ──
 * ແຕ່ກ່ອນ action ນີ້ອອກໃບ SPR ລົງ **ທັງສອງຖານ** (ODS + ERP) ພ້ອມກັນ. ຂຽນສອງບ່ອນ
 * = ມີວັນຜິດກັນ ແລະ ບໍ່ມີໃຜຮູ້: ຂໍ້ມູນຈິງ **SPR25110002 ມີໃນ ODS ແຕ່ບໍ່ມີໃນ ERP ຈັກແຖວ**
 * ⇒ ວຽກ 5679 ຄ້າງຢູ່ "ກຳລັງສັ່ງຊື້" ຕັ້ງແຕ່ 29-11-2025 ໂດຍ**ບໍ່ເຄີຍມີການສັ່ງຊື້ຈິງ**.
 *
 * ດຽວນີ້: ODS ອະນຸມັດ RQ ແລ້ວ**ຢຸດ** · ຝ່າຍຈັດຊື້ໄປອອກໃບສັ່ງຊື້ຢູ່ ERP ເອງ
 * ໂດຍໃສ່ **doc_ref = ເລກ RQ ຂອງໃບນີ້** ⇒ ODS ອ່ານຄວາມຄືບໜ້າກັບຄືນມາເອງ
 * (lib/erp-purchase.ts). ຫຼັກການດຽວກັນກັບໃບເບີກ (lib/erp-dispatch.ts — ສາງເບີກຢູ່ ERP,
 * ODS ເປັນຝ່າຍອ່ານ).
 *
 * ຍັງຕັ້ງ spare_order ຢູ່ (ຂັ້ນ 7 "ກຳລັງສັ່ງຊື້ອາໄຫຼ່") ເພາະນັ້ນຄືສະຖານະຈິງ:
 * ອະນຸມັດໃຫ້ຊື້ແລ້ວ ລໍຝ່າຍຈັດຊື້ອອກໃບ. ຖ້າຍັງບໍ່ອອກ ຖັນ "ຄວາມຄືບໜ້າ (ERP)" ຈະຂຶ້ນ
 * "ບໍ່ພົບໃບຢູ່ ERP" ໃຫ້ເຫັນ — ບໍ່ຫາຍງຽບຄືເກົ່າ.
 */
export async function approveRqOrder(_: PurchaseState, formData: FormData): Promise<PurchaseState> {
  const guard = await requireRole(APPROVER_SIDE, "ບໍ່ມີສິດອະນຸມັດໃບຂໍສັ່ງຊື້ອາໄຫຼ່");
  if (!guard.ok) return { error: guard.error };
  const session = guard.session;
  if (!db) return { error: "ບໍ່ພົບການເຊື່ອມຕໍ່ຖານຂໍ້ມູນ" };

  const parsed = approveSchema.safeParse(
    Object.fromEntries([...formData.entries()].filter(([, value]) => typeof value === "string")),
  );
  if (!parsed.success) return { error: "ຂໍ້ມູນບໍ່ຄົບ" };
  const d = parsed.data;

  const client = await db.connect();
  let productCode = "";
  let requester = "";

  try {
    await client.query("begin");
    await client.query("select pg_advisory_xact_lock(734202)");

    // `for update` = ສອງຄົນກົດ "ອະນຸມັດ" ພ້ອມກັນ ຄົນທີ 2 ຕ້ອງລໍ ແລ້ວຈຶ່ງເຫັນວ່າອະນຸມັດໄປແລ້ວ
    const ref = await client.query<{
      doc_no: string;
      doc_date: string;
      doc_ref: string | null;
      product_code: string | null;
      user_created: string | null;
      aprove_status: number;
    }>(
      `select doc_no, doc_date, doc_ref, product_code, user_created, coalesce(aprove_status,0) aprove_status
         from ic_trans where doc_no=$1 and trans_flag=78 for update`,
      [d.doc_ref],
    );
    const rq = ref.rows[0];
    if (!rq) {
      await client.query("rollback");
      return { error: "ບໍ່ພົບໃບຂໍອະນຸມັດ" };
    }

    /**
     * ກັນການອະນຸມັດຊ້ຳ — ໃນ ods ໜ້າອະນຸມັດເປີດຈາກລິ້ງ/ແຈ້ງເຕືອນເກົ່າໄດ້ ແລະ ບໍ່ໄດ້ກວດ aprove_status
     * ⇒ ກົດ "ອະນຸມັດ" ອີກເທື່ອ = ອອກໃບສັ່ງຊື້ SPR ໃໝ່ໃຫ້ ERP ອີກໃບ (ຊື້ຂອງອັນດຽວກັນສອງເທື່ອ).
     * ຂໍ້ມູນຈິງ: 5 ໃບ RQ ມີ SPR ຊ້ຳກັນ 31 ຄູ່ ທີ່ມີອາໄຫຼ່ລາຍການດຽວກັນ (RQ2024010108 → SPR24010007/8, 27 ລາຍການ).
     */
    const priorSpr = await client.query<{ doc_no: string }>(
      `select doc_no from ic_trans where trans_flag=2 and doc_ref=$1 order by doc_no`,
      [d.doc_ref],
    );
    if (rq.aprove_status !== 0 || priorSpr.rows.length > 0) {
      await client.query("rollback");
      if (rq.aprove_status === 2) return { error: `ໃບຂໍສັ່ງຊື້ ${rq.doc_no} ຖືກປະຕິເສດໄປແລ້ວ` };
      const names = priorSpr.rows.map((row) => row.doc_no).join(", ");
      return {
        error: names
          ? `ໃບຂໍສັ່ງຊື້ ${rq.doc_no} ອະນຸມັດໄປແລ້ວ — ອອກໃບສັ່ງຊື້ ${names} ໃຫ້ແລ້ວ ອະນຸມັດຊ້ຳບໍ່ໄດ້`
          : `ໃບຂໍສັ່ງຊື້ ${rq.doc_no} ອະນຸມັດໄປແລ້ວ`,
      };
    }

    // ລະຫັດວຽກເອົາຈາກໃບ RQ ເອງ — ບໍ່ເຊື່ອຄ່າທີ່ສົ່ງມາທາງ form (ods ໃຊ້ຄ່າຈາກ form ໄປ update tb_product)
    productCode = rq.product_code ?? "";
    requester = rq.user_created ?? "";

    const detail = await client.query<{ item_code: string }>(
      `select a.item_code from ic_trans_detail a where a.doc_no=$1`,
      [d.doc_ref],
    );
    if (detail.rows.length === 0) {
      await client.query("rollback");
      return { error: "ໃບຂໍອະນຸມັດບໍ່ມີລາຍການອາໄຫຼ່" };
    }

    // ຮອງຮັບໃບເກົ່າທີ່ອ້າງ SIO: ໝາຍແຖວຕົ້ນທາງວ່າກຳລັງສັ່ງຊື້.
    // ໃບໃໝ່ຈາກຜົນກວດໃຊ້ CHECK:<job> ແລະ ບໍ່ມີ SIO ໃຫ້ update ຢູ່ຈຸດນີ້.
    if (rq.doc_ref && !rq.doc_ref.startsWith("CHECK:")) {
      await client.query(
        `update ic_trans_detail set status=5 where doc_no=$1 and item_code = any($2::varchar[])`,
        [rq.doc_ref, detail.rows.map((line) => line.item_code)],
      );
    }

    await client.query(
      `update ic_trans set remark_2=$1, approver1=$2, aprove_date1=localtimestamp(0), approve_at=localtimestamp(0), aprove_status=1
        where doc_no=$3 and trans_flag=78 and coalesce(aprove_status,0)=0`,
      [d.remark, session.username, d.doc_ref],
    );

    // ວຽກສ້ອມເທົ່ານັ້ນ (ງານຕິດຕັ້ງ INST- ບໍ່ໄດ້ຢູ່ tb_product) — ຂັ້ນ 7 "ກຳລັງສັ່ງຊື້ອາໄຫຼ່"
    if (productCode && jobModel(productCode) === "tb_product") {
      await client.query(`update tb_product set spare_order=localtimestamp(0) where code=$1`, [productCode]);
    }

    await client.query("commit");
  } catch (error) {
    await client.query("rollback").catch(() => {});
    console.error("approverqorder failed", error);
    return { error: "ອະນຸມັດບໍ່ສຳເລັດ ກະລຸນາລອງໃໝ່" };
  } finally {
    client.release();
  }

  /**
   * ບອກໃຫ້ຄົນຮູ້ວ່າ**ຍັງບໍ່ຈົບ** — ຕ້ອງມີຄົນໄປອອກໃບສັ່ງຊື້ຢູ່ ERP ຕໍ່.
   * ເນັ້ນເລກ RQ ໄວ້ ເພາະນັ້ນຄືເລກທີ່ຕ້ອງພິມໃສ່ຊ່ອງ **doc_ref** ຂອງໃບສັ່ງຊື້ໃນ ERP
   * ⇒ ODS ຈຶ່ງຜູກກັບຄືນມາຫາວຽກນີ້ ແລະ ຕິດຕາມຄວາມຄືບໜ້າໃຫ້ໄດ້.
   */
  if (productCode) {
    await logChange(
      jobModel(productCode),
      productCode,
      `ອະນຸມັດໃບຂໍສັ່ງຊື້ອາໄຫຼ່ ${d.doc_ref} — ຝ່າຍຈັດຊື້ໄປອອກໃບສັ່ງຊື້ຢູ່ ERP ໂດຍໃສ່ເລກອ້າງອີງ (doc_ref) = ${d.doc_ref}${d.remark ? ` · ${d.remark}` : ""}`,
      { users: requester ? [requester] : [], roles: ROLE_WAREHOUSE },
    );
  }

  revalidatePath("/approvals/purchase-requests");
  revalidatePath("/purchase-requests");
  revalidatePath("/dashboard");
  if (productCode) revalidatePath(`/service/${productCode}`);
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
type ReleasedRq = { productCode: string; requester: string; technician: string; released: boolean };

/**
 * ປິດໃບ RQ ທີ່ຍັງບໍ່ໄດ້ອອກໃບສັ່ງຊື້ (ບໍ່ອະນຸມັດ ຫຼື ຜູ້ຂໍຖອນຄືນເອງ) — ຂໍ້ຄວາມຜິດພາດເປັນພາສາລາວ
 * ພ້ອມບອກ "ໃບທີ່ຂວາງ" ຢູ່ ⇒ ຖອນຄືນຂ້າມໃບສັ່ງຊື້ທີ່ອອກໄປແລ້ວບໍ່ໄດ້ເດັດຂາດ.
 */
async function releaseRq(client: PoolClient, docNo: string): Promise<ReleasedRq | { error: string }> {
  const head = await client.query<{
    product_code: string | null;
    user_created: string | null;
    doc_ref: string | null;
    aprove_status: number;
  }>(
    `select product_code, user_created, doc_ref, coalesce(aprove_status,0) aprove_status
       from ic_trans where doc_no=$1 and trans_flag=78 for update`,
    [docNo],
  );
  const rq = head.rows[0];
  if (!rq) return { error: "ບໍ່ພົບໃບຂໍສັ່ງຊື້" };

  /**
   * ── ດ່ານ "ERP ລົງມືໄປແລ້ວ ຖອນບໍ່ໄດ້" ──
   * ແຕ່ກ່ອນຫາ `ic_trans` trans_flag=2 ຢູ່ **ODS** — ແຕ່ຫຼັງຍ້າຍການອອກໃບສັ່ງຊື້ໄປ ERP
   * ບ່ອນດຽວ ບໍ່ມີໃຜສ້າງແຖວນັ້ນໃນ ODS ອີກ ⇒ ດ່ານກາຍເປັນ**ດ່ານຕາຍ** (ຫາບໍ່ພົບສະເໝີ
   * ຈຶ່ງປ່ອຍຖອນໄດ້ທຸກເທື່ອ ເຖິງ ERP ຈະສັ່ງຂອງກັບຜູ້ສະໜອງໄປແລ້ວ).
   *
   * ດຽວນີ້ຖາມ ERP ຈິງ ດ້ວຍ **ສອງກຸນແຈ** (ເບິ່ງເຫດຜົນຢູ່ lib/erp-purchase):
   *   · ເລກ RQ — ໃບໃໝ່ທີ່ອອກໃນ ERP ຈະໃສ່ doc_ref = ເລກນີ້
   *   · ເລກ SPR ເກົ່າທີ່ຍັງຄ້າງຢູ່ ODS — ໃບເກົ່າຂອງ ERP doc_ref ຫວ່າງ ຈຶ່ງຫາຕາມ RQ ບໍ່ພົບ
   */
  const legacySpr = await client.query<{ doc_no: string }>(
    `select doc_no from ic_trans where trans_flag=2 and doc_ref=$1 order by doc_no`,
    [docNo],
  );
  const erpDoc = await erpPurchaseForRq([docNo, ...legacySpr.rows.map((row) => row.doc_no)]);
  if (erpDoc) {
    return {
      error: `ຖອນຄືນບໍ່ໄດ້ — ERP ${PURCHASE_STAGE_LABEL[erpDoc.stage]} ດ້ວຍໃບ ${erpDoc.doc} ແລ້ວ · ໃຫ້ຍົກເລີກໃບນັ້ນຢູ່ ERP ກ່ອນ`,
    };
  }
  if (rq.aprove_status === 1) return { error: `ໃບຂໍສັ່ງຊື້ ${docNo} ອະນຸມັດໄປແລ້ວ` };
  if (rq.aprove_status === 2) return { error: `ໃບຂໍສັ່ງຊື້ ${docNo} ຖືກປິດໄປແລ້ວ` };

  await client.query(`update ic_trans set aprove_status=2 where doc_no=$1 and trans_flag=78`, [docNo]);

  // ods ປົດ status=0 ໃຫ້ "ທຸກ" ແຖວຂອງໃບຂໍເບີກຕົ້ນທາງ → ລ້າງ status ຂອງແຖວທີ່ບໍ່ກ່ຽວນຳ.
  // ບ່ອນນີ້ປົດສະເພາະອາໄຫຼ່ທີ່ຢູ່ໃນໃບ RQ ນີ້ ແລະ ຍັງບໍ່ໄດ້ຖືກເບີກ (status 1) ເທົ່ານັ້ນ.
  await client.query(
    `update ic_trans_detail set status=0
      where doc_no=$2 and coalesce(status,0) <> 1
        and item_code in (select item_code from ic_trans_detail where doc_no=$1)`,
    [docNo, rq.doc_ref],
  );

  const result: ReleasedRq = {
    productCode: rq.product_code ?? "",
    requester: rq.user_created ?? "",
    technician: "",
    released: false,
  };

  // ວຽກສ້ອມ (tb_product) ເທົ່ານັ້ນ — ງານຕິດຕັ້ງ (INST-) ບໍ່ໄດ້ໃຊ້ຖັນເຫຼົ່ານີ້
  if (result.productCode && jobModel(result.productCode) === "tb_product") {
    // ນັບໃບຂໍຊື້ອື່ນທີ່ຍັງມີຜົນ ⇒ ຖ້າຍັງມີ ວຽກຕ້ອງຄ້າງຂັ້ນ 7 ຕໍ່ໄປ (ຂອງຍັງມາບໍ່ຮອດ)
    const others = await client.query<{ n: number }>(
      `select count(*)::int n from ic_trans
        where product_code=$1 and doc_no <> $2 and coalesce(doc_ref,'') <> $2
          and (trans_flag = 2 or (trans_flag = 78 and coalesce(aprove_status,0) = 1))`,
      [result.productCode, docNo],
    );
    if ((others.rows[0]?.n ?? 0) === 0) {
      const cleared = await client.query<{ emp_code: string | null }>(
        `update tb_product
            set spare_order = null, spare_arrive = null, spare_arrive_by = null
          where code = $1 and spare_order is not null
          returning emp_code`,
        [result.productCode],
      );
      result.released = (cleared.rowCount ?? 0) > 0;
      result.technician = cleared.rows[0]?.emp_code ?? "";
    }
  }
  return result;
}

/** ລ້າງ cache ຂອງທຸກໜ້າທີ່ໄດ້ຮັບຜົນຈາກການປິດໃບ RQ */
function revalidateRq(productCode: string) {
  revalidatePath("/approvals/purchase-requests");
  revalidatePath("/purchase-requests");
  revalidatePath("/stock/dispatch");
  revalidatePath("/dashboard");
  if (productCode) revalidatePath(`/service/${productCode}`);
}

export async function notApproveRqOrder(_: PurchaseState, formData: FormData): Promise<PurchaseState> {
  const guard = await requireRole(APPROVER_SIDE, "ບໍ່ມີສິດອະນຸມັດ ຫຼື ປະຕິເສດໃບຂໍສັ່ງຊື້");
  if (!guard.ok) return { error: guard.error };
  const session = guard.session;
  if (!db) return { error: "ບໍ່ພົບ DATABASE_URL" };

  const docNo = String(formData.get("doc_no") ?? "");
  if (!docNo) return { error: "ຂໍ້ມູນບໍ່ຄົບ" };

  const client = await db.connect();
  let done: ReleasedRq;
  try {
    await client.query("begin");
    const result = await releaseRq(client, docNo);
    if ("error" in result) {
      await client.query("rollback");
      return { error: result.error };
    }
    done = result;
    await client.query("commit");
  } catch (error) {
    await client.query("rollback").catch(() => {});
    console.error("not_approverqorder failed", error);
    return { error: "ບັນທຶກບໍ່ສຳເລັດ" };
  } finally {
    client.release();
  }

  if (done.productCode) {
    // ຊ່າງ (ຄົນລໍອາໄຫຼ່) + ຜູ້ຂໍ ຕ້ອງຮູ້ວ່າໃບຂໍຊື້ຕົກ ແລະ ວຽກກັບມາຢູ່ຂັ້ນອາໄຫຼ່ແລ້ວ
    const users = [done.technician, done.requester].filter((name) => name && name !== session.username);
    await logChange(
      jobModel(done.productCode),
      done.productCode,
      `ບໍ່ອະນຸມັດໃບຂໍສັ່ງຊື້ອາໄຫຼ່ ${docNo}` +
        (done.released
          ? " — ຍົກເລີກສະຖານະ “ກຳລັງສັ່ງຊື້ອາໄຫຼ່” ວຽກກັບໄປຂັ້ນອາໄຫຼ່ ລໍຖ້າການລົງມືໃໝ່"
          : ""),
      { users },
    );
  }

  revalidateRq(done.productCode);
  redirect("/approvals/purchase-requests");
}

/* --------------------------------------------- ຖອນໃບຂໍສັ່ງຊື້ຄືນ (ກົດຜິດ) */

/**
 * ຜູ້ຂໍກົດ "ສັ່ງຊື້" ຜິດໃບ → ຖອນຄືນເອງໄດ້ ຕາບໃດທີ່ຍັງບໍ່ທັນອະນຸມັດ.
 * ໃນ ods ບໍ່ມີທາງນີ້ເລີຍ: ພໍກົດແລ້ວແຖວອາໄຫຼ່ຄາ status=7 ຈົນກວ່າຜູ້ອະນຸມັດຈະປະຕິເສດໃຫ້.
 * ອອກໃບສັ່ງຊື້ (SPR) ໄປແລ້ວ ຖອນບໍ່ໄດ້ — releaseRq ຈະປະຕິເສດ ພ້ອມບອກເລກໃບທີ່ຂວາງຢູ່.
 */
export async function withdrawRequestOrder(rawDocNo: string): Promise<PurchaseState> {
  const guard = await requireRole(PURCHASE_SIDE, "ບໍ່ມີສິດຖອນໃບຂໍສັ່ງຊື້");
  if (!guard.ok) return { error: guard.error };
  const session = guard.session;
  if (!db) return { error: "ບໍ່ພົບ DATABASE_URL" };

  const parsed = z.string().trim().min(1).max(50).safeParse(rawDocNo);
  if (!parsed.success) return { error: "ເລກໃບຂໍສັ່ງຊື້ບໍ່ຖືກຕ້ອງ" };
  const docNo = parsed.data;

  const client = await db.connect();
  let done: ReleasedRq;
  try {
    await client.query("begin");
    const result = await releaseRq(client, docNo);
    if ("error" in result) {
      await client.query("rollback");
      return { error: result.error };
    }
    done = result;
    await client.query("commit");
  } catch (error) {
    await client.query("rollback").catch(() => {});
    console.error("withdrawRequestOrder failed", error);
    return { error: "ຖອນຄືນບໍ່ສຳເລັດ ກະລຸນາລອງໃໝ່" };
  } finally {
    client.release();
  }

  if (done.productCode) {
    const users = [done.technician, done.requester].filter((name) => name && name !== session.username);
    await logChange(
      jobModel(done.productCode),
      done.productCode,
      `ຖອນໃບຂໍສັ່ງຊື້ອາໄຫຼ່ ${docNo} ຄືນ (ໂດຍ ${session.username}) — ອາໄຫຼ່ກັບໄປລໍຖ້າການສັ່ງຊື້ໃໝ່`,
      { users, roles: ROLE_APPROVER },
    );
  }

  revalidateRq(done.productCode);
  return {};
}

/* ------------------------------------------------ /save_pr (orderspare.py) */

/**
 * ອອກໃບສັ່ງຊື້ໃຫ້ອາໄຫຼ່ 1 ລາຍການ ໂດຍບໍ່ຜ່ານ RQ — **ປິດແລ້ວ** (16-07-2026).
 *
 * ນະໂຍບາຍໃໝ່: ໃບສັ່ງຊື້ອອກຢູ່ **ERP ບ່ອນດຽວ** (ເບິ່ງ approveRqOrder).
 * ເສັ້ນທາງນີ້ອອກໃບ SPR ລົງ ODS+ERP ໂດຍ**ບໍ່ມີເລກ RQ**ຈັກເລີຍ ⇒ ຖ້າຍັງເປີດໄວ້
 * ໃບທີ່ອອກຈະບໍ່ມີບ່ອນອ້າງອີງກັບຄືນມາຫາວຽກ ແລະ ຕິດຕາມຄວາມຄືບໜ້າບໍ່ໄດ້.
 * ⇒ ທຸກການສັ່ງຊື້ຕ້ອງຜ່ານ RQ ເພື່ອໃຫ້ມີເລກອ້າງອີງໃຫ້ ERP ຜູກກັບຄືນ.
 */
export async function savePr(_: PurchaseState): Promise<PurchaseState> {
  return {
    error:
      "ລະບົບນີ້ອອກໃບສັ່ງຊື້ບໍ່ໄດ້ອີກ — ໃຫ້ສ້າງໃບຂໍອະນຸມັດ (RQ) ກ່ອນ ແລ້ວຝ່າຍຈັດຊື້ອອກໃບສັ່ງຊື້ຢູ່ ERP ໂດຍໃສ່ເລກ RQ ເປັນເລກອ້າງອີງ",
  };
}


/* ═══════════ ອະນຸມັດຢູ່ ERP — SPR → WPRA+PO → WPOA (ບໍ່ແຕະ RQ ຂອງ ODS) ═══════════ */

const approveSprSchema = z.object({
  spr_no: z.string().trim().min(1).max(50),
});

/**
 * ອະນຸມັດໃບຂໍສະເໜີຊື້ (SPR) — ຂຽນ **WPRA ຢ່າງດຽວ** ລົງ ERP.
 * **ບໍ່ຖາມຜູ້ສະໜອງ** — ນະໂຍບາຍ (16-07-2026): ຜູ້ສະໜອງເລືອກຕອນ**ອອກ PO**
 * (issuePoOrder ຫຼື ອອກໃນ ERP ໂດຍກົງ — ທັງສອງທາງ tracking ຈັບໄດ້).
 * ODS ຖືກແຕະບ່ອນດຽວ: tb_product.spare_order (ຂັ້ນ 7 — ຂັ້ນຂອງວຽກເປັນຂອງ ODS ແທ້).
 */
export async function approveSprOrder(_: PurchaseState, formData: FormData): Promise<PurchaseState> {
  const guard = await requireRole(APPROVER_SIDE, "ບໍ່ມີສິດອະນຸມັດໃບຂໍສັ່ງຊື້ອາໄຫຼ່");
  if (!guard.ok) return { error: guard.error };
  if (!db || !odgDb) return { error: "ບໍ່ພົບການເຊື່ອມຕໍ່ຖານຂໍ້ມູນ" };

  const parsed = approveSprSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "ບໍ່ພົບເລກໃບ" };
  const { spr_no } = parsed.data;

  const odg = await odgDb.connect();
  let wpra = "";
  let jobCode = "";
  try {
    await odg.query("begin");
    // ຫົວໃບ SPR — ເອົາວຽກ/ສາຂາຈາກ ERP ເອງ (ບໍ່ຮັບຈາກ form) + ລັອກກັນອະນຸມັດຊ້ອນ
    const head = (
      await odg.query<{ doc_ref: string | null; branch_code: string | null }>(
        `select doc_ref, branch_code from ic_trans
          where doc_no=$1 and trans_flag=$2 and doc_format_code='SPR' for update`,
        [spr_no, ERP_PURCHASE.PR_REQUEST],
      )
    ).rows[0];
    if (!head) { await odg.query("rollback"); return { error: `ບໍ່ພົບໃບຂໍຊື້ ${spr_no} ໃນ ERP` }; }
    jobCode = (head.doc_ref ?? "").split(" ")[0];

    // ອະນຸມັດຊ້ຳບໍ່ໄດ້ — ມີ WPRA ອ້າງອີງໃບນີ້ແລ້ວ = ຈົບ
    const dup = await odg.query(
      `select 1 from ic_trans_detail where trans_flag=$1 and ref_doc_no=$2 limit 1`,
      [ERP_PURCHASE.PR_APPROVE, spr_no],
    );
    if (dup.rowCount) { await odg.query("rollback"); return { error: `ໃບ ${spr_no} ອະນຸມັດໄປແລ້ວ` }; }

    wpra = await approvePr(odg, {
      sprNo: spr_no, jobCode, branch: head.branch_code ?? "00",
      doc_date: new Date().toISOString().slice(0, 10), doc_time: bangkokTime(),
      approver: guard.session.username,
    });
    await odg.query("commit");
  } catch (error) {
    await odg.query("rollback").catch(() => {});
    console.error("approveSprOrder failed", error);
    return { error: "ອະນຸມັດບໍ່ສຳເລັດ ກະລຸນາລອງໃໝ່" };
  } finally {
    odg.release();
  }

  // ວຽກສ້ອມເຂົ້າຂັ້ນ 7 "ກຳລັງສັ່ງຊື້ອາໄຫຼ່" — ຂັ້ນຂອງວຽກຢູ່ ODS
  if (jobCode && jobModel(jobCode) === "tb_product") {
    await db.query(`update tb_product set spare_order=localtimestamp(0) where code=$1 and spare_order is null`, [jobCode]);
  }
  // ຜູກ WPRA ກັບວຽກ — ໃບອະນຸມັດກໍ່ຖືກແກ້ໃນ ERP ໄດ້ຄືກັນ
  if (jobCode && wpra && db) {
    const link = await db.connect();
    try {
      await linkErpDoc(link, {
        docNo: wpra, transFlag: ERP_PURCHASE.PR_APPROVE, jobCode, by: guard.session.username,
      });
    } finally {
      link.release();
    }
  }
  if (jobCode) {
    await logChange(jobModel(jobCode), jobCode,
      `ອະນຸມັດໃບຂໍຊື້ ${spr_no} (${wpra}) — ລໍອອກໃບສັ່ງຊື້ + ເລືອກຜູ້ສະໜອງ ຢູ່ເມນູ "ໃບສັ່ງຊື້ (PO)" ຫຼື ໃນ ERP`,
      { roles: ROLE_WAREHOUSE });
  }
  revalidatePath("/approvals/purchase-requests");
  revalidatePath("/purchase-requests");
  revalidatePath("/purchase-orders");
  // ຕົວເລກຄິວຢູ່ເມນູ cache ໄວ້ 60 ວິ — ຄົນທີ່ຫາກໍລົງມືຕ້ອງເຫັນເລກໃໝ່ທັນທີ (read-your-own-writes)
  updateTag(PURCHASE_COUNT_TAG);
  revalidatePath("/dashboard");
  // ອະນຸມັດໄດ້ຈາກຫຼາຍໜ້າ — ກັບຄືນບ່ອນທີ່ກົດ (whitelist ກັນ open redirect)
  redirect(purchaseBack(formData, "/approvals/purchase-requests"));
}

/**
 * ອອກໃບສັ່ງຊື້ (PO) ຈາກ WPRA — **ຂັ້ນນີ້ບັງຄັບເລືອກຜູ້ສະໜອງ** (AP Supplier ຈາກ ERP).
 * PO ອອກນອກ ODSS ໄດ້ຄືກັນ (ໃນ ERP ໂດຍກົງ) — tracking ຈັບທັງສອງທາງ.
 */
export async function issuePoOrder(_: PurchaseState, formData: FormData): Promise<PurchaseState> {
  const guard = await requireRole(PURCHASE_SIDE, "ບໍ່ມີສິດອອກໃບສັ່ງຊື້");
  if (!guard.ok) return { error: guard.error };
  if (!odgDb) return { error: "ບໍ່ພົບ ODG_DATABASE_URL" };

  const wpra_no = String(formData.get("wpra_no") ?? "").trim();
  const supplier = String(formData.get("supplier") ?? "").trim();
  if (!wpra_no) return { error: "ບໍ່ພົບເລກໃບອະນຸມັດ" };
  if (!supplier) return { error: "ກະລຸນາເລືອກຜູ້ສະໜອງ" };
  const ship = shippingSchema.safeParse({
    send_date: String(formData.get("send_date") ?? ""),
    transport_code: String(formData.get("transport_code") ?? ""),
    wh_code: String(formData.get("wh_code") ?? ""),
  });
  if (!ship.success) return { error: ship.error.issues[0]?.message ?? "ຂໍ້ມູນຈັດສົ່ງບໍ່ຄົບ" };
  const terms = termsSchema.safeParse({
    currency_code: String(formData.get("currency_code") ?? ""),
    exchange_rate: String(formData.get("exchange_rate") ?? ""),
    vat_type: String(formData.get("vat_type") ?? ""),
    vat_rate: String(formData.get("vat_rate") ?? ""),
    credit_day: String(formData.get("credit_day") ?? "0"),
  });
  if (!terms.success) return { error: terms.error.issues[0]?.message ?? "ຂໍ້ມູນສະກຸນເງິນ/VAT ບໍ່ຄົບ" };
  const shipErr = await checkShipping(ship.data, terms.data);
  if (shipErr) return { error: shipErr };

  // ຢືນຢັນຜູ້ສະໜອງກັບ ERP — ຢ່າເຊື່ອຄ່າຈາກ form
  const vendor = await supplierByCode(supplier);
  if (!vendor) return { error: `ບໍ່ພົບຜູ້ສະໜອງ ${supplier} ໃນ ERP` };

  /**
   * ແຖວທີ່ຈັດຊື້ແກ້ (ຈຳນວນ/ລາຄາ) — ຟອມ PO ສົ່ງມາ. ບໍ່ສົ່ງ = ໃຊ້ແຖວຂອງ WPRA ຕາມເດີມ.
   * ຈຳເປັນ: ໃບຂໍຊື້ຂອງຊ່າງ **ບໍ່ມີລາຄາ** (price=0) ⇒ ກ໋ອບເສີຍໆ PO ຈະອອກໄປດ້ວຍລາຄາ 0.
   */
  let editedLines: { item_code: string; qty: number; price: number }[] | null = null;
  const rawLines = formData.get("lines");
  if (rawLines) {
    try {
      const parsedLines = z
        .array(z.object({ item_code: z.string().trim().min(1), qty: z.coerce.number().positive(), price: z.coerce.number().min(0) }))
        .min(1, "ຕ້ອງມີຢ່າງໜ້ອຍ 1 ລາຍການ")
        .safeParse(JSON.parse(String(rawLines)));
      if (!parsedLines.success) return { error: parsedLines.error.issues[0]?.message ?? "ລາຍການບໍ່ຖືກຕ້ອງ" };
      editedLines = parsedLines.data;
    } catch {
      return { error: "ຂໍ້ມູນລາຍການບໍ່ຖືກຮູບແບບ" };
    }
  }

  const odg = await odgDb.connect();
  let po = "";
  let jobCode = "";
  try {
    await odg.query("begin");
    const head = (
      await odg.query<{ doc_ref: string | null; branch_code: string | null }>(
        `select doc_ref, branch_code from ic_trans
          where doc_no=$1 and trans_flag=$2 for update`,
        [wpra_no, ERP_PURCHASE.PR_APPROVE],
      )
    ).rows[0];
    if (!head) { await odg.query("rollback"); return { error: `ບໍ່ພົບໃບອະນຸມັດ ${wpra_no} ໃນ ERP` }; }
    // doc_ref ຂອງ WPRA = ເລກ SPR ⇒ ວຽກ = doc_ref ຂອງ SPR
    const spr = (head.doc_ref ?? "").split(" ")[0];
    jobCode = (
      await odg.query<{ job: string }>(
        `select split_part(trim(coalesce(doc_ref,'')),' ',1) job from ic_trans where doc_no=$1 and trans_flag=$2`,
        [spr, ERP_PURCHASE.PR_REQUEST],
      )
    ).rows[0]?.job ?? "";

    // ອອກຊ້ຳບໍ່ໄດ້ — ມີ PO ອ້າງອີງ WPRA ນີ້ແລ້ວ (ຈາກ ODSS ຫຼື ຈາກ ERP ເອງ)
    const dup = await odg.query(
      `select 1 from ic_trans_detail where trans_flag=$1 and ref_doc_no=$2 limit 1`,
      [ERP_PURCHASE.ORDER, wpra_no],
    );
    if (dup.rowCount) { await odg.query("rollback"); return { error: `ໃບ ${wpra_no} ອອກ PO ໄປແລ້ວ` }; }

    /**
     * ແຖວທີ່ສົ່ງມາຕ້ອງເປັນ item ຂອງ WPRA ໃບນີ້ເທົ່ານັ້ນ — ຢ່າເຊື່ອ browser
     * (ບໍ່ດັ່ງນັ້ນຄົນຍັດ item ນອກໃບຂໍຊື້ເຂົ້າ PO ໄດ້ ໂດຍຂ້າມການອະນຸມັດ).
     */
    let lines;
    if (editedLines) {
      const src = await linesOf(odg, wpra_no, ERP_PURCHASE.PR_APPROVE);
      const allowed = new Map(src.map((line) => [line.item_code, line]));
      const stray = editedLines.filter((line) => !allowed.has(line.item_code));
      if (stray.length) {
        await odg.query("rollback");
        return { error: `ອາໄຫຼ່ບໍ່ຢູ່ໃນໃບອະນຸມັດ: ${stray.map((l) => l.item_code).join(", ")}` };
      }
      lines = editedLines.map((line) => ({
        item_code: line.item_code,
        item_name: allowed.get(line.item_code)?.item_name ?? "",
        unit_code: allowed.get(line.item_code)?.unit_code ?? "",
        qty: String(line.qty),
        price: String(line.price),
      }));
    }

    po = await issuePo(odg, {
      wpraNo: wpra_no, jobCode, branch: head.branch_code ?? "00", supplier: vendor.code,
      doc_date: new Date().toISOString().slice(0, 10), doc_time: bangkokTime(),
      issuer: guard.session.username, shipping: ship.data, terms: terms.data, lines,
    });
    await odg.query("commit");
  } catch (error) {
    await odg.query("rollback").catch(() => {});
    console.error("issuePoOrder failed", error);
    return { error: "ອອກໃບສັ່ງຊື້ບໍ່ສຳເລັດ ກະລຸນາລອງໃໝ່" };
  } finally {
    odg.release();
  }

  if (jobCode && jobModel(jobCode) === "tb_product") {
    await logChange("tb_product", jobCode,
      `ອອກໃບສັ່ງຊື້ ${po} (ຜູ້ສະໜອງ: ${vendor.name}) ຈາກ ${wpra_no} — ລໍອະນຸມັດ PO`,
      { roles: ROLE_WAREHOUSE });
  }
  revalidatePath("/purchase-orders");
  // ຕົວເລກຄິວຢູ່ເມນູ cache ໄວ້ 60 ວິ — ຄົນທີ່ຫາກໍລົງມືຕ້ອງເຫັນເລກໃໝ່ທັນທີ (read-your-own-writes)
  updateTag(PURCHASE_COUNT_TAG);
  redirect(purchaseBack(formData, "/purchase-orders"));
}

/**
 * ປະຕິເສດໃບຂໍຊື້ — **ລຶບ SPR ອອກຈາກ ERP** (ຍັງບໍ່ມີ WPRA ເທົ່ານັ້ນ).
 * ວຽກກັບໄປຂັ້ນ 5 ໃຫ້ຊ່າງ/ຈັດຊື້ແກ້ລາຍການແລ້ວຂໍໃໝ່ (ຄື deleteErpRequest ຂອງໃບຂໍເບີກ).
 */
export async function rejectSprOrder(_: PurchaseState, formData: FormData): Promise<PurchaseState> {
  const guard = await requireRole(APPROVER_SIDE, "ບໍ່ມີສິດປະຕິເສດໃບຂໍສັ່ງຊື້");
  if (!guard.ok) return { error: guard.error };
  if (!odgDb) return { error: "ບໍ່ພົບ ODG_DATABASE_URL" };

  const spr_no = String(formData.get("spr_no") ?? "").trim();
  if (!spr_no) return { error: "ບໍ່ພົບເລກໃບ" };

  const odg = await odgDb.connect();
  let jobCode = "";
  try {
    await odg.query("begin");
    const head = (
      await odg.query<{ doc_ref: string | null }>(
        `select doc_ref from ic_trans where doc_no=$1 and trans_flag=$2 and doc_format_code='SPR' for update`,
        [spr_no, ERP_PURCHASE.PR_REQUEST],
      )
    ).rows[0];
    if (!head) { await odg.query("rollback"); return { error: `ບໍ່ພົບໃບ ${spr_no}` }; }
    jobCode = (head.doc_ref ?? "").split(" ")[0];

    const approved = await odg.query(
      `select 1 from ic_trans_detail where trans_flag=$1 and ref_doc_no=$2 limit 1`,
      [ERP_PURCHASE.PR_APPROVE, spr_no],
    );
    if (approved.rowCount) { await odg.query("rollback"); return { error: `ໃບ ${spr_no} ອະນຸມັດໄປແລ້ວ — ປະຕິເສດບໍ່ໄດ້` }; }

    await odg.query(`delete from ic_trans_detail where doc_no=$1 and trans_flag=$2`, [spr_no, ERP_PURCHASE.PR_REQUEST]);
    await odg.query(`delete from ic_trans where doc_no=$1 and trans_flag=$2`, [spr_no, ERP_PURCHASE.PR_REQUEST]);
    await odg.query("commit");
  } catch (error) {
    await odg.query("rollback").catch(() => {});
    console.error("rejectSprOrder failed", error);
    return { error: "ປະຕິເສດບໍ່ສຳເລັດ ກະລຸນາລອງໃໝ່" };
  } finally {
    odg.release();
  }

  if (jobCode) {
    await logChange(jobModel(jobCode), jobCode, `ປະຕິເສດໃບຂໍຊື້ ${spr_no} — ລຶບອອກຈາກ ERP, ວຽກກັບໄປດຳເນີນອາໄຫຼ່ໃໝ່`);
  }
  revalidatePath("/approvals/purchase-requests");
  revalidatePath("/purchase-requests");
  // ⚠️ ຫ້າມກັບໄປໜ້າເອກະສານ /purchase-orders/<SPR> — ໃບຫາກໍຖືກລຶບ ⇒ ຈະ 404
  const back = purchaseBack(formData, "/approvals/purchase-requests");
  redirect(back.startsWith("/purchase-orders/") ? "/purchase-orders" : back);
}

/**
 * ຕ່ອງໂສ້ຂອງ SPR — ໃບອະນຸມັດ (WPRA) ທີ່ອ້າງອີງມັນ ແລະ ໃບສັ່ງຊື້ (PO) ທີ່ອອກຈາກ WPRA ນັ້ນ.
 * ໃຊ້ກວດກ່ອນ **ຖອນການອະນຸມັດ** ຫຼື **ລົບທັງໃບ** — ນິຍາມບ່ອນດຽວ ສອງ action ຈຶ່ງ
 * ກວດດ້ວຍກົດດຽວກັນ (ບໍ່ດັ່ງນັ້ນອັນໜຶ່ງຫຼວມກວ່າອີກອັນຢ່າງງຽບໆ).
 */
async function sprChainOf(odg: PoolClient, sprNo: string) {
  const wpras = (
    await odg.query<{ doc_no: string }>(
      `select distinct doc_no from ic_trans_detail where trans_flag=$1 and ref_doc_no=$2`,
      [ERP_PURCHASE.PR_APPROVE, sprNo],
    )
  ).rows.map((row) => row.doc_no);
  const pos = wpras.length
    ? (
        await odg.query<{ doc_no: string }>(
          `select distinct doc_no from ic_trans_detail where trans_flag=$1 and ref_doc_no = any($2::text[])`,
          [ERP_PURCHASE.ORDER, wpras],
        )
      ).rows.map((row) => row.doc_no)
    : [];
  return { wpras, pos };
}

/** ລຶບໃບອອກຈາກ ERP ໃຫ້ໝົດ (ຫົວ + ແຖວ) — ໃຊ້ຮ່ວມກັນລະຫວ່າງ ຖອນອະນຸມັດ ແລະ ລົບທັງໃບ */
async function dropErpDocs(odg: PoolClient, docNos: string[], transFlag: number) {
  if (!docNos.length) return;
  await odg.query(`delete from ic_trans_detail where doc_no = any($1::text[]) and trans_flag=$2`, [docNos, transFlag]);
  await odg.query(`delete from ic_trans where doc_no = any($1::text[]) and trans_flag=$2`, [docNos, transFlag]);
}

/**
 * **ຖອນການອະນຸມັດ** — ລຶບ WPRA ອອກຈາກ ERP, ໃບ SPR **ຢູ່ຄືເກົ່າ** ⇒ ກັບໄປ "ລໍອະນຸມັດ".
 * ໃຊ້ຕອນອະນຸມັດຜິດໃບ. ອອກ PO ໄປແລ້ວ ຖອນບໍ່ໄດ້ (ຕ້ອງຍົກເລີກ PO ກ່ອນ) —
 * ບໍ່ດັ່ງນັ້ນ PO ຈະລອຍໂດຍບໍ່ມີໃບອະນຸມັດຮອງຮັບ.
 */
export async function unapproveSprOrder(_: PurchaseState, formData: FormData): Promise<PurchaseState> {
  const guard = await requireRole(APPROVER_SIDE, "ບໍ່ມີສິດຖອນການອະນຸມັດ");
  if (!guard.ok) return { error: guard.error };
  if (!odgDb) return { error: "ບໍ່ພົບ ODG_DATABASE_URL" };

  const spr_no = String(formData.get("spr_no") ?? "").trim();
  if (!spr_no) return { error: "ບໍ່ພົບເລກໃບ" };

  const odg = await odgDb.connect();
  let jobCode = "";
  let removed: string[] = [];
  try {
    await odg.query("begin");
    const head = (
      await odg.query<{ doc_ref: string | null }>(
        `select doc_ref from ic_trans where doc_no=$1 and trans_flag=$2 and doc_format_code='SPR' for update`,
        [spr_no, ERP_PURCHASE.PR_REQUEST],
      )
    ).rows[0];
    if (!head) { await odg.query("rollback"); return { error: `ບໍ່ພົບໃບ ${spr_no}` }; }
    jobCode = (head.doc_ref ?? "").split(" ")[0];

    const { wpras, pos } = await sprChainOf(odg, spr_no);
    if (!wpras.length) { await odg.query("rollback"); return { error: `ໃບ ${spr_no} ຍັງບໍ່ໄດ້ອະນຸມັດ` }; }
    if (pos.length) {
      await odg.query("rollback");
      return { error: `ອອກໃບສັ່ງຊື້ໄປແລ້ວ (${pos.join(", ")}) — ຕ້ອງຍົກເລີກໃບສັ່ງຊື້ກ່ອນ` };
    }

    await dropErpDocs(odg, wpras, ERP_PURCHASE.PR_APPROVE);
    await odg.query("commit");
    removed = wpras;
  } catch (error) {
    await odg.query("rollback").catch(() => {});
    console.error("unapproveSprOrder failed", error);
    return { error: "ຖອນການອະນຸມັດບໍ່ສຳເລັດ ກະລຸນາລອງໃໝ່" };
  } finally {
    odg.release();
  }

  if (jobCode) {
    await logChange(jobModel(jobCode), jobCode, `ຖອນການອະນຸມັດໃບຂໍຊື້ ${spr_no} — ລຶບ ${removed.join(", ")} ອອກຈາກ ERP, ໃບກັບໄປລໍອະນຸມັດ`);
  }
  updateTag(PURCHASE_COUNT_TAG);
  revalidatePath("/approvals/purchase-requests");
  revalidatePath("/purchase-requests");
  redirect(purchaseBack(formData, `/purchase-orders/${encodeURIComponent(spr_no)}`));
}

/**
 * **ລົບທັງໃບ** — ລຶບ SPR + WPRA ອອກຈາກ ERP ⇒ ເທົ່າກັບບໍ່ເຄີຍຂໍຊື້.
 * ວຽກກັບໄປຂັ້ນ "ຕ້ອງສັ່ງຊື້" ໃໝ່ (ຄື rejectSprOrder ແຕ່ລົບໃບທີ່ອະນຸມັດແລ້ວໄດ້ນຳ).
 * ອອກ PO ໄປແລ້ວ ລົບບໍ່ໄດ້ — ຕ້ອງຍົກເລີກ PO ກ່ອນ.
 */
export async function deleteSprOrder(_: PurchaseState, formData: FormData): Promise<PurchaseState> {
  const guard = await requireRole(APPROVER_SIDE, "ບໍ່ມີສິດລົບໃບຂໍສັ່ງຊື້");
  if (!guard.ok) return { error: guard.error };
  if (!odgDb) return { error: "ບໍ່ພົບ ODG_DATABASE_URL" };

  const spr_no = String(formData.get("spr_no") ?? "").trim();
  if (!spr_no) return { error: "ບໍ່ພົບເລກໃບ" };

  const odg = await odgDb.connect();
  let jobCode = "";
  try {
    await odg.query("begin");
    const head = (
      await odg.query<{ doc_ref: string | null }>(
        `select doc_ref from ic_trans where doc_no=$1 and trans_flag=$2 and doc_format_code='SPR' for update`,
        [spr_no, ERP_PURCHASE.PR_REQUEST],
      )
    ).rows[0];
    if (!head) { await odg.query("rollback"); return { error: `ບໍ່ພົບໃບ ${spr_no}` }; }
    jobCode = (head.doc_ref ?? "").split(" ")[0];

    const { wpras, pos } = await sprChainOf(odg, spr_no);
    if (pos.length) {
      await odg.query("rollback");
      return { error: `ອອກໃບສັ່ງຊື້ໄປແລ້ວ (${pos.join(", ")}) — ຕ້ອງຍົກເລີກໃບສັ່ງຊື້ກ່ອນ` };
    }

    // ລຶບຈາກປາຍຕ່ອງໂສ້ເຂົ້າມາ: WPRA ກ່ອນ ແລ້ວຈຶ່ງ SPR
    await dropErpDocs(odg, wpras, ERP_PURCHASE.PR_APPROVE);
    await dropErpDocs(odg, [spr_no], ERP_PURCHASE.PR_REQUEST);
    await odg.query("commit");
  } catch (error) {
    await odg.query("rollback").catch(() => {});
    console.error("deleteSprOrder failed", error);
    return { error: "ລົບບໍ່ສຳເລັດ ກະລຸນາລອງໃໝ່" };
  } finally {
    odg.release();
  }

  if (jobCode) {
    await logChange(jobModel(jobCode), jobCode, `ລົບໃບຂໍຊື້ ${spr_no} ອອກຈາກ ERP — ວຽກກັບໄປດຳເນີນອາໄຫຼ່ໃໝ່`);
  }
  updateTag(PURCHASE_COUNT_TAG);
  revalidatePath("/approvals/purchase-requests");
  revalidatePath("/purchase-requests");
  // ⚠️ ຫ້າມກັບໄປໜ້າເອກະສານ /purchase-orders/<SPR> — ໃບຫາກໍຖືກລຶບ ⇒ ຈະ 404
  const back = purchaseBack(formData, "/purchase-requests");
  redirect(back.startsWith("/purchase-orders/") ? "/purchase-requests" : back);
}

/** ອະນຸມັດໃບສັ່ງຊື້ (PO) → ຂຽນ WPOA ລົງ ERP. ຫຼັງນີ້ລໍ ERP ຮັບເຂົ້າສາງ (sync ຈັບເອງ). */
export async function approvePoOrder(_: PurchaseState, formData: FormData): Promise<PurchaseState> {
  const guard = await requireRole(APPROVER_SIDE, "ບໍ່ມີສິດອະນຸມັດໃບສັ່ງຊື້");
  if (!guard.ok) return { error: guard.error };
  if (!odgDb) return { error: "ບໍ່ພົບ ODG_DATABASE_URL" };

  const po_no = String(formData.get("po_no") ?? "").trim();
  if (!po_no) return { error: "ບໍ່ພົບເລກໃບສັ່ງຊື້" };

  const odg = await odgDb.connect();
  let jobCode = "";
  let wpoa = "";
  try {
    await odg.query("begin");
    const head = (
      await odg.query<{ remark: string | null; branch_code: string | null; cust_code: string | null }>(
        `select remark, branch_code, cust_code from ic_trans
          where doc_no=$1 and trans_flag=$2 for update`,
        [po_no, ERP_PURCHASE.ORDER],
      )
    ).rows[0];
    if (!head) { await odg.query("rollback"); return { error: `ບໍ່ພົບໃບສັ່ງຊື້ ${po_no}` }; }
    jobCode = (head.remark ?? "").split(" ")[0];

    /**
     * ⚠️ ຫາ WPOA ຜ່ານ**ຫົວໃບ** — ແຖວຂອງ WPOA ມີ ref_doc_no ຫວ່າງ 100% (15,240 ແຖວ)
     * ⇒ ດ່ານກັນອະນຸມັດຊ້ຳແບບເກົ່າ (ຫາທາງແຖວ) **ບໍ່ເຄີຍພົບຫຍັງ** ແລະ ປ່ອຍໃຫ້ອອກ
     * WPOA ຊ້ຳໃສ່ PO ໃບດຽວໄດ້ບໍ່ຈຳກັດ. ເບິ່ງ lib/erp-purchase.
     */
    const dup = await odg.query(
      `select 1 from ic_trans where trans_flag=$1 and split_part(trim(coalesce(doc_ref,'')),' ',1)=$2 limit 1`,
      [ERP_PURCHASE.ORDER_APPROVE, po_no],
    );
    if (dup.rowCount) { await odg.query("rollback"); return { error: `ໃບ ${po_no} ອະນຸມັດໄປແລ້ວ` }; }

    wpoa = await approvePo(odg, {
      poNo: po_no, jobCode, branch: head.branch_code ?? "00", supplier: head.cust_code ?? "",
      doc_date: new Date().toISOString().slice(0, 10), doc_time: bangkokTime(),
      approver: guard.session.username,
    });
    await odg.query("commit");
  } catch (error) {
    await odg.query("rollback").catch(() => {});
    console.error("approvePoOrder failed", error);
    return { error: "ອະນຸມັດ PO ບໍ່ສຳເລັດ ກະລຸນາລອງໃໝ່" };
  } finally {
    odg.release();
  }

  if (jobCode && jobModel(jobCode) === "tb_product") {
    await logChange("tb_product", jobCode, `ອະນຸມັດໃບສັ່ງຊື້ ${po_no} (${wpoa}) — ລໍຜູ້ສະໜອງສົ່ງຂອງ ແລະ ສາງຮັບເຂົ້າ`,
      { roles: ROLE_WAREHOUSE });
  }
  revalidatePath("/purchase-orders");
  // ຕົວເລກຄິວຢູ່ເມນູ cache ໄວ້ 60 ວິ — ຄົນທີ່ຫາກໍລົງມືຕ້ອງເຫັນເລກໃໝ່ທັນທີ (read-your-own-writes)
  updateTag(PURCHASE_COUNT_TAG);
  redirect(purchaseBack(formData, "/purchase-orders"));
}

/* ═══════════ ອອກໃບສັ່ງຊື້ໂດຍກົງ (ບໍ່ຜ່ານໃບຂໍຊື້) — ຄື New ຂອງ Odoo Purchase ═══════════ */

/**
 * ແຖວອາໄຫຼ່ຈາກຕາຕະລາງແກ້ໄຂໄດ້ຂອງໜ້າ "ສ້າງໃບສັ່ງຊື້" — ສົ່ງມາເປັນ JSON ດຽວ
 * ເພາະຈຳນວນແຖວບໍ່ຕາຍຕົວ (ຄົນເພີ່ມ/ລຶບແຖວເອງຄື Odoo).
 */
const newPoSchema = z.object({
  branch_code: z.enum(["00", "05"]),
  supplier: z.string().trim().min(1, "ກະລຸນາເລືອກຜູ້ສະໜອງ"),
  /** ວັນທີໃບ — ຄື Odoo ທີ່ແກ້ໄດ້ (ເລກໃບອອກຕາມເດືອນຂອງວັນທີນີ້ ຄື ERP) */
  doc_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "ວັນທີບໍ່ຖືກຮູບແບບ"),
  remark: z.string().trim().max(200),
  lines: z
    .array(
      z.object({
        item_code: z.string().trim().min(1),
        qty: z.coerce.number().positive(),
        price: z.coerce.number().min(0),
      }),
    )
    .min(1, "ຕ້ອງມີຢ່າງໜ້ອຍ 1 ລາຍການ"),
});

/**
 * **ອອກໃບສັ່ງຊື້ (PO) ໂດຍກົງ** — ຊື້ຕຸນເຂົ້າສາງ/ຊື້ດ່ວນ ທີ່ບໍ່ໄດ້ເກີດຈາກໃບຂໍຊື້ຂອງວຽກ.
 *
 * ຮູບແບບນີ້ຄືທີ່ ERP ໃຊ້ຢູ່ແລ້ວ (1,305/2,187 ໃບ ໃນ 1 ປີ ບໍ່ອ້າງອີງໃບໃດ) ແລະ ຄື Odoo
 * ທີ່ກົດ New ແລ້ວອອກໃບສັ່ງຊື້ໄດ້ເລີຍ. ດ່ານອະນຸມັດຍັງຢູ່: ອອກແລ້ວຕ້ອງ **ອະນຸມັດ PO (WPOA)**
 * ກ່ອນຮັບເຂົ້າສາງ. ຊື່/ຫົວໜ່ວຍອາໄຫຼ່ ແລະ ຜູ້ສະໜອງ **ອ່ານຈາກ ERP ເອງ** ບໍ່ເຊື່ອຄ່າຈາກ browser.
 */
export async function createPoOrder(_: PurchaseState, formData: FormData): Promise<PurchaseState> {
  const guard = await requireRole(PURCHASE_SIDE, "ບໍ່ມີສິດອອກໃບສັ່ງຊື້");
  if (!guard.ok) return { error: guard.error };
  if (!odgDb) return { error: "ບໍ່ພົບ ODG_DATABASE_URL" };

  let rawLines: unknown;
  try {
    rawLines = JSON.parse(String(formData.get("lines") ?? "[]"));
  } catch {
    return { error: "ຂໍ້ມູນລາຍການບໍ່ຖືກຮູບແບບ" };
  }
  const parsed = newPoSchema.safeParse({
    branch_code: String(formData.get("branch_code") ?? ""),
    supplier: String(formData.get("supplier") ?? ""),
    doc_date: String(formData.get("doc_date") ?? ""),
    remark: String(formData.get("remark") ?? ""),
    lines: rawLines,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "ຂໍ້ມູນບໍ່ຄົບ" };
  const d = parsed.data;
  const ship = shippingSchema.safeParse({
    send_date: String(formData.get("send_date") ?? ""),
    transport_code: String(formData.get("transport_code") ?? ""),
    wh_code: String(formData.get("wh_code") ?? ""),
  });
  if (!ship.success) return { error: ship.error.issues[0]?.message ?? "ຂໍ້ມູນຈັດສົ່ງບໍ່ຄົບ" };
  if (ship.data.send_date < d.doc_date) return { error: "ວັນທີຄາດວ່າຈະມາຮອດ ຕ້ອງບໍ່ກ່ອນວັນທີໃບ" };
  const terms = termsSchema.safeParse({
    currency_code: String(formData.get("currency_code") ?? ""),
    exchange_rate: String(formData.get("exchange_rate") ?? ""),
    vat_type: String(formData.get("vat_type") ?? ""),
    vat_rate: String(formData.get("vat_rate") ?? ""),
    credit_day: String(formData.get("credit_day") ?? "0"),
  });
  if (!terms.success) return { error: terms.error.issues[0]?.message ?? "ຂໍ້ມູນສະກຸນເງິນ/VAT ບໍ່ຄົບ" };
  const codes = [...new Set(d.lines.map((line) => line.item_code))];
  if (codes.length !== d.lines.length) return { error: "ມີອາໄຫຼ່ຊ້ຳກັນໃນລາຍການ" };

  // ຢືນຢັນຜູ້ສະໜອງ + ຂໍ້ມູນຈັດສົ່ງ ກັບ ERP — ຢ່າເຊື່ອຄ່າຈາກ form
  const vendor = await supplierByCode(d.supplier);
  if (!vendor) return { error: `ບໍ່ພົບຜູ້ສະໜອງ ${d.supplier} ໃນ ERP` };
  const shipErr = await checkShipping(ship.data, terms.data);
  if (shipErr) return { error: shipErr };

  const odg = await odgDb.connect();
  let po = "";
  try {
    await odg.query("begin");
    /**
     * ລັອກຢູ່ **ຖານ ERP** (ບໍ່ແມ່ນ ODS) ເພາະລຳດັບເລກ PO ຢູ່ນີ້ — ສອງຄົນກົດພ້ອມກັນ
     * ຄົນທີ 2 ຕ້ອງລໍ ບໍ່ດັ່ງນັ້ນ nextErpNo ອ່ານ max ຄ່າດຽວກັນ ແລ້ວໄດ້ເລກຊ້ຳ.
     */
    await odg.query("select pg_advisory_xact_lock(734206)");

    // ຊື່ + ຫົວໜ່ວຍ ຈາກ ERP — ກັນລະຫັດທີ່ບໍ່ມີຈິງ
    const items = await odg.query<{ code: string; name_1: string | null; unit_standard: string | null }>(
      `select code, name_1, unit_standard from ic_inventory where code = any($1::varchar[])`,
      [codes],
    );
    const byCode = new Map(items.rows.map((row) => [row.code, row]));
    const missing = codes.filter((code) => !byCode.has(code));
    if (missing.length) {
      await odg.query("rollback");
      return { error: `ບໍ່ພົບອາໄຫຼ່ໃນ ERP: ${missing.join(", ")}` };
    }

    po = await createPo(odg, {
      branch: d.branch_code,
      supplier: vendor.code,
      remark: d.remark,
      doc_date: d.doc_date,
      doc_time: bangkokTime(),
      shipping: ship.data,
      terms: terms.data,
      issuer: guard.session.username,
      lines: d.lines.map((line) => ({
        item_code: line.item_code,
        item_name: byCode.get(line.item_code)?.name_1 ?? "",
        unit_code: byCode.get(line.item_code)?.unit_standard ?? "",
        qty: String(line.qty),
        price: String(line.price),
      })),
    });
    await odg.query("commit");
  } catch (error) {
    await odg.query("rollback").catch(() => {});
    console.error("createPoOrder failed", error);
    return { error: "ອອກໃບສັ່ງຊື້ບໍ່ສຳເລັດ ກະລຸນາລອງໃໝ່" };
  } finally {
    odg.release();
  }

  revalidatePath("/purchase-orders");
  // ຕົວເລກຄິວຢູ່ເມນູ cache ໄວ້ 60 ວິ — ຄົນທີ່ຫາກໍລົງມືຕ້ອງເຫັນເລກໃໝ່ທັນທີ (read-your-own-writes)
  updateTag(PURCHASE_COUNT_TAG);
  redirect(`/purchase-orders/${encodeURIComponent(po)}`);
}

/* ═══════════ ຍົກເລີກໃບສັ່ງຊື້ (PO) ═══════════ */

/**
 * **ຍົກເລີກ PO = ລຶບໃບອອກຈາກ ERP** (ບໍ່ແມ່ນຕິດທຸງ `is_cancel`).
 *
 * ── ເປັນຫຍັງລຶບ ບໍ່ແມ່ນຕິດທຸງ ──
 * ຖັນ `is_cancel`/`status` ມີຢູ່ໃນ ic_trans ແທ້ ແຕ່ຂໍ້ມູນຈິງບອກວ່າ ERP **ບໍ່ເຄີຍໃຊ້**:
 * ໃນ 1 ປີ ໃບ flag 2/4/6/8 ຈຳນວນ 6,379 ໃບ **is_cancel=1 ສູນໃບ · status=0 ທັງໝົດ**
 * ⇒ ຖ້າຕິດທຸງໄວ້ ໜ້າຈໍ/ລາຍງານຂອງ ERP ຈະຍັງນັບໃບນັ້ນເປັນໃບຈິງ ແລະ ຄົນຈະຄິດວ່າ
 * "ຍົກເລີກແລ້ວ" ໃນຂະນະທີ່ ERP ຍັງລໍຂອງຢູ່ — ອັນຕະລາຍກວ່າບໍ່ມີປຸ່ມເລີຍ.
 * ວິທີດຽວກັນກັບ `rejectSprOrder` ທີ່ລຶບ SPR ອອກ.
 *
 * ── ດ່ານ ──
 * ຮັບເຂົ້າສາງແລ້ວ (ມີ PUI) ⇒ **ຍົກເລີກບໍ່ໄດ້** (ຂອງເຂົ້າສະຕັອກໄປແລ້ວ ຕ້ອງສົ່ງຄືນຢູ່ ERP).
 * ອະນຸມັດແລ້ວ (ມີ WPOA) ⇒ ຕ້ອງເປັນ**ຜູ້ອະນຸມັດ** ຈຶ່ງລຶບໄດ້ (ລຶບໃບອະນຸມັດນຳ).
 */
export async function cancelPoOrder(_: PurchaseState, formData: FormData): Promise<PurchaseState> {
  if (!odgDb) return { error: "ບໍ່ພົບ ODG_DATABASE_URL" };
  const po_no = String(formData.get("po_no") ?? "").trim();
  const reason = String(formData.get("reason") ?? "").trim();
  if (!po_no) return { error: "ບໍ່ພົບເລກໃບສັ່ງຊື້" };
  if (reason.length < 3) return { error: "ກະລຸນາບອກເຫດຜົນທີ່ຍົກເລີກ" };

  const guard = await requireRole(PURCHASE_SIDE, "ບໍ່ມີສິດຍົກເລີກໃບສັ່ງຊື້");
  if (!guard.ok) return { error: guard.error };

  const odg = await odgDb.connect();
  let jobCode = "";
  let wpoaNo = "";
  try {
    await odg.query("begin");
    const head = (
      await odg.query<{ remark: string | null }>(
        `select remark from ic_trans where doc_no=$1 and trans_flag=$2 for update`,
        [po_no, ERP_PURCHASE.ORDER],
      )
    ).rows[0];
    if (!head) { await odg.query("rollback"); return { error: `ບໍ່ພົບໃບສັ່ງຊື້ ${po_no}` }; }
    jobCode = (head.remark ?? "").split(" ")[0];

    // ① ຮັບເຂົ້າສາງແລ້ວ ⇒ ຍົກເລີກບໍ່ໄດ້
    const receipt = await odg.query<{ doc_no: string }>(
      `select distinct doc_no from ic_trans_detail where trans_flag=$1 and ref_doc_no=$2`,
      [ERP_PURCHASE.RECEIPT, po_no],
    );
    if (receipt.rowCount) {
      await odg.query("rollback");
      return { error: `ຮັບເຂົ້າສາງແລ້ວ (${receipt.rows.map((r) => r.doc_no).join(", ")}) — ຍົກເລີກບໍ່ໄດ້ · ຕ້ອງສົ່ງຄືນຢູ່ ERP` };
    }

    // ② ອະນຸມັດແລ້ວ ⇒ ຕ້ອງເປັນຜູ້ອະນຸມັດ ແລະ ລຶບໃບອະນຸມັດນຳ
    // WPOA ຜູກທາງຫົວໃບ (ເບິ່ງໝາຍເຫດຢູ່ approvePoOrder)
    const wpoa = await odg.query<{ doc_no: string }>(
      `select doc_no from ic_trans where trans_flag=$1 and split_part(trim(coalesce(doc_ref,'')),' ',1)=$2`,
      [ERP_PURCHASE.ORDER_APPROVE, po_no],
    );
    if (wpoa.rowCount) {
      if (!APPROVER_SIDE.includes(roleOf(guard.session))) {
        await odg.query("rollback");
        return { error: `ໃບນີ້ອະນຸມັດແລ້ວ (${wpoa.rows[0].doc_no}) — ຜູ້ອະນຸມັດເທົ່ານັ້ນຈຶ່ງຍົກເລີກໄດ້` };
      }
      wpoaNo = wpoa.rows.map((r) => r.doc_no).join(", ");
      for (const row of wpoa.rows) {
        await odg.query(`delete from ic_trans_detail where doc_no=$1 and trans_flag=$2`, [row.doc_no, ERP_PURCHASE.ORDER_APPROVE]);
        await odg.query(`delete from ic_trans where doc_no=$1 and trans_flag=$2`, [row.doc_no, ERP_PURCHASE.ORDER_APPROVE]);
      }
    }

    await odg.query(`delete from ic_trans_detail where doc_no=$1 and trans_flag=$2`, [po_no, ERP_PURCHASE.ORDER]);
    await odg.query(`delete from ic_trans where doc_no=$1 and trans_flag=$2`, [po_no, ERP_PURCHASE.ORDER]);
    await odg.query("commit");
  } catch (error) {
    await odg.query("rollback").catch(() => {});
    console.error("cancelPoOrder failed", error);
    return { error: "ຍົກເລີກບໍ່ສຳເລັດ ກະລຸນາລອງໃໝ່" };
  } finally {
    odg.release();
  }

  if (jobCode && jobModel(jobCode) === "tb_product") {
    await logChange("tb_product", jobCode,
      `ຍົກເລີກໃບສັ່ງຊື້ ${po_no}${wpoaNo ? ` (ລຶບໃບອະນຸມັດ ${wpoaNo} ນຳ)` : ""} — ເຫດຜົນ: ${reason} · ໃບຖືກລຶບອອກຈາກ ERP, ອອກ PO ໃໝ່ໄດ້`,
      { roles: ROLE_WAREHOUSE });
  }
  revalidatePath("/purchase-orders");
  // ຕົວເລກຄິວຢູ່ເມນູ cache ໄວ້ 60 ວິ — ຄົນທີ່ຫາກໍລົງມືຕ້ອງເຫັນເລກໃໝ່ທັນທີ (read-your-own-writes)
  updateTag(PURCHASE_COUNT_TAG);
  // ໃບຖືກລຶບແລ້ວ ⇒ ຢ່າກັບໄປໜ້າໃບນັ້ນ (404) — ໃບຂອງຕ່ອງໂສ້ SPR ກັບໄປໜ້າ SPR ໄດ້
  const back = purchaseBack(formData, "/purchase-orders");
  redirect(back.startsWith("/purchase-orders/PO") || back.startsWith("/purchase-orders/PU") ? "/purchase-orders" : back);
}

/* ═══════════ ປົດວຽກທີ່ຄ້າງ "ກຳລັງສັ່ງຊື້" ແຕ່ ERP ບໍ່ມີໃບ ═══════════ */

/**
 * **ຍົກເລີກສັ່ງຊື້ຂອງວຽກ — ໃຊ້ໄດ້ສະເພາະໃບຜີ** (ODS ໝາຍວ່າສັ່ງແລ້ວ ແຕ່ ERP ບໍ່ມີໃບ).
 *
 * ── ບັນຫາຈິງທີ່ແກ້ ──
 * ວຽກ 5679: ODS ບັນທຶກ SPR25110002 ຕັ້ງແຕ່ 29-11-2025 ແລະ ຕັ້ງ `spare_order`
 * ⇒ ວຽກຄ້າງຂັ້ນ 7 "ກຳລັງສັ່ງຊື້" ມາ **8 ເດືອນ** ແຕ່ **ERP ບໍ່ມີໃບນັ້ນຈັກໃບ**
 * (ໂຄ້ດເກົ່າຂຽນສອງຖານແຍກກັນ — ຝັ່ງ ERP ລົ້ມງຽບໆ). ບໍ່ມີໃຜສັ່ງຂອງ ແລະ ບໍ່ມີປຸ່ມໃດປົດ:
 * syncErpPurchase ລໍໃບຮັບເຂົ້າທີ່ຈະບໍ່ມີວັນມາ · ໜ້າ RQ ເກົ່າຖືກຖອດອອກແລ້ວ.
 *
 * ── ດ່ານ ──
 * ຖາມ ERP ດ້ວຍ**ທຸກກຸນແຈ** (ເລກ SPR ຂອງ ODS · ເລກ RQ · ລະຫັດວຽກ) — ພົບໃບໃດກໍ່ຕາມ
 * ⇒ **ປະຕິເສດ** ພ້ອມບອກເລກໃບ (ຕ້ອງໄປຍົກເລີກຢູ່ ERP ກ່ອນ ບໍ່ແມ່ນລຶບຮ່ອງຮອຍຢູ່ນີ້).
 * ERP ຖາມບໍ່ໄດ້ ⇒ ປະຕິເສດຄືກັນ (erpPurchaseForRq ໂຍນ error ໄວ້ແລ້ວ).
 */
export async function releaseGhostPurchase(_: PurchaseState, formData: FormData): Promise<PurchaseState> {
  const guard = await requireRole(PURCHASE_SIDE, "ບໍ່ມີສິດຍົກເລີກການສັ່ງຊື້");
  if (!guard.ok) return { error: guard.error };
  if (!db) return { error: "ບໍ່ພົບ DATABASE_URL" };

  const job = String(formData.get("job") ?? "").trim();
  const reason = String(formData.get("reason") ?? "").trim();
  if (!job) return { error: "ບໍ່ພົບລະຫັດວຽກ" };
  if (reason.length < 3) return { error: "ກະລຸນາບອກເຫດຜົນ" };
  if (jobModel(job) !== "tb_product") return { error: "ໃຊ້ໄດ້ສະເພາະວຽກສ້ອມ" };

  // ກຸນແຈທັງໝົດທີ່ອາດຜູກໄປຫາໃບຢູ່ ERP
  const keys = (
    await db.query<{ doc_no: string }>(
      `select doc_no from ic_trans where product_code=$1 and trans_flag in ($2, $3)`,
      [job, ERP_PURCHASE.PR_REQUEST, RQ_TRANS_FLAG],
    )
  ).rows.map((row) => row.doc_no);

  let erpDoc: Awaited<ReturnType<typeof erpPurchaseForRq>>;
  try {
    erpDoc = await erpPurchaseForRq([...keys, job]);
  } catch {
    return { error: "ກວດ ERP ບໍ່ໄດ້ — ຫ້າມຍົກເລີກຕອນບໍ່ຮູ້ສະຖານະ ERP" };
  }
  if (erpDoc) {
    return {
      error: `ERP ${PURCHASE_STAGE_LABEL[erpDoc.stage]} ດ້ວຍໃບ ${erpDoc.doc} ແລ້ວ — ຍົກເລີກໃບນັ້ນຢູ່ ERP ກ່ອນ`,
    };
  }

  const cleared = await db.query(
    `update tb_product set spare_order = null, spare_arrive = null, spare_arrive_by = null
      where code = $1 and spare_order is not null`,
    [job],
  );
  if (!cleared.rowCount) return { error: "ວຽກນີ້ບໍ່ໄດ້ຢູ່ຂັ້ນກຳລັງສັ່ງຊື້ແລ້ວ" };

  await logChange("tb_product", job,
    `ຍົກເລີກສັ່ງຊື້ (ໃບຜີ: ${keys.join(", ") || "-"} ບໍ່ມີໃນ ERP) — ເຫດຜົນ: ${reason} · ວຽກກັບໄປຂັ້ນດຳເນີນອາໄຫຼ່ ຂໍຊື້ໃໝ່ໄດ້`,
    { roles: ROLE_WAREHOUSE });
  revalidatePath("/dashboard/status/repair/purchasing");
  revalidatePath("/purchase-requests");
  revalidatePath(`/service/${job}`);
  revalidatePath("/dashboard");
  return {};
}
