import { canAccess, type Role } from "@/lib/roles";
import { resourceForPath } from "@/lib/permission-catalog";
import { pipelineOf, repairStatuses } from "@/lib/dashboard-status";
import {
  Boxes,
  ClipboardCheck,
  FileBarChart,
  HardHat,
  LayoutDashboard,
  type LucideIcon,
  ShieldCheck,
  ShoppingCart,
  Wrench,
} from "lucide-react";

export type NavItem = {
  label: string;
  href: string;
  /** ເສັ້ນຂັ້ນເທິງລາຍການນີ້ (ຄື <hr> ໃນ layout.html ເກົ່າ) */
  divider?: boolean;
  /**
   * ສິດທີ່ **ບໍ່ໄດ້ຢູ່ໃນຕາຕະລາງ RULES** ແຕ່ຢູ່ໃນຖານຂໍ້ມູນ.
   * ດຽວນີ້ມີອັນດຽວ: "qc" — ຜູ້ຈັດການກຳນົດຜູ້ກວດເອງທີ່ ods_qc_role
   * ⇒ canAccess() ບອກບໍ່ໄດ້ວ່າໃຜເຫັນລາຍການນີ້ ຕ້ອງຖາມຖານຂໍ້ມູນ (layout ສົ່ງມາໃຫ້).
   */
  flag?: "qc";
  /**
   * ຕົວເລກຄິວທີ່ຂຶ້ນຂ້າງລາຍການ — ກຸນແຈຂອງ lib/nav-counts (ປົກກະຕິແມ່ນ href ຂອງມັນເອງ).
   * ບໍ່ໃສ່ = ບໍ່ມີຕົວເລກ.
   */
  count?: string;
  /**
   * ເສັ້ນທາງເພີ່ມທີ່ໃຫ້ລາຍການນີ້ **active** ນຳ (ນອກຈາກ href) — ໃຊ້ກັບໜ້າລາຍລະອຽດ/ລົງມື
   * ທີ່ບໍ່ມີເມນູຂອງຕົນ (ເຊັ່ນ /checking, /returns) ⇒ ໃຫ້ sidebar ຍັງ highlight ບ່ອນເຮັດວຽກ.
   */
  match?: string[];
};

export type NavGroup = { id: string; label: string; icon: LucideIcon; items: NavItem[] };

/**
 * ເມນູ — ແຍກ "ສ້ອມແປງ" ກັບ "ຕິດຕັ້ງ" ອອກເປັນຄົນລະສ່ວນ.
 *
 * ods ເອົາສອງງານນີ້ປົນກັນຢູ່ໃນກຸ່ມ "ບໍລິການ" ແລະ "ຊ່າງ" (layout.html:69-346)
 * ເຊິ່ງເຮັດໃຫ້ຊ່າງສ້ອມ ແລະ ຊ່າງຕິດຕັ້ງ ຕ້ອງຄົ້ນຫາເມນູຂອງຕົນໃນກອງດຽວກັນ.
 * ບ່ອນນີ້ແຍກຕາມສາຍງານຈິງ: ໃບຮັບເຄື່ອງ → ກວດເຊັກ → ສ້ອມ → ສົ່ງຄືນ
 * ກັບ ງານຕິດຕັ້ງ → ມອບໝາຍ → ເບີກອາໄຫຼ່ → ຕິດຕັ້ງ → ປິດງານ.
 */

/* ── ປັກໝຸດເທິງສຸດ ─────────────────────────────────────────────────
 * ໜ້າລວມ **ບໍ່ເຄີຍມີໃນ sidebar ເລີຍ** (ເຂົ້າໄດ້ແຕ່ຜ່ານໂລໂກ້) ທັງທີ່ເປັນໜ້າທີ່ຄົນເປີດຫຼາຍສຸດ.
 * ແລະ "ກິດຈະກຳ/ແຈ້ງເຕືອນ" ເປັນເລື່ອງສ່ວນຕົວ ບໍ່ແມ່ນເລື່ອງສ້ອມແປງ ແຕ່ຖືກຝັງໄວ້ທ້າຍກຸ່ມ
 * "ສ້ອມແປງ" ⇒ ສາງ/CS ຫາບໍ່ພົບ. ດຽວນີ້ຂຶ້ນເທິງສຸດ ເຫັນທຸກ role.
 */
