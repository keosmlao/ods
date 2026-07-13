"use server";
import { logChange } from "@/app/actions/chatter";
import { pushToUser } from "@/lib/push";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { APPROVER_SIDE, roleOf, SERVICE_SIDE } from "@/lib/roles";
import { ONSITE_SERVICE_TYPES } from "@/lib/sla";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { PoolClient } from "pg";
import { z } from "zod";

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
  pro_issue: z.string().min(1),
  pro_remark: z.string(),
  billon: z.string(),
  billdate: z.string(),
  emp: z.string().min(1),
  /**
   * ── ງານນອກສະຖານທີ່ (IH ສ້ອມບ້ານລູກຄ້າ · PS ໄປຮັບບ້ານລູກຄ້າ = 75% ຂອງໃບ) ──
   * ແຕ່ກ່ອນ tb_product ບໍ່ມີຖັນສະຖານທີ່ເລີຍ ⇒ ຊ່າງອາໄສທີ່ຢູ່ຂອງ **ລູກຄ້າ** ເຊິ່ງ
   * ອາດເປັນທີ່ຢູ່ຮ້ານ/ສຳນັກງານໃຫຍ່ ບໍ່ແມ່ນບ່ອນທີ່ເຄື່ອງຕິດຢູ່ ⇒ ໄປຜິດບ່ອນ.
   * ບັງຄັບສະເພາະ IH/PS (ກວດລຸ່ມນີ້) — CI/ST ເຮັດຢູ່ສູນ ບໍ່ຕ້ອງມີ.
   */
  location_repair: z.string().optional().default(""),
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

const uploadsDir = process.env.ODS_UPLOADS_DIR;
const ALLOWED = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp"]);
const MAX_BYTES = 16 * 1024 * 1024; // ຄືກັບ MAX_CONTENT_LENGTH ຂອງ Flask

/** ຄື secure_filename() ຂອງ Werkzeug */
function secureFilename(name: string) {
  const cleaned = name
    .normalize("NFKD")
    .replace(/[^\w.-]+/g, "_")
    .replace(/^[._]+/, "")
    .slice(-120);
  return cleaned || "image";
}

type Upload = { line: number; filename: string; bytes: Buffer };

/**
 * ອ່ານຮູບອອກຈາກຟອມ — ບໍ່ຈຳກັດຈຳນວນ.
 * ods ຈຳກັດ 4 ຮູບ (file1..file4) ແຕ່ຕາຕະລາງ product_image ບໍ່ມີຂໍ້ຈຳກັດເລີຍ
 * (line_number ເປັນ smallint ທຳມະດາ; ຂໍ້ມູນຈິງມີວຽກທີ່ມີ 9 ຮູບຢູ່ແລ້ວ).
 * ຮັບທັງ field ໃໝ່ "photos" ແລະ file1..file4 ຂອງເກົ່າ ເພື່ອບໍ່ໃຫ້ຟອມເກົ່າພັງ.
 *
 * line ທີ່ຄືນມາເປັນລຳດັບຂອງຮູບໃນຄັ້ງນີ້ (0,1,2...) — saveUploads ຈະບວກ offset ໃຫ້ເອງ.
 */
async function collectUploads(formData: FormData): Promise<{ ok: true; uploads: Upload[] } | { ok: false; error: string }> {
  const files = [
    ...formData.getAll("photos"),
    ...["file1", "file2", "file3", "file4"].map((key) => formData.get(key)),
  ].filter((file): file is File => file instanceof File && file.size > 0);

  const uploads: Upload[] = [];
  for (const [index, file] of files.entries()) {
    if (!uploadsDir) return { ok: false, error: "ບໍ່ໄດ້ຕັ້ງຄ່າ ODS_UPLOADS_DIR — ອັບໂຫລດຮູບບໍ່ໄດ້" };
    if (file.size > MAX_BYTES) return { ok: false, error: `ຮູບທີ ${index + 1} ໃຫຍ່ເກີນ 16MB` };
    const filename = secureFilename(file.name);
    if (!ALLOWED.has(extname(filename).toLowerCase())) return { ok: false, error: `ຮູບທີ ${index + 1} ບໍ່ແມ່ນໄຟລ໌ຮູບ` };
    uploads.push({ line: index, filename, bytes: Buffer.from(await file.arrayBuffer()) });
  }
  return { ok: true, uploads };
}

