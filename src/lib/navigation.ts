import { canAccess, type Role } from "@/lib/roles";
import {
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
    { label: "ງານທັງໝົດ", href: "/installations/all" },
    { label: "ມອບໝາຍງານ", href: "/installations/assign" },
    { label: "ຮັບງານຕິດຕັ້ງ", href: "/installations/accept" },
    { label: "ໃບຂໍເບີກ(ຕິດຕັ້ງ)", href: "/installations/spare-requests", divider: true },
    { label: "ເບີກອາໄຫຼ່(ຕິດຕັ້ງ)", href: "/installations/dispatch" },
    { label: "ຮັບອາໄຫຼ່(ຕິດຕັ້ງ)", href: "/installations/spare-pickup" },
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
  items: [{ label: "ກຳນົດສິດ", href: "/manage/employees" }],
};

/** ເມນູທັງໝົດ (ກ່ອນກັ່ນຕອງສິດ) */
export const navigation: NavGroup[] = [REPAIR, INSTALL, STOCK, APPROVE, REPORT, USERS];

/**
 * ເມນູຂອງ role ນີ້ — ກັ່ນຕອງດ້ວຍ canAccess() ຂອງ lib/roles ໂດຍກົງ
 * ຈຶ່ງບໍ່ມີວັນຫຼົ້ນກັນລະຫວ່າງ "ເມນູທີ່ເຫັນ" ກັບ "ໜ້າທີ່ເຂົ້າໄດ້"
 * (ຖ້າແຍກ 2 ຕາຕະລາງ ມື້ໜຶ່ງມັນຈະບໍ່ຕົງກັນແນ່ນອນ).
 * ກຸ່ມທີ່ບໍ່ເຫຼືອລາຍການໃດ = ຫາຍໄປທັງກຸ່ມ.
 */
export function navigationFor(role: Role): NavGroup[] {
  return navigation
    .map((group) => ({ ...group, items: group.items.filter((item) => canAccess(role, item.href)) }))
    .filter((group) => group.items.length > 0);
}
