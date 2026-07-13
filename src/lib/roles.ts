import type { Session } from "@/lib/auth";

/**
 * ກຳນົດສິດ (RBAC) — ກົດເກນກາງອັນດຽວຂອງລະບົບ.
 *
 * ກູ້ມາຈາກ ods/templates/layout/layout.html (ແຖວ 69-346) ບ່ອນທີ່ເມນູແຕ່ລະກຸ່ມ
 * ຖືກຫຸ້ມດ້ວຍ {% if roles == '...' %}:
 *
 *   manager  → ບໍລິການ + ຊ່າງ + ສາງ + ກຳນົດລູກຄ້າ + ອະນຸມັດ + ການຈັດການ (ຄົບທຸກຢ່າງ)
 *   admin    → ບໍລິການ + ກຳນົດລູກຄ້າ (ບໍ່ມີ ຊ່າງ/ສາງ/ອະນຸມັດ)
 *   stock    → ສາງ ເທົ່ານັ້ນ
 *   ອື່ນໆ    → ຊ່າງ ເທົ່ານັ້ນ ({% else %} — technical, headtechnical, user)
 *
 * ໝາຍເຫດສຳຄັນ: ods ບໍ່ໄດ້ກວດສິດຢູ່ຝັ່ງ server ເລີຍ — ທຸກ route ກວດແຕ່
 * `if not session.get("name")` ຄື login ຢູ່ບໍ່ເທົ່ານັ້ນ. ພິມ URL ໂດຍກົງກໍ່ເຂົ້າໄດ້ໝົດ.
 * ບ່ອນນີ້ຈຶ່ງບັງຄັບທັງເມນູ ແລະ ຝັ່ງ server (src/app/(app)/layout.tsx).
 */

/* ── role ມາດຕະຖານ ─────────────────────────────────────────────── */

