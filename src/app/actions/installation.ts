"use server";
import { logChange } from "@/lib/chatter-log";
import { acceptInstall, finishInstallFlow, startInstallFlow } from "@/lib/job-flow";
import { pushToUser } from "@/lib/push";
import { recordPayout } from "@/lib/commission-record";
import { getSession, type Session } from "@/lib/auth";
import { ROLE_WAREHOUSE } from "@/lib/chatter";
import { db, odgDb, query } from "@/lib/db";
import { deleteErpRequest, writeErpRequest } from "@/lib/erp-request";
import { nextDocNo } from "@/lib/doc-no";
import { requireRole } from "@/lib/guard";
import { type Role, roleOf, SERVICE_SIDE, STOCK_SIDE, TECH_SIDE } from "@/lib/roles";
import { feedbackUrl } from "@/lib/track";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import QRCode from "qrcode";
import { z } from "zod";

/* ─────────────────────────────────────────────────────────────
   Server actions ຂອງ ວຽກຕິດຕັ້ງ
   ຖອດແບບຈາກ ods: install_admin.py, tech_install.py, tech_reg_install.py
   • ທຸກ query ໃຊ້ parameter ($1,$2...) — ບໍ່ຕໍ່ string ເຂົ້າ SQL
     (ods ມີຊ່ອງໂຫວ່ SQL injection ຢູ່ tech_install.py:157 ແລະ
      tech_reg_install.py:355 ທີ່ຕໍ່ session name ເຂົ້າ SQL ໂດຍກົງ)
   • ບໍ່ໄດ້ຄັດລອກການແຈ້ງເຕືອນ LINE Notify ມາ
   ───────────────────────────────────────────────────────────── */

export type ActionState = { error?: string; ok?: string };

const INSTALL_PATHS = [
  "/installations",
  "/installations/assign",
  "/installations/accept",
  "/installations/work",
  "/installations/close",
  "/installations/spare-requests",
  "/installations/spare-pickup",
  "/installations/dispatch",
];

function revalidateAll() {
  for (const path of INSTALL_PATHS) revalidatePath(path);
}

async function requireSession() {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

/** ຊ່າງເຫັນສະເພາະງານຂອງຕົນ — ຄືກັບ ods (roles == 'technical') */
export async function techFilter() {
  const session = await requireSession();
  return session.role === "technical" ? session.username : null;
}

/* ── ສະຖານະຂອງງານ — ດ່ານກວດຮ່ວມຂອງທຸກ action ────────────────
 *
 * ods ບໍ່ກວດຫຍັງເລີຍ: ທຸກ route ຂຽນຖັນເວລາລົງໄປໂດຍບໍ່ຖາມວ່າຂັ້ນກ່ອນໜ້າຜ່ານແລ້ວບໍ່.
 * ຜົນຄື "ຂ້າມຂັ້ນ" ໄດ້ (ຕອບແບບສອບຖາມກ່ອນຕິດຕັ້ງ, ຂໍເບີກກ່ອນຮັບງານ …) ແລະ ບາງເສັ້ນທາງ
 * ພາງານໄປຢູ່ໃນສະຖານະທີ່ບໍ່ມີໜ້າໃດສະແດງອອກມາອີກ. ບ່ອນນີ້ທຸກ action ໂຫຼດສະຖານະກ່ອນ.
 */
export type JobState = {
  code: string;
  tech_code: string | null;
  cancelled: boolean;
  closed: boolean;
  assigned: boolean;
  accepted: boolean;
  qc_passed: boolean;
  requested: boolean;
  started: boolean;
  finished: boolean;
  complained: boolean;
};

/**
 * ດຶງ tech_code ມານຳ (ບໍ່ພຽງແຕ່ `assigned`) — ບໍ່ດັ່ງນັ້ນກວດ "ງານນີ້ແມ່ນຂອງຊ່າງຄົນນີ້ບໍ"
 * ບໍ່ໄດ້ເລີຍ. ນີ້ຄືສາເຫດທີ່ຝັ່ງຕິດຕັ້ງບໍ່ເຄີຍມີການກວດເຈົ້າຂອງງານ ໃນຂະນະທີ່ຝັ່ງສ້ອມມີ.
 */
const JOB_STATE_SQL = `select code, nullif(tech_code,'') as tech_code,
    cancel_date is not null as cancelled,
    job_finish is not null as closed,
    (tech_code is not null and tech_code <> '') as assigned,
    tech_confirm is not null as accepted,
    qc_finish is not null as qc_passed,
    reg_start is not null as requested,
    start_install is not null as started,
    finish_install is not null as finished,
    complain_finish is not null as complained
  from ods_tb_install where code = $1 limit 1`;

async function jobState(code: string): Promise<JobState | null> {
  const result = await query<JobState>(JOB_STATE_SQL, [code]);
  return result.rows[0] ?? null;
}

/** ຂໍ້ຄວາມປະຕິເສດມາດຕະຖານ (ພາສາລາວ) */
const NOT_FOUND = "ບໍ່ພົບງານຕິດຕັ້ງນີ້";
const IS_CANCELLED = "ງານນີ້ຖືກຍົກເລີກແລ້ວ";
const IS_CLOSED = "ງານນີ້ປິດແລ້ວ";
const NOT_YOURS = "ງານນີ້ບໍ່ແມ່ນຂອງທ່ານ";

/**
 * ດ່ານກວດຮ່ວມຂອງ action ທີ່ອ້າງເຖິງງານນຶ່ງງານ — ລວມ 3 ຢ່າງໄວ້ບ່ອນດຽວ:
 *   ① ສິດຕາມ role (proxy ກັນແຕ່ "ໜ້າ" — action ຖືກຍິງໂດຍກົງໄດ້, ເບິ່ງ lib/guard)
 *   ② ງານມີຢູ່ຈິງ
 *   ③ **ເຈົ້າຂອງງານ** — ຊ່າງ (technical) ແຕະໄດ້ສະເພາະງານທີ່ຕົນຖືກຈັດໃຫ້
 *
 * ຂໍ້ ③ ຄືກັບ loadJob() ຂອງ actions/repair.ts ແລະ actions/checking.ts ທຸກປະການ.
 * ຫົວໜ້າຊ່າງ/ຜູ້ຈັດການເຫັນຄົບທຸກງານຄືເກົ່າ (ບໍ່ຖືກກວດຂໍ້ ③) — ຄືກັບຝັ່ງສ້ອມ.
 * ຈຳເປັນ ເພາະລະຫັດ INST-xxxx ເປັນເລກລຽງ ⇒ ເດົາລະຫັດງານຂອງຊ່າງຄົນອື່ນໄດ້ງ່າຍ.
 */
type JobGuard = { ok: true; session: Session; job: JobState } | { ok: false; error: string };

async function guardJob(code: string, allowed: readonly Role[]): Promise<JobGuard> {
  const guard = await requireRole(allowed);
  if (!guard.ok) return { ok: false, error: guard.error };

  const job = await jobState(code);
  if (!job) return { ok: false, error: NOT_FOUND };

  if (roleOf(guard.session) === "technical" && (job.tech_code ?? "") !== guard.session.username) {
    return { ok: false, error: NOT_YOURS };
  }
  return { ok: true, session: guard.session, job };
}

/* ── ເປີດງານຕິດຕັ້ງ (save_install_create) ─────────────────── */

/**
 * ── ລາຍການທີ່ຈະຕິດຕັ້ງ 1 ລາຍການ ──
 *
 * ບິນນຶ່ງອາດຕິດຕັ້ງ **ຫຼາຍລາຍການ**: ຂໍ້ມູນຈິງ 1 ປີ (ບິນທີ່ມີບໍລິການຕິດຕັ້ງ)
 *   1 ລາຍການ = 1,856 ບິນ (75%) · **2 ລາຍການ = 504 ບິນ (20%)** · 3+ = 123 ບິນ (5%)
 * ⇒ ບັງຄັບໃຫ້ເປີດເທື່ອລະລາຍການ = CS ຕ້ອງກອກບິນ/ລູກຄ້າ/ສະຖານທີ່ຄືນໃໝ່ທຸກເທື່ອ
 *   ແລະ ລາຍການທີ 2 ມັກຖືກລືມ (ຄືກັບບັນຫາ "1 ໜ່ວຍ = 1 ງານ" ທີ່ແກ້ໄປແລ້ວ).
 *
 * ແຕ່ລະລາຍການມີ Model · ປະເພດ · ຂະໜາດ · ອາໄຫຼ່ມາດຕະຖານ (sv_type) **ຂອງຕົນເອງ**
 * ⇒ ຈຶ່ງເປັນ object ບໍ່ແມ່ນພຽງລະຫັດ. ສະຖານທີ່/ວັນນັດ/ໝາຍເຫດ ໃຊ້ຮ່ວມກັນ (ບ້ານດຽວກັນ).
 */
const lineSchema = z.object({
  item_code: z.string().min(1),
  item_name: z.string().min(1),
  sv_type: z.string(),
  pro_brand: z.string(),
  pro_model: z.string().min(1),
  pro_type: z.string().min(1),
  pro_size: z.string().min(1),
  /** ຈະຕິດຕັ້ງຈັກໜ່ວຍ = ຈະສ້າງຈັກງານ (1 ໜ່ວຍ = 1 ງານ = 1 ຊ່າງໄປ 1 ບ່ອນ) */
  units: z.number().int().min(1).max(20),
  /** S/N (ໜ່ວຍໃນ [C] ຖ້າເປັນແອ) ຂອງແຕ່ລະໜ່ວຍ — ຕ້ອງຄົບຕາມ units */
  serials: z.array(z.string().trim().min(1)),
  /**
   * S/N **ໜ່ວຍນອກ [H]** ຂອງແຕ່ລະໜ່ວຍ — ບໍ່ບັງຄັບ (ເຄື່ອງທີ່ບໍ່ແມ່ນແອບໍ່ມີໜ່ວຍນອກ).
   * ແອປະກອບດ້ວຍ ໜ່ວຍໃນ + ໜ່ວຍນອກ ແລະ ERP ລົງ ISN **ຄົນລະເລກ** ⇒ ເກັບໜ່ວຍດຽວ =
   * ຮັບປະກັນ/ສ້ອມຄອມເພຣສເຊີພາຍຫຼັງ ອ້າງອີງບໍ່ໄດ້.
   */
  outdoor: z.array(z.string()),
});

export type InstallLine = z.infer<typeof lineSchema>;

/** ເພດານຂອງງານທີ່ສ້າງໄດ້ໃນເທື່ອດຽວ — ກັນການກົດຜິດທີ່ສ້າງງານເປັນຮ້ອຍ */
const MAX_JOBS_PER_SAVE = 20;

const createSchema = z.object({
  doc_no: z.string().min(1),
  billdate: z.string().min(1),
  cust_code: z.string().min(1),
  custname: z.string().min(1),
  tel: z.string(),
  address: z.string(),
  /** ລາຍການທີ່ຈະຕິດຕັ້ງ (JSON) — ຢ່າງໜ້ອຍ 1 ລາຍການ */
  lines: z
    .string()
    .min(1)
    .transform((raw, ctx) => {
      try {
        return z.array(lineSchema).min(1).parse(JSON.parse(raw));
      } catch {
        ctx.addIssue({ code: "custom", message: "ລາຍການທີ່ຈະຕິດຕັ້ງບໍ່ຖືກຕ້ອງ" });
        return z.NEVER;
      }
    }),
  /** ພິກັດສະຖານທີ່ຕິດຕັ້ງ (ບໍ່ບັງຄັບ) — ຊ່າງກົດນຳທາງໄດ້ຈາກແອັບ */
  location_lat: z.string().optional(),
  location_lng: z.string().optional(),
  /**
   * ສະຖານທີ່ຕິດຕັ້ງ — **ບັງຄັບ** (ແຕ່ກ່ອນຫວ່າງໄດ້).
   * ຂໍ້ມູນຈິງ: 146/6,841 ງານບໍ່ມີສະຖານທີ່ ⇒ ຊ່າງຖືກສົ່ງອອກໜ້າງານໂດຍບໍ່ຮູ້ວ່າໄປໃສ
   * ແລະ ຄິວ "ເລີຍວັນນັດ" ກໍ່ບອກບໍ່ໄດ້ວ່າໄປຫາໃຜ. ຟອມຕື່ມມາຈາກທີ່ຢູ່ລູກຄ້າໃຫ້ແລ້ວ
   * ⇒ ບໍ່ໄດ້ເພີ່ມວຽກໃຫ້ CS ແຕ່ກັນຊ່ອງຫວ່າງ.
   */
  location_inst: z.string().min(1),
  /** ວັນຄາດວ່າຈະເຂົ້າຕິດຕັ້ງ — ຕັ້ງແຕ່ຕອນເປີດງານໄດ້ (ຜູ້ຈັດຊ່າງແກ້ໄດ້ພາຍຫຼັງ) */
  appoint_date: z.string().optional(),
  /**
   * ── ຈັດຊ່າງໄດ້ **ຕັ້ງແຕ່ຕອນເປີດງານ** (ນະໂຍບາຍ 13-07-2026) ──
   * ຂໍ້ມູນຈິງ: "ເປີດງານ → ຈັດຊ່າງ" ກິນເວລາມັດທະຍົມ **44 ຊມ** ⇒ ເກືອບເຄິ່ງນຶ່ງຂອງ
   * ເປົ້າໝາຍ 24 ຊມ ຫາຍໄປກັບການລໍໃຫ້ມີຄົນມາກົດຈັດຊ່າງ. CS ທີ່ຮັບເຄື່ອງມັກຮູ້ຢູ່ແລ້ວ
   * ວ່າຈະໃຫ້ໃຜໄປ ⇒ ໃສ່ໄດ້ເລີຍ. ຫວ່າງໄດ້ (ຄືເກົ່າ — ໄປຈັດຢູ່ໜ້າ /installations/assign).
   */
  tech_code: z.string().optional(),
  remark: z.string(),
});

export async function createInstall(_: ActionState, formData: FormData): Promise<ActionState> {
  const guard = await requireRole(SERVICE_SIDE, "ບໍ່ມີສິດເປີດງານຕິດຕັ້ງ");
  if (!guard.ok) return { error: guard.error };
  const session = guard.session;
  if (!db) return { error: "ບໍ່ພົບ DATABASE_URL" };

  const parsed = createSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "ກະລຸນາປ້ອນຊ່ອງທີ່ຈຳເປັນໃຫ້ຄົບ" };
  const d = parsed.data;

  // S/N ຕ້ອງຄົບຕໍ່ໜ່ວຍ — ກວດຢູ່ server ອີກຊັ້ນ (ຟອມກວດແລ້ວ ແຕ່ action ຖືກຍິງໂດຍກົງໄດ້)
  for (const line of d.lines) {
    if (line.serials.length !== line.units) {
      return { error: `${line.item_name}: ຕ້ອງລະບຸ S/N ໃຫ້ຄົບ ${line.units} ໜ່ວຍ` };
    }
  }
  const totalJobs = d.lines.reduce((sum, line) => sum + line.units, 0);
  if (totalJobs > MAX_JOBS_PER_SAVE) {
    return { error: `ສ້າງໄດ້ສູງສຸດ ${MAX_JOBS_PER_SAVE} ງານຕໍ່ຄັ້ງ (ກຳລັງຈະສ້າງ ${totalJobs})` };
  }

  const tech = (d.tech_code ?? "").trim();

  const client = await db.connect();
  let code = "";
  const codes: string[] = [];
  try {
    await client.query("begin");
    // ods ໃຊ້ max()+1 ໂດຍບໍ່ລັອກ → ສອງຄົນເປີດງານພ້ອມກັນໄດ້ເລກຊ້ຳ. ບ່ອນນີ້ລັອກກ່ອນ.
    await client.query("select pg_advisory_xact_lock(734211)");

    // ລູກຄ້າ: ຖ້າມີ ref_code ນີ້ຢູ່ແລ້ວໃຊ້ອັນເກົ່າ, ບໍ່ດັ່ງນັ້ນສ້າງໃໝ່
    const existing = await client.query<{ code: string }>(
      "select code from ar_customer where lower(ref_code)=lower($1) limit 1",
      [d.cust_code],
    );
    let custCode: string;
    if (existing.rows[0]) {
      custCode = existing.rows[0].code;
    } else {
      const next = await client.query<{ max: number | null }>("select max(code::int) max from ar_customer");
      custCode = String((next.rows[0].max ?? 0) + 1);
      await client.query(
        "insert into ar_customer(code,name_1,address,city,provine,tel,ref_code) values($1,$2,$3,null,null,$4,$5)",
        [custCode, d.custname, d.address, d.tel, d.cust_code],
      );
    }

    const seq = await client.query<{ max: number | null }>(
      "select max(nullif(regexp_replace(code,'\\D','','g'),'')::int) max from ods_tb_install",
    );
    let next = (seq.rows[0].max ?? 0);

    /**
     * ── 1 ລາຍການ × 1 ໜ່ວຍ = 1 ງານ ──
     * ບິນນຶ່ງອາດຕິດຕັ້ງ **ຫຼາຍລາຍການ** (ແອ + ຈັກຊັກ) ແລະ ແຕ່ລະລາຍການ **ຫຼາຍໜ່ວຍ**.
     * ຊ່າງໄປຕິດຄົນລະໜ່ວຍ ແລະ ແຕ່ລະໜ່ວຍມີ S/N ຂອງຕົນ ⇒ ຕ້ອງແຍກເປັນຄົນລະງານ.
     * ອາໄຫຼ່ມາດຕະຖານ (used_spare_install) ຂຶ້ນກັບ **ປະເພດຕິດຕັ້ງຂອງລາຍການນັ້ນ**
     * ⇒ ດຶງຕໍ່ລາຍການ ບໍ່ແມ່ນຕໍ່ບິນ.
     */
    for (const row of d.lines) {
      // ອາໄຫຼ່ມາດຕະຖານຂອງປະເພດຕິດຕັ້ງນີ້
      const spares = await client.query<{
        line_number: number; ic_code: string; name_1: string; qty: string; unit_code: string;
      }>(
        "select line_number,ic_code,name_1,round(qty,2) qty,unit_code from used_spare_install where install_type=$1 order by line_number",
        [row.sv_type],
      );

      // ສິນຄ້າລະຫັດຂຶ້ນຕົ້ນ '97' ບໍ່ໃຊ້ອາໄຫຼ່ (ຄືກັບ ods)
      const usedSpare = spares.rowCount === 0 || row.item_code.slice(0, 2) === "97" ? 0 : 1;

      const category = await client.query<{ name_1: string }>("select name_1 from tb_category where code=$1", [
        row.pro_type,
      ]);
      const proTypeName = category.rows[0]?.name_1 ?? "";

      for (const [index, serial] of row.serials.entries()) {
        next += 1;
        code = `INST-${next}`;
        codes.push(code);

        await client.query(
          `insert into ods_tb_install(code,doc_ref_1,cust_code,item_code,item_name,install_type,status,complain_status,
             remark,time_register,user_created,doc_ref_date,pro_brand,pro_model,pro_type,pro_size,location_inst,
             used_spare,pro_sn,pro_type_code,appoint_date,pro_sn_out,location_lat,location_lng)
           values($1,$2,$3,$4,$5,$6,0,0,$7,localtimestamp(0),$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,nullif($18,'')::date,
                  nullif($19,''), nullif($20,'')::double precision, nullif($21,'')::double precision)`,
          [code, d.doc_no, custCode, row.item_code, row.item_name, row.sv_type, d.remark, session.username, d.billdate,
            row.pro_brand, row.pro_model, proTypeName, row.pro_size, d.location_inst, usedSpare, serial.trim(),
            row.pro_type, d.appoint_date ?? "", (row.outdoor[index] ?? "").trim(),
            d.location_lat ?? "", d.location_lng ?? ""],
        );

        // ຈັດຊ່າງໃຫ້ເລີຍ (ຖ້າ CS ເລືອກໄວ້) — stamp assigt_time ຄືກັບ assignTech
        if (tech) {
          await client.query(
            `update ods_tb_install set tech_code=$1, assigt_time=localtimestamp(0), user_assigt=$2 where code=$3`,
            [tech, session.username, code],
          );
        }

        for (const line of spares.rows) {
          await client.query(
            `insert into ods_tb_install_detail(line_number,code,cust_code,time_register,item_code,item_name,qty,unit_code)
             values($1,$2,$3,localtimestamp(0),$4,$5,$6,$7)`,
            [line.line_number, code, custCode, line.ic_code, line.name_1, line.qty, line.unit_code],
          );
          await client.query(
            "insert into tb_used_spare(product_code,item_code,item_name,qty,unit_code) values($1,$2,$3,$4,$5)",
            [code, line.ic_code, line.name_1, line.qty, line.unit_code],
          );
        }
      }
    }

    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    console.error("createInstall failed", error);
    return { error: "ບັນທຶກບໍ່ສຳເລັດ ກະລຸນາກວດຂໍ້ມູນ" };
  } finally {
    client.release();
  }

  /**
   * chatter ຕໍ່ງານ — ບອກວ່າງານນີ້ຄືໜ່ວຍທີ່ເທົ່າໃດ **ຂອງລາຍການໃດ** (ບໍ່ແມ່ນຂອງບິນ)
   * ⇒ ບິນທີ່ຕິດຕັ້ງ ແອ 2 ໜ່ວຍ + ຈັກຊັກ 1 ໜ່ວຍ ອ່ານອອກວ່າງານໃດເປັນຫຍັງ.
   */
  let cursor = 0;
  for (const line of d.lines) {
    for (let unit = 0; unit < line.units; unit += 1) {
      const jobCode = codes[cursor];
      cursor += 1;
      await logChange(
        "ods_tb_install",
        jobCode,
        `ເປີດງານຕິດຕັ້ງ: ${line.item_name} · ລູກຄ້າ ${d.custname} · ບິນອ້າງອີງ ${d.doc_no}` +
          (line.units > 1 ? ` (ໜ່ວຍທີ ${unit + 1}/${line.units})` : "") +
          (d.lines.length > 1 ? ` · ບິນນີ້ເປີດພ້ອມກັນ ${codes.length} ງານ` : ""),
      );
    }
  }

  // ຈັດຊ່າງຕັ້ງແຕ່ຕອນເປີດງານ ⇒ ຊ່າງຕ້ອງຮູ້ທັນທີ (ບໍ່ດັ່ງນັ້ນນາລິກາ 24 ຊມ ແລ່ນຢູ່ໂດຍລາວບໍ່ຮູ້)
  if (tech) {
    for (const created of codes) {
      await logChange("ods_tb_install", created, `ຈັດຊ່າງຕັ້ງແຕ່ຕອນເປີດງານ: ${tech}`, { users: [tech] });
    }
    await pushToUser(
      tech,
      codes.length > 1 ? `ມີງານຕິດຕັ້ງໃໝ່ ${codes.length} ງານ` : "ມີງານຕິດຕັ້ງໃໝ່",
      `${codes.join(", ")}${d.appoint_date ? ` · ນັດ ${d.appoint_date}` : ""} · ${d.location_inst}`,
      { workflow: "install", code: codes[0] },
    );
  }

  revalidateAll();
  redirect("/installations");
}

