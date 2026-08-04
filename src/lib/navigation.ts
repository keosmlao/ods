import { canAccess, type Role } from "@/lib/roles";
import { resourceForPath } from "@/lib/permission-catalog";
import { claimStatuses, pipelineOf, repairStatuses } from "@/lib/dashboard-status";
import { MAINTENANCE_STATUSES } from "@/lib/maintenance-stage";
import {
  Boxes,
  ClipboardCheck,
  FileBarChart,
  HardHat,
  LayoutDashboard,
  type LucideIcon,
  ReceiptText,
  ShieldCheck,
  ShoppingCart,
  SprayCan,
  Wallet,
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
  /**
   * key ໃນ dictionary.nav ສຳລັບແປປ້າຍລາຍການ (i18n). ບໍ່ໃສ່ = ໃຊ້ href ເປັນ key.
   * ໃສ່ເມື່ອ href ດຽວກັນປາກົດຫຼາຍບ່ອນດ້ວຍປ້າຍຕ່າງກັນ (ຝັ່ງ CS ທຽບ ຝັ່ງຊ່າງ)
   * ⇒ ໃຫ້ແຕ່ລະບ່ອນມີ key ຂອງຕົນ ບໍ່ໃຫ້ທັບກັນ.
   */
  labelKey?: string;
};

export type NavGroup = { id: string; label: string; icon: LucideIcon; items: NavItem[] };

/**
 * id ກຸ່ມ → key ໃນ dictionary.nav — ໃຫ້ sidebar ແປ**ປ້າຍກຸ່ມ**ຕາມພາສາ (i18n phase 1).
 * ປ້າຍລາຍການ (item) + ໜ້າ ຍັງເປັນ phase ຕໍ່ໄປ.
 */
export const NAV_GROUP_KEY: Record<string, string> = {
  home_menu: "myStuff",
  repair_menu: "repair",
  install_menu: "install",
  maintenance_menu: "maintenance",
  stock_menu: "stock",
  claim_menu: "claim",
  purchase_menu: "purchase",
  approve_menu: "approve",
  report_menu: "reports",
  user_menu: "users",
  tech_home_menu: "myStuff",
  tech_repair_menu: "myRepair",
  tech_install_menu: "myInstall",
  tech_income_menu: "myIncome",
};

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
    // ຜູ້ຈັດການເທົ່ານັ້ນທີ່ເຫັນ (RULES ຈຳກັດ [M]) — navigationFor ກອງດ້ວຍສິດຢູ່ແລ້ວ
    { label: "ພາບລວມຜູ້ຈັດການ", href: "/overview" },
    { label: "ໜ້າລວມ", href: "/dashboard" },
    /**
     * ວຽກຊ່າງ ຕາມຂັ້ນ — ໜ້າດຽວກັບຝັ່ງຊ່າງ ແຕ່ **ເລືອກຊ່າງໄດ້** (ຫວ່າງ = ທຸກຊ່າງ).
     * ຢູ່ນີ້ ບໍ່ແມ່ນກຸ່ມ "ສ້ອມແປງ" ເພາະມັນລວມທັງ ສ້ອມ · ຕິດຕັ້ງ · ສ້ອມບຳລຸງ ຂອງຄົນດຽວ.
     */
    { label: "ວຽກຊ່າງ ຕາມຂັ້ນ", href: "/my-jobs", labelKey: "mgr:my-jobs" },
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
     * ປິດງານ — **ຂ້າມສາຍງານ** ຄືກັບ 2 ລາຍການຂ້າງເທິງ: ວຽກຫຼັງບ້ານອັນດຽວກັນ
     * (ກວດເອກະສານຄົບ → ປິດ) ຂອງທັງສ້ອມ ແລະ ຕິດຕັ້ງ ⇒ ຢູ່ກຸ່ມໃດກຸ່ມໜຶ່ງບໍ່ຄົບຄວາມ.
     */
    { label: "ປິດງານ (ສ້ອມ · ຕິດຕັ້ງ)", href: "/close-jobs", count: "/close-jobs" },
    /**
     * ⚠️ "ສົນທະນາ" **ບໍ່ຢູ່ໃນເມນູແລ້ວ** (17-07-2026) — ເປັນ**ປຸ່ມລອຍ**ມູມຂວາລຸ່ມ
     * (components/chat/floating-chat) ເຫັນທຸກໜ້າ. ການລົມກັນເກີດຂຶ້ນ**ໃນຂະນະທີ່**
     * ກຳລັງເຮັດວຽກຢູ່ໜ້າອື່ນ — ບັງຄັບໃຫ້ອອກຈາກໜ້າວຽກໄປໜ້າແຊັດ ຄືເຮັດວຽກຂາດຕອນ.
     */
    { label: "ແຜนที่ຕິດຕາມงาน (map)", href: "/map" },
    { label: "ກິດຈະກຳຂອງຂ້ອຍ", href: "/activities" },
    { label: "ການແຈ້ງເຕືອນ", href: "/notifications" },
    { label: "ຄູ່ມືການໃຊ້ງານ", href: "/manual" },
    // ຊ່າງຕິດຕັ້ງແອັບເອງໄດ້ ບໍ່ຕ້ອງສົ່ງ APK ຜ່ານແຊັດ
    { label: "ດາວໂຫຼດແອັບຊ່າງ", href: "/download" },
  ],
};

