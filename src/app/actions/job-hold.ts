"use server";
import { logChange } from "@/lib/chatter-log";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/guard";
import { HOLD_KINDS, HOLD_KIND_LABEL, type HoldWorkflow } from "@/lib/job-hold";
import { APPROVER_SIDE } from "@/lib/roles";
import { SETTING, settingEnabled } from "@/lib/settings";
import { STAGE_SQL } from "@/lib/stage";
import { revalidatePath } from "next/cache";
import { z } from "zod";

/**
 * **ໝາຍ / ປົດ ທຸງ "ວຽກມີບັນຫາ"** — ວຽກຄາຢູ່ຂັ້ນດຽວດ້ວຍເຫດຜົນທີ່ຄິວແກ້ບໍ່ໄດ້.
 *
 * ── ທຸງເຮັດຫຍັງ ──
 * ① ຄິວແຍກມັນໄປແທັບ "ມີບັນຫາ" ⇒ ລາຍການຫຼັກເຫຼືອແຕ່ວຽກທີ່ເຮັດໄດ້ແທ້
 * ② ນາລິກາຂັ້ນຢຸດ (STAGE_ELAPSED_SQL) ⇒ ຕົວເລກຄໍຂວດບໍ່ຖືກວຽກລໍອາໄຫຼ່ນອກກົບໄວ້
 * ທຸງ **ບໍ່**ປ່ຽນຂັ້ນ ແລະ **ບໍ່**ເອົາວຽກອອກຈາກ "ວຽກຄ້າງ" — ເບິ່ງເຫດຜົນຢູ່ job-hold.ts.
 *
 * ── ສິດ ──
 * ໝາຍ/ປົດ ໄດ້ສະເພາະ **ຫົວໜ້າ/ຜູ້ມີສິດອະນຸມັດ** (APPROVER_SIDE): ທຸງນີ້ຢຸດນາລິກາ KPI
 * ⇒ ຖ້າໃຜກໍ່ໝາຍໄດ້ ມັນຈະກາຍເປັນບ່ອນລີ້ຄວາມຊັກຊ້າ ບໍ່ແມ່ນເຄື່ອງມືເບິ່ງບັນຫາ.
 */

export type HoldState = { error?: string; ok?: boolean };

const WORKFLOWS = ["repair", "install"] as const;
const jobModel = (workflow: HoldWorkflow) => (workflow === "install" ? "ods_tb_install" : "tb_product");

const holdSchema = z.object({
  workflow: z.enum(WORKFLOWS),
  job_code: z.string().trim().min(1, "ບໍ່ພົບລະຫັດງານ"),
  kind: z.string().trim().refine((v) => HOLD_KINDS.includes(v), "ປະເພດບັນຫາບໍ່ຖືກຕ້ອງ"),
  reason: z.string().trim().min(3, "ກະລຸນາບອກເຫດຜົນ").max(200, "ເຫດຜົນຍາວເກີນ 200 ຕົວອັກສອນ"),
});

