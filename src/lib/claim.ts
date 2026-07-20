import {
  type ClaimCandidate,
  type ClaimDailySummary,
  type ClaimItem,
  type ClaimLog,
  type ClaimRow,
  claimStatusLabel,
  type ClaimType,
  type CobInfo,
  type JobDelivery,
} from "@/lib/claim-shared";
import { query, queryOdg } from "@/lib/db";

// ⚠️ ຄ່າຄົງ + types + pure fn ຢູ່ claim-shared (client import ໄດ້). ບ່ອນນີ້ = query functions (server).
export * from "@/lib/claim-shared";

type RawClaim = Omit<ClaimRow, "status_label" | "amount"> & { amount: string | null };

const mapRow = (r: RawClaim): ClaimRow => ({
  ...r,
  amount: Number(r.amount ?? 0),
  status_label: claimStatusLabel(r.claim_type, r.status),
});

const SELECT = `select c.id, c.claim_no, c.claim_type, c.supplier_code, c.brand_code, c.customer_code,
    cust.name_1 customer_name, c.ref_job, c.erp_doc_no, c.status, c.amount, c.reason, c.created_by,
    to_char(c.created_at,'DD-MM-YYYY HH24:MI') created_at,
    to_char(c.email_sent_at,'DD-MM-YYYY HH24:MI') email_sent_at, c.pay_method, c.remark
  from ods_claim c
  left join ar_customer cust on cust.code = c.customer_code`;

export async function listClaims(opts: { type?: ClaimType; status?: string; q?: string } = {}): Promise<ClaimRow[]> {
  const where: string[] = [];
  const args: (string | number)[] = [];
  if (opts.type) { args.push(opts.type); where.push(`c.claim_type = $${args.length}`); }
  if (opts.status) { args.push(opts.status); where.push(`c.status = $${args.length}`); }
  if (opts.q?.trim()) {
    args.push(`%${opts.q.trim()}%`);
    where.push(`(c.claim_no ilike $${args.length} or c.supplier_code ilike $${args.length} or c.ref_job ilike $${args.length} or cust.name_1 ilike $${args.length})`);
  }
  const sql = `${SELECT}${where.length ? ` where ${where.join(" and ")}` : ""} order by c.created_at desc nulls last, c.id desc`;
  return (await query<RawClaim>(sql, args)).rows.map(mapRow);
}

export async function claimByNo(claimNo: string): Promise<ClaimRow | null> {
  const r = (await query<RawClaim>(`${SELECT} where c.claim_no = $1 limit 1`, [claimNo])).rows[0];
  return r ? mapRow(r) : null;
}

export async function claimItems(claimNo: string): Promise<ClaimItem[]> {
  const rows = (await query<Omit<ClaimItem, "qty" | "amount"> & { qty: string; amount: string }>(
    `select id, item_code, item_name, qty, unit, amount, note from ods_claim_item where claim_no = $1 order by id`,
    [claimNo],
  )).rows;
  return rows.map((r) => ({ ...r, qty: Number(r.qty), amount: Number(r.amount) }));
}

export async function claimLogs(claimNo: string): Promise<ClaimLog[]> {
  return (await query<ClaimLog>(
    `select to_char(at,'DD-MM-YYYY HH24:MI') at, by_user, event, detail from ods_claim_log where claim_no = $1 order by id desc`,
    [claimNo],
  )).rows;
}

/**
 * ອ່ານເອກະສານ COB (ic_trans trans_flag=87) ຈາກ ERP — **read-only** (ໃຫ້ CLM-C ຜູກ doc_no
 * ຂອງໃບ COB ທີ່ບັນຊີສ້າງໄວ້ແລ້ວ, ບໍ່ສ້າງ/ບໍ່ແກ້ ໃນ ERP). status 0 = ຍັງ, 1+ = ດຳເນີນການ.
 */
export async function cobInfo(docNo: string): Promise<CobInfo | null> {
  const r = (
    await queryOdg<{ doc_no: string; doc_date: string | null; cust_code: string | null; total_amount: string | null; status: number }>(
      `select doc_no, to_char(doc_date,'DD-MM-YYYY') doc_date, cust_code, total_amount, status
         from ic_trans where trans_flag = 87 and doc_no = $1 limit 1`,
      [docNo],
    )
  ).rows[0];
  return r ? { doc_no: r.doc_no, doc_date: r.doc_date, supplier_code: r.cust_code, total_amount: Number(r.total_amount ?? 0), status: r.status } : null;
}