/* ── ສາຍງານສ້ອມແປງ — ລຽງຕາມຂັ້ນຕອນ (ຮັບງານ + ລໍກວດ ເປັນຂັ້ນດຽວ) ── */
const REPAIR: NavGroup = {
  id: "repair_menu",
  label: "ສ້ອມແປງ",
  icon: Wrench,
  items: [
    /**
     * ສູນວຽກງານສ້ອມ — ທາງເຂົ້າຫຼັກຂອງສາຍສ້ອມ (03-08-2026): ວຽກຄ້າງທັງໝົດຈັດກຸ່ມຕາມ
     * "ຜູ້ເຮັດຕໍ່" (CS · ຊ່າງ · ສາງ · ຈັດຊື້ · QC) ແທນການເປີດຄິວທີລະຂັ້ນ. ບໍ່ໃສ່ເລກ —
     * ມັນບໍ່ແມ່ນຂັ້ນນຶ່ງໃນ pipeline; ຄິວຕາມຂັ້ນ (ມີເລກລຽງ) ຍັງຄົບຢູ່ລຸ່ມມັນເປັນມຸມມອງຜູ້ຈັດການ.
     */
    ...[
      { label: "ຮັບສິນຄ້າສ້ອມປະຈຳວັນ", href: "/service", match: ["/quotations", "/returns", "/qc/repair"], divider: true },
      /**
       * ── ຂັ້ນອາໄຫຼ່ = **ລາຍການດຽວ** (04-08-2026) ──
       * ແຕ່ກ່ອນແຍກເປັນ 3 ຄິວຕາມຂັ້ນ (5 ກວດ Stock · 6 ກຳລັງເບີກ · 7 ກຳລັງສັ່ງຊື້) ບວກກັບ
       * ໜ້າສາງເບີກ · ໜ້າຮັບອາໄຫຼ່ · ໜ້າໃບຂໍຊື້ ⇒ ເລື່ອງອາໄຫຼ່ຂອງໃບງານດຽວກະຈາຍ 6 ບ່ອນ
       * ແລະ ຄົນຕ້ອງຈື່ວ່າຂັ້ນໃດຢູ່ໜ້າໃດ. ດຽວນີ້ລວມເປັນຂັ້ນດຽວ ຈັດຕາມ "ໃຜຕ້ອງລົງມືຕໍ່"
       * (ໜ້າ /work/spares). ຄິວຕາມຂັ້ນເກົ່າຍັງເປີດໄດ້ດ້ວຍ URL ແຕ່ບໍ່ຢູ່ໃນເມນູອີກ.
       */
      ...pipelineOf(repairStatuses).flatMap(([slug, def]) => {
        if (slug === "wait-withdraw") {
          return [{ label: "ອາໄຫຼ່ — ຂໍເບີກ · ສາງເບີກ · ຮັບ · ສັ່ງຊື້", href: "/work/spares", count: "/work/spares" }];
        }
        if (slug === "withdrawing" || slug === "purchasing") return [];
        return [{
          label: def.label,
          href: `/work/repair/${slug}`,
          count: `/work/repair/${slug}`,
          // labelKey ແຍກ (ບໍ່ໃຊ້ href) — ຂັ້ນ pipeline ໃຊ້ href ດຽວກັບເມນູຝັ່ງຊ່າງ ແຕ່ປ້າຍຕ່າງກັນ
          labelKey: `pipe:repair:${slug}`,
        }];
      }),
      // ຂັ້ນ 12 (ສົ່ງຄືນສຳເລັດ) = ປາຍທາງຂອງສາຍງານ ⇒ **ທ້າຍສຸດ**.
      // pipelineOf ຢຸດທີ່ຂັ້ນ 11 (ລໍຖ້າສົ່ງຄືນ) ຈຶ່ງບໍ່ຊ້ຳກັນ.
      { label: "ລາຍການສົ່ງຄືນສຳເລັດ", href: "/returns/completed" },
      // ເຄື່ອງສູນທີ່ຢູ່ນຳລູກຄ້າ — ບໍ່ຕັດສະຕັອກ ⇒ ບໍ່ມີໜ້ານີ້ = ບໍ່ມີບ່ອນຮູ້ວ່າໜ່ວຍໃດຢູ່ໃສ
      // ໂອນຂ້າມສູນ (ຂົວຫຼວງ ↔ ດອນຕີ້ວ) — ປາຍທາງຕ້ອງກົດຮັບ ບໍ່ດັ່ງນັ້ນເຄື່ອງລອຍລະຫວ່າງທາງ
      { label: "ລໍຮັບໂອນເຄື່ອງ", href: "/service/transfers", count: "/service/transfers" },
      { label: "ເຄື່ອງສຳຮອງຄ້າງຄືນ", href: "/service/loaners", count: "/service/loaners" },
    ].map((item, index) => ({ ...item, label: `${index + 1}. ${item.label}` })),
  ],
};

