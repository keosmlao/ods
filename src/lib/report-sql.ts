import { query, queryOdg } from "@/lib/db";
import { INSTALL_STAGE_LABEL_SQL } from "@/lib/install-stage";
import { CANCELLED_JOBS, NOT_MISSING, STAGE_LABEL, STAGE_LABEL_SQL, STAGE_SQL } from "@/lib/stage";
import type { XlsxColumn } from "@/lib/xlsx";

/*
 * SQL ກາງຂອງລາຍງານທັງໝົດ (ໃຊ້ຮ່ວມກັນລະຫວ່າງໜ້າ report ແລະ route export Excel).
 * ຂໍ້ຜິດພາດຂອງລະບົບເກົ່າ (ods) ໄດ້ຮັບການແກ້ໄຂແລ້ວ — ເບິ່ງ comment "FIX:" ແຕ່ລະບ່ອນ.
 */

export type Row = Record<string, string | number | null>;

/** ຫົວຄໍລຳ (ຄັດລອກຈາກ template ຂອງ ods ຄຳຕໍ່ຄຳ) — ໃຊ້ຮ່ວມກັນທັງໜ້າຈໍ ແລະ Excel */
export const columns = {
  /** 27 ຄໍລຳ — /download/report/excel ແລະ ໜ້າ /reports/pending */
  pending: [
    { header: "ລຳດັບ", key: "rnum", width: 8 },
    { header: "ລະຫັດຮັບເຄື່ອງ", key: "code" },
    { header: "ລູກຄ້າ", key: "customer", width: 28 },
    { header: "ເບີໂທ", key: "tel" },
    { header: "ເຄື່ອງ", key: "product", width: 22 },
    { header: "sn", key: "sn" },
    { header: "model", key: "p_model" },
    { header: "brand", key: "p_brand" },
    { header: "acessory", key: "p_access" },
    { header: "warunty", key: "warrunty" },
    { header: "service_type", key: "service_type" },
    { header: "issue", key: "issue", width: 28 },
    { header: "do_ref", key: "doc_def" },
    { header: "ຜູ້ຮັບເຄື່ອງ", key: "user_regis" },
    { header: "ຊ່າງສ້ອມ", key: "emp_code" },
    { header: "ວັນທີຮັບ", key: "time_register", width: 20 },
    { header: "ວັນທີກວດເຊັກ", key: "time_check", width: 20 },
    { header: "ກວດເຊັກສຳເລັດ", key: "time_finish_check", width: 20 },
    { header: "ວັນທີສະເໜີລາຄາ", key: "qt_start", width: 20 },
    { header: "ສຳເລັດສະເໜີລາຄາ", key: "qt_finish", width: 20 },
    { header: "ຂໍເບີກອາໃຫຼ່", key: "spare_reg", width: 20 },
    { header: "ເບີກອາໃຫຼ່", key: "spare_finish", width: 20 },
    { header: "ສັ່ງອາໃຫຼ່", key: "spare_order", width: 20 },
    { header: "ສຳເລັດສັ່ງ", key: "spare_order_finish", width: 20 },
    { header: "ສ້ອມແປງ", key: "time_repair", width: 20 },
    { header: "ສຳເລັດສ້ອມ", key: "time_finish_repair", width: 20 },
    { header: "ສະຖານະ", key: "status_name" },
  ],
  /** ເພີ່ມ "ໃຊ້ໄລຍະເວລາ" — /report_rcpro + /report_rcprodate */
  receipts: [
    { header: "ລຳດັບ", key: "rnum", width: 8 },
    { header: "ລະຫັດຮັບເຄື່ອງ", key: "code" },
    { header: "ລູກຄ້າ", key: "customer", width: 28 },
    { header: "ເບີໂທ", key: "tel" },
    { header: "ເຄື່ອງ", key: "product", width: 22 },
    { header: "sn", key: "sn" },
    { header: "model", key: "p_model" },
    { header: "brand", key: "p_brand" },
    { header: "acessory", key: "p_access" },
    { header: "warunty", key: "warrunty" },
    { header: "service_type", key: "service_type" },
    { header: "issue", key: "issue", width: 28 },
    { header: "do_ref", key: "doc_def" },
    { header: "ຜູ້ຮັບເຄື່ອງ", key: "user_regis" },
    { header: "ຊ່າງສ້ອມ", key: "emp_code" },
    { header: "ວັນທີຮັບ", key: "time_register", width: 20 },
    { header: "ວັນທີກວດເຊັກ", key: "time_check", width: 20 },
    { header: "ກວດເຊັກສຳເລັດ", key: "time_finish_check", width: 20 },
    { header: "ວັນທີສະເໜີລາຄາ", key: "qt_start", width: 20 },
    { header: "ສຳເລັດສະເໜີລາຄາ", key: "qt_finish", width: 20 },
    { header: "ຂໍເບີກອາໃຫຼ່", key: "spare_reg", width: 20 },
    { header: "ເບີກອາໃຫຼ່", key: "spare_finish", width: 20 },
    { header: "ສັ່ງອາໃຫຼ່", key: "spare_order", width: 20 },
    { header: "ສຳເລັດສັ່ງ", key: "spare_order_finish", width: 20 },
    { header: "ສ້ອມແປງ", key: "time_repair", width: 20 },
    { header: "ສຳເລັດສ້ອມ", key: "time_finish_repair", width: 20 },
    { header: "ໃຊ້ໄລຍະເວລາ", key: "success", width: 20 },
    { header: "ສະຖານະ", key: "status_name" },
  ],
  /** 26 ຄໍລຳ — /download/report/excel_pending (ເຄື່ອງສົ່ງຄືນສຳເລັດ) */
  returned: [
    { header: "ລຳດັບ", key: "rnum", width: 8 },
    { header: "ລະຫັດຮັບເຄື່ອງ", key: "code" },
    { header: "ລູກຄ້າ", key: "customer", width: 28 },
    { header: "ເບີໂທ", key: "tel" },
    { header: "ເຄື່ອງ", key: "product", width: 22 },
    { header: "sn", key: "sn" },
    { header: "model", key: "p_model" },
    { header: "brand", key: "p_brand" },
    { header: "acessory", key: "p_access" },
    { header: "warunty", key: "warrunty" },
    { header: "service_type", key: "service_type" },
    { header: "issue", key: "issue", width: 28 },
    { header: "do_ref", key: "doc_def" },
    { header: "ຜູ້ຮັບເຄື່ອງ", key: "user_regis" },
    { header: "ຊ່າງສ້ອມ", key: "emp_code" },
    { header: "ວັນທີຮັບ", key: "time_register", width: 20 },
    { header: "ວັນທີກວດເຊັກ", key: "time_check", width: 20 },
    { header: "ກວດເຊັກສຳເລັດ", key: "time_finish_check", width: 20 },
    { header: "ວັນທີສະເໜີລາຄາ", key: "qt_start", width: 20 },
    { header: "ສຳເລັດສະເໜີລາຄາ", key: "qt_finish", width: 20 },
    { header: "ຂໍເບີກອາໃຫຼ່", key: "spare_reg", width: 20 },
    { header: "ເບີກອາໃຫຼ່", key: "spare_finish", width: 20 },
    { header: "ສັ່ງອາໃຫຼ່", key: "spare_order", width: 20 },
    { header: "ສຳເລັດສັ່ງ", key: "spare_order_finish", width: 20 },
    { header: "ສ້ອມແປງ", key: "time_repair", width: 20 },
    { header: "ສຳເລັດສ້ອມ", key: "time_finish_repair", width: 20 },
    { header: "ສົ່ງຄືນສຳເລັດ", key: "return_complete", width: 20 },
  ],
  /** ລາຍງານການຮັບເຄື່ອງສ້ອມປະຈຳວັນ */
  dailyReceipts: [
    { header: "#", key: "rnum", width: 6 },
    { header: "ວັນທີ", key: "registered", width: 20 },
    { header: "ລຸູກຄ້າ", key: "customer", width: 30 },
    { header: "ຊື່ເຄືອງ", key: "product", width: 30 },
    { header: "ຫຍີ່ຫໍ້", key: "p_brand" },
    { header: "ອຸປະກອນມາກັບເຄື່ອງ", key: "p_access", width: 24 },
    { header: "ອາການເບື້ອງຕົ້ນ", key: "issue", width: 28 },
    { header: "ການຮັບປະກັນ", key: "warrunty" },
    { header: "ບໍລິການ", key: "service_type" },
  ],
  /** ລາຍງານການຍົກເລີກບິນສ້ອມ */
  cancelled: [
    { header: "#", key: "rnum", width: 6 },
    { header: "ເລກບີນ", key: "code" },
    { header: "ວັນທີ", key: "cancelled_at" },
    { header: "ລຸູກຄ້າ", key: "customer", width: 30 },
    { header: "ຊື່ເຄືອງ", key: "product", width: 30 },
    { header: "ອາການເບື້ອງຕົ້ນ", key: "issue", width: 28 },
    { header: "ການຮັບປະກັນ", key: "warrunty" },
    { header: "ບໍລິການ", key: "service_type" },
    { header: "ຜູ້ຂໍຍົກເລີກ", key: "request_cancel" },
    { header: "ຜູ້ອະນຸມັດ", key: "approve_cancel" },
  ],
  /** ລາຍງານການກວດເຊັກປະຈຳວັນ */
  checking: [
    { header: "#", key: "rnum", width: 6 },
    { header: "ເລກບີນ", key: "doc_no", width: 18 },
    { header: "ວັນທີ", key: "doc_date" },
    { header: "ໃບຮັບເຄື່ອງ", key: "receipt_no" },
    { header: "ວັນທີ", key: "receipt_date" },
    { header: "ລຸູກຄ້າ", key: "customer", width: 30 },
    { header: "ເຄື່ອງ", key: "product", width: 30 },
    { header: "ອາການເບື້ອງຕົ້ນ", key: "issue", width: 28 },
    { header: "ຮັບປະກັນ", key: "warrunty" },
    { header: "ອາການຊ່າງ", key: "issue_2", width: 28 },
    { header: "ຊ່າງສ້ອມ", key: "emp_code" },
    { header: "ອາໄຫຼ່", key: "used_spare" },
  ],
  /** ລາຍງານການເບີກອາໄຫຼ່ (job dispatch) */
  jobDispatch: [
    { header: "#", key: "rnum", width: 6 },
    { header: "ວັນທີເບີກ", key: "doc_date" },
    { header: "ເລກທີເບີກ", key: "doc_no", width: 18 },
    { header: "ລະຫັດ", key: "item_code" },
    { header: "ຊື່ອາໄຫຼ່", key: "item_name", width: 34 },
    { header: "ຈຳນວນ", key: "qty" },
    { header: "ຫົວໜ່ວຍ", key: "unit_code" },
    { header: "ລະຫັດຮັບເຄື່ອງ", key: "product_code" },
    { header: "ລູກຄ້າ", key: "customer", width: 28 },
    { header: "ຊື່ເຄືອງ", key: "product", width: 24 },
    { header: "sn", key: "sn" },
    { header: "model", key: "p_model" },
    { header: "brand", key: "p_brand" },
    { header: "acessory", key: "p_access" },
    { header: "warunty", key: "warrunty" },
    { header: "issue", key: "issue", width: 26 },
    { header: "ເລກທີຂໍເບີກ", key: "doc_ref", width: 18 },
    { header: "ຜູ້ຂໍເບີກ", key: "requester" },
    { header: "ຜູ້ເບີກ", key: "user_created" },
  ],
  /** ລາຍງານສິນຄ້າໃນສາງສ້ອມທັງໝົດ */
  stock: [
    { header: "#", key: "rnum", width: 6 },
    { header: "ລະຫັດ", key: "code" },
    { header: "ລາຍການ", key: "product", width: 26 },
    { header: "ໝາຍເລກເຄື່ອງ", key: "sn", width: 22 },
    { header: "ອາການເພ", key: "issue", width: 30 },
    { header: "ລູກຄ້າ", key: "customer", width: 30 },
    { header: "ສະຖານະ", key: "status_name" },
  ],
  /** ໃບຂໍເບີກ / ໃບເບີກອາໄຫຼ່ */
  spareRequests: [
    { header: "#", key: "rnum", width: 6 },
    { header: "ເລກບີນ", key: "doc_no", width: 18 },
    { header: "ວັນທີ", key: "doc_date" },
    /** ເມື່ອກ່ອນສະແດງເລກ RQ (ຜິດຫົວຖັນ) — RQ ຖືກຍົກເລີກແລ້ວ, ດຽວນີ້ຄືລະຫັດວຽກ = ໃບຮັບເຄື່ອງແທ້ */
    { header: "ໃບຮັບເຄື່ອງ", key: "doc_ref", width: 18 },
    { header: "ວັນທີຮັບເຄື່ອງ", key: "doc_ref_date" },
    { header: "ລຸູກຄ້າ", key: "customer", width: 28 },
    { header: "ເຄື່ອງ", key: "product", width: 24 },
    { header: "ອາການເບື້ອງຕົ້ນ", key: "issue", width: 26 },
    { header: "ຮັບປະກັນ", key: "warrunty" },
    { header: "ອາການຊ່າງ", key: "issue_2", width: 26 },
    { header: "ໝາຍເຫດ", key: "remark", width: 26 },
    { header: "ຜູ້ສ້າງ", key: "user_created" },
  ],
  /** ລາຍງານການສັ່ງຊື້ອາໄຫຼ່ (ODS, trans_flag = 2) */
  purchaseOrders: [
    { header: "#", key: "rnum", width: 6 },
    { header: "ເລກບີນ", key: "doc_no", width: 18 },
    { header: "ວັນທີ", key: "doc_date" },
    /** ເມື່ອກ່ອນສະແດງເລກ RQ (ຜິດຫົວຖັນ) — RQ ຖືກຍົກເລີກແລ້ວ, ດຽວນີ້ຄືລະຫັດວຽກ = ໃບຮັບເຄື່ອງແທ້ */
    { header: "ໃບຮັບເຄື່ອງ", key: "doc_ref", width: 18 },
    { header: "ວັນທີຮັບເຄື່ອງ", key: "doc_ref_date" },
    { header: "ລຸູກຄ້າ", key: "customer", width: 28 },
    { header: "ເຄື່ອງ", key: "product", width: 24 },
    { header: "ອາການເບື້ອງຕົ້ນ", key: "issue", width: 26 },
    { header: "ຮັບປະກັນ", key: "warrunty" },
    { header: "ອາການຊ່າງ", key: "issue_2", width: 26 },
    { header: "ຊ່າງສ້ອມ", key: "emp_code" },
    { header: "ໝາຍເຫດ", key: "remark", width: 26 },
    { header: "ຜູ້ສ້າງ", key: "user_created" },
  ],
  /** ລາຍງານການສະເໜີຊື້ (ERP) */
  purchaseRequests: [
    { header: "ລຳດັບ", key: "rnum", width: 8 },
    { header: "ເລກທີສະເໜີຊຶ້", key: "doc_no", width: 18 },
    { header: "ວັນທີສະເໜີຊຶ້", key: "pr_date", width: 16 },
    { header: "ເລກທີອະນຸມັດສະເໜີຊຶ້", key: "pra_no", width: 22 },
    { header: "ວັນທີອະນຸມັດສະເໜີຊຶ້", key: "pra_date", width: 20 },
    { header: "ເລກທີສັ່ງຊຶ້", key: "po_no", width: 18 },
    { header: "ວັນທີສັ່ງຊຶ້", key: "po_date", width: 16 },
    { header: "ເລກທີຮັບເຂົ້າ", key: "pi_no", width: 18 },
    { header: "ວັນທີຮັບເຂົ້າ", key: "pi_date", width: 16 },
    { header: "ໄລຍະເວລາອະນຸມັດສະເໜີຊຶ້ (ວັນ)", key: "time_for_pra", width: 16 },
    { header: "ໄລຍະເວລາສັ່ງຊຶ້ (ວັນ)", key: "time_for_po", width: 16 },
    { header: "ໄລຍະເວລາຮັບເຂົ້າ (ວັນ)", key: "time_used", width: 16 },
    { header: "ສະຖານະ", key: "pr_status", width: 22 },
  ],
  /** 22 ຄໍລຳ — /report_pd_install */
  installations: [
    { header: "ລຳດັບ", key: "rnum", width: 8 },
    { header: "ວັນ/ເວລາເປີດງານ", key: "time_register", width: 20 },
    { header: "ລະຫັດຕິດຕັ້ງ", key: "code" },
    { header: "ລູກຄ້າ", key: "customer", width: 28 },
    { header: "ເບີໂທ", key: "tel" },
    { header: "ນັດຕິດຕັ້ງ", key: "appoint_date" },
    { header: "ສະຖານທີ່ຕິດຕັ້ງ", key: "location_inst", width: 26 },
    { header: "ວັນທີບີນຂາຍ", key: "doc_ref_date" },
    { header: "ເລກບີນຂາຍ", key: "doc_ref_1" },
    { header: "ລາຍການຕິດຕັ້ງ", key: "item_name", width: 30 },
    { header: "ຍີ່ຫໍ້", key: "pro_brand" },
    { header: "model", key: "pro_model" },
    { header: "sn", key: "pro_sn" },
    { header: "ປະເພດ", key: "pro_type" },
    { header: "ຂະໜາດ", key: "pro_size" },
    { header: "ຊ່າງ", key: "tech_code" },
    { header: "ຜູ້ສ້າງ", key: "user_created" },
    { header: "ສະຖານະ", key: "status_name", width: 20 },
    { header: "ວັນທີປິດງານ", key: "job_finish", width: 20 },
    { header: "ໄລຍະເວລາໃນການຕິດຕັ້ງ", key: "duration", width: 20 },
    { header: "ຮອດປັດຈູບັນ", key: "remaining", width: 20 },
    { header: "ໝາຍເຫດ", key: "remark", width: 26 },
  ],
  /** ລາຍງານຄວາມພໍໃຈຂອງລູກຄ້າ */
  feedback: [
    { header: "ລຳດັບ", key: "rnum", width: 8 },
    { header: "ລະຫັດຕິດຕັ້ງ", key: "code" },
    { header: "ວັນ/ເວລາເປີດງານ", key: "time_register", width: 20 },
    { header: "ລູກຄ້າ", key: "customer", width: 28 },
    { header: "ນັດຕິດຕັ້ງ", key: "appoint_date" },
    { header: "ເລກບີນຂາຍ", key: "doc_ref_1" },
    { header: "ລາຍການຕິດຕັ້ງ", key: "item_name", width: 30 },
    { header: "ການແຕ່ງກາຍຂອງຊ່າງ", key: "question_1", width: 18 },
    { header: "ຄວາມສຸພາບຮຽບຮ້ອຍ", key: "question_2", width: 18 },
    { header: "ຄວາມສະອາດໜ້າງານ", key: "question_3", width: 18 },
    { header: "ຄວາມສວຍງາມໃນການຕິດຕັ້ງ", key: "question_4", width: 20 },
    { header: "ແນະນຳວິທີການໃຊ້ງານ", key: "question_5", width: 18 },
    { header: "ຊ່າງ", key: "tech_code" },
    { header: "ຕິດຕັ້ງສຳເລັດ", key: "finish_install", width: 20 },
    { header: "ຄຳຕິຊົມ", key: "complain_cust", width: 30 },
  ],
} satisfies Record<string, XlsxColumn[]>;