/* ── ແກ້ໄຂງານ (edit_save_install) ─────────────────────────── */

const editSchema = z.object({
  code: z.string().min(1),
  tech_code: z.string(),
  appoint_date: z.string(),
  location_inst: z.string(),
  pro_sn: z.string(),
  pro_type: z.string(),
  pro_model: z.string(),
  pro_brand: z.string(),
  remark: z.string(),
});

export async function updateInstall(_: ActionState, formData: FormData): Promise<ActionState> {
  const guard = await requireRole(SERVICE_SIDE, "ບໍ່ມີສິດແກ້ໄຂງານຕິດຕັ້ງ");
  if (!guard.ok) return { error: guard.error };
  const session = guard.session;
  const parsed = editSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "ຂໍ້ມູນບໍ່ຖືກຕ້ອງ" };
  const d = parsed.data;

  try {
    const category = await query<{ name_1: string }>("select name_1 from tb_category where code=$1", [d.pro_type]);
    // ໜ້າແກ້ໄຂກໍ່ຈັດຊ່າງໄດ້ຄືກັນ → stamp assigt_time/user_assigt ເມື່ອ **ປ່ຽນ** ຊ່າງ (B6).
    // ຖ້າຖອນຊ່າງອອກ (ຄ່າຫວ່າງ) ໂມງຈັດຊ່າງກໍ່ຖືກລ້າງ — ງານກັບໄປຄິວ "ລໍຖ້າຈັດຊ່າງ".
    await query(
      `update ods_tb_install set remark=$1, user_edit=$2, tech_code=$3, appoint_date=$4, location_inst=$5,
         pro_sn=$6, pro_type=$7, pro_type_code=$8, pro_model=$9, pro_brand=$10,
         assigt_time = case
           when $3::varchar is null then null
           when tech_code is distinct from $3::varchar then localtimestamp(0)
           else assigt_time end,
         user_assigt = case
           when $3::varchar is null then null
           when tech_code is distinct from $3::varchar then $2::varchar
           else user_assigt end
       where code=$11`,
      [d.remark, session.username, d.tech_code || null, d.appoint_date || null, d.location_inst, d.pro_sn,
        category.rows[0]?.name_1 ?? "", d.pro_type, d.pro_model, d.pro_brand, d.code],
    );
  } catch (error) {
    console.error("updateInstall failed", error);
    return { error: "ເເກ້ໄຂບໍ່ສຳເລັດ" };
  }

  const detail = [
    d.tech_code && `ຊ່າງ ${d.tech_code}`,
    d.appoint_date && `ນັດວັນທີ ${d.appoint_date}`,
    d.location_inst && `ສະຖານທີ່ ${d.location_inst}`,
  ]
    .filter(Boolean)
    .join(" · ");
  // ຖ້າແກ້ໄຂແລ້ວມີຊ່າງ → ຊ່າງຄົນນັ້ນຮູ້ນຳ
  await logChange("ods_tb_install", d.code, `ແກ້ໄຂງານຕິດຕັ້ງ${detail ? `: ${detail}` : ""}`, {
    users: d.tech_code ? [d.tech_code] : [],
  });

  revalidateAll();
  redirect("/installations");
}