/* ── ສາຍງານຕິດຕັ້ງ ─────────────────────────────────────────────── */

/**
 * ຂັ້ນຕອນຂອງງານຕິດຕັ້ງ — **ໃສ່ເລກລຽງ** ຄືເມນູສ້ອມແປງ (17-07-2026): ຄົນເປີດເມນູ
 * ແລ້ວຮູ້ທັນທີວ່າງານໄຫຼຈາກໃສໄປໃສ ບໍ່ຕ້ອງເດົາຈາກລຳດັບບັນທັດ.
 * ⚠️ ໃສ່ເລກສະເພາະ**ຂັ້ນເຮັດວຽກ** — ລາຍງານຢູ່ທ້າຍບໍ່ແມ່ນຂັ້ນຕອນ ຈຶ່ງບໍ່ມີເລກ.
 */
const INSTALL_FLOW: NavItem[] = [
  /**
   * **ກ່ອນ**ເປີດງານ — ບິນທີ່ລູກຄ້າຈ່າຍຄ່າຕິດຕັ້ງແລ້ວ ແຕ່ຍັງບໍ່ມີໃບງານ.
   * ນີ້ຄືຂັ້ນທຳອິດຂອງສາຍງານຈິງ (ຢູ່ໃນກຸ່ມ "ລາຍງານ" ທ້າຍເມນູມາກ່ອນ ⇒ CS ບໍ່ທັນເຫັນ
   * ຈົນກວ່າຈະເລື່ອນລົງສຸດ ທັງທີ່ມັນຄືວຽກທີ່ຕ້ອງເຮັດກ່ອນທຸກຢ່າງ).
   */
  { label: "ບິນຄ້າງອອກໃບງານ", href: "/installations/pending-bills", count: "/installations/pending-bills" },
  { label: "ເປີດງານ / ລໍຖ້າຈັດຊ່າງ", href: "/installations", count: "/installations/assign" },
  { label: "ລໍຖ້າຊ່າງຮັບ", href: "/installations/accept", count: "/installations/accept" },
  { label: "ລໍຖ້າເບີກອາໄຫຼ່", href: "/installations/spare-requests", count: "/installations/spare-requests" },
  { label: "ລໍຖ້າຮັບອາໄຫຼ່ຈາກການເບີກ", href: "/installations/spare-pickup", count: "/installations/spare-pickup" },
  { label: "ລໍຖ້າຕິດຕັ້ງ", href: "/installations/work", count: "/installations/work" },
  { label: "ກຳລັງຕິດຕັ້ງ", href: "/installations/work/doing", count: "/installations/work/doing" },
  { label: "ລໍຖ້າກວດ QC", href: "/qc?workflow=install", flag: "qc", count: "/qc/install" },
  { label: "ລໍຖ້າລູກຄ້າປະເມີນ", href: "/installations/feedback", count: "/work/install/wait-feedback" },
  { label: "ລໍຖ້າປິດງານ", href: "/installations/close", count: "/installations/close" },
];

