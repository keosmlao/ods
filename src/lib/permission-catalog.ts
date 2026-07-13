import type { Role } from "@/lib/roles";

export const PERMISSION_ACTIONS = ["read", "create", "update", "delete"] as const;
export type PermissionAction = (typeof PERMISSION_ACTIONS)[number];

export const PERMISSION_ACTION_LABEL: Record<PermissionAction, string> = {
  read: "ອ່ານ",
  create: "ສ້າງ",
  update: "ແກ້ໄຂ",
  delete: "ລົບ",
};

export type PermissionResource = {
  group: string;
  label: string;
  resource: string;
  /** ບາງໜ້າເປັນຂໍ້ມູນອ່ານຢ່າງດຽວ ຈຶ່ງບໍ່ສະແດງ C/U/D ໃຫ້ກຳນົດ. */
  actions?: readonly PermissionAction[];
  /** ບໍ່ໃຫ້ override ເພາະເປັນສິດຄຸ້ມຄອງລະບົບ. */
  protected?: boolean;
};

const READ_ONLY = ["read"] as const;

export const PERMISSION_RESOURCES: readonly PermissionResource[] = [
  { group: "ຂອງຂ້ອຍ", label: "ໜ້າລວມ", resource: "/dashboard", actions: READ_ONLY },
  { group: "ຂອງຂ້ອຍ", label: "ຄິວງານປະຈຳວັນ", resource: "/installations/schedule", actions: READ_ONLY },
  { group: "ຂອງຂ້ອຍ", label: "ກິດຈະກຳຂອງຂ້ອຍ", resource: "/activities" },
  { group: "ຂອງຂ້ອຍ", label: "ການແຈ້ງເຕືອນ", resource: "/notifications", actions: ["read", "update"] },

  { group: "ສ້ອມແປງ", label: "ຮັບເຄື່ອງສ້ອມ", resource: "/service" },
  { group: "ສ້ອມແປງ", label: "ຄຳແຈ້ງສ້ອມ", resource: "/service/notices" },
  { group: "ສ້ອມແປງ", label: "ຄິວຍົກເລີກງານ", resource: "/service/cancel", actions: ["read", "update"] },
  { group: "ສ້ອມແປງ", label: "ຂໍ້ມູນລູກຄ້າ", resource: "/customers" },
  { group: "ສ້ອມແປງ", label: "ກວດເຊັກ", resource: "/checking", actions: ["read", "update"] },
  { group: "ສ້ອມແປງ", label: "ໃບສະເໜີລາຄາ", resource: "/quotations" },
  { group: "ສ້ອມແປງ", label: "ລູກຄ້າອະນຸມັດລາຄາ", resource: "/quotations/customer-approval", actions: ["read", "update"] },
  { group: "ສ້ອມແປງ", label: "ໃບຂໍເບີກອາໄຫຼ່", resource: "/stock/requests" },
  { group: "ສ້ອມແປງ", label: "ຮັບອາໄຫຼ່", resource: "/stock/requests/pickup", actions: ["read", "update"] },
  { group: "ສ້ອມແປງ", label: "ໃບຂໍສົ່ງຄືນອາໄຫຼ່", resource: "/stock/returns" },
  { group: "ສ້ອມແປງ", label: "ສ້ອມແປງ", resource: "/repair", actions: ["read", "update"] },
  { group: "ສ້ອມແປງ", label: "ໃບສົ່ງເຄື່ອງ/ໃບຮັບເງິນ", resource: "/returns" },
  { group: "ສ້ອມແປງ", label: "ຕິດຕາມສະຖານະ", resource: "/dashboard/tracking", actions: READ_ONLY },

  { group: "ຕິດຕັ້ງ", label: "ງານຕິດຕັ້ງ", resource: "/installations" },
  // ບິນທີ່ຈ່າຍຄ່າຕິດຕັ້ງແລ້ວ ແຕ່ຍັງບໍ່ມີໃບງານ — ບໍ່ໃສ່ບ່ອນນີ້ = ໜ້າຖືກເຊື່ອງຈາກ sidebar
  { group: "ຕິດຕັ້ງ", label: "ບິນຄ້າງອອກໃບງານ", resource: "/installations/pending-bills", actions: READ_ONLY },
  { group: "ຕິດຕັ້ງ", label: "ມອບໝາຍງານ", resource: "/installations/assign", actions: ["read", "update"] },
  { group: "ຕິດຕັ້ງ", label: "ຮັບງານຕິດຕັ້ງ", resource: "/installations/accept", actions: ["read", "update"] },
  { group: "ຕິດຕັ້ງ", label: "ໃບຂໍເບີກ", resource: "/installations/spare-requests" },
  { group: "ຕິດຕັ້ງ", label: "ຮັບອາໄຫຼ່", resource: "/installations/spare-pickup", actions: ["read", "update"] },
  { group: "ຕິດຕັ້ງ", label: "ຕິດຕັ້ງ", resource: "/installations/work", actions: ["read", "update"] },
  { group: "ຕິດຕັ້ງ", label: "ປິດງານ", resource: "/installations/close", actions: ["read", "update"] },
  { group: "ຕິດຕັ້ງ", label: "ລາຍງານງານຕິດຕັ້ງ", resource: "/reports/installations", actions: READ_ONLY },
  { group: "ຕິດຕັ້ງ", label: "ລາຍງານແບບສອບຖາມ", resource: "/reports/customer-feedback", actions: READ_ONLY },

  { group: "ສາງ ແລະ ອາໄຫຼ່", label: "ຮັບອາໄຫຼ່ທີ່ສັ່ງຊື້", resource: "/stock/arrivals", actions: ["read", "update"] },
  { group: "ສາງ ແລະ ອາໄຫຼ່", label: "ຕິດຕາມການໂອນ", resource: "/stock/transfers" },
  { group: "ສາງ ແລະ ອາໄຫຼ່", label: "ຮັບຄືນອາໄຫຼ່", resource: "/stock/receive-returns", actions: ["read", "update"] },
  { group: "ສາງ ແລະ ອາໄຫຼ່", label: "ລາຍການອາໄຫຼ່", resource: "/stock/spare-parts", actions: READ_ONLY },
  { group: "ສາງ ແລະ ອາໄຫຼ່", label: "ສິນຄ້າສ້ອມແປງ", resource: "/stock/products", actions: READ_ONLY },
  { group: "ສາງ ແລະ ອາໄຫຼ່", label: "ສ້າງອາໄຫຼ່", resource: "/spare-parts/new", actions: ["read", "create"] },
  { group: "ສາງ ແລະ ອາໄຫຼ່", label: "ຂໍສັ່ງຊື້", resource: "/purchase-requests" },

  { group: "ຄຸນນະພາບ", label: "ຄິວກວດຮັບ QC", resource: "/qc", actions: ["read", "update"] },
  { group: "ຄຸນນະພາບ", label: "ຄິວແຈ້ງລູກຄ້າ", resource: "/customer-contact", actions: ["read", "update"] },
  { group: "ຄຸນນະພາບ", label: "ຕັ້ງລາຍການກວດຮັບ", resource: "/manage/qc-checklist" },

  { group: "ອະນຸມັດ", label: "ອະນຸມັດໃບສະເໜີລາຄາ", resource: "/approvals/quotations", actions: ["read", "update"] },
  { group: "ອະນຸມັດ", label: "ອະນຸມັດຍົກເລີກ", resource: "/approvals/cancellations", actions: ["read", "update"] },
  { group: "ອະນຸມັດ", label: "ອະນຸມັດຂໍສັ່ງຊື້", resource: "/approvals/purchase-requests", actions: ["read", "update"] },

  { group: "ລາຍງານ", label: "ໜ້າລວມລາຍງານ", resource: "/reports", actions: READ_ONLY },
  { group: "ລາຍງານ", label: "ລາຍງານກວດເຊັກ", resource: "/reports/checking", actions: READ_ONLY },
  { group: "ລາຍງານ", label: "ລາຍງານຮັບເຄື່ອງປະຈຳວັນ", resource: "/reports/daily-receipts", actions: READ_ONLY },
  { group: "ລາຍງານ", label: "ລາຍງານໃບຮັບເງິນ", resource: "/reports/receipts", actions: READ_ONLY },
  { group: "ລາຍງານ", label: "ລາຍງານຍົກເລີກ", resource: "/reports/cancelled-receipts", actions: READ_ONLY },
  { group: "ລາຍງານ", label: "ລາຍງານງານຄ້າງ", resource: "/reports/pending", actions: READ_ONLY },
  { group: "ລາຍງານ", label: "ລາຍງານສາງ", resource: "/reports/stock", actions: READ_ONLY },
  { group: "ລາຍງານ", label: "ລາຍງານການສັ່ງຊື້", resource: "/reports/purchase-requests", actions: READ_ONLY },
  { group: "ລາຍງານ", label: "ລາຍງານໃບສັ່ງຊື້", resource: "/reports/purchase-orders", actions: READ_ONLY },
  { group: "ລາຍງານ", label: "ລາຍງານມອບໝາຍງານ", resource: "/reports/job-dispatch", actions: READ_ONLY },
  { group: "ລາຍງານ", label: "ລາຍຮັບຊ່າງ", resource: "/reports/technician-income", actions: READ_ONLY },

  { group: "ຜູ້ໃຊ້", label: "ກຳນົດສິດ", resource: "/manage/employees", protected: true },
  { group: "ຜູ້ໃຊ້", label: "ຄ່າບໍລິການ / ຄ່າຄອມ", resource: "/manage/service-rates" },
  { group: "ຜູ້ໃຊ້", label: "ເຊື່ອມຕົວຕົນຊ່າງ", resource: "/manage/technicians" },
] as const;