/* ── ລົບງານ — **ຖອດອອກແລ້ວ** ─────────────────────────────────
 *
 * ງານ **ລົບບໍ່ໄດ້ອີກຕໍ່ໄປ** (ທຸກງານ). ໃຊ້ "ຍົກເລີກງານ" ແທນ:
 *   ຍົກເລີກ  → ເຫຼືອຮ່ອງຮອຍ (cancel_date · cancel_remark · cancel_code · chatter)
 *              ແລະ ພາໄປສົ່ງອາໄຫຼ່ຄືນສາງ ຖ້າຍັງມີຂອງຄ້າງ
 *   ລົບ      → ຂໍ້ມູນຫາຍໄປເລີຍ ບໍ່ຮູ້ວ່າໃຜລົບ ບໍ່ຮູ້ວ່າເປັນຫຍັງ
 *
 * ດຽວນີ້ງານຜູກກັບ **ຄ່າຄອມຂອງຊ່າງ** (ods_service_payout) ຄືນຮອດເລື່ອງເງິນ
 * ⇒ ລົບງານແລ້ວແຖວເງິນຈະຊີ້ໄປງານທີ່ບໍ່ມີຢູ່ ແລະ ບັນຊີກັບສະລິບຈະບໍ່ຕົງກັນ.
 *
 * ຖອດທັງ action ບໍ່ແມ່ນເຊື່ອງແຕ່ປຸ່ມ — server action ຖືກຍິງໂດຍກົງໄດ້ (lib/guard).
 */

/* ── ຍົກເລີກງານ (cancel_install) ──────────────────────────── */

/**
 * ຍົກເລີກງານ — ບໍ່ດຶງອາໄຫຼ່ຄືນເອງ ແຕ່ **ບອກ** ວ່າຍັງມີອາໄຫຼ່ຄ້າງຢູ່ນອກສາງເທົ່າໃດ
 * ແລ້ວພາຜູ້ໃຊ້ໄປຂັ້ນຕອນສົ່ງຄືນທີ່ມີຢູ່ແລ້ວ (SRI 59 → SRT 58) — ຄືກັນກັບຝັ່ງສ້ອມ
 * ທີ່ /approvals/cancellations ເຮັດ. ບໍ່ມີການຍ້າຍສະຕັອກແບບງຽບໆຢູ່ບ່ອນນີ້.
 *
 * ຂໍ້ມູນຈິງ: 3 ງານທີ່ຍົກເລີກແລ້ວ (INST-5849, INST-5850, INST-6864) ມີອາໄຫຼ່ 36 ແຖວ
 * ທີ່ສາງເບີກອອກໄປແລ້ວ ແລະ **ບໍ່ມີ** ໃບສົ່ງຄືນຈັກໃບ (ທັງ 3 ປີ ບໍ່ເຄີຍມີໃບ 58/59
 * ຂອງງານ INST- ຈັກໃບ) ⇒ ອາໄຫຼ່ຫາຍໄປຈາກສາງໂດຍບໍ່ມີເອກະສານຮັບຮູ້.
 */
export async function cancelInstall(code: string, remark: string): Promise<ActionState> {
  const guard = await guardJob(code, SERVICE_SIDE);
  if (!guard.ok) return { error: guard.error };
  const { session, job } = guard;
  if (!remark.trim()) return { error: "ກະລຸນາໃສ່ຫມາຍເຫດ" };
  if (job.cancelled) return { error: IS_CANCELLED };

  let cancelled = false;
  let outstanding = { docs: 0, lines: 0, units: 0 };
  try {
    const done = await query(
      `update ods_tb_install set cancel_date=localtimestamp(0), cancel_remark=$1, cancel_code=$2
       where code=$3 and cancel_date is null`,
      [remark.trim(), session.username, code],
    );
    cancelled = Boolean(done.rowCount);
    if (cancelled) {
      const summary = await query<{ docs: number; lines: number; units: number }>(
        `select count(distinct t.doc_no)::int docs, count(d.roworder)::int lines,
            coalesce(sum(d.qty),0)::float units
         from ic_trans t
         join ic_trans_detail d on d.doc_no = t.doc_no
         where t.trans_flag=56 and t.product_code=$1 and d.status in (0,1)`,
        [code],
      );
      outstanding = summary.rows[0] ?? outstanding;
    }
  } catch (error) {
    console.error("cancelInstall failed", error);
    return { error: "ຍົກເລີກບໍ່ສຳເລັດ" };
  }
  if (!cancelled) return { error: IS_CANCELLED };

  const parts =
    outstanding.lines > 0
      ? ` · ຍັງມີອາໄຫຼ່ຄ້າງນອກສາງ ${outstanding.lines} ລາຍການ ຈາກ ${outstanding.docs} ໃບເບີກ — ຕ້ອງສ້າງໃບຂໍສົ່ງຄືນ`
      : "";
  // ສາງຕ້ອງຮູ້ ຖ້າຍັງມີອາໄຫຼ່ຄ້າງ (ໃບຂໍສົ່ງຄືນ/ຮັບຄືນ ເປັນວຽກຂອງສາງ)
  await logChange("ods_tb_install", code, `ຍົກເລີກງານຕິດຕັ້ງ: ${remark.trim()}${parts}`, {
    roles: outstanding.lines > 0 ? ROLE_WAREHOUSE : [],
  });

  revalidateAll();
  return {
    ok:
      outstanding.lines > 0
        ? `ຍົກເລີກສຳເລັດ — ຍັງມີອາໄຫຼ່ຄ້າງນອກສາງ ${outstanding.lines} ລາຍການ, ກະລຸນາສົ່ງຄືນສາງ`
        : "ຍົກເລີກສຳເລັດ",
  };
}

/* ── ຈັດຊ່າງ (assign_tech_submit / choose_new_tech) ───────── */

/**
 * ຈັດຊ່າງ — stamp assigt_time / user_assigt ນຳ (B6).
 *
 * ສອງຖັນນີ້ມີຢູ່ໃນຕາຕະລາງມາດົນ ແຕ່ຖືກຂຽນພຽງ 3 ແຖວໃນ 6,832 ແຖວ (ຜູ້ໃຊ້ 'keo', ຕຸລາ 2024)
 * ⇒ ຊ່ວງ "ເປີດງານ → ຊ່າງຮັບງານ" (median 27.5 ຊົ່ວໂມງ, p90 129 ຊົ່ວໂມງ = 61% ຂອງເວລາທັງໝົດ)
 * ແຍກບໍ່ອອກວ່າແມ່ນ "ຜູ້ຈັດຈັດຊ້າ" ຫຼື "ຊ່າງຮັບຊ້າ". stamp ແລ້ວ ໜ້າ /installations/assign
 * ກັບ /installations/accept ຈຶ່ງນັບໂມງຄ້າງຈາກຖານທີ່ຖືກຕ້ອງຂອງແຕ່ລະຄິວໄດ້.
 */
export async function assignTech(_: ActionState, formData: FormData): Promise<ActionState> {
  const code = String(formData.get("code") ?? "");
  const techCode = String(formData.get("tech_code") ?? "");
  const appointDate = String(formData.get("appoint_date") ?? "");
  const locationInst = String(formData.get("location_inst") ?? "");
  const remark = String(formData.get("remark") ?? "");
  if (!code || !techCode) return { error: "ກະລຸນາເລືອກຊ່າງ" };

  const guard = await guardJob(code, SERVICE_SIDE);
  if (!guard.ok) return { error: guard.error };
  const { session, job } = guard;
  if (job.cancelled) return { error: IS_CANCELLED };
  if (job.closed) return { error: IS_CLOSED };

  try {
    await query(
      `update ods_tb_install set remark=$1, tech_code=$2, appoint_date=$3, location_inst=$4,
         assigt_time=localtimestamp(0), user_assigt=$5
       where code=$6`,
      [remark, techCode, appointDate || null, locationInst, session.username, code],
    );
  } catch (error) {
    console.error("assignTech failed", error);
    return { error: "ບັນທຶກບໍ່ສຳເລັດ" };
  }

  // ແຈ້ງຊ່າງວ່າມີງານໃໝ່ (ods ຍິງ LINE Notify ຢູ່ຈຸດນີ້)
  await logChange(
    "ods_tb_install",
    code,
    `ຈັດຊ່າງ: ${techCode}${appointDate ? ` · ນັດວັນທີ ${appointDate}` : ""}${locationInst ? ` · ${locationInst}` : ""}`,
    { users: [techCode] },
  );
  /**
   * ແຈ້ງເຕືອນອອກມືຖືຂອງຊ່າງ (Expo push) — ຊ່າງຢູ່ໜ້າງານ ບໍ່ໄດ້ເປີດເວັບຄ້າງໄວ້
   * ⇒ ການແຈ້ງເຕືອນໃນແອັບຢ່າງດຽວບໍ່ພຽງພໍ. ລົ້ມເຫຼວກໍ່ບໍ່ເປັນຫຍັງ (lib/push ຈັບໄວ້ໝົດ)
   * — ງານຕ້ອງຖືກມອບໝາຍໄດ້ ເຖິງແອັບຈະສົ່ງບໍ່ອອກ.
   */
  await pushToUser(
    techCode,
    "ມີງານຕິດຕັ້ງໃໝ່",
    `${code}${appointDate ? ` · ນັດ ${appointDate}` : ""}${locationInst ? ` · ${locationInst}` : ""}`,
    { workflow: "install", code },
  );

  revalidateAll();
  return { ok: "ສຳເລັດ" };
}

/**
 * ເລືອກຊ່າງໃໝ່ — ເກັບຊ່າງເກົ່າໄວ້ໃນ tech_before ແລ້ວລ້າງ tech_code.
 * ລ້າງ assigt_time/user_assigt ນຳ: ງານກັບໄປຄິວ "ລໍຖ້າຈັດຊ່າງ" ເຊິ່ງນັບໂມງຈາກ time_register
 * — ໂມງ "ລໍຖ້າຊ່າງຮັບງານ" ຈະຖືກ stamp ໃໝ່ຕອນ assignTech ຄັ້ງຕໍ່ໄປ (B6).
 * ຖ້າອາໄຫຼ່ຖືກຂໍເບີກໄປແລ້ວ (reg_start) ປ່ຽນຊ່າງບໍ່ໄດ້ — ເອກະສານອອກໃນນາມຊ່າງຄົນເກົ່າແລ້ວ.
 */
export async function chooseNewTech(code: string): Promise<ActionState> {
  const guard = await requireRole(SERVICE_SIDE, "ບໍ່ມີສິດປ່ຽນຊ່າງ");
  if (!guard.ok) return { error: guard.error };
  if (!db) return { error: "ບໍ່ພົບ DATABASE_URL" };
  const client = await db.connect();
  try {
    await client.query("begin");
    const job = await client.query<{ accepted: boolean; requested: boolean; cancelled: boolean }>(
      `select tech_confirm is not null as accepted, reg_start is not null as requested,
          cancel_date is not null as cancelled
       from ods_tb_install where code=$1 for update`,
      [code],
    );
    const state = job.rows[0];
    if (!state) {
      await client.query("rollback");
      return { error: NOT_FOUND };
    }
    if (state.cancelled) {
      await client.query("rollback");
      return { error: IS_CANCELLED };
    }
    if (state.accepted) {
      await client.query("rollback");
      return { error: "ບໍ່ສາມາດເລືອກໃໝ່ໄດ້ ຊ່າງຮັບເເລ້ວ!" };
    }
    if (state.requested) {
      await client.query("rollback");
      return { error: "ບໍ່ສາມາດເລືອກໃໝ່ໄດ້ ມີໃບຂໍເບີກອາໄຫຼ່ແລ້ວ!" };
    }
    await client.query("update ods_tb_install set tech_before=tech_code where code=$1", [code]);
    await client.query(
      "update ods_tb_install set tech_confirm=null, tech_code=null, assigt_time=null, user_assigt=null where code=$1",
      [code],
    );
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    console.error("chooseNewTech failed", error);
    return { error: "ບໍ່ສຳເລັດ" };
  } finally {
    client.release();
  }
  await logChange("ods_tb_install", code, "ຖອນຊ່າງອອກ — ລໍຖ້າຈັດຊ່າງໃໝ່");
  revalidateAll();
  return { ok: "ສຳເລັດ" };
}

