"use server";
import { logChange } from "@/lib/chatter-log";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/guard";
import { AUDIT_CAUSES, AUDIT_CAUSE_LABEL } from "@/lib/repair-audit-check";
import { MONITOR_SIDE } from "@/lib/roles";
import { STAGE_SQL } from "@/lib/stage";
import { UPLOADS_DIR, uploadsWriteDir } from "@/lib/uploads";
import { extname } from "node:path";
import { unlink, writeFile } from "node:fs/promises";
import { revalidatePath } from "next/cache";
import { z } from "zod";

/**
 * **ຄຳຊີ້ແຈງງານສ້ອມທີ່ຜິດປົກກະຕິ** — ໜ້າ /reports/repair-audit.
 *
 * ── ເປັນຫຍັງບໍ່ໃຊ້ chatter ຊື່ໆ ──
 * ຄຳຕອບແບບຂຽນລອຍໃນ chatter **ນັບເປັນຕົວເລກບໍ່ໄດ້** ("ຄ້າງຍ້ອນອາໄຫຼ່ຈັກ %?") ແລະ
 * ຫາບໍ່ພົບເມື່ອຜ່ານໄປເດືອນນຶ່ງ. ບ່ອນນີ້ບັງຄັບ **ໝວດສາເຫດ + ຜູ້ຮັບຜິດຊອບ** ⇒ ສະຫຼຸບໄດ້,
 * ແລະ ຍັງຂຽນ log ລົງ chatter ນຳ ⇒ ຄົນທີ່ເປີດໃບງານກໍ່ເຫັນ (ບໍ່ຕ້ອງເປີດລາຍງານ).
 *
 * ── ສິດ ──
 * `MONITOR_SIDE` (ຜູ້ຈັດການ · ຫົວໜ້າຊ່າງ · ຝ່າຍບໍລິການ) — ຄົນທີ່ຕ້ອງຕອບຄຳຖາມນີ້ຢູ່ແລ້ວ.
 * ຜູ້ຈັດການເປີດເປັນລາຍຄົນເພີ່ມໄດ້ (requirePermission ຮັບ override ຂອງ /reports/repair-audit).
 *
 * ⚠️ ຄຳຊີ້ແຈງ **ບໍ່ຢຸດນາລິກາ KPI ແລະ ບໍ່ຍ້າຍງານອອກຈາກຄິວ** (ຕ່າງຈາກ ods_job_hold) —
 * ບໍ່ດັ່ງນັ້ນການ "ຕອບຄຳຖາມ" ຈະກາຍເປັນເຄື່ອງມືລ້າງຕົວເລກຂອງໂຕເອງ. ຢາກຢຸດນາລິກາ
 * ໃຫ້ໝາຍ "ວຽກມີບັນຫາ" ຢູ່ໜ້າວຽກ (actions/job-hold.ts) ເຊິ່ງເປັນສິດຂອງຫົວໜ້າ.
 */

export type AuditNoteState = { error?: string; ok?: boolean };

const RESOURCE = "/reports/repair-audit";

/** ໄຟລ໌ແນບ — ຫຼັກຖານການຊີ້ແຈງ ບໍ່ແມ່ນຮູບເຄື່ອງ ⇒ ຮັບ pdf ນຳ (ໃບສະເໜີ/ອີເມວ supplier) */
const ALLOWED_EXT = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif", ".pdf"]);
const MAX_BYTES = 16 * 1024 * 1024;
const MAX_FILES = 5;

const noteSchema = z.object({
  job_code: z.string().trim().min(1, "ບໍ່ພົບລະຫັດງານ"),
  cause: z.string().trim().refine((value) => AUDIT_CAUSES.includes(value), "ກະລຸນາເລືອກໝວດສາເຫດ"),
  reason: z.string().trim().min(5, "ກະລຸນາອະທິບາຍສາເຫດ (ຢ່າງໜ້ອຍ 5 ຕົວອັກສອນ)").max(2000, "ຄຳຊີ້ແຈງຍາວເກີນໄປ"),
  owner_dept: z.string().trim().max(60, "ຊື່ຝ່າຍຍາວເກີນໄປ"),
  owner_person: z.string().trim().max(100, "ຊື່ຜູ້ຮັບຜິດຊອບຍາວເກີນໄປ"),
});

/** ຊື່ໄຟລ໌ປອດໄພ — ຄື secureFilename ຂອງ lib/uploads (ບໍ່ export ອອກມາ) */
function safeName(name: string) {
  const cleaned = name
    .normalize("NFKD")
    .replace(/[^\w.-]+/g, "_")
    .replace(/^[._]+/, "")
    .slice(-120);
  return cleaned || "file";
}