const HOME: NavGroup = {
  id: "home_menu",
  label: "ຂອງຂ້ອຍ",
  icon: LayoutDashboard,
  items: [
    { label: "ໜ້າລວມ", href: "/dashboard" },
    { label: "AI ຜູ້ຊ່ວຍວຽກ", href: "/assistant" },
    /**
     * ຄິວງານປະຈຳວັນ = "ມື້ນີ້ຂ້ອຍ/ຊ່າງຂ້ອຍຕ້ອງໄປໃສແດ່" — ເປັນເລື່ອງ **ຂອງມື້ນີ້**
     * ບໍ່ແມ່ນເລື່ອງ "ຂັ້ນຕອນຂອງໂມດູນຕິດຕັ້ງ" ແລະ ດຽວນີ້ມັນລວມງານ **ສ້ອມ** ນຳແລ້ວ
     * ⇒ ຢູ່ໃຕ້ກຸ່ມ "ຕິດຕັ້ງ" ບໍ່ຖືກຕໍ່ໄປ. ຊ່າງເປີດອັນນີ້ທຸກເຊົ້າ ⇒ ຂຶ້ນມາຢູ່ "ຂອງຂ້ອຍ".
     */
    { label: "ຄິວງານປະຈຳວັນ", href: "/installations/schedule" },
    /**
     * ຄິວແຈ້ງລູກຄ້າ — **ຍ້າຍມາຈາກກຸ່ມ "ສ້ອມແປງ"** (17-07-2026). ຢູ່ບ່ອນເກົ່າຜິດ 2 ຢ່າງ:
     *   ① ຖືກນັບເປັນ **ຂັ້ນທີ 2 ຂອງສາຍງານສ້ອມ** ທັງທີ່ບໍ່ແມ່ນຂັ້ນຕອນ — ງານບໍ່ໄດ້ໄຫຼຜ່ານມັນ
     *   ② ມັນລວມ **ນັດຕິດຕັ້ງ** ນຳ (ກົດແລ້ວໄປ /installations/…) ⇒ ຢູ່ໃນກຸ່ມສ້ອມບໍ່ຄົບຄວາມ
     * ມັນຄືຄິວວຽກ**ຂອງມື້ນີ້**ທີ່ຂ້າມສາຍງານ ຄືກັນກັບ "ຄິວງານປະຈຳວັນ" ຂ້າງເທິງ ⇒ ຢູ່ນຳກັນ.
     */
    { label: "ຄິວແຈ້ງລູກຄ້າ", href: "/customer-contact" },
    /**
     * ⚠️ "ສົນທະນາ" **ບໍ່ຢູ່ໃນເມນູແລ້ວ** (17-07-2026) — ເປັນ**ປຸ່ມລອຍ**ມູມຂວາລຸ່ມ
     * (components/chat/floating-chat) ເຫັນທຸກໜ້າ. ການລົມກັນເກີດຂຶ້ນ**ໃນຂະນະທີ່**
     * ກຳລັງເຮັດວຽກຢູ່ໜ້າອື່ນ — ບັງຄັບໃຫ້ອອກຈາກໜ້າວຽກໄປໜ້າແຊັດ ຄືເຮັດວຽກຂາດຕອນ.
     */
    { label: "ກິດຈະກຳຂອງຂ້ອຍ", href: "/activities" },
    { label: "ການແຈ້ງເຕືອນ", href: "/notifications" },
    { label: "ຄູ່ມືການໃຊ້ງານ", href: "/manual" },
  ],
};

/* ── ສາຍງານສ້ອມແປງ — ລຽງຕາມຂັ້ນຕອນ (ຮັບງານ + ລໍກວດ ເປັນຂັ້ນດຽວ) ── */
const REPAIR: NavGroup = {
  id: "repair_menu",
  label: "ສ້ອມແປງ",
  icon: Wrench,
  items: [
    { label: "ລາຍການຮັບສິນຄ້າເຂົ້າສ້ອມ", href: "/service", match: ["/quotations", "/returns", "/qc/repair"] },
    ...pipelineOf(repairStatuses).map(([slug, def]) => ({
      label: def.label,
      href: `/dashboard/status/repair/${slug}`,
      count: `/dashboard/status/repair/${slug}`,
    })),
  ].map((item, index) => ({ ...item, label: `${index + 1}. ${item.label}` })),
};