/* ── ຊ່າງຮັບງານ (tech_accept_*) ───────────────────────────── */

export async function acceptJob(code: string): Promise<ActionState> {
  const guard = await guardJob(code, TECH_SIDE);
  if (!guard.ok) return { error: guard.error };

  // ຕົວປ່ຽນຂັ້ນຢູ່ lib/job-flow ບ່ອນດຽວ — **ອັນດຽວກັບທີ່ແອັບມືຖືເອີ້ນ**
  const result = await acceptInstall(guard.session, code);
  if (!result.ok) return { error: result.error };
  revalidateAll();
  return { ok: result.message };
}

/**
 * ຍົກເລີກການຮັບງານ — ຍັງເປັນຊ່າງຄົນເກົ່າ.
 * ຖອນຄືນບໍ່ໄດ້ຫຼັງຂໍເບີກອາໄຫຼ່ແລ້ວ (ເອກະສານອອກໃນນາມການຮັບງານນັ້ນແລ້ວ) — ຖ້າຖອນໄດ້
 * ງານຈະຕົກໄປຢູ່ສະຖານະ "ຂໍເບີກແລ້ວ ແຕ່ຍັງບໍ່ຮັບງານ" ເຊິ່ງບໍ່ມີໜ້າໃດພາໄປຕໍ່ໄດ້ (B2).
 */
export async function unacceptJob(code: string): Promise<ActionState> {
  const guard = await guardJob(code, TECH_SIDE);
  if (!guard.ok) return { error: guard.error };
  const { job } = guard;
  if (job.cancelled) return { error: IS_CANCELLED };
  if (job.requested) return { error: "ຖອນການຮັບງານບໍ່ໄດ້ ມີໃບຂໍເບີກອາໄຫຼ່ແລ້ວ!" };
  if (job.started) return { error: "ຖອນການຮັບງານບໍ່ໄດ້ ເລີ່ມຕິດຕັ້ງແລ້ວ!" };

  await query("update ods_tb_install set tech_confirm=null where code=$1", [code]);
  await logChange("ods_tb_install", code, "ຊ່າງຖອນການຮັບງານ");
  revalidateAll();
  return { ok: `ຍົກເລີກຮັບງານ ເລກທີ ${code} ສຳເລັດ` };
}

/* ── ຕິດຕັ້ງ (start/finish_tech_install) ──────────────────── */

export async function startInstall(code: string): Promise<ActionState> {
  const guard = await guardJob(code, TECH_SIDE);
  if (!guard.ok) return { error: guard.error };

  const result = await startInstallFlow(guard.session, code);
  if (!result.ok) return { error: result.error };
  revalidateAll();
  return { ok: result.message };
}

/**
 * ຈົບງານຕິດຕັ້ງ — **ຕ້ອງແນບຮູບຜົນງານ** (ບັງຄັບຢູ່ lib/job-flow ບ່ອນດຽວ ⇒ ແອັບກໍ່ບັງຄັບຄືກັນ).
 * ຮູບຖືກບີບຢູ່ຝັ່ງ client ກ່ອນສົ່ງ (components/installation/finish-install-button).
 */
export async function finishInstall(code: string, photos: string[] = []): Promise<ActionState> {
  const guard = await guardJob(code, TECH_SIDE);
  if (!guard.ok) return { error: guard.error };

  const result = await finishInstallFlow(guard.session, code, photos);
  if (!result.ok) return { error: result.error };
  revalidateAll();
  return { ok: result.message };
}

/* ── ປິດງານ (close_pending_success) ───────────────────────── */

/** ປິດງານໄດ້ສະເພາະງານທີ່ຕິດຕັ້ງແລ້ວ ແລະ ລູກຄ້າຕອບແບບສອບຖາມແລ້ວ (ຂັ້ນ 7) */
export async function closeJob(code: string): Promise<ActionState> {
  const guard = await guardJob(code, SERVICE_SIDE);
  if (!guard.ok) return { error: guard.error };
  const { job } = guard;
  if (job.cancelled) return { error: IS_CANCELLED };
  if (!job.finished) return { error: "ປິດງານບໍ່ໄດ້ ຍັງບໍ່ທັນຕິດຕັ້ງສຳເລັດ" };
  if (!job.qc_passed) return { error: "ປິດງານບໍ່ໄດ້ ຍັງບໍ່ຜ່ານການກວດຮັບຄຸນນະພາບ" };
  if (!job.complained) return { error: "ປິດງານບໍ່ໄດ້ ລູກຄ້າຍັງບໍ່ທັນຕອບແບບສອບຖາມ" };

  await query("update ods_tb_install set job_finish=localtimestamp(0) where code=$1 and job_finish is null", [code]);
  await logChange("ods_tb_install", code, "ປິດງານຕິດຕັ້ງ");
  // ຄິດ ແລະ **ແຊ່** ຄ່າຄອມຂອງງານນີ້ — ກືນ error ໄວ້ ການປິດງານຫ້າມພັງເພາະເລື່ອງເງິນ
  await recordPayout("install", code);
  revalidateAll();
  return { ok: "ສຳເລັດ" };
}

/* ── ຖອນຄືນຂັ້ນຕອນຂອງງານຕິດຕັ້ງ (ບໍ່ມີໃນ ods) ─────────────────
 *
 * ຝັ່ງສ້ອມມີ undoStartCheck / undoStartRepair / undoFinishRepair ມາແຕ່ຕົ້ນ
 * ແຕ່ຝັ່ງຕິດຕັ້ງບໍ່ມີຈັກອັນ — ກົດ "ເລີ່ມຕິດຕັ້ງ" ຫຼື "ຕິດຕັ້ງສຳເລັດ" ຜິດງານເທື່ອດຽວ
 * ແກ້ບໍ່ໄດ້ອີກເລີຍ (ຕ້ອງໄປແກ້ຖານຂໍ້ມູນດ້ວຍມື).
 *
 * ຫຼັກການດຽວກັນກັບຝັ່ງສ້ອມ: ລ້າງແຕ່ **ຖັນເວລາ** — ບໍ່ແຕະສະຕັອກ ຫຼື ເອກະສານໃດເລີຍ
 * (ອາໄຫຼ່ທີ່ເບີກອອກໄປແລ້ວຍັງຜູກກັບງານຄືເກົ່າ) ແລະ ປະຕິເສດຖ້າຂັ້ນຕໍ່ໄປເກີດຂຶ້ນແລ້ວ.
 * ເງື່ອນໄຂຢູ່ໃນ WHERE ນຳ ⇒ ສອງຄົນກົດພ້ອມກັນບໍ່ຜ່ານທັງຄູ່.
 */

/** ຖອນ "ເລີ່ມຕິດຕັ້ງ" — ງານກັບໄປ "ລໍຖ້າຊ່າງຕິດຕັ້ງ" (ຂັ້ນ 4) */
export async function undoStartInstall(code: string): Promise<ActionState> {
  const guard = await guardJob(code, TECH_SIDE);
  if (!guard.ok) return { error: guard.error };
  const { job } = guard;

  if (job.cancelled) return { error: IS_CANCELLED };
  if (job.closed) return { error: IS_CLOSED };
  if (!job.started) return { error: "ງານນີ້ຍັງບໍ່ໄດ້ເລີ່ມຕິດຕັ້ງ" };
  if (job.finished) {
    return { error: 'ຖອນ "ເລີ່ມຕິດຕັ້ງ" ບໍ່ໄດ້: ຕິດຕັ້ງສຳເລັດໄປແລ້ວ — ໃຫ້ຖອນ "ຕິດຕັ້ງສຳເລັດ" ກ່ອນ' };
  }

  const undone = await query(
    `update ods_tb_install set start_install=null
      where code=$1 and start_install is not null and finish_install is null
        and cancel_date is null and job_finish is null`,
    [code],
  );
  if (!undone.rowCount) return { error: "ຖອນຄືນບໍ່ສຳເລັດ — ງານຖືກປ່ຽນໄປແລ້ວ" };

  await logChange("ods_tb_install", code, 'ຖອນ "ເລີ່ມຕິດຕັ້ງ" — ງານກັບໄປ "ລໍຖ້າຊ່າງຕິດຕັ້ງ"');
  revalidateAll();
  return { ok: "ຖອນຄືນສຳເລັດ" };
}

/**
 * ຖອນ "ຕິດຕັ້ງສຳເລັດ" — ງານກັບໄປ "ກຳລັງຕິດຕັ້ງ" (ຂັ້ນ 5).
 *
 * ປະຕິເສດຖ້າລູກຄ້າຕອບແບບສອບຖາມແລ້ວ: complain_finish ເປັນຄຳຕອບຂອງລູກຄ້າຕໍ່ງານທີ່
 * "ຕິດຕັ້ງແລ້ວ" — ຖ້າດຶງງານກັບໄປ "ຍັງຕິດຕັ້ງບໍ່ແລ້ວ" ຄຳຕອບນັ້ນຈະລອຍ ແລະ ຂັ້ນໄດ
 * (lib/install-stage ຂໍ້ ①) ບໍ່ຍອມຮັບ complain_finish ທີ່ບໍ່ມີ finish_install ຢູ່ແລ້ວ.
 */
export async function undoFinishInstall(code: string): Promise<ActionState> {
  const guard = await guardJob(code, TECH_SIDE);
  if (!guard.ok) return { error: guard.error };
  const { job } = guard;

  if (job.cancelled) return { error: IS_CANCELLED };
  if (job.closed) return { error: IS_CLOSED };
  if (!job.finished) return { error: "ງານນີ້ຍັງບໍ່ໄດ້ຕິດຕັ້ງສຳເລັດ" };
  if (job.complained) {
    return { error: 'ຖອນ "ຕິດຕັ້ງສຳເລັດ" ບໍ່ໄດ້: ລູກຄ້າຕອບແບບສອບຖາມໄປແລ້ວ' };
  }

  const undone = await query(
    `update ods_tb_install set finish_install=null
      where code=$1 and finish_install is not null and complain_finish is null
        and cancel_date is null and job_finish is null`,
    [code],
  );
  if (!undone.rowCount) return { error: "ຖອນຄືນບໍ່ສຳເລັດ — ງານຖືກປ່ຽນໄປແລ້ວ" };

  await logChange("ods_tb_install", code, 'ຖອນ "ຕິດຕັ້ງສຳເລັດ" — ງານກັບໄປ "ກຳລັງຕິດຕັ້ງ"');
  revalidateAll();
  return { ok: "ຖອນຄືນສຳເລັດ" };
}

/** ເປີດງານທີ່ປິດແລ້ວຄືນ — ງານກັບໄປ "ລໍຖ້າປິດງານ" (ຂັ້ນ 7). ຝ່າຍບໍລິການເປັນຄົນປິດ ຈຶ່ງເປັນຄົນເປີດຄືນ */
export async function reopenJob(code: string): Promise<ActionState> {
  const guard = await guardJob(code, SERVICE_SIDE);
  if (!guard.ok) return { error: guard.error };
  const { job } = guard;

  if (job.cancelled) return { error: IS_CANCELLED };
  if (!job.closed) return { error: "ງານນີ້ຍັງບໍ່ໄດ້ປິດ" };

  const undone = await query(
    "update ods_tb_install set job_finish=null where code=$1 and job_finish is not null and cancel_date is null",
    [code],
  );
  if (!undone.rowCount) return { error: "ເປີດງານຄືນບໍ່ສຳເລັດ — ງານຖືກປ່ຽນໄປແລ້ວ" };

  await logChange("ods_tb_install", code, 'ເປີດງານຄືນ — ງານກັບໄປ "ລໍຖ້າປິດງານ"');
  revalidateAll();
  return { ok: "ເປີດງານຄືນສຳເລັດ" };
}

/* ── ໃບຂໍເບີກ SION (tech_reg_install.py) ──────────────────── */

