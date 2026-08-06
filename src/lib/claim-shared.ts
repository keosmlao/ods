/**
 * ເຄມ — **ຄ່າຄົງ + types + pure functions ບໍ່ແຕະ DB** ⇒ client component import ໄດ້.
 * (lib/claim.ts re-export ໝົດ + ເພີ່ມ query functions ຝັ່ງ server.)
 */
export type ClaimType = "A" | "B" | "C";

export const CLAIM_TYPE_LABEL: Record<ClaimType, string> = {
  A: "ເຄມອາໄຫຼ່ກັບ supplier",
  B: "ຮ້ານສົ່ງມາເຄມ (ຈົບຢູ່ສູນ)",
  C: "ເກັບເງິນຄ່າສ້ອມ ນຳ supplier",
};

/**
 * 3 ໜ້າຂອງລະບົບເຄມ (menu ແຍກ) — B ເປັນ "ໃບແມ່" (ຮ້ານ→ສູນ), A/C ເປັນໃບລູກ (ສູນ→supplier).
 * ໃບທີ່ກ່ຽວກັນ ຜູກຜ່ານ `ref_job` (ເລກງານສ້ອມ) ຮ່ວມກັນ — ບໍ່ຕ້ອງ column link ໃໝ່.
 * ລຳດັບ = ຂັ້ນຕອນມາດຕະຖານ: ① ຮັບຈາກຮ້ານ → ② ຂໍອາໄຫຼ່ supplier → ③ ເກັບຄ່າສ້ອມ.
 */
export const CLAIM_PAGES: { type: ClaimType; path: string; short: string }[] = [
  { type: "B", path: "/claims/shop", short: "ຮັບເຄມຈາກຮ້ານ" },
  { type: "A", path: "/claims/supplier", short: "ເຄມອາໄຫຼ່ supplier" },
  { type: "C", path: "/claims/reimburse", short: "ເກັບຄ່າສ້ອມ supplier" },
];
export const claimPagePath = (type: ClaimType) => CLAIM_PAGES.find((p) => p.type === type)?.path ?? "/claims/shop";

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
    { status: "notify", label: "ລໍຖ້າສົ່ງແຈ້ງ" },
    { status: "notified", label: "ແຈ້ງແລ້ວ ລໍຖ້າຊຳລະ" },
    { status: "paid", label: "ຊຳລະແລ້ວ" },
  ],
};

