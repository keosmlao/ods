import { CancelCheckButton, StartCheckButton, UndoStartCheckButton } from "@/components/checking/check-actions";
import { CancelRequestButton } from "@/app/(app)/stock/requests/cancel-request-button";
import { Elapsed } from "@/components/elapsed";
import { AssignTechButton } from "@/components/installation/assign-tech";
import { LinkPending } from "@/components/link-pending";
import { RowLink } from "@/components/row-link";
import { AcceptRepairButton } from "@/components/repair/accept-repair-button";
import { StartRepairButton, UndoFinishRepairButton, UndoStartRepairButton } from "@/components/repair/repair-actions";
import { UndoRepairAssignmentButton } from "@/components/repair/undo-assignment-button";
import { UndoQcButton } from "@/components/qc/undo-qc-button";
import { UndoCustomerButton } from "@/components/quotation/approve-actions";
import { QuoteRowActions } from "@/components/quotation/quote-row-actions";
import { SortHeader, type SortDir } from "@/components/sort-header";
import { getSession } from "@/lib/auth";
import { installStatuses, repairStatuses } from "@/lib/dashboard-status";
import { query } from "@/lib/db";
import { elapsedTone } from "@/lib/elapsed-tone";
import {
  REPAIR_STAGE_OVERDUE_SQL,
  REPAIR_STAGE_POLICY,
  repairSlaState,
  repairSlaTone,
  repairStageTargetHours,
} from "@/lib/repair-sla";
import { STAGE_ELAPSED_SQL, STAGE_TIME_COL } from "@/lib/stage";
import { heldSql, holdJsonSql, notHeldSql, type JobHold } from "@/lib/job-hold";
import { HoldButtons } from "@/components/repair/hold-buttons";
import { PurchaseState } from "@/components/stock/purchase-state";
import { ReleaseGhostButton } from "@/components/stock/release-ghost-button";
import { purchaseTracking, syncErpPurchase, type PurchaseTrack } from "@/lib/erp-purchase";
import { APPROVER_SIDE, canAccess, roleOf } from "@/lib/roles";
import { SETTING, settingEnabled } from "@/lib/settings";
import { SERVICE_TYPE_LABEL } from "@/lib/sla";
import { listTechnicians } from "@/lib/technicians";
import { ArrowLeft, ArrowRight, Barcode, ChevronLeft, ChevronRight, CircleAlert, Download, House, PackageOpen, Search, Truck, Warehouse } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

/**
 * ລາຍລະອຽດຂອງແຕ່ລະຂັ້ນ (ກົດມາຈາກໜ້າລວມ).
 *
 * ຕ່າງຈາກເກົ່າ: ເກົ່າດຶງ 1,000 ແຖວມາທັງໝົດ ແລ້ວໃຫ້ browser ກອງ/ແບ່ງໜ້າ
 * → ດຽວນີ້ ຄົ້ນຫາ · ຈັດຮຽງ · ແບ່ງໜ້າ ຢູ່ຝັ່ງ server (20 ແຖວ/ໜ້າ) ຈຶ່ງບໍ່ມີເພດານ 1,000 ອີກ.
 */
const PAGE_SIZE = 20;

type Props = {
  params: Promise<{ workflow: string; status: string }>;
  searchParams: Promise<{ q?: string; page?: string; sort?: string; dir?: string; service?: string; hold?: string }>;
};

type RepairRow = {
  code: string; roworder: number; customer: string | null; phone: string | null; product: string | null; sn: string | null;
  model: string | null; brand: string | null; warranty: string | null; service_type: string | null;
  issue: string | null; accessory: string | null; reference: string | null; receiver: string | null;
  technician: string | null; registered: string | null; elapsed_seconds: number | null;
  stage_started: string | null;
  location_inst: string | null; appoint_date: string | null; remark: string | null;
  /** ຍົກເລີກ = ທຸງ (status=6) — ງານແບບນີ້ຢູ່ຄິວ "ລໍຖ້າສົ່ງຄືນ" ຄືກັນ (ເຄື່ອງຍັງຕ້ອງຄືນລູກຄ້າ) */
  cancelled: boolean;
  quote_doc: string | null; quote_apr: number | null; quote_customer_status: number | null; request_doc: string | null;
  repair_confirm: string | null;
  /** ທຸງ "ມີບັນຫາ" ທີ່ເປີດຢູ່ — null = ປົກກະຕິ (ເບິ່ງ src/lib/job-hold.ts) */
  hold: JobHold | null;
};

type InstallRow = {
  code: string; customer: string | null; product: string | null; brand: string | null; model: string | null;
  product_type: string | null; product_size: string | null; appointment: string | null; sale_bill: string | null;
  technician: string | null; creator: string | null; registered: string | null; elapsed_seconds: number | null;
};

const REPAIR_SEARCH = `(a.code ilike $Q or a.sn ilike $Q or a.name_1 ilike $Q or a.p_brand ilike $Q
  or a.p_model ilike $Q or a.issue ilike $Q or a.emp_code ilike $Q or c.name_1 ilike $Q or c.tel ilike $Q)`;
const INSTALL_SEARCH = `(a.code ilike $Q or a.item_name ilike $Q or a.pro_brand ilike $Q or a.pro_model ilike $Q
  or a.pro_sn ilike $Q or a.doc_ref_1 ilike $Q or a.tech_code ilike $Q or c.name_1 ilike $Q or c.tel ilike $Q)`;

/** ຖັນທີ່ຈັດຮຽງໄດ້ — whitelist ກັນ SQL injection */
const REPAIR_SORT: Record<string, string> = {
  code: "a.code", elapsed: STAGE_TIME_COL, customer: "c.name_1", product: "a.name_1",
  brand: "a.p_brand", warranty: "a.warrunty", service: "a.service_type", technician: "a.emp_code", receiver: "a.user_regis",
};
const INSTALL_SORT: Record<string, string> = {
  code: "a.code", elapsed: "a.time_register", customer: "c.name_1", product: "a.item_name",
  brand: "a.pro_brand", appointment: "a.appoint_date", technician: "a.tech_code", creator: "a.user_created",
};

const REPAIR_COLUMNS: { key: string; label: string; defaultDir: SortDir }[] = [
  { key: "code", label: "ເລກທີ", defaultDir: "desc" },
  { key: "elapsed", label: "ຄ້າງມາ", defaultDir: "desc" },
  { key: "product", label: "ສິນຄ້າ / SN", defaultDir: "asc" },
  { key: "brand", label: "ຍີ່ຫໍ້", defaultDir: "asc" },
  { key: "customer", label: "ລູກຄ້າ", defaultDir: "asc" },
  { key: "warranty", label: "ປະກັນ", defaultDir: "asc" },
  { key: "service", label: "ປະເພດບໍລິການ", defaultDir: "asc" },
  { key: "technician", label: "ຊ່າງ", defaultDir: "asc" },
  { key: "receiver", label: "ຜູ້ຮັບ", defaultDir: "asc" },
];