/* ── ສາຍງານຕິດຕັ້ງ ─────────────────────────────────────────────── */

/**
 * ຂັ້ນຕອນຂອງງານຕິດຕັ້ງ — **ໃສ່ເລກລຽງ** ຄືເມນູສ້ອມແປງ (17-07-2026): ຄົນເປີດເມນູ
 * ແລ້ວຮູ້ທັນທີວ່າງານໄຫຼຈາກໃສໄປໃສ ບໍ່ຕ້ອງເດົາຈາກລຳດັບບັນທັດ.
 * ⚠️ ໃສ່ເລກສະເພາະ**ຂັ້ນເຮັດວຽກ** — ລາຍງານຢູ່ທ້າຍບໍ່ແມ່ນຂັ້ນຕອນ ຈຶ່ງບໍ່ມີເລກ.
 */
const INSTALL_FLOW: NavItem[] = [
  { label: "ເປີດງານ / ລໍຖ້າຈັດຊ່າງ", href: "/installations", count: "/installations/assign" },
  { label: "ລໍຖ້າຊ່າງຮັບ", href: "/installations/accept", count: "/installations/accept" },
  { label: "ລໍຖ້າເບີກອາໄຫຼ່", href: "/installations/spare-requests", count: "/installations/spare-requests" },
  { label: "ລໍຖ້າຮັບອາໄຫຼ່ຈາກການເບີກ", href: "/installations/spare-pickup", count: "/installations/spare-pickup" },
  { label: "ລໍຖ້າຕິດຕັ້ງ", href: "/installations/work", count: "/installations/work" },
  { label: "ກຳລັງຕິດຕັ້ງ", href: "/installations/work/doing", count: "/installations/work/doing" },
  { label: "ລໍຖ້າກວດ QC", href: "/qc?workflow=install", flag: "qc", count: "/qc/install" },
  { label: "ລໍຖ້າລູກຄ້າປະເມີນ", href: "/installations/feedback", count: "/dashboard/status/install/wait-feedback" },
  { label: "ລໍຖ້າປິດງານ", href: "/installations/close", count: "/installations/close" },
];

/** ລາຍງານຂອງສາຍງານຕິດຕັ້ງ — ບໍ່ແມ່ນຂັ້ນຕອນ ຈຶ່ງບໍ່ໃສ່ເລກ */
const INSTALL_REPORTS: NavItem[] = [
  { label: "ບິນຄ້າງອອກໃບງານ", href: "/installations/pending-bills", count: "/installations/pending-bills", divider: true },
  { label: "ສົ່ງຄືນອາໄຫຼ່ງານຕິດຕັ້ງ", href: "/stock/returns?job=install" },
  { label: "ລາຍງານງານຕິດຕັ້ງ", href: "/reports/installations" },
  { label: "ສະຫຼຸບອາໄຫຼ່ຕິດຕັ້ງປະຈຳເດືອນ", href: "/reports/install-spares-monthly" },
  { label: "ລາຍງານແບບສອບຖາມລູກຄ້າ", href: "/reports/customer-feedback" },
];

const INSTALL: NavGroup = {
  id: "install_menu",
  label: "ຕິດຕັ້ງ",
  icon: HardHat,
  items: [
    ...INSTALL_FLOW.map((item, index) => ({ ...item, label: `${index + 1}. ${item.label}` })),
    ...INSTALL_REPORTS,
  ],
};

