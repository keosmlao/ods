import { docsForJobs } from "@/lib/erp-doc-link";
import { logChange } from "@/lib/chatter-log";
import { ROLE_APPROVER, ROLE_WAREHOUSE } from "@/lib/chatter";
import { pushToUser } from "@/lib/push";
import { db, query, queryOdg } from "@/lib/db";
import { STAGE_SQL } from "@/lib/stage";
import { ERP_PURCHASE } from "@/lib/stock-constants";

/**
 * **ຕິດຕາມການສັ່ງຊື້ອາໄຫຼ່ຈາກ ERP** — ບ່ອນດຽວຂອງລະບົບ. ອ່ານຢ່າງດຽວ ບໍ່ຂຽນຫຍັງ.
 *
 * ── ເປັນຫຍັງຕ້ອງມີ ──
 * ວຽກເຂົ້າຂັ້ນ 7 "ກຳລັງສັ່ງຊື້ອາໄຫຼ່" ຕອນອະນຸມັດໃບຂໍຊື້ (tb_product.spare_order) ແລ້ວ
 * **ອອກຈາກຂັ້ນນັ້ນໄດ້ທາງດຽວ**: ມີຄົນມາກົດປຸ່ມ "ອາໄຫຼ່ມາຮອດແລ້ວ" ດ້ວຍມື (spare_arrive).
 * ຄວາມຈິງແລ້ວ ຂອງມາຮອດ/ຮັບເຂົ້າສາງ ຖືກບັນທຶກຢູ່ **ERP** ຢູ່ແລ້ວ ແຕ່ ODS ບໍ່ເຄີຍອ່ານ
 * ⇒ 15 ໃນ 20 ວຽກທີ່ຂຶ້ນວ່າ "ກຳລັງສັ່ງຊື້" ຄວາມຈິງຂອງເຂົ້າສາງໄປແລ້ວ (ເກົ່າສຸດ 136 ມື້
 * — SPR26020002 ຮັບເຂົ້າ 02-03-2026) ໂດຍທີ່ຊ່າງ ແລະ ລູກຄ້າລໍຖ້າຢູ່ຊື່ໆ.
 *
 * ── ຫຼັກການ (ດຽວກັນກັບ lib/erp-dispatch.ts) ──
 * ເອກະສານທີ່**ຍ້າຍຂອງຈິງ**ອອກຢູ່ ERP · ODS ເປັນຝ່າຍ**ອ່ານ**. ບ່ອນນີ້ອ່ານມາສະແດງ
 * ໃຫ້ຄົນເຫັນວ່າຄ້າງຢູ່ຂັ້ນໃດ (ລໍອະນຸມັດ / ລໍອອກ PO / ລໍຂອງ / ຮັບເຂົ້າສາງແລ້ວ).
 *
 * ── ຜູກໃບ ERP ກັບວຽກແນວໃດ ──
 * ຮອງຮັບ 2 ທາງ ເພາະຂໍ້ມູນຈິງມີທັງສອງແບບ:
 *   ① **doc_no** — ODSS ອອກໃບ SPR ລົງທັງ ODS ແລະ ERP ດ້ວຍ**ເລກດຽວກັນ** ⇒ ໃຊ້ໄດ້ທຸກໃບ
 *      (ລວມທັງໃບເກົ່າຂອງ ods python)
 *   ② **doc_ref = ເລກ RQ ຂອງ ODS** — ໃບທີ່ອອກໃນ ERP ໂດຍກົງຈະບໍ່ມີ doc_no ຢູ່ ODS
 *      ⇒ ຜູກຄືນຜ່ານ doc_ref ແທນ (ຮູບແບບດຽວກັນກັບໃບເບີກ: SWC.doc_ref = ເລກ SIO ຂອງເຮົາ).
 *      ⚠️ ຂໍ້ມູນຈິງ: ໃບເກົ່າ doc_ref ຫວ່າງເປົ່າ — ມີແຕ່ໃບທີ່ອອກດ້ວຍໂຄ້ດໃໝ່ທີ່ຕື່ມໃຫ້
 *      (SPR26070003→RQ2026070656 ✓ · SPR26060028→ຫວ່າງ ✗) ⇒ ຍັງຂາດ ① ບໍ່ໄດ້.
 */

/** ໃບຂໍອະນຸມັດສັ່ງຊື້ຂອງ ODS (RQ) — ຢູ່ພາຍໃນ ODS ຢ່າງດຽວ ບໍ່ໄດ້ຂຽນລົງ ERP */
const RQ_TRANS = 78;

