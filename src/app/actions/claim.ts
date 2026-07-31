"use server";
import { billItems, claimByNo, claimCanTransition, claimItems, type ClaimJobCandidate, cobInfo, ensureOdsCustomer, isClaimEditable, isClaimFulfillmentSource, jobClaimCandidates, jobDelivery, jobQuoteItems, PAY_METHOD_LABEL, searchBills, searchInventory, type ClaimType } from "@/lib/claim";
import { logChange } from "@/lib/chatter-log";
import { loanerBlock } from "@/lib/loaner";
import { centerBlock } from "@/lib/job-center";
import { requireRole } from "@/lib/guard";
import { sendMail } from "@/lib/mail";
import { db, query } from "@/lib/db";
import { collectUploads, saveUploads } from "@/lib/uploads";
import { recipientTargets } from "@/lib/report-recipient";
import { CLAIM_SIDE } from "@/lib/roles";
import { supplierContactByCode } from "@/lib/erp-supplier";
import { unlink } from "node:fs/promises";
import { revalidatePath } from "next/cache";

export type ClaimState = { error?: string; claimNo?: string };

const START: Record<ClaimType, string> = { A: "draft", B: "received", C: "notify" };

// ບັນທຶກ → chatter + activities (ods_chatter_message) ຄືเอกสารอื่น (author=session)
async function log(claimNo: string, _by: string, _event: string, detail: string) {
  await logChange("ods_claim", claimNo, detail, { roles: ["manager", "stock"] });
}

/** ຄົ້ນຫາງານສ້ອມ candidate ສຳລັບ modal (ສຳເລັດ · ສົ່ງຄືນ · ຍັງບໍ່ມີໃບເຄມ) */
export async function searchClaimJobs(q: string): Promise<{ error?: string; jobs?: ClaimJobCandidate[] }> {
  const g = await requireRole(CLAIM_SIDE, "ບໍ່ມີສິດ");
  if (!g.ok) return { error: g.error };
  return { jobs: await jobClaimCandidates(q) };
}

/** ເປີດໃບເຄມໃໝ່ — ຄືນ claim_no */
/**
 * ຕັດສິນ CLM-B ຢູ່ຂັ້ນ "ກວດ/ຕັດສິນ" — ເລືອກ **ປ່ຽນ (replace)** ຫຼື **ສ້ອມ (repair)**.
 * ທັງສອງ → status=done ແຕ່ບັນທຶກ resolution. ໄປໄດ້ສະເພາະຈາກ status=checking (WHERE guard).
 */
export async function resolveClaim(
  claimNo: string,
  resolution: "replace" | "repair",
  fulfillmentSource?: "stock" | "purchase" | "supplier",
): Promise<ClaimState> {
  const guard = await requireRole(CLAIM_SIDE, "ບໍ່ມີສິດຕັດສິນ");
  if (!guard.ok) return { error: guard.error };
  const current = await claimByNo(claimNo);
  if (!current || current.claim_type !== "B" || current.status !== "checking") {
    return { error: "ຕັດສິນບໍ່ໄດ້ — ໃບນີ້ບໍ່ໄດ້ຢູ່ຂັ້ນ ‘ກວດ/ຕັດສິນ’" };
  }
  if (resolution !== "replace" && resolution !== "repair") return { error: "ຕ້ອງເລືອກ ປ່ຽນ ຫຼື ສ້ອມ" };
  if (resolution === "replace" && !isClaimFulfillmentSource(fulfillmentSource)) {
    return { error: "ຕ້ອງເລືອກວ່າຈະປ່ຽນຈາກ stock, ສັ່ງຊື້ ຫຼືເຄມ supplier" };
  }
  const done = await query(
    `update ods_claim set status='done', resolution=$2, fulfillment_source=$3, result_at=localtimestamp
      where claim_no=$1 and claim_type='B' and status='checking'`,
    [claimNo, resolution, resolution === "replace" ? fulfillmentSource : null],
  );
  if (!done.rowCount) return { error: "ຕັດສິນບໍ່ໄດ້ — ໃບນີ້ບໍ່ໄດ້ຢູ່ຂັ້ນ ‘ກວດ/ຕັດສິນ’" };
  if (current.ref_job) {
    await query(
      `update tb_product set claim_decision=$2, claim_decided_at=localtimestamp
        where code=$1 and coalesce(job_kind,'repair')='claim' and time_finish_check is not null`,
      [current.ref_job, resolution === "repair" ? "repair" : fulfillmentSource],
    );
  }
  const sourceLabel = fulfillmentSource === "stock" ? "ຈາກ stock ສູນ"
    : fulfillmentSource === "purchase" ? "ສັ່ງຊື້ມາປ່ຽນ"
      : fulfillmentSource === "supplier" ? "ເຄມຕໍ່ supplier" : "";
  await log(claimNo, guard.session.username, "resolved", `ຕັດສິນ: ${resolution === "replace" ? `ປ່ຽນ · ${sourceLabel}` : "ສ້ອມ"}`);
  revalidatePath(`/claims/${claimNo}`);
  return { claimNo };
}

