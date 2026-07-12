/**
 * Chatter ແລະ ກິດຈະກຳ (ແບບ Odoo) — ໃຊ້ໄດ້ກັບທຸກເອກະສານ.
 *
 * ເກັບແບບ generic: (model, res_id) ຊີ້ໄປຫາເອກະສານໃດກໍ່ໄດ້
 *   tb_product     → ໃບຮັບເຄື່ອງສ້ອມ (res_id = tb_product.code)
 *   ods_tb_install → ງານຕິດຕັ້ງ      (res_id = ods_tb_install.code, ເຊັ່ນ INST-7026)
 *   ic_trans       → ເອກະສານສາງ/ໃບສະເໜີລາຄາ (res_id = doc_no)
 *   ar_customer    → ລູກຄ້າ          (res_id = code)
 *
 * ຕາຕະລາງ: ods_chatter_message · ods_chatter_follower · ods_activity
 */

export type ChatterModel = "tb_product" | "ods_tb_install" | "ic_trans" | "ar_customer";

export const MODEL_LABEL: Record<ChatterModel, string> = {
  tb_product: "ໃບຮັບເຄື່ອງສ້ອມ",
  ods_tb_install: "ງານຕິດຕັ້ງ",
  ic_trans: "ເອກະສານສາງ",
  ar_customer: "ລູກຄ້າ",
};

/** ລິ້ງກັບໄປຫາເອກະສານຕົ້ນທາງ — ໃຊ້ໃນໜ້າ "ກິດຈະກຳຂອງຂ້ອຍ" */
export function recordHref(model: string, resId: string) {
  switch (model) {
    case "tb_product":
      return `/service/${resId}`;
    /**
     * ໜ້າ **ອ່ານ** ຂອງງານຕິດຕັ້ງ — ບໍ່ແມ່ນ /edit ອີກຕໍ່ໄປ.
     * /edit ເປັນຂອງຝ່າຍບໍລິການເທົ່ານັ້ນ ແຕ່ຄົນທີ່ຖືກແຈ້ງແມ່ນ **ຊ່າງ** (ຈັດງານໃຫ້)
     * ແລະ **ສາງ** (ມີໃບຂໍເບີກ) ⇒ ແຕ່ກ່ອນທຸກການແຈ້ງເຕືອນຂອງງານຕິດຕັ້ງພາສອງ role ນັ້ນ
     * ໄປຕົກໃສ່ /forbidden. ຄູ່ກັບ /service/<code> ຂອງຝັ່ງສ້ອມ ທີ່ເປີດໃຫ້ທຸກຄົນມາແຕ່ຕົ້ນ.
     */
    case "ods_tb_install":
      return `/installations/${resId}`;
    case "ar_customer":
      return `/customers/${resId}/edit`;
    // ຮ່າງຂໍລະຫັດອາໄຫຼ່ໃໝ່ຢູ່ຄົນລະຖານ (pp_od_manage) — ບໍ່ມີ chatter ຂອງມັນເອງ
    // ແຕ່ມີການແຈ້ງເຕືອນຫາສາງ ຈຶ່ງຕ້ອງມີບ່ອນໃຫ້ກົດເຂົ້າໄປເບິ່ງ
    case "ods_spare_draft":
      return "/spare-parts/new";
    default:
      return "#";
  }
}

/* ── ການແຈ້ງເຕືອນ (ods_notification) ─────────────────────────────── */

/**
 * ແທນ LINE Notify ຂອງ ods (ປິດບໍລິການ 31-03-2025) — ແຈ້ງເຕືອນໃນແອັບແທນ.
 * ແຈ້ງຫາ "ຜູ້ຕິດຕາມ" ຂອງເອກະສານນັ້ນ (ods_chatter_follower) ຍົກເວັ້ນຄົນທີ່ລົງມືເອງ
 * ບວກກັບຄົນທີ່ຖືກມອບໝາຍ ຫຼື ພະແນກທີ່ຕ້ອງລົງມືຕໍ່.
 */
export type NotificationKind = "log" | "comment" | "assign";

export const NOTIFICATION_KIND_LABEL: Record<NotificationKind, string> = {
  log: "ຄວາມເຄື່ອນໄຫວ",
  comment: "ຂໍ້ຄວາມ",
  assign: "ມອບໝາຍ",
};

export type Notification = {
  id: number;
  model: string;
  res_id: string;
  kind: NotificationKind;
  body: string;
  actor: string;
  created_at: string;
  read: boolean;
};

/**
 * ກຸ່ມຜູ້ຮັບຕາມໜ້າວຽກ.
 * ສາງ = ຄົນທີ່ຕ້ອງເບີກອາໄຫຼ່ໃຫ້ · ຜູ້ອະນຸມັດ = ຄົນທີ່ຕ້ອງອະນຸມັດໃບສະເໜີລາຄາ/ໃບຂໍຊື້.
 *
 * ຄົ້ນຫາຄົນຈາກ 2 ແຫຼ່ງ (ເບິ່ງ recipientsForRoles ໃນ actions/notification):
 *   ODS users.roles + ພະແນກ ERP (odg_employee) ຕາມ ERP_DEPARTMENT_ROLE ໃນ lib/roles.
 */
export const ROLE_WAREHOUSE = ["stock"];
export const ROLE_APPROVER = ["manager", "headtechnical"];

/* ── ຂໍ້ຄວາມ ─────────────────────────────────────────────────────── */

/** comment = ຄົນພິມເອງ · log = ລະບົບບັນທຶກໃຫ້ຕອນວຽກປ່ຽນຂັ້ນ */
export type MessageKind = "comment" | "log";

export type ChatterMessage = {
  id: number;
  kind: MessageKind;
  body: string;
  author: string;
  created_at: string;
};

/* ── ກິດຈະກຳ ─────────────────────────────────────────────────────── */

export type ActivityKind = "todo" | "call" | "visit" | "meeting";
export type ActivityState = "planned" | "done" | "cancelled";

export const ACTIVITY_KIND_LABEL: Record<ActivityKind, string> = {
  todo: "ສິ່ງທີ່ຕ້ອງເຮັດ",
  call: "ໂທຫາລູກຄ້າ",
  visit: "ລົງພື້ນທີ່",
  meeting: "ນັດພົບ",
};

export type Activity = {
  id: number;
  model: string;
  res_id: string;
  kind: ActivityKind;
  summary: string;
  note: string | null;
  assigned_to: string;
  due_date: string;
  state: ActivityState;
  created_by: string;
  /** ຈຳນວນມື້ຈົນຮອດກຳນົດ — ຕິດລົບ = ເລີຍກຳນົດແລ້ວ */
  days_left: number;
};

/** ສີຂອງກິດຈະກຳຕາມກຳນົດເວລາ — ຄື Odoo (ແດງ=ເລີຍກຳນົດ, ເຫຼືອງ=ມື້ນີ້, ຂຽວ=ຍັງມີເວລາ) */
export function activityTone(daysLeft: number) {
  if (daysLeft < 0) return { chip: "bg-red-100 text-red-700", dot: "bg-red-500", label: "ເລີຍກຳນົດ" };
  if (daysLeft === 0) return { chip: "bg-amber-100 text-amber-800", dot: "bg-amber-500", label: "ມື້ນີ້" };
  return { chip: "bg-emerald-50 text-emerald-700", dot: "bg-emerald-500", label: "ວາງແຜນໄວ້" };
}