/** ຂັ້ນຂອງການສັ່ງຊື້ — ຮຽງຕາມລຳດັບທີ່ເກີດຂຶ້ນຈິງ (ຄົບ 5 ຂັ້ນຄື ERP: WPOA ນຳ) */
export type PurchaseStage = "requested" | "approved" | "ordered" | "po_approved" | "received";

/** ລຳດັບຄວາມຄືບໜ້າ — ໃຊ້ຕອນວຽກມີຫຼາຍໃບຂໍຊື້ */
const ORDER_OF: Record<PurchaseStage, number> = { requested: 0, approved: 1, ordered: 2, po_approved: 3, received: 4 };

export const PURCHASE_STAGE_LABEL: Record<PurchaseStage, string> = {
  requested: "ລໍຖ້າອະນຸມັດໃບຂໍຊື້",
  approved: "ອະນຸມັດແລ້ວ — ລໍຖ້າອອກໃບສັ່ງຊື້",
  ordered: "ອອກໃບສັ່ງຊື້ແລ້ວ — ລໍອະນຸມັດ PO",
  po_approved: "ອະນຸມັດ PO ແລ້ວ — ລໍຖ້າຂອງ",
  received: "ຮັບເຂົ້າສາງແລ້ວ",
};

export type PurchaseTrack = {
  /** ວຽກສ້ອມ (tb_product.code) */
  job: string;
  stage: PurchaseStage;
  /** ໃບຂໍຊື້ (SPR) */
  pr_no: string | null;
  pr_date: string | null;
  /** ໃບອະນຸມັດ (WPRA) */
  approve_no: string | null;
  approve_date: string | null;
  /** ໃບສັ່ງຊື້ (POT/POH) */
  order_no: string | null;
  order_date: string | null;
  /** ໃບອະນຸມັດ PO (WPOA) */
  oa_no: string | null;
  oa_date: string | null;
  /** ໃບຮັບເຂົ້າສາງ (PUIT/PUIH) */
  receipt_no: string | null;
  receipt_date: string | null;
  /** ວັນຮັບເຂົ້າສາງ ໃນຮູບ YYYY-MM-DD — ໃຊ້ຂຽນລົງ spare_arrive (ບໍ່ໄດ້ສະແດງ) */
  receipt_iso: string | null;
  /** ຈຳນວນອາໄຫຼ່ໃນໃບຂໍຊື້ ທຽບກັບຈຳນວນທີ່ຮັບເຂົ້າສາງແລ້ວ — ບອກໄດ້ວ່າມາບໍ່ຄົບ */
  items: number;
  items_received: number;
  /** ຮັບເຂົ້າສາງມາແລ້ວກີ່ມື້ (ວຽກນີ້ຄວນຈະໄປຕໍ່ໄດ້ແລ້ວ ແຕ່ຍັງຄ້າງ) */
  days_since_receipt: number | null;
};

/** ໃບ ERP ທີ່ຜູກກັບວຽກ — ດຶງມາຈາກ ODS ກ່ອນ (ຂ້າມຖານກັນ join ບໍ່ໄດ້) */
type JobDoc = { job: string; pr_no: string; rq_no: string | null };