/** ລາຍງານຂອງສາຍງານຕິດຕັ້ງ — ບໍ່ແມ່ນຂັ້ນຕອນ ຈຶ່ງບໍ່ໃສ່ເລກ */
const INSTALL_REPORTS: NavItem[] = [
  { label: "ສົ່ງຄືນອາໄຫຼ່ງານຕິດຕັ້ງ", href: "/stock/returns?job=install", divider: true },
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

/* ── ບຳລຸງຮັກສາ (ລ້າງແອ/ລ້າງເຄື່ອງ) — ລະບົບແຍກ, ໄປລ້າງໜ້າງານເປັນຫຼັກ ── */
const MAINTENANCE: NavGroup = {
  id: "maintenance_menu",
  label: "ບຳລຸງຮັກສາ",
  icon: SprayCan,
  items: [
    { label: "ງານທັງໝົດ", href: "/maintenance", count: "/maintenance" },
    { label: "ເປີດງານໃໝ່", href: "/maintenance/new" },
    // ຄິວຕໍ່ຂັ້ນ — ໃສ່ເລກລຽງຄືເມນູສ້ອມ/ຕິດຕັ້ງ (ຮູ້ທັນທີວ່າງານໄຫຼຈາກໃສໄປໃສ)
    ...MAINTENANCE_STATUSES.map((s, index) => ({
      label: `${index + 1}. ${s.label}`,
      href: `/maintenance/status/${s.slug}`,
      count: `/maintenance/status/${s.slug}`,
    })),
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
    { label: "ເບີກອາໄຫຼ່", href: "/stock/dispatch" },
    { label: "ຮັບຄືນອາໄຫຼ່ຈາກການເບີກ", href: "/stock/receive-returns" },
    // ອາໄຫຼ່ທີ່ເບີກອອກໄປແລ້ວ ແຕ່ວຽກຍົກເລີກ — ຕ້ອງເກັບຄືນ (ຍ້າຍມາຈາກໜ້າອະນຸມັດ 17-07-2026)
    { label: "ອາໄຫຼ່ຄ້າງນອກສາງ", href: "/stock/spare-recovery", count: "/stock/spare-recovery" },
    { label: "ຕິດຕາມສິນຄ້າຄົງເຫຼືອ", href: "/stock/balance" },
    { label: "ຄົງເຫຼືອ ສາງສ້ອມ (ສູນບໍລິການ)", href: "/stock/balance/repair" },
    { label: "ລາຍການອາໄຫຼ່", href: "/stock/spare-parts", divider: true },
    { label: "ສິນຄ້າສ້ອມແປງ", href: "/stock/products" },
    { label: "ສ້າງອາໄຫຼ່", href: "/spare-parts/new" },
    // ກວດນັບສະຕ໋ອກເຄື່ອງສ້ອມ — ຍ້າຍມາຈາກເມນູສ້ອມ (ຫົວໜ້າ/ຜູ້ອະນຸມັດເຫັນ — RULES: /service/stock-count)
    { label: "ກວດນັບສະຕ໋ອກເຄື່ອງສ້ອມ", href: "/service/stock-count", divider: true },
  ],
};

/* ── ເຄມ (Claim) — ແຍກອອກຈາກສາງ, ເປັນສາຍວຽກຂອງຕົນເອງ ──────────── */
const CLAIM: NavGroup = {
  id: "claim_menu",
  label: "ເຄມ (Claim)",
  icon: ReceiptText,
  // ແຍກ 3 ໜ້າ ຕາມຂັ້ນຕອນ: ① ຮ້ານ→ສູນ (ໃບແມ່) → ② ຂໍອາໄຫຼ່ supplier → ③ ເກັບຄ່າສ້ອມ
  items: [
    /**
     * ── ວຽກປະຈຳວັນຂອງເຄມ (ແຍກຄົນລະເມນູກັບສ້ອມ 31-07-2026) ──
     * ແຕ່ກ່ອນຕ້ອງໄປ "ຮັບສິນຄ້າສ້ອມປະຈຳວັນ" ແລ້ວສະຫຼັບແທັບ ⇒ ປົນກັນ.
     * ດຽວນີ້ 2 ລາຍການທຳອິດຄື **ຮັບເຄື່ອງ** ແລະ **ລາຍການປະຈຳວັນ** ຂອງເຄມເອງ.
     */
    { label: "ຮັບເຄື່ອງເຄມ (ຈາກຮ້ານ)", href: "/claims/new" },
    { label: "ຄິວງານເຄມ", href: "/claims/jobs", count: "/claims/jobs" },
    { label: "ໃບເຄມ: ຮັບເຄມຈາກຮ້ານ", href: "/claims/shop", divider: true },
    { label: "ໃບເຄມ: ເຄມອາໄຫຼ່ supplier", href: "/claims/supplier" },
    { label: "ໃບເຄມ: ເກັບຄ່າສ້ອມ supplier", href: "/claims/reimburse" },
    /**
     * ── ຄິວງານເຄມ (ແຍກອອກຈາກກຸ່ມ "ສະຖານະງານສ້ອມ" 31-07-2026) ──
     * ແຕ່ກ່ອນ 4 ຄິວນີ້ປົນຢູ່ໃນ 12 ຂັ້ນຂອງສ້ອມ ⇒ ຄົນສ້ອມເຫັນວຽກທີ່ບໍ່ແມ່ນຂອງຕົນ
     * ແລະ ຄົນເຄມຕ້ອງໄປຫາຢູ່ເມນູສ້ອມ. ດຽວນີ້ຢູ່ກຸ່ມນີ້ຄົບ (ຮັບ → ກວດ → ຕັດສິນ → ຄືນຮ້ານ).
     * href ຍັງເປັນ /work/repair/<slug> ເພາະໃຊ້ຕາຕະລາງ tb_product ອັນດຽວກັນ.
     */
    ...pipelineOf(claimStatuses).map(([slug, def], index) => ({
      label: `${index + 1}. ${def.label}`,
      href: `/claims/jobs/${slug}`,
      count: `/claims/jobs/${slug}`,
      labelKey: `pipe:claim:${slug}`,
      ...(index === 0 && { divider: true }),
    })),
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
    // ຕິດຕາມການສັ່ງຊື້ອາໄຫຼ່ = ໜ້າອາໄຫຼ່ (ກຸ່ມ "ລໍອະນຸມັດ" + "ສັ່ງຊື້ແລ້ວ ລໍຂອງມາ")
    { label: "ຕິດຕາມການສັ່ງຊື້ອາໄຫຼ່", href: "/work/spares" },
  ],
};

const APPROVE: NavGroup = {
  id: "approve_menu",
  label: "ອະນຸມັດ",
  icon: ClipboardCheck,
  items: [
    { label: "ອະນຸມັດໃບສະເໜີລາຄາ", href: "/approvals/quotations", count: "/approvals/quotations" },
    { label: "ອະນຸມັດຍົກເລີກເຄື່ອງສ້ອມ", href: "/approvals/cancellations", count: "/approvals/cancellations" },
    // ຊ່າງຂໍ "ໝົດຮັບປະກັນ" = ລູກຄ້າຕ້ອງຈ່າຍ ⇒ ງານຢຸດລໍຈົນກວ່າຈະຕັດສິນ
    { label: "ອະນຸມັດປ່ຽນປະກັນ", href: "/approvals/warranty", count: "/approvals/warranty" },
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
    // ໃຜເຮັດຫຍັງ ກັບໃບໃດ ເວລາໃດ ໃນມື້ນັ້ນ — ດຶງຈາກ chatter (ລວມທີ່ຊ່າງເຮັດຈາກແອັບ)
    { label: "ການເຄື່ອນໄຫວປະຈຳວັນ", href: "/reports/daily-activity" },
    // KPI: ງານໄຫຼດີບໍ · **ຄ້າງຢູ່ຂັ້ນໃດ** (ຄໍຂວດ) · ໃຜເຮັດໄດ້ເທົ່າໃດ — ທັງສອງສາຍງານ
    { label: "KPI ປະສິດທິພາບ", href: "/reports/kpi" },
    // ສ້ອມບໍ່ຫາຍແຕ່ເທື່ອທຳອິດ = ຈ່າຍຄ່າຊ່າງ 2 ເທື່ອ — ບໍ່ມີໜ້າໃດເຄີຍເຫັນມັນ
    { label: "ເຄື່ອງກັບມາສ້ອມຊ້ຳ", href: "/reports/repeat-repairs" },
    { label: "ລາຍງານກວດເຊັກ", href: "/reports/checking" },
    { label: "ລາຍງານຮັບເຄື່ອງປະຈຳວັນ", href: "/reports/daily-receipts" },
    { label: "ລາຍງານໃບຮັບເງິນ", href: "/reports/receipts" },
    // ເງິນ: ສະຫຼຸບຍອດໃບຮັບເງິນ (SIN) ຕາມວັນ/ເດືອນ — ຕ່າງຈາກ 2 ອັນເທິງທີ່ເປັນ "ຮັບເຄື່ອງ"
    { label: "ສະຫຼຸບໃບຮັບເງິນ (ວັນ/ເດືອນ)", href: "/reports/service-receipts" },
    // ── ເງິນຂອງງານສ້ອມ (17-07-2026) — ໜີ້ຄ້າງ · ລາຍຮັບ · ແຍກປະເພດລູກຄ້າ ──
    { label: "ຕິດຕາມການຊຳລະ", href: "/reports/service-debts" },
    { label: "ສະຫຼຸບລາຍຮັບງານສ້ອມ", href: "/reports/service-revenue" },
    // ຖອດແບບ Excel ປະຈຳເດືອນຂອງຜູ້ຈັດການ — ເດືອນ/YTD ທຽບເປົ້າ ແລະ ປີກາຍ ແຍກ 5 ໝວດ
    { label: "ລາຍງານປະຈຳເດືອນ (ຜູ້ຈັດການ)", href: "/reports/monthly-revenue" },
    { label: "ງານສ້ອມ: ທົ່ວໄປ / ຮ້ານຄ້າ", href: "/reports/service-by-kind" },
    { label: "ລາຍງານຍົກເລີກຮັບເຄື່ອງ", href: "/reports/cancelled-receipts" },
    { label: "ລາຍງານງານຄ້າງ", href: "/reports/pending" },
    { label: "ລາຍງານສາງ", href: "/reports/stock", divider: true },
    { label: "ຜົນການກວດນັບສະຕັອກ", href: "/reports/stock-count" },
    { label: "ເຄື່ອງນັບບໍ່ພົບ (ຫາຍ)", href: "/reports/stock-count/missing" },
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
    { label: "ເປົ້າລາຍຮັບລາຍເດືອນ", href: "/manage/revenue-targets" },
    { label: "ເຊື່ອມຕົວຕົນຊ່າງ", href: "/manage/technicians" },
    { label: "ການຕັ້ງຄ່າລະບົບ", href: "/manage/settings" },
    { label: "ລາຍງານອັດຕະໂນມັດ (email/Line)", href: "/manage/report-recipients" },
    { label: "ຫຍີ່ຫໍ້ເກັບເງินกับ supplier", href: "/manage/claim-brands" },
    { label: "ຕິດຕາມການເຂົ້າລະບົບ", href: "/manage/login-log" },
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
/**
 * **ໃບຮັບເງິນ** — ແຍກເປັນໝວດຂອງຕົນເອງ (ບໍ່ຝັງໃນສາຍງານສ້ອມ) ເພາະເປັນເອກະສານການເງິນ
 * ທີ່ອ່ານຈາກ **ERP ໂດຍກົງ** (public.ic_trans · trans_flag 44) ບໍ່ໄດ້ຂຶ້ນກັບຂັ້ນຕອນສ້ອມ.
 */
const RECEIPT: NavGroup = {
  id: "receipt_menu",
  label: "ບິນຂາຍ / ໃບຮັບເງິນ",
  icon: ReceiptText,
  items: [
    { label: "ບິນຂາຍຂອງຝ່າຍບໍລິການ", href: "/receipts" },
    // ລາຍຮັບຕິດຕັ້ງ ນັບຈາກໃບງານ (doc_ref_1 → ບິນ ERP) — ຢູ່ໝວດດຽວກັນເພາະເປັນເລື່ອງບິນ/ເງິນ
    { label: "ລາຍຮັບງານຕິດຕັ້ງ", href: "/install-revenue" },
  ],
};

/** **ລາຍຮັບຊ່າງ** — ເມນູຂອງຕົນເອງ, ເບິ່ງເປັນເດືອນ (ບໍ່ແມ່ນຕາຕະລາງລາຍງານທົ່ວໄປ) */
const TECH_REVENUE: NavGroup = {
  id: "tech_revenue_menu",
  label: "ລາຍຮັບຊ່າງ",
  icon: Wallet,
  items: [{ label: "ສະຫຼຸບປະຈຳເດືອນ", href: "/tech-revenue" }],
};

export const navigation: NavGroup[] = [HOME, REPAIR, INSTALL, MAINTENANCE, CLAIM, STOCK, RECEIPT, TECH_REVENUE, PURCHASE, APPROVE, REPORT, USERS];

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
      /**
       * ວຽກຂອງຂ້ອຍ ຕາມຂັ້ນ — **ໜ້າດຽວທີ່ເຫັນວຽກຕົນເອງຄົບທຸກຂັ້ນ** (ສ້ອມ · ຕິດຕັ້ງ · ສ້ອມບຳລຸງ).
       * ຄິວລຸ່ມນີ້ແຍກເປັນຂັ້ນລະໜ້າ ⇒ ຢາກຮູ້ "ຂ້ອຍມີວຽກຄ້າງຢູ່ໃສແດ່" ຕ້ອງເປີດ 5-6 ໜ້າ.
       */
      { label: "ວຽກຂອງຂ້ອຍ ຕາມຂັ້ນ", href: "/my-jobs" },
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
      // ສະເພາະຂັ້ນທີ່ຊ່າງລົງມືເອງ: ຮັບ/ກວດ · ກວດ stock/ຂໍເບີກ · ສ້ອມ.
      // ຂັ້ນ CS, ສາງ, ຈັດຊື້, ອະນຸມັດ, QC ແລະສົ່ງຄືນ ບໍ່ຂຶ້ນໃນ sidebar ຊ່າງ.
      // ຂັ້ນອາໄຫຼ່ຂອງຊ່າງ = ໜ້າອາໄຫຼ່ດຽວກັນກັບຝັ່ງ CS/ສາງ (ບໍ່ແຍກຄິວຕາມຂັ້ນອີກ)
      ...(["wait-check", "checking", "spares", "wait-repair", "repairing"] as const).map((slug, index) =>
        slug === "spares"
          ? {
              label: `${index + 1}. ອາໄຫຼ່ — ຂໍເບີກ · ຮັບອາໄຫຼ່`,
              href: "/work/spares",
              count: "/work/spares",
            }
          : {
              label: `${index + 1}. ${repairStatuses[slug].label}`,
              href: `/work/repair/${slug}`,
              count: `/work/repair/${slug}`,
              labelKey: `pipe:repair:${slug}`,
            },
      ),
    ],
  },
  {
    id: "tech_install_menu",
    label: "ງານຕິດຕັ້ງຂອງຂ້ອຍ",
    icon: HardHat,
    items: [
      { label: "ຮັບງານ", href: "/installations/accept", count: "/installations/accept", labelKey: "tech:accept" },
      { label: "ຂໍເບີກອາໄຫຼ່", href: "/installations/spare-requests", count: "/installations/spare-requests", labelKey: "tech:spare-requests" },
      { label: "ຮັບອາໄຫຼ່", href: "/installations/spare-pickup", count: "/installations/spare-pickup", labelKey: "tech:spare-pickup" },
      { label: "ລໍຖ້າຕິດຕັ້ງ", href: "/installations/work", count: "/installations/work" },
      { label: "ກຳລັງຕິດຕັ້ງ", href: "/installations/work/doing", count: "/installations/work/doing" },
      { label: "ສົ່ງຄືນອາໄຫຼ່", href: "/stock/returns?job=install", labelKey: "tech:returns-install" },
      { label: "ກວດຮັບຄຸນນະພາບ", href: "/qc?workflow=install", flag: "qc", count: "/qc/install", labelKey: "tech:qc-install" },
    ],
  },
  {
    id: "tech_income_menu",
    label: "ລາຍຮັບຂອງຂ້ອຍ",
    icon: FileBarChart,
    items: [{ label: "ຄ່າຄອມຂອງຂ້ອຍ", href: "/reports/technician-income", labelKey: "tech:income" }],
  },
];