/** ── ERP pull (ໃຫ້ form client ເອີ້ນ) — ຄົ້ນບິນ · ລາຍการສินค้าใນບິນ · ຄົ້ນ inventory ── */
export async function findBills(q: string) {
  const guard = await requireRole(CLAIM_SIDE, "ບໍ່ມີສິດ");
  if (!guard.ok) return { error: guard.error };
  try { return { bills: await searchBills(q) }; } catch { return { error: "ຄົ້ນບິນບໍ່ໄດ້ (ERP)" }; }
}
export async function loadBillItems(docNo: string) {
  const guard = await requireRole(CLAIM_SIDE, "ບໍ່ມີສິດ");
  if (!guard.ok) return { error: guard.error };
  try { return { items: await billItems(docNo) }; } catch { return { error: "ໂຫຼດລາຍการບິນບໍ່ໄດ້ (ERP)" }; }
}
export async function findInventory(q: string) {
  const guard = await requireRole(CLAIM_SIDE, "ບໍ່ມີສິດ");
  if (!guard.ok) return { error: guard.error };
  try { return { items: await searchInventory(q) }; } catch { return { error: "ຄົ້ນສິນຄ້າບໍ່ໄດ້ (ERP)" }; }
}

export async function createClaim(input: {
  claim_type: ClaimType;
  supplier_code?: string;
  brand_code?: string;
  customer_code?: string;
  ref_job?: string;
  reason?: string;
  product?: string;
  model?: string;
  sn?: string;
  warranty?: string;
  purchase_date?: string;
  contact?: string;
  bill_no?: string;
}): Promise<ClaimState> {
  const guard = await requireRole(CLAIM_SIDE, "ບໍ່ມີສິດເປີດໃບເຄມ");
  if (!guard.ok) return { error: guard.error };
  const type = input.claim_type;
  if (!["A", "B", "C"].includes(type)) return { error: "ประเภทเคลมไม่ถูกต้อง" };
  if (type === "B" && !input.customer_code?.trim()) return { error: "CLM-B ຕ້ອງເລືອກຮ້ານ (ລູກຄ້າ)" };
  if (type === "B" && !input.reason?.trim()) return { error: "CLM-B ຕ້ອງລະບຸ ອາການ / ບັນຫາ" };
  if (type === "B" && !input.ref_job?.trim()) return { error: "CLM-B ຕ້ອງສ້າງຈາກໃບງານກວດເຊັກ" };
  if ((type === "A" || type === "C") && !input.supplier_code?.trim()) return { error: "ຕ້ອງເລືອກ supplier" };
  if (type === "C" && !input.ref_job?.trim()) return { error: "CLM-C ຕ້ອງອ້າງອີງ ເລກງານສ້ອມ" };
  const refJob = input.ref_job?.trim() ?? "";
  if (refJob && ((await query(`select 1 from tb_product where code=$1`, [refJob])).rowCount ?? 0) === 0) {
    return { error: `ບໍ່ພົບງານສ້ອມ ${refJob}` };
  }
  if (refJob && (await query(`select 1 from ods_claim where claim_type=$1 and ref_job=$2`, [type, refJob])).rowCount) {
    return { error: `ງານ ${refJob} ມີໃບ CLM-${type} ແລ້ວ` };
  }

  // ລູກຄ້າ ERP (ຈາກບິນ) ອາດຍັງບໍ່ມີໃນ ODS → copy ໃຫ້ join ຊື່ໃນລາຍການໄດ້ (ບໍ່ block ຖ້າ fail)
  if (input.customer_code?.trim()) await ensureOdsCustomer(input.customer_code.trim()).catch(() => {});

  // ⚠️ ບໍ່ໃຊ້ CTE insert+update ໃນ statement ດຽວ — UPDATE ບໍ່ເຫັນແຖວທີ່ INSERT ຫາກໍ່ໃສ່
  // (Postgres snapshot). ໃຊ້ 2 statement: insert returning id → update claim_no.
  const id = (
    await query<{ id: number }>(
      `insert into ods_claim(claim_type, supplier_code, brand_code, customer_code, ref_job, reason, status, created_by,
         product, model, sn, warranty, purchase_date, contact, bill_no)
       values ($1, nullif($2,''), nullif($3,''), nullif($4,''), nullif($5,''), nullif($6,''), $7, $8,
         nullif($9,''), nullif($10,''), nullif($11,''), nullif($12,''), nullif($13,'')::date, nullif($14,''), nullif($15,'')) returning id`,
      [type, input.supplier_code ?? "", input.brand_code ?? "", input.customer_code ?? "", input.ref_job ?? "", input.reason ?? "", START[type], guard.session.username,
        input.product ?? "", input.model ?? "", input.sn ?? "", input.warranty ?? "", input.purchase_date ?? "", input.contact ?? "", input.bill_no ?? ""],
    )
  ).rows[0]?.id;
  if (!id) return { error: "ເປີດໃບເຄມບໍ່ສຳເລັດ" };
  const row = (
    await query<{ claim_no: string }>(`update ods_claim set claim_no = 'CLM'||lpad(id::text,5,'0') where id = $1 returning claim_no`, [id])
  ).rows[0];
  if (!row) return { error: "ເປີດໃບເຄມບໍ່ສຳເລັດ" };
  await log(row.claim_no, guard.session.username, "created", `ເປີດໃບເຄມ type ${type}`);
  revalidatePath("/claims");
  return { claimNo: row.claim_no };
}