/**
 * ຂຽນໄຟລ໌ລົງ ODS_UPLOADS_DIR ແລ້ວ insert product_image.
 * ນັບ line_number ຕໍ່ຈາກຮູບທີ່ມີຢູ່ແລ້ວສະເໝີ ຈຶ່ງເພີ່ມຮູບໃສ່ວຽກເກົ່າໄດ້ໂດຍບໍ່ທັບກັນ.
 * ເກັບ path ໄວ້ໃນ written ເພື່ອລຶບຖິ້ມຖ້າ transaction rollback.
 */
async function saveUploads(client: PoolClient, code: string, uploads: Upload[], written: string[]) {
  if (!uploads.length || !uploadsDir) return;
  await mkdir(uploadsDir, { recursive: true });

  const next = await client.query<{ line: number }>(
    "select coalesce(max(line_number), -1) + 1 as line from product_image where iteme_code = $1",
    [code],
  );
  const offset = next.rows[0]?.line ?? 0;

  for (const { line, filename, bytes } of uploads) {
    const lineNumber = offset + line;
    const stored = `${code}_${lineNumber}_${filename}`;
    const path = join(uploadsDir, stored);
    await writeFile(path, bytes);
    written.push(path);
    await client.query("insert into product_image(iteme_code, product_url, line_number) values($1,$2,$3)", [
      code,
      stored,
      lineNumber,
    ]);
  }
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
  const session = await getSession();
  if (!session) return { error: "Session ໝົດອາຍຸ" };

  const parsed = schema.safeParse(
    Object.fromEntries([...formData.entries()].filter(([, value]) => typeof value === "string")),
  );
  if (!parsed.success) return { error: missingFieldsError(parsed.error.issues) };
  if (!db) return { error: "ບໍ່ພົບ DATABASE_URL" };

  // ງານນອກສະຖານທີ່ຕ້ອງຮູ້ວ່າ "ໄປໃສ" — ທີ່ຢູ່ລູກຄ້າບໍ່ພຽງພໍ (ອາດເປັນທີ່ຢູ່ຮ້ານ)
  if (NEEDS_LOCATION(parsed.data.service_type) && !parsed.data.location_repair.trim()) {
    return { error: "ງານນອກສະຖານທີ່ (ສ້ອມບ້ານລູກຄ້າ / ໄປຮັບບ້ານລູກຄ້າ) ຕ້ອງລະບຸສະຖານທີ່ໜ້າງານ" };
  }

  const files = await collectUploads(formData);
  if (!files.ok) return { error: files.error };
  const uploads = files.uploads;

  const d = parsed.data;
  const client = await db.connect();
  const written: string[] = [];
  let code = "";
  let customer = "";

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
       and time_register > now() - interval '2 minutes' limit 1`,
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
         location_repair,appoint_date,location_lat,location_lng)
       values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,1,$17,localtimestamp,$18,nullif($19,''),
         nullif($20,''), nullif($21,'')::date, nullif($22,'')::double precision, nullif($23,'')::double precision)`,
      [code, d.proname, d.pro_sn, d.pro_model, d.pro_brand, d.pro_acc, d.pro_issue, d.pro_type, d.pro_remark,
        // ap_code (ຮ້ານຄ້າ) = **ລະຫັດລູກຄ້າ** ອັນດຽວກັນ (ນະໂຍບາຍ 13-07-2026)
        // ⇒ ບໍ່ຮັບຈາກຟອມອີກ (ຊ່ອງນັ້ນຖືກຖອດອອກ) ຈຶ່ງບໍ່ມີທາງພິມຜິດ/ຫຼົ້ນກັນ
        d.pro_deli, d.pro_wa, d.service_type, custCode, custCode, d.billon, d.billdate, d.emp, session.username,
        d.item_code ?? "", d.location_repair, d.appoint_date, d.location_lat, d.location_lng],
    );

    await saveUploads(client, code, uploads, written);

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
  await logChange("tb_product", code, `ເປີດໃບຮັບເຄື່ອງ: ${item} · ອາການ: ${d.pro_issue} · ຊ່າງ ${d.emp}`, {
    users: [d.emp],
  });
  // ຄຽງກັນ ໃຫ້ເຫັນຢູ່ໜ້າລູກຄ້ານຳ ວ່າລູກຄ້າຄົນນີ້ເອົາເຄື່ອງມາສ້ອມເມື່ອໃດ
  await logChange("ar_customer", customer, `ເປີດໃບຮັບເຄື່ອງ #${code}: ${item}`);
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
export async function createCustomer(_: CustomerState, formData: FormData): Promise<CustomerState> {
  const session = await getSession();
  if (!session) return { error: "Session ໝົດອາຍຸ" };
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
  const session = await getSession();
  if (!session) return { error: "Session ໝົດອາຍຸ" };
  if (!db) return { error: "ບໍ່ພົບ DATABASE_URL" };

  const parsed = schema.extend({ code: z.string().min(1) }).safeParse(
    Object.fromEntries([...formData.entries()].filter(([, value]) => typeof value === "string")),
  );
  if (!parsed.success) return { error: missingFieldsError(parsed.error.issues) };

  const files = await collectUploads(formData);
  if (!files.ok) return { error: files.error };

  const d = parsed.data;
  const client = await db.connect();
  const written: string[] = [];

  try {
    await client.query("begin");
    const updated = await client.query(
      `update tb_product set name_1=$1, sn=$2, p_model=$3, p_brand=$4, p_access=$5, issue=$6, p_type=$7,
         p_abrasion=$8, p_delivery=$9, warrunty=$10, service_type=$11, cust_code=$12, ap_code=$13, doc_def=$14,
         doc_date_ref=$15,
         repair_confirm=case when emp_code is distinct from $16::varchar then null else repair_confirm end,
         emp_code=$16, user_edit=$17
       where code=$18`,
      [d.proname, d.pro_sn, d.pro_model, d.pro_brand, d.pro_acc, d.pro_issue, d.pro_type, d.pro_remark,
        // ap_code = ລະຫັດລູກຄ້າ (ອັນດຽວກັນ — ເບິ່ງ createService)
        d.pro_deli, d.pro_wa, d.service_type, d.cust_code, d.cust_code, d.billon, d.billdate, d.emp, session.username, d.code],
    );
    if (!updated.rowCount) {
      await client.query("rollback");
      return { error: "ບໍ່ພົບລາຍການ" };
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
  await logChange("tb_product", d.code, `ແກ້ໄຂໃບຮັບເຄື່ອງ · ອາການ: ${d.pro_issue} · ຊ່າງ ${d.emp}`, {
    users: [d.emp],
  });
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
  const session = await getSession();
  if (!session) return { error: "Session ໝົດອາຍຸ" };
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
  const session = await getSession();
  if (!session) return { ok: false, error: "Session ໝົດອາຍຸ" };
  if (!db) return { ok: false, error: "ບໍ່ພົບ DATABASE_URL" };
  // server action ຖືກຍິງໂດຍກົງໄດ້ (ບໍ່ຜ່ານໜ້າ) ⇒ ກວດສິດຢູ່ນີ້ອີກຊັ້ນ:
  // ຝ່າຍບໍລິການ (ຜູ້ຂໍ) ຫຼື ຜູ້ອະນຸມັດ ເທົ່ານັ້ນ — ຊ່າງ/ສາງ ບໍ່ກ່ຽວ
  const role = roleOf(session);
  if (!SERVICE_SIDE.includes(role) && !APPROVER_SIDE.includes(role)) {
    return { ok: false, error: "ບໍ່ມີສິດຖອນຄຳຂໍຍົກເລີກ" };
  }

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
  const session = await getSession();
  if (!session) return { error: "Session ໝົດອາຍຸ" };
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

const onlineSchema = schema.omit({ cust_code: true }).extend({
  ref_notice: z.string().min(1),
  custname: z.string().min(1),
  tel: z.string(),
  address: z.string(),
  sup_name: z.string(),
  ref_cust: z.string(),
});

export async function createServiceFromNotice(_: ServiceState, formData: FormData): Promise<ServiceState> {
  const session = await getSession();
  if (!session) return { error: "Session ໝົດອາຍຸ" };
  if (!db) return { error: "ບໍ່ພົບ DATABASE_URL" };

  const parsed = onlineSchema.safeParse(
    Object.fromEntries([...formData.entries()].filter(([, value]) => typeof value === "string")),
  );
  if (!parsed.success) return { error: missingFieldsError(parsed.error.issues) };

  const files = await collectUploads(formData);
  if (!files.ok) return { error: files.error };

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

    // ຫາລູກຄ້າ: ref_code ຂອງ ERP ກ່ອນ (ods ບໍ່ໄດ້ເຊັກ → ສ້າງລູກຄ້າຊ້ຳ) ແລ້ວຈຶ່ງຊື່+ເບີໂທ
    let custCode = "";
    if (d.ref_cust) {
      const byRef = await client.query<{ code: string }>("select code from ar_customer where ref_code=$1 limit 1", [d.ref_cust]);
      custCode = byRef.rows[0]?.code ?? "";
    }
    if (!custCode) {
      const byName = await client.query<{ code: string }>(
        `select code from ar_customer
         where replace(lower(name_1),' ','')=replace(lower($1),' ','')
           and replace(lower(coalesce(tel,'')),' ','')=replace(lower($2),' ','') limit 1`,
        [d.custname, d.tel],
      );
      custCode = byName.rows[0]?.code ?? "";
    }
    if (!custCode) {
      custCode = String(
        (await client.query<{ code: number }>("select coalesce(max(code::int),0)+1 code from ar_customer where code~'^[0-9]+$'")).rows[0].code,
      );
      await client.query(
        "insert into ar_customer(code,name_1,tel,address,ar_type,provine,city,ref_code) values($1,$2,$3,$4,'online','','',$5)",
        [custCode, d.custname, d.tel, d.address, d.ref_cust || null],
      );
    }

    code = String(
      (await client.query<{ code: number }>("select coalesce(max(code::int),0)+1 code from tb_product where code~'^[0-9]+$'")).rows[0].code,
    );

    await client.query(
      `insert into tb_product(code,name_1,sn,p_model,p_brand,p_access,issue,p_type,p_abrasion,p_delivery,
         warrunty,service_type,cust_code,ap_code,doc_def,doc_date_ref,status,emp_code,time_register,user_regis,sup_name,ref_notice)
       values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,1,$17,localtimestamp,$18,$19,$20)`,
      [code, d.proname, d.pro_sn, d.pro_model, d.pro_brand, d.pro_acc, d.pro_issue, d.pro_type, d.pro_remark,
        d.pro_deli, d.pro_wa, d.service_type, custCode, custCode, d.billon, d.billdate, d.emp, session.username,
        d.sup_name, d.ref_notice],
    );

    // ຮູບທີ່ລູກຄ້າແນບມາ (ref_code = ລະຫັດໃບແຈ້ງ) → ຍ້າຍມາເປັນຮູບຂອງງານນີ້
    const taken = files.uploads.map((upload) => upload.line);
    await client.query(
      `update product_image set iteme_code=$1 where ref_code=$2 and not (line_number = any($3::int[]))`,
      [code, d.ref_notice, taken],
    );
    // ຮູບໃໝ່ທີ່ພະນັກງານແນບເພີ່ມ (ທັບແຖວທີ່ມີເລກ line ດຽວກັນ)
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

  revalidatePath("/service/notices");
  redirect(`/service/${code}`);
}
