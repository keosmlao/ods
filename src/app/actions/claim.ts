"use server";
import { CLAIM_FLOW, CLAIM_REJECTED, claimByNo, cobInfo, jobDelivery, PAY_METHOD_LABEL, type ClaimType } from "@/lib/claim";
import { logChange } from "@/lib/chatter-log";
import { requireRole } from "@/lib/guard";
import { sendMail } from "@/lib/mail";
import { query } from "@/lib/db";
import { recipientTargets } from "@/lib/report-recipient";
import { CLAIM_SIDE } from "@/lib/roles";
import { revalidatePath } from "next/cache";

export type ClaimState = { error?: string; claimNo?: string };

const START: Record<ClaimType, string> = { A: "draft", B: "received", C: "notify" };

// ບັນທຶກ → chatter + activities (ods_chatter_message) ຄືเอกสารอื่น (author=session)
async function log(claimNo: string, _by: string, _event: string, detail: string) {
  await logChange("ods_claim", claimNo, detail, { roles: ["manager", "stock"] });
}

/** ເປີດໃບເຄມໃໝ່ — ຄືນ claim_no */
export async function createClaim(input: {
  claim_type: ClaimType;
  supplier_code?: string;
  brand_code?: string;
  customer_code?: string;
  ref_job?: string;
  reason?: string;
}): Promise<ClaimState> {
  const guard = await requireRole(CLAIM_SIDE, "ບໍ່ມີສິດເປີດໃບເຄມ");
  if (!guard.ok) return { error: guard.error };
  const type = input.claim_type;
  if (!["A", "B", "C"].includes(type)) return { error: "ประเภทเคลมไม่ถูกต้อง" };
  if (type === "B" && !input.customer_code?.trim()) return { error: "CLM-B ຕ້ອງເລືອກຮ້ານ (ລູກຄ້າ)" };
  if ((type === "A" || type === "C") && !input.supplier_code?.trim()) return { error: "ຕ້ອງເລືອກ supplier" };

  // ⚠️ ບໍ່ໃຊ້ CTE insert+update ໃນ statement ດຽວ — UPDATE ບໍ່ເຫັນແຖວທີ່ INSERT ຫາກໍ່ໃສ່
  // (Postgres snapshot). ໃຊ້ 2 statement: insert returning id → update claim_no.
  const id = (
    await query<{ id: number }>(
      `insert into ods_claim(claim_type, supplier_code, brand_code, customer_code, ref_job, reason, status, created_by)
       values ($1, nullif($2,''), nullif($3,''), nullif($4,''), nullif($5,''), nullif($6,''), $7, $8) returning id`,
      [type, input.supplier_code ?? "", input.brand_code ?? "", input.customer_code ?? "", input.ref_job ?? "", input.reason ?? "", START[type], guard.session.username],
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
  await query(`update ods_claim set status = 'paid', pay_method = $1, result_at = coalesce(result_at, now()) where claim_no = $2`, [method, claimNo]);
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
  const valid = new Set([...CLAIM_FLOW[claim.claim_type].map((s) => s.status), ...(claim.claim_type === "A" ? [CLAIM_REJECTED.status] : [])]);
  if (!valid.has(toStatus)) return { error: "ສະຖານະບໍ່ຖືກຕ້ອງ" };

  const stamp = stampFor(toStatus);
  await query(
    `update ods_claim set status = $1${stamp ? `, ${stamp} = coalesce(${stamp}, now())` : ""} where claim_no = $2`,
    [toStatus, claimNo],
  );
  await log(claimNo, guard.session.username, "status", `→ ${toStatus}`);
  revalidatePath("/claims");
  revalidatePath(`/claims/${claimNo}`);
  return { claimNo };
}

export async function addClaimItem(claimNo: string, item: { item_code?: string; item_name: string; qty?: number; unit?: string; amount?: number }): Promise<ClaimState> {
  const guard = await requireRole(CLAIM_SIDE, "ບໍ່ມີສິດ");
  if (!guard.ok) return { error: guard.error };
  if (!item.item_name?.trim()) return { error: "ຕ້ອງໃສ່ຊື່ອາໄຫຼ່/ລາຍການ" };
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
  const d = docNo.trim();
  if (!d) {
    await query(`update ods_claim set erp_doc_no = null where claim_no = $1`, [claimNo]);
    await log(claimNo, guard.session.username, "cob", "ຖອດການຜູກ COB");
    revalidatePath(`/claims/${claimNo}`);
    return { claimNo };
  }
  const info = await cobInfo(d);
  if (!info) return { error: `ບໍ່ພົບເອກະສານ COB ${d} ໃນ ERP` };
  await query(`update ods_claim set erp_doc_no = $1 where claim_no = $2`, [info.doc_no, claimNo]);
  await log(claimNo, guard.session.username, "cob", `ຜູກ COB ${info.doc_no} (${info.total_amount.toLocaleString()})`);
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
  const { emails } = await recipientTargets();
  const to = emails.length ? emails.join(",") : (process.env.MAIL_TO ?? "");
  if (!to.trim()) return { error: "ຍັງບໍ່ມີຜູ້ຮັບ email (ຕັ້ງທີ່ /manage/report-recipients)" };
  const delivery = claim.ref_job ? await jobDelivery(claim.ref_job) : null;
  const text = [
    `ໃບເຄມ ${claim.claim_no} (CLM-${claim.claim_type})`,
    `Supplier: ${claim.supplier_code ?? "-"}`,
    claim.brand_code ? `ຫຍີ່ຫໍ້: ${claim.brand_code}` : null,
    delivery
      ? `ເອກະສານສົ່ງເຄື່ອງ: ງານ ${delivery.code} · ${delivery.product ?? ""} · ລູກຄ້າ ${delivery.customer ?? "-"} · ສ່ງคืน ${delivery.returned_at ?? "-"}`
      : claim.ref_job ? `ເລກງານ: ${claim.ref_job}` : null,
    `ຍอด: ${claim.amount.toLocaleString()}`,
    claim.reason ? `ເຫດ: ${claim.reason}` : null,
  ].filter(Boolean).join("\n");
  const res = await sendMail({ to, subject: `ເຄມ ${claim.claim_no} — ${claim.supplier_code ?? ""}`.trim(), text });
  if (!res.sent) return { error: `ສ່ງ email ບໍ່ໄດ້: ${res.reason ?? ""}` };
  await query(`update ods_claim set email_sent_at = now() where claim_no = $1`, [claimNo]);
  await log(claimNo, guard.session.username, "email", `ສ່ງ email ຫາ ${to}`);
  revalidatePath(`/claims/${claimNo}`);
  return { claimNo };
}

export async function updateClaimRemark(claimNo: string, remark: string): Promise<ClaimState> {
  const guard = await requireRole(CLAIM_SIDE, "ບໍ່ມີສິດ");
  if (!guard.ok) return { error: guard.error };
  await query(`update ods_claim set remark = nullif($1,'') where claim_no = $2`, [remark.trim(), claimNo]);
  revalidatePath(`/claims/${claimNo}`);
  return { claimNo };
}
