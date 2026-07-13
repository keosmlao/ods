import { canAccess, type Role } from "@/lib/roles";
import {
  BadgeCheck,
  Boxes,
  ClipboardCheck,
  FileBarChart,
  HardHat,
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

/* ── ສາຍງານສ້ອມແປງ ─────────────────────────────────────────────── */
const REPAIR: NavGroup = {
  id: "repair_menu",
  label: "ສ້ອມແປງ",
  icon: Wrench,
  items: [
    { label: "ຮັບເຄື່ອງສ້ອມ", href: "/service" },
    { label: "ກວດເຊັກ", href: "/checking" },
    { label: "ໃບສະເໜີລາຄາ", href: "/quotations" },
    { label: "ລູກຄ້າອະນຸມັດ(ສະເໜີລາຄາ)", href: "/quotations/customer-approval" },
    { label: "ໃບຂໍເບີກອາໄຫຼ່", href: "/stock/requests", divider: true },
    { label: "ຮັບອາໄຫຼ່", href: "/stock/requests/pickup" },
    { label: "ໃບຂໍສົ່ງຄືນອາໄຫຼ່", href: "/stock/returns" },
    { label: "ສ້ອມແປງ", href: "/repair" },
    { label: "ໃບສົ່ງເຄື່ອງ/ໃບຮັບເງິນ", href: "/returns", divider: true },
    { label: "ຕິດຕາມສະຖານະ", href: "/dashboard/tracking" },
    { label: "ກິດຈະກຳຂອງຂ້ອຍ", href: "/activities" },
    { label: "ການແຈ້ງເຕືອນ", href: "/notifications" },
  ],
};

/* ── ສາຍງານຕິດຕັ້ງ ─────────────────────────────────────────────── */
const INSTALL: NavGroup = {
  id: "install_menu",
  label: "ຕິດຕັ້ງ",
  icon: HardHat,
  items: [
    { label: "ງານຕິດຕັ້ງ", href: "/installations" },
    { label: "ມອບໝາຍງານ", href: "/installations/assign" },
    { label: "ຮັບງານຕິດຕັ້ງ", href: "/installations/accept" },
    { label: "ໃບຂໍເບີກ(ຕິດຕັ້ງ)", href: "/installations/spare-requests", divider: true },
    { label: "ເບີກອາໄຫຼ່(ຕິດຕັ້ງ)", href: "/installations/dispatch" },
    { label: "ຮັບອາໄຫຼ່(ຕິດຕັ້ງ)", href: "/installations/spare-pickup" },
    /**
     * ສົ່ງອາໄຫຼ່ຄືນສາງ — ໜ້າ /stock/returns ຮັບໃຊ້ **ທັງສອງສາຍງານ** (ມີຕົວກອງ job=install)
     * ແຕ່ເມື່ອກ່ອນມີລິ້ງຢູ່ໃນເມນູ "ສ້ອມແປງ" ບ່ອນດຽວ ⇒ ຄົນເຮັດງານຕິດຕັ້ງບໍ່ຮູ້ວ່າມີ
     * ແລະ ຕະຫຼອດ 3 ປີບໍ່ເຄີຍມີໃບສົ່ງຄືນຂອງງານ INST- ຈັກໃບ ທັງທີ່ມີອາໄຫຼ່ຄ້າງນອກສາງຢູ່.
     */
    { label: "ສົ່ງຄືນອາໄຫຼ່(ຕິດຕັ້ງ)", href: "/stock/returns?job=install" },
    { label: "ຕິດຕັ້ງ", href: "/installations/work", divider: true },
    { label: "ປິດງານ", href: "/installations/close" },
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
    { label: "ເບີກອາໄຫຼ່", href: "/stock/dispatch" },
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
    { label: "ອະນຸມັດໃບສະເໜີລາຄາ", href: "/approvals/quotations" },
    { label: "ອະນຸມັດຍົກເລີກເຄື່ອງສ້ອມ", href: "/approvals/cancellations" },
    { label: "ອະນຸມັດຂໍສັ່ງຊື່", href: "/approvals/purchase-requests" },
  ],
};

/* ── ຄຸນນະພາບ (QC) — ດ່ານກ່ອນສົ່ງມອບລູກຄ້າ ─────────────────────
 * ໃຊ້ຮ່ວມກັນທັງສ້ອມແປງ ແລະ ຕິດຕັ້ງ ⇒ ຢູ່ກຸ່ມຂອງຕົນເອງ ບໍ່ຢູ່ໃນສາຍງານໃດສາຍງານນຶ່ງ.
 */
const QUALITY: NavGroup = {
  id: "qc_menu",
  label: "ຄຸນນະພາບ",
  icon: BadgeCheck,
  items: [
    { label: "ຄິວກວດຮັບຄຸນນະພາບ", href: "/qc", flag: "qc" },
    { label: "ຄິວແຈ້ງລູກຄ້າ", href: "/customer-contact" },
    { label: "ຕັ້ງລາຍການກວດຮັບ", href: "/manage/qc-checklist" },
  ],
};

const REPORT: NavGroup = {
  id: "report_menu",
  label: "ລາຍງານ",
  icon: FileBarChart,
  items: [
    { label: "ໜ້າລວມລາຍງານ", href: "/reports" },
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
    { label: "ຄ່າບໍລິການ / ຄ່າຄອມຊ່າງ", href: "/manage/service-rates" },
    { label: "ເຊື່ອມຕົວຕົນຊ່າງ", href: "/manage/technicians" },
  ],
};

/** ເມນູທັງໝົດ (ກ່ອນກັ່ນຕອງສິດ) */
export const navigation: NavGroup[] = [REPAIR, INSTALL, STOCK, QUALITY, APPROVE, REPORT, USERS];

/**
 * ເມນູຂອງ role ນີ້ — ກັ່ນຕອງດ້ວຍ canAccess() ຂອງ lib/roles ໂດຍກົງ
 * ຈຶ່ງບໍ່ມີວັນຫຼົ້ນກັນລະຫວ່າງ "ເມນູທີ່ເຫັນ" ກັບ "ໜ້າທີ່ເຂົ້າໄດ້"
 * (ຖ້າແຍກ 2 ຕາຕະລາງ ມື້ໜຶ່ງມັນຈະບໍ່ຕົງກັນແນ່ນອນ).
 * ກຸ່ມທີ່ບໍ່ເຫຼືອລາຍການໃດ = ຫາຍໄປທັງກຸ່ມ.
 */
/** ສິດທີ່ຜູ້ຈັດການກຳນົດຢູ່ຖານຂໍ້ມູນ — layout ຄິດໃຫ້ ແລ້ວສົ່ງລົງມາເຖິງເມນູ */
export type NavFlags = { qc?: boolean };

export function navigationFor(role: Role, flags: NavFlags = {}): NavGroup[] {
  return navigation
    .map((group) => ({
      ...group,
      items: group.items.filter(
        (item) => canAccess(role, pathOf(item.href)) && (item.flag !== "qc" || flags.qc === true),
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