/**
 * ── ຜູກວຽກກັບໃບ ERP ດ້ວຍ 2 ທາງ (17-07-2026) ──
 * ທາງຫຼັກ: `doc_ref` = ເລກວຽກ (erp-spr.writeErpSpr ຂຽນໃຫ້ຕອນອອກ SPR).
 * ທາງສຳຮອງ: `remark` — ເພາະ **ຄົນ ERP ແກ້ໃບໄດ້**. ພົບຈິງກັບໃບ 7521: SPR ຖືກເປີດ
 * ແກ້ໃນ ERP ຫຼັງອະນຸມັດ ⇒ doc_ref ຖືກລ້າງ, ວຽກກັບໃບຂາດຈາກກັນ, ໜ້າຈໍຂຶ້ນວ່າ
 * "ບໍ່ພົບໃນ ERP" ແລ້ວຍື່ນປຸ່ມ "ຍົກເລີກສັ່ງຊື້" ໃຫ້ກົດ (ກົດແລ້ວລຶບການສັ່ງຊື້ຈິງຖິ້ມ).
 * remark ຂອງ SPR ມີຮູບແບບ "ເລກວຽກ · ໝາຍເຫດ" ⇒ ຕັດເອົາທ່ອນທຳອິດມາທຽບ.
 * ສອງທາງນີ້ບໍ່ໄດ້ແກ້ໃບທີ່ຖືກລ້າງທັງສອງຖັນ — ແຕ່ຕັດກໍລະນີທີ່ຫຼົງໄປທາງດຽວອອກ.
 *
 * ຕ່ອງໂສ້ຢູ່ ERP — ໄລ່ຕາມ ref_doc_no **ພ້ອມ item_code** ທຸກຂັ້ນ.
 *
 * ຕ້ອງທຽບ item_code ນຳ ບໍ່ແມ່ນແຕ່ເລກໃບ: ໃບສັ່ງຊື້ໃບນຶ່ງລວມອາໄຫຼ່ຂອງຫຼາຍວຽກ
 * ⇒ "PO ໃບນີ້ຮັບເຂົ້າສາງແລ້ວ" ບໍ່ໄດ້ແປວ່າ**ອາໄຫຼ່ຂອງວຽກເຮົາ**ມາຮອດ.
 */
const CHAIN_SQL = `
  with pr as (
    select t.doc_no, to_char(t.doc_date,'DD-MM-YYYY') doc_date, t.doc_date raw_date,
        split_part(trim(coalesce(t.doc_ref,'')),' ',1) rq_no
      from ic_trans t
     where t.trans_flag = $2
       and (t.doc_no = any($1::text[])
         or split_part(trim(coalesce(t.doc_ref,'')),' ',1) = any($1::text[])
         -- ⚠️ ຕ້ອງເບິ່ງ remark ນຳ — ເບິ່ງໝາຍເຫດຂ້າງເທິງ CHAIN_SQL
         or split_part(trim(coalesce(t.remark,'')),' ·',1) = any($1::text[]))
  ),
  pri as (
    select distinct pr.doc_no pr_no, pr.doc_date pr_date, pr.rq_no, d.item_code
      from pr join ic_trans_detail d on d.doc_no = pr.doc_no and d.trans_flag = $2
  ),
  ap as (
    select distinct pri.pr_no, pri.item_code, d.doc_no, d.doc_date
      from pri join ic_trans_detail d
        on d.ref_doc_no = pri.pr_no and d.item_code = pri.item_code and d.trans_flag = $3
  ),
  po as (
    select distinct ap.pr_no, ap.item_code, d.doc_no, d.doc_date
      from ap join ic_trans_detail d
        on d.ref_doc_no = ap.doc_no and d.item_code = ap.item_code and d.trans_flag = $4
  ),
  /* ⚠️ WPOA ຜູກທາງ **ຫົວໃບ** (ic_trans.doc_ref) ບໍ່ແມ່ນທາງແຖວ —
     ຂໍ້ມູນຈິງ 17-07-2026: WPOA 2,223/2,223 ໃບ ມີ doc_ref ຊີ້ໃສ່ PO ແຕ່ແຖວຂອງມັນ
     ref_doc_no ຫວ່າງທັງ 15,240 ແຖວ ⇒ ໄລ່ຕາມແຖວຄືຂັ້ນອື່ນຈະບໍ່ພົບຈັກໃບ
     (ເຄີຍລາຍງານວ່າ PO ອະນຸມັດແລ້ວ 0% ທັງທີ່ຄວາມຈິງ 98%).
     ຂັ້ນນີ້ບໍ່ທຽບ item_code — ຫົວໃບບໍ່ຮູ້ຈັກ item ແລະ ອະນຸມັດແມ່ນອະນຸມັດທັງໃບຢູ່ແລ້ວ. */
  oa as (
    select distinct po.pr_no, po.item_code, w.doc_no, w.doc_date
      from po join ic_trans w
        on split_part(trim(coalesce(w.doc_ref,'')),' ',1) = po.doc_no and w.trans_flag = $6
  ),
  rc as (
    select distinct po.pr_no, po.item_code, d.doc_no, d.doc_date
      from po join ic_trans_detail d
        on d.ref_doc_no = po.doc_no and d.item_code = po.item_code and d.trans_flag = $5
  )
  select p.doc_no pr_no, p.doc_date pr_date, p.rq_no,
    (select count(distinct i.item_code) from pri i where i.pr_no = p.doc_no)::int items,
    (select count(distinct r.item_code) from rc r where r.pr_no = p.doc_no)::int items_received,
    (select string_agg(distinct a.doc_no, ', ') from ap a where a.pr_no = p.doc_no) approve_no,
    (select to_char(min(a.doc_date),'DD-MM-YYYY') from ap a where a.pr_no = p.doc_no) approve_date,
    (select string_agg(distinct o.doc_no, ', ') from po o where o.pr_no = p.doc_no) order_no,
    (select to_char(min(o.doc_date),'DD-MM-YYYY') from po o where o.pr_no = p.doc_no) order_date,
    (select string_agg(distinct a.doc_no, ', ') from oa a where a.pr_no = p.doc_no) oa_no,
    (select to_char(min(a.doc_date),'DD-MM-YYYY') from oa a where a.pr_no = p.doc_no) oa_date,
    (select string_agg(distinct r.doc_no, ', ') from rc r where r.pr_no = p.doc_no) receipt_no,
    (select to_char(max(r.doc_date),'DD-MM-YYYY') from rc r where r.pr_no = p.doc_no) receipt_date,
    (select to_char(max(r.doc_date),'YYYY-MM-DD') from rc r where r.pr_no = p.doc_no) receipt_iso,
    (select max(current_date - r.doc_date) from rc r where r.pr_no = p.doc_no)::int days_since_receipt
  from pr p`;

