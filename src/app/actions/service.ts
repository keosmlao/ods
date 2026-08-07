"use server";
import { logChange } from "@/lib/chatter-log";
import { claimMarkChange } from "@/lib/claim-shared";
import { pushToUser } from "@/lib/push";
import { db } from "@/lib/db";
import { requirePermission, requireRole } from "@/lib/guard";
import { APPROVER_SIDE, SERVICE_SIDE } from "@/lib/roles";
import { ONSITE_SERVICE_TYPES } from "@/lib/sla";
import { collectUploads, saveUploads } from "@/lib/uploads";
import { unlink } from "node:fs/promises";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { PoolClient } from "pg";
import { z } from "zod";
import { customerPoint, rememberCustomerPoint } from "@/lib/customer-location";

const schema = z.object({
  /** ລະຫັດ ODS — ຫວ່າງໄດ້ ຖ້າລູກຄ້າມາຈາກ ERP ແລະ ຍັງບໍ່ມີບັນຊີ ODS */
  cust_code: z.string(),
  /** ລະຫັດລູກຄ້າຢູ່ ERP + ຂໍ້ມູນ ເພື່ອ copy ເຂົ້າ ODS ຕອນບັນທຶກ */
  cust_ref: z.string().optional().default(""),
  cust_name: z.string().optional().default(""),
  cust_tel: z.string().optional().default(""),
  cust_address: z.string().optional().default(""),
  proname: z.string().min(1),
  /**
   * ລະຫັດສິນຄ້າ ERP — ຫວ່າງໄດ້ (ສິນຄ້າທີ່ພິມຊື່ເອງ ບໍ່ມີໃນ ERP).
   * ມີແລ້ວຈຶ່ງໄປຫາ ic_size / ic_design ໄດ້ ⇒ ຄິດຄ່າບໍລິການຂອງຊ່າງໄດ້.
   */
  item_code: z.string().optional(),
  /** SN ຫວ່າງໄດ້ — ເຄື່ອງເກົ່າ/ເຄື່ອງນອກ ບາງໜ່ວຍບໍ່ມີປ້າຍ */
  pro_sn: z.string(),
  pro_model: z.string().min(1),
  pro_type: z.string().min(1),
  pro_brand: z.string().min(1),
  pro_acc: z.string(),
  pro_wa: z.string().min(1),
  pro_deli: z.string().min(1),
  service_type: z.string().min(1),
  job_kind: z.enum(["repair", "claim"]).optional().default("repair"),
  claim_scope: z.enum(["whole", "part"]).optional(),
  claim_part_code: z.string().optional().default(""),
  claim_part_name: z.string().optional().default(""),
  claim_part_sn: z.string().optional().default(""),
  claim_part_qty: z.coerce.number().positive().optional(),
  pro_issue: z.string().min(1),
  pro_remark: z.string(),
  billon: z.string(),
  billdate: z.string(),
  /** ວັນເວລາຮັບເຄື່ອງ (YYYY-MM-DDTHH:MM ຈາກ datetime-local) — ໃຊ້ສະເພາະໜ້າແກ້ໄຂ, ຫວ່າງ = ບໍ່ປ່ຽນ */
  time_register: z.string().optional().default(""),
  /**
   * ຊ່າງ — **ບໍ່ບັງຄັບ** (24-07-2026): ຮັບເຄື່ອງເຂົ້າໄດ້ກ່ອນ ແລ້ວຄ່ອຍຈັດຊ່າງພາຍຫຼັງ
   * (ຕອນຮັບເຄື່ອງໜ້າເຄົາເຕີ ຍັງບໍ່ຮູ້ວ່າໃຜຈະຮັບງານ). ຫວ່າງ = ຍັງບໍ່ຈັດຊ່າງ.
   */
  emp: z.string().optional().default(""),
  /**
   * ── ງານນອກສະຖານທີ່ (IH ສ້ອມບ້ານລູກຄ້າ · PS ໄປຮັບເຄື່ອງຈາກບ້ານມາສ້ອມຢູ່ສູນ = 75% ຂອງໃບ) ──
   * ແຕ່ກ່ອນ tb_product ບໍ່ມີຖັນສະຖານທີ່ເລີຍ ⇒ ຊ່າງອາໄສທີ່ຢູ່ຂອງ **ລູກຄ້າ** ເຊິ່ງ
   * ອາດເປັນທີ່ຢູ່ຮ້ານ/ສຳນັກງານໃຫຍ່ ບໍ່ແມ່ນບ່ອນທີ່ເຄື່ອງຕິດຢູ່ ⇒ ໄປຜິດບ່ອນ.
   * ບັງຄັບສະເພາະ IH/PS (ກວດລຸ່ມນີ້) — CI/ST ເຮັດຢູ່ສູນ ບໍ່ຕ້ອງມີ.
   */
  location_repair: z.string().optional().default(""),
  /**
   * ບ່ອນ**ຮັບເຄື່ອງເຂົ້າ** (1104 ຂົວຫຼວງ · 1206 ດອນຕີ້ວ) — ລູກຄ້າມາຮັບຄືນບ່ອນນີ້.
   * ເຄື່ອງໂອນໄປສ້ອມສູນອື່ນໄດ້ ແຕ່ຕ້ອງໂອນກັບມາກ່ອນສົ່ງຄືນ (ເບິ່ງ lib/job-center).
   */
  intake_center: z.string().optional().default(""),
  /** ວັນນັດເຂົ້າສ້ອມ — ຝັ່ງຕິດຕັ້ງມີມາແຕ່ຕົ້ນ ຝັ່ງສ້ອມຫາກໍ່ມີ ⇒ ຈັດຄິວເປັນມື້ໄດ້ */
  appoint_date: z.string().optional().default(""),
  /** ພິກັດໜ້າງານ (ບໍ່ບັງຄັບ) — ຊ່າງກົດນຳທາງ ແລະ ທຽບກັບ check-in ໄດ້ */
  location_lat: z.string().optional().default(""),
  location_lng: z.string().optional().default(""),
});

export type ServiceState = { error?: string };

/** ຊື່ຊ່ອງເປັນພາສາລາວ — ໃຊ້ບອກຜູ້ໃຊ້ວ່າຂາດຊ່ອງໃດ ແທນທີ່ຈະບອກແຕ່ "ປ້ອນໃຫ້ຄົບ" */
const FIELD_LABELS: Record<string, string> = {
  cust_code: "ລູກຄ້າ",
  proname: "ຊື່ເຄື່ອງ",
  pro_sn: "Serial Number",
  pro_model: "Model",
  pro_type: "ປະເພດສິນຄ້າ",
  pro_brand: "ຫຍີ່ຫໍ້",
  pro_wa: "ການຮັບປະກັນ",
  pro_deli: "ການຈັດສົ່ງຄືນ",
  service_type: "ປະເພດບໍລິການ",
  job_kind: "ປະເພດງານ",
  pro_issue: "ອາການເບື້ອງຕົ້ນ",
  emp: "ຊ່າງ",
  location_repair: "ສະຖານທີ່ໜ້າງານ",
};

/** ປະເພດບໍລິການທີ່ຊ່າງຕ້ອງອອກໜ້າງານ ⇒ ຕ້ອງມີສະຖານທີ່ (ນິຍາມດຽວກັບ lib/sla) */
const NEEDS_LOCATION = (serviceType: string) => ONSITE_SERVICE_TYPES.includes(serviceType as "IH" | "PS");

/** ລວມຊື່ຊ່ອງທີ່ຍັງບໍ່ຄົບ ເປັນຂໍ້ຄວາມດຽວ */
function missingFieldsError(issues: { path: PropertyKey[] }[]) {
  const names = [...new Set(issues.map((issue) => String(issue.path[0])))]
    .map((key) => FIELD_LABELS[key] ?? key)
    .filter(Boolean);
  return names.length ? `ກະລຸນາປ້ອນ: ${names.join(", ")}` : "ກະລຸນາປ້ອນຊ່ອງທີ່ຈຳເປັນໃຫ້ຄົບ";
}


/**
 * ຄືນລະຫັດລູກຄ້າຂອງ ODS ໃຫ້ໄດ້ສະເໝີ.
 * ຖ້າພະນັກງານເລືອກລູກຄ້າຈາກ ERP ທີ່ຍັງບໍ່ມີບັນຊີ ODS → copy ເຂົ້າ ar_customer ໃຫ້ເລີຍ
 * (ຜູກດ້ວຍ ref_code = ລະຫັດ ERP). ນີ້ຄືວິທີດຽວກັບທີ່ install_admin.py ຂອງ ods ໃຊ້ຢູ່.
 * ຕ້ອງເອີ້ນພາຍໃນ transaction ທີ່ຖື advisory lock ແລ້ວ.
 */