/** ປ່ຽນ XlsxColumn → column ຂອງ DataTable */
export const toTableColumns = (list: readonly XlsxColumn[]) => list.map(({ key, header }) => ({ key, label: header }));

export const todayIso = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });

/** searchParams ຂອງ Next ອາດເປັນ array — ເອົາຄ່າທຳອິດ */
export type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;
export const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/** ຮັບຄ່າວັນທີຈາກ URL — ຖ້າບໍ່ຖືກຮູບແບບ YYYY-MM-DD ໃຫ້ໃຊ້ຄ່າ default */
export function safeDate(value: string | undefined, fallback = todayIso()) {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : fallback;
}

/**
 * ຄົ້ນຫາໃນແຖວທີ່ດຶງມາແລ້ວ — ໃຊ້ຮ່ວມກັນລະຫວ່າງຊ່ອງ "ຄົ້ນຫາ" ຂອງ ReportShell ແລະ route export Excel
 * ເພື່ອຮັບປະກັນວ່າໄຟລ໌ Excel ໄດ້ແຖວຊຸດດຽວກັນ (ແລະ ຈຳນວນດຽວກັນ) ກັບທີ່ເຫັນຢູ່ໜ້າຈໍ.
 */
export function searchRows(rows: Row[], keys: string[], q: string): Row[] {
  const needle = q.trim().toLowerCase();
  if (!needle) return rows;
  return rows.filter((row) => keys.some((key) => String(row[key] ?? "").toLowerCase().includes(needle)));
}

