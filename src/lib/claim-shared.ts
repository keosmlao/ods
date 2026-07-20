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
  erp_doc_no: string | null;
  status: string;
  status_label: string;
  amount: number;
  reason: string | null;
  created_by: string | null;
  created_at: string | null;
  email_sent_at: string | null;
  remark: string | null;
};

/** ຂໍ້ມູນ "ເອກະສານສົ່ງເຄື່ອງ" (delivery) ຂອງ job — ໃຊ້ກຳນົດການເຄມ + email */
export type JobDelivery = { code: string; product: string | null; brand: string | null; customer: string | null; returned_at: string | null };

export type ClaimItem = { id: number; item_code: string | null; item_name: string | null; qty: number; unit: string | null; amount: number; note: string | null };
export type ClaimLog = { at: string | null; by_user: string | null; event: string | null; detail: string | null };
export type CobInfo = { doc_no: string; doc_date: string | null; supplier_code: string | null; total_amount: number; status: number };
export type ClaimCandidate = { code: string; product: string | null; brand: string | null; customer: string | null; returned_at: string | null; supplier: string | null };
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