/**
 * ແนบຮูปຫຼັກฐาน (ຫຼັງເປີດໃບ) — ເກັບໃນ product_image (ref_code=claim_no · ໃຊ້ຮ່ວມ /api/uploads).
 * ⚠️ ຮູບ rollback = ລຶບໄຟລ໌ທີ່ຂຽນໄປ (ບໍ່ໃຫ້ຄ້າງ orphan).
 */
export async function addClaimPhotos(claimNo: string, formData: FormData): Promise<{ error?: string; ok?: boolean }> {
  const guard = await requireRole(CLAIM_SIDE, "ບໍ່ມີສິດແนบຮูป");
  if (!guard.ok) return { error: guard.error };
  if (!db) return { error: "ຖານຂໍ້ມູນຍັງບໍ່ພ້ອມ" };
  const collected = await collectUploads(formData);
  if (!collected.ok) return { error: collected.error };
  if (!collected.uploads.length) return { ok: true };

  const client = await db.connect();
  const written: string[] = [];
  try {
    await client.query("begin");
    await saveUploads(client, claimNo, collected.uploads, written, "ref_code");
    await client.query("commit");
  } catch (error) {
    await client.query("rollback").catch(() => {});
    for (const p of written) await unlink(p).catch(() => {});
    console.error("addClaimPhotos failed", error);
    return { error: "ແนบຮูปບໍ່ສຳເລັດ" };
  } finally {
    client.release();
  }
  revalidatePath(`/claims/${claimNo}`);
  return { ok: true };
}

const stampFor = (status: string): string | null =>
  status === "sent" || status === "submitted" ? "sent_at"
    : status === "notified" ? "notified_at"
      : status === "approved" || status === "rejected" || status === "done" || status === "paid" ? "result_at"
        : status === "closed" ? "closed_at" : null;