/* ---------------------------------------------------------------- ສະຖານະສ້ອມ */
/**
 * ຊື່ຂັ້ນ — ດຶງຈາກ `STAGE_LABEL_SQL` ບ່ອນດຽວ.
 * ແຕ່ກ່ອນຂຽນ `case … when 10 then 'ລໍຖ້າສົ່ງຄືນ' …` ໄວ້ບ່ອນນີ້ເອງ ⇒ ພໍເພີ່ມຂັ້ນ QC
 * ເລກເລື່ອນ ແຕ່ບ່ອນນີ້ບໍ່ໄດ້ເລື່ອນນຳ: ງານທີ່ລໍກວດ QC ຖືກລາຍງານວ່າ "ສົ່ງຄືນແລ້ວ".
 */
const statusName = `${STAGE_LABEL_SQL} as status_name`;

/** ຄໍລຳວັນ/ເວລາຂອງແຕ່ລະຂັ້ນຕອນ — ໃຊ້ text ເພື່ອສະແດງຜົນ */
const stageTimes = `to_char(a.time_register,'DD-MM-YYYY HH24:MI:SS') time_register,
  to_char(a.time_check,'DD-MM-YYYY HH24:MI:SS') time_check,
  to_char(a.time_finish_check,'DD-MM-YYYY HH24:MI:SS') time_finish_check,
  to_char(a.qt_start,'DD-MM-YYYY HH24:MI:SS') qt_start,
  to_char(a.qt_finish,'DD-MM-YYYY HH24:MI:SS') qt_finish,
  to_char(a.spare_reg,'DD-MM-YYYY HH24:MI:SS') spare_reg,
  to_char(a.spare_finish,'DD-MM-YYYY HH24:MI:SS') spare_finish,
  to_char(a.spare_order,'DD-MM-YYYY HH24:MI:SS') spare_order,
  to_char(a.spare_order_finish,'DD-MM-YYYY HH24:MI:SS') spare_order_finish,
  to_char(a.time_repair,'DD-MM-YYYY HH24:MI:SS') time_repair,
  to_char(a.time_finish_repair,'DD-MM-YYYY HH24:MI:SS') time_finish_repair`;