const RESOURCE_SET = new Set(PERMISSION_RESOURCES.map((item) => item.resource));

export function isPermissionResource(value: string): boolean {
  return RESOURCE_SET.has(value);
}

/** ຈັບ pathname ໃສ່ເມນູທີ່ລະອຽດທີ່ສຸດ. */
export function resourceForPath(pathname: string): string | null {
  const path = pathname.split("?")[0].replace(/\/$/, "") || "/";
  const matches = PERMISSION_RESOURCES.filter(
    (item) => path === item.resource || path.startsWith(`${item.resource}/`),
  );
  return matches.sort((a, b) => b.resource.length - a.resource.length)[0]?.resource ?? null;
}

/** ແປ path ຂອງໜ້າເປັນ CRUD ສຳລັບການກັ້ນ URL ໂດຍກົງ. */
export function actionForPath(pathname: string): PermissionAction {
  const parts = pathname.split("?")[0].split("/").filter(Boolean);
  if (parts.includes("new")) return "create";
  if (parts.includes("edit")) return "update";
  return "read";
}

export type CrudPermission = Record<PermissionAction, boolean>;

export function inheritedPermission(role: Role, resource: string, canRead: (role: Role, path: string) => boolean): CrudPermission {
  const read = canRead(role, resource);
  return { read, create: read, update: read, delete: read };
}