/** ຂໍ້ມູນ "ເອກະສານສົ່ງເຄື່ອງ" (delivery) ຂອງ job — ໃຫ້ CLM-C ດຶງມາກຳນົດການເຄມ + ໃສ່ email */
export async function jobDelivery(code: string): Promise<JobDelivery | null> {
  const r = (
    await query<JobDelivery>(
      `select a.code, a.name_1 product, a.p_brand brand, a.p_model model, a.sn,
          nullif(trim(coalesce(a.issue,'')),'') fault, c.name_1 customer,
          to_char(a.return_complete,'DD-MM-YYYY') returned_at
        from tb_product a left join ar_customer c on c.code = a.cust_code where a.code = $1 limit 1`,
      [code],
    )
  ).rows[0];
  return r ?? null;
}

/** ລາຍการอะไหล่ที่ใช้ซ่อม (tb_used_spare) ຂອງ job — ໃຫ້ CLM-C ດຶງມາเป็น items */
export type JobSpare = { item_code: string | null; item_name: string | null; qty: number; unit: string | null };
export async function jobSpares(code: string): Promise<JobSpare[]> {
  const rows = (await query<{ item_code: string | null; item_name: string | null; qty: string; unit: string | null }>(
    `select item_code, item_name, coalesce(qty,0)::float8 qty, unit_code unit from tb_used_spare where product_code = $1 order by roworder`,
    [code],
  )).rows;
  return rows.map((r) => ({ ...r, qty: Number(r.qty) }));
}

/** ໝາຍໄວ້ວ່າ "ເຄມເງິນ supplier" ບໍ (ods_claim_mark) */
export async function isJobClaimMarked(jobCode: string): Promise<boolean> {
  return ((await query(`select 1 from ods_claim_mark where job_code = $1`, [jobCode])).rowCount ?? 0) > 0;
}

/**
 * candidate CLM-C = งานส่งคืนแล้ว + ยังไม่มี CLM-C + (ຫຍີ່ຫໍ້ຢູ່ໃນ config ods_claim_brand
 * **ຫຼື** ໝາຍເອງ ods_claim_mark). supplier ດຶງจาก brand config (prefill ตอนเปิดใบ).
 */
export async function claimCandidatesC(): Promise<ClaimCandidate[]> {
  return (
    await query<ClaimCandidate>(
      `select a.code, a.name_1 product, a.p_brand brand, c.name_1 customer,
          to_char(a.return_complete,'DD-MM-YYYY') returned_at, bc.supplier_code supplier
        from tb_product a
        left join ar_customer c on c.code = a.cust_code
        left join ods_claim_brand bc on bc.brand_code = a.p_brand and bc.active
       where a.return_complete is not null
         and (bc.brand_code is not null or a.code in (select job_code from ods_claim_mark))
         and a.code not in (select ref_job from ods_claim where claim_type = 'C' and ref_job is not null)
       order by a.return_complete desc limit 200`,
    )
  ).rows;
}

/** ສະຫຼຸບເຄມປະຈຳວັນ (ສຳລັບ cron → email/Line OA). read-only aggregates. */
export async function claimDailySummary(): Promise<ClaimDailySummary> {
  const [open, money, cand] = await Promise.all([
    query<{ claim_type: string; n: number }>(`select claim_type, count(*)::int n from ods_claim where status not in ('closed','rejected') group by claim_type`),
    query<{ s: string | null }>(`select coalesce(sum(amount),0) s from ods_claim where claim_type='C' and status not in ('paid','closed','rejected')`),
    query<{ n: number }>(`select count(*)::int n from tb_product a join ods_claim_mark m on m.job_code=a.code
       where a.return_complete is not null and a.code not in (select ref_job from ods_claim where claim_type='C' and ref_job is not null)`),
  ]);
  const byType = Object.fromEntries(open.rows.map((r) => [r.claim_type, r.n]));
  return {
    openA: byType.A ?? 0, openB: byType.B ?? 0, openC: byType.C ?? 0,
    pendingMoney: Number(money.rows[0]?.s ?? 0),
    candidates: cand.rows[0]?.n ?? 0,
  };
}

/** ໂຕເລກຕໍ່ status (badge ໃນ pipeline) ຂອງ type ໜຶ່ງ */
export async function claimCounts(type: ClaimType): Promise<Record<string, number>> {
  const rows = (await query<{ status: string; n: number }>(
    `select status, count(*)::int n from ods_claim where claim_type = $1 group by status`,
    [type],
  )).rows;
  return Object.fromEntries(rows.map((r) => [r.status, r.n]));
}