/* ── ສາງ ແລະ ອາໄຫຼ່ (ໃຊ້ຮ່ວມກັນທັງສອງສາຍງານ) ──────────────────── */
const STOCK: NavGroup = {
  id: "stock_menu",
  label: "ສາງ ແລະ ອາໄຫຼ່",
  icon: Boxes,
  items: [
    { label: "ຂໍໂອນອາໄຫຼ່ມາຫ້ອງສ້ອມ", href: "/stock/transfer-to-repair" },
    { label: "ຕິດຕາມການໂອນອາໄຫຼ່", href: "/stock/transfers" },
    { label: "ລາຍການສົ່ງ​ຄືນອາໄຫຼ່", href: "/stock/receive-returns" },
    // ອາໄຫຼ່ທີ່ເບີກອອກໄປແລ້ວ ແຕ່ວຽກຍົກເລີກ — ຕ້ອງເກັບຄືນ (ຍ້າຍມາຈາກໜ້າອະນຸມັດ 17-07-2026)
    { label: "ອາໄຫຼ່ຄ້າງນອກສາງ", href: "/stock/spare-recovery", count: "/stock/spare-recovery" },
    { label: "ລາຍການອາໄຫຼ່", href: "/stock/spare-parts", divider: true },
    { label: "ສິນຄ້າສ້ອມແປງ", href: "/stock/products" },
    { label: "ສ້າງອາໄຫຼ່", href: "/spare-parts/new" },
    // ກວດນັບສະຕ໋ອກເຄື່ອງສ້ອມ — ຍ້າຍມາຈາກເມນູສ້ອມ (ຫົວໜ້າ/ຜູ້ອະນຸມັດເຫັນ — RULES: /service/stock-count)
    { label: "ກວດນັບສະຕ໋ອກເຄື່ອງສ້ອມ", href: "/service/stock-count", divider: true },
  ],
};

/**
 * ກຸ່ມ "ສັ່ງຊື້ອາໄຫຼ່" — ແຍກອອກຈາກກຸ່ມສາງ (16-07-2026): ການສັ່ງຊື້ເປັນສາຍວຽກ
 * ຂອງຕົນເອງ (ຂໍຊື້ → ອະນຸມັດ → PO → ຕິດຕາມ) ບໍ່ແມ່ນວຽກເບີກ-ຮັບຂອງສາງ.
 */
const PURCHASE: NavGroup = {
  id: "purchase_menu",
  label: "ສັ່ງຊື້ອາໄຫຼ່",
  icon: ShoppingCart,
  items: [
    { label: "ຂໍສັ່ງຊື້", href: "/purchase-requests" },
    { label: "ໃບສັ່ງຊື້ (PO)", href: "/purchase-orders", count: "/purchase-orders" },
    { label: "ຕິດຕາມການສັ່ງຊື້", href: "/dashboard/status/repair/purchasing" },
  ],
};

const APPROVE: NavGroup = {
  id: "approve_menu",
  label: "ອະນຸມັດ",
  icon: ClipboardCheck,
  items: [
    { label: "ອະນຸມັດໃບສະເໜີລາຄາ", href: "/approvals/quotations", count: "/approvals/quotations" },
    { label: "ອະນຸມັດຍົກເລີກເຄື່ອງສ້ອມ", href: "/approvals/cancellations", count: "/approvals/cancellations" },
    { label: "ອະນຸມັດຂໍສັ່ງຊື່", href: "/approvals/purchase-requests", count: "/approvals/purchase-requests" },
    // ດ່ານສຸດທ້າຍກ່ອນຜູ້ສະໜອງສົ່ງຂອງ (WPOA) — ຄິວຂອງຜູ້ອະນຸມັດ (ປຸ່ມຢູ່ໜ້າ PO ຍັງມີຄືເກົ່າ)
    { label: "ອະນຸມັດໃບສັ່ງຊື້ (PO)", href: "/approvals/purchase-orders", count: "/approvals/purchase-orders" },
  ],
};

/* ── ຄຸນນະພາບ (QC) — ດ່ານກ່ອນສົ່ງມອບລູກຄ້າ ─────────────────────
 * ໃຊ້ຮ່ວມກັນທັງສ້ອມແປງ ແລະ ຕິດຕັ້ງ ⇒ ຢູ່ກຸ່ມຂອງຕົນເອງ ບໍ່ຢູ່ໃນສາຍງານໃດສາຍງານນຶ່ງ.
 */