/** ໝາຍທຸງ — ງານຕ້ອງມີຈິງ ແລະ ຍັງບໍ່ຈົບ (ໝາຍງານທີ່ສົ່ງຄືນແລ້ວ ບໍ່ມີຄວາມໝາຍ) */
export async function holdJob(_: HoldState, formData: FormData): Promise<HoldState> {
  const guard = await requireRole(APPROVER_SIDE, "ບໍ່ມີສິດໝາຍວຽກມີບັນຫາ");
  if (!guard.ok) return { error: guard.error };
  // ສະວິດປິດ = ປິດແທ້ ບໍ່ແມ່ນພຽງເຊື່ອງປຸ່ມ (ໜ້າເກົ່າຄ້າງໃນ browser ຍັງຍິງມາໄດ້)
  if (!(await settingEnabled(SETTING.JOB_HOLD))) {
    return { error: "ຄວາມສາມາດ “ໝາຍວຽກມີບັນຫາ” ຖືກປິດຢູ່ (ຜູ້ຈັດການເປີດໄດ້ທີ່ ການຕັ້ງຄ່າລະບົບ)" };
  }
  if (!db) return { error: "ບໍ່ພົບ DATABASE_URL" };

  const parsed = holdSchema.safeParse({
    workflow: String(formData.get("workflow") ?? "repair"),
    job_code: String(formData.get("job_code") ?? ""),
    kind: String(formData.get("kind") ?? "other"),
    reason: String(formData.get("reason") ?? ""),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "ຂໍ້ມູນບໍ່ຄົບ" };
  const { workflow, job_code, kind, reason } = parsed.data;

  try {
    /**
     * ຂັ້ນຕອນຕອນຖືກໝາຍ — ເກັບໄວ້ເບິ່ງຍ້ອນຫຼັງ (ບໍ່ໄດ້ໃຊ້ຄິດຂັ້ນ).
     * ສະເພາະງານສ້ອມ: STAGE_SQL ອ່ານ tb_product ⇒ ງານຕິດຕັ້ງບໍ່ມີ ໃສ່ null.
     */
    const job =
      workflow === "repair"
        ? (
            await db.query<{ stage: number }>(
              `select (${STAGE_SQL}) stage from tb_product a where a.code = $1 and a.return_complete is null`,
              [job_code],
            )
          ).rows[0]
        : (await db.query(`select 1 from ods_tb_install a where a.code = $1`, [job_code])).rows[0]
          ? { stage: null as number | null }
          : undefined;
    if (!job) return { error: `ບໍ່ພົບງານ ${job_code} ຫຼື ງານຈົບໄປແລ້ວ` };

    // index ບາງສ່ວນ ods_job_hold_open ບັງຄັບ 1 ງານ = 1 ທຸງເປີດ ⇒ ຊ້ຳຈະບໍ່ເຂົ້າ
    const done = await db.query(
      `insert into ods_job_hold(workflow, job_code, kind, reason, stage_at, created_by)
       values($1,$2,$3,$4,$5,$6)
       on conflict do nothing`,
      [workflow, job_code, kind, reason, job.stage, guard.session.username],
    );
    if (!done.rowCount) return { error: `ງານ ${job_code} ຖືກໝາຍວ່າມີບັນຫາຢູ່ແລ້ວ` };
  } catch (error) {
    console.error("holdJob failed", error);
    return { error: "ໝາຍບໍ່ສຳເລັດ ກະລຸນາລອງໃໝ່" };
  }

  await logChange(
    jobModel(workflow),
    job_code,
    `ໝາຍວ່າມີບັນຫາ — ${HOLD_KIND_LABEL[kind] ?? kind}: ${reason} (ນາລິກາຂັ້ນຢຸດນັບ)`,
  );
  revalidateJobViews();
  return { ok: true };
}

const releaseSchema = z.object({
  workflow: z.enum(WORKFLOWS),
  job_code: z.string().trim().min(1, "ບໍ່ພົບລະຫັດງານ"),
  note: z.string().trim().max(200, "ໝາຍເຫດຍາວເກີນ 200 ຕົວອັກສອນ"),
});

/**
 * ປົດທຸງ — ວຽກກັບເຂົ້າຄິວປົກກະຕິ ແລະ **ນາລິກາເດີນຕໍ່ຈາກຈຸດທີ່ຢຸດ**
 * (ບໍ່ແມ່ນເລີ່ມນັບໃໝ່ — ເວລາທີ່ຄາກ່ອນໝາຍທຸງ ຍັງເປັນຄວາມຈິງຢູ່).
 *
 * ⚙️ **ບໍ່ກວດສະວິດ** ຕ່າງຈາກ `holdJob`: ການປົດຄືການ**ເກັບກວາດ** ⇒ ຫ້າມບໍ່ໄດ້.
 * ຖ້າສະວິດຖືກປິດຕອນມີທຸງຄ້າງ ຕ້ອງຍັງລ້າງມັນອອກໄດ້ສະເໝີ.
 */
export async function releaseJobHold(_: HoldState, formData: FormData): Promise<HoldState> {
  const guard = await requireRole(APPROVER_SIDE, "ບໍ່ມີສິດປົດທຸງວຽກມີບັນຫາ");
  if (!guard.ok) return { error: guard.error };
  if (!db) return { error: "ບໍ່ພົບ DATABASE_URL" };

  const parsed = releaseSchema.safeParse({
    workflow: String(formData.get("workflow") ?? "repair"),
    job_code: String(formData.get("job_code") ?? ""),
    note: String(formData.get("note") ?? ""),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "ຂໍ້ມູນບໍ່ຄົບ" };
  const { workflow, job_code, note } = parsed.data;

  try {
    const done = await db.query(
      `update ods_job_hold set resolved_at = localtimestamp(0), resolved_by = $3, resolved_note = nullif($4,'')
        where workflow = $1 and job_code = $2 and resolved_at is null`,
      [workflow, job_code, guard.session.username, note],
    );
    if (!done.rowCount) return { error: `ງານ ${job_code} ບໍ່ມີທຸງເປີດຢູ່` };
  } catch (error) {
    console.error("releaseJobHold failed", error);
    return { error: "ປົດທຸງບໍ່ສຳເລັດ ກະລຸນາລອງໃໝ່" };
  }

  await logChange(
    jobModel(workflow),
    job_code,
    `ປົດທຸງ "ມີບັນຫາ" — ກັບເຂົ້າຄິວປົກກະຕິ ນາລິກາເດີນຕໍ່${note ? ` · ${note}` : ""}`,
  );
  revalidateJobViews();
  return { ok: true };
}

const repairedSchema = z.object({
  job_code: z.string().trim().min(1, "ບໍ່ພົບລະຫັດງານ"),
  note: z.string().trim().min(3, "ກະລຸນາບອກເຫດຜົນ").max(200, "ເຫດຜົນຍາວເກີນ 200 ຕົວອັກສອນ"),
});

/**
 * **"ແປງແລ້ວ" — ໝາຍວ່າສ້ອມສຳເລັດ (ຫົວໜ້າ override)** ສຳລັບວຽກຄ້າງ.
 *
 * ── ຕ່າງຈາກ finishRepairFlow ແນວໃດ ──
 * `finishRepairFlow` ບັງຄັບຢູ່ຂັ້ນ 9 (ກຳລັງສ້ອມ) + ກັນອາໄຫຼ່ຄ້າງ ⇒ ໃຊ້ກັບວຽກຄ້າງ
 * ຂັ້ນ 6 (ລໍເບີກ 100+ ມື້) ບໍ່ໄດ້. ອັນນີ້ຄື **ທາງລັດຂອງຫົວໜ້າ**: ເຄື່ອງຖືກສ້ອມ/ຈັດການ
 * ໄປແລ້ວຈິງ ແຕ່ລະບົບຄ້າງ ⇒ ປິດ. ຕັ້ງ time_finish_repair+status=5 ⇒ ວຽກໄປ **ຂັ້ນ QC/ສົ່ງຄືນ**
 * (ບໍ່ໄດ້ຂ້າມ QC ກັບການສົ່ງຄືນ — ຍັງຕ້ອງຜ່ານ). ບໍ່ແມ່ນວຽກປົກກະຕິ ⇒ **ຫົວໜ້າເທົ່ານັ້ນ** + ບັງຄັບເຫດຜົນ.
 *
 * ປົດ hold ທີ່ເປີດຢູ່ໃຫ້ເອງ (ວຽກຈົບການແປງແລ້ວ ບໍ່ຕ້ອງມີທຸງ "ຕ້ອງກວດ" ອີກ).
 */
export async function markJobRepaired(_: HoldState, formData: FormData): Promise<HoldState> {
  const guard = await requireRole(APPROVER_SIDE, "ບໍ່ມີສິດໝາຍວ່າສ້ອມສຳເລັດ");
  if (!guard.ok) return { error: guard.error };
  if (!db) return { error: "ບໍ່ພົບ DATABASE_URL" };

  const parsed = repairedSchema.safeParse({
    job_code: String(formData.get("job_code") ?? ""),
    note: String(formData.get("note") ?? ""),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "ຂໍ້ມູນບໍ່ຄົບ" };
  const { job_code, note } = parsed.data;

  try {
    // ຍັງບໍ່ຈົບ (time_finish_repair null) · ບໍ່ຖືກຍົກເລີກ · ເຄື່ອງຍັງບໍ່ສົ່ງຄືນ ⇒ ຈຶ່ງໝາຍໄດ້
    const done = await db.query(
      `update tb_product set time_finish_repair = localtimestamp(0), status = 5, repair_note = nullif($2,'')
        where code = $1 and time_finish_repair is null and status <> 6 and return_complete is null`,
      [job_code, note],
    );
    if (!done.rowCount) return { error: `ງານ ${job_code} ໝາຍບໍ່ໄດ້ — ອາດຈົບ/ຍົກເລີກ/ສົ່ງຄືນໄປແລ້ວ` };
    // ວຽກຈົບການແປງແລ້ວ ⇒ ປົດ hold "ຕ້ອງກວດ" ທີ່ອາດຄ້າງ (ບໍ່ໃຫ້ຄາຢູ່ແທັບ)
    await db.query(
      `update ods_job_hold set resolved_at = localtimestamp(0), resolved_by = $2, resolved_note = 'ໝາຍວ່າສ້ອມສຳເລັດ'
        where workflow = 'repair' and job_code = $1 and resolved_at is null`,
      [job_code, guard.session.username],
    );
  } catch (error) {
    console.error("markJobRepaired failed", error);
    return { error: "ໝາຍບໍ່ສຳເລັດ ກະລຸນາລອງໃໝ່" };
  }

  await logChange("tb_product", job_code,
    `ໝາຍວ່າ "ແປງແລ້ວ" (ຫົວໜ້າ override ວຽກຄ້າງ) — ${note} · ວຽກໄປຂັ້ນ QC/ສົ່ງຄືນ`);
  revalidateJobViews();
  return { ok: true };
}

/**
 * ໜ້າທີ່ນັບ/ສະແດງວຽກຄ້າງ — ທຸງປ່ຽນທັງຕົວເລກ ແລະ ແທັບ ⇒ ຕ້ອງ revalidate ພ້ອມ.
 * ໜ້າຂັ້ນຕອນເປັນ route ແບບ dynamic ⇒ ຕ້ອງສົ່ງ**ຮູບແບບ route** + type 'page'
 * (`/dashboard/status/repair` ບໍ່ແມ່ນ path ທີ່ມີຈິງ ⇒ revalidate ບໍ່ຕິດ).
 */
function revalidateJobViews() {
  revalidatePath("/dashboard");
  revalidatePath("/(app)/dashboard/status/[workflow]/[status]", "page");
  revalidatePath("/service");
  revalidatePath("/repair");
}