/** ໝາຍ CLM-C ວ່າ ຊຳລະແລ້ວ + ວິທີชำระ (cash/transfer/replace/discount) */
export async function setClaimPaid(claimNo: string, method: string): Promise<ClaimState> {
  const guard = await requireRole(CLAIM_SIDE, "ບໍ່ມີສິດ");
  if (!guard.ok) return { error: guard.error };
  if (!PAY_METHOD_LABEL[method]) return { error: "ເລືອກ ວິທີຊຳລະ" };
  // ສະເພາະ CLM-C ທີ່ຍັງບໍ່ປິດ (ກັນ mark paid ໃບ A/B ຫຼື ໃບທີ່ປິດແລ້ວ)
  const paid = await query(
    `update ods_claim set status = 'paid', pay_method = $1, result_at = coalesce(result_at, now())
      where claim_no = $2 and claim_type = 'C' and status = 'notified'`,
    [method, claimNo],
  );
  if (!paid.rowCount) return { error: "ບັນທຶກຊຳລະບໍ່ໄດ້ — ໃບนี้ບໍ່ແມ່ນ CLM-C ຫຼື ປິດແລ້ວ" };
  await log(claimNo, guard.session.username, "paid", `ຊຳລະແລ້ວ · ${PAY_METHOD_LABEL[method]}`);
  revalidatePath("/claims");
  revalidatePath(`/claims/${claimNo}`);
  return { claimNo };
}

/** ຍ້າຍ status (ຕໍ່ pipeline ຫຼື rejected) */
export async function advanceClaim(claimNo: string, toStatus: string): Promise<ClaimState> {
  const guard = await requireRole(CLAIM_SIDE, "ບໍ່ມີສິດຈັດການເຄມ");
  if (!guard.ok) return { error: guard.error };
  const claim = await claimByNo(claimNo);
  if (!claim) return { error: "ບໍ່ພົບໃບເຄມ" };
  if (!claimCanTransition(claim.claim_type, claim.status, toStatus)) return { error: "ຕ້ອງດຳເນີນຕາມລຳດັບຂັ້ນຕອນ" };
  if (claim.claim_type === "A" && claim.status === "draft" && !claim.email_sent_at) return { error: "ຕ້ອງສົ່ງ email ຫາ supplier ກ່ອນ" };
  if (claim.claim_type === "C" && claim.status === "notify" && !claim.email_sent_at) return { error: "ຕ້ອງສົ່ງ email ແຈ້ງ supplier ກ່ອນ" };

  /**
   * CLM-B ຂັ້ນ "returned" ປິດໃບງານສ້ອມໃຫ້ນຳ (ລຸ່ມນີ້) ⇒ ເປັນ**ທາງອອກທີ 4** ທີ່ປະທັບ
   * return_complete ນອກຈາກ 3 ທາງຂອງ actions/return.ts ⇒ ດ່ານເຄື່ອງສຳຮອງຕ້ອງມີຢູ່ນີ້ຄືກັນ
   * ບໍ່ດັ່ງນັ້ນປິດງານຜ່ານໃບເຄມແລ້ວເຄື່ອງສູນຄ້າງຢູ່ບ້ານລູກຄ້າໂດຍບໍ່ມີໃຜຮູ້.
   */
  if (claim.claim_type === "B" && claim.ref_job && toStatus === "returned") {
    const loanerHold = await loanerBlock(claim.ref_job);
    if (loanerHold) return { error: loanerHold };
    // ເຄື່ອງຍັງຢູ່ອີກສູນ / ກຳລັງໂອນ ⇒ ຄືນຮ້ານບໍ່ໄດ້ (ດ່ານດຽວກັບ actions/return)
    const centerHold = await centerBlock(claim.ref_job);
    if (centerHold) return { error: centerHold };
  }

  const stamp = stampFor(toStatus);
  // WHERE ຜູກ status ປັດຈຸບັນ ⇒ ກັນ 2 ຄົນກົດພ້ອມກັນ (ຄົນທີ 2 ບໍ່ຜ່ານ)
  const moved = await query(
    `update ods_claim set status = $1${stamp ? `, ${stamp} = coalesce(${stamp}, now())` : ""} where claim_no = $2 and status = $3`,
    [toStatus, claimNo, claim.status],
  );
  if (!moved.rowCount) return { error: "ຍ້າຍສະຖານະບໍ່ໄດ້ — ສະຖານະຖືກປ່ຽນໄປແລ້ວ" };
  // CLM-B returned/closed ຕ້ອງສະທ້ອນກັບໃບງານຫຼັກ ບໍ່ໃຫ້ຄ້າງຢູ່ຄິວດຳເນີນເຄມ.
  if (claim.claim_type === "B" && claim.ref_job && toStatus === "returned") {
    await query(
      `update tb_product set time_finish_repair=coalesce(time_finish_repair,localtimestamp),
         qc_finish=coalesce(qc_finish,localtimestamp), return_complete=coalesce(return_complete,localtimestamp)
       where code=$1 and coalesce(job_kind,'repair')='claim'`,
      [claim.ref_job],
    );
    revalidatePath(`/service/${claim.ref_job}`);
    revalidatePath("/service");
  }
  await log(claimNo, guard.session.username, "status", `→ ${toStatus}`);
  revalidatePath("/claims");
  revalidatePath(`/claims/${claimNo}`);
  return { claimNo };
}