const productBase = `row_number() over (order by a.time_register) rnum,
  a.code, b.name_1 customer, b.tel, a.name_1 product, a.sn, a.p_model, a.p_brand, a.p_access,
  a.warrunty, a.service_type, a.issue, a.doc_def, a.user_regis, a.emp_code,
  ${stageTimes},
  ${statusName}
  from tb_product a
  left join ar_customer b on b.code = a.cust_code`;

/* ---------------------------------------------------------- 1. ລາຍງານເຄື່ອງຄ້າງ
 * ods: /report_pending (POST) + /report_allpd
 * FIX: GET branch ຂອງ ods ອ້າງອີງຕົວແປ `today` ທີ່ບໍ່ໄດ້ປະກາດ → NameError → ໜ້າວ່າງສະເໝີ.
 */
export async function fetchPending(from: string, to: string, all: boolean) {
  const where = `where a.return_complete isnull and a.status <> 6 and ${NOT_MISSING}`;
  const sql = all
    ? `select ${productBase} ${where} order by a.time_register`
    : `select ${productBase} ${where} and a.time_register::date between $1 and $2 order by a.time_register`;
  return (await query<Row>(sql, all ? [] : [from, to])).rows;
}

/* ------------------------------------------------- 2. ລາຍງານການຮັບເຄື່ອງ / ໄລຍະເວລາ
 * ods: /report_rcpro
 * FIX: SQL ຂອງ GET branch ຂຽນຜິດ (`where order by ...`) ແລະ ໃຊ້ຕົວແປ `today` ທີ່ບໍ່ມີ.
 */
export async function fetchReceiptTurnaround(from: string, to: string) {
  const sql = `select ${productBase.replace(
    "from tb_product a",
    `, (a.return_complete - a.time_register)::text success from tb_product a`,
  )}
    where a.time_register::date between $1 and $2 order by a.time_register`;
  return (await query<Row>(sql, [from, to])).rows;
}

/* ------------------------------------------------- 3. ລາຍງານການຮັບເຄື່ອງສ້ອມປະຈຳວັນ
 * ods: /pdrc_daily_rp + /printpdrcd/<from>/<to>
 * FIX: ods ໃຊ້ to_char(..,'DD-MM-YYY ..') → ປີເຫຼືອ 3 ຫຼັກ ("026"). ແກ້ເປັນ YYYY.
 */
export async function fetchDailyReceipts(from: string, to: string) {
  const rows = (
    await query<Row>(
      `select row_number() over (order by a.time_register) rnum,
        to_char(a.time_register,'DD-MM-YYYY HH24:MI:SS') registered,
        coalesce(b.name_1,'') || ' - ' || coalesce(b.tel,'') customer,
        coalesce(a.name_1,'') || ' - ' || coalesce(a.sn,'') product,
        a.p_brand, a.p_access, a.issue, a.warrunty, a.service_type
       from tb_product a
       left join ar_customer b on b.code = a.cust_code
       where a.time_register::date between $1 and $2
       order by a.time_register`,
      [from, to],
    )
  ).rows;
  const summary = (
    await query<Row>(
      `select s.code, s.name_1,
        (select count(*) from tb_product p where p.service_type = s.code and p.time_register::date between $1 and $2) qty
       from tb_service_type s order by s.roworder`,
      [from, to],
    )
  ).rows;
  return { rows, summary };
}

/* --------------------------------------------------- 4. ລາຍງານການຍົກເລີກບິນສ້ອມ
 * ods: /ccrcpd_daily_rp
 * FIX ①: ods ດຶງຈາກ ic_trans where trans_flag=11 — ຖານຂໍ້ມູນບໍ່ມີ trans_flag=11 ຈັກແຖວ → ວ່າງສະເໝີ.
 *        ການຍົກເລີກຖືກເກັບໄວ້ໃນ tb_product (cancel_start / cancel_finish / status=6).
 * FIX ②: ods ໃຊ້ template daily_report.html (7 ຄໍລຳ) ຮ່ວມກັບ query 8 ຄໍລຳ → ຂໍ້ມູນເລື່ອນຜິດຊ່ອງ.
 *        ໃຊ້ຫົວຄໍລຳຂອງ ccrcpddaily_report.html ທີ່ຖືກຕ້ອງແທນ.
 */
export async function fetchCancelledReceipts(from: string, to: string) {
  const rows = (
    await query<Row>(
      `select row_number() over (order by a.cancel_finish desc) rnum,
        a.code,
        to_char(a.cancel_finish,'DD-MM-YYYY') cancelled_at,
        coalesce(b.name_1,'') || ' - ' || coalesce(b.tel,'') customer,
        coalesce(a.name_1,'') || ' - ' || coalesce(a.sn,'') product,
        a.issue, a.warrunty, a.service_type, a.request_cancel, a.approve_cancel
       from tb_product a
       left join ar_customer b on b.code = a.cust_code
       where a.cancel_finish notnull and a.cancel_finish::date between $1 and $2
       order by a.cancel_finish desc`,
      [from, to],
    )
  ).rows;
  const summary = (
    await query<Row>(
      `select s.code, s.name_1,
        (select count(*) from tb_product p
          where p.service_type = s.code and p.cancel_finish notnull and p.cancel_finish::date between $1 and $2) qty
       from tb_service_type s order by s.roworder`,
      [from, to],
    )
  ).rows;
  return { rows, summary };
}