/** ແຖວດິບຈາກ ERP — pr_no ຄືຫົວໃບ ຈຶ່ງບໍ່ມີວັນເປັນ null (ຕ່າງຈາກ PurchaseTrack ທີ່ເປັນ null ໄດ້) */
type ChainRow = Omit<PurchaseTrack, "job" | "stage" | "pr_no"> & { pr_no: string; rq_no: string | null };

/**
 * ສະຖານະການສັ່ງຊື້ຂອງແຕ່ລະວຽກ — ສົ່ງລະຫັດວຽກ (tb_product.code) ເຂົ້າມາ.
 *
 * ບໍ່ໂຍນ error: ERP ລົ້ມ ⇒ ຄືນ Map ຫວ່າງ ແລະ ໜ້າຈໍຍັງເປີດໄດ້ ພຽງແຕ່ບໍ່ມີ tracking
 * (ຫຼັກການດຽວກັນກັບ syncErpDispatch — ໜ້າຄິວຂອງສາງຫ້າມລົ້ມຕາມ ERP).
 */
export async function purchaseTracking(jobs: string[]): Promise<Map<string, PurchaseTrack>> {
  const result = new Map<string, PurchaseTrack>();
  if (jobs.length === 0) return result;

  try {
    // ວຽກ → ໃບຂໍຊື້ຂອງມັນ (ODS ຮູ້ product_code · ERP ບໍ່ຮູ້) ພ້ອມເລກ RQ ສຳລັບໃບທີ່ອອກໃນ ERP
    const docs = await query<JobDoc>(
      `select t.product_code job, t.doc_no pr_no, nullif(split_part(trim(coalesce(t.doc_ref,'')),' ',1),'') rq_no
         from ic_trans t
        where t.trans_flag = $1 and t.product_code = any($2::varchar[])`,
      [ERP_PURCHASE.PR_REQUEST, jobs],
    );
    // ໃບຂໍອະນຸມັດ (RQ 78) ຂອງວຽກ — ໃຊ້ຫາໃບ ERP ທີ່ອອກໃນ ERP ໂດຍກົງ (ບໍ່ມີໃນ ODS)
    const rqs = await query<{ job: string; rq_no: string }>(
      `select t.product_code job, t.doc_no rq_no
         from ic_trans t
        where t.trans_flag = $1 and t.product_code = any($2::varchar[])`,
      [RQ_TRANS, jobs],
    );
    /**
     * ກຸນແຈຫາຝັ່ງ ERP — 4 ທາງ, ຂາດທາງໃດທາງໜຶ່ງກໍ່ຍັງຫາພົບ:
     *   ① ເລກ SPR ທີ່ ODS ຍັງມີສຳເນົາ (ໃບເກົ່າ)
     *   ② ເລກ RQ (ໃບທີ່ອອກໃນ ERP ໂດຍກົງ)
     *   ③ **ເລກວຽກເອງ** — flow ໃໝ່ຂຽນ doc_ref = ເລກວຽກ
     *   ④ **ດັດຊະນີຂອງເຮົາ** (ods_erp_doc_link) — ທາງດຽວທີ່ **ຄົນ ERP ແກ້ບໍ່ໄດ້**.
     *      ③ ອາໄສ doc_ref ຂອງ ERP ເຊິ່ງຖືກລ້າງໄດ້ (ເກີດຈິງ: SPR26070008 ຂອງວຽກ 7521)
     *      ⇒ ວຽກກັບໃບຂາດຈາກກັນ ແລ້ວໜ້າຈໍຍື່ນປຸ່ມ "ຍົກເລີກສັ່ງຊື້" ໃຫ້ກົດຢ່າງອັນຕະລາຍ.
     */
    const linkedDocs = await docsForJobs(jobs);
    const keys = [...new Set([
      ...docs.rows.map((row) => row.pr_no),
      ...rqs.rows.map((row) => row.rq_no),
      ...linkedDocs,
      ...jobs,
    ])];
    const chain = await queryOdg<ChainRow>(CHAIN_SQL, [
      keys,
      ERP_PURCHASE.PR_REQUEST,
      ERP_PURCHASE.PR_APPROVE,
      ERP_PURCHASE.ORDER,
      ERP_PURCHASE.RECEIPT,
      ERP_PURCHASE.ORDER_APPROVE,
    ]);
    if (chain.rows.length === 0) return result;

    // ໃບ ERP → ວຽກ (ຜ່ານເລກ SPR ກ່ອນ → ເລກ RQ → doc_ref ເປັນເລກວຽກໂດຍກົງ ຂອງ flow ໃໝ່)
    const byPr = new Map(docs.rows.map((row) => [row.pr_no, row.job]));
    const byRq = new Map(rqs.rows.map((row) => [row.rq_no, row.job]));
    const jobSet = new Set(jobs);

    for (const row of chain.rows) {
      const job =
        byPr.get(row.pr_no) ??
        (row.rq_no ? (byRq.get(row.rq_no) ?? (jobSet.has(row.rq_no) ? row.rq_no : undefined)) : undefined);
      if (!job) continue;

      const stage: PurchaseStage =
        row.items_received > 0 && row.items_received >= row.items
          ? "received"
          : row.oa_no
            ? "po_approved"
            : row.order_no
              ? "ordered"
              : row.approve_no
                ? "approved"
                : "requested";

      // ວຽກນຶ່ງອາດມີຫຼາຍໃບຂໍຊື້ (ຂໍເພີ່ມພາຍຫຼັງ) — ເອົາໃບທີ່**ຄືບໜ້າໜ້ອຍສຸດ**
      // ເພາະວຽກຈະໄປຕໍ່ໄດ້ກໍ່ຕໍ່ເມື່ອອາໄຫຼ່ມາຮອດ**ຄົບທຸກໃບ**
      const previous = result.get(job);
      if (previous && ORDER_OF[previous.stage] <= ORDER_OF[stage]) continue;
      result.set(job, { job, stage, ...row });
    }
    return result;
  } catch (error) {
    console.error("purchaseTracking failed", error);
    return result;
  }
}

