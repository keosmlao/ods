import { canAccess, type Role } from "@/lib/roles";
import { resourceForPath } from "@/lib/permission-catalog";
import {
  BadgeCheck,
  Boxes,
  ClipboardCheck,
  FileBarChart,
  HardHat,
  LayoutDashboard,
  type LucideIcon,
  ShieldCheck,
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
    /**
     * ຄິວງານປະຈຳວັນ = "ມື້ນີ້ຂ້ອຍ/ຊ່າງຂ້ອຍຕ້ອງໄປໃສແດ່" — ເປັນເລື່ອງ **ຂອງມື້ນີ້**
     * ບໍ່ແມ່ນເລື່ອງ "ຂັ້ນຕອນຂອງໂມດູນຕິດຕັ້ງ" ແລະ ດຽວນີ້ມັນລວມງານ **ສ້ອມ** ນຳແລ້ວ
     * ⇒ ຢູ່ໃຕ້ກຸ່ມ "ຕິດຕັ້ງ" ບໍ່ຖືກຕໍ່ໄປ. ຊ່າງເປີດອັນນີ້ທຸກເຊົ້າ ⇒ ຂຶ້ນມາຢູ່ "ຂອງຂ້ອຍ".
     */
    { label: "ຄິວງານປະຈຳວັນ", href: "/installations/schedule" },
    { label: "ກິດຈະກຳຂອງຂ້ອຍ", href: "/activities" },
    { label: "ການແຈ້ງເຕືອນ", href: "/notifications" },
  ],
};

/* ── ສາຍງານສ້ອມແປງ ─────────────────────────────────────────────── */
const REPAIR: NavGroup = {
  id: "repair_menu",
  label: "ສ້ອມແປງ",
  icon: Wrench,
  items: [
    { label: "ຮັບເຄື່ອງສ້ອມ", href: "/service" },
    { label: "ກວດເຊັກ", href: "/checking", count: "/checking" },
    { label: "ໃບສະເໜີລາຄາ", href: "/quotations" },
    { label: "ລູກຄ້າອະນຸມັດ(ສະເໜີລາຄາ)", href: "/quotations/customer-approval", count: "/quotations/customer-approval" },
    { label: "ໃບຂໍເບີກອາໄຫຼ່", href: "/stock/requests", divider: true },
    { label: "ຮັບອາໄຫຼ່", href: "/stock/requests/pickup" },
    { label: "ສົ່ງຄືນອາໄຫຼ່(ສ້ອມແປງ)", href: "/stock/returns?job=repair" },
    { label: "ສ້ອມແປງ", href: "/repair", count: "/repair" },
    /**
     * ── QC ເປັນ **ຂັ້ນຕອນ** ຂອງສາຍງານ ບໍ່ແມ່ນເມນູແຍກ (13-07-2026) ──
     * ດ່ານນີ້ບັງຄັບຢູ່ server ແລ້ວ (ສົ່ງຄືນ/ຮັບເງິນບໍ່ໄດ້ຖ້າ qc_finish ຫວ່າງ —
     * actions/return) ແຕ່ລິ້ງມີແຕ່ຢູ່ກຸ່ມ "ຄຸນນະພາບ" ⇒ ຄົນເຮັດງານສ້ອມບໍ່ເຫັນວ່າ
     * ຕ້ອງຜ່ານມັນ ແລ້ວງານຄ້າງຢູ່ຂັ້ນ "ລໍກວດຮັບຄຸນນະພາບ" ໂດຍບໍ່ຮູ້ຕົວ (ຂໍ້ມູນຈິງ: 16 ໃບ).
     */
    { label: "ກວດຮັບຄຸນນະພາບ", href: "/qc?workflow=repair", flag: "qc", count: "/qc" },
    /**
     * ຄິວແຈ້ງລູກຄ້າ — ງານທີ່ຢຸດຢູ່ຈົນກວ່າຈະມີຄົນໂທບອກລູກຄ້າວ່າ "ເຄື່ອງແລ້ວ, ມາຮັບໄດ້"
     * ⇒ ມັນຄື **ຂັ້ນຕອນລະຫວ່າງ QC ກັບ ໃບສົ່ງເຄື່ອງ** ບໍ່ແມ່ນເລື່ອງ "ຄຸນນະພາບ"
     * (ຢູ່ກຸ່ມ "ຄຸນນະພາບ" ຄົນເຮັດງານສ້ອມຫາບໍ່ພົບ).
     */
    { label: "ຄິວແຈ້ງລູກຄ້າ", href: "/customer-contact" },
    { label: "ໃບສົ່ງເຄື່ອງ/ໃບຮັບເງິນ", href: "/returns", count: "/returns", divider: true },
    { label: "ຕິດຕາມສະຖານະ", href: "/dashboard/tracking" },
  ],
};