/**
 * ─── ກົດເກນຂອງທຸງ "ໃຊ້ອາໄຫຼ່" (ods_tb_install.used_spare) — B7 ──────────────
 *
 * ທຸງນີ້ຕ້ອງ **ຕາມຄວາມຈິງ**, ບໍ່ແມ່ນຄວາມຈິງຕາມທຸງ:
 *   ຍົກຂຶ້ນ (=1) ອັດຕະໂນມັດ ເມື່ອກະຕ່າ (tb_used_spare) ມີແຖວ — addSpareLine
 *   ປັດລົງ (=0) ໄດ້ ກໍ່ຕໍ່ເມື່ອກະຕ່າຫວ່າງ **ແລະ** ຍັງບໍ່ມີໃບຂໍເບີກ (122)
 *                ຫຼື ໃບເບີກ (56) ຂອງງານນັ້ນຈັກໃບ — deleteSpareLine
 * ດັ່ງນັ້ນ "ທຸງ=0 ແຕ່ມີເອກະສານເບີກ" ຈຶ່ງເກີດຈາກ action ຂອງລະບົບນີ້ບໍ່ໄດ້ອີກ.
 *
 * ຂໍ້ມູນຈິງທີ່ພົບ (ມາຈາກ ods / ການແກ້ຖານຂໍ້ມູນດ້ວຍມື — ລະບົບໃໝ່ບໍ່ມີ action ໃດປັດທຸງລົງເລີຍ):
 *   ທຸງ=0 ແຕ່ກະຕ່າມີແຖວ  : 3 ງານ / 12 ແຖວ (INST-6883, INST-6892, INST-6952)
 *   ທຸງ=0 ແຕ່ມີເອກະສານ 122/56 : 5 ງານ (ເພີ່ມ INST-6061, INST-6777)
 *   ທຸງ=1 ແຕ່ກະຕ່າຫວ່າງ  : 3 ງານ (INST-626, INST-5982, INST-6017 — ປິດງານໝົດແລ້ວ)
 * ຂັ້ນໄດ (lib/install-stage) ບໍ່ເຊື່ອທຸງ=0 ອີກຕໍ່ໄປ ຖ້າແຖວມີ reg_start/reg_finish/pick_finish.
 */

/** ເພີ່ມອາໄຫຼ່ເຂົ້າໃບຂໍເບີກ (additemtoreg_inst) — ຍົກທຸງ used_spare ຂຶ້ນນຳ */
export async function addSpareLine(code: string, itemCode: string, itemName: string, unitCode: string) {
  const guard = await guardJob(code, TECH_SIDE);
  if (!guard.ok) return { error: guard.error } satisfies ActionState;
  const { job } = guard;
  if (!db) return { error: "ບໍ່ພົບ DATABASE_URL" } satisfies ActionState;
  if (job.cancelled) return { error: IS_CANCELLED } satisfies ActionState;
  if (job.closed) return { error: IS_CLOSED } satisfies ActionState;

  const client = await db.connect();
  try {
    await client.query("begin");
    await client.query(
      "insert into tb_used_spare(product_code,item_code,item_name,qty,unit_code) values($1,$2,$3,1,$4)",
      [code, itemCode, itemName, unitCode],
    );
    // ມີອາໄຫຼ່ໃນກະຕ່າແລ້ວ ⇒ ງານນີ້ໃຊ້ອາໄຫຼ່ ຕາມຄວາມຈິງ
    await client.query("update ods_tb_install set used_spare=1 where code=$1 and coalesce(used_spare,0)<>1", [code]);
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    console.error("addSpareLine failed", error);
    return { error: "ບັນທຶກບໍ່ສຳເລັດ" } satisfies ActionState;
  } finally {
    client.release();
  }
  revalidatePath(`/installations/spare-requests/${code}`);
  return { ok: "ສຳເລັດ" } satisfies ActionState;
}

/**
 * ລົບແຖວອາໄຫຼ່ (delete_item_sion).
 * ລົບບໍ່ໄດ້ ຖ້າແຖວນັ້ນຖືກຂໍເບີກ/ເບີກອອກໄປແລ້ວ — ບໍ່ດັ່ງນັ້ນເອກະສານກັບກະຕ່າຈະຂັດກັນ
 * ແລ້ວ savePickSpare ຫາແຖວກະຕ່າຄູ່ຂອງໃບເບີກບໍ່ພົບ (ຕົ້ນເຫດຂອງ B4).
 */
export async function deleteSpareLine(code: string, roworder: number) {
  const guard = await guardJob(code, TECH_SIDE);
  if (!guard.ok) return { error: guard.error } satisfies ActionState;
  if (!db) return { error: "ບໍ່ພົບ DATABASE_URL" } satisfies ActionState;

  const client = await db.connect();
  try {
    await client.query("begin");
    const line = await client.query<{ requested: boolean; dispatched: boolean }>(
      `select reg_start is not null as requested, reg_finish is not null as dispatched
       from tb_used_spare where roworder=$1 and product_code=$2 for update`,
      [roworder, code],
    );
    const row = line.rows[0];
    if (!row) {
      await client.query("rollback");
      return { error: "ບໍ່ພົບລາຍການ" } satisfies ActionState;
    }
    if (row.requested || row.dispatched) {
      await client.query("rollback");
      return { error: "ລົບບໍ່ໄດ້ ອາໄຫຼ່ແຖວນີ້ຖືກຂໍເບີກ/ເບີກອອກໄປແລ້ວ" } satisfies ActionState;
    }
    await client.query("delete from tb_used_spare where roworder=$1", [roworder]);

    // ກະຕ່າຫວ່າງ ແລະ ບໍ່ມີເອກະສານເບີກຈັກໃບ ⇒ ປັດທຸງລົງໄດ້ (ຄວາມຈິງ = ບໍ່ໃຊ້ອາໄຫຼ່)
    await client.query(
      `update ods_tb_install set used_spare=0
       where code=$1
         and not exists (select 1 from tb_used_spare s where s.product_code=$1)
         and not exists (select 1 from ic_trans t where t.product_code=$1 and t.trans_flag in (122,56))`,
      [code],
    );
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    console.error("deleteSpareLine failed", error);
    return { error: "ລົບບໍ່ສຳເລັດ" } satisfies ActionState;
  } finally {
    client.release();
  }
  revalidatePath(`/installations/spare-requests/${code}`);
  return { ok: "ສຳເລັດ" } satisfies ActionState;
}

/** ແກ້ຈຳນວນ (update_qty_reg_spare) — ແກ້ໄດ້ສະເພາະແຖວທີ່ຍັງບໍ່ທັນຂໍເບີກ */
export async function updateSpareQty(code: string, roworder: number, qty: number) {
  const guard = await guardJob(code, TECH_SIDE);
  if (!guard.ok) return { error: guard.error } satisfies ActionState;
  if (!Number.isFinite(qty) || qty <= 0) return { error: "ຈຳນວນບໍ່ຖືກຕ້ອງ" } satisfies ActionState;
  const done = await query(
    "update tb_used_spare set qty=round($1,2) where roworder=$2 and product_code=$3 and reg_start is null and reg_finish is null",
    [qty, roworder, code],
  );
  revalidatePath(`/installations/spare-requests/${code}`);
  if (!done.rowCount) return { error: "ແກ້ບໍ່ໄດ້ ອາໄຫຼ່ແຖວນີ້ຖືກຂໍເບີກ/ເບີກອອກໄປແລ້ວ" } satisfies ActionState;
  return { ok: "ສຳເລັດ" } satisfies ActionState;
}

/**
 * ອາໄຫຼ່ຂອງງານຕິດຕັ້ງທີ່ "ຍັງບໍ່ທັນຖືກຂໍເບີກ" — ຄິດເປັນ **ຈຳນວນ** ບໍ່ແມ່ນເປັນແຖວ (B3).
 *
 * ຄືກັນທຸກປະການກັບ OUTSTANDING_SPARES ຂອງສາຍງານສ້ອມ (actions/stock.ts saveRequest):
 * ນັບໃບຂໍເບີກ (122) ທັງໝົດເປັນ "ຂໍໄປແລ້ວ" ແລ້ວຫັກຄືນດ້ວຍໃບຂໍສົ່ງຄືນ (59)
 * — ບັນຊີເອກະສານເທົ່ານັ້ນທີ່ບອກຄວາມຈິງໄດ້. ຖັນຂອງ tb_used_spare ເຊື່ອບໍ່ໄດ້:
 * INST-5849/5850 ມີ ic_trans 122/56/166 ຄົບ ແຕ່ ods_tb_install.reg_start ເປັນ null.
 *
 * ກ່ອນແກ້: saveSpareRequest ກ໋ອບ **ທຸກ** ແຖວຂອງ tb_used_spare ໂດຍບໍ່ກອງ ⇒ ໃບທີສອງ
 * ຂໍອາໄຫຼ່ຊຸດເກົ່າຄືນອີກ ແລ້ວສາງເບີກ (ຕັດສະຕັອກ ODS+ERP) ອາໄຫຼ່ຕົວດຽວກັນສອງເທື່ອ.
 * ຂໍ້ມູນຈິງຝັ່ງຕິດຕັ້ງ: 289 ງານມີໃບ SION ຫຼາຍກວ່າ 1 ໃບ · ອາໄຫຼ່ຕົວດຽວກັນຖືກຂໍໃນ 2+ ໃບ
 * = 128 ຄູ່ (32 ງານ) · ຖືກສາງເບີກອອກໃນ 2+ ໃບເບີກ = 61 ຄູ່ (29 ງານ, 145 ໃບເບີກ).
 */
const OUTSTANDING_INSTALL_SPARES = `
  select n.item_code, n.item_name, n.unit_code, (n.qty - coalesce(c.qty, 0))::numeric qty
  from (
    select item_code, min(roworder) rn, max(item_name) item_name, max(unit_code) unit_code, sum(qty) qty
    from tb_used_spare where product_code = $1 group by item_code
  ) n
  left join (
    select item_code, sum(case when trans_flag = 122 then qty else -qty end) qty
    from ic_trans_detail
    where product_code = $1 and trans_flag in (122, 59)
    group by item_code
  ) c on c.item_code = n.item_code
  where n.qty - coalesce(c.qty, 0) > 0
  order by n.rn`;

/**
 * ບັນທຶກໃບຂໍເບີກ SION (save_in_req) — trans_flag 122.
 *
 * ກົດເກນ (B2): **ຊ່າງຕ້ອງຮັບງານກ່ອນ ຈຶ່ງຂໍເບີກອາໄຫຼ່ໄດ້.**
 * ໃບ SION ອອກໃນນາມຊ່າງທີ່ຮັບງານ ແລະ ໜ້າ /installations/accept ກັບປຸ່ມ "ເລືອກຊ່າງໃໝ່"
 * ຂອງ /installations/assign ລ້ວນກອງ reg_start is null — ຖ້າຂໍເບີກໄດ້ກ່ອນຮັບງານ ງານຈະ
 * ຫາຍອອກຈາກໜ້າຮັບງານທັນທີ ແລ້ວ tech_confirm ຈະບໍ່ມີວັນຖືກ set ໄດ້ອີກ ⇒ /installations/work
 * (ຕ້ອງການ tech_confirm) ກໍ່ບໍ່ສະແດງ ⇒ ງານຕາຍ (ລຶບໃບຂໍເບີກກໍ່ບໍ່ໄດ້ຫຼັງສາງເບີກແລ້ວ).
 */
