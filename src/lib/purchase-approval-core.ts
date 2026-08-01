import { logChange } from "@/lib/chatter-log";
import { ROLE_WAREHOUSE } from "@/lib/chatter";
import { db, odgDb } from "@/lib/db";
import { linkErpDoc } from "@/lib/erp-doc-link";
import { approvePo, approvePr } from "@/lib/erp-po";
import { ERP_PURCHASE } from "@/lib/stock-constants";

export type PurchaseApprovalResult = { ok: true; document?: string } | { ok: false; error: string };

function bangkokTime() {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Bangkok", hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(new Date());
}

function jobModel(code: string) {
  return code.startsWith("INST-") ? "ods_tb_install" : "tb_product";
}

/** Shared mutation used by native mobile approval (and safe to reuse from Web actions). */
export async function approveSprCore(username: string, sprNo: string): Promise<PurchaseApprovalResult> {
  if (!db || !odgDb) return { ok: false, error: "ບໍ່ພົບການເຊື່ອມຕໍ່ຖານຂໍ້ມູນ" };
  const odg = await odgDb.connect();
  let wpra = "";
  let jobCode = "";
  try {
    await odg.query("begin");
    const head = (await odg.query<{ doc_ref: string | null; branch_code: string | null }>(
      `select doc_ref, branch_code from ic_trans
       where doc_no=$1 and trans_flag=$2 and doc_format_code='SPR' for update`,
      [sprNo, ERP_PURCHASE.PR_REQUEST],
    )).rows[0];
    if (!head) { await odg.query("rollback"); return { ok: false, error: `ບໍ່ພົບໃບຂໍຊື້ ${sprNo} ໃນ ERP` }; }
    jobCode = (head.doc_ref ?? "").split(" ")[0];
    const dup = await odg.query(
      `select 1 from ic_trans_detail where trans_flag=$1 and ref_doc_no=$2 limit 1`,
      [ERP_PURCHASE.PR_APPROVE, sprNo],
    );
    if (dup.rowCount) { await odg.query("rollback"); return { ok: false, error: `ໃບ ${sprNo} ອະນຸມັດໄປແລ້ວ` }; }
    wpra = await approvePr(odg, {
      sprNo, jobCode, branch: head.branch_code ?? "00",
      doc_date: new Date().toISOString().slice(0, 10), doc_time: bangkokTime(), approver: username,
    });
    await odg.query("commit");
  } catch (error) {
    await odg.query("rollback").catch(() => {});
    console.error("approveSprCore failed", error);
    return { ok: false, error: "ອະນຸມັດບໍ່ສຳເລັດ ກະລຸນາລອງໃໝ່" };
  } finally { odg.release(); }
  if (jobCode && jobModel(jobCode) === "tb_product") {
    await db.query(`update tb_product set spare_order=localtimestamp(0) where code=$1 and spare_order is null`, [jobCode]);
  }
  if (jobCode && wpra) {
    const client = await db.connect();
    try { await linkErpDoc(client, { docNo: wpra, transFlag: ERP_PURCHASE.PR_APPROVE, jobCode, by: username }); }
    finally { client.release(); }
  }
  if (jobCode) await logChange(jobModel(jobCode), jobCode,
    `ອະນຸມັດໃບຂໍຊື້ ${sprNo} (${wpra}) — ລໍອອກໃບສັ່ງຊື້`, { roles: ROLE_WAREHOUSE });
  return { ok: true, document: wpra };
}