async function resolveCustomer(
  client: PoolClient,
  d: { cust_code: string; cust_ref: string; cust_name: string; cust_tel: string; cust_address: string },
): Promise<string | null> {
  if (d.cust_code) return d.cust_code;
  if (!d.cust_ref || !d.cust_name) return null;

  const existing = await client.query<{ code: string }>(
    "select code from ar_customer where ref_code = $1 limit 1",
    [d.cust_ref],
  );
  if (existing.rows[0]) return existing.rows[0].code;

  // ບາງລະຫັດລູກຄ້າບໍ່ແມ່ນຕົວເລກ → ກອງອອກ ບໍ່ດັ່ງນັ້ນ code::int ຈະ crash
  const next = await client.query<{ code: number }>(
    "select coalesce(max(code::int),0)+1 code from ar_customer where code ~ '^[0-9]+$'",
  );
  const code = String(next.rows[0].code);
  await client.query(
    "insert into ar_customer(code, name_1, tel, address, ref_code, ar_type) values($1,$2,$3,$4,$5,'erp')",
    [code, d.cust_name, d.cust_tel, d.cust_address, d.cust_ref],
  );
  return code;
}

export async function createService(_: ServiceState, formData: FormData): Promise<ServiceState> {
  const guard = await requirePermission("/service", "create", SERVICE_SIDE);
  if (!guard.ok) return { error: guard.error };
  const session = guard.session;

  const parsed = schema.safeParse(
    Object.fromEntries([...formData.entries()].filter(([, value]) => typeof value === "string")),
  );
  if (!parsed.success) return { error: missingFieldsError(parsed.error.issues) };
  if (!db) return { error: "ບໍ່ພົບ DATABASE_URL" };

  // ງານນອກສະຖານທີ່ຕ້ອງຮູ້ວ່າ "ໄປໃສ" — ທີ່ຢູ່ລູກຄ້າບໍ່ພຽງພໍ (ອາດເປັນທີ່ຢູ່ຮ້ານ)
  if (NEEDS_LOCATION(parsed.data.service_type) && !parsed.data.location_repair.trim()) {
    return { error: "ງານນອກສະຖານທີ່ (ສ້ອມບ້ານລູກຄ້າ / ໄປຮັບເຄື່ອງຈາກບ້ານມາສ້ອມຢູ່ສູນ) ຕ້ອງລະບຸສະຖານທີ່ໜ້າງານ" };
  }
  /**
   * ── ພິກັດ **ບັງຄັບ** ສຳລັບງານນອກສະຖານທີ່ (01-08-2026) ──
   *
   * ວັດຂໍ້ມູນຈິງ: ງານສ້ອມທີ່ເປີດຢູ່ 124 ໃບ **ບໍ່ມີພິກັດຈັກໃບ** ⇒ ແຜນທີ່ຕິດຕາມງານ
   * (ເວັບ /map ແລະ ແອັບ) ວ່າງເປົ່າ ແລະ ຊ່າງອອກໄປຫາບ້ານລູກຄ້າດ້ວຍທີ່ຢູ່ຂໍ້ຄວາມລ້ວນ.
   * ຊ່ອງປັກໝຸດມີຢູ່ໃນຟອມແລ້ວ ພຽງແຕ່ "ບໍ່ບັງຄັບ" ⇒ ບໍ່ມີໃຜກົດ.
   *
   * ⚠️ ບັງຄັບ **ສະເພາະ IH/PS** ເທົ່ານັ້ນ — ງານທີ່ລູກຄ້າຫອບເຄື່ອງມາເອງ (CI/ST)
   * ບໍ່ມີ "ໜ້າງານ" ໃຫ້ປັກ ⇒ ບັງຄັບໄປກໍ່ຂວາງການຮັບເຄື່ອງປະຈຳວັນລ້າໆ.
   */
  if (
    NEEDS_LOCATION(parsed.data.service_type) &&
    (!parsed.data.location_lat.trim() || !parsed.data.location_lng.trim())
  ) {
    /**
     * ຍັງບໍ່ມີໝຸດ ⇒ ລອງເອົາຈາກ **ຂໍ້ມູນລູກຄ້າໃນ ERP** ກ່ອນຈະຟ້ອງ (lib/customer-location).
     * ຟອມຕື່ມໃຫ້ຢູ່ແລ້ວຕອນເລືອກລູກຄ້າ ແຕ່ action ຖືກຍິງໂດຍກົງໄດ້ ແລະ ຄົນອາດເລືອກ
     * ລູກຄ້າກ່ອນທີ່ຈະປ່ຽນເປັນ IH/PS ⇒ ກວດຊ້ຳຢູ່ນີ້ໃຫ້ແນ່ໃຈ.
     */
    const known = await customerPoint(parsed.data.cust_ref || parsed.data.cust_code);
    if (known) {
      parsed.data.location_lat = String(known.lat);
      parsed.data.location_lng = String(known.lng);
    } else {
      return {
        error: "ງານນອກສະຖານທີ່ ຕ້ອງປັກໝຸດພິກັດນຳ — ວາງລິງ Google Maps ຫຼື ກົດ “ໃຊ້ຕຳແໜ່ງປັດຈຸບັນ” (ຊ່າງໃຊ້ຫາບ້ານລູກຄ້າ ແລະ ຂຶ້ນແຜນທີ່ຕິດຕາມງານ)",
      };
    }
  }
  if (parsed.data.job_kind === "claim" && !parsed.data.claim_scope) {
    return { error: "ຕ້ອງເລືອກ ເຄມທັງເຄື່ອງ ຫຼື ເຄມສະເພາະອາໄຫຼ່" };
  }
  if (parsed.data.job_kind === "claim" && parsed.data.claim_scope === "part" && !parsed.data.claim_part_name.trim()) {
    return { error: "ເຄມອາໄຫຼ່ຕ້ອງລະບຸຊື່ອາໄຫຼ່" };
  }

  // IH (ໄປສ້ອມບ້ານ) + ຈັດຊ່າງແລ້ວ ⇒ ຕ້ອງມີວັນນັດ (ຄືກັບ assignRepairTech) ບໍ່ດັ່ງນັ້ນວຽກ
  // ຄ້າງຢູ່ຂັ້ນ 0 "ລໍນັດ/ຈັດຊ່າງ" ⇒ ຊ່າງເປີດແອັບກົດ "ຮັບງານ" ບໍ່ໄດ້ (ຕ້ອງຂັ້ນ 1).
  if (parsed.data.service_type === "IH" && parsed.data.emp.trim() && !parsed.data.appoint_date.trim()) {
    return { error: "ໄປສ້ອມບ້ານລູກຄ້າ (IH) ທີ່ຈັດຊ່າງແລ້ວ ຕ້ອງໃສ່ວັນນັດໝາຍໄປສ້ອມ" };
  }

  const files = await collectUploads(formData);
  if (!files.ok) return { error: files.error };
  const uploads = files.uploads;
  /**
   * ── ຮູບຮັບເຄື່ອງ **ບໍ່ບັງຄັບອີກແລ້ວ** (07-08-2026 ຕາມຄຳສັ່ງ) ──
   * ເມື່ອກ່ອນບັງຄັບ ≥1 ຮູບ ເປັນຫຼັກຖານສະພາບເຄື່ອງ ແຕ່ຕົວຈິງ CS ຮັບເຄື່ອງໜ້າຮ້ານ
   * ຕອນລູກຄ້າຢືນລໍຢູ່ ⇒ ຖ່າຍຮູບບໍ່ທັນ ຫຼື ກ້ອງມີບັນຫາ ແລ້ວ**ເປີດໃບບໍ່ໄດ້ເລີຍ**.
   * ດຽວນີ້ແນບພາຍຫຼັງໄດ້ຢູ່ໜ້າໃບງານ (components/service-photos).
   */

  const d = parsed.data;
  const client = await db.connect();
  const written: string[] = [];
  let code = "";
  let customer = "";
  let claimDocNo = ""; // ເລກໃບເຄມ CLM-B ທີ່ເກີດຈາກ intake (kind=claim) — log ຫຼັງ commit

  try {
    await client.query("begin");
    // ລັອກ ກັນສອງຄົນຮັບເຄື່ອງພ້ອມກັນແລ້ວໄດ້ເລກຊ້ຳ (ods ໃຊ້ max(code)+1 ເສີຍໆ)
    await client.query("select pg_advisory_xact_lock(734210)");

    const custCode = await resolveCustomer(client, d);
    if (!custCode) {
      await client.query("rollback");
      return { error: "ກະລຸນາເລືອກລູກຄ້າ" };
    }
    customer = custCode;

    const duplicate = await client.query(
      `select code from tb_product where cust_code=$1 and name_1=$2
       and replace(sn,' ','')=replace($3,' ','') and p_model=$4
       -- ອີງເວລາສ້າງແຖວ ບໍ່ແມ່ນ time_register — ຄີຍ້ອນຫຼັງແລ້ວ time_register ເປັນອະດີດ ດ່ານນີ້ຈະບໍ່ຈັບ
       and create_date_time_now > now() - interval '2 minutes' limit 1`,
      [custCode, d.proname, d.pro_sn, d.pro_model],
    );
    if (duplicate.rows[0]) {
      await client.query("rollback");
      return { error: `ພົບລາຍການຊ້ຳ: ${duplicate.rows[0].code}` };
    }

    code = String(
      (await client.query("select coalesce(max(code::int),0)+1 code from tb_product where code~'^[0-9]+$'")).rows[0].code,
    );

    /**
     * item_code = ລະຫັດສິນຄ້າ ERP.
     * ຟອມຄົ້ນ ERP ຢູ່ແລ້ວ (/api/products) ແຕ່ແຕ່ກ່ອນຖິ້ມລະຫັດຖິ້ມ ⇒ ໃບຮັບເຄື່ອງ
     * ໄປຫາ ic_size / ic_design ຂອງ ERP ບໍ່ໄດ້ ແລະ ຄິດຄ່າບໍລິການ (ທີ່ແບ່ງຕາມ
     * ຂະໜາດ/ແບບ) ບໍ່ໄດ້. ຫວ່າງໄດ້ — ສິນຄ້າທີ່ພິມຊື່ເອງບໍ່ມີລະຫັດ ERP.
     */
    await client.query(
      `insert into tb_product(code,name_1,sn,p_model,p_brand,p_access,issue,p_type,p_abrasion,p_delivery,
         warrunty,service_type,cust_code,ap_code,doc_def,doc_date_ref,status,emp_code,time_register,user_regis,item_code,
         location_repair,appoint_date,location_lat,location_lng,job_kind,
         claim_scope,claim_part_code,claim_part_name,claim_part_sn,claim_part_qty,
         intake_center,service_center)
       values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,1,$17,coalesce(nullif($31,'')::timestamp,localtimestamp),$18,nullif($19,''),
         nullif($20,''), nullif($21,'')::date, nullif($22,'')::double precision, nullif($23,'')::double precision,$24,
         nullif($25,''),nullif($26,''),nullif($27,''),nullif($28,''),$29,
         nullif($30,''),nullif($30,''))`,
      [code, d.proname, d.pro_sn, d.pro_model, d.pro_brand, d.pro_acc, d.pro_issue, d.pro_type, d.pro_remark,
        // ap_code (ຮ້ານຄ້າ) = **ລະຫັດລູກຄ້າ** ອັນດຽວກັນ (ນະໂຍບາຍ 13-07-2026)
        // ⇒ ບໍ່ຮັບຈາກຟອມອີກ (ຊ່ອງນັ້ນຖືກຖອດອອກ) ຈຶ່ງບໍ່ມີທາງພິມຜິດ/ຫຼົ້ນກັນ
        d.pro_deli, d.pro_wa, d.service_type, custCode, custCode, d.billon, d.billdate, d.emp, session.username,
        d.item_code ?? "", d.location_repair, d.appoint_date, d.location_lat, d.location_lng, d.job_kind,
        d.job_kind === "claim" ? d.claim_scope ?? "" : "", d.claim_part_code, d.claim_part_name,
        d.claim_part_sn, d.claim_scope === "part" ? d.claim_part_qty ?? 1 : null,
        // ບ່ອນຮັບເຄື່ອງ = ບ່ອນທີ່ເຄື່ອງຢູ່ຕອນນີ້ຄືກັນ ($30 ໃຊ້ 2 ບ່ອນ)
        d.intake_center, d.time_register],
    );

    await saveUploads(client, code, uploads, written);

    // ── ຜູກ 2 ທາງ ກັບໃບເຄມ ── ຖ້າໃບງານນີ້ເປີດຈາກປຸ່ມ "ສ້ອມ" ຂອງໃບເຄມ (?claim=CLMxxxxx):
    // ໃບເຄມ.ref_job = ເລກງານໃໝ່ ⇒ ໃບເຄມຮູ້ເລກສ້ອມ · ໃບສ້ອມ→ໃບເຄມ ຄົ້ນຜ່ານ ref_job (relatedClaims).
    const linkClaim = String(formData.get("claim") ?? "").trim();
    if (linkClaim) await client.query("update ods_claim set ref_job=$1 where claim_no=$2", [code, linkClaim]);

    if (d.job_kind === "claim" && !linkClaim) {
      const claimId = (
        await client.query<{ id: number }>(
          `insert into ods_claim(claim_type,customer_code,brand_code,ref_job,reason,status,created_by,
             product,model,sn,warranty,purchase_date,contact,bill_no,claim_scope)
           values('B',$1,nullif($2,''),$3,$4,'received',$5,$6,$7,nullif($8,''),
             $9,nullif($10,'')::date,nullif($11,''),nullif($12,''),$13) returning id`,
          [custCode, d.pro_brand, code, d.pro_issue, session.username, d.proname, d.pro_model, d.pro_sn,
            d.pro_wa === "ຮັບປະກັນ" ? "in" : "out", d.billdate, d.cust_tel, d.billon, d.claim_scope],
        )
      ).rows[0].id;
      const claimNo = `CLM${String(claimId).padStart(5, "0")}`;
      await client.query(`update ods_claim set claim_no=$2 where id=$1`, [claimId, claimNo]);
      claimDocNo = claimNo;
      if (d.claim_scope === "part") {
        await client.query(
          `insert into ods_claim_item(claim_no,item_code,item_name,qty,unit,amount,note)
           values($1,nullif($2,''),$3,$4,'ອັນ',0,nullif($5,''))`,
          [claimNo, d.claim_part_code, d.claim_part_name.trim(), d.claim_part_qty ?? 1, d.claim_part_sn ? `SN: ${d.claim_part_sn}` : ""],
        );
      }
    }

    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    // ໄຟລ໌ຂຽນລົງແລ້ວແຕ່ DB rollback → ລຶບຖິ້ມ
    await Promise.all(written.map((path) => unlink(path).catch(() => {})));
    console.error("Create service failed", error);
    return { error: "ບັນທຶກບໍ່ສຳເລັດ ກະລຸນາກວດຂໍ້ມູນ" };
  } finally {
    client.release();
  }

  const item = [d.proname, d.pro_brand, d.pro_model].filter(Boolean).join(" ");
  // ແຈ້ງຊ່າງທີ່ຖືກມອບງານ (ods ຍິງ LINE Notify ຢູ່ຈຸດນີ້)
  await logChange("tb_product", code, `ເປີດ${d.job_kind === "claim" ? "ງານເຄມ" : "ໃບຮັບເຄື່ອງສ້ອມ"}: ${item} · ອາການ: ${d.pro_issue}${d.emp ? ` · ຊ່າງ ${d.emp}` : " · ຍັງບໍ່ຈັດຊ່າງ"}`, {
    users: d.emp ? [d.emp] : [],
  });
  // ຄຽງກັນ ໃຫ້ເຫັນຢູ່ໜ້າລູກຄ້ານຳ ວ່າລູກຄ້າຄົນນີ້ເອົາເຄື່ອງມາສ້ອມເມື່ອໃດ
  await logChange("ar_customer", customer, `ເປີດໃບຮັບເຄື່ອງ #${code}: ${item}`);

  /**
   * ປັກໝຸດເທື່ອດຽວ ⇒ **ຈື່ໃສ່ຂໍ້ມູນລູກຄ້າ** ໃຫ້ໃບຕໍ່ໄປໄດ້ໝຸດເອງ (lib/customer-location).
   * ຂຽນສະເພາະຕອນ ERP ຍັງບໍ່ມີພິກັດຂອງລູກຄ້າຄົນນັ້ນ — ບໍ່ຂຽນທັບຂອງເກົ່າ.
   */
  await rememberSitePoint(d, code);
  // CLM-B ຈາກ intake — ບັນທຶກ "ເປີດ" ໃສ່ chatter ຂອງໃບເຄມ (ໃຫ້ timeline ບໍ່ຫວ່າງ ຄື createClaim)
  if (claimDocNo) {
    await logChange("ods_claim", claimDocNo, `ເປີດໃບເຄມ (ຮັບເຄື່ອງເຄມຈາກຮ້ານ) · ${item}${d.claim_scope === "part" ? " · ເຄມສະເພາະອາໄຫຼ່" : " · ເຄມທັງໜ່ວຍ"}`, { roles: ["manager", "stock"] });
  }
  // ແຈ້ງອອກມືຖືຂອງຊ່າງ — ຊ່າງບໍ່ໄດ້ນັ່ງເຝົ້າເວັບ (lib/push ຈັບ error ໄວ້ໝົດ)
  if (d.emp) await pushToUser(d.emp, "ມີງານສ້ອມແປງໃໝ່", `${code} · ${item} — ${d.pro_issue}`, {
    workflow: "repair",
    code,
  });

  // ລູກຄ້າຍັງຢືນລໍຢູ່ໜ້າເຄົາເຕີ — ໄປໜ້າພິມໃບຮັບເລີຍ ບໍ່ໃຫ້ຕ້ອງກົດຫາເອງ
  redirect(`/service/${code}/print`);
}

