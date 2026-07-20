import { query } from "@/lib/db";

/**
 * ລະບົບເຄມ (Claim) — Phase 1.
 *   A = ເຄມອາໄຫຼ່ກັບ supplier (ສູນຊື້ມາເສຍ)
 *   B = ຮ້ານຄ້າສົ່ງມາເຄມ — **ຈົບຢູ່ສູນ** (ບໍ່ຮອດ supplier)
 *   C = ເກັບເງິນຄ່າສ້ອມ ນຳ supplier/ຫຍີ່ຫໍ້ ແທນລູກຄ້າ (ຜູກ ERP — phase ຕໍ່)
 * ຕາຕະລາງ ods_claim / ods_claim_item / ods_claim_log (main DB). supplier←ap_supplier, brand←ic_brand (ERP).
 */
export type ClaimType = "A" | "B" | "C";

export const CLAIM_TYPE_LABEL: Record<ClaimType, string> = {
  A: "ເຄມອາໄຫຼ່ກັບ supplier",
  B: "ຮ້ານສົ່ງມາເຄມ (ຈົບຢູ່ສູນ)",
  C: "ເກັບເງິນຄ່າສ້ອມ ນຳ supplier",
};

/** pipeline ຕໍ່ type — ລຳດັບ status + ป้าย. status ສຸດທ້າຍ = closed (ປິດ) */
export const CLAIM_FLOW: Record<ClaimType, { status: string; label: string }[]> = {
  A: [
    { status: "draft", label: "ຮ່າງ" },
    { status: "sent", label: "ສົ່ງ supplier" },
    { status: "review", label: "supplier ກວດ" },
    { status: "approved", label: "ອະນຸມັດ" },
    { status: "received", label: "ຮັບຂອງໃໝ່ / ເครดิต" },
    { status: "closed", label: "ປິດ" },
  ],
  B: [
    { status: "received", label: "ຮັບຈາກຮ້ານ" },
    { status: "checking", label: "ກວດ / ຕັດສິນ" },
    { status: "done", label: "ປ່ຽນ / ສ້ອມ" },
    { status: "returned", label: "ຄືນຮ້ານ" },
    { status: "closed", label: "ປິດ" },
  ],
  C: [
    { status: "pending", label: "ລໍເຄມ" },
    { status: "submitted", label: "ຍື່ນເບີກ" },
    { status: "approved", label: "supplier ອະນຸມັດ" },
    { status: "paid", label: "ຮັບເງິນ" },
    { status: "closed", label: "ປິດ" },
  ],
};
/** ສະຖານະ "ຍົກເລີກ/ปฏิเสธ" ນອກ flow — ໃຫ້ A ໃຊ້ໄດ້ */
export const CLAIM_REJECTED = { status: "rejected", label: "ปฏิเสธ" };

export const claimStatusLabel = (type: ClaimType, status: string): string => {
  if (status === CLAIM_REJECTED.status) return CLAIM_REJECTED.label;
  return CLAIM_FLOW[type]?.find((s) => s.status === status)?.label ?? status;
};

/** status ຖັດໄປ (linear) — null ຖ້າຢູ່ closed/rejected ແລ້ວ */
export const claimNextStatus = (type: ClaimType, status: string): { status: string; label: string } | null => {
  const flow = CLAIM_FLOW[type] ?? [];
  const i = flow.findIndex((s) => s.status === status);
  if (i < 0 || i >= flow.length - 1) return null;
  return flow[i + 1];
};

export const isClaimOpen = (status: string) => status !== "closed" && status !== "rejected";

export type ClaimRow = {
  id: number;
  claim_no: string;
  claim_type: ClaimType;
  supplier_code: string | null;
  brand_code: string | null;
  customer_code: string | null;
  customer_name: string | null;
  ref_job: string | null;
  status: string;
  status_label: string;
  amount: number;
  reason: string | null;
  created_by: string | null;
  created_at: string | null;
  remark: string | null;
};

type RawClaim = Omit<ClaimRow, "status_label" | "amount"> & { amount: string | null };

const mapRow = (r: RawClaim): ClaimRow => ({
  ...r,
  amount: Number(r.amount ?? 0),
  status_label: claimStatusLabel(r.claim_type, r.status),
});

const SELECT = `select c.id, c.claim_no, c.claim_type, c.supplier_code, c.brand_code, c.customer_code,
    cust.name_1 customer_name, c.ref_job, c.status, c.amount, c.reason, c.created_by,
    to_char(c.created_at,'DD-MM-YYYY HH24:MI') created_at, c.remark
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

export type ClaimItem = { id: number; item_code: string | null; item_name: string | null; qty: number; unit: string | null; amount: number; note: string | null };
export async function claimItems(claimNo: string): Promise<ClaimItem[]> {
  const rows = (await query<Omit<ClaimItem, "qty" | "amount"> & { qty: string; amount: string }>(
    `select id, item_code, item_name, qty, unit, amount, note from ods_claim_item where claim_no = $1 order by id`,
    [claimNo],
  )).rows;
  return rows.map((r) => ({ ...r, qty: Number(r.qty), amount: Number(r.amount) }));
}

export type ClaimLog = { at: string | null; by_user: string | null; event: string | null; detail: string | null };
export async function claimLogs(claimNo: string): Promise<ClaimLog[]> {
  return (await query<ClaimLog>(
    `select to_char(at,'DD-MM-YYYY HH24:MI') at, by_user, event, detail from ods_claim_log where claim_no = $1 order by id desc`,
    [claimNo],
  )).rows;
}

/** ໂຕເລກຕໍ່ status (badge ໃນ pipeline) ຂອງ type ໜຶ່ງ */
export async function claimCounts(type: ClaimType): Promise<Record<string, number>> {
  const rows = (await query<{ status: string; n: number }>(
    `select status, count(*)::int n from ods_claim where claim_type = $1 group by status`,
    [type],
  )).rows;
  return Object.fromEntries(rows.map((r) => [r.status, r.n]));
}