export async function rejectSprCore(_username: string, sprNo: string, reason = ""): Promise<PurchaseApprovalResult> {
  if (!odgDb) return { ok: false, error: "ບໍ່ພົບ ODG_DATABASE_URL" };
  const odg = await odgDb.connect();
  let jobCode = "";
  try {
    await odg.query("begin");
    const head = (await odg.query<{ doc_ref: string | null }>(
      `select doc_ref from ic_trans where doc_no=$1 and trans_flag=$2 and doc_format_code='SPR' for update`,
      [sprNo, ERP_PURCHASE.PR_REQUEST],
    )).rows[0];
    if (!head) { await odg.query("rollback"); return { ok: false, error: `ບໍ່ພົບໃບ ${sprNo}` }; }
    jobCode = (head.doc_ref ?? "").split(" ")[0];
    const approved = await odg.query(
      `select 1 from ic_trans_detail where trans_flag=$1 and ref_doc_no=$2 limit 1`,
      [ERP_PURCHASE.PR_APPROVE, sprNo],
    );
    if (approved.rowCount) { await odg.query("rollback"); return { ok: false, error: `ໃບ ${sprNo} ອະນຸມັດໄປແລ້ວ — ປະຕິເສດບໍ່ໄດ້` }; }
    await odg.query(`delete from ic_trans_detail where doc_no=$1 and trans_flag=$2`, [sprNo, ERP_PURCHASE.PR_REQUEST]);
    await odg.query(`delete from ic_trans where doc_no=$1 and trans_flag=$2`, [sprNo, ERP_PURCHASE.PR_REQUEST]);
    await odg.query("commit");
  } catch (error) {
    await odg.query("rollback").catch(() => {});
    console.error("rejectSprCore failed", error);
    return { ok: false, error: "ປະຕິເສດບໍ່ສຳເລັດ ກະລຸນາລອງໃໝ່" };
  } finally { odg.release(); }
  if (jobCode) await logChange(jobModel(jobCode), jobCode,
    `ປະຕິເສດໃບຂໍຊື້ ${sprNo}${reason ? ` — ${reason}` : ""} — ລຶບອອກຈາກ ERP`);
  return { ok: true };
}

export async function approvePoCore(username: string, poNo: string): Promise<PurchaseApprovalResult> {
  if (!odgDb) return { ok: false, error: "ບໍ່ພົບ ODG_DATABASE_URL" };
  const odg = await odgDb.connect();
  let jobCode = "";
  let wpoa = "";
  try {
    await odg.query("begin");
    const head = (await odg.query<{ remark: string | null; branch_code: string | null; cust_code: string | null }>(
      `select remark, branch_code, cust_code from ic_trans where doc_no=$1 and trans_flag=$2 for update`,
      [poNo, ERP_PURCHASE.ORDER],
    )).rows[0];
    if (!head) { await odg.query("rollback"); return { ok: false, error: `ບໍ່ພົບໃບສັ່ງຊື້ ${poNo}` }; }
    jobCode = (head.remark ?? "").split(" ")[0];
    const dup = await odg.query(
      `select 1 from ic_trans where trans_flag=$1 and split_part(trim(coalesce(doc_ref,'')),' ',1)=$2 limit 1`,
      [ERP_PURCHASE.ORDER_APPROVE, poNo],
    );
    if (dup.rowCount) { await odg.query("rollback"); return { ok: false, error: `ໃບ ${poNo} ອະນຸມັດໄປແລ້ວ` }; }
    wpoa = await approvePo(odg, {
      poNo, jobCode, branch: head.branch_code ?? "00", supplier: head.cust_code ?? "",
      doc_date: new Date().toISOString().slice(0, 10), doc_time: bangkokTime(), approver: username,
    });
    await odg.query("commit");
  } catch (error) {
    await odg.query("rollback").catch(() => {});
    console.error("approvePoCore failed", error);
    return { ok: false, error: "ອະນຸມັດ PO ບໍ່ສຳເລັດ ກະລຸນາລອງໃໝ່" };
  } finally { odg.release(); }
  if (jobCode && jobModel(jobCode) === "tb_product") await logChange("tb_product", jobCode,
    `ອະນຸມັດໃບສັ່ງຊື້ ${poNo} (${wpoa}) — ລໍຜູ້ສະໜອງສົ່ງຂອງ`, { roles: ROLE_WAREHOUSE });
  return { ok: true, document: wpoa };
}