/**
 * ວຽກທີ່ຢູ່ຂັ້ນ "ກຳລັງສັ່ງຊື້ອາໄຫຼ່" — **ໃຊ້ STAGE_SQL ໂດຍກົງ ຢ່າພິມເງື່ອນໄຂຄືນໃໝ່**.
 *
 * ບົດຮຽນຈາກບັກຈິງ (16-07-2026): ຮຸ່ນທຳອິດຂອງໄຟລ໌ນີ້ກ໋ອບເງື່ອນໄຂຂັ້ນ 7 ມາພິມເອງ
 * (`used_spare=1 and spare_finish is null and spare_order is not null …`).
 * ຕໍ່ມາ lib/stage ຖືກແກ້ — ຍ້າຍກິ່ງຂັ້ນ 7 ໄປໄວ້ກ່ອນຂັ້ນ 5 ແລະ **ຕັດ `spare_finish is null` ອອກ**
 * ⇒ ສຳເນົາຢູ່ນີ້ບໍ່ຕົງກັບຂອງຈິງອີກ ແລະ sync **ເບິ່ງຂ້າມ 4 ໃບ** (6449 · 6683 · 6687 · 7257)
 * ທີ່ ERP ຮັບເຂົ້າສາງໄປແລ້ວ ໂດຍບໍ່ມີໃຜຮູ້. ນິຍາມຂັ້ນມີບ່ອນດຽວ — ອ້າງອີງມັນ.
 */