const INSTALL_COLUMNS: { key: string; label: string; defaultDir: SortDir }[] = [
  { key: "code", label: "ເລກທີ", defaultDir: "desc" },
  { key: "elapsed", label: "ຄ້າງມາ", defaultDir: "desc" },
  { key: "product", label: "ລາຍການ", defaultDir: "asc" },
  { key: "brand", label: "ຍີ່ຫໍ້", defaultDir: "asc" },
  { key: "customer", label: "ລູກຄ້າ", defaultDir: "asc" },
  { key: "appointment", label: "ວັນນັດ", defaultDir: "asc" },
  { key: "technician", label: "ຊ່າງ", defaultDir: "asc" },
  { key: "creator", label: "ຜູ້ສ້າງ", defaultDir: "asc" },
];

const SERVICE_TYPES = [
  { code: "CI", label: SERVICE_TYPE_LABEL.CI, icon: PackageOpen, tone: "sky" },
  { code: "ST", label: SERVICE_TYPE_LABEL.ST, icon: Warehouse, tone: "violet" },
  { code: "IH", label: SERVICE_TYPE_LABEL.IH, icon: House, tone: "emerald" },
  { code: "PS", label: SERVICE_TYPE_LABEL.PS, icon: Truck, tone: "amber" },
] as const;

const SERVICE_TONE = {
  sky: { active: "border-sky-500 bg-sky-50 text-sky-800 ring-sky-100", icon: "bg-sky-100 text-sky-700", badge: "bg-sky-50 text-sky-700" },
  violet: { active: "border-violet-500 bg-violet-50 text-violet-800 ring-violet-100", icon: "bg-violet-100 text-violet-700", badge: "bg-violet-50 text-violet-700" },
  emerald: { active: "border-emerald-500 bg-emerald-50 text-emerald-800 ring-emerald-100", icon: "bg-emerald-100 text-emerald-700", badge: "bg-emerald-50 text-emerald-700" },
  amber: { active: "border-amber-500 bg-amber-50 text-amber-800 ring-amber-100", icon: "bg-amber-100 text-amber-700", badge: "bg-amber-50 text-amber-700" },
} as const;

/**
 * ປຸ່ມລົງມື **ຕໍ່ຂັ້ນ** ຂອງສາຍງານສ້ອມ — ພາໄປໜ້າທີ່ເຮັດວຽກຂັ້ນນັ້ນຂອງໃບນັ້ນໂດຍກົງ.
 * `base` = ເສັ້ນທາງໃຊ້ກວດສິດ: role ໃດເຂົ້າໜ້ານັ້ນບໍ່ໄດ້ ⇒ ບໍ່ສະແດງປຸ່ມ (ກັນ 403).
 * ຂັ້ນ wait-check (ຮັບງານ/ເລີ່ມກວດ) ແລະ wait-repair (ເລີ່ມສ້ອມ) ໃຊ້ inline ບໍ່ຢູ່ໃນນີ້.
 */
type ActionRow = { code: string; roworder: number };
const REPAIR_STAGE_ACTION: Record<string, { label: string; base: string; href: (row: ActionRow) => string }> = {
  // wait-check ໃຊ້ inline "ເລີ່ມກວດເຊັກ"; quoting ຈັດການແຍກ (ຂຶ້ນກັບຂັ້ນອະນຸມັດ) — ບໍ່ຢູ່ໃນນີ້
  checking: { label: "ສຳເລັດການກວດເຊັກ", base: "/checking", href: (r) => `/checking/${encodeURIComponent(r.code)}` },
  "wait-quote": { label: "ສະເໜີລາຄາ", base: "/quotations", href: (r) => `/quotations/new/${encodeURIComponent(r.code)}` },
  // ຂໍເບີກ / ຈັດການອາໄຫຼ່ — ໄປໜ້າສາງໂດຍກົງ; /repair/<code> ຖືກລົບແລ້ວ.
  "wait-withdraw": {
    label: "ກວດ Stock / ດຳເນີນອາໄຫຼ່",
    base: "/stock/requests",
    href: (r) => `/stock/requests/${r.roworder}`,
  },
  /**
   * ໜ້າລາຍການ /stock/requests ຖືກລົບ (17-07-2026) ⇒ ພາໄປໜ້າ**ເບີກອາໄຫຼ່ຂອງສາງ**
   * ກອງດ້ວຍລະຫັດວຽກ — ນັ້ນຄືບ່ອນທີ່ "ຈັດການອາໄຫຼ່" ຂອງຂັ້ນນີ້ເກີດຂຶ້ນຈິງ.
   * (ປຸ່ມຍົກເລີກໃບຂໍເບີກຢູ່ໃນແຖວນີ້ຢູ່ແລ້ວ — CancelRequestButton)
   */
  withdrawing: {
    label: "ໄປໜ້າເບີກອາໄຫຼ່",
    base: "/stock/dispatch",
    href: (r) => `/stock/dispatch?q=${encodeURIComponent(r.code)}`,
  },
  purchasing: {
    label: "ຈັດການ / ຍົກເລີກການສັ່ງຊື້",
    base: "/purchase-requests",
    href: (r) => `/purchase-requests?q=${encodeURIComponent(r.code)}`,
  },
  repairing: {
    label: "ໄປລາຍການສ້ອມ",
    base: "/repair",
    href: (r) => `/repair?tab=progress&q=${encodeURIComponent(r.code)}`,
  },
  "wait-qc": { label: "ກວດ QC", base: "/qc", href: (r) => `/qc/repair/${encodeURIComponent(r.code)}` },
  "wait-return": { label: "ສົ່ງຄືນ", base: "/returns", href: (r) => `/returns/${encodeURIComponent(r.code)}` },
};