/* ---------------------------------------------------- 5. ລາຍງານການກວດເຊັກປະຈຳວັນ
 * ods: /checking_report + /checking_reportprint (122) + /checking_reportprint1 (56)
 * FIX ①: check_report.py:52 render `listbill=""` → ຖິ້ມຜົນ query ຂອງຕົນເອງ. ໜ້ານີ້ພັງທັງໝົດ.
 * FIX ②: `where trans_flag='12'` — ຖານຂໍ້ມູນມີແຕ່ 2,17,44,56,58,59,78,122,166. ບໍ່ມີ 12 → 0 ແຖວ.
 *        ເລືອກ 122 (ໃບຂໍເບີກ SIO) ເປັນຄ່າຕັ້ງຕົ້ນ ຕາມປຸ່ມພິມດຽວທີ່ template ມີ; 56 (ໃບເບີກ SWC) ເລືອກໄດ້.
 * FIX ③: `case when used_spare=0` — ທັງ ic_trans ແລະ tb_product ມີຄໍລຳ used_spare
 *        → PostgreSQL error "column reference used_spare is ambiguous" (ຖືກ bare except ກືນ).
 * FIX ④: ic_trans.cust_code / .emp / .isue_2 / .wanrunty ເປັນ null ທຸກແຖວ → ດຶງຈາກ tb_product ແທນ.
 */
export const checkingFlags = { "122": "ໃບຂໍເບີກອາໄຫຼ່", "56": "ໃບເບີກອາໄຫຼ່" } as const;
export type CheckingFlag = keyof typeof checkingFlags;
export const safeFlag = (value: string | undefined): CheckingFlag => (value === "56" ? "56" : "122");

export async function fetchChecking(from: string, to: string, flag: CheckingFlag) {
  return (
    await query<Row>(
      `select row_number() over (order by a.doc_date, a.doc_no) rnum,
        a.doc_no,
        to_char(a.doc_date,'DD-MM-YYYY') doc_date,
        c.code receipt_no,
        to_char(c.time_register,'DD-MM-YYYY') receipt_date,
        coalesce(b.name_1,'') || ' - ' || coalesce(b.tel,'') customer,
        coalesce(c.name_1,'') || ' - ' || coalesce(c.sn,'') product,
        c.issue, c.warrunty, c.issue_2, c.emp_code,
        case when c.used_spare = 0 then 'ບໍໃຊ້ອາໄຫຼ່' else 'ໃຊ້ອາໄຫຼ່' end used_spare
       from ic_trans a
       join tb_product c on c.code = a.product_code
       left join ar_customer b on b.code = c.cust_code
       where a.trans_flag = $1 and a.doc_date between $2 and $3
       order by a.doc_date, a.doc_no`,
      [Number(flag), from, to],
    )
  ).rows;
}

/* -------------------------------------------------------- 6. ລາຍງານການເບີກອາໄຫຼ່
 * ods: /report_job_dispatch + /report_sv_home + /report_jdispatch
 * FIX: ods left-join ພຽງ tb_product → ແຖວຂອງງານຕິດຕັ້ງ (product_code = INST-xxxx) ສະແດງລູກຄ້າ/ເຄື່ອງເປົ່າ.
 *      ເພີ່ມ join ods_tb_install ເພື່ອໃຫ້ຄົບທຸກແຖວ.
 */
export async function fetchJobDispatch(productCode: string) {
  const filtered = productCode.trim().length > 0;
  const sql = `select row_number() over (order by a.roworder) rnum,
      to_char(a.doc_date,'DD-MM-YYYY') doc_date, a.doc_no, a.item_code, a.item_name, a.qty::text qty, a.unit_code,
      a.product_code,
      coalesce(cr.name_1, ci.name_1) customer,
      coalesce(p.name_1, i.item_name) product,
      coalesce(p.sn, i.pro_sn) sn,
      coalesce(p.p_model, i.pro_model) p_model,
      coalesce(p.p_brand, i.pro_brand) p_brand,
      p.p_access, p.warrunty, p.issue,
      a.doc_ref,
      (select t.user_created from ic_trans t where t.doc_no = a.doc_ref) requester,
      a.user_created
    from ic_trans_detail a
    left join tb_product p on p.code = a.product_code
    left join ods_tb_install i on i.code = a.product_code
    left join ar_customer cr on cr.code = p.cust_code
    left join ar_customer ci on ci.code = i.cust_code
    where a.doc_no like 'SWC%' and a.trans_flag = 56${filtered ? " and a.product_code = $1" : ""}
    order by a.roworder desc`;
  return (await query<Row>(sql, filtered ? [productCode.trim()] : [])).rows;
}

/** ລາຍການເຄື່ອງສ້ອມສຳລັບເລືອກໃນ dropdown ຂອງ /reports/job-dispatch */
export async function fetchDispatchProducts() {
  return (
    await query<Row>(
      `select a.code, coalesce(a.name_1,'') || ' - ' || coalesce(a.sn,'') || ' (' || coalesce(b.name_1,'-') || ')' as label
       from tb_product a
       left join ar_customer b on b.code = a.cust_code
       order by a.roworder desc limit 500`,
    )
  ).rows;
}

/* --------------------------------------------------------------- 7. ລາຍງານສາງ
 * ods: /stockall, /stock_dp_rp, /stock_dp1_rp, /home_rq_print, /home_rq1_print
 * FIX ①: stock_print.py:71-77 — /stock_dp_rp POST ອ່ານ from_date/to_date ແຕ່ SQL ຂຽນ
 *        `doc_date=current_date` ໂດຍບໍ່ມີ placeholder ແລ້ວສົ່ງ 2 params → psycopg2 error
 *        ("query has no placeholders") → ຖືກ bare except ກືນ → ໜ້າວ່າງ.
 * FIX ②: /stockall POST ໃຊ້ trans_flag=11 (ບໍ່ມີໃນຖານຂໍ້ມູນ) → ວ່າງສະເໝີ.
 *        ໜ້າ "ສິນຄ້າໃນສາງ" ຄວນເປັນລາຍການ tb_product ທີ່ຍັງຢູ່ໃນສາງ (ຄື GET branch).
 * FIX ③: /stockall GET ມີ `when status=3` ຊ້ຳກັນ 2 ເທື່ອ → 'ກຳລັງສ້ອມແປງ' ບໍ່ເຄີຍອອກ.
 *        ໃຊ້ຕາຕະລາງ product_status ແທນການ hard-code.
 * FIX ④: ic_trans.cust_code null ທຸກແຖວ → ດຶງລູກຄ້າຜ່ານ tb_product.
 * FIX ⑤: ຕາຕະລາງ "ສະຫຼຸບ" ນັບຄົນລະຊຸດກັບຕາຕະລາງ:
 *          · ຕາຕະລາງ = tb_product ທີ່ status <> 5 (ຍັງບໍ່ໄດ້ສົ່ງລູກຄ້າ)
 *          · ສະຫຼຸບເກົ່າ = ນັບທຸກ status ຂອງ tb_product ທັງໝົດ ລວມ status=5 ນຳ
 *        ຜົນ: ສະຫຼຸບໂຊ 'ສົ່ງລູກຄ້າ' 4,323 ໃບ ທັງທີ່ບໍ່ມີໃນຕາຕະລາງຈັກໃບ ແລະ ຕົກຫຼົ່ນ 563 ໃບ
 *        ທີ່ status=6 (ຍົກເລີກ — ບໍ່ມີໃນຕາຕະລາງ product_status) ເຊິ່ງຢູ່ໃນຕາຕະລາງ.
 *        ລວມກັນແລ້ວສະຫຼຸບບໍ່ເທົ່າຈຳນວນແຖວເລີຍ (179 ຕໍ່ 742).
 *        ແກ້: ນັບຈາກຊຸດແຖວດຽວກັນກັບຕາຕະລາງ ແລະ ຕັ້ງຊື່ status=6 ວ່າ 'ຍົກເລີກ' → ລວມ = 742 ພໍດີ.
 */