export async function saveSpareRequest(_: ActionState, formData: FormData): Promise<ActionState> {
  const productCode = String(formData.get("product_code") ?? "");
  const docDate = String(formData.get("doc_date") ?? "");
  const whCode = String(formData.get("wh_code") ?? "");
  const shelfCode = String(formData.get("shelf_code") ?? "");
  const remark = String(formData.get("remark") ?? "");
  // ສາງ ແລະ ທີ່ເກັບ **ບັງຄັບ** — 2,518 ໃບເກົ່າບໍ່ມີທັງສອງ ⇒ ສາງບໍ່ຮູ້ວ່າຈະໄປຢິບຢູ່ຫ້ອງໃດ
  // ແລະ ເອກະສານຂາດ wh_code/shelf_code ທີ່ ERP ຕ້ອງການ
  if (!productCode || !docDate || !whCode || !shelfCode) {
    return { error: "ກະລຸນາລະບຸ ສາງ ແລະ ທີ່ເກັບ" };
  }

  const guarded = await guardJob(productCode, TECH_SIDE);
  if (!guarded.ok) return { error: guarded.error };
  const { session, job: guard } = guarded;
  if (!db) return { error: "ບໍ່ພົບ DATABASE_URL" };
  if (guard.cancelled) return { error: IS_CANCELLED };
  if (guard.closed) return { error: IS_CLOSED };
  if (!guard.assigned) return { error: "ຂໍເບີກບໍ່ໄດ້ ງານນີ້ຍັງບໍ່ມີຊ່າງ" };
  if (!guard.accepted) return { error: "ຂໍເບີກບໍ່ໄດ້ ຊ່າງຕ້ອງຮັບງານກ່ອນ" };

  if (!odgDb) return { error: "ບໍ່ພົບ ODG_DATABASE_URL" };

  /**
   * ── ໃບຂໍເບີກຕ້ອງລົງ **ທັງ ODS ແລະ ERP** (ນະໂຍບາຍ 13-07-2026) ──
   * "ERP ຜ່ານ = ສຳເລັດ": ຖ້າ ERP ປະຕິເສດ ⇒ rollback ທັງສອງຖານ ບໍ່ໃຫ້ບັນທຶກເລີຍ
   * ⇒ ບໍ່ມີໃບຄ້າງເຄິ່ງທາງທີ່ຢູ່ ODS ແຕ່ບໍ່ຢູ່ ERP.
   * ລຳດັບ: insert ERP (ຍັງບໍ່ commit) → commit ODS → commit ERP
   * (insert ຜ່ານ trigger ໝົດແລ້ວ ⇒ commit ຂອງ ERP ຈະລົ້ມໄດ້ຍາກທີ່ສຸດ).
   */
  const client = await db.connect();
  const odg = await odgDb.connect();
  let requestNo = "";
  let requestLines = 0;
  try {
    await client.query("begin");
    await odg.query("begin");
    await client.query("select pg_advisory_xact_lock(734212)");

    const cart = await client.query<{ count: number }>(
      "select count(*)::int count from tb_used_spare where product_code=$1",
      [productCode],
    );
    if (!cart.rows[0]?.count) {
      await client.query("rollback");
      return { error: "ບໍ່ມີລາຍການສຳລັບເບີກ!" };
    }

    // ສະເພາະຈຳນວນທີ່ຍັງບໍ່ທັນຂໍເບີກ/ເບີກອອກ — ກັນຂໍຊ້ຳແລ້ວສາງເບີກອາໄຫຼ່ຕົວດຽວກັນສອງເທື່ອ
    const lines = await client.query<{
      item_code: string; item_name: string | null; unit_code: string | null; qty: string;
    }>(OUTSTANDING_INSTALL_SPARES, [productCode]);
    if (lines.rows.length === 0) {
      await client.query("rollback");
      return { error: "ອາໄຫຼ່ທຸກລາຍການຂອງງານນີ້ ຖືກຂໍເບີກ ຫຼື ເບີກອອກໄປແລ້ວ" };
    }

    // ອອກເລກ SION ພາຍໃນ lock — ods ອອກນອກ lock ຈຶ່ງຊ້ຳໄດ້
    const docNo = await nextDocNo(client, "SION");
    requestNo = docNo;
    requestLines = lines.rows.length;

    await client.query(
      `insert into ic_trans(trans_flag,doc_date,doc_no,product_code,remark,status,used_status,user_created,job_type,wh_code,shelf_code)
       values(122,$1,$2,$3,$4,0,1,$5,'install',$6,$7)`,
      [docDate, docNo, productCode, remark, session.username, whCode, shelfCode],
    );

    for (const line of lines.rows) {
      await client.query(
        `insert into ic_trans_detail(trans_flag,doc_date,doc_no,product_code,item_code,item_name,qty,unit_code,calc_flag,status,user_created,job_type)
         values(122,$1,$2,$3,$4,$5,$6,$7,1,0,$8,'install')`,
        [docDate, docNo, productCode, line.item_code, line.item_name, line.qty, line.unit_code, session.username],
      );
    }
    // ໝາຍແຖວກະຕ່າຂອງອາໄຫຼ່ທີ່ຢູ່ໃນໃບນີ້ວ່າ "ຂໍເບີກແລ້ວ" (ຄືກັບ actions/stock.ts saveRequest)
    await client.query(
      `update tb_used_spare set reg_start=localtimestamp(0)
       where product_code=$1 and reg_start is null and item_code = any($2::varchar[])`,
      [productCode, lines.rows.map((line) => line.item_code)],
    );

    await client.query("update ods_tb_install set reg_start=coalesce(reg_start,localtimestamp(0)) where code=$1", [
      productCode,
    ]);
    await client.query(
      "update ods_tb_install_detail set reg_start=coalesce(reg_start,localtimestamp(0)) where code=$1",
      [productCode],
    );

    // ── ສົ່ງໃບດຽວກັນເຂົ້າ ERP (ເລກ SIO ອັນດຽວກັນ) ──
    await writeErpRequest(
      {
        doc_no: docNo,
        doc_date: docDate,
        // ໂມງ:ນາທີ ຕາມເຂດເວລາລາວ (ບໍ່ແມ່ນເວລາເຄື່ອງແມ່ຂ່າຍ — ມັນອາດເປັນ UTC)
        doc_time: new Intl.DateTimeFormat("en-GB", {
          timeZone: "Asia/Bangkok", hour: "2-digit", minute: "2-digit", hour12: false,
        }).format(new Date()),
        job_code: productCode,
        wh_code: whCode,
        shelf_code: shelfCode,
        remark,
        requester: session.username,
        lines: lines.rows,
      },
      odg,
    );

    await client.query("commit");
    await odg.query("commit");
  } catch (error) {
    await client.query("rollback").catch(() => {});
    await odg.query("rollback").catch(() => {});
    console.error("saveSpareRequest failed", error);
    return { error: "ບັນທຶກບໍ່ສຳເລັດ — ERP ບໍ່ຮັບໃບຂໍເບີກນີ້ (ບໍ່ໄດ້ບັນທຶກຫຍັງເລີຍ)" };
  } finally {
    client.release();
    odg.release();
  }

  // ສາງຕ້ອງເບີກອາໄຫຼ່ໃຫ້ (ods ຍິງ LINE Notify ຫາສາງຢູ່ຈຸດນີ້)
  await logChange(
    "ods_tb_install",
    productCode,
    `ສ້າງໃບຂໍເບີກ ${requestNo} · ອາໄຫຼ່ ${requestLines} ລາຍການ${remark ? ` · ${remark}` : ""}`,
    { roles: ROLE_WAREHOUSE },
  );

  revalidateAll();
  redirect("/installations/spare-requests");
}

/** ລົບໃບຂໍເບີກ (delete_in_req) */
export async function deleteSpareRequest(docNo: string, code: string): Promise<ActionState> {
  const guard = await guardJob(code, TECH_SIDE);
  if (!guard.ok) return { error: guard.error };
  if (!db) return { error: "ບໍ່ພົບ DATABASE_URL" };
  const client = await db.connect();
  try {
    await client.query("begin");
    // ຖ້າສາງເບີກ (SWC) ອ້າງອີງໃບນີ້ແລ້ວ → ລົບບໍ່ໄດ້
    const used = await client.query<{ count: string }>(
      "select count(doc_no) count from ic_trans where doc_ref=$1",
      [docNo],
    );
    if (Number(used.rows[0].count) !== 0) {
      await client.query("rollback");
      return { error: `ບໍ່ສາມາດລົບເລກທີຂໍເບີກ ${docNo} ນີ້ໂດ້` };
    }
    /**
     * ── ລຶບຢູ່ **ERP** ນຳ (13-07-2026) ──
     * ໃບຂໍເບີກຢູ່ທັງສອງຖານແລ້ວ ⇒ ລຶບແຕ່ຢູ່ ODS = ໃບກຳພ້າຄ້າງໃນ ERP ແລະ
     * **ສາງອາດເບີກຕາມໃບທີ່ຖືກລຶບໄປແລ້ວ** (ອາໄຫຼ່ອອກໂດຍບໍ່ມີງານຮອງຮັບ).
     * ຖ້າ ERP ເບີກຕາມໃບນີ້ໄປແລ້ວ deleteErpRequest ຈະໂຍນ error ⇒ ລຶບບໍ່ໄດ້ (ຖືກຕ້ອງ).
     */
    await deleteErpRequest(docNo);

    await client.query("delete from ic_trans where doc_no=$1", [docNo]);
    await client.query("delete from ic_trans_detail where doc_no=$1", [docNo]);
    // ລ້າງ reg_start ຂອງງານ **ກໍ່ຕໍ່ເມື່ອ** ບໍ່ເຫຼືອໃບຂໍເບີກໃບອື່ນແລ້ວ — ບໍ່ດັ່ງນັ້ນງານທີ່ຍັງ
    // ມີໃບ SION ຄ້າງຢູ່ຈະເດັ້ງກັບໄປຄິວ "ລໍຖ້າຂໍເບີກ" ພ້ອມກັນກັບຢູ່ຄິວ "ກຳລັງຂໍເບີກ" (ods ກໍ່ເປັນ)
    const remaining = await client.query<{ count: number }>(
      "select count(*)::int count from ic_trans where product_code=$1 and trans_flag=122",
      [code],
    );
    if (!remaining.rows[0]?.count) {
      await client.query("update ods_tb_install set reg_start=null where code=$1", [code]);
      await client.query("update ods_tb_install_detail set reg_start=null where code=$1", [code]);
    }
    // ods ລືມລ້າງ reg_start ຂອງ tb_used_spare → ຂໍເບີກຮອບໃໝ່ບໍ່ໄດ້. ບ່ອນນີ້ລ້າງນຳ —
    // ສະເພາະແຖວທີ່ຢູ່ໃນໃບທີ່ຖືກລຶບ ແລະ ຍັງບໍ່ຖືກເບີກອອກ (ບໍ່ແຕະແຖວຂອງໃບອື່ນ)
    await client.query(
      `update tb_used_spare set reg_start=null
       where product_code=$1 and reg_finish is null
         and item_code not in (
           select item_code from ic_trans_detail where product_code=$1 and trans_flag=122)`,
      [code],
    );
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    console.error("deleteSpareRequest failed", error);
    return { error: "ລົບບໍ່ສຳເລັດ" };
  } finally {
    client.release();
  }
  await logChange("ods_tb_install", code, `ລຶບໃບຂໍເບີກ ${docNo}`);
  revalidateAll();
  return { ok: `ລົບເລກທີຂໍເບີກ ${docNo} ສຳເລັດ` };
}

/* ── ສາງເບີກ SWC — **ຖອດອອກແລ້ວ** ────────────────────────────
 *
 * ນະໂຍບາຍ (13-07-2026): **ລະບົບນີ້ອອກໃບເບີກເອງບໍ່ໄດ້ອີກ.**
 * ສາງເບີກຢູ່ **ERP** (ບ່ອນທີ່ສະຕັອກຈິງຢູ່ ແລະ ບ່ອນທີ່ບັນຊີເບິ່ງ) — ODS ເປັນຝ່າຍ **ອ່ານ**:
 * lib/erp-dispatch ດຶງໃບ 56 ຂອງ ERP ທີ່ doc_ref ຊີ້ໃສ່ໃບຂໍຂອງເຮົາ ແລ້ວເລື່ອນຂັ້ນງານໃຫ້ເອງ.
 *
 * ຖອດທັງ action ບໍ່ແມ່ນເຊື່ອງແຕ່ປຸ່ມ — server action ຖືກຍິງໂດຍກົງໄດ້ (lib/guard).
 * ເກັບຊື່ຟັງຊັນໄວ້ ເພື່ອບອກເຫດຜົນໃຫ້ຄົນທີ່ຍັງກົດປຸ່ມເກົ່າ (ໜ້າທີ່ cache ໄວ້).
 */
export async function saveDispatch(_: ActionState): Promise<ActionState> {
  return {
    error: "ລະບົບນີ້ອອກໃບເບີກບໍ່ໄດ້ອີກ — ສາງເບີກຢູ່ ERP ແລ້ວລະບົບຈະດຶງມາເອງ",
  };
}
/* ── ຊ່າງຮັບອາໄຫຼ່ PISP (save_pick_spare) ─────────────────── */