/** ວິທີຊຳລະຂອງ supplier (CLM-C) */
export const PAY_METHOD_LABEL: Record<string, string> = {
  cash: "ເງິນສົດ",
  transfer: "ໂອນ",
  replace: "ສົ່ງສິນຄ້າມາແທນ (ERP)",
  discount: "ສ່ວນຫຼຸດການຊື້ (ERP)",
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

/** ກົດ transition ກາງ — server ແລະ UI ໃຊ້ກົດດຽວກັນ. */
export const claimCanTransition = (type: ClaimType, from: string, to: string): boolean => {
  if (type === "A" && to === CLAIM_REJECTED.status) return from === "sent" || from === "review";
  // CLM-B checking → done ຕ້ອງຜ່ານ resolveClaim ເພື່ອບັນທຶກ replace/repair.
  if (type === "B" && from === "checking" && to === "done") return false;
  // CLM-B received → checking ຕ້ອງຜ່ານ saveCheck (ຊ່າງ QC) ເທົ່ານັ້ນ — ຂ້າມ = time_finish_check
  // ຍັງ NULL ⇒ resolveClaim ຂຽນ tb_product ບໍ່ໄດ້ ⇒ job ຄ້າງ stage "ລໍຕັດສິນ" ຖາວອນ.
  if (type === "B" && from === "received" && to === "checking") return false;
  // CLM-C → paid ຕ້ອງຜ່ານ setClaimPaid (ຕ້ອງມີວິທີຊຳລະ) — ບໍ່ໃຫ້ advance ກົງ ໃຫ້ pay_method NULL.
  if (type === "C" && to === "paid") return false;
  return claimNextStatus(type, from)?.status === to;
};

/**
 * ── ໝາຍ "ຂໍເຄມ" ໃສ່ໃບງານສ້ອມ (ຕອນເປີດ ຫຼື ຕອນແກ້ໄຂ) ──
 * ຜົນທີ່ຕ້ອງເກີດຈາກການປ່ຽນ job_kind — ຄິດບ່ອນດຽວ ໃຊ້ທັງ createService ແລະ updateService.
 *
 *   none         ບໍ່ແມ່ນງານເຄມ ⇒ ບໍ່ຕ້ອງເຮັດຫຍັງກັບໃບເຄມ
 *   create-claim ສ້ອມ → ເຄມ ແລະ ຍັງບໍ່ມີໃບເຄມ ⇒ ສ້າງ CLM-B
 *   sync-claim   ເປັນເຄມຢູ່ແລ້ວ ແລະ ມີໃບເຄມ ⇒ ອັບເດດຂອບເຂດ/ແຖວອາໄຫຼ່ ບໍ່ສ້າງໃບຊ້ຳ
 *   blocked      ເຄມ → ສ້ອມ ທັງທີ່ມີໃບເຄມແລ້ວ ⇒ ຫ້າມ (ຈັດການທີ່ໃບເຄມ)
 */
export type ClaimMarkChange = "none" | "create-claim" | "sync-claim" | "blocked";

export function claimMarkChange(
  before: { kind: string; claimNo: string | null },
  nextKind: string,
): ClaimMarkChange {
  if (nextKind !== "claim") {
    return before.kind === "claim" && before.claimNo ? "blocked" : "none";
  }
  return before.claimNo ? "sync-claim" : "create-claim";
}

export const isClaimEditable = (type: ClaimType, status: string): boolean =>
  status === ({ A: "draft", B: "received", C: "notify" } satisfies Record<ClaimType, string>)[type];

export const isClaimOpen = (status: string) => status !== "closed" && status !== "rejected" && status !== "paid";

export type ClaimRow = {
  id: number;
  claim_no: string;
  claim_type: ClaimType;
  supplier_code: string | null;
  brand_code: string | null;
  customer_code: string | null;
  customer_name: string | null;
  ref_job: string | null;
  erp_doc_no: string | null;
  status: string;
  status_label: string;
  amount: number;
  reason: string | null;
  created_by: string | null;
  created_at: string | null;
  email_sent_at: string | null;
  pay_method: string | null;
  remark: string | null;
  // ── ຂໍ້ມູນສິນຄ້າ/ຮັບປະກັນ (redesign — ໃສ່ຕົງ ຫຼື ດຶງຈາກເລກສ້ອມ) ──
  product: string | null;
  model: string | null;
  sn: string | null;
  /** ໃນ/ນອກ ປະກັນ — "in" | "out" | null */
  warranty: string | null;
  purchase_date: string | null;
  contact: string | null;
  /** ເລກບິນຂາຍ ERP (ic_trans trans_flag 44) — ອ້າງອີງການຊື້ຂອງລູກຄ້າ */
  bill_no: string | null;
  /** ຜົນຕັດສິນ CLM-B — replace(ປ່ຽນ) | repair(ສ້ອມ) | null */
  resolution: string | null;
  fulfillment_source: string | null;
  claim_scope: string | null;
};

/** ຜົນຕັດສິນ CLM-B — ເລືອກຕອນ "ກວດ/ຕັດສິນ" */
export const RESOLUTION_LABEL: Record<string, string> = { replace: "ປ່ຽນ", repair: "ສ້ອມ" };
export const FULFILLMENT_LABEL: Record<string, string> = {
  stock: "ປ່ຽນຈາກ stock ຂອງສູນ",
  purchase: "ສັ່ງຊື້ມາປ່ຽນ",
  supplier: "ເຄມຕໍ່ກັບ supplier",
};
export const CLAIM_SCOPE_LABEL: Record<string, string> = {
  whole: "ເຄມທັງເຄື່ອງ",
  part: "ເຄມສະເພາະອາໄຫຼ່",
};
export const isClaimFulfillmentSource = (value: string | undefined): value is "stock" | "purchase" | "supplier" =>
  value === "stock" || value === "purchase" || value === "supplier";

export type ClaimPhoto = { id: number; path: string; created_at: string | null };
export const WARRANTY_LABEL: Record<string, string> = { in: "ໃນປະກັນ", out: "ນອກປະກັນ" };

/** ບິນຂາຍ ERP (ic_trans 44) · ລາຍการສินค้า · ລາຍการ inventory master */
export type ClaimBill = { doc_no: string; doc_date: string; iso_date: string; cust_code: string; cust_name: string | null; total: number };
export type BillItem = { item_code: string; item_name: string; qty: number; unit: string | null; brand?: string | null };
export type InvItem = { code: string; name: string; unit: string | null; brand?: string | null };

/** ໄລຍະຮັບປະກັນ ມາດຕะฐาน (ເດືອນ) — ปรับได้ */
export const WARRANTY_MONTHS = 12;

/**
 * ກວດປະກັນ **ຈາກວັນອອກບິນ** (iso YYYY-MM-DD) — ໃນປະກັນ ຖ້າຍັງບໍ່ເກີນ WARRANTY_MONTHS.
 * pure ⇒ client ໃຊ້ໄດ້. null ຖ້າວັນທີບໍ່ຖືກ.
 */
export function warrantyFromBillDate(iso: string): { status: "in" | "out"; days: number; label: string } | null {
  if (!iso) return null;
  const bill = new Date(iso);
  if (Number.isNaN(bill.getTime())) return null;
  const expiry = new Date(bill);
  expiry.setMonth(expiry.getMonth() + WARRANTY_MONTHS);
  const days = Math.max(0, Math.floor((Date.now() - bill.getTime()) / 86400000));
  const inW = new Date() <= expiry;
  return { status: inW ? "in" : "out", days, label: `${inW ? "ໃນປະກັນ" : "ນອກປະກັນ"} · ຊື້ມາ ${days} ວັນ` };
}

/** ຂໍ້ມູນ job (ເລກສ້ອມ/ສິນຄ້າ/SN/Model/ອາການ) — CLM-C ດຶງມາກຳນົດການເຄມ + email */
export type JobDelivery = {
  code: string;
  product: string | null;
  brand: string | null;
  model: string | null;
  sn: string | null;
  fault: string | null;
  customer: string | null;
  returned_at: string | null;
};

export type ClaimItem = { id: number; item_code: string | null; item_name: string | null; qty: number; unit: string | null; amount: number; note: string | null };
export type ClaimLog = { at: string | null; by_user: string | null; event: string | null; detail: string | null };
export type CobInfo = { doc_no: string; doc_date: string | null; supplier_code: string | null; total_amount: number; status: number };
export type ClaimCandidate = { code: string; product: string | null; brand: string | null; customer: string | null; returned_at: string | null; supplier: string | null };
/** งานสอมที่ "สำเร็จ · ส่งคืนลูกค้าแล้ว · ยังไม่มีใบเคลม" — ใช้ modal เลือกตอนเปิดใบเคลม */
export type ClaimJobCandidate = { code: string; product: string | null; brand: string | null; model: string | null; sn: string | null; fault: string | null; customer: string | null; returned_at: string | null };
export type ClaimDailySummary = { openA: number; openB: number; openC: number; pendingMoney: number; candidates: number };

/** ຂໍ້ຄວາມສະຫຼຸບ (ໃຫ້ email/Line) — pure */
export function claimDailyText(s: ClaimDailySummary, date: string): string {
  return [
    `📋 ສະຫຼຸບເຄມ ${date}`,
    `• CLM-A (supplier) ເປີດຢູ່: ${s.openA}`,
    `• CLM-B (ຮ້ານ) ເປີດຢູ່: ${s.openB}`,
    `• CLM-C (ເກັບເງิน) ເປີດຢູ່: ${s.openC}`,
    `• ເງินรอรับจาก supplier: ${s.pendingMoney.toLocaleString()}`,
    `• ງານรอเปิด CLM-C (ໝາຍ+ສ่งคืน): ${s.candidates}`,
  ].join("\n");
}

/* ─────────────────────────── ຄຳແປຂອງປ້າຍເຄມ (i18n) ─────────────────────────── */

/**
 * ປ້າຍ ປະເພດ/ສະຖານະ/ຂອບເຂດ ຂອງເຄມ **ເປັນຄຳແປ**.
 *
 * ⚠️ ຄ່າຄົງ `CLAIM_TYPE_LABEL` · `CLAIM_FLOW[].label` · `CLAIM_SCOPE_LABEL` …
 * ຍັງຢູ່ຄືເກົ່າ ເພາະ **email · ລາຍງານ · export** ຝັ່ງ server ໃຊ້ຢູ່ (ບໍ່ມີ locale ໃຫ້ອ່ານ).
 * ໜ້າຈໍໃຫ້ໃຊ້ຕົວນີ້ແທນ ⇒ ຄຳດຽວກັນຢູ່ 3 ພາສາ ໂດຍບໍ່ຕ້ອງແກ້ຄ່າຄົງທີ່ທີ່ໃຊ້ຮ່ວມ.
 *
 * key ຂອງສະຖານະຕ້ອງເປັນ **type_status** ເພາະ status ຊື່ຊ້ຳກັນຂ້າມ type ແຕ່ຄວາມໝາຍຕ່າງ
 * (A.received = ຮັບຂອງໃໝ່/ເຄຣດິດ · B.received = ຮັບຈາກຮ້ານ).
 */
export type ClaimLabelDict = Record<string, string>;

export const claimTypeText = (t: ClaimLabelDict, type: ClaimType) =>
  t[`type${type}`] ?? CLAIM_TYPE_LABEL[type];

export const claimStatusText = (t: ClaimLabelDict, type: ClaimType, status: string) =>
  status === CLAIM_REJECTED.status
    ? (t.rejected ?? CLAIM_REJECTED.label)
    : (t[`${type}_${status}`] ?? claimStatusLabel(type, status));

export const claimScopeText = (t: ClaimLabelDict, scope: string) =>
  ({ whole: t.scopeWhole, part: t.scopePart })[scope] ?? CLAIM_SCOPE_LABEL[scope] ?? scope;

export const claimFulfillText = (t: ClaimLabelDict, source: string) =>
  ({ stock: t.fulfillStock, purchase: t.fulfillPurchase, supplier: t.fulfillSupplier })[source]
  ?? FULFILLMENT_LABEL[source] ?? source;