const stockStatusName = `coalesce(s.name_1, case when a.status = 6 then 'ຍົກເລີກ' else '-' end)`;

export async function fetchStockAll() {
  const rows = (
    await query<Row>(
      `select row_number() over (order by a.roworder) rnum, a.code, a.name_1 product, a.sn, a.issue,
        coalesce(b.name_1,'') || ' - ' || coalesce(b.tel,'') customer,
        ${stockStatusName} status_name
       from tb_product a
       left join ar_customer b on b.code = a.cust_code
       left join product_status s on s.code::int = a.status
       where a.status <> 5
       order by a.roworder desc`,
    )
  ).rows;
  const summary = (
    await query<Row>(
      `select min(a.status)::text code, ${stockStatusName} name_1, count(*)::text qty
       from tb_product a
       left join product_status s on s.code::int = a.status
       where a.status <> 5
       group by ${stockStatusName}
       order by min(a.status)`,
    )
  ).rows;
  return { rows, summary };
}

export const spareFlags = { "122": "ໃບຂໍເບີກອາໄຫຼ່", "56": "ໃບເບີກອາໄຫຼ່" } as const;

export async function fetchSpareRequests(from: string, to: string, flag: CheckingFlag) {
  return (
    await query<Row>(
      `select row_number() over (order by a.doc_date, a.doc_no) rnum,
        a.doc_no,
        to_char(a.doc_date,'DD-MM-YYYY') doc_date,
        a.doc_ref,
        to_char(a.doc_ref_date::date,'DD-MM-YYYY') doc_ref_date,
        coalesce(b.name_1,'-') customer,
        coalesce(p.name_1,'-') product,
        p.issue, p.warrunty, p.issue_2,
        a.remark, a.user_created
       from ic_trans a
       left join tb_product p on p.code = a.product_code
       left join ar_customer b on b.code = p.cust_code
       where a.trans_flag = $1 and a.doc_date between $2 and $3
       order by a.doc_date desc, a.doc_no`,
      [Number(flag), from, to],
    )
  ).rows;
}

/* ------------------------------------------------------- 8. ລາຍງານການສະເໜີຊື້ (ERP)
 * ods: /report_request_order (getcursor2 = ຖານຂໍ້ມູນ ERP)
 * FIX ①: GET branch ອ້າງອີງ `today` ກ່ອນປະກາດໃນບາງເສັ້ນທາງ → ໃຊ້ວັນທີມື້ນີ້ເປັນຄ່າຕັ້ງຕົ້ນ.
 * FIX ②: ods ຂຽນ `b.doc_date as po_date` (copy-paste ຈາກ pra_date) — ຄວນເປັນ `c.doc_date`.
 *        ຜົນ: ວັນທີສັ່ງຊື້ສະແດງເປັນວັນອະນຸມັດ ແລະ ສະຖານະ 'ລໍຖ້າສັ່ງຊື້' ບໍ່ເຄີຍເກີດຂຶ້ນເລີຍ.
 */
const sprBase = `select a.doc_no,
    coalesce(a.doc_date, current_date) pr_date,
    coalesce(b.doc_no::text,'ລໍດຳເນີນການ') pra_no, b.doc_date pra_date,
    coalesce(c.doc_no::text,'ລໍດຳເນີນການ') po_no, c.doc_date po_date,
    coalesce(d.doc_no::text,'ລໍດຳເນີນການ') pi_no, d.doc_date pi_date,
    coalesce(b.doc_date, current_date) - a.doc_date time_for_pra,
    coalesce(c.doc_date, current_date) - a.doc_date time_for_po,
    coalesce(d.doc_date, current_date) - a.doc_date time_used
  from ic_trans a
  left join ic_trans_detail b on b.ref_doc_no = a.doc_no
  left join ic_trans_detail c on c.ref_doc_no = b.doc_no
  left join ic_trans_detail d on d.ref_doc_no = c.doc_no
  where a.doc_format_code = 'SPR'
  group by a.doc_no, b.doc_no, c.doc_no, d.doc_no, a.doc_date, b.doc_date, c.doc_date, d.doc_date`;

const sprStatus = `case
  when pra_date isnull and po_date isnull and pi_date isnull then 'ລໍຖ້າອະນຸມັດສະເໜີຊື້'
  when pra_date notnull and po_date isnull and pi_date isnull then 'ລໍຖ້າສັ່ງຊື້'
  when pra_date notnull and po_date notnull and pi_date isnull then 'ລໍຖ້າຮັບເຄື່ອງເຂົ້າ'
  when pra_date notnull and po_date notnull and pi_date notnull then 'ຮັບເຄື່ອງເຂົ້າແລ້ວ'
  else '-' end pr_status`;

export type PurchaseRequestType = "no_product" | "product";
export const safeReportType = (value: string | undefined): PurchaseRequestType => (value === "product" ? "product" : "no_product");

/** ໝາຍເຫດ: ໂໝດ "ສະແດງລາຍລະອຽດ" ແຊກແຖວລາຍການສິນຄ້າໄວ້ໃຕ້ແຕ່ລະໃບສະເໜີຊື້ (ຄືກັບ ods) */
export async function fetchPurchaseRequests(from: string | null, to: string | null, type: PurchaseRequestType) {
  const ranged = from !== null && to !== null;
  const where = ranged ? `where z.pr_date::date between $1 and $2` : "";
  const head = `select row_number() over (order by z.pr_date, z.doc_no)::text rnum,
      z.doc_no, z.pr_date::text pr_date, z.pra_no, z.pra_date::text pra_date, z.po_no, z.po_date::text po_date,
      z.pi_no, z.pi_date::text pi_date, z.time_for_pra::text time_for_pra, z.time_for_po::text time_for_po,
      z.time_used::text time_used, ${sprStatus}
    from (${sprBase}) z ${where}`;

  if (type === "no_product") {
    return (await queryOdg<Row>(`${head} order by z.pr_date, z.doc_no`, ranged ? [from, to] : [])).rows;
  }

  const detailWhere = ranged ? `where doc_no like $3 and doc_date between $1 and $2` : `where doc_no like $1`;
  const detail = `select '' rnum, doc_no, doc_date::text pr_date, item_code pra_no, item_name pra_date,
      qty::text po_no, unit_code po_date, '' pi_no, '' pi_date, '' time_for_pra, '' time_for_po, '' time_used, '' pr_status
    from ic_trans_detail ${detailWhere}`;
  const params = ranged ? [from, to, "SPR2%"] : ["SPR2%"];
  return (
    await queryOdg<Row>(`select * from ((${head}) union all (${detail})) tb order by tb.pr_date, tb.doc_no, tb.rnum desc`, params)
  ).rows;
}

