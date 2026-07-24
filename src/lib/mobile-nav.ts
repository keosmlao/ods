import type { Role } from "@/lib/roles";

/**
 * ແຖບລຸ່ມ (bottom-nav) ຂອງແອັບມືຖື — **server ຕັດສິນຕາມ role** ຄືກັບຫຼັກການທັງແອັບ:
 * ແອັບ render ຕາມ manifest ນີ້ ບໍ່ຄິດ tab ເອງ ⇒ ປ່ຽນສ່ວນງານຂອງ role ໄດ້ຈາກ server ບ່ອນດຽວ.
 *
 * ⚠️ ຕ້ອງກົງກັບ role-guard ຂອງ `/api/mobile/*` ບໍ່ດັ່ງນັ້ນ tab ຈະຕົກ 403:
 *   • jobs · pickup · income → TECH_SIDE (manager · headtechnical · technical)
 *   • stock-count            → ທຸກຄົນ ຍົກເວັ້ນ ຊ່າງ (technical · headtechnical)
 *   • qc                     → lib/qc-flow ຕັດສິນ (ods_qc_role) — ວ່າງ = ໜ້າຈໍແຈ້ງ "ບໍ່ມີສິດ"
 *   • notifications          → ທຸກຄົນ
 *   • overview               → APPROVER_SIDE (manager · headtechnical) — ພາບລວມບໍລິຫານ
 */
export type MobileTabKey = "overview" | "jobs" | "pickup" | "income" | "qc" | "stock-count" | "notifications";

export type MobileTab = { key: MobileTabKey; label: string };

/** label ກາງ — ໃຫ້ຄຳຢູ່ໃຕ້ icon ຄົງທີ່ ບໍ່ວ່າ role ໃດ */
const TAB: Record<MobileTabKey, MobileTab> = {
  overview: { key: "overview", label: "ພາບລວມ" },
  jobs: { key: "jobs", label: "ວຽກ" },
  pickup: { key: "pickup", label: "ອາໄຫຼ່" },
  income: { key: "income", label: "ລາຍຮັບ" },
  qc: { key: "qc", label: "QC" },
  "stock-count": { key: "stock-count", label: "ກວດນັບ" },
  notifications: { key: "notifications", label: "ແຈ້ງເຕືອນ" },
};

/**
 * ສ່ວນງານມືຖືຂອງແຕ່ລະ role. tab ທຳອິດ = ໜ້າຕັ້ງຕົ້ນ (home) ⇒ ໃສ່ໜ້າທີ່ role
 * ນັ້ນ **ເຂົ້າໄດ້ແນ່ນອນ** ໄວ້ກ່ອນ ເພື່ອບໍ່ໃຫ້ຕົກໜ້າວ່າງຕອນເປີດແອັບ.
 */
const TABS_BY_ROLE: Record<Role, MobileTabKey[]> = {
  technical: ["jobs", "pickup", "income"], // ຊ່າງພາກສະໜາມ
  headtechnical: ["jobs", "qc", "income"], // ຫົວໜ້າຊ່າງ — ກວດ QC ໜ້າງານ
  manager: ["overview", "qc", "stock-count"], // ຜູ້ຈັດການ/Admin — ພາບລວມບໍລິຫານ
  stock: ["stock-count", "notifications"], // ຝ່າຍສາງ
  admin: ["stock-count", "notifications", "qc"], // CS
  sales: ["stock-count", "notifications"], // ຝ່າຍຂາຍ
  user: ["notifications"], // ທົ່ວໄປ
};

/** manifest ແຖບລຸ່ມຂອງ role — fallback = ແຈ້ງເຕືອນ (ທຸກຄົນເຂົ້າໄດ້) */
export function mobileTabsFor(role: Role): MobileTab[] {
  return (TABS_BY_ROLE[role] ?? ["notifications"]).map((key) => TAB[key]);
}