/**
 * ຊ່າງຮັບອາໄຫຼ່ຈາກໃບເບີກ SWC ໜຶ່ງໃບ — ອອກໃບ PISP (166). ບໍ່ແຕະສະຕັອກ
 * (ຕັດໄປແລ້ວຕອນສາງເບີກ 56).
 *
 * ກົດເກນ (B4): **ຂັ້ນ "ລໍຖ້າຊ່າງຮັບອາໄຫຼ່" ຈົບເມື່ອບໍ່ເຫຼືອໃບເບີກໃຫ້ຮັບອີກ** —
 * ບໍ່ແມ່ນ "ເມື່ອທຸກແຖວຂອງກະຕ່າຖືກຮັບ".
 *
 * ກ່ອນແກ້: stamp ods_tb_install.pick_finish ກໍ່ຕໍ່ເມື່ອ tb_used_spare ບໍ່ເຫຼືອແຖວ pick_finish
 * is null ຈັກແຖວ. ແຕ່ຈຳນວນນັ້ນລວມແຖວທີ່ addSpareLine ເພີ່ມເຂົ້າມາພາຍຫຼັງ (ຍັງບໍ່ເຄີຍຢູ່ໃນ
 * ໃບເບີກໃດ) ນຳ ໃນຂະນະທີ່ໜ້າ /installations/spare-pickup ເຊື່ອງໃບເບີກທີ່ມີ PISP ແລ້ວ
 * ⇒ ແຖວຫຼົງໜຶ່ງແຖວ ງານກໍ່ຄ້າງຢູ່ຂັ້ນ 3 ຕະຫຼອດ ໂດຍບໍ່ມີເອກະສານໃຫ້ຮັບອີກແລ້ວ.
 * ດຽວນີ້ ໜ້າ ແລະ ການ stamp ໃຊ້ **ນິຍາມດຽວກັນ** (ໃບເບີກທີ່ຍັງບໍ່ມີ PISP ອ້າງອີງ)
 * ⇒ ຂັ້ນ 3 ອອກໄດ້ສະເໝີ.
 *
 * ລາຍການທີ່ຮັບກໍ່ອ່ານຈາກ **ໃບເບີກ** ບໍ່ແມ່ນຈາກກະຕ່າ (ຄືກັບ actions/stock.ts savePickSpare):
 * ການ join ກະຕ່າດ້ວຍ item_code+qty ຂອງໂຄດເກົ່າພາດງ່າຍ (INST-6883 ມີ 23 ແຖວໃນໃບເບີກ
 * ແຕ່ກະຕ່າເຫຼືອ 4 ແຖວ) ແລ້ວຄືນ "ບໍ່ມີລາຍການສຳລັບຮັບ!" ທັງທີ່ໃບເບີກມີຂອງຢູ່.
 */
export async function savePickSpare(_: ActionState, formData: FormData): Promise<ActionState> {
  const guard = await requireRole(TECH_SIDE, "ບໍ່ມີສິດຮັບອາໄຫຼ່");
  if (!guard.ok) return { error: guard.error };
  const session = guard.session;
  if (!db) return { error: "ບໍ່ພົບ DATABASE_URL" };

  const docRef = String(formData.get("doc_ref") ?? "");   // ເລກ SWC
  const docDate = String(formData.get("doc_date") ?? "");
  const remark = String(formData.get("remark") ?? "");
  if (!docRef || !docDate) return { error: "ຂໍ້ມູນບໍ່ຄົບ" };

  const client = await db.connect();
  let pickNo = "";
  let pickLines = 0;
  let productCode = "";
  try {
    await client.query("begin");
    await client.query("select pg_advisory_xact_lock(734214)");

    // ວຽກເຈົ້າຂອງເອົາຈາກໃບເບີກ — ບໍ່ເຊື່ອ product_code ທີ່ມາຈາກ form
    const head = await client.query<{ product_code: string | null }>(
      "select product_code from ic_trans where doc_no=$1 and trans_flag=56 and job_type='install' limit 1",
      [docRef],
    );
    productCode = head.rows[0]?.product_code ?? "";
    if (!productCode) {
      await client.query("rollback");
      return { error: "ບໍ່ພົບໃບເບີກອາໄຫຼ່" };
    }

    // ເຈົ້າຂອງງານຮູ້ໄດ້ກໍ່ຕໍ່ເມື່ອອ່ານໃບເບີກແລ້ວ (form ສົ່ງມາແຕ່ເລກ SWC) ⇒ ກວດຢູ່ນີ້.
    // ຖ້າບໍ່ກວດ ຊ່າງຄົນໃດກໍ່ຮັບອາໄຫຼ່ຂອງໃບເບີກຂອງຊ່າງຄົນອື່ນໄປໄດ້.
    const owner = await client.query<{ tech_code: string | null }>(
      "select nullif(tech_code,'') tech_code from ods_tb_install where code=$1",
      [productCode],
    );
    if (roleOf(session) === "technical" && (owner.rows[0]?.tech_code ?? "") !== session.username) {
      await client.query("rollback");
      return { error: NOT_YOURS };
    }

    // ກັນຮັບຊ້ຳ — ໃບເບີກນຶ່ງໃບຮັບໄດ້ເທື່ອດຽວ (ຄືກັບໜ້າ spare-pickup ທີ່ເຊື່ອງໃບທີ່ມີ PISP)
    const already = await client.query<{ count: number }>(
      "select count(*)::int count from ic_trans where trans_flag=166 and doc_ref=$1",
      [docRef],
    );
    if (already.rows[0]?.count) {
      await client.query("rollback");
      return { error: "ໃບນີ້ຮັບອາໄຫຼ່ໄປແລ້ວ" };
    }

    const lines = await client.query<{
      item_code: string; item_name: string; qty: string; unit_code: string; detail_row: number;
    }>(
      `select item_code, item_name, qty, unit_code, roworder detail_row
       from ic_trans_detail where doc_no=$1 and trans_flag=56 order by roworder asc`,
      [docRef],
    );
    if (lines.rowCount === 0) {
      await client.query("rollback");
      return { error: "ບໍ່ມີລາຍການສຳລັບຮັບ!" };
    }

    const docNo = await nextDocNo(client, "PISP");
    pickNo = docNo;
    pickLines = lines.rows.length;

    await client.query(
      `insert into ic_trans(trans_flag,doc_date,doc_no,product_code,remark,status,used_status,user_created,job_type,doc_ref)
       values(166,$1,$2,$3,$4,0,1,$5,'install',$6)`,
      [docDate, docNo, productCode, remark, session.username, docRef],
    );

    for (const line of lines.rows) {
      await client.query(
        `insert into ic_trans_detail(trans_flag,doc_date,doc_no,product_code,item_code,item_name,qty,unit_code,
           calc_flag,status,user_created,job_type,doc_ref)
         values(166,$1,$2,$3,$4,$5,$6,$7,1,0,$8,'install',$9)`,
        [docDate, docNo, productCode, line.item_code, line.item_name, line.qty, line.unit_code,
          session.username, docRef],
      );
      // ແຖວກະຕ່າອັນທີ່ຕົງກັບອາໄຫຼ່ແຖວນີ້ (ເລືອກແຖວທີ່ສາງຈ່າຍແລ້ວ ແລະ ຈຳນວນຕົງກັນກ່ອນ)
      await client.query(
        `update tb_used_spare
           set pick_finish=localtimestamp(0), reg_finish=coalesce(reg_finish, localtimestamp(0))
         where roworder = (
           select roworder from tb_used_spare
           where product_code=$1 and item_code=$2 and pick_finish is null
           order by (reg_finish is not null) desc, (qty = $3::numeric) desc, roworder asc limit 1)`,
        [productCode, line.item_code, line.qty],
      );
      await client.query("update ic_trans_detail set status=1 where roworder=$1", [line.detail_row]);
    }

    // ບໍ່ເຫຼືອໃບເບີກທີ່ຍັງບໍ່ໄດ້ຮັບແລ້ວ ⇒ ຂັ້ນ 3 ຈົບ (ນິຍາມດຽວກັບໜ້າ /installations/spare-pickup)
    const unpicked = await client.query<{ count: number }>(
      `select count(*)::int count from ic_trans t
       where t.trans_flag=56 and t.product_code=$1
         and not exists (select 1 from ic_trans p where p.trans_flag=166 and p.doc_ref=t.doc_no)`,
      [productCode],
    );
    if (!unpicked.rows[0]?.count) {
      await client.query("update ods_tb_install set pick_finish=localtimestamp(0) where code=$1", [productCode]);
    }
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    console.error("savePickSpare failed", error);
    return { error: "ບັນທຶກບໍ່ສຳເລັດ" };
  } finally {
    client.release();
  }

  await logChange(
    "ods_tb_install",
    productCode,
    `ຊ່າງຮັບອາໄຫຼ່ ${pickNo} · ${pickLines} ລາຍການ (ອ້າງອີງໃບເບີກ ${docRef})`,
  );

  revalidateAll();
  redirect("/installations/spare-pickup");
}

/* ── QR ແບບສອບຖາມ — ໃຫ້ລູກຄ້າສະແກນຕອບຢູ່ໜ້າງານ ────────────
 *
 * ຂັ້ນ 6 → 7 ຕ້ອງໃຫ້ **ລູກຄ້າ** ຕອບແບບສອບຖາມ ແຕ່ LINE Notify ທີ່ ods ໃຊ້ສົ່ງລິ້ງ
 * ປິດບໍລິການໄປແລ້ວ ແລະ ບໍ່ມີຫຍັງມາແທນ ⇒ ງານກອງຢູ່ຂັ້ນ 6 ຈົນກວ່າຈະມີໃຜສົ່ງລິ້ງດ້ວຍມື.
 *
 * ຊ່າງເປີດ QR ນີ້ຢູ່ໜ້າງານໃຫ້ລູກຄ້າສະແກນຕອບເລີຍ — ບໍ່ຕ້ອງມີບໍລິການສົ່ງຂໍ້ຄວາມພາຍນອກ,
 * ບໍ່ມີຄ່າໃຊ້ຈ່າຍ ແລະ ໄດ້ຄຳຕອບທັນທີ. ສ້າງຕອນກົດ (ບໍ່ແມ່ນທຸກແຖວຕອນ render ລາຍການ).
 */
export type FeedbackQr = { url: string; svg: string } | { error: string };

export async function feedbackQr(code: string): Promise<FeedbackQr> {
  const guard = await guardJob(code, [...TECH_SIDE, ...SERVICE_SIDE]);
  if (!guard.ok) return { error: guard.error };
  const { job } = guard;

  if (job.cancelled) return { error: IS_CANCELLED };
  // ດ່ານດຽວກັນກັບ feedbackGate — ຕອບໄດ້ສະເພາະງານທີ່ຕິດຕັ້ງແລ້ວຈິງ ຈຶ່ງບໍ່ໃຫ້ QR ກ່ອນ
  if (!job.finished) return { error: "ຍັງບໍ່ທັນຕິດຕັ້ງສຳເລັດ — ຕອບແບບສອບຖາມບໍ່ໄດ້ເທື່ອ" };
  if (job.complained) return { error: "ລູກຄ້າຕອບແບບສອບຖາມນີ້ແລ້ວ" };

  const url = await feedbackUrl(code);
  const svg = await QRCode.toString(url, { type: "svg", margin: 0, errorCorrectionLevel: "M", width: 220 });
  return { url, svg };
}

/* ── Feedback ລູກຄ້າ (ສາທາລະນະ — ບໍ່ຕ້ອງ login) ───────────── */

/**
 * ດ່ານກວດຂອງໜ້າສາທາລະນະ /feedback/<code> — ໃຊ້ທັງຢູ່ໜ້າ (ສະແດງຂໍ້ຄວາມ) ແລະ ໃນ action (B1).
 *
 * ໜ້ານັ້ນຢູ່ນອກກຸ່ມ (app) ⇒ ບໍ່ມີ session, ບໍ່ມີການກວດ role ແລະ ລະຫັດ INST-xxxx ເປັນເລກລຽງ
 * ⇒ ເດົາໄດ້ງ່າຍ. ຖ້າບໍ່ກວດວ່າ "ຕິດຕັ້ງແລ້ວຈິງບໍ" ຄົນນອກກໍ່ຍູ້ງານໃດກໍ່ໄດ້ເຂົ້າຄິວ "ລໍຖ້າປິດງານ"
 * ບ່ອນທີ່ມີປຸ່ມ "ປິດງານ" ລໍຖ້າຢູ່ (ຂໍ້ມູນມື້ນີ້: 0 ແຖວ — ຮູຍັງບໍ່ຖືກໃຊ້ ແຕ່ເປີດຢູ່).
 *
 * ໝາຍເຫດ: ໄຟລ໌ "use server" export ໄດ້ແຕ່ async function ຈຶ່ງສົ່ງຂໍ້ຄວາມກັບມານຳເລີຍ.
 */
export type FeedbackGate = { ok: true } | { ok: false; message: string };

const FEEDBACK_NOT_INSTALLED = "ງານຕິດຕັ້ງນີ້ຍັງບໍ່ທັນຕິດຕັ້ງສຳເລັດ ຈຶ່ງຍັງຕອບແບບສອບຖາມບໍ່ໄດ້ເທື່ອ";
const FEEDBACK_NOT_QC = "ງານນີ້ຍັງບໍ່ຜ່ານການກວດຮັບຄຸນນະພາບ ຈຶ່ງຍັງຕອບແບບສອບຖາມບໍ່ໄດ້ເທື່ອ";