export const ROLES = ["manager", "headtechnical", "admin", "stock", "technical", "user"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABEL: Record<Role, string> = {
  manager: "ຜູ້ຈັດການ",
  headtechnical: "ຫົວໜ້າຊ່າງ",
  admin: "ພະນັກງານບໍລິການ (CS)",
  stock: "ພະນັກງານສາງ",
  technical: "ຊ່າງ",
  user: "ພະນັກງານທົ່ວໄປ",
};

/** ຄ່າໃນ session ອາດເປັນຫຍັງກໍ່ໄດ້ (ODS users.roles ຫຼື ພະແນກ ERP) → ດຶງລົງເປັນ Role */
export function normalizeRole(raw: string | null | undefined): Role {
  const value = (raw ?? "").trim().toLowerCase();
  return (ROLES as readonly string[]).includes(value) ? (value as Role) : "user";
}

export function roleOf(session: Session | null | undefined): Role {
  return normalizeRole(session?.role);
}

/* ── ຕຳແໜ່ງ + ພະແນກ ຂອງ ERP → role ─────────────────────────────
 * ສູດຈິງຢູ່ທີ່ roleFromErp() / ERP_ROLE_CASE ໃນ src/lib/erp-auth.ts ບ່ອນດຽວ
 * (ຕຳແໜ່ງ 11 ຜູ້ຈັດການ · 12 ຫົວໜ້າໜວຍງານ · 13 ພະນັກງານ, ພະແນກບອກສາຍງານ)
 * ⇒ ບ່ອນນີ້ບໍ່ຄິດ role ຊ້ຳອີກ ກັນສອງບ່ອນຄິດບໍ່ຕົງກັນ.
 */

/* ── ຕາຕະລາງສິດຕາມເສັ້ນທາງ ──────────────────────────────────────── */

const M: Role = "manager";
const HT: Role = "headtechnical";
const A: Role = "admin";
const S: Role = "stock";
const T: Role = "technical";

/** ກຸ່ມ "ຊ່າງ" ຂອງ ods = ທຸກຄົນທີ່ບໍ່ແມ່ນ manager/admin/stock ({% else %}) */
export const TECH_SIDE: Role[] = [M, HT, T];
/** ກຸ່ມ "ບໍລິການ" ຂອງ ods */
export const SERVICE_SIDE: Role[] = [M, A];
/** ກຸ່ມ "ສາງ" ຂອງ ods */
export const STOCK_SIDE: Role[] = [M, S];
/** ຜູ້ອະນຸມັດ — ຕົງກັບ ROLE_APPROVER ໃນ lib/chatter */
export const APPROVER_SIDE: Role[] = [M, HT];
/**
 * ຂະບວນການອາໄຫຼ່ — **ຊ່າງ ກັບ ສາງ ເທົ່ານັ້ນ, ບໍ່ຜ່ານ CS** (ນະໂຍບາຍຂອງຜູ້ຈັດການ):
 *
 *   ເບີກ : ຊ່າງອອກໃບຂໍເບີກ → ສາງເບີກອອກ (ຕັດສະຕັອກ ERP) → ຊ່າງກົດຮັບອາໄຫຼ່
 *   ຄືນ  : ຊ່າງຂໍຄືນອາໄຫຼ່  → ສາງຮັບເຂົ້າສາງ (ບວກສະຕັອກ ERP)
 *
 * CS ບໍ່ແຕະຂອງຈິງ ຈຶ່ງບໍ່ຄວນອອກ/ຮັບເອກະສານສາງ. ໃບເບີກຂອງງານທີ່ຍົກເລີກຂຶ້ນຢູ່
 * ແທັບ "ຍົກເລີກ — ຖ້າສົ່ງຄືນ" ຂອງ /stock/returns ຢູ່ແລ້ວ ແລະ cancelInstall/ຍົກເລີກ
 * ແຈ້ງເຕືອນສາງໃຫ້ ⇒ ຊ່າງ/ສາງ ເຮັດຄົບເສັ້ນທາງໄດ້ເອງ ໂດຍບໍ່ຕ້ອງມີ CS.
 * ປ້າຍຢູ່ໜ້າ /installations ຈຶ່ງເປັນພຽງ "ບອກໃຫ້ຮູ້" (ບໍ່ມີປຸ່ມລົງມື).
 *
 * ຖ້າຢາກໃຫ້ໃຜຄົນນຶ່ງເຮັດໄດ້ເປັນກໍລະນີ ⇒ ຜູ້ຈັດການກຳນົດສິດໃຫ້ທີ່ /manage/employees
 * (ສິດທີ່ກຳນົດເອງຊະນະສິດຕາມຕຳແໜ່ງ) — ບໍ່ແມ່ນເປີດໃຫ້ທັງ role.
 */
export const RETURN_SIDE: Role[] = [M, HT, T, S];
/** ທຸກຄົນທີ່ login ແລ້ວ */
export const EVERYONE: Role[] = [...ROLES];

type Rule = { path: string; exact?: boolean; roles: Role[] };

/**
 * ກົດເກນ — `*` ແທນ 1 ຊັ້ນຂອງເສັ້ນທາງ (ເຊັ່ນ code/docNo).
 * ບໍ່ໃສ່ exact = ກວມເອົາລູກທັງໝົດ. ຖ້າຫຼາຍກົດຕົງກັນ ເອົາອັນທີ່ລະອຽດກວ່າ.
 */
const RULES: Rule[] = [
  /* ໜ້າກາງ — ທຸກຄົນເຫັນໄດ້ */
  { path: "/forbidden", roles: EVERYONE },
  { path: "/dashboard", roles: EVERYONE },
  { path: "/activities", roles: EVERYONE },
  { path: "/notifications", roles: EVERYONE },

  /* ບໍລິການ / ຮັບເຄື່ອງສ້ອມ — ods: ເມນູ "ບໍລິການ" (manager, admin) */
  { path: "/service", exact: true, roles: SERVICE_SIDE },
  { path: "/service/new", roles: SERVICE_SIDE },
  { path: "/service/cancel", roles: SERVICE_SIDE },
  { path: "/service/notices", roles: SERVICE_SIDE },
  { path: "/service/*/edit", roles: SERVICE_SIDE },
  // ໃບຮັບເຄື່ອງ (ອ່ານ/ພິມ/ຮູບ/ຜູ້ຕິດຕໍ່) — ຊ່າງຕ້ອງເປີດເບິ່ງໄດ້ ເພາະການແຈ້ງເຕືອນ
  // ຂອງ tb_product ຊີ້ມາທີ່ /service/{code} (lib/chatter recordHref)
  { path: "/service/*", roles: EVERYONE },

  { path: "/quotations", roles: SERVICE_SIDE },
  // ຄິວແຈ້ງລູກຄ້າ (ລໍຕັດສິນລາຄາ · ມາຮັບເຄື່ອງ · ຢືນຢັນນັດ) — ຝ່າຍບໍລິການເປັນຜູ້ຕິດຕໍ່ລູກຄ້າ
  { path: "/customer-contact", roles: SERVICE_SIDE },
  { path: "/returns", roles: SERVICE_SIDE },
  { path: "/customers", roles: SERVICE_SIDE },

  /* ຊ່າງ — ods: ເມນູ "ຊ່າງ" ({% else %} + manager) */
  { path: "/checking", roles: TECH_SIDE },
  { path: "/repair", roles: TECH_SIDE },
  // ໃບຂໍເບີກ / ໃບຂໍສົ່ງຄືນ: ຊ່າງເປັນຄົນສ້າງ, ສາງເປັນຄົນຈ່າຍ/ຮັບ ⇒ ເຫັນທັງສອງຝ່າຍ
  { path: "/stock/requests", roles: [...TECH_SIDE, S] },
  // ໃບຂໍສົ່ງຄືນ: ຊ່າງ+ສາງ ຄືເກົ່າ ບວກ **CS** — saveInstallReturnRequest / cancelInstallReturnRequest
  // redirect ມາທີ່ນີ້ ແລະ CS ເປັນຄົນສ້າງໃບຂໍສົ່ງຄືນຂອງງານຕິດຕັ້ງທີ່ຍົກເລີກ (ເບິ່ງ RETURN_SIDE)
  { path: "/stock/returns", roles: RETURN_SIDE },

  /* ສາງ — ods: ເມນູ "ສາງ" (manager, stock) */
  { path: "/stock/dispatch", roles: STOCK_SIDE },
  { path: "/stock/arrivals", roles: STOCK_SIDE },
  { path: "/stock/receive-returns", roles: STOCK_SIDE },
  { path: "/stock/spare-parts", roles: STOCK_SIDE },
  { path: "/stock/products", roles: STOCK_SIDE },
  { path: "/stock/transfers", roles: STOCK_SIDE },
  // ສ້າງອາໄຫຼ່ / ຂໍສັ່ງຊື່: ods ໄວ້ໃນເມນູ "ບໍລິການ" ແຕ່ສາງເປັນຜູ້ລົງມືຕົວຈິງ
  // (ການແຈ້ງເຕືອນ ROLE_WAREHOUSE ຊີ້ມາໜ້ານີ້) ⇒ ເພີ່ມ stock ເຂົ້ານຳ
  { path: "/spare-parts/new", roles: [M, A, S] },
  { path: "/purchase-requests", roles: [M, A, S] },
  // ໃບຂໍສັ່ງຊື້ (ມີລາຄາ) — ເມື່ອກ່ອນເປີດສາທາລະນະ ⇒ ດຽວນີ້ຕ້ອງ login
  { path: "/pr-view", roles: [M, A, S, HT] },

  /* ຕິດຕັ້ງ — ods ແຍກເປັນ 2 ຝັ່ງ: ຝ່າຍບໍລິການເປີດ/ປິດງານ · ຊ່າງລົງມື */
  { path: "/installations", exact: true, roles: SERVICE_SIDE },
  { path: "/installations/new", roles: SERVICE_SIDE },
  { path: "/installations/assign", roles: SERVICE_SIDE },
  { path: "/installations/close", roles: SERVICE_SIDE },
  { path: "/installations/accept", roles: TECH_SIDE },
  // ຄິວງານປະຈຳວັນ — ຜູ້ຈັດງານ (CS) ແລະ ຊ່າງ (ເຫັນສະເພາະຂອງຕົນ) ເບິ່ງໄດ້ທັງສອງຝ່າຍ
  { path: "/installations/schedule", roles: [M, HT, A, T] },
  { path: "/installations/work", roles: TECH_SIDE },
  { path: "/installations/spare-requests", roles: TECH_SIDE },
  { path: "/installations/spare-pickup", roles: TECH_SIDE },
  { path: "/installations/spare-returns", roles: RETURN_SIDE },
  { path: "/installations/spare-returns/receive", roles: STOCK_SIDE },
  { path: "/installations/dispatch", roles: STOCK_SIDE },
  { path: "/installations/pending-bills", roles: SERVICE_SIDE },
  { path: "/installations/*/edit", roles: SERVICE_SIDE },
  { path: "/installations/*/print", roles: EVERYONE },
  /**
   * ໜ້າລາຍລະອຽດງານຕິດຕັ້ງ (ອ່ານຢ່າງດຽວ + chatter) — ທຸກຄົນທີ່ login ເປີດໄດ້,
   * ຄູ່ກັບ `/service/*` ຂອງຝັ່ງສ້ອມ ແລະ ດ້ວຍເຫດຜົນອັນດຽວກັນ: ການແຈ້ງເຕືອນຂອງ
   * ods_tb_install ຊີ້ມາທີ່ນີ້ (lib/chatter recordHref) ແລະ ຄົນທີ່ຖືກແຈ້ງແມ່ນ
   * **ຊ່າງ** (ຈັດງານໃຫ້) ກັບ **ສາງ** (ມີໃບຂໍເບີກ) — ສອງ role ທີ່ເຂົ້າ /installations
   * ບໍ່ໄດ້. ຢ່າຫຸບອັນນີ້ໃຫ້ແຄບລົງ ບໍ່ດັ່ງນັ້ນການແຈ້ງເຕືອນຈະຕົກໃສ່ /forbidden ອີກ.
   *
   * ວາງໄວ້ **ຫຼັງ** ກົດຊື່ຕົງຕົວທັງໝົດ (assign/accept/work/…) ຈຶ່ງບໍ່ແຍ່ງກັນ:
   * ຊື່ຕົງຕົວໄດ້ຄະແນນ 22, `*` ໄດ້ 21 ⇒ ຄຸມແຕ່ /installations/<ລະຫັດງານ> ເທົ່ານັ້ນ.
   */
  { path: "/installations/*", roles: EVERYONE },

  /* ອະນຸມັດ — ods: ເມນູ "ອະນຸມັດ" (manager ເທົ່ານັ້ນ) + headtechnical (ROLE_APPROVER) */
  { path: "/approvals", roles: APPROVER_SIDE },

  /**
   * ກວດຮັບຄຸນນະພາບ — **ໃຜກວດໄດ້ ຢູ່ໃນຖານຂໍ້ມູນ (ods_qc_role) ບໍ່ແມ່ນຢູ່ນີ້**.
   * ຜູ້ຈັດການປ່ຽນຜູ້ກວດໄດ້ທີ່ /manage/qc-checklist ⇒ ຖ້າຝັງ role ໄວ້ບ່ອນນີ້ດ້ວຍ
   * ຄົນທີ່ຖືກກຳນົດໃໝ່ຈະຖືກ proxy ກັ້ນຢູ່ໜ້າປະຕູ ທັງທີ່ຕັ້ງຄ່າຖືກແລ້ວ.
   * ດ່ານຈິງ: ໜ້າ /qc ເອີ້ນ qcWorkflows() ແລ້ວພາໄປ /forbidden ຖ້າບໍ່ຖືກກຳນົດ
   * ແລະ actions/qc.ts ກວດຊ້ຳທຸກຄັ້ງທີ່ບັນທຶກ (ບວກ "ຄົນເຮັດກວດເອງບໍ່ໄດ້").
   */
  { path: "/qc", roles: EVERYONE },
  // ຕັ້ງລາຍການກວດ + ກຳນົດຜູ້ກວດ — ຜູ້ຈັດການເທົ່ານັ້ນ
  { path: "/manage/qc-checklist", roles: [M] },

  /* ຜູ້ໃຊ້ / ກຳນົດສິດ — ຜູ້ຈັດການເທົ່ານັ້ນ (ໃຜເປັນຫຍັງໃນລະບົບ ຕັດສິນຢູ່ນີ້)
   * ໝາຍເຫດ: ເມນູ "ການຈັດການ" ເກົ່າ (/manage/*) ຖືກລົບຖິ້ມໂດຍເຈດຕະນາ — ຢ່າກູ້ຄືນ.
   * ເຫຼືອແຕ່ໜ້ານີ້ໜ້າດຽວໃນເສັ້ນທາງ /manage */
  { path: "/manage/employees", roles: [M] },
  // ຄ່າບໍລິການ/ຄ່າຄອມ = ເລື່ອງເງິນ ⇒ ຜູ້ຈັດການເທົ່ານັ້ນ (actions/service-rate ກວດຊ້ຳ)
  { path: "/manage/service-rates", roles: [M] },
  // ເຊື່ອມຕົວຕົນຊ່າງ — ຕັດສິນວ່າຄ່າຄອມເຂົ້າບັນຊີໃຜ ⇒ ຜູ້ຈັດການເທົ່ານັ້ນ
  { path: "/manage/technicians", roles: [M] },

  /* ລາຍງານ — ods ໃຫ້ manager ຄົບ, admin ໄດ້ 2 ໜ້າ; ສາງໄດ້ສະເພາະລາຍງານສາງ/ສັ່ງຊື້ */
  { path: "/reports", roles: SERVICE_SIDE },
  { path: "/reports", exact: true, roles: [M, A, S] },
  { path: "/reports/stock", roles: [M, A, S] },
  { path: "/reports/purchase-requests", roles: [M, A, S] },
  { path: "/reports/purchase-orders", roles: [M, A, S] },
  // ລາຍຮັບຊ່າງ — ຊ່າງເບິ່ງ **ຂອງຕົນເອງ** ໄດ້ (ໜ້ານັ້ນກອງດ້ວຍ ownJobsOnly)
  // ຜູ້ຈັດການ/ຫົວໜ້າຊ່າງເບິ່ງໝົດ. CS/ສາງ ບໍ່ກ່ຽວ.
  { path: "/reports/technician-income", roles: [...TECH_SIDE] },
];

/** ຄະແນນຄວາມລະອຽດ — ຊັ້ນຫຼາຍ ແລະ ຊື່ຕົງຕົວ (ບໍ່ແມ່ນ `*`) ຊະນະ */
function score(rule: Rule, segments: string[]): number {
  const parts = rule.path.split("/").filter(Boolean);
  if (rule.exact && parts.length !== segments.length) return -1;
  if (parts.length > segments.length) return -1;

  let literal = 0;
  for (const [index, part] of parts.entries()) {
    if (part === "*") continue;
    if (part !== segments[index]) return -1;
    literal += 1;
  }
  return parts.length * 10 + literal + (rule.exact ? 1 : 0);
}

/** ກົດທີ່ຄຸມເສັ້ນທາງນີ້ — null ຖ້າບໍ່ມີກົດໃດຕົງ (ປະຕິເສດໄວ້ກ່ອນ) */
function ruleFor(pathname: string): Rule | null {
  const segments = pathname.split("/").filter(Boolean);
  let best: Rule | null = null;
  let bestScore = -1;
  for (const rule of RULES) {
    const value = score(rule, segments);
    if (value > bestScore) {
      best = rule;
      bestScore = value;
    }
  }
  return bestScore < 0 ? null : best;
}

/**
 * ເຂົ້າໜ້ານີ້ໄດ້ບໍ?
 * ຜູ້ຈັດການເຫັນທຸກຢ່າງສະເໝີ. ເສັ້ນທາງທີ່ບໍ່ມີໃນຕາຕະລາງ = ປະຕິເສດ (ປອດໄພໄວ້ກ່ອນ).
 */
export function canAccess(role: Role, pathname: string): boolean {
  if (role === "manager") return true;

  /**
   * "user" = ພະນັກງານທີ່ບໍ່ຢູ່ຝ່າຍບໍລິການ/ສາງ (ຂາຍ, ບັນຊີ, IT, ຂົນສົ່ງ... 149 ຄົນ)
   * ⇒ ບໍ່ມີວຽກຢູ່ລະບົບນີ້ ຈຶ່ງປິດໄວ້ກ່ອນ (default deny).
   * ຖ້າຕ້ອງໃຫ້ໃຜເຂົ້າໄດ້ ຜູ້ຈັດການໄປກຳນົດສິດໃຫ້ທີ່ /manage/employees
   * (ສິດທີ່ກຳນົດເອງຊະນະສິດຕາມຕຳແໜ່ງ).
   */
  if (role === "user") return pathname === "/forbidden";

  const rule = ruleFor(pathname);
  return rule ? rule.roles.includes(role) : false;
}