export async function addClaimItem(claimNo: string, item: { item_code?: string; item_name: string; qty?: number; unit?: string; amount?: number }): Promise<ClaimState> {
  const guard = await requireRole(CLAIM_SIDE, "ບໍ່ມີສິດ");
  if (!guard.ok) return { error: guard.error };
  if (!item.item_name?.trim()) return { error: "ຕ້ອງໃສ່ຊື່ອາໄຫຼ່/ລາຍການ" };
  const claim = await claimByNo(claimNo);
  if (!claim || !isClaimEditable(claim.claim_type, claim.status)) return { error: "ໃບເຄມສົ່ງແລ້ວ — ແກ້ລາຍການບໍ່ໄດ້" };
  if (!Number.isFinite(item.qty ?? 1) || (item.qty ?? 1) <= 0) return { error: "ຈຳນວນຕ້ອງຫຼາຍກວ່າ 0" };
  if (!Number.isFinite(item.amount ?? 0) || (item.amount ?? 0) < 0) return { error: "ຈຳນວນເງິນບໍ່ຖືກຕ້ອງ" };
  await query(
    `insert into ods_claim_item(claim_no, item_code, item_name, qty, unit, amount) values ($1, nullif($2,''), $3, $4, nullif($5,''), $6)`,
    [claimNo, item.item_code ?? "", item.item_name.trim(), item.qty ?? 1, item.unit ?? "", item.amount ?? 0],
  );
  await query(`update ods_claim set amount = coalesce((select sum(amount) from ods_claim_item where claim_no=$1),0) where claim_no=$1`, [claimNo]);
  revalidatePath(`/claims/${claimNo}`);
  return { claimNo };
}

export async function deleteClaimItem(claimNo: string, id: number): Promise<ClaimState> {
  const guard = await requireRole(CLAIM_SIDE, "ບໍ່ມີສິດ");
  if (!guard.ok) return { error: guard.error };
  const claim = await claimByNo(claimNo);
  if (!claim || !isClaimEditable(claim.claim_type, claim.status)) return { error: "ໃບເຄມສົ່ງແລ້ວ — ລຶບລາຍການບໍ່ໄດ້" };
  await query(`delete from ods_claim_item where id = $1 and claim_no = $2`, [id, claimNo]);
  await query(`update ods_claim set amount = coalesce((select sum(amount) from ods_claim_item where claim_no=$1),0) where claim_no=$1`, [claimNo]);
  revalidatePath(`/claims/${claimNo}`);
  return { claimNo };
}

/**
 * ຜູກ CLM-C ກັບເອກະສານ COB (ic_trans trans_flag=87) ໃນ ERP — **ກວດວ່າມີຈິງ (read-only)**
 * ແລ້ວເກັບ doc_no ໃສ່ ods_claim.erp_doc_no. ບໍ່ສ້າງ/ບໍ່ແກ້ ERP. ວ່າງ = ຖອດການຜູກ.
 */