const STAGE_7 = `(${STAGE_SQL}) = 7`;

/** ໝາຍວ່າ "ລະບົບຢືນຢັນເອງຈາກ ERP" ບໍ່ແມ່ນຄົນກົດ (ດຽວນີ້ບໍ່ມີໃຜກົດດ້ວຍມືອີກແລ້ວ) */
const ERP_ACTOR = "ERP";

/**
 * ເອກະສານສັ່ງຊື້ຢູ່ **ERP** ຂອງໃບ RQ ນີ້ — ຄືນ null ຖ້າ ERP ຍັງບໍ່ໄດ້ລົງມືຫຍັງ.
 *
 * ── ໃຊ້ເຮັດຫຍັງ ──
 * ດ່ານ "ຖອນໃບ RQ ຄືນບໍ່ໄດ້ ຖ້າອອກໃບສັ່ງຊື້ໄປແລ້ວ" ຂອງ actions/purchase.releaseRq
 * ເຄີຍຫາ `ic_trans` trans_flag=2 ຢູ່ **ODS** — ແຕ່ຫຼັງຈາກຍ້າຍການອອກໃບໄປ ERP ບ່ອນດຽວ
 * (16-07-2026) **ບໍ່ມີໃຜສ້າງແຖວນັ້ນໃນ ODS ອີກແລ້ວ** ⇒ ດ່ານນັ້ນເປັນດ່ານຕາຍ:
 * ຄົ້ນຫາຫຍັງກໍ່ບໍ່ພົບ ຈຶ່ງປ່ອຍໃຫ້ຖອນໄດ້ສະເໝີ ເຖິງ ERP ຈະສັ່ງຂອງກັບຜູ້ສະໜອງໄປແລ້ວ.
 * ບ່ອນນີ້ຖາມ ERP ຈິງແທນ.
 *
 * ── ຕ້ອງສົ່ງ **ສອງກຸນແຈ** ເຂົ້າມາ ──
 * `keys` = ເລກ RQ **ບວກ** ເລກ SPR ທຸກໃບຂອງ RQ ນັ້ນທີ່ຍັງຄ້າງຢູ່ ODS (ໃບເກົ່າ).
 * ເຫດຜົນ: ໃບເກົ່າຂອງ ERP **doc_ref ຫວ່າງເປົ່າ** ⇒ ຫາຕາມເລກ RQ ຢ່າງດຽວຈະ**ບໍ່ພົບ**
 * ທັງທີ່ ERP ມີໃບຢູ່. ຂໍ້ມູນຈິງ (16-07-2026): RQ ຂອງວຽກຂັ້ນ 7 ຈຳນວນ 6/10 ໃບ
 * ຫາຕາມ RQ ບໍ່ພົບ ແຕ່ຫາຕາມເລກ SPR ພົບໝົດ (SPR26060030 → WPRA2026070020 ອະນຸມັດແລ້ວ).
 * ⇒ ຂາດກຸນແຈໃດກຸນແຈນຶ່ງ = ດ່ານປ່ອຍໃຫ້ຖອນໃບທີ່ ERP ສັ່ງຂອງໄປແລ້ວ.
 *
 * ຄືນຂັ້ນທີ່**ໄກສຸດ**ທີ່ ERP ໄປຮອດ ພ້ອມເລກໃບ — ໃຫ້ຄົນຮູ້ວ່າຕ້ອງໄປຍົກເລີກໃບໃດຢູ່ ERP ກ່ອນ.
 */