/* -------------------------------------------------------- 9. ລາຍງານການສັ່ງຊື້ອາໄຫຼ່
 * ods: /purchase_order_rp (orderspare.py) — trans_flag=2 (SPR)
 *
 * ── ⚠️ ຍ້າຍມາອ່ານ **ERP** ແລ້ວ (17-07-2026) ──
 * ຮຸ່ນເກົ່າອ່ານ `ic_trans` ຂອງ **ODS** ເຊິ່ງ**ຢຸດຮັບໃບໃໝ່ຕັ້ງແຕ່ 16-07-2026** ຕອນຍ້າຍ
 * ການອອກໃບໄປ ERP ບ່ອນດຽວ (ນະໂຍບາຍ "ທຸກຢ່າງຢູ່ ERP") ⇒ ລາຍງານຄ້າງຢູ່ 10-07-2026
 * ໂດຍທີ່ຄົນເປີດເບິ່ງບໍ່ຮູ້ວ່າຂາດ — ອັນຕະລາຍກວ່າລາຍງານທີ່ພັງ.
 *
 * ຂ້າມຖານ join ບໍ່ໄດ້ (ໃບຢູ່ ERP · ຂໍ້ມູນວຽກ/ລູກຄ້າຢູ່ ODS) ⇒ ດຶງສອງເທື່ອແລ້ວປະສານໃນ Node
 * ຄືທີ່ lib/erp-purchase ເຮັດ. ລະຫັດວຽກຢູ່ `doc_ref` ຂອງ ERP (ERP ບໍ່ມີ product_code).
 */

/** ໃບເກົ່າ doc_ref ເປັນເລກ RQ/ຂໍ້ຄວາມ — ເອົາສະເພາະທີ່ເປັນລະຫັດວຽກແທ້ໄປຫາຂໍ້ມູນວຽກ */
const isJobRef = (value: string) => /^(\d+|INST-\w+)$/.test(value);

type SprHeadRow = {
  doc_no: string;
  doc_date: string;
  job: string;
  doc_ref_date: string | null;
  remark: string | null;
  user_created: string | null;
};

type JobInfoRow = {
  code: string;
  customer: string | null;
  product: string | null;
  issue: string | null;
  warrunty: string | null;
  issue_2: string | null;
  emp_code: string | null;
  doc_ref_date: string | null;
};

export async function fetchPurchaseOrders(from: string, to: string) {
  /**
   * ① ໃບຂໍຊື້ຈາກ ERP (ແຫຼ່ງຈິງ) — ສະເພາະ `doc_format_code='SPR'` = ໃບທີ່**ລະບົບນີ້**ອອກ.
   * ບໍ່ເອົາ PRHN/PRTN/PRTM ມາປົນ: ນັ້ນຄືໃບຂໍຊື້ຂອງຝ່າຍອື່ນ (ຂາຍ/ຄັງສິນຄ້າ) ທີ່ບໍ່ຜູກວຽກສ້ອມ
   * ⇒ ຖ້າເອົາມາ ທຸກຖັນ (ລູກຄ້າ/ເຄື່ອງ/ອາການ) ຈະຫວ່າງ ແລະ ລາຍງານຈະອ່ານບໍ່ໄດ້ຄວາມ.
   */
  const docs = (
    await queryOdg<SprHeadRow>(
      `select a.doc_no,
          to_char(a.doc_date,'DD-MM-YYYY') doc_date,
          split_part(trim(coalesce(a.doc_ref,'')),' ',1) job,
          to_char(a.doc_ref_date,'DD-MM-YYYY') doc_ref_date,
          a.remark,
          coalesce(nullif(a.creator_code,''), nullif(a.user_request,'')) user_created
         from ic_trans a
        where a.trans_flag = 2 and a.doc_format_code = 'SPR' and a.doc_date between $1 and $2
        order by a.doc_date desc, a.doc_no`,
      [from, to],
    )
  ).rows;
  if (docs.length === 0) return [];

  // ② ຂໍ້ມູນວຽກ/ລູກຄ້າ ຈາກ ODS (ERP ບໍ່ຮູ້ຈັກ) — ດຶງເທື່ອດຽວດ້ວຍລະຫັດວຽກທັງໝົດ
  const jobs = [...new Set(docs.map((row) => row.job).filter(isJobRef))];
  const info = new Map<string, JobInfoRow>();
  if (jobs.length > 0) {
    const rows = (
      await query<JobInfoRow>(
        `select p.code,
            coalesce(b.name_1,'-') customer,
            coalesce(p.name_1,'-') product,
            p.issue, p.warrunty, p.issue_2, p.emp_code,
            to_char(p.time_register,'DD-MM-YYYY') doc_ref_date
           from tb_product p
           left join ar_customer b on b.code = p.cust_code
          where p.code = any($1::varchar[])`,
        [jobs],
      )
    ).rows;
    for (const row of rows) info.set(row.code, row);
  }

  return docs.map((doc, index) => {
    const job = info.get(doc.job);
    return {
      rnum: String(index + 1),
      doc_no: doc.doc_no,
      doc_date: doc.doc_date,
      // "ໃບຮັບເຄື່ອງ" = ວຽກສ້ອມທີ່ໃບນີ້ຊື້ໃຫ້ (ໃບເກົ່າອາດເປັນເລກ RQ/ຂໍ້ຄວາມ — ສະແດງຕາມຕົວ)
      doc_ref: doc.job || "-",
      doc_ref_date: job?.doc_ref_date ?? doc.doc_ref_date ?? "-",
      customer: job?.customer ?? "-",
      product: job?.product ?? "-",
      issue: job?.issue ?? "-",
      warrunty: job?.warrunty ?? "-",
      issue_2: job?.issue_2 ?? "-",
      emp_code: job?.emp_code ?? "-",
      remark: doc.remark ?? "-",
      user_created: doc.user_created ?? "-",
    } as Row;
  });
}

/* ------------------------------------------------------------- 10. ລາຍງານຕິດຕັ້ງ
 * ods: /install_pending + /install_allpd + /report_pd_install (excel)
 */
/**
 * FIX (B5): ບໍ່ມີສາຂາ "ຍົກເລີກ" ເລີຍ ⇒ ງານທີ່ຍົກເລີກແລ້ວຖືກລາຍງານເປັນງານທີ່ຍັງເຄື່ອນໄຫວ
 * (ຕົວຢ່າງ INST-5849/INST-5850 ອອກມາເປັນ 'ລໍຖ້າຈັດຊ່າງ' ແລະ INST-6864 ອອກມາເປັນຄ່າຫວ່າງ).
 * cancel_date ຕ້ອງມາກ່ອນທຸກເງື່ອນໄຂ — ຄືກັບຂັ້ນໄດຢູ່ lib/install-stage (ຂັ້ນ -1).
 */
// ລາຍງານຕ້ອງໃຊ້ຂັ້ນດຽວກັບເມນູ/ໜ້າງານ; ບໍ່ສ້າງ CASE ຊ້ຳອີກບ່ອນ.
const installStatusName = `${INSTALL_STAGE_LABEL_SQL} as status_name`;