/**
 * ພະນັກງານຂາຍ — ແຈ້ງສ້ອມແທນລູກຄ້າ + ຕິດຕາມງານສ້ອມຕາມເຂດ (`/sales/*`).
 * ຕ້ອງແຍກເມນູຄືຊ່າງ: default nav ບໍ່ມີ item ໃດທີ່ sales ເຂົ້າໄດ້ ⇒ sidebar ຫວ່າງ/ຜິດ.
 */
const SALES_NAVIGATION: NavGroup[] = [
  {
    id: "sales_menu",
    label: "ຂາຍ & ບໍລິການ",
    icon: ShoppingCart,
    items: [
      { label: "ໜ້າຫຼັກ", href: "/sales" },
      { label: "ແຈ້ງສ້ອມແທນລູກຄ້າ", href: "/sales/report-repair" },
      { label: "ຕິດຕາມງານສ້ອມ", href: "/sales/jobs" },
    ],
  },
  {
    id: "sales_home_menu",
    label: "ຂອງຂ້ອຍ",
    icon: LayoutDashboard,
    items: [
      { label: "AI ຜູ້ຊ່ວຍວຽກ", href: "/assistant" },
      { label: "ກິດຈະກຳ", href: "/activities" },
      { label: "ການແຈ້ງເຕືອນ", href: "/notifications" },
    ],
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
  const source = role === "technical"
    ? TECHNICIAN_NAVIGATION
    : role === "sales"
    ? SALES_NAVIGATION
    : navigation;
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