export async function linkCob(claimNo: string, docNo: string): Promise<ClaimState> {
  const guard = await requireRole(CLAIM_SIDE, "ບໍ່ມີສິດ");
  if (!guard.ok) return { error: guard.error };
  const claim = await claimByNo(claimNo);
  if (!claim || claim.claim_type !== "C") return { error: "COB ຜູກໄດ້ສະເພາະ CLM-C" };
  if (!isClaimEditable(claim.claim_type, claim.status)) return { error: "ໃບເຄມແຈ້ງແລ້ວ — ປ່ຽນ COB ບໍ່ໄດ້" };
  const d = docNo.trim();
  if (!d) {
    await query(`update ods_claim set erp_doc_no = null where claim_no = $1`, [claimNo]);
    await log(claimNo, guard.session.username, "cob", "ຖອດການຜູກ COB");
    revalidatePath(`/claims/${claimNo}`);
    return { claimNo };
  }
  const info = await cobInfo(d);
  if (!info) return { error: `ບໍ່ພົບເອກະສານ COB ${d} ໃນ ERP` };
  if (claim.supplier_code && info.supplier_code && claim.supplier_code !== info.supplier_code) {
    return { error: `Supplier ໃນ COB (${info.supplier_code}) ບໍ່ກົງກັບໃບເຄມ (${claim.supplier_code})` };
  }
  await query(`update ods_claim set erp_doc_no = $1 where claim_no = $2`, [info.doc_no, claimNo]);
  await log(claimNo, guard.session.username, "cob", `ຜູກ COB ${info.doc_no} (${info.total_amount.toLocaleString()})`);
  revalidatePath(`/claims/${claimNo}`);
  return { claimNo };
}

/** ຜູກ/ປ່ຽນ ເລກงาน (ref_job) ຂອງໃບເຄມ — ກວດວ່າ job ມีจริง → ດຶງข้อมูล job มาโชว์ */
export async function setClaimJob(claimNo: string, jobCode: string): Promise<ClaimState> {
  const guard = await requireRole(CLAIM_SIDE, "ບໍ່ມີສິດ");
  if (!guard.ok) return { error: guard.error };
  const claim = await claimByNo(claimNo);
  if (!claim || claim.claim_type !== "C" || !isClaimEditable(claim.claim_type, claim.status)) {
    return { error: "ປ່ຽນເລກງານໄດ້ສະເພາະ CLM-C ກ່ອນແຈ້ງ supplier" };
  }
  const j = jobCode.trim();
  if (!j) return { error: "ໃສ່ ເລກງານ" };
  if (((await query(`select 1 from tb_product where code = $1`, [j])).rowCount ?? 0) === 0) return { error: `ບໍ່ພົບงาน ${j}` };
  if ((await query(`select 1 from ods_claim where claim_type='C' and ref_job=$1 and claim_no<>$2`, [j, claimNo])).rowCount) {
    return { error: `ງານ ${j} ມີໃບ CLM-C ແລ້ວ` };
  }
  await query(`update ods_claim set ref_job = $1 where claim_no = $2`, [j, claimNo]);
  await log(claimNo, guard.session.username, "job", `ຜູກງານ ${j}`);
  revalidatePath(`/claims/${claimNo}`);
  return { claimNo };
}

/** ດຶງ ເອກະສານ pending (ໃບສະເໜີລາຄາ/ເກັບເງิน) ຂອງ ref_job → items ພ້ອมราคาจริง */
export async function pullJobItems(claimNo: string): Promise<ClaimState> {
  const guard = await requireRole(CLAIM_SIDE, "ບໍ່ມີສິດ");
  if (!guard.ok) return { error: guard.error };
  const claim = await claimByNo(claimNo);
  if (!claim?.ref_job) return { error: "ຍັງບໍ່ມີ ເລກງານ (ຜູກກ່ອນ)" };
  if (claim.claim_type !== "C" || !isClaimEditable(claim.claim_type, claim.status)) return { error: "ດຶງລາຍການໄດ້ກ່ອນແຈ້ງ supplier ເທົ່ານັ້ນ" };
  const { docNo, items } = await jobQuoteItems(claim.ref_job);
  if (items.length === 0) return { error: "ບໍ່ພົບ ໃບສະເໜີລາຄາ/ເກັບເງິນ ຂອງງານນີ້" };
  if (!db) return { error: "ຖານຂໍ້ມູນຍັງບໍ່ພ້ອມ" };
  const client = await db.connect();
  try {
    await client.query("begin");
    // ດຶງຊ້ຳ = refresh ລາຍການ, ບໍ່ແມ່ນ append ໃຫ້ຍອດຊ້ຳ.
    await client.query(`delete from ods_claim_item where claim_no=$1`, [claimNo]);
    for (const it of items) {
      await client.query(
        `insert into ods_claim_item(claim_no, item_code, item_name, qty, unit, amount) values ($1, nullif($2,''), $3, $4, nullif($5,''), $6)`,
        [claimNo, it.item_code ?? "", it.item_name ?? "ລາຍການ", it.qty || 1, it.unit ?? "", it.amount],
      );
    }
    await client.query(`update ods_claim set amount = coalesce((select sum(amount) from ods_claim_item where claim_no=$1),0) where claim_no=$1`, [claimNo]);
    await client.query("commit");
  } catch {
    await client.query("rollback").catch(() => {});
    return { error: "ດຶງລາຍການບໍ່ສຳເລັດ" };
  } finally {
    client.release();
  }
  await log(claimNo, guard.session.username, "items", `ດຶງ ໃບ ${docNo} — ${items.length} ລາຍການ`);
  revalidatePath(`/claims/${claimNo}`);
  return { claimNo };
}