const installBase = `row_number() over (order by a.roworder) rnum,
  a.code,
  to_char(a.time_register,'DD-MM-YYYY HH24:MI:SS') time_register,
  coalesce(c.name_1,'-') customer, coalesce(c.tel,'-') tel,
  coalesce(to_char(a.appoint_date,'DD-MM-YYYY'),'-') appoint_date,
  a.location_inst,
  to_char(a.doc_ref_date,'DD-MM-YYYY') doc_ref_date,
  a.doc_ref_1, a.item_name, a.pro_brand, a.pro_model, a.pro_sn, a.pro_type, a.pro_size,
  a.tech_code, a.user_created,
  ${installStatusName},
  to_char(a.job_finish,'DD-MM-YYYY HH24:MI:SS') job_finish,
  (a.job_finish - a.appoint_date)::text duration,
  case when a.time_register > localtimestamp(0) then '00:00:00' else (localtimestamp(0) - a.time_register)::text end remaining,
  a.remark
  from ods_tb_install a
  left join ar_customer c on c.code = a.cust_code`;

export async function fetchInstallations(from: string, to: string, all: boolean) {
  const sql = all
    ? `select ${installBase} order by a.time_register desc`
    : `select ${installBase} where a.time_register::date between $1 and $2 order by a.time_register desc`;
  return (await query<Row>(sql, all ? [] : [from, to])).rows;
}

/* ------------------------------------------------ 11. ລາຍງານຄວາມພໍໃຈຂອງລູກຄ້າ (ຕິດຕັ້ງ)
 * ods: /report_cust_feedback + /report_cust_feedback_excel (install_admin.py)
 * FIX: install_admin.py:1654 — branch 'all' ດຶງ point_1..4 ຈາກ topic_code='001' ແຕ່ point_5 ຈາກ '002'.
 *      ຄຳຖາມ 5 ຂໍ້ຂອງແບບສອບຖາມປັດຈຸບັນ (ການແຕ່ງກາຍ… → ແນະນຳວິທີການໃຊ້ງານ) ຢູ່ topic '002'
 *      (topic '001' ມີພຽງ 4 line ແລະ ເປັນຊຸດຄຳຖາມເກົ່າ). ໃຊ້ '002' ທັງໝົດ — ຄືກັບ branch POST ແລະ Excel.
 */
const point = (n: number) =>
  `(select points from cust_complain where line_number = ${n} and topic_code = '002' and product_code = a.code) point_${n}`;
const score = (n: number) => `case
  when point_${n} = 1 then 'ດີຫຼາຍ' when point_${n} = 2 then 'ດີ'
  when point_${n} = 3 then 'ພໍໃຈ' when point_${n} = 4 then 'ຄວນປັບປຸງ'
  else '' end question_${n}`;

export async function fetchCustomerFeedback(from: string | null, to: string | null) {
  const ranged = from !== null && to !== null;
  const inner = `select a.code,
      to_char(a.time_register,'DD-MM-YYYY HH24:MI:SS') time_register,
      coalesce(c.name_1,'-') customer,
      coalesce(to_char(a.appoint_date,'DD-MM-YYYY'),'-') appoint_date,
      a.doc_ref_1, a.item_name, a.pro_brand, a.pro_model, a.pro_size, a.pro_type, a.tech_code,
      to_char(a.finish_install,'DD-MM-YYYY HH24:MI:SS') finish_install,
      a.complain_cust, a.user_created, a.roworder,
      ${[1, 2, 3, 4, 5].map(point).join(",\n      ")}
    from ods_tb_install a
    left join ar_customer c on c.code = a.cust_code
    where a.complain_finish notnull${ranged ? " and a.time_register::date between $1 and $2" : ""}`;
  return (
    await query<Row>(
      `select row_number() over (order by z.roworder desc) rnum, z.*, ${[1, 2, 3, 4, 5].map(score).join(", ")}
       from (${inner}) z order by z.roworder desc`,
      ranged ? [from, to] : [],
    )
  ).rows;
}

/* ------------------------------------- Excel: /download/report/<id> — ແຜນທີ່ id → ຊື່ໄຟລ໌ */
const whereStage = (stage: number) => `where (${STAGE_SQL}) = ${stage}`;

export const statusExports: Record<string, { title: string; filename: string; condition: string }> = {
  "1": { title: "ເຄື່ອງທັງໜົດຮັບສ້ອມ", filename: "all_product.xlsx", condition: "" },
  "2": { title: "ລໍຖ້າກວດເຊັກ", filename: "waiting_check.xlsx", condition: whereStage(1) },
  "3": { title: "ກຳລັງກວດເຊັກ", filename: "checking.xlsx", condition: whereStage(2) },
  "4": { title: "ລໍຖ້າສະເໜີລາຄາ", filename: "waiting_quotation.xlsx", condition: whereStage(3) },
  "5": { title: "ກຳລັງສະເໜີລາຄາ", filename: "quotation.xlsx", condition: whereStage(4) },
  "6": { title: "ລໍຖ້າເບີກອາໃຫຼ່", filename: "waiting_withdraw.xlsx", condition: whereStage(5) },
  "7": { title: "ກຳລັງເບີກ", filename: "withdraw.xlsx", condition: whereStage(6) },
  "8": { title: "ສັ່ງອາໃຫຼ່", filename: "purchase.xlsx", condition: whereStage(7) },
  "9": { title: "ລໍຖ້າສ້ອມແປງ", filename: "waiting_fix.xlsx", condition: whereStage(8) },
  "10": { title: "ກຳລັງສ້ອມແປງ", filename: "fixing.xlsx", condition: whereStage(9) },
  "11": { title: STAGE_LABEL[11], filename: "waiting_return.xlsx", condition: whereStage(11) },
  // FIX: ods ຕັ້ງຊື່ໄຟລ໌ຂອງ id=-1 ເປັນ return_complete.xls ຄືກັນກັບ id=12 → ຕັ້ງຊື່ໃໝ່ໃຫ້ຖືກ
  "12": { title: "ສົ່ງຄືນສຳເລັດ", filename: "return_complete.xlsx", condition: whereStage(12) },
  "-1": { title: "ຍົກເລີກເເລ້ວ", filename: "cancelled.xlsx", condition: `where ${CANCELLED_JOBS}` },
  // ຂັ້ນ QC ເປັນຂັ້ນໃໝ່ — ບໍ່ມີ id ໃນ ods ເກົ່າ ⇒ ຕໍ່ທ້າຍເປັນ 13 (ແຊກກາງຈະຍ້າຍຄວາມໝາຍຂອງລິ້ງເກົ່າ)
  "13": { title: STAGE_LABEL[10], filename: "waiting_qc.xlsx", condition: whereStage(10) },
};

export async function fetchStatusExport(id: string) {
  // id ທີ່ບໍ່ຮູ້ຈັກ → ບໍ່ມີແຖວ (ເມື່ອກ່ອນຄື status_real = 0 ເຊິ່ງບໍ່ມີອີກຕໍ່ໄປແລ້ວ)
  const config = statusExports[id] ?? { title: "Process", filename: "process.xlsx", condition: "where false" };
  const rows = (await query<Row>(`select ${productBase} ${config.condition} order by a.time_register`)).rows;
  return { config, rows };
}

/** /download/report/excel_pending — ເຄື່ອງທີ່ສົ່ງຄືນລູກຄ້າແລ້ວ */
export async function fetchReturned() {
  return (
    await query<Row>(
      `select ${productBase.replace(
        "from tb_product a",
        `, to_char(a.return_complete,'DD-MM-YYYY HH24:MI:SS') return_complete from tb_product a`,
      )}
       where a.return_complete notnull order by a.time_register`,
    )
  ).rows;
}