export async function feedbackGate(code: string): Promise<FeedbackGate> {
  const job = await query<{ cancelled: boolean; finished: boolean; qc_passed: boolean; answered: boolean }>(
    /**
     * "ຕອບແລ້ວ" = **complain_finish ຫຼື ມີແຖວຄະແນນ** — ຂໍ້ໃດຂໍ້ນຶ່ງກໍ່ຖື.
     *
     * ແຕ່ກ່ອນດ່ານນີ້ເບິ່ງແຕ່ຈຳນວນແຖວ cust_complain ໃນຂະນະທີ່ saveFeedback ຂ້າງລຸ່ມ
     * ກັນດ້ວຍ `complain_finish is null` ⇒ ສອງບ່ອນຕັດສິນຄົນລະຫຼັກ. ຂໍ້ມູນຈິງ:
     * **5,833 ງານ** ມີ complain_finish ແຕ່ **ບໍ່ມີ** ແຖວ cust_complain ຈັກແຖວ
     * (ຕໍ່ 967 ງານທີ່ມີຄົບທັງສອງ) — ເປັນຮູບແບບສ່ວນໃຫຍ່ຂອງຂໍ້ມູນເກົ່າຈາກ ods.
     * ⇒ ດ່ານປ່ອຍໃຫ້ຟອມສະແດງ (ລະຫັດ INST-xxxx ເປັນເລກລຽງ ເດົາໄດ້) ແລ້ວພໍກົດສົ່ງ
     * saveFeedback ປະຕິເສດ ແຕ່ຄືນຂໍ້ຄວາມຜິດວ່າ "ຍັງບໍ່ທັນຕິດຕັ້ງສຳເລັດ".
     * ດຽວນີ້ໃຊ້ຫຼັກດຽວກັນທັງສອງບ່ອນ ຈຶ່ງບໍ່ຫຼົ້ນກັນອີກ.
     */
    `select a.cancel_date is not null as cancelled, a.finish_install is not null as finished,
        a.qc_finish is not null as qc_passed,
        (a.complain_finish is not null
         or exists (select 1 from cust_complain c where c.product_code=a.code and c.topic_code='002')) as answered
     from ods_tb_install a where a.code=$1 limit 1`,
    [code],
  );
  const row = job.rows[0];
  if (!row) return { ok: false, message: "ບໍ່ພົບງານຕິດຕັ້ງນີ້" };
  if (row.answered) return { ok: false, message: "ຕອບແບບສອບຖາມນີ້ແລ້ວ" };
  if (row.cancelled) return { ok: false, message: "ງານຕິດຕັ້ງນີ້ຖືກຍົກເລີກແລ້ວ ຈຶ່ງຕອບແບບສອບຖາມບໍ່ໄດ້" };
  if (!row.finished) return { ok: false, message: FEEDBACK_NOT_INSTALLED };
  // ດ່ານ QC — ຍັງບໍ່ຜ່ານການກວດຮັບ ຈຶ່ງຍັງບໍ່ຄວນຖາມລູກຄ້າ
  if (!row.qc_passed) return { ok: false, message: FEEDBACK_NOT_QC };
  return { ok: true };
}

/**
 * ບັນທຶກແບບສອບຖາມ (save_cust_complain / save_cust_complain_new).
 *
 * BUG ໃນ ods: save_cust_complain_new ອັບເດດພຽງ complain_cust ເທົ່ານັ້ນ —
 * ບໍ່ໄດ້ stamp complain_finish ແລະ complain_status ຄືສະບັບເກົ່າ ⇒ ງານທີ່ລູກຄ້າ
 * ຕອບແບບສອບຖາມແລ້ວກໍບໍ່ເຄີຍໄປຮອດ "ລໍຖ້າປິດງານ" ຈຶ່ງປິດງານບໍ່ໄດ້ຈັກເທື່ອ.
 * ບ່ອນນີ້ແກ້ແລ້ວ: stamp ທັງ complain_finish ແລະ complain_status=1.
 *
 * ກົດເກນ (B1): ຮັບຄຳຕອບໄດ້ **ສະເພາະ** ງານທີ່ finish_install is not null ແລະ ບໍ່ຖືກຍົກເລີກ.
 * ກວດຢູ່ຝັ່ງ server ທັງໃນ transaction (where finish_install is not null and cancel_date is null)
 * ຈຶ່ງແຂ່ງກັນ (race) ບໍ່ໄດ້.
 */
export async function saveFeedback(_: ActionState, formData: FormData): Promise<ActionState> {
  if (!db) return { error: "ບໍ່ພົບ DATABASE_URL" };
  const code = String(formData.get("code") ?? "");
  // ໜ້າສາທາລະນະ (ລູກຄ້າສະແກນ QR) ⇒ ຕັດຄວາມຍາວຄືກັນກັບ updateFeedback (2000)
  const comment = String(formData.get("cust_complain") ?? "").slice(0, 2000);
  if (!code) return { error: "ບໍ່ພົບລະຫັດງານ" };

  const answers: { line: number; points: number }[] = [];
  for (const [key, value] of formData.entries()) {
    const match = key.match(/^points_(\d+)$/);
    if (!match) continue;
    const points = Number(value);
    if (!Number.isInteger(points) || points < 1 || points > 4) return { error: "ຄະແນນບໍ່ຖືກຕ້ອງ" };
    answers.push({ line: Number(match[1]), points });
  }
  if (answers.length === 0) return { error: "ກະລຸນາຕອບທຸກຂໍ້" };

  const gate = await feedbackGate(code);
  if (!gate.ok) return { error: gate.message };

  const client = await db.connect();
  try {
    await client.query("begin");
    // ຫຼັກ "ຕອບແລ້ວ" ອັນດຽວກັນກັບ feedbackGate (complain_finish ຫຼື ມີແຖວຄະແນນ)
    const done = await client.query<{ answered: boolean }>(
      `select (a.complain_finish is not null
          or exists (select 1 from cust_complain c where c.product_code=a.code and c.topic_code='002')) as answered
        from ods_tb_install a where a.code=$1 for update`,
      [code],
    );
    const state = done.rows[0];
    if (!state) {
      await client.query("rollback");
      return { error: "ບໍ່ພົບງານຕິດຕັ້ງນີ້" };
    }
    if (state.answered) {
      await client.query("rollback");
      return { error: "ຕອບແບບສອບຖາມນີ້ແລ້ວ" };
    }
    // FIX: ods ລືມ stamp complain_finish/complain_status ໃນສະບັບໃໝ່
    // ເງື່ອນໄຂ finish_install/cancel_date ຢູ່ໃນ WHERE ເອງ ⇒ ກັນການແຂ່ງກັນ (ຍົກເລີກລະຫວ່າງທາງ)
    const stamped = await client.query(
      `update ods_tb_install set complain_status=1, complain_cust=$1, complain_finish=localtimestamp(0)
       where code=$2 and complain_finish is null and finish_install is not null
         and qc_finish is not null and cancel_date is null`,
      [comment, code],
    );
    if (!stamped.rowCount) {
      await client.query("rollback");
      return { error: FEEDBACK_NOT_INSTALLED };
    }
    for (const answer of answers) {
      await client.query(
        "insert into cust_complain(product_code,topic_code,line_number,points) values($1,'002',$2,$3)",
        [code, answer.line, answer.points],
      );
    }
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    console.error("saveFeedback failed", error);
    return { error: "ບັນທຶກບໍ່ສຳເລັດ" };
  } finally {
    client.release();
  }

  // ລູກຄ້າຕອບເອງ (ບໍ່ໄດ້ login) → logChange ຈະລົງຊື່ຜູ້ຂຽນເປັນ "ລະບົບ"
  const average = answers.reduce((sum, row) => sum + row.points, 0) / answers.length;
  await logChange(
    "ods_tb_install",
    code,
    `ລູກຄ້າຕອບແບບສອບຖາມ: ${average.toFixed(1)}/4${comment.trim() ? ` · ${comment.trim()}` : ""}`,
    { author: "ລູກຄ້າ" },
  );

  revalidateAll();
  redirect(`/feedback/${encodeURIComponent(code)}?done=1`);
}

/**
 * ແກ້ໄຂແບບສອບຖາມທີ່ສົ່ງແລ້ວ (ods: save_cust_complain_new — install_admin.py:1425).
 *
 * ໃນ ods ເສັ້ນທາງນີ້ຮຽກຮ້ອງ login (ພະນັກງານແກ້ໃຫ້ລູກຄ້າ) ແລະ ອັບເດດພຽງ complain_cust
 * ໂດຍ insert ຄະແນນຊ້ຳເຂົ້າໄປອີກ ⇒ ໄດ້ຄະແນນຊ້ຳສອງເທື່ອຕໍ່ຂໍ້ ຖ້າແກ້ຫຼາຍເທື່ອ.
 * ບ່ອນນີ້: update ຄະແນນເກົ່າ (ຫຼື insert ຖ້າຍັງບໍ່ມີຂໍ້ນັ້ນ) ຈຶ່ງບໍ່ຊ້ຳ
 * ແລະ ຮັກສາ complain_finish/complain_status ທີ່ saveFeedback stamp ໄວ້ (ບໍ່ລຶບ, ບໍ່ stamp ຄືນ).
 * ຖ້າແຖວນັ້ນຍັງບໍ່ມີ complain_finish (ຂໍ້ມູນເກົ່າຈາກ ods) → stamp ໃຫ້ ເພື່ອໃຫ້ປິດງານໄດ້.
 */
const feedbackEditSchema = z.object({
  code: z.string().min(1),
  cust_complain: z.string().max(2000),
});

export async function updateFeedback(_: ActionState, formData: FormData): Promise<ActionState> {
  // ພະນັກງານແກ້/ຕອບແທນລູກຄ້າ (ປຸ່ມຢູ່ /installations/close) ⇒ ຝ່າຍບໍລິການ.
  // ໝາຍເຫດ: saveFeedback ຂ້າງເທິງເປັນ **ສາທາລະນະ** ໂດຍເຈດຕະນາ (ລູກຄ້າບໍ່ມີບັນຊີ) —
  // ດ່ານຂອງມັນຄື feedbackGate ບໍ່ແມ່ນ role.
  const guard = await requireRole(SERVICE_SIDE, "ບໍ່ມີສິດແກ້ໄຂແບບສອບຖາມ");
  if (!guard.ok) return { error: guard.error };
  if (!db) return { error: "ບໍ່ພົບ DATABASE_URL" };

  const parsed = feedbackEditSchema.safeParse({
    code: formData.get("code") ?? "",
    cust_complain: String(formData.get("cust_complain") ?? ""),
  });
  if (!parsed.success) return { error: "ຂໍ້ມູນບໍ່ຖືກຕ້ອງ" };
  const { code, cust_complain: comment } = parsed.data;

  const answer = z.object({ line: z.number().int().positive(), points: z.number().int().min(1).max(4) });
  const answers: z.infer<typeof answer>[] = [];
  for (const [key, value] of formData.entries()) {
    const match = key.match(/^points_(\d+)$/);
    if (!match) continue;
    const row = answer.safeParse({ line: Number(match[1]), points: Number(value) });
    if (!row.success) return { error: "ຄະແນນບໍ່ຖືກຕ້ອງ" };
    answers.push(row.data);
  }
  if (answers.length === 0) return { error: "ກະລຸນາຕອບທຸກຂໍ້" };

  const client = await db.connect();
  try {
    await client.query("begin");
    // ຄືກັບ saveFeedback: ແກ້ຄຳຕອບໄດ້ສະເພາະງານທີ່ຕິດຕັ້ງແລ້ວຈິງ ແລະ ບໍ່ຖືກຍົກເລີກ (B1)
    const job = await client.query<{ code: string }>(
      `select code from ods_tb_install
       where code=$1 and cancel_date is null and finish_install is not null for update`,
      [code],
    );
    if (!job.rows[0]) {
      await client.query("rollback");
      return { error: "ບໍ່ພົບງານນີ້ ຫຼື ງານຍັງບໍ່ທັນຕິດຕັ້ງສຳເລັດ" };
    }

    await client.query(
      `update ods_tb_install
       set complain_cust=$1, complain_status=1,
           complain_finish=coalesce(complain_finish, localtimestamp(0))
       where code=$2`,
      [comment, code],
    );

    for (const row of answers) {
      const updated = await client.query(
        "update cust_complain set points=$1 where product_code=$2 and topic_code='002' and line_number=$3",
        [row.points, code, row.line],
      );
      if (updated.rowCount === 0) {
        await client.query(
          "insert into cust_complain(product_code,topic_code,line_number,points) values($1,'002',$2,$3)",
          [code, row.line, row.points],
        );
      }
    }
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    console.error("updateFeedback failed", error);
    return { error: "ບັນທຶກບໍ່ສຳເລັດ" };
  } finally {
    client.release();
  }

  const average = answers.reduce((sum, row) => sum + row.points, 0) / answers.length;
  await logChange("ods_tb_install", code, `ແກ້ໄຂແບບສອບຖາມລູກຄ້າ: ${average.toFixed(1)}/4`);

  revalidateAll();
  revalidatePath(`/feedback/${code}`);
  return { ok: "ບັນທຶກສຳເລັດ" };
}