/* ── ສາຍງານຕິດຕັ້ງ ─────────────────────────────────────────────── */
const INSTALL: NavGroup = {
  id: "install_menu",
  label: "ຕິດຕັ້ງ",
  icon: HardHat,
  items: [
    /**
     * ── ຂັ້ນທຳອິດຂອງສາຍງານ = **ບິນທີ່ຍັງບໍ່ມີໃບງານ** ──
     * ງານຕິດຕັ້ງເລີ່ມຈາກ "ລູກຄ້າຈ່າຍຄ່າຕິດຕັ້ງໃນບິນ" ບໍ່ແມ່ນຈາກ "ໃບງານ" ⇒ ບິນທີ່ລືມເປີດ
     * ຕ້ອງເຫັນ **ກ່ອນ** ລາຍການງານ (ຂໍ້ມູນຈິງ: 232 ໜ່ວຍຄ້າງ · ບິນເກົ່າສຸດ 120 ມື້).
     */
    { label: "ບິນຄ້າງອອກໃບງານ", href: "/installations/pending-bills" },
    { label: "ງານຕິດຕັ້ງ", href: "/installations" },
    { label: "ມອບໝາຍງານ", href: "/installations/assign", count: "/installations/assign" },
    { label: "ຮັບງານຕິດຕັ້ງ", href: "/installations/accept", count: "/installations/accept" },
    { label: "ໃບຂໍເບີກ(ຕິດຕັ້ງ)", href: "/installations/spare-requests", divider: true },
    /**
     * "ເບີກອາໄຫຼ່" **ຖອດອອກແລ້ວ** (13-07-2026) — ລະບົບນີ້ອອກໃບເບີກເອງບໍ່ໄດ້ອີກ,
     * ສາງເບີກຢູ່ **ERP** ແລ້ວ ODS ດຶງກັບມາເອງ (lib/erp-dispatch ແລ່ນຕອນເປີດ
     * ໜ້າ "ໃບຂໍເບີກ" ແລະ "ຮັບອາໄຫຼ່"). ເມນູທີ່ພາໄປໜ້າທີ່ກົດຫຍັງບໍ່ໄດ້ = ຫຼອກຄົນ.
     */
    { label: "ຮັບອາໄຫຼ່(ຕິດຕັ້ງ)", href: "/installations/spare-pickup" },
    /**
     * ໜ້າດຽວກັນໃຊ້ query scope ຄົນລະຄ່າ: job=install ແລະ job=repair.
     * ຕ້ອງຮັກສາ scope ນີ້ຂ້າມທຸກແທັບ ເພື່ອບໍ່ໃຫ້ໃບຂອງສອງສາຍງານປົນກັນ.
     */
    { label: "ສົ່ງຄືນອາໄຫຼ່(ຕິດຕັ້ງ)", href: "/stock/returns?job=install" },
    { label: "ຕິດຕັ້ງ", href: "/installations/work", count: "/installations/work", divider: true },
    /**
     * QC ຂອງ **ສາຍງານຕິດຕັ້ງ** — ໜ້າດຽວກັນແຕ່ກອງດ້ວຍ ?workflow ⇒ ເຂົ້າຈາກເມນູຕິດຕັ້ງ
     * ເຫັນສະເພາະງານຕິດຕັ້ງ (ແລະ ເມນູ active ອັນດຽວ ບໍ່ແມ່ນສະຫວ່າງທັງສອງກຸ່ມ).
     */
    { label: "ກວດຮັບຄຸນນະພາບ", href: "/qc?workflow=install", flag: "qc", count: "/qc" },
    { label: "ປິດງານ", href: "/installations/close", count: "/installations/close" },
    { label: "ລາຍງານງານຕິດຕັ້ງ", href: "/reports/installations", divider: true },
    { label: "ລາຍງານແບບສອບຖາມລູກຄ້າ", href: "/reports/customer-feedback" },
  ],
};

/* ── ສາງ ແລະ ອາໄຫຼ່ (ໃຊ້ຮ່ວມກັນທັງສອງສາຍງານ) ──────────────────── */
const STOCK: NavGroup = {
  id: "stock_menu",
  label: "ສາງ ແລະ ອາໄຫຼ່",
  icon: Boxes,
  items: [
    { label: "ຮັບອາໄຫຼ່ທີ່ສັ່ງຊື້", href: "/stock/arrivals" },
    { label: "ຕິດຕາມການໂອນອາໄຫຼ່", href: "/stock/transfers" },
    { label: "ລາຍການສົ່ງ​ຄືນອາໄຫຼ່", href: "/stock/receive-returns" },
    { label: "ລາຍການອາໄຫຼ່", href: "/stock/spare-parts", divider: true },
    { label: "ສິນຄ້າສ້ອມແປງ", href: "/stock/products" },
    { label: "ສ້າງອາໄຫຼ່", href: "/spare-parts/new" },
    { label: "ຂໍສັ່ງຊື່", href: "/purchase-requests" },
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
  ],
};

/** ເມນູທັງໝົດ (ກ່ອນກັ່ນຕອງສິດ) */
/**
 * ── ກຸ່ມ "ຄຸນນະພາບ" **ຖອດອອກແລ້ວ** (13-07-2026) ──
 * ມັນເປັນກຸ່ມທີ່ຈັດຕາມ "ຫົວຂໍ້" ບໍ່ແມ່ນຕາມ **ລຳດັບການເຮັດວຽກ** ⇒ ຂັ້ນຕອນທີ່ຕ້ອງຜ່ານຈິງ
 * (QC · ແຈ້ງລູກຄ້າ) ໄປລີ້ຢູ່ນັ້ນ ແລ້ວຄົນເຮັດງານຫາບໍ່ພົບ. ດຽວນີ້:
 *   ກວດຮັບຄຸນນະພາບ → ຢູ່ໃນລຳດັບຂອງ **ທັງສອງສາຍງານ** (ສ້ອມ · ຕິດຕັ້ງ)
 *   ຄິວແຈ້ງລູກຄ້າ  → ຢູ່ໃນສາຍງານ **ສ້ອມ** (ລະຫວ່າງ QC ກັບ ໃບສົ່ງເຄື່ອງ)
 *   ຕັ້ງລາຍການກວດຮັບ → ຢູ່ກຸ່ມ **ຜູ້ໃຊ້/ຕັ້ງຄ່າ** (ເປັນການຕັ້ງຄ່າ ບໍ່ແມ່ນຄິວງານ)
 */
export const navigation: NavGroup[] = [HOME, REPAIR, INSTALL, STOCK, APPROVE, REPORT, USERS];

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
  return navigation
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