/* ---------- ສ້າງລູກຄ້າໃໝ່ ຈາກໃນຟອມຮັບເຄື່ອງເລີຍ ---------- */

export type NewCustomer = { code: string; name_1: string; tel: string; address: string; ref_code: string };
export type CustomerState = { error?: string; customer?: NewCustomer };

/**
 * ລູກຄ້າໃໝ່ຍ່າງເຂົ້າມາ — ສ້າງໄດ້ໂດຍບໍ່ຕ້ອງອອກຈາກຟອມຮັບເຄື່ອງ.
 * ເອົາເບີໂທເປັນ ref_code ຄືກັບແຖວອື່ນໆໃນ ar_customer (ref_code ຄືລະຫັດດຽວກັນຢູ່ ERP).
 */
/**
 * ຈື່ພິກັດໜ້າງານໃສ່ຂໍ້ມູນລູກຄ້າ (ຖ້າ ERP ຍັງບໍ່ຮູ້) ແລ້ວບັນທຶກໄວ້ໃນປະຫວັດຂອງໃບງານ.
 * ແຍກເປັນ function ເພາະທັງ createService ແລະ createServiceFromNotice ໃຊ້ຄືກັນ.
 */
async function rememberSitePoint(
  d: { cust_ref: string; cust_code: string; location_lat: string; location_lng: string },
  jobCode: string,
): Promise<void> {
  const lat = Number(d.location_lat);
  const lng = Number(d.location_lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
  const saved = await rememberCustomerPoint(d.cust_ref || d.cust_code, { lat, lng });
  if (saved) {
    await logChange(
      "tb_product",
      jobCode,
      `ຈື່ພິກັດໜ້າງານໃສ່ຂໍ້ມູນລູກຄ້າແລ້ວ (${lat.toFixed(5)}, ${lng.toFixed(5)}) — ໃບຕໍ່ໄປຂອງລູກຄ້ານີ້ຈະໄດ້ໝຸດເອງ`,
    );
  }
}

export async function createCustomer(_: CustomerState, formData: FormData): Promise<CustomerState> {
  const guard = await requirePermission("/service", "create", SERVICE_SIDE);
  if (!guard.ok) return { error: guard.error };
  if (!db) return { error: "ບໍ່ພົບ DATABASE_URL" };

  const parsed = z
    .object({ name_1: z.string().trim().min(1), tel: z.string().trim().min(1), address: z.string().trim() })
    .safeParse(Object.fromEntries([...formData.entries()].filter(([, value]) => typeof value === "string")));
  if (!parsed.success) return { error: "ຕ້ອງມີ ຊື່ ແລະ ເບີໂທ" };

  const { name_1, tel, address } = parsed.data;
  const client = await db.connect();
  try {
    await client.query("begin");
    // ລັອກ ກັນສອງຄົນສ້າງພ້ອມກັນແລ້ວໄດ້ລະຫັດຊ້ຳ
    await client.query("select pg_advisory_xact_lock(734211)");

    const existing = await client.query<NewCustomer>(
      `select code, name_1, coalesce(tel,'') tel, coalesce(address,'') address, coalesce(ref_code,'') ref_code
       from ar_customer where replace(coalesce(tel,''),' ','') = replace($1,' ','') limit 1`,
      [tel],
    );
    if (existing.rows[0]) {
      await client.query("rollback");
      return { error: `ເບີໂທນີ້ມີລູກຄ້າແລ້ວ: ${existing.rows[0].name_1}`, customer: existing.rows[0] };
    }

    // ບາງລະຫັດລູກຄ້າບໍ່ແມ່ນຕົວເລກ → ກອງອອກກ່ອນ ບໍ່ດັ່ງນັ້ນ code::int ຈະ crash
    const code = String(
      (await client.query<{ code: number }>(
        "select coalesce(max(code::int),0)+1 code from ar_customer where code ~ '^[0-9]+$'",
      )).rows[0].code,
    );

    await client.query(
      "insert into ar_customer(code, name_1, tel, address, ref_code, ar_type) values($1,$2,$3,$4,$5,'walkin')",
      [code, name_1, tel, address, tel],
    );
    await client.query("commit");
    return { customer: { code, name_1, tel, address, ref_code: tel } };
  } catch (error) {
    await client.query("rollback");
    console.error("Create customer failed", error);
    return { error: "ສ້າງລູກຄ້າບໍ່ສຳເລັດ" };
  } finally {
    client.release();
  }
}

/* ---------- ແກ້ໄຂໃບຮັບເຄື່ອງ — ຄື /rcpdedit + /update_rcpro ຂອງ ods ---------- */

export async function updateService(_: ServiceState, formData: FormData): Promise<ServiceState> {
  const guard = await requirePermission("/service", "update", SERVICE_SIDE);
  if (!guard.ok) return { error: guard.error };
  const session = guard.session;
  if (!db) return { error: "ບໍ່ພົບ DATABASE_URL" };

  const parsed = schema.extend({ code: z.string().min(1) }).safeParse(
    Object.fromEntries([...formData.entries()].filter(([, value]) => typeof value === "string")),
  );
  if (!parsed.success) return { error: missingFieldsError(parsed.error.issues) };

  // ງານນອກສະຖານທີ່ຕ້ອງຮູ້ວ່າ "ໄປໃສ" (ຄືກັບຕອນສ້າງ — ຟອມກວດແລ້ວ ແຕ່ action ຖືກຍິງໂດຍກົງໄດ້)
  if (NEEDS_LOCATION(parsed.data.service_type) && !parsed.data.location_repair.trim()) {
    return { error: "ງານນອກສະຖານທີ່ (ສ້ອມບ້ານລູກຄ້າ / ໄປຮັບເຄື່ອງຈາກບ້ານມາສ້ອມຢູ່ສູນ) ຕ້ອງລະບຸສະຖານທີ່ໜ້າງານ" };
  }
  /**
   * ⚠️ **ບໍ່ບັງຄັບພິກັດຢູ່ໜ້າແກ້ໄຂ** ໂດຍເຈດຕະນາ — ມີໃບເກົ່າ 61 ໃບ (IH/PS ທີ່ຍັງເປີດຢູ່)
   * ທີ່ບໍ່ມີພິກັດ; ບັງຄັບຢູ່ນີ້ຈະຂວາງການແກ້ເລື່ອງອື່ນ (ເຊັ່ນ ແກ້ເບີໂທ) ຂອງໃບເຫຼົ່ານັ້ນ.
   * ບັງຄັບສະເພາະ**ຕອນສ້າງໃໝ່** ⇒ ໃບໃໝ່ມີພິກັດທຸກໃບ ແລ້ວໃບເກົ່າຄ່ອຍໆໝົດໄປເອງ.
   */

  // IH + ຈັດຊ່າງ ⇒ ຕ້ອງມີວັນນັດ (ຄືກັບໜ້າອອກໃໝ່ + assignRepairTech) ບໍ່ດັ່ງນັ້ນຄ້າງຂັ້ນ 0 ຮັບງານບໍ່ໄດ້
  if (parsed.data.service_type === "IH" && parsed.data.emp.trim() && !parsed.data.appoint_date.trim()) {
    return { error: "ໄປສ້ອມບ້ານລູກຄ້າ (IH) ທີ່ຈັດຊ່າງແລ້ວ ຕ້ອງໃສ່ວັນນັດໝາຍໄປສ້ອມ" };
  }
  // ໝາຍເປັນງານເຄມພາຍຫຼັງ — ກົດອັນດຽວກັນກັບຕອນເປີດງານ (createService)
  if (parsed.data.job_kind === "claim" && !parsed.data.claim_scope) {
    return { error: "ຕ້ອງເລືອກ ເຄມທັງເຄື່ອງ ຫຼື ເຄມສະເພາະອາໄຫຼ່" };
  }
  if (parsed.data.job_kind === "claim" && parsed.data.claim_scope === "part" && !parsed.data.claim_part_name.trim()) {
    return { error: "ເຄມອາໄຫຼ່ຕ້ອງລະບຸຊື່ອາໄຫຼ່" };
  }

  const d0 = parsed.data;
  /**
   * ── ງານທີ່ **ຈົບແລ້ວ** ແກ້ໄດ້ແຕ່ຂໍ້ມູນທີ່ບໍ່ຍ້ອນຫຼັງໄປແຕະເງິນ/ຂັ້ນຕອນ ──
   *
   * ຝັ່ງຕິດຕັ້ງ ແລະ ບຳລຸງຮັກສາກັນໄວ້ຢູ່ແລ້ວ (updateInstall: ປິດງານ ⇒ ແກ້ໄດ້ແຕ່ ISN ·
   * updateMaintenance: ຊ່າງຮັບ/ຍົກເລີກ ⇒ ຫ້າມ) ແຕ່**ຝັ່ງສ້ອມບໍ່ກັນເລີຍ** ⇒ ໃບທີ່
   * ສົ່ງຄືນລູກຄ້າໄປແລ້ວ ຍັງປ່ຽນ ປະເພດບໍລິການ · ການຮັບປະກັນ · ຊ່າງ · ປະເພດງານ(ເຄມ) ໄດ້
   * ທັງທີ່ຄ່າພວກນີ້**ຄິດຄ່າຄອມ (recordPayout) · ລົງລາຍງານ · ຕັດສິດເຄມ ໄປແລ້ວ**
   * ⇒ ຕົວເລກຫຼັງບ້ານປ່ຽນຍ້ອນຫຼັງໂດຍບໍ່ມີໃຜຮູ້.
   *
   * ບໍ່ຫ້າມທັງໃບ (ຄົນຍັງຕ້ອງແກ້ SN/ຮຸ່ນ/ເບີໂທ/ໝາຍເຫດ ພິມຜິດໄດ້) — ຫ້າມ**ສະເພາະຊ່ອງ
   * ທີ່ປ່ຽນຄວາມໝາຍທາງເງິນ/ຂັ້ນຕອນ** ແລ້ວບອກໄປເລີຍວ່າຊ່ອງໃດ.
   */
  const finished = (
    await db.query<{
      returned: boolean; cancelled: boolean;
      service_type: string | null; warrunty: string | null; emp_code: string | null; job_kind: string | null;
    }>(
      `select (return_complete is not null) returned, (status = 6) cancelled,
          nullif(service_type,'') service_type, nullif(warrunty,'') warrunty,
          nullif(emp_code,'') emp_code, coalesce(job_kind,'repair') job_kind
        from tb_product where code = $1 limit 1`,
      [d0.code],
    )
  ).rows[0];
  if (finished && (finished.returned || finished.cancelled)) {
    const locked: string[] = [];
    const same = (a: string | null, b: string) => (a ?? "") === b.trim();
    if (!same(finished.service_type, d0.service_type)) locked.push("ປະເພດບໍລິການ");
    if (!same(finished.warrunty, d0.pro_wa)) locked.push("ການຮັບປະກັນ");
    if (!same(finished.emp_code, d0.emp)) locked.push("ຊ່າງ");
    if (!same(finished.job_kind, d0.job_kind)) locked.push("ປະເພດງານ (ສ້ອມ/ເຄມ)");
    if (locked.length > 0) {
      return {
        error:
          `ງານນີ້${finished.returned ? "ສົ່ງຄືນລູກຄ້າແລ້ວ" : "ຖືກຍົກເລີກແລ້ວ"} — ແກ້ ${locked.join(" · ")} ບໍ່ໄດ້ ` +
          "(ຄ່າເຫຼົ່ານີ້ຄິດຄ່າຄອມ · ລົງລາຍງານ · ຕັດສິດເຄມ ໄປແລ້ວ). ຂໍ້ມູນອື່ນ (SN · ຮຸ່ນ · ຕິດຕໍ່ · ໝາຍເຫດ) ຍັງແກ້ໄດ້.",
      };
    }
  }

  const files = await collectUploads(formData);
  if (!files.ok) return { error: files.error };

  const d = parsed.data;
  const client = await db.connect();
  const written: string[] = [];
  /** ໃບເຄມ CLM-B ທີ່ຫາກໍ່ເກີດຈາກການໝາຍເປັນງານເຄມຢູ່ໜ້າແກ້ໄຂ — log ຫຼັງ commit */
  let claimDocNo = "";

  try {
    await client.query("begin");

    /**
     * ── ໝາຍ "ຮ້ານຄ້າ/ລູກຄ້າຂໍເຄມ" ພາຍຫຼັງ ──
     * ອ່ານສະຖານະປັດຈຸບັນກ່ອນ ເພາະ 3 ຢ່າງຂຶ້ນກັບມັນ:
     *   ① ສ້ອມ → ເຄມ  = ສ້າງໃບເຄມ CLM-B ໃຫ້ (ຄືກັນກັບ createService)
     *   ② ເຄມ → ສ້ອມ  = **ຫ້າມ** ຖ້າມີໃບເຄມຜູກຢູ່ແລ້ວ (ຈັດການທີ່ໃບເຄມ ບໍ່ແມ່ນລຶບຄວາມຊົງຈຳຖິ້ມ)
     *   ③ ເຄມ → ເຄມ   = ອັບເດດຂອບເຂດ (ທັງເຄື່ອງ/ອາໄຫຼ່) ໃສ່ໃບເຄມນຳ
     */
    const before = (
      await client.query<{ job_kind: string; claim_no: string | null }>(
        `select coalesce(job_kind,'repair') job_kind,
            (select cl.claim_no from ods_claim cl where cl.ref_job = p.code order by cl.id limit 1) claim_no
           from tb_product p where p.code=$1 for update`,
        [d.code],
      )
    ).rows[0];
    if (!before) {
      await client.query("rollback");
      return { error: "ບໍ່ພົບລາຍການ" };
    }
    const claimChange = claimMarkChange(
      { kind: before.job_kind, claimNo: before.claim_no },
      d.job_kind,
    );
    if (claimChange === "blocked") {
      await client.query("rollback");
      return { error: `ໃບງານນີ້ຜູກກັບໃບເຄມ ${before.claim_no} ແລ້ວ — ປ່ຽນກັບເປັນງານສ້ອມບໍ່ໄດ້ (ຈັດການທີ່ໃບເຄມ)` };
    }

    const updated = await client.query(
      `update tb_product set name_1=$1, sn=$2, p_model=$3, p_brand=$4, p_access=$5, issue=$6, p_type=$7,
         p_abrasion=$8, p_delivery=$9, warrunty=$10, service_type=$11, cust_code=$12, ap_code=$13, doc_def=$14,
         doc_date_ref=$15,
         repair_confirm=case when emp_code is distinct from $16::varchar then null else repair_confirm end,
         emp_code=$16, user_edit=$17,
         location_repair=nullif($19,''), appoint_date=nullif($20,'')::date,
         location_lat=nullif($21,'')::double precision, location_lng=nullif($22,'')::double precision,
         job_kind=$23, claim_scope=nullif($24,''), claim_part_code=nullif($25,''),
         claim_part_name=nullif($26,''), claim_part_sn=nullif($27,''), claim_part_qty=$28,
         -- ບ່ອນຮັບເຄື່ອງ — ແກ້ໄດ້ (ເລືອກຜິດຕອນຮັບ ⇒ ດ່ານກ່ອນສົ່ງຄືນຈະຫ້າມຜິດໆ).
         -- ບ່ອນທີ່ເຄື່ອງຢູ່ (service_center) ຕັ້ງໃຫ້ພ້ອມກັນ **ສະເພາະຕອນທີ່ຍັງບໍ່ເຄີຍມີຄ່າ**
         -- — ຖ້າມີແລ້ວ ໝາຍວ່າມີການໂອນເກີດຂຶ້ນ ⇒ ຢ່າໄປຂຽນທັບຄວາມຈິງນັ້ນ.
         intake_center=nullif($29,''),
         service_center=case when coalesce(service_center,'')='' then nullif($29,'') else service_center end,
         -- ວັນເວລາຮັບເຄື່ອງ — ຫວ່າງ = ຄົງຄ່າເດີມ (ບໍ່ລ້າງ ເພາະທຸກໃບຕ້ອງມີເວລາຮັບ)
         time_register=coalesce(nullif($30,'')::timestamp, time_register)
       where code=$18`,
      [d.proname, d.pro_sn, d.pro_model, d.pro_brand, d.pro_acc, d.pro_issue, d.pro_type, d.pro_remark,
        // ap_code = ລະຫັດລູກຄ້າ (ອັນດຽວກັນ — ເບິ່ງ createService)
        d.pro_deli, d.pro_wa, d.service_type, d.cust_code, d.cust_code, d.billon, d.billdate, d.emp, session.username, d.code,
        d.location_repair, d.appoint_date, d.location_lat, d.location_lng,
        d.job_kind,
        d.job_kind === "claim" ? d.claim_scope ?? "" : "",
        d.job_kind === "claim" ? d.claim_part_code : "",
        d.job_kind === "claim" ? d.claim_part_name : "",
        d.job_kind === "claim" ? d.claim_part_sn : "",
        d.job_kind === "claim" && d.claim_scope === "part" ? d.claim_part_qty ?? 1 : null,
        d.intake_center, d.time_register],
    );
    if (!updated.rowCount) {
      await client.query("rollback");
      return { error: "ບໍ່ພົບລາຍການ" };
    }

    if (claimChange === "create-claim") {
      // ຍັງບໍ່ມີໃບເຄມ ⇒ ສ້າງ CLM-B ໃຫ້ ຄືກັນທຸກຊ່ອງກັບຕອນເປີດງານແບບ "ງານເຄມ"
      const claimId = (
        await client.query<{ id: number }>(
          `insert into ods_claim(claim_type,customer_code,brand_code,ref_job,reason,status,created_by,
             product,model,sn,warranty,purchase_date,contact,bill_no,claim_scope)
           values('B',$1,nullif($2,''),$3,$4,'received',$5,$6,$7,nullif($8,''),
             $9,nullif($10,'')::date,nullif($11,''),nullif($12,''),$13) returning id`,
          [d.cust_code, d.pro_brand, d.code, d.pro_issue, session.username, d.proname, d.pro_model, d.pro_sn,
            d.pro_wa === "ຮັບປະກັນ" ? "in" : "out", d.billdate, d.cust_tel, d.billon, d.claim_scope],
        )
      ).rows[0].id;
      const claimNo = `CLM${String(claimId).padStart(5, "0")}`;
      await client.query(`update ods_claim set claim_no=$2 where id=$1`, [claimId, claimNo]);
      claimDocNo = claimNo;
      if (d.claim_scope === "part") {
        await client.query(
          `insert into ods_claim_item(claim_no,item_code,item_name,qty,unit,amount,note)
           values($1,nullif($2,''),$3,$4,'ອັນ',0,nullif($5,''))`,
          [claimNo, d.claim_part_code, d.claim_part_name.trim(), d.claim_part_qty ?? 1, d.claim_part_sn ? `SN: ${d.claim_part_sn}` : ""],
        );
      }
    } else if (claimChange === "sync-claim") {
      /**
       * ມີໃບເຄມຢູ່ແລ້ວ ⇒ ຢ່າສ້າງໃບຊ້ຳ ແຕ່ຕ້ອງໃຫ້ **ສອງບ່ອນເວົ້າຄືກັນ**:
       * ຂອບເຂດ (ທັງເຄື່ອງ/ອາໄຫຼ່) ແລະ ແຖວອາໄຫຼ່ຂອງໃບເຄມ. ບໍ່ດັ່ງນັ້ນແກ້ຊື່ອາໄຫຼ່ຢູ່ໃບງານ
       * ແລ້ວໃບເຄມທີ່ສົ່ງໃຫ້ supplier ຍັງເປັນຊື່ເກົ່າ.
       *
       * ⚠️ ແຕະໄດ້ພຽງໃບທີ່ **ຍັງແກ້ໄດ້** (ຍັງບໍ່ສົ່ງ — isClaimEditable ຝັ່ງໃບເຄມໃຊ້ນິຍາມນີ້)
       * ແລະ ພຽງແຖວດຽວ (ໃບທີ່ເກີດຈາກ intake ມີແຖວດຽວສະເໝີ) — ໃບທີ່ຄົນເຄມເພີ່ມລາຍການເອງ
       * ຫຼາຍແຖວແລ້ວ ປະໄວ້ ບໍ່ໄປຂຽນທັບວຽກຂອງເຂົາ.
       */
      await client.query("update ods_claim set claim_scope=$2 where claim_no=$1", [before.claim_no, d.claim_scope]);
      if (d.claim_scope === "part" && d.claim_part_name.trim()) {
        const editable = await client.query<{ id: number; items: number }>(
          `select c.id, (select count(*)::int from ods_claim_item i where i.claim_no = c.claim_no) items
             from ods_claim c where c.claim_no = $1 and c.status = 'received'`,
          [before.claim_no],
        );
        if (editable.rows[0]?.items === 1) {
          await client.query(
            `update ods_claim_item set item_code=nullif($2,''), item_name=$3, qty=$4, note=nullif($5,'')
              where claim_no=$1`,
            [
              before.claim_no,
              d.claim_part_code,
              d.claim_part_name.trim(),
              d.claim_part_qty ?? 1,
              d.claim_part_sn ? `SN: ${d.claim_part_sn}` : "",
            ],
          );
        } else if (editable.rows[0]?.items === 0) {
          await client.query(
            `insert into ods_claim_item(claim_no,item_code,item_name,qty,unit,amount,note)
             values($1,nullif($2,''),$3,$4,'ອັນ',0,nullif($5,''))`,
            [
              before.claim_no,
              d.claim_part_code,
              d.claim_part_name.trim(),
              d.claim_part_qty ?? 1,
              d.claim_part_sn ? `SN: ${d.claim_part_sn}` : "",
            ],
          );
        }
      }
    }

    // ຮູບໃໝ່ຈະຖືກ "ເພີ່ມ" ເຂົ້າໄປ ຄື update_rcpro() ຂອງ ods (ຮູບເກົ່າຍັງຢູ່)
    await saveUploads(client, d.code, files.uploads, written);
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    await Promise.all(written.map((path) => unlink(path).catch(() => {})));
    console.error("Update service failed", error);
    return { error: "ບັນທຶກບໍ່ສຳເລັດ ກະລຸນາກວດຂໍ້ມູນ" };
  } finally {
    client.release();
  }

  // ຊ່າງອາດຖືກປ່ຽນຕອນແກ້ໄຂ → ແຈ້ງຊ່າງຄົນປັດຈຸບັນນຳ
  await logChange("tb_product", d.code, `ແກ້ໄຂໃບຮັບເຄື່ອງ · ອາການ: ${d.pro_issue}${d.emp ? ` · ຊ່າງ ${d.emp}` : " · ຍັງບໍ່ຈັດຊ່າງ"}`, {
    users: d.emp ? [d.emp] : [],
  });
  // ໝາຍເປັນງານເຄມພາຍຫຼັງ ⇒ ໃບເຄມທີ່ຫາກໍ່ເກີດ ຕ້ອງເຫັນຢູ່ທັງ 2 timeline (ຄື createService)
  if (claimDocNo) {
    const item = [d.proname, d.pro_brand, d.pro_model].filter(Boolean).join(" ");
    await logChange("tb_product", d.code, `ໝາຍເປັນງານເຄມ · ສ້າງໃບເຄມ ${claimDocNo}${d.claim_scope === "part" ? ` · ເຄມສະເພາະອາໄຫຼ່ ${d.claim_part_name}` : " · ເຄມທັງໜ່ວຍ"}`);
    await logChange("ods_claim", claimDocNo, `ເປີດໃບເຄມຈາກໃບຮັບເຄື່ອງ #${d.code} · ${item}${d.claim_scope === "part" ? " · ເຄມສະເພາະອາໄຫຼ່" : " · ເຄມທັງໜ່ວຍ"}`, { roles: ["manager", "stock"] });
  }
  // ແຈ້ງອອກມືຖືຂອງຊ່າງນຳ (ລົ້ມເຫຼວກໍ່ບໍ່ກະທົບການບັນທຶກ — ເບິ່ງ lib/push)
  if (d.emp) await pushToUser(d.emp, "ມີງານສ້ອມແປງ", `${d.code} · ${d.proname} — ${d.pro_issue}`, {
    workflow: "repair",
    code: d.code,
  });

  redirect(`/service/${d.code}`);
}

/* ---------- ລົບໃບຮັບເຄື່ອງ — **ຖອດອອກແລ້ວ** ----------------------
 *
 * ໃບຮັບເຄື່ອງ **ລົບບໍ່ໄດ້ອີກຕໍ່ໄປ** (ທຸກໃບ). ໃຊ້ "ຂໍຍົກເລີກ" ແທນ (requestCancel)
 * ເຊິ່ງມີຂັ້ນຕອນອະນຸມັດ ແລະ ເຫຼືອຮ່ອງຮອຍຄົບ.
 *
 * ຂອງເກົ່າອັນຕະລາຍກວ່າທີ່ຄິດ: ມັນ `delete from ic_trans where product_code=$1`
 * ⇒ ລຶບ **ໃບສະເໜີລາຄາ · ໃບຂໍເບີກ · ໃບເບີກ · ໃບຮັບເງິນ** ຂອງງານນັ້ນຖິ້ມນຳ
 * ທັງທີ່ອາໄຫຼ່ອອກຈາກສາງໄປແລ້ວ ແລະ ສະຕັອກ ERP ຖືກຕັດໄປແລ້ວ
 * ⇒ ຂອງຫາຍຈາກສາງໂດຍບໍ່ມີເອກະສານຮັບຮູ້ ແລະ ຍອດຂາຍຫາຍຈາກລາຍງານ.
 * ດຽວນີ້ງານຍັງຜູກກັບຄ່າຄອມຂອງຊ່າງ (ods_service_payout) ນຳ.
 *
 * ຖອດທັງ action ບໍ່ແມ່ນເຊື່ອງແຕ່ປຸ່ມ — server action ຖືກຍິງໂດຍກົງໄດ້ (lib/guard).
 */

/* ---------- ຍົກເລີກ / ຖອນການຍົກເລີກ — ຄື /submit_ccpro + /cc_ccpro ຂອງ ods ---------- */

export async function requestCancel(code: string, remark: string): Promise<ServiceState> {
  const guard = await requirePermission("/service", "update", SERVICE_SIDE);
  if (!guard.ok) return { error: guard.error };
  const session = guard.session;
  if (!remark.trim()) return { error: "ກະລຸນາປ້ອນລາຍລະອຽດ" };
  if (!db) return { error: "ບໍ່ພົບ DATABASE_URL" };

  const updated = await db.query(
    "update tb_product set status=6, remark=$1, cancel_start=localtimestamp, request_cancel=$2 where code=$3 and status<>6",
    [remark.trim(), session.username, code],
  );
  if (!updated.rowCount) return { error: "ບໍ່ພົບລາຍການ ຫຼືຖືກຍົກເລີກໄປແລ້ວ" };
  await logChange("tb_product", code, `ຂໍຍົກເລີກໃບຮັບເຄື່ອງ: ${remark.trim()}`);
  revalidatePath("/service/cancel");
  revalidatePath("/service");
  return {};
}

/**
 * ສະຖານະທີ່ຄວນເປັນ ຖ້າບໍ່ໄດ້ຖືກຍົກເລີກ — ຄິດຄືນຈາກຖັນເວລາຂອງໃບນັ້ນເອງ.
 *
 * ods (ແລະ undoCancel ເກົ່າ) ຕັ້ງ status=1 ຕາຍຕົວ ⇒ ວຽກທີ່ຂໍຍົກເລີກຕອນກຳລັງສ້ອມ
 * ຖືກໂຍນກັບໄປ "ລໍຖ້າກວດເຊັກ" ທັງທີ່ກວດ ແລະ ສ້ອມໄປແລ້ວ. ບ່ອນນີ້ຄືນສູ່ຂັ້ນຈິງຂອງມັນ
 * (ສູດຫຼັງກວດເຊັກ = ສູດດຽວກັນກັບ saveCheck ຂອງ actions/checking.ts).
 */
const RESTORED_STATUS = `case
  when p.time_check is null                then 1
  when p.time_finish_check is null         then 2
  when p.time_finish_repair is not null    then 5
  when coalesce(p.used_spare,0)=1          then (case when p.warrunty='ຮັບປະກັນ' then 3 else 2 end)
  else (case when p.warrunty='ຮັບປະກັນ' then 4 else 2 end)
end`;

export type ClearCancelResult = { ok: boolean; error?: string; requester?: string; reason?: string };

/**
 * ລ້າງ "ຄຳຂໍຍົກເລີກ" ອອກຈາກໃບຮັບເຄື່ອງ ແລ້ວດຶງວຽກກັບຄືນສູ່ຂັ້ນປົກກະຕິ.
 *
 * ໃຊ້ຮ່ວມກັນ 2 ບ່ອນ:
 *   · undoCancel()          — ຜູ້ຂໍ (ຝ່າຍບໍລິການ) ຖອນຄຳຂໍຂອງຕົນເອງ
 *   · rejectCancellation()  — ຜູ້ອະນຸມັດ **ບໍ່ອະນຸມັດ** ການຍົກເລີກ (actions/approval.ts)
 *
 * ຄືນ request_cancel (ຜູ້ຂໍ) ແລະ remark (ເຫດຜົນເດີມ) ຂອງ **ຄ່າກ່ອນລ້າງ** ດ້ວຍ CTE
 * ເພື່ອໃຫ້ຜູ້ເອີ້ນເອົາໄປແຈ້ງເຕືອນ ແລະ ຂຽນ chatter ໄດ້.
 * ລ້າງໄດ້ສະເພາະທີ່ຍັງບໍ່ທັນອະນຸມັດ (cancel_finish isnull) — ອະນຸມັດແລ້ວຫ້າມຍ້ອນ.
 */
export async function clearCancelRequest(code: string): Promise<ClearCancelResult> {
  const guard = await requireRole([...SERVICE_SIDE, ...APPROVER_SIDE], "ບໍ່ມີສິດຖອນຄຳຂໍຍົກເລີກ");
  if (!guard.ok) return { ok: false, error: guard.error };
  if (!db) return { ok: false, error: "ບໍ່ພົບ DATABASE_URL" };
  // server action ຖືກຍິງໂດຍກົງໄດ້ (ບໍ່ຜ່ານໜ້າ) ⇒ ກວດສິດຢູ່ນີ້ອີກຊັ້ນ:
  // ຝ່າຍບໍລິການ (ຜູ້ຂໍ) ຫຼື ຜູ້ອະນຸມັດ ເທົ່ານັ້ນ — ຊ່າງ/ສາງ ບໍ່ກ່ຽວ
  const cleared = await db.query<{ request_cancel: string | null; remark: string | null }>(
    `with target as (
        select code, request_cancel, remark from tb_product
         where code=$1 and status=6 and cancel_start is not null and cancel_finish is null
         for update)
      update tb_product p
         set status=(${RESTORED_STATUS}), remark='', cancel_start=null, request_cancel=null
        from target t
       where p.code = t.code
      returning t.request_cancel, t.remark`,
    [code],
  );
  if (!cleared.rowCount) return { ok: false, error: "ບໍ່ສາມາດຖອນຄືນໄດ້ — ອະນຸມັດຍົກເລີກໄປແລ້ວ ຫຼື ບໍ່ມີຄຳຂໍຍົກເລີກ" };

  return {
    ok: true,
    requester: (cleared.rows[0]?.request_cancel ?? "").trim(),
    reason: (cleared.rows[0]?.remark ?? "").trim(),
  };
}

export async function undoCancel(code: string): Promise<ServiceState> {
  const cleared = await clearCancelRequest(code);
  if (!cleared.ok) return { error: cleared.error };

  await logChange("tb_product", code, "ຖອນຄຳຂໍຍົກເລີກ — ວຽກກັບຄືນສູ່ຄິວປົກກະຕິ");
  revalidatePath("/service/cancel");
  revalidatePath("/service");
  revalidatePath("/approvals/cancellations", "layout");
  return {};
}

/* ---------- ບັນທຶກການຕິດຕໍ່ລູກຄ້າ — ຄື /add_cust_contact/<code> ຂອງ ods ---------- */

export async function addContact(code: string, datetime: string, remark: string): Promise<ServiceState> {
  const guard = await requirePermission("/service", "update", SERVICE_SIDE);
  if (!guard.ok) return { error: guard.error };
  if (!datetime) return { error: "ກະລຸນາເລືອກວັນ/ເວລາ" };
  if (!db) return { error: "ບໍ່ພົບ DATABASE_URL" };

  const client = await db.connect();
  try {
    await client.query("begin");
    // ຄິດເລກຮອບໃນ transaction ດຽວກັນ ກັນສອງຄົນເພີ່ມພ້ອມກັນແລ້ວໄດ້ຮອບຊ້ຳ
    await client.query("select pg_advisory_xact_lock(734211)");
    const next = await client.query<{ round: number }>(
      "select coalesce(max(round),0)+1 round from cust_contactor where product_code=$1",
      [code],
    );
    await client.query(
      "insert into cust_contactor(product_code, round, datetime, remark) values($1,$2,$3,$4)",
      [code, next.rows[0].round, datetime, remark],
    );
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    console.error("Add contact failed", error);
    return { error: "ບັນທຶກບໍ່ສຳເລັດ" };
  } finally {
    client.release();
  }
  await logChange("tb_product", code, `ຕິດຕໍ່ລູກຄ້າ (${datetime})${remark.trim() ? `: ${remark.trim()}` : ""}`);
  revalidatePath(`/service/${code}/contacts`);
  return {};
}

/* ---------- ຮັບງານຈາກໃບແຈ້ງສ້ອມອອນລາຍ — ຄື /save_rcpro_online ຂອງ ods ---------- */

// ໃຊ້ຊ່ອງລູກຄ້າ/ສິນຄ້າ ຊຸດດຽວກັບໜ້າ "ຮັບເຄື່ອງໂດຍພະນັກງານ" (schema) — ບວກ ref_notice ຂອງໃບແຈ້ງ
const onlineSchema = schema.extend({
  ref_notice: z.string().min(1),
  sup_name: z.string().optional().default(""),
});

export async function createServiceFromNotice(_: ServiceState, formData: FormData): Promise<ServiceState> {
  const guard = await requirePermission("/service", "create", SERVICE_SIDE);
  if (!guard.ok) return { error: guard.error };
  const session = guard.session;
  if (!db) return { error: "ບໍ່ພົບ DATABASE_URL" };

  const parsed = onlineSchema.safeParse(
    Object.fromEntries([...formData.entries()].filter(([, value]) => typeof value === "string")),
  );
  if (!parsed.success) return { error: missingFieldsError(parsed.error.issues) };

  // ງານນອກສະຖານທີ່ຕ້ອງຮູ້ວ່າ "ໄປໃສ" (ຄືກັບຕອນສ້າງ — ຟອມກວດແລ້ວ ແຕ່ action ຖືກຍິງໂດຍກົງໄດ້)
  if (NEEDS_LOCATION(parsed.data.service_type) && !parsed.data.location_repair.trim()) {
    return { error: "ງານນອກສະຖານທີ່ (ສ້ອມບ້ານລູກຄ້າ / ໄປຮັບເຄື່ອງຈາກບ້ານມາສ້ອມຢູ່ສູນ) ຕ້ອງລະບຸສະຖານທີ່ໜ້າງານ" };
  }
  /**
   * ── ພິກັດ **ບັງຄັບ** ສຳລັບງານນອກສະຖານທີ່ (01-08-2026) ──
   *
   * ວັດຂໍ້ມູນຈິງ: ງານສ້ອມທີ່ເປີດຢູ່ 124 ໃບ **ບໍ່ມີພິກັດຈັກໃບ** ⇒ ແຜນທີ່ຕິດຕາມງານ
   * (ເວັບ /map ແລະ ແອັບ) ວ່າງເປົ່າ ແລະ ຊ່າງອອກໄປຫາບ້ານລູກຄ້າດ້ວຍທີ່ຢູ່ຂໍ້ຄວາມລ້ວນ.
   * ຊ່ອງປັກໝຸດມີຢູ່ໃນຟອມແລ້ວ ພຽງແຕ່ "ບໍ່ບັງຄັບ" ⇒ ບໍ່ມີໃຜກົດ.
   *
   * ⚠️ ບັງຄັບ **ສະເພາະ IH/PS** ເທົ່ານັ້ນ — ງານທີ່ລູກຄ້າຫອບເຄື່ອງມາເອງ (CI/ST)
   * ບໍ່ມີ "ໜ້າງານ" ໃຫ້ປັກ ⇒ ບັງຄັບໄປກໍ່ຂວາງການຮັບເຄື່ອງປະຈຳວັນລ້າໆ.
   */
  if (
    NEEDS_LOCATION(parsed.data.service_type) &&
    (!parsed.data.location_lat.trim() || !parsed.data.location_lng.trim())
  ) {
    /**
     * ຍັງບໍ່ມີໝຸດ ⇒ ລອງເອົາຈາກ **ຂໍ້ມູນລູກຄ້າໃນ ERP** ກ່ອນຈະຟ້ອງ (lib/customer-location).
     * ຟອມຕື່ມໃຫ້ຢູ່ແລ້ວຕອນເລືອກລູກຄ້າ ແຕ່ action ຖືກຍິງໂດຍກົງໄດ້ ແລະ ຄົນອາດເລືອກ
     * ລູກຄ້າກ່ອນທີ່ຈະປ່ຽນເປັນ IH/PS ⇒ ກວດຊ້ຳຢູ່ນີ້ໃຫ້ແນ່ໃຈ.
     */
    const known = await customerPoint(parsed.data.cust_ref || parsed.data.cust_code);
    if (known) {
      parsed.data.location_lat = String(known.lat);
      parsed.data.location_lng = String(known.lng);
    } else {
      return {
        error: "ງານນອກສະຖານທີ່ ຕ້ອງປັກໝຸດພິກັດນຳ — ວາງລິງ Google Maps ຫຼື ກົດ “ໃຊ້ຕຳແໜ່ງປັດຈຸບັນ” (ຊ່າງໃຊ້ຫາບ້ານລູກຄ້າ ແລະ ຂຶ້ນແຜນທີ່ຕິດຕາມງານ)",
      };
    }
  }

  // IH + ຈັດຊ່າງ ⇒ ຕ້ອງມີວັນນັດ (ຄືກັບໜ້າອອກໃໝ່ + assignRepairTech) ບໍ່ດັ່ງນັ້ນຄ້າງຂັ້ນ 0 ຮັບງານບໍ່ໄດ້
  if (parsed.data.service_type === "IH" && parsed.data.emp.trim() && !parsed.data.appoint_date.trim()) {
    return { error: "ໄປສ້ອມບ້ານລູກຄ້າ (IH) ທີ່ຈັດຊ່າງແລ້ວ ຕ້ອງໃສ່ວັນນັດໝາຍໄປສ້ອມ" };
  }

  const files = await collectUploads(formData);
  if (!files.ok) return { error: files.error };
  // ຮູບຮັບເຄື່ອງບໍ່ບັງຄັບ (07-08-2026 — ຄືກັບໜ້າຮັບໃໝ່; ແນບພາຍຫຼັງໄດ້ຢູ່ໜ້າໃບງານ)

  const d = parsed.data;
  const client = await db.connect();
  const written: string[] = [];
  let code = "";

  try {
    await client.query("begin");
    await client.query("select pg_advisory_xact_lock(734210)");

    const done = await client.query("select code from tb_product where ref_notice=$1 limit 1", [d.ref_notice]);
    if (done.rows[0]) {
      await client.query("rollback");
      return { error: `ໃບແຈ້ງນີ້ຖືກຮັບເຂົ້າແລ້ວ: ${done.rows[0].code}` };
    }

    // ລູກຄ້າ: ຄືກັບໜ້າຮັບເຄື່ອງໂດຍພະນັກງານ — ເລືອກຈາກ ERP (copy ເຂົ້າ ODS ໃຫ້ ຖ້າຍັງບໍ່ມີບັນຊີ)
    const custCode = await resolveCustomer(client, d);
    if (!custCode) {
      await client.query("rollback");
      return { error: "ກະລຸນາເລືອກລູກຄ້າ" };
    }

    code = String(
      (await client.query<{ code: number }>("select coalesce(max(code::int),0)+1 code from tb_product where code~'^[0-9]+$'")).rows[0].code,
    );

    await client.query(
      `insert into tb_product(code,name_1,sn,p_model,p_brand,p_access,issue,p_type,p_abrasion,p_delivery,
         warrunty,service_type,cust_code,ap_code,doc_def,doc_date_ref,status,emp_code,time_register,user_regis,sup_name,ref_notice,
         item_code,location_repair,appoint_date,location_lat,location_lng)
       values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,1,$17,localtimestamp,$18,$19,$20,
         nullif($21,''),nullif($22,''),nullif($23,'')::date,nullif($24,'')::double precision,nullif($25,'')::double precision)`,
      [code, d.proname, d.pro_sn, d.pro_model, d.pro_brand, d.pro_acc, d.pro_issue, d.pro_type, d.pro_remark,
        d.pro_deli, d.pro_wa, d.service_type, custCode, custCode, d.billon, d.billdate, d.emp, session.username,
        d.sup_name, d.ref_notice, d.item_code ?? "", d.location_repair, d.appoint_date, d.location_lat, d.location_lng],
    );

    // ຮູບທີ່ລູກຄ້າແນບມາ (ref_code = ລະຫັດໃບແຈ້ງ) → ຍ້າຍທັງໝົດມາເປັນຮູບຂອງງານນີ້
    await client.query(`update product_image set iteme_code=$1 where ref_code=$2`, [code, d.ref_notice]);
    // ຮູບໃໝ່ທີ່ພະນັກງານແນບເພີ່ມ (ບໍ່ຈຳກັດຈຳນວນ) — ຕໍ່ທ້າຍ line_number ຈາກຮູບເກົ່າ
    await saveUploads(client, code, files.uploads, written);

    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    await Promise.all(written.map((path) => unlink(path).catch(() => {})));
    console.error("Create service from notice failed", error);
    return { error: "ບັນທຶກບໍ່ສຳເລັດ ກະລຸນາກວດຂໍ້ມູນ" };
  } finally {
    client.release();
  }

  const item = [d.proname, d.pro_brand, d.pro_model].filter(Boolean).join(" ");
  await logChange(
    "tb_product",
    code,
    `ເປີດໃບຮັບເຄື່ອງຈາກໃບແຈ້ງສ້ອມອອນລາຍ ${d.ref_notice}: ${item} · ອາການ: ${d.pro_issue}`,
  );

  // ຈື່ພິກັດໜ້າງານໃສ່ຂໍ້ມູນລູກຄ້າ ຄືກັບທາງ createService
  await rememberSitePoint(d, code);

  revalidatePath("/service/notices");
  redirect(`/service/${code}`);
}

/* ------------------------------------------------- ໝາຍເຫດຂອງໃບ (ແກ້ຢູ່ຕາຕະລາງ) */

export type RemarkState = { error?: string; ok?: boolean };

/**
 * **ບັນທຶກໝາຍເຫດຂອງໃບຮັບເຄື່ອງ ຈາກໜ້າລາຍການ** — ບໍ່ຕ້ອງເປີດເຂົ້າໄປແກ້ທັງໃບ.
 *
 * ໝາຍເຫດຄືບ່ອນທີ່ CS ຂຽນເລື່ອງທີ່ຄົນຕໍ່ໄປຕ້ອງຮູ້ (ລູກຄ້າໂທມາຖາມ · ນັດຮັບໃໝ່ ...)
 * ⇒ ຕ້ອງຂຽນໄດ້ໄວຈາກຄິວ. ໃຊ້ຖັນ `tb_product.remark` ອັນເກົ່າ (558/5,104 ໃບມີແລ້ວ)
 * ບໍ່ສ້າງບ່ອນເກັບໃໝ່ — ໜ້າລາຍລະອຽດ/ພິມ ອ່ານຖັນນີ້ຢູ່ແລ້ວ.
 *
 * ສິດ: ຄືກັບການແກ້ໃບ (`/service` update) — ຄົນທີ່ແກ້ໃບໄດ້ ຂຽນໝາຍເຫດໄດ້.
 * ທຸກການປ່ຽນລົງ timeline ຂອງໃບ (ໝາຍເຫດເປັນຂໍ້ມູນທີ່ຄົນອື່ນເຫັນ ⇒ ຕ້ອງຮູ້ວ່າໃຜແກ້).
 */
export async function saveJobRemark(_: RemarkState, formData: FormData): Promise<RemarkState> {
  const guard = await requirePermission("/service", "update", SERVICE_SIDE, "ບໍ່ມີສິດແກ້ໃບຮັບເຄື່ອງ");
  if (!guard.ok) return { error: guard.error };
  if (!db) return { error: "ບໍ່ພົບ DATABASE_URL" };

  const code = String(formData.get("code") ?? "").trim();
  const remark = String(formData.get("remark") ?? "").trim().slice(0, 500);
  if (!code) return { error: "ບໍ່ພົບເລກໃບ" };

  const before = (
    await db.query<{ remark: string | null }>(`select remark from tb_product where code = $1`, [code])
  ).rows[0];
  if (!before) return { error: `ບໍ່ພົບໃບ ${code}` };
  // ບໍ່ປ່ຽນຫຍັງ ⇒ ບໍ່ຂຽນ ບໍ່ລົງ timeline (ກັນ timeline ເຕັມໄປດ້ວຍ "ແກ້ໝາຍເຫດ" ຊ້ຳໆ)
  if ((before.remark ?? "").trim() === remark) return { ok: true };

  await db.query(`update tb_product set remark = $2, user_edit = $3 where code = $1`, [
    code,
    remark || null,
    guard.session.username,
  ]);
  await logChange(
    "tb_product",
    code,
    remark ? `ໝາຍເຫດ: ${remark}` : `ລຶບໝາຍເຫດ (ເກົ່າ: ${before.remark ?? "-"})`,
  );
  revalidatePath("/service");
  revalidatePath(`/service/${code}`);
  return { ok: true };
}