export async function erpPurchaseForRq(keys: string[]): Promise<{ stage: PurchaseStage; doc: string } | null> {
  const lookup = [...new Set(keys.filter(Boolean))];
  if (lookup.length === 0) return null;
  try {
    const chain = await queryOdg<ChainRow>(CHAIN_SQL, [
      lookup,
      ERP_PURCHASE.PR_REQUEST,
      ERP_PURCHASE.PR_APPROVE,
      ERP_PURCHASE.ORDER,
      ERP_PURCHASE.RECEIPT,
      ERP_PURCHASE.ORDER_APPROVE,
    ]);
    let best: { stage: PurchaseStage; doc: string } | null = null;
    for (const row of chain.rows) {
      // ຂັ້ນທີ່ໄກສຸດຂອງແຖວນີ້ — ຮັບເຂົ້າສາງ > ອະນຸມັດ PO > ອອກ PO > ອະນຸມັດ > ຂໍຊື້
      const here: { stage: PurchaseStage; doc: string } | null = row.receipt_no
        ? { stage: "received", doc: row.receipt_no }
        : row.oa_no
          ? { stage: "po_approved", doc: row.oa_no }
          : row.order_no
            ? { stage: "ordered", doc: row.order_no }
            : row.approve_no
              ? { stage: "approved", doc: row.approve_no }
              : { stage: "requested", doc: row.pr_no };
      if (!best || ORDER_OF[here.stage] > ORDER_OF[best.stage]) best = here;
    }
    return best;
  } catch (error) {
    /**
     * ⚠️ ERP ລົ້ມ ⇒ **ຫ້າມຖອນ** (ຕ່າງຈາກ purchaseTracking ທີ່ຄືນຄ່າຫວ່າງໄດ້).
     * ບ່ອນນີ້ຄືດ່ານກັນ: ບໍ່ຮູ້ວ່າ ERP ສັ່ງຂອງໄປແລ້ວຫຼືຍັງ = ຕ້ອງຖືວ່າສັ່ງແລ້ວ.
     */
    console.error("erpPurchaseForRq failed", error);
    throw new Error("ກວດ ERP ບໍ່ໄດ້");
  }
}

export type PurchaseSync = { advanced: number; jobs: string[] };

/**
 * **ຂອງມາຮອດແລ້ວຢູ່ ERP ⇒ ເລື່ອນຂັ້ນໃຫ້ເອງ** (ຂັ້ນ 7 → 5).
 * ຫຼັງຮັບເຂົ້າຈິງ ຈຶ່ງສ້າງໃບຂໍເບີກ SIO; ຍັງບໍ່ໄປຂັ້ນສາງຈ່າຍຈົນກວ່າ SIO ຖືກສ້າງ.
 *
 * ── ບັນຫາທີ່ອຸດຢູ່ນີ້ ──
 * ຂັ້ນ 7 ອອກໄດ້ທາງດຽວ: ມີຄົນມາກົດ "ອາໄຫຼ່ມາຮອດແລ້ວ" ດ້ວຍມື. ບໍ່ມີໃຜກົດ ⇒ ວຽກຄ້າງ
 * ທັງທີ່ຂອງນອນຢູ່ໃນສາງແລ້ວ. ຂໍ້ມູນຈິງ (16-07-2026): **15 ໃນ 20 ວຽກ**ຂັ້ນ 7 ຮັບເຂົ້າສາງ
 * ໄປແລ້ວຢູ່ ERP — ເກົ່າສຸດ 136 ມື້ (ວຽກ 5863, PUIT26030009 ຮັບເຂົ້າ 02-03-2026).
 *
 * ── ເປັນຫຍັງເຊື່ອ ERP ໄດ້ ──
 * ໃບຮັບເຂົ້າສາງ (PUIT/PUIH) ຄື**ການເຄື່ອນໄຫວສະຕັອກຈິງ** — ຂອງເຂົ້າສາງແທ້ ຈຶ່ງມີໃບ.
 * ບວກກັບທຽບ **item_code ທຸກຂັ້ນ** ແລະ ບັງຄັບ `items_received >= items` ⇒ ມາບໍ່ຄົບ
 * ຈະບໍ່ເລື່ອນຂັ້ນ (ຫຼັກການດຽວກັນກັບ syncErpDispatch ທີ່ດຶງໃບເບີກຂອງ ERP ມາເລື່ອນຂັ້ນ).
 *
 * stamp `spare_arrive` ດ້ວຍ **ວັນທີໃນໃບຂອງ ERP** ບໍ່ແມ່ນເວລາປັດຈຸບັນ ⇒ ອາຍຸທີ່ຄ້າງລໍ
 * ເບີກເປັນຄວາມຈິງ (ວຽກ 5863 ຈະຂຶ້ນ "ຄ້າງ 136 ມື້" ທັນທີ ບໍ່ແມ່ນ "ຫາກໍ່ມາຮອດ").
 *
 * idempotent: `spare_arrive is null` ຢູ່ໃນ WHERE ⇒ ເອີ້ນຊ້ຳໄດ້ທຸກເທື່ອທີ່ເປີດໜ້າ.
 */