const REPORT: NavGroup = {
  id: "report_menu",
  label: "ລາຍງານ",
  icon: FileBarChart,
  items: [
    { label: "ໜ້າລວມລາຍງານ", href: "/reports" },
    // KPI: ງານໄຫຼດີບໍ · **ຄ້າງຢູ່ຂັ້ນໃດ** (ຄໍຂວດ) · ໃຜເຮັດໄດ້ເທົ່າໃດ — ທັງສອງສາຍງານ
    { label: "KPI ປະສິດທິພາບ", href: "/reports/kpi" },
    // ສ້ອມບໍ່ຫາຍແຕ່ເທື່ອທຳອິດ = ຈ່າຍຄ່າຊ່າງ 2 ເທື່ອ — ບໍ່ມີໜ້າໃດເຄີຍເຫັນມັນ
    { label: "ເຄື່ອງກັບມາສ້ອມຊ້ຳ", href: "/reports/repeat-repairs" },
    { label: "ລາຍງານກວດເຊັກ", href: "/reports/checking" },
    { label: "ລາຍງານຮັບເຄື່ອງປະຈຳວັນ", href: "/reports/daily-receipts" },
    { label: "ລາຍງານໃບຮັບເງິນ", href: "/reports/receipts" },
    // ── ເງິນຂອງງານສ້ອມ (17-07-2026) — ໜີ້ຄ້າງ · ລາຍຮັບ · ແຍກປະເພດລູກຄ້າ ──
    { label: "ຕິດຕາມການຊຳລະ", href: "/reports/service-debts" },
    { label: "ສະຫຼຸບລາຍຮັບງານສ້ອມ", href: "/reports/service-revenue" },
    { label: "ງານສ້ອມ: ທົ່ວໄປ / ຮ້ານຄ້າ", href: "/reports/service-by-kind" },
    { label: "ລາຍງານຍົກເລີກຮັບເຄື່ອງ", href: "/reports/cancelled-receipts" },
    { label: "ລາຍງານງານຄ້າງ", href: "/reports/pending" },
    { label: "ລາຍງານສາງ", href: "/reports/stock", divider: true },
    { label: "ລາຍງານການສັ່ງຊື້", href: "/reports/purchase-requests" },
    { label: "ລາຍງານໃບສັ່ງຊື້", href: "/reports/purchase-orders" },
    { label: "ລາຍງານມອບໝາຍງານ", href: "/reports/job-dispatch" },
    { label: "ລາຍຮັບຊ່າງ (ຄ່າຄອມ)", href: "/reports/technician-income", divider: true },
  ],
};

/* ── ຜູ້ໃຊ້ (ຜູ້ຈັດການເທົ່ານັ້ນ) ───────────────────────────────────
 * ເມນູ "ການຈັດການ" ເກົ່າຂອງ ods ຖືກລົບຖິ້ມໄປແລ້ວ — ບ່ອນນີ້ບໍ່ແມ່ນການກູ້ຄືນ
 * ແຕ່ເປັນໜ້າໃໝ່: ຈັດການພະນັກງານ ERP ແລະ ກຳນົດສິດເຂົ້າໃຊ້ແອັບນີ້.
 */
const USERS: NavGroup = {
  id: "user_menu",
  label: "ຜູ້ໃຊ້",
  icon: ShieldCheck,
  items: [
    { label: "ກຳນົດສິດ", href: "/manage/employees" },
    // ຕັ້ງລາຍການກວດຮັບ = **ການຕັ້ງຄ່າ** (ຜູ້ຈັດການເຮັດເທື່ອດຽວ) ບໍ່ແມ່ນຄິວງານປະຈຳວັນ
    { label: "ຕັ້ງລາຍການກວດຮັບ (QC)", href: "/manage/qc-checklist" },
    { label: "ຄ່າບໍລິການ / ຄ່າຄອມຊ່າງ", href: "/manage/service-rates" },
    { label: "ເຊື່ອມຕົວຕົນຊ່າງ", href: "/manage/technicians" },
    { label: "ການຕັ້ງຄ່າລະບົບ", href: "/manage/settings" },
  ],
};