/** ໝາຍ / ຖອດໝາຍ งาน "ເຄມເງิน supplier" (ໃຫ້ຂຶ້ນ candidate CLM-C ຫຼັງສ່ງคืน) */
export async function markJobClaim(jobCode: string, on: boolean): Promise<ClaimState> {
  const guard = await requireRole(CLAIM_SIDE, "ບໍ່ມີສິດ");
  if (!guard.ok) return { error: guard.error };
  const c = jobCode.trim();
  if (!c) return { error: "ບໍ່ພົບ job" };
  if (on) {
    await query(`insert into ods_claim_mark(job_code, marked_by) values ($1,$2) on conflict (job_code) do nothing`, [c, guard.session.username]);
  } else {
    await query(`delete from ods_claim_mark where job_code = $1`, [c]);
  }
  revalidatePath(`/service/${c}`);
  revalidatePath("/claims");
  return { claimNo: c };
}

/**
 * ສ່ງ email ໃບເຄມ ຫາຜູ້ຮັບ (config /manage/report-recipients, fallback env) — ດຶງ "ເອກະສານ
 * ສົ່ງເຄື່ອງ" (delivery ຂອງ ref_job) ໃສ່ນຳ → ໝາຍ email_sent_at.
 */
export async function sendClaimEmail(claimNo: string): Promise<ClaimState> {
  const guard = await requireRole(CLAIM_SIDE, "ບໍ່ມີສິດ");
  if (!guard.ok) return { error: guard.error };
  const claim = await claimByNo(claimNo);
  if (!claim) return { error: "ບໍ່ພົບໃບເຄມ" };
  if (!["A", "C"].includes(claim.claim_type) || !claim.supplier_code) return { error: "ໃບເຄມນີ້ສົ່ງຫາ supplier ບໍ່ໄດ້" };
  if (!isClaimEditable(claim.claim_type, claim.status) && !claim.email_sent_at) return { error: "ສະຖານະໃບເຄມບໍ່ອະນຸຍາດໃຫ້ສົ່ງ" };
  const supplier = await supplierContactByCode(claim.supplier_code);
  if (!supplier) return { error: `ບໍ່ພົບ supplier ${claim.supplier_code} ໃນ ERP` };
  if (!supplier.email) return { error: `Supplier ${supplier.name} ຍັງບໍ່ມີ email ໃນ ERP` };
  const { emails } = await recipientTargets();
  const cc = emails.length ? emails.join(",") : (process.env.MAIL_TO ?? "");
  const delivery = claim.ref_job ? await jobDelivery(claim.ref_job) : null;
  const lines = await claimItems(claimNo);
  if (claim.claim_type === "A" && lines.length === 0) return { error: "ຕ້ອງມີອາໄຫຼ່ຢ່າງໜ້ອຍ 1 ລາຍການ" };
  if (claim.claim_type === "C" && !delivery) return { error: "ຕ້ອງຜູກເລກງານທີ່ສົ່ງຄືນແລ້ວ" };
  const text = [
    `ໃບເຄມ ${claim.claim_no} (CLM-${claim.claim_type})`,
    `Supplier: ${claim.supplier_code ?? "-"}`,
    claim.brand_code ? `ຫຍີ່ຫໍ້: ${claim.brand_code}` : null,
    claim.product ? `ສິນຄ້າ: ${claim.product}${claim.sn ? ` · SN ${claim.sn}` : ""}` : null,
    delivery
      ? `ເອກະສານສົ່ງເຄື່ອງ: ງານ ${delivery.code} · ${delivery.product ?? ""} · ລູກຄ້າ ${delivery.customer ?? "-"} · ສ່ງคืน ${delivery.returned_at ?? "-"}`
      : claim.ref_job ? `ເລກງານ: ${claim.ref_job}` : null,
    lines.length ? `ອາໄຫຼ່/ລາຍการ:\n${lines.map((l) => `  - ${l.item_name}${l.item_code ? ` (${l.item_code})` : ""} × ${l.qty}${l.unit ? ` ${l.unit}` : ""}`).join("\n")}` : null,
    claim.amount ? `ຍอด: ${claim.amount.toLocaleString()}` : null,
    claim.reason ? `ເຫດ: ${claim.reason}` : null,
  ].filter(Boolean).join("\n");
  const res = await sendMail({ to: supplier.email, cc, subject: `ເຄມ ${claim.claim_no} — ${claim.supplier_code ?? ""}`.trim(), text });
  if (!res.sent) return { error: `ສ່ງ email ບໍ່ໄດ້: ${res.reason ?? ""}` };
  const next = claim.claim_type === "A" ? "sent" : "notified";
  await query(
    `update ods_claim set email_sent_at=now(), status=case when status=$2 then $3 else status end,
       ${claim.claim_type === "A" ? "sent_at" : "notified_at"}=coalesce(${claim.claim_type === "A" ? "sent_at" : "notified_at"},now())
     where claim_no=$1`,
    [claimNo, START[claim.claim_type], next],
  );
  await log(claimNo, guard.session.username, "email", `ສົ່ງ email ຫາ ${supplier.email}${cc ? ` · CC ${cc}` : ""} · → ${next}`);
  revalidatePath(`/claims/${claimNo}`);
  return { claimNo };
}