export default async function StatusPage({ params, searchParams }: Props) {
  const { workflow, status } = await params;
  if (workflow === "repair" && status === "wait-accept") {
    redirect("/dashboard/status/repair/wait-check");
  }
  const isRepair = workflow === "repair";
  const config = isRepair ? repairStatuses[status] : workflow === "install" ? installStatuses[status] : null;
  /**
   * ຄິວ "ລໍຖ້າສົ່ງຄືນ" ຮັບງານມາຈາກ **ສອງທາງ**: ສ້ອມສຳເລັດ (ຜ່ານ QC) ແລະ ຍົກເລີກ
   * (ເຄື່ອງຍັງຕ້ອງຄືນລູກຄ້າ + ອາດເກັບຄ່າກວດ) ⇒ ຄົນສົ່ງເຄື່ອງຕ້ອງຮູ້ວ່າແຖວນີ້ມາຈາກໃສ
   * ບໍ່ດັ່ງນັ້ນຈະສົ່ງເຄື່ອງທີ່ບໍ່ໄດ້ສ້ອມ ໂດຍນຶກວ່າສ້ອມແລ້ວ. ຄິວອື່ນບໍ່ຕ້ອງ (ມີທາງມາທາງດຽວ).
   */
  const showCase = isRepair && status === "wait-return";
  if (!config) notFound();
  const stagePolicy = isRepair && config.stage != null ? REPAIR_STAGE_POLICY.get(config.stage) : undefined;

  /**
   * ຂັ້ນ "ກຳລັງສັ່ງຊື້" — ດຶງຄວາມຈິງຈາກ ERP ກ່ອນນັບແຖວ: ວຽກທີ່ຮັບເຂົ້າສາງໄປແລ້ວ
   * ຈະຫຼຸດອອກຈາກຄິວນີ້ເອງ ⇒ ຈຳນວນທີ່ເຫັນເປັນວຽກທີ່ຄ້າງຈິງ (lib/erp-purchase).
   */
  if (isRepair && status === "purchasing") await syncErpPurchase();

  /** wait-check ລວມທັງວຽກທີ່ຍັງລໍຊ່າງຮັບ ແລະວຽກທີ່ຮັບແລ້ວລໍເລີ່ມກວດ. */
  // ສະແດງປຸ່ມສະເພາະ role ທີ່ເຂົ້າໜ້າລົງມືນັ້ນໄດ້ (ກັນກົດແລ້ວ 403)
  const role = roleOf(await getSession());
  /**
   * ໝາຍ/ປົດ ທຸງ "ມີບັນຫາ" — ສະເພາະຫົວໜ້າ/ຜູ້ມີສິດອະນຸມັດ ເພາະທຸງນີ້**ຢຸດນາລິກາ KPI**
   * ⇒ ຖ້າໃຜກໍ່ໝາຍໄດ້ ມັນຈະກາຍເປັນບ່ອນລີ້ຄວາມຊັກຊ້າ. server ກວດຊ້ຳຢູ່ດີ (job-hold.ts).
   */
  const holdOn = await settingEnabled(SETTING.JOB_HOLD);
  const canHold = isRepair && holdOn && APPROVER_SIDE.includes(role);
  // inline actions ຕໍ່ຂັ້ນ (ຕາມລະບົບເກົ່າ): ເລີ່ມກວດເຊັກ · ຮັບງານ · ປ່ຽນຊ່າງ · ເລີ່ມສ້ອມ
  const mergedCheckQueue = isRepair && status === "wait-check";
  const startCheck = mergedCheckQueue && canAccess(role, "/checking");
  const accept = mergedCheckQueue && canAccess(role, "/repair");
  const canReassign = mergedCheckQueue && canAccess(role, "/repair/assign");
  const startRepair = isRepair && status === "wait-repair" && canAccess(role, "/repair");
  // ຍົກເລີກ action ທີ່ເຮັດໃຫ້ເຂົ້າຂັ້ນນີ້ — ປຸ່ມຊັດເຈນຢູ່ໃນທຸກຄິວທີ່ຖອນຄືນໂດຍຕົງໄດ້.
  const cancelAssignment = mergedCheckQueue && canAccess(role, "/repair/assign");
  const cancelAccepted = mergedCheckQueue && canAccess(role, "/repair");
  const cancelStartCheck = isRepair && status === "checking" && canAccess(role, "/checking");
  const cancelFinishedCheck =
    isRepair && (status === "wait-quote" || status === "wait-repair") && canAccess(role, "/checking");
  const cancelStartRepair = isRepair && status === "repairing" && canAccess(role, "/repair");
  const cancelFinishedRepair = isRepair && status === "wait-qc" && canAccess(role, "/repair");
  const cancelQc = isRepair && status === "wait-return" && canAccess(role, "/qc");
  // ຂັ້ນສະເໜີລາຄາ: ຍັງບໍ່ອະນຸມັດ → ອະນຸມັດລາຄາ (ຜູ້ອະນຸມັດ) · ອະນຸມັດແລ້ວ → ຕັດສິນລາຄາ (ລູກຄ້າ/CS)
  const quotingStage =
    isRepair && status === "quoting" && (canAccess(role, "/quotations") || canAccess(role, "/approvals/quotations"));
  const stageAction = isRepair ? REPAIR_STAGE_ACTION[status] : undefined;
  const linkAction = stageAction && canAccess(role, stageAction.base) ? stageAction : undefined;
  const hasAction =
    startCheck || accept || canReassign || startRepair || quotingStage || Boolean(linkAction) || cancelAssignment ||
    cancelAccepted || cancelStartCheck || cancelFinishedCheck || cancelStartRepair || cancelFinishedRepair || cancelQc;

  const search = await searchParams;
  const q = (search.q ?? "").trim();
  const service = isRepair && SERVICE_TYPES.some((item) => item.code === search.service) ? search.service ?? "" : "";
  const page = Math.max(1, Number(search.page) || 1);
  const dir: SortDir = search.dir === "asc" ? "asc" : "desc";
  const sort = (search.sort ?? "elapsed").trim();

  const sortMap = isRepair ? REPAIR_SORT : INSTALL_SORT;
  const columns = isRepair ? REPAIR_COLUMNS : INSTALL_COLUMNS;

  // "ຄ້າງມາ" = ຄ້າງດົນສຸດກ່ອນ → ເວລາເກົ່າສຸດກ່ອນ ຈຶ່ງກັບທິດໃຫ້
  const column = sortMap[sort] ?? sortMap.elapsed;
  const isElapsed = column === sortMap.elapsed;
  const orderBy = isElapsed
    ? `${column} ${dir === "desc" ? "asc" : "desc"} nulls last`
    : `${column} ${dir} nulls last`;

  const where = [
    isRepair ? config.condition : `a.cancel_date is null and a.job_finish is null and ${config.condition}`,
  ];
  const args: (string | number)[] = [];
  if (q) {
    args.push(`%${q}%`);
    where.push((isRepair ? REPAIR_SEARCH : INSTALL_SEARCH).replaceAll("$Q", `$${args.length}`));
  }
  /**
   * ── ແທັບ "ມີບັນຫາ" (17-07-2026) ──
   * ວຽກທີ່ຖືກໝາຍ **ຍັງຢູ່ຂັ້ນນີ້** ພຽງແຕ່ຍ້າຍໄປອີກແທັບ ⇒ ລາຍການຫຼັກເຫຼືອແຕ່ວຽກ
   * ທີ່ເຮັດໄດ້ແທ້. ຢ່າເອົາອອກຈາກທັງສອງແທັບ — ນັ້ນຄືບັກ "ຫຼົບອອກຈາກຄິວ" ຂອງໃບຍົກເລີກ.
   * ຝັ່ງຕິດຕັ້ງຍັງບໍ່ໃຊ້ທຸງ ⇒ ບໍ່ກອງ (ທຸງມີໄວ້ໃຫ້ງານສ້ອມກ່ອນ).
   *
   * ໃສ່**ກ່ອນ** serviceCountFilter ເພື່ອໃຫ້ຕົວເລກເທິງຊິບປະເພດບໍລິການ ນັບສະເພາະ
   * ແທັບທີ່ເປີດຢູ່ — ບໍ່ດັ່ງນັ້ນຢູ່ແທັບ "ມີບັນຫາ" ຊິບຈະຍັງບອກຕົວເລກຂອງແທັບປົກກະຕິ.
   */
  const holdTab = isRepair && holdOn && search.hold === "1";
  /**
   * ເງື່ອນໄຂຂອງແທັບ — ປະກອບ**ຈາກຊິ້ນສ່ວນ** ບໍ່ແມ່ນ replace ຄຳໃນ string ທີ່ປະກອບແລ້ວ
   * (heldSql ເປັນ substring ຂອງ notHeldSql ⇒ replace ຈະຕັດຜິດບ່ອນຢ່າງງຽບໆ).
   *
   * ປິດສະວິດແລ້ວ (`holdOn` = false): **ບໍ່ກອງທຸງເລີຍ** ⇒ ວຽກທີ່ເຄີຍຖືກໝາຍກັບມາປົນ
   * ໃນລາຍການດຽວຄືປົກກະຕິ (ທຸງເກົ່າຍັງຢູ່ໃນຖານ ບໍ່ຖືກລຶບ — ເປີດຄືນແລ້ວໄດ້ຄືເກົ່າ).
   */
  const holdClause = (held: boolean) => (held ? heldSql("repair") : notHeldSql("repair"));
  const withHold = (parts: string[], held: boolean) =>
    (isRepair && holdOn ? [...parts, holdClause(held)] : parts).join(" and ");

  const serviceCountFilter = withHold(where, holdTab);
  const serviceCountArgs = [...args];
  if (service) {
    args.push(service);
    where.push(`a.service_type = $${args.length}`);
  }
  const filter = withHold(where, holdTab);
  /** ຕົວເລກຂອງອີກແທັບ — ເງື່ອນໄຂດຽວກັນທຸກຢ່າງ ພຽງແຕ່ພິກທຸງ (ໃຊ້ args ຊຸດດຽວກັນ) */
  const otherTabFilter = withHold(where, !holdTab);

  const from = isRepair
    ? "from tb_product a left join ar_customer c on c.code = a.cust_code"
    : "from ods_tb_install a left join ar_customer c on c.code = a.cust_code";

  const elapsed = isRepair
    ? `${STAGE_ELAPSED_SQL} elapsed_seconds`
    : "greatest(0, round(extract(epoch from (localtimestamp - a.time_register))))::int elapsed_seconds";

  const rowsSql = isRepair
    ? `select a.code, a.roworder, c.name_1 customer, c.tel phone, a.name_1 product, a.sn, a.p_model model, a.p_brand brand,
         a.warrunty warranty, a.service_type, a.issue, a.p_access accessory, a.doc_def reference,
         a.user_regis receiver, a.emp_code technician, a.repair_confirm,
         coalesce(nullif(a.location_repair,''), c.address) location_inst,
         to_char(a.appoint_date,'YYYY-MM-DD') appoint_date, nullif(a.remark,'') remark,
         (a.status = 6) cancelled,
         (select doc_no from ic_trans where product_code = a.code and trans_flag = 17
            order by doc_date desc nulls last limit 1) quote_doc,
         (select coalesce(aprove_status,0) from ic_trans where product_code = a.code and trans_flag = 17
            order by doc_date desc nulls last limit 1) quote_apr,
         (select coalesce(aprove_status_2,0) from ic_trans where product_code = a.code and trans_flag = 17
            order by doc_date desc nulls last limit 1) quote_customer_status,
         (select doc_no from ic_trans_detail where product_code = a.code and trans_flag = 122
            order by roworder desc limit 1) request_doc,
         to_char(a.time_register,'DD-MM-YYYY HH24:MI') registered,
         to_char((${STAGE_TIME_COL}),'DD-MM-YYYY HH24:MI') stage_started, ${elapsed},
         ${holdJsonSql("repair")}
       ${from} where ${filter} order by ${orderBy} limit $${args.length + 1} offset $${args.length + 2}`
    : `select a.code, c.name_1 customer, a.item_name product, a.pro_brand brand, a.pro_model model,
         a.pro_type product_type, a.pro_size product_size, to_char(a.appoint_date,'DD-MM-YYYY') appointment,
         a.doc_ref_1 sale_bill, a.tech_code technician, a.user_created creator,
         to_char(a.time_register,'DD-MM-YYYY HH24:MI') registered, ${elapsed}
       ${from} where ${filter} order by ${orderBy} limit $${args.length + 1} offset $${args.length + 2}`;

  const [list, count, techs, serviceCountRows, otherTab] = await Promise.all([
    query<RepairRow & InstallRow>(rowsSql, [...args, PAGE_SIZE, (page - 1) * PAGE_SIZE]),
    query<{ total: number }>(`select count(*)::int total ${from} where ${filter}`, args),
    listTechnicians(),
    isRepair
      ? query<{ service_type: string; count: number; overdue: number }>(
          `select a.service_type, count(*)::int count,
             count(*) filter (where ${REPAIR_STAGE_OVERDUE_SQL})::int overdue ${from}
           where ${serviceCountFilter} and a.service_type = any($${serviceCountArgs.length + 1}::text[])
           group by a.service_type`,
          [...serviceCountArgs, SERVICE_TYPES.map((item) => item.code)],
        )
      : Promise.resolve({ rows: [] as { service_type: string; count: number; overdue: number }[] }),
    // ຕົວເລກອີກແທັບ (ມີບັນຫາ ↔ ປົກກະຕິ) — ສະເພາະງານສ້ອມ
    isRepair
      ? query<{ total: number }>(`select count(*)::int total ${from} where ${otherTabFilter}`, args)
      : Promise.resolve({ rows: [{ total: 0 }] }),
  ]);

  /**
   * ຂັ້ນ "ກຳລັງສັ່ງຊື້ອາໄຫຼ່" — ODS ຮູ້ພຽງວ່າ "ອະນຸມັດສັ່ງຊື້ແລ້ວ" ແຕ່ບໍ່ຮູ້ວ່າໄປຮອດໃສ
   * ⇒ ດຶງຄວາມຄືບໜ້າຈິງຈາກ ERP (ອະນຸມັດ → ອອກ PO → ຮັບເຂົ້າສາງ) ມາສະແດງ.
   */
  const tracking =
    isRepair && status === "purchasing"
      ? await purchaseTracking(list.rows.map((row) => row.code))
      : new Map<string, PurchaseTrack>();

  // emp_code → ຊື່ ERP (ຊື່ຢູ່ຖານ ERP ຄົນລະບົບ ⇒ ຕ້ອງ resolve ຢູ່ນີ້ ບໍ່ join ໃນ SQL ໄດ້)
  const techName = new Map(techs.map((item) => [item.code, item.name]));
  const showTech = (code: string | null) => (code ? techName.get(code) ?? code : "-");

  const total = count.rows[0]?.total ?? 0;
  const otherTabTotal = otherTab.rows[0]?.total ?? 0;
  const serviceCounts = new Map(serviceCountRows.rows.map((item) => [item.service_type, item.count]));
  const serviceOverdue = new Map(serviceCountRows.rows.map((item) => [item.service_type, item.overdue]));
  const allServiceCount = [...serviceCounts.values()].reduce((sum, value) => sum + value, 0);
  const allServiceOverdue = [...serviceOverdue.values()].reduce((sum, value) => sum + value, 0);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // ທຸກລິ້ງຕ້ອງພາ `hold` ໄປນຳ — ບໍ່ດັ່ງນັ້ນກົດຈັດຮຽງ/ປ່ຽນໜ້າ ແລ້ວເດັ້ງອອກຈາກແທັບ "ມີບັນຫາ"
  const base = () => ({ ...(q && { q }), ...(service && { service }), ...(holdTab && { hold: "1" }) });
  const serviceHref = (target: string) =>
    `/dashboard/status/${workflow}/${status}?${new URLSearchParams({ ...(q && { q }), ...(target && { service: target }), ...(holdTab && { hold: "1" }), sort, dir })}`;
  /** ສະຫຼັບແທັບ ປົກກະຕິ ↔ ມີບັນຫາ — ຮັກສາຕົວກອງອື່ນໄວ້ (ແຕ່ກັບໄປໜ້າ 1) */
  const holdHref = (held: boolean) =>
    `/dashboard/status/${workflow}/${status}?${new URLSearchParams({ ...(q && { q }), ...(service && { service }), ...(held && { hold: "1" }), sort, dir })}`;
  const sortHref = (key: string, nextDir: SortDir) =>
    `/dashboard/status/${workflow}/${status}?${new URLSearchParams({ ...base(), sort: key, dir: nextDir })}`;
  const pageHref = (n: number) =>
    `/dashboard/status/${workflow}/${status}?${new URLSearchParams({ ...base(), sort, dir, ...(n > 1 && { page: String(n) }) })}`;

  /**
   * ລິ້ງໄປລາຍລະອຽດ — ຕິດ `?from=` ໄປນຳ ເພື່ອໃຫ້ເມນູຂ້າງຍັງສະຫວ່າງທີ່**ຄິວນີ້**.
   * ທຸກຄິວພາໄປ /service/<code> ອັນດຽວກັນ ⇒ ຖ້າບໍ່ບອກ ເມນູຈະໂດດໄປສະຫວ່າງທີ່
   * "ລາຍການຮັບສິນຄ້າເຂົ້າສ້ອມ" (/service) ແລ້ວຄົນເສຍບ່ອນຢືນ (ເບິ່ງ components/sidebar).
   */
  const detailHref = (code: string) =>
    `${isRepair ? `/service/${code}` : `/installations/${code}`}?from=/dashboard/status/${workflow}/${status}`;

  /**
   * ປຸ່ມລົງມືຕໍ່ຂັ້ນຂອງແຕ່ລະແຖວ — ດຶງອອກມາເປັນ fragment ດຽວ ເພື່ອໃຫ້ **ຕາຕະລາງ desktop**
   * ແລະ **card ມືຖື** ໃຊ້ເງື່ອນໄຂ/ props ດຽວກັນເປັນະ (ບໍ່ຊ້ຳ logic — ຖ້າແກ້ ແກ້ບ່ອນດຽວ).
   */
  const rowActions = (row: RepairRow & InstallRow) => (
    <>
      {startCheck && row.repair_confirm && <StartCheckButton code={row.code} />}
      {cancelAccepted && row.repair_confirm && (
        <UndoRepairAssignmentButton code={row.code} accepted variant="icon" />
      )}
      {accept && !row.repair_confirm && <AcceptRepairButton code={row.code} />}
      {cancelAssignment && !row.repair_confirm && (
        <UndoRepairAssignmentButton code={row.code} variant="icon" />
      )}
      {canReassign && !row.repair_confirm && (
        <AssignTechButton
          label="ປ່ຽນຊ່າງ"
          size="sm"
          row={{
            code: row.code,
            customer: row.customer,
            location_inst: row.location_inst,
            appoint_date: row.appoint_date,
            remark: row.remark,
            technician: row.technician,
          }}
          techs={techs}
          workflow="repair"
        />
      )}
      {startRepair && <StartRepairButton code={row.code} />}
      {cancelStartCheck && <UndoStartCheckButton code={row.code} variant="icon" />}
      {cancelFinishedCheck && <CancelCheckButton code={row.code} variant="icon" />}
      {cancelStartRepair && <UndoStartRepairButton code={row.code} variant="icon" />}
      {cancelFinishedRepair && <UndoFinishRepairButton code={row.code} variant="icon" />}
      {cancelQc && <UndoQcButton workflow="repair" code={row.code} variant="icon" />}
      {quotingStage &&
        row.quote_doc &&
        (() => {
          // ອະນຸມັດແລ້ວ (aprove_status≥1) → ລູກຄ້າຕັດສິນ; ຍັງ → ຜູ້ອະນຸມັດອະນຸມັດລາຄາກ່ອນ
          const awaitingCustomer = (row.quote_apr ?? 0) >= 1;
          const base = awaitingCustomer ? "/quotations" : "/approvals/quotations";
          if (!canAccess(role, base)) return null;
          const doc = encodeURIComponent(row.quote_doc);
          return (
            <Link
              href={awaitingCustomer ? `/quotations/customer-approval/${doc}` : `/approvals/quotations/${doc}`}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-teal-600 px-3 text-xs font-semibold text-white hover:bg-teal-700"
            >
              {awaitingCustomer ? "ຕັດສິນລາຄາ" : "ອະນຸມັດລາຄາ"}
              <LinkPending className="size-3" />
            </Link>
          );
        })()}
      {status === "quoting" && row.quote_doc && canAccess(role, "/quotations") && (
        <QuoteRowActions docNo={row.quote_doc} variant="cancel" />
      )}
      {status === "wait-withdraw" && row.quote_doc && row.quote_customer_status !== 0 && (
        <UndoCustomerButton docNo={row.quote_doc} size="md" />
      )}
      {status === "wait-withdraw" && !row.quote_doc && (
        <CancelCheckButton code={row.code} variant="icon" />
      )}
      {status === "withdrawing" && row.request_doc && (
        <CancelRequestButton docNo={row.request_doc} productCode={row.code} variant="icon" />
      )}
      {/* ປຸ່ມ "ໄປເຮັດຂັ້ນຕໍ່ໄປ" — ເນັ້ນສີເຕັມ (ນີ້ຄືສິ່ງທີ່ຄວນກົດ)
          ສ່ວນປຸ່ມຖອນຄືນເປັນ icon ຈືດໆ ⇒ ຕາໄປຫາອັນທີ່ຖືກກ່ອນ */}
      {linkAction && (
        <Link
          href={linkAction.href(row)}
          title={linkAction.label}
          aria-label={linkAction.label}
          className="grid size-8 place-items-center rounded-lg bg-teal-600 text-white transition hover:bg-teal-700"
        >
          <ArrowRight className="size-4" />
        </Link>
      )}
    </>
  );

  return (
    <div className="w-full space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/dashboard" className="mb-2 inline-flex items-center gap-1.5 text-xs font-medium text-teal-600 hover:underline">
            <ArrowLeft className="size-3.5" />
            ກັບໜ້າລວມ
            <LinkPending className="size-3" />
          </Link>
          <h1 className="text-xl font-bold text-slate-700">{config.label}</h1>
          <p className="mt-0.5 text-xs text-slate-500">
            {isRepair ? "ວຽກສ້ອມແປງ" : "ວຽກຕິດຕັ້ງ"} · {total.toLocaleString()} ລາຍການ · ໜ້າ {page}/{pages}
          </p>
        </div>
        <a
          href={`/api/dashboard/export?${new URLSearchParams({ workflow, status, ...(service && { service }) })}`}
          className="inline-flex h-9 items-center gap-2 rounded-lg bg-emerald-600 px-3 text-xs font-medium text-white hover:bg-emerald-700"
        >
          <Download className="size-4" />
          Export CSV
        </a>
      </div>

      {stagePolicy && (
        <section className="rounded-2xl border border-teal-200 bg-teal-50/70 p-3 shadow-sm">
          <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
            <div>
              <p className="text-xs font-bold text-teal-900">
                SLA ຂັ້ນ {stagePolicy.stage}: {stagePolicy.label}
              </p>
              <p className="mt-1 text-[11px] text-teal-800">
                ຜູ້ຮັບຜິດຊອບ: <b>{stagePolicy.owner}</b> · KPI: {stagePolicy.kpi}
              </p>
              {stagePolicy.external && (
                <p className="mt-1 text-[10px] font-semibold text-amber-700">
                  ເວລາຂັ້ນນີ້ຂຶ້ນກັບລູກຄ້າ/ຜູ້ສະໜອງ: ຕິດຕາມແຍກ ແລະບໍ່ຫັກ KPI ພະນັກງານໂດຍກົງ
                </p>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5 text-[10px] font-bold">
              {SERVICE_TYPES.map(({ code }) => (
                <span key={code} className="rounded-lg border border-teal-200 bg-white px-2 py-1 text-teal-800">
                  {code} {stagePolicy.hours[code]} ຊມ
                </span>
              ))}
              <span className="rounded-lg bg-teal-700 px-2 py-1 text-white">ເປົ້າ {stagePolicy.targetPct}%</span>
            </div>
          </div>
        </section>
      )}

      {/* ── ແທັບ ປົກກະຕິ / ມີບັນຫາ — ວຽກທັງສອງແທັບຍັງຢູ່ຂັ້ນນີ້ (ທຸງ ບໍ່ແມ່ນ ຂັ້ນ) ── */}
      {isRepair && holdOn && (
        <div className="flex w-fit overflow-hidden rounded-lg border border-slate-300 bg-white">
          {[
            { held: false, label: "ດຳເນີນປົກກະຕິ", count: holdTab ? otherTabTotal : total },
            { held: true, label: "ຕ້ອງກວດ", count: holdTab ? total : otherTabTotal },
          ].map(({ held, label, count }) => (
            <Link
              key={label}
              href={holdHref(held)}
              className={`inline-flex h-8 items-center gap-1.5 border-l border-slate-300 px-3 text-xs font-medium first:border-l-0 ${
                holdTab === held
                  ? held
                    ? "bg-amber-600 text-white"
                    : "bg-slate-900 text-white"
                  : "bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              {held && <CircleAlert className="size-3.5" />}
              {label}
              <span className="tabular-nums opacity-70">({count})</span>
              <LinkPending className="size-3" />
            </Link>
          ))}
        </div>
      )}

      {holdTab && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
          ວຽກເຫຼົ່ານີ້ <b>ຍັງຄ້າງຢູ່ຂັ້ນນີ້</b> ແລະ ຍັງນັບເປັນວຽກຄ້າງ — ພຽງແຕ່ຖືກໝາຍ “ຕ້ອງກວດວ່າຍັງຢູ່”
          ຈຶ່ງແຍກອອກມາ ແລະ <b>ນາລິກາຂັ້ນຢຸດນັບ</b> ຕັ້ງແຕ່ມື້ທີ່ໝາຍ. ປົດແລ້ວນາລິກາເດີນຕໍ່.
        </p>
      )}

      {isRepair && (
        <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm" aria-label="ກອງຕາມປະເພດບໍລິການ">
          <div className="mb-2 flex items-center justify-between gap-3 px-1">
            <div>
              <h2 className="text-xs font-bold text-slate-700">ປະເພດບໍລິການ</h2>
              <p className="mt-0.5 text-[10px] text-slate-400">ເລືອກເບິ່ງແຕ່ລະປະເພດໃນຂັ້ນຕອນນີ້</p>
            </div>
            {service && (
              <Link href={serviceHref("")} className="text-[11px] font-semibold text-teal-600 hover:underline">
                ລ້າງຕົວກອງ
              </Link>
            )}
          </div>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
            <Link
              href={serviceHref("")}
              className={`flex min-h-16 items-center justify-between rounded-xl border px-3 py-2.5 transition ${
                !service
                  ? "border-slate-800 bg-slate-900 text-white ring-4 ring-slate-100"
                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
              }`}
            >
              <span>
                <span className="block text-xs font-bold">ທັງໝົດ</span>
                <span className={`mt-0.5 block text-[10px] ${!service ? "text-slate-300" : "text-slate-400"}`}>ທຸກປະເພດບໍລິການ</span>
              </span>
              <span className="text-right">
                <b className="block text-lg tabular-nums">{allServiceCount.toLocaleString()}</b>
                <span className={`block text-[9px] font-semibold ${!service ? "text-red-300" : "text-red-600"}`}>
                  ເກີນ SLA {allServiceOverdue.toLocaleString()}
                </span>
              </span>
            </Link>
            {SERVICE_TYPES.map(({ code, label, icon: Icon, tone }) => {
              const active = service === code;
              const colors = SERVICE_TONE[tone];
              return (
                <Link
                  key={code}
                  href={serviceHref(code)}
                  className={`flex min-h-16 items-center gap-2.5 rounded-xl border px-3 py-2.5 transition ${
                    active
                      ? `${colors.active} ring-4`
                      : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  <span className={`grid size-8 shrink-0 place-items-center rounded-lg ${colors.icon}`}>
                    <Icon className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[10px] font-bold uppercase tracking-wide opacity-60">{code}</span>
                    <span className="block truncate text-[11px] font-semibold" title={label}>{label}</span>
                  </span>
                  <span className="text-right">
                    <b className="block text-base tabular-nums">{(serviceCounts.get(code) ?? 0).toLocaleString()}</b>
                    <span className="block text-[9px] font-semibold text-red-600">
                      ເກີນ {serviceOverdue.get(code) ?? 0}
                    </span>
                  </span>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      <form className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm">
        {service && <input type="hidden" name="service" value={service} />}
        <input type="hidden" name="sort" value={sort} />
        <input type="hidden" name="dir" value={dir} />
        <div className="flex h-9 min-w-56 flex-1 items-center gap-2 rounded-lg border border-slate-300 px-2.5">
          <Search className="size-3.5 shrink-0 text-slate-400" />
          <input
            name="q"
            defaultValue={q}
            placeholder="ຄົ້ນຫາ ເລກທີ, SN, ລູກຄ້າ, ຫຍີ່ຫໍ້, ຊ່າງ..."
            className="w-full text-xs outline-none"
          />
        </div>
        <button className="h-9 rounded-lg bg-slate-900 px-4 text-xs font-medium text-white">ຄົ້ນຫາ</button>
      </form>

      {/* ── ຕາຕະລາງ desktop (ເຊື່ອງໃນມືຖື) ── */}
      <section className="hidden overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm md:block">
        <div className="overflow-x-auto">
          <table className={`w-full border-collapse text-xs ${hasAction ? "min-w-[1400px]" : "min-w-[1250px]"}`}>
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-slate-600">
                {columns.map((col) => (
                  <SortHeader
                    key={col.key}
                    label={col.label}
                    sortKey={col.key}
                    current={sort}
                    dir={dir}
                    href={sortHref}
                    defaultDir={col.defaultDir}
                    className="py-2.5"
                  />
                ))}
                {isRepair ? (
                  <>
                    {/* ຂັ້ນສັ່ງຊື້: ຄວາມຄືບໜ້າຈິງຢູ່ ERP ສຳຄັນກວ່າ "ອຸປະກອນ/ອ້າງອີງ" */}
                    {tracking.size > 0 && (
                      <th className="whitespace-nowrap px-3 py-2.5 font-semibold">ຄວາມຄືບໜ້າ (ERP)</th>
                    )}
                    <th className="whitespace-nowrap px-3 py-2.5 font-semibold">ອຸປະກອນ</th>
                    <th className="whitespace-nowrap px-3 py-2.5 font-semibold">ອ້າງອີງ</th>
                    <th className="whitespace-nowrap px-3 py-2.5 font-semibold">ອາການເສຍ</th>
                  </>
                ) : (
                  <th className="whitespace-nowrap px-3 py-2.5 font-semibold">ເລກບິນຂາຍ</th>
                )}
                {hasAction && <th className="whitespace-nowrap px-3 py-2.5 text-center font-semibold">ຈັດການ</th>}
              </tr>
            </thead>
            <tbody>
              {list.rows.map((row) => {
                const targetHours = isRepair
                  ? repairStageTargetHours(config.stage ?? 0, row.service_type)
                  : null;
                const tone = isRepair
                  ? repairSlaTone(repairSlaState(row.elapsed_seconds, targetHours))
                  : elapsedTone(row.elapsed_seconds);
                const inWarranty = row.warranty === "ຮັບປະກັນ";
                return (
                  <RowLink key={row.code} href={detailHref(row.code)} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="relative whitespace-nowrap px-3 py-2.5 font-bold text-[#0536a9]">
                      <span className={`absolute inset-y-0 left-0 w-1 ${tone.bar}`} aria-hidden />
                      {isRepair ? (
                        <Link href={detailHref(row.code)} className="hover:underline">{row.code}</Link>
                      ) : (
                        row.code
                      )}
                      {/* ພິມ barcode ຕິດເຄື່ອງ — ເປີດແທັບໃໝ່ (RowLink ຂ້າມ <a> ⇒ ບໍ່ໄປໜ້າ detail) */}
                      {isRepair && (
                        <Link
                          href={`/service/${encodeURIComponent(row.code)}/barcode`}
                          target="_blank"
                          title="ພິມ barcode"
                          className="ml-1.5 inline-flex size-6 items-center justify-center rounded align-middle text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                        >
                          <Barcode className="size-3.5" />
                        </Link>
                      )}
                      {/* ຄິວສົ່ງຄືນມາຈາກ 2 ກໍລະນີ — ບອກໃຫ້ຄົນສົ່ງເຄື່ອງຮູ້ທຸກແຖວ (ບໍ່ແມ່ນສະເພາະຍົກເລີກ) */}
                      {showCase && (
                        <span
                          className={`ml-1.5 rounded px-1.5 py-0.5 text-[10px] font-bold ${
                            (row as RepairRow).cancelled ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"
                          }`}
                        >
                          {(row as RepairRow).cancelled ? "ຍົກເລີກ" : "ສ້ອມສຳເລັດ"}
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5">
                      <Elapsed seconds={row.elapsed_seconds} className={`inline-block rounded px-1.5 py-0.5 text-[11px] font-semibold ${tone.chip}`} />
                      {isRepair && targetHours != null && (
                        <span className="ml-1 text-[9px] font-semibold text-slate-400">SLA {targetHours} ຊມ</span>
                      )}
                      <span className="mt-0.5 block text-[10px] text-slate-400">
                        {isRepair ? row.stage_started || row.registered || "-" : row.registered || "-"}
                        {/* ນາລິກາຢຸດຢູ່ ⇒ ຕ້ອງບອກ ບໍ່ດັ່ງນັ້ນຄົນອ່ານວ່າ "ຄ້າງ 3 ມື້" ແລ້ວເຂົ້າໃຈຜິດ */}
                        {isRepair && holdOn && (row as RepairRow).hold && (
                          <b className="ml-1 text-amber-600">· ນາລິກາຢຸດ</b>
                        )}
                      </span>
                      {/* ໝາຍ/ປົດທຸງ — ຢູ່ຄຽງນາລິກາ ເພາະທຸງນີ້ຄືສິ່ງທີ່ຢຸດນາລິກາ */}
                      {isRepair && canHold && (
                        <span className="mt-1 block">
                          <HoldButtons
                            key={(row as RepairRow).hold ? "held" : "free"}
                            code={row.code}
                            hold={(row as RepairRow).hold}
                          />
                        </span>
                      )}
                    </td>
                    <td className="max-w-64 px-3 py-2.5">
                      <span className="block truncate font-medium text-slate-800" title={row.product ?? ""}>
                        {row.product || "-"} {row.model && <span className="text-slate-400">{row.model}</span>}
                      </span>
                      <span className="block truncate text-[10px] text-slate-400">
                        {isRepair
                          ? row.sn || "-"
                          : [row.product_type, row.product_size].filter(Boolean).join(" · ") || "-"}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5">{row.brand || "-"}</td>
                    <td className="max-w-44 px-3 py-2.5">
                      <span className="block truncate text-slate-700" title={row.customer ?? ""}>{row.customer || "-"}</span>
                      {isRepair && <span className="block truncate text-[10px] text-slate-400">{row.phone || "-"}</span>}
                    </td>
                    {isRepair ? (
                      <>
                        <td className="whitespace-nowrap px-3 py-2.5">
                          <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${inWarranty ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                            {row.warranty || "-"}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5">
                          {(() => {
                            const type = SERVICE_TYPES.find((item) => item.code === row.service_type);
                            if (!type) return <span className="text-slate-400">-</span>;
                            return (
                              <span className={`inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[10px] font-bold ${SERVICE_TONE[type.tone].badge}`}>
                                <b>{type.code}</b>
                                <span className="font-medium">{type.label}</span>
                              </span>
                            );
                          })()}
                        </td>
                      </>
                    ) : (
                      <td className="whitespace-nowrap px-3 py-2.5">{row.appointment || "-"}</td>
                    )}
                    <td className="whitespace-nowrap px-3 py-2.5">{showTech(row.technician)}</td>
                    <td className="whitespace-nowrap px-3 py-2.5">{isRepair ? row.receiver || "-" : row.creator || "-"}</td>
                    {isRepair ? (
                      <>
                        {tracking.size > 0 && (
                          <td className="max-w-56 px-3 py-2.5">
                            <PurchaseState track={tracking.get(row.code)} compact />
                            {/* ODS ວ່າສັ່ງແລ້ວ ແຕ່ ERP ບໍ່ມີໃບ = ໃບຜີ ⇒ ວຽກຄ້າງຕະຫຼອດ ຖ້າບໍ່ປົດ */}
                            {!tracking.get(row.code) && (
                              <span className="mt-1 block">
                                <ReleaseGhostButton job={row.code} />
                              </span>
                            )}
                          </td>
                        )}
                        <td className="max-w-40 truncate px-3 py-2.5 text-slate-600" title={row.accessory ?? ""}>
                          {row.accessory || "-"}
                        </td>
                        <td className="max-w-32 truncate px-3 py-2.5 text-slate-600" title={row.reference ?? ""}>
                          {row.reference || "-"}
                        </td>
                        <td className="max-w-52 truncate px-3 py-2.5 font-semibold text-red-600" title={row.issue ?? ""}>
                          {row.issue || "-"}
                        </td>
                        {hasAction && (
                          <td className="whitespace-nowrap px-3 py-2.5 text-center">
                            {/* ປຸ່ມທັງໝົດເປັນ icon ຂະໜາດດຽວກັນ ຮຽງແຖວດຽວ — ຂໍ້ຄວາມເຕັມເຮັດໃຫ້
                                ແຖວສູງເປັນສອງເທົ່າ ແລະ ຕາຕະລາງອ່ານບໍ່ອອກ (ຄວາມໝາຍຢູ່ tooltip) */}
                            <span className="inline-flex items-center justify-center gap-1">{rowActions(row)}</span>
                          </td>
                        )}
                      </>
                    ) : (
                      <td className="max-w-40 truncate px-3 py-2.5 text-slate-600" title={row.sale_bill ?? ""}>
                        {row.sale_bill || "-"}
                      </td>
                    )}
                  </RowLink>
                );
              })}
            </tbody>
          </table>
        </div>

        {total === 0 && <p className="py-12 text-center text-xs text-slate-400">ບໍ່ພົບລາຍການ</p>}
      </section>

      {/* ── ບັນຊີ card ສຳລັບມືຖື (ແຖວດຽວກັນກັບຕາຕະລາງ · ປຸ່ມ/ເງື່ອນໄຂດຽວກັນ) ── */}
      <section className="space-y-2 md:hidden">
        {total === 0 ? (
          <p className="py-12 text-center text-xs text-slate-400">ບໍ່ພົບລາຍການ</p>
        ) : (
          list.rows.map((row) => {
            const targetHours = isRepair ? repairStageTargetHours(config.stage ?? 0, row.service_type) : null;
            const tone = isRepair
              ? repairSlaTone(repairSlaState(row.elapsed_seconds, targetHours))
              : elapsedTone(row.elapsed_seconds);
            const inWarranty = row.warranty === "ຮັບປະກັນ";
            const type = isRepair ? SERVICE_TYPES.find((item) => item.code === row.service_type) : undefined;
            const track = tracking.get(row.code);
            return (
              <div key={row.code} className="relative overflow-hidden rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                <span className={`absolute inset-y-0 left-0 w-1 ${tone.bar}`} aria-hidden />
                {/* ຫົວ card: ເລກທີ + ເວລາຄ້າງ */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Link href={detailHref(row.code)} className="text-sm font-bold text-[#0536a9] hover:underline">
                        {row.code}
                      </Link>
                      {isRepair && (
                        <Link
                          href={`/service/${encodeURIComponent(row.code)}/barcode`}
                          target="_blank"
                          title="ພິມ barcode"
                          className="inline-flex size-6 items-center justify-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                        >
                          <Barcode className="size-3.5" />
                        </Link>
                      )}
                      {showCase && (
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                            (row as RepairRow).cancelled ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"
                          }`}
                        >
                          {(row as RepairRow).cancelled ? "ຍົກເລີກ" : "ສ້ອມສຳເລັດ"}
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-[10px] text-slate-400">
                      {isRepair ? row.stage_started || row.registered || "-" : row.registered || "-"}
                      {isRepair && holdOn && (row as RepairRow).hold && <b className="ml-1 text-amber-600">· ນາລິກາຢຸດ</b>}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <Elapsed
                      seconds={row.elapsed_seconds}
                      className={`inline-block rounded px-1.5 py-0.5 text-[11px] font-semibold ${tone.chip}`}
                    />
                    {isRepair && targetHours != null && (
                      <span className="mt-0.5 block text-[9px] font-semibold text-slate-400">SLA {targetHours} ຊມ</span>
                    )}
                  </div>
                </div>

                {/* ສິນຄ້າ / SN */}
                <div className="mt-2">
                  <p className="truncate text-xs font-medium text-slate-800" title={row.product ?? ""}>
                    {row.product || "-"} {row.model && <span className="text-slate-400">{row.model}</span>}
                  </p>
                  <p className="truncate text-[10px] text-slate-400">
                    {isRepair
                      ? row.sn || "-"
                      : [row.product_type, row.product_size].filter(Boolean).join(" · ") || "-"}
                  </p>
                </div>

                {/* ຊິບ: ຍີ່ຫໍ້ · ປະກັນ/ວັນນັດ · ປະເພດບໍລິການ */}
                <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px]">
                  {row.brand && <span className="rounded bg-slate-100 px-1.5 py-0.5 font-medium text-slate-600">{row.brand}</span>}
                  {isRepair ? (
                    <span className={`rounded px-1.5 py-0.5 font-medium ${inWarranty ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                      {row.warranty || "-"}
                    </span>
                  ) : (
                    row.appointment && <span className="rounded bg-slate-100 px-1.5 py-0.5 font-medium text-slate-600">ນັດ {row.appointment}</span>
                  )}
                  {type && (
                    <span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-bold ${SERVICE_TONE[type.tone].badge}`}>
                      <b>{type.code}</b>
                      <span className="font-medium">{type.label}</span>
                    </span>
                  )}
                </div>

                {/* ລູກຄ້າ · ຊ່າງ · ຜູ້ຮັບ/ຜູ້ສ້າງ */}
                <div className="mt-2 border-t border-slate-100 pt-2 text-[11px] text-slate-500">
                  <p className="truncate" title={row.customer ?? ""}>
                    <span className="text-slate-400">ລູກຄ້າ:</span> {row.customer || "-"}
                    {isRepair && row.phone && <span className="text-slate-400"> · {row.phone}</span>}
                  </p>
                  <p className="truncate">
                    <span className="text-slate-400">ຊ່າງ:</span> {showTech(row.technician)}
                    <span className="text-slate-400"> · {isRepair ? "ຜູ້ຮັບ" : "ຜູ້ສ້າງ"}:</span>{" "}
                    {isRepair ? row.receiver || "-" : row.creator || "-"}
                  </p>
                  {isRepair && row.issue && (
                    <p className="truncate font-semibold text-red-600" title={row.issue}>
                      <span className="font-normal text-slate-400">ອາການ:</span> {row.issue}
                    </p>
                  )}
                </div>

                {/* ຄວາມຄືບໜ້າ ERP (ຂັ້ນສັ່ງຊື້) */}
                {isRepair && tracking.size > 0 && (
                  <div className="mt-2">
                    <PurchaseState track={track} compact />
                    {!track && (
                      <span className="mt-1 block">
                        <ReleaseGhostButton job={row.code} />
                      </span>
                    )}
                  </div>
                )}

                {/* ໝາຍ/ປົດ ທຸງ ແລະ ປຸ່ມລົງມືຕໍ່ຂັ້ນ — ຄືກັນກັບ desktop */}
                {isRepair && canHold && (
                  <div className="mt-2">
                    <HoldButtons
                      key={(row as RepairRow).hold ? "held" : "free"}
                      code={row.code}
                      hold={(row as RepairRow).hold}
                    />
                  </div>
                )}
                {hasAction && <div className="mt-2 flex flex-wrap items-center gap-1.5">{rowActions(row)}</div>}
              </div>
            );
          })
        )}
      </section>

      {pages > 1 && (
        <nav className="flex items-center justify-between gap-3 text-xs">
          <span className="text-slate-500">
            ສະແດງ {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} ຈາກ {total.toLocaleString()}
          </span>
          <div className="flex items-center gap-1">
            <Link
              href={pageHref(page - 1)}
              aria-disabled={page === 1}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 hover:bg-slate-50 aria-disabled:pointer-events-none aria-disabled:opacity-40"
            >
              <ChevronLeft className="size-3.5" />
              ກ່ອນໜ້າ
            </Link>
            <span className="px-3 font-medium text-slate-700">{page} / {pages}</span>
            <Link
              href={pageHref(page + 1)}
              aria-disabled={page >= pages}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 hover:bg-slate-50 aria-disabled:pointer-events-none aria-disabled:opacity-40"
            >
              ຕໍ່ໄປ
              <ChevronRight className="size-3.5" />
            </Link>
          </div>
        </nav>
      )}
    </div>
  );
}