/** ເມນູທັງໝົດ (ກ່ອນກັ່ນຕອງສິດ) */
/**
 * ── ກຸ່ມ "ຄຸນນະພາບ" **ຖອດອອກແລ້ວ** (13-07-2026) ──
 * ມັນເປັນກຸ່ມທີ່ຈັດຕາມ "ຫົວຂໍ້" ບໍ່ແມ່ນຕາມ **ລຳດັບການເຮັດວຽກ** ⇒ ຂັ້ນຕອນທີ່ຕ້ອງຜ່ານຈິງ
 * (QC · ແຈ້ງລູກຄ້າ) ໄປລີ້ຢູ່ນັ້ນ ແລ້ວຄົນເຮັດງານຫາບໍ່ພົບ. ດຽວນີ້:
 *   ກວດຮັບຄຸນນະພາບ → ຢູ່ໃນລຳດັບຂອງ **ທັງສອງສາຍງານ** (ສ້ອມ · ຕິດຕັ້ງ)
 *   ຄິວແຈ້ງລູກຄ້າ  → ຢູ່ກຸ່ມ **ຂອງຂ້ອຍ** (ຄິວວຽກຂອງມື້ນີ້ ຂ້າມສາຍງານ — ເບິ່ງເຫດຜົນຢູ່ນັ້ນ)
 *   ຕັ້ງລາຍການກວດຮັບ → ຢູ່ກຸ່ມ **ຜູ້ໃຊ້/ຕັ້ງຄ່າ** (ເປັນການຕັ້ງຄ່າ ບໍ່ແມ່ນຄິວງານ)
 */
export const navigation: NavGroup[] = [HOME, REPAIR, INSTALL, STOCK, PURCHASE, APPROVE, REPORT, USERS];

/**
 * Sidebar ສະເພາະຊ່າງ — ມີແຕ່ຄິວທີ່ຊ່າງລົງມືໄດ້ຈິງ.
 * ບໍ່ເອົາ dashboard/status, ຈັດຊ່າງ, ປິດງານ, ລາຍງານລວມ ຫຼືໜ້າ CS/ສາງ.
 */
const TECHNICIAN_NAVIGATION: NavGroup[] = [
  {
    id: "tech_home_menu",
    label: "ຂອງຂ້ອຍ",
    icon: LayoutDashboard,
    items: [
      { label: "ຄິວງານຂອງຂ້ອຍ", href: "/installations/schedule" },
      { label: "AI ຜູ້ຊ່ວຍວຽກ", href: "/assistant" },
    // ສົນທະນາ = ປຸ່ມລອຍ (ເບິ່ງໝາຍເຫດຢູ່ກຸ່ມ HOME) — ຊ່າງກໍ່ເຫັນປຸ່ມດຽວກັນ
    { label: "ກິດຈະກຳຂອງຂ້ອຍ", href: "/activities" },
    { label: "ການແຈ້ງເຕືອນ", href: "/notifications" },
    ],
  },
  {
    id: "tech_repair_menu",
    label: "ງານສ້ອມຂອງຂ້ອຍ",
    icon: Wrench,
    items: [
      { label: "ກວດເຊັກ", href: "/checking", count: "/checking" },
      /**
       * ໜ້າ /stock/requests (ລາຍການ) ຖືກລົບ 17-07-2026 — ຊ້ຳກັບຄິວ pipeline
       * (ແທັບ "ຕ້ອງການອາໄຫຼ່" = ຂັ້ນ 5 ແຕ່ຂາດເງື່ອນໄຂ ⇒ ສະແດງແຖວຄ້າງ · `?job=repair`
       * ບໍ່ເຄີຍຖືກອ່ານເລີຍ). ຊ່າງຂໍເບີກຜ່ານ **ແອັບມືຖື** (/api/mobile/spare-request)
       * ຫຼື ຜ່ານປຸ່ມ "ກວດ Stock / ດຳເນີນອາໄຫຼ່" ຢູ່ຄິວນີ້ (ພາໄປ /stock/requests/<roworder>).
       */
      { label: "ຂໍເບີກອາໄຫຼ່", href: "/dashboard/status/repair/wait-withdraw", count: "/dashboard/status/repair/wait-withdraw" },
      { label: "ຮັບອາໄຫຼ່", href: "/stock/requests/pickup" },
      { label: "ສ້ອມແປງ", href: "/repair", count: "/repair" },
      { label: "ສົ່ງຄືນອາໄຫຼ່", href: "/stock/returns?job=repair" },
      { label: "ກວດຮັບຄຸນນະພາບ", href: "/qc?workflow=repair", flag: "qc", count: "/qc" },
    ],
  },
  {
    id: "tech_install_menu",
    label: "ງານຕິດຕັ້ງຂອງຂ້ອຍ",
    icon: HardHat,
    items: [
      { label: "ຮັບງານ", href: "/installations/accept", count: "/installations/accept" },
      { label: "ຂໍເບີກອາໄຫຼ່", href: "/installations/spare-requests", count: "/installations/spare-requests" },
      { label: "ຮັບອາໄຫຼ່", href: "/installations/spare-pickup", count: "/installations/spare-pickup" },
      { label: "ລໍຖ້າຕິດຕັ້ງ", href: "/installations/work", count: "/installations/work" },
      { label: "ກຳລັງຕິດຕັ້ງ", href: "/installations/work/doing", count: "/installations/work/doing" },
      { label: "ສົ່ງຄືນອາໄຫຼ່", href: "/stock/returns?job=install" },
      { label: "ກວດຮັບຄຸນນະພາບ", href: "/qc?workflow=install", flag: "qc", count: "/qc/install" },
    ],
  },
  {
    id: "tech_income_menu",
    label: "ລາຍຮັບຂອງຂ້ອຍ",
    icon: FileBarChart,
    items: [{ label: "ຄ່າຄອມຂອງຂ້ອຍ", href: "/reports/technician-income" }],
  },
];