/** ແກ້ໄຂ ຫົວໃບເຄມ (supplier / ຫຍີ່ຫໍ້ / ເຫດຜົນ) */
export async function updateClaim(claimNo: string, f: { supplier_code?: string; brand_code?: string; reason?: string }): Promise<ClaimState> {
  const guard = await requireRole(CLAIM_SIDE, "ບໍ່ມີສິດ");
  if (!guard.ok) return { error: guard.error };
  const claim = await claimByNo(claimNo);
  if (!claim || !isClaimEditable(claim.claim_type, claim.status)) return { error: "ໃບເຄມສົ່ງແລ້ວ — ແກ້ຫົວໃບບໍ່ໄດ້" };
  await query(
    `update ods_claim set supplier_code = nullif($1,''), brand_code = nullif($2,''), reason = nullif($3,'') where claim_no = $4`,
    [f.supplier_code ?? "", f.brand_code ?? "", f.reason ?? "", claimNo],
  );
  await log(claimNo, guard.session.username, "edit", "ແກ້ໄຂ ຫົວໃບເຄມ");
  revalidatePath(`/claims/${claimNo}`);
  return { claimNo };
}

/** ລບ ໃບເຄມ (+ ລາຍການ) — ຍ້ອນຄືນบໍ่ได้ */
export async function deleteClaim(claimNo: string): Promise<ClaimState> {
  const guard = await requireRole(CLAIM_SIDE, "ບໍ່ມີສິດ");
  if (!guard.ok) return { error: guard.error };
  const claim = await claimByNo(claimNo);
  if (!claim || !isClaimEditable(claim.claim_type, claim.status)) return { error: "ລຶບໄດ້ສະເພາະໃບທີ່ຍັງບໍ່ສົ່ງ" };
  await query(`delete from ods_claim_item where claim_no = $1`, [claimNo]);
  await query(`delete from ods_claim where claim_no = $1`, [claimNo]);
  await log(claimNo, guard.session.username, "delete", `ລບ ໃບເຄມ ${claimNo}`);
  revalidatePath("/claims");
  return { claimNo };
}

export async function updateClaimRemark(claimNo: string, remark: string): Promise<ClaimState> {
  const guard = await requireRole(CLAIM_SIDE, "ບໍ່ມີສິດ");
  if (!guard.ok) return { error: guard.error };
  await query(`update ods_claim set remark = nullif($1,'') where claim_no = $2`, [remark.trim(), claimNo]);
  revalidatePath(`/claims/${claimNo}`);
  return { claimNo };
}