export async function syncErpPurchase(): Promise<PurchaseSync> {
  const empty: PurchaseSync = { advanced: 0, jobs: [] };
  if (!db) return empty;

  try {
    const open = await query<{ code: string }>(`select a.code from tb_product a where ${STAGE_7}`);
    if (open.rows.length === 0) return empty;

    const tracking = await purchaseTracking(open.rows.map((row) => row.code));
    const arrived = [...tracking.values()].filter((track) => track.stage === "received" && track.receipt_iso);
    if (arrived.length === 0) return empty;

    const jobs: string[] = [];
    for (const track of arrived) {
      // ເງື່ອນໄຂຂັ້ນຢູ່ໃນ WHERE ເອງ ⇒ ວຽກທີ່ຖືກປ່ຽນໄປແລ້ວລະຫວ່າງນີ້ ຈະບໍ່ຖືກແຕະ
      const done = await query<{ emp_code: string | null; product: string | null; sn: string | null }>(
        `update tb_product a set spare_arrive = $2::timestamp, spare_arrive_by = $3
          where a.code = $1 and ${STAGE_7}
        returning a.emp_code, a.name_1 product, a.sn`,
        [track.job, track.receipt_iso, ERP_ACTOR],
      );
      if (!done.rowCount) continue;
      const job = done.rows[0];

      const message =
        `ອາໄຫຼ່ມາຮອດແລ້ວ — ERP ຮັບເຂົ້າສາງດ້ວຍໃບ ${track.receipt_no} ວັນທີ ${track.receipt_date}` +
        `${track.days_since_receipt ? ` (${track.days_since_receipt} ມື້ກ່ອນ)` : ""} · ລະບົບເລື່ອນຂັ້ນໃຫ້ເອງ — ພ້ອມສ້າງໃບຂໍເບີກ SIO`;

      /**
       * ── ແຈ້ງໃຫ້ **ທຸກຄົນທີ່ກ່ຽວຂ້ອງ** ຮູ້ວ່າຂອງມາຮອດສາງແລ້ວ (17-07-2026) ──
       * ແຕ່ກ່ອນແຈ້ງແຕ່ `ROLE_WAREHOUSE` (ສາງ) + ຄົນທີ່ຕິດຕາມໃບ ⇒ **ຊ່າງທີ່ລໍອາໄຫຼ່ຢູ່
       * ບໍ່ຮູ້ເລີຍ** ທັງທີ່ລາວຄືຄົນທີ່ວຽກຄ້າງຢູ່ນຳ — ຕ້ອງລໍໃຫ້ຄົນມາບອກປາກເປົ່າ.
       * ດຽວນີ້: ຊ່າງເຈົ້າຂອງວຽກ (ໂດຍກົງ) + ສາງ + ຜູ້ຈັດການ/ຫົວໜ້າຊ່າງ + CS (admin)
       * — ໝົດທຸກຝ່າຍທີ່ຕ້ອງລົງມືຕໍ່ ຫຼື ຕ້ອງບອກລູກຄ້າ.
       */
      await logChange("tb_product", track.job, message, {
        users: job?.emp_code ? [job.emp_code] : [],
        roles: [...ROLE_WAREHOUSE, ...ROLE_APPROVER, "admin"],
      });

      /**
       * ຊ່າງເຮັດວຽກຢູ່ໜ້າງານ/ໃນແອັບ ບໍ່ໄດ້ນັ່ງເຝົ້າໜ້າເວັບ ⇒ ດັນຂຶ້ນມືຖືນຳ.
       * ບໍ່ຕັ້ງ Firebase / ບໍ່ມີ token ⇒ pushToUser ງຽບໆ ບໍ່ລົ້ມການ sync.
       */
      if (job?.emp_code) {
        await pushToUser(
          job.emp_code,
          "ອາໄຫຼ່ມາຮອດສາງແລ້ວ",
          `${track.job} · ${job.product ?? ""}${job.sn ? ` (${job.sn})` : ""} — ພ້ອມຂໍເບີກອາໄຫຼ່`,
          { model: "tb_product", res_id: track.job },
        );
      }
      jobs.push(track.job);
    }
    return { advanced: jobs.length, jobs };
  } catch (error) {
    // ERP ລົ້ມ ⇒ ໜ້າຄິວຍັງເປີດໄດ້ ພຽງແຕ່ຮອບນີ້ບໍ່ໄດ້ເລື່ອນຂັ້ນໃຫ້ໃຜ
    console.error("syncErpPurchase failed", error);
    return empty;
  }
}