/**
 * ບັນທຶກ/ແກ້ ຄຳຊີ້ແຈງຂອງງານໜຶ່ງໃບ + ແນບໄຟລ໌ເພີ່ມ.
 * ມີບັນທຶກເປີດຢູ່ແລ້ວ ⇒ **ແກ້ອັນນັ້ນ** (index ບາງສ່ວນບັງຄັບ 1 ໃບ = 1 ບັນທຶກເປີດ)
 * ⇒ ຄົນແກ້ຄຳຕອບໄດ້ໂດຍບໍ່ຕ້ອງລຶບ ແລະ ບໍ່ເກີດແຖວຄູ່.
 */
export async function saveAuditNote(_: AuditNoteState, formData: FormData): Promise<AuditNoteState> {
  const guard = await requirePermission(RESOURCE, "update", MONITOR_SIDE, "ບໍ່ມີສິດບັນທຶກຄຳຊີ້ແຈງ");
  if (!guard.ok) return { error: guard.error };
  if (!db) return { error: "ບໍ່ພົບ DATABASE_URL" };

  const parsed = noteSchema.safeParse({
    job_code: String(formData.get("job_code") ?? ""),
    cause: String(formData.get("cause") ?? ""),
    reason: String(formData.get("reason") ?? ""),
    owner_dept: String(formData.get("owner_dept") ?? ""),
    owner_person: String(formData.get("owner_person") ?? ""),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "ຂໍ້ມູນບໍ່ຄົບ" };
  const { job_code, cause, reason, owner_dept, owner_person } = parsed.data;

  // ── ອ່ານໄຟລ໌ອອກຈາກຟອມກ່ອນແຕະຖານ ⇒ ໄຟລ໌ຜິດຊະນິດບໍ່ພາໃຫ້ມີແຖວຄ້າງ
  const files = formData.getAll("files").filter((item): item is File => item instanceof File && item.size > 0);
  if (files.length > MAX_FILES) return { error: `ແນບໄດ້ສູງສຸດ ${MAX_FILES} ໄຟລ໌ຕໍ່ຄັ້ງ` };
  const uploads: { name: string; ext: string; bytes: Buffer }[] = [];
  for (const [index, file] of files.entries()) {
    const name = safeName(file.name);
    const ext = extname(name).toLowerCase();
    if (!ALLOWED_EXT.has(ext)) return { error: `ໄຟລ໌ທີ ${index + 1} ຕ້ອງເປັນຮູບ ຫຼື PDF` };
    if (file.size > MAX_BYTES) return { error: `ໄຟລ໌ທີ ${index + 1} ໃຫຍ່ເກີນ 16MB` };
    uploads.push({ name, ext, bytes: Buffer.from(await file.arrayBuffer()) });
  }
  if (uploads.length && !UPLOADS_DIR) return { error: "ບໍ່ໄດ້ຕັ້ງຄ່າ ODS_UPLOADS_DIR — ແນບໄຟລ໌ບໍ່ໄດ້" };

  const written: string[] = [];
  const client = await db.connect();
  try {
    await client.query("begin");

    // ຂັ້ນປັດຈຸບັນ ຕອນຂຽນ — ເກັບໄວ້ເບິ່ງຍ້ອນຫຼັງ (ງານຈະຍ້າຍຂັ້ນຕໍ່ໄປ)
    const job = (
      await client.query<{ stage: number }>(
        `select (${STAGE_SQL})::int stage from tb_product a where a.code = $1`,
        [job_code],
      )
    ).rows[0];
    if (!job) {
      await client.query("rollback");
      return { error: `ບໍ່ພົບງານ ${job_code}` };
    }

    // id ເປັນ bigserial ⇒ pg ຄືນເປັນ **string** (ບໍ່ແມ່ນ number) — ໃຊ້ເປັນ parameter ຕໍ່ໄດ້ເລີຍ
    const saved = (
      await client.query<{ id: string }>(
        `insert into ods_repair_audit(job_code, stage_at, cause, reason, owner_dept, owner_person, created_by)
         values($1,$2,$3,$4,nullif($5,''),nullif($6,''),$7)
         on conflict (job_code) where resolved_at is null
         do update set cause = excluded.cause, reason = excluded.reason,
                       owner_dept = excluded.owner_dept, owner_person = excluded.owner_person,
                       stage_at = excluded.stage_at, created_by = excluded.created_by,
                       created_at = localtimestamp(0)
         returning id`,
        [job_code, job.stage, cause, reason, owner_dept, owner_person, guard.session.username],
      )
    ).rows[0];

    if (uploads.length) {
      const dir = (await uploadsWriteDir()) ?? UPLOADS_DIR!;
      const offset = (
        await client.query<{ n: number }>(
          `select count(*)::int n from ods_repair_audit_file where audit_id = $1`,
          [saved.id],
        )
      ).rows[0].n;
      for (const [index, upload] of uploads.entries()) {
        const stored = `audit_${saved.id}_${offset + index}${upload.ext}`;
        const path = `${dir}/${stored}`;
        await writeFile(path, upload.bytes);
        written.push(path);
        await client.query(
          `insert into ods_repair_audit_file(audit_id, stored_name, original_name, bytes, uploaded_by)
           values($1,$2,$3,$4,$5)`,
          [saved.id, stored, upload.name, upload.bytes.length, guard.session.username],
        );
      }
    }

    await client.query("commit");
  } catch (error) {
    await client.query("rollback").catch(() => {});
    // ຂຽນໄຟລ໌ໄປແລ້ວແຕ່ຖານລົ້ມ ⇒ ລ້າງໄຟລ໌ຖິ້ມ (ບໍ່ໃຫ້ມີໄຟລ໌ກຳພ້ອຍໃນໂຟນເດີ)
    await Promise.all(written.map((path) => unlink(path).catch(() => {})));
    console.error("saveAuditNote failed", error);
    return { error: "ບັນທຶກບໍ່ສຳເລັດ ກະລຸນາລອງໃໝ່" };
  } finally {
    client.release();
  }

  await logChange(
    "tb_product",
    job_code,
    `ບັນທຶກຄຳຊີ້ແຈງງານຄ້າງ — ${AUDIT_CAUSE_LABEL[cause]}: ${reason}` +
      (owner_dept || owner_person ? ` · ຜູ້ຮັບຜິດຊອບ: ${[owner_dept, owner_person].filter(Boolean).join(" / ")}` : "") +
      (uploads.length ? ` · ແນບ ${uploads.length} ໄຟລ໌` : ""),
  );
  revalidatePath(RESOURCE);
  return { ok: true };
}

const resolveSchema = z.object({
  job_code: z.string().trim().min(1, "ບໍ່ພົບລະຫັດງານ"),
  note: z.string().trim().max(500, "ໝາຍເຫດຍາວເກີນໄປ"),
});

/**
 * ປິດບັນທຶກ — ບັນຫາຖືກແກ້ແລ້ວ. **ບໍ່ລຶບ** (ປະຫວັດຄືຫຼັກຖານ): ແຖວຍັງຢູ່ ພຽງແຕ່ບໍ່ນັບ
 * ເປັນ "ບັນທຶກເປີດ" ອີກ ⇒ ໃບນັ້ນກັບໄປຢູ່ກຸ່ມ "ຍັງບໍ່ມີໃຜຊີ້ແຈງ" ຖ້າມັນຍັງຜິດປົກກະຕິຢູ່.
 */
export async function resolveAuditNote(_: AuditNoteState, formData: FormData): Promise<AuditNoteState> {
  const guard = await requirePermission(RESOURCE, "update", MONITOR_SIDE, "ບໍ່ມີສິດປິດບັນທຶກ");
  if (!guard.ok) return { error: guard.error };
  if (!db) return { error: "ບໍ່ພົບ DATABASE_URL" };

  const parsed = resolveSchema.safeParse({
    job_code: String(formData.get("job_code") ?? ""),
    note: String(formData.get("note") ?? ""),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "ຂໍ້ມູນບໍ່ຄົບ" };
  const { job_code, note } = parsed.data;

  try {
    const done = await db.query(
      `update ods_repair_audit
          set resolved_at = localtimestamp(0), resolved_by = $2, resolved_note = nullif($3,'')
        where job_code = $1 and resolved_at is null`,
      [job_code, guard.session.username, note],
    );
    if (!done.rowCount) return { error: `ງານ ${job_code} ບໍ່ມີບັນທຶກທີ່ເປີດຢູ່` };
  } catch (error) {
    console.error("resolveAuditNote failed", error);
    return { error: "ປິດບັນທຶກບໍ່ສຳເລັດ ກະລຸນາລອງໃໝ່" };
  }

  await logChange("tb_product", job_code, `ປິດບັນທຶກຄຳຊີ້ແຈງງານຄ້າງ${note ? ` — ${note}` : ""}`);
  revalidatePath(RESOURCE);
  return { ok: true };
}