/**
 * ເມນູຂອງ role ນີ້ — ກັ່ນຕອງດ້ວຍ canAccess() ຂອງ lib/roles ໂດຍກົງ
 * ຈຶ່ງບໍ່ມີວັນຫຼົ້ນກັນລະຫວ່າງ "ເມນູທີ່ເຫັນ" ກັບ "ໜ້າທີ່ເຂົ້າໄດ້"
 * (ຖ້າແຍກ 2 ຕາຕະລາງ ມື້ໜຶ່ງມັນຈະບໍ່ຕົງກັນແນ່ນອນ).
 * ກຸ່ມທີ່ບໍ່ເຫຼືອລາຍການໃດ = ຫາຍໄປທັງກຸ່ມ.
 */
/** ສິດທີ່ຜູ້ຈັດການກຳນົດຢູ່ຖານຂໍ້ມູນ — layout ຄິດໃຫ້ ແລ້ວສົ່ງລົງມາເຖິງເມນູ */
export type NavFlags = { qc?: boolean };

export function navigationFor(role: Role, flags: NavFlags = {}, readable?: readonly string[]): NavGroup[] {
  const allowed = readable ? new Set(readable) : null;
  const source = role === "technical" ? TECHNICIAN_NAVIGATION : navigation;
  return source
    .map((group) => ({
      ...group,
      items: group.items.filter(
        (item) => {
          const path = pathOf(item.href);
          const resource = resourceForPath(path) ?? path;
          const canRead = allowed ? allowed.has(resource) : canAccess(role, path);
          return canRead && (item.flag !== "qc" || flags.qc === true);
        },
      ),
    }))
    .filter((group) => group.items.length > 0);
}

/**
 * ເສັ້ນທາງລ້ວນຂອງລິ້ງ — ຕັດ query ອອກ (`/stock/returns?job=install` → `/stock/returns`).
 * canAccess ແຍກເສັ້ນທາງເປັນ segment ⇒ ຖ້າສົ່ງ query ຕິດໄປນຳ segment ສຸດທ້າຍຈະກາຍເປັນ
 * "returns?job=install" ເຊິ່ງບໍ່ຕົງກັບກົດໃດເລີຍ ແລ້ວ **ເມນູນັ້ນຫາຍໄປທັງລາຍການ** ຢ່າງງຽບໆ.
 */
function pathOf(href: string) {
  return href.split("?")[0];
}
