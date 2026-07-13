import { logChange } from "@/app/actions/chatter";
import type { Session } from "@/lib/auth";
import type { Workflow } from "@/lib/commission";
import { query } from "@/lib/db";
import { db } from "@/lib/db";
import { roleOf } from "@/lib/roles";
import { INSTALL_STAGE_SQL } from "@/lib/install-stage";
import { STAGE_SQL } from "@/lib/stage";
import type { PoolClient } from "pg";

/**
 * ຂັ້ນຕອນທີ່ **ຊ່າງ** ລົງມື — ໃຊ້ຮ່ວມກັນລະຫວ່າງ ເວັບ (server actions) ແລະ
 * ແອັບມືຖື (/api/mobile/*).
 *
 * ── ເປັນຫຍັງຕ້ອງຢູ່ບ່ອນດຽວ ──
 * ທຸກການປ່ຽນຂັ້ນ **ໃສ່ເງື່ອນໄຂຂັ້ນໄວ້ໃນ WHERE ເອງ** (ບໍ່ແມ່ນກວດກ່ອນແລ້ວຄ່ອຍ update)
 * ⇒ ຍິງຄຳສັ່ງໃສ່ວຽກທີ່ບໍ່ໄດ້ຢູ່ຂັ້ນນັ້ນ = ບໍ່ມີຫຍັງເກີດຂຶ້ນ ແລະ ສອງຄົນກົດພ້ອມກັນກໍ່ບໍ່ຊ້ຳ.
 * ຖ້າແອັບມືຖືຂຽນ SQL ຂອງຕົນເອງ ມື້ໜຶ່ງມັນຈະຂາດເງື່ອນໄຂໃດເງື່ອນໄຂນຶ່ງ ແລ້ວແອັບຈະ
 * ພາວຽກໂດດຂ້າມຂັ້ນ (ເຊັ່ນ ສ້ອມສຳເລັດ ໂດຍບໍ່ເຄີຍເບີກອາໄຫຼ່) ໂດຍບໍ່ມີ error ຈັກຂໍ້.
 */

export type FlowResult = { ok: true; message: string } | { ok: false; error: string };

const NOW = "localtimestamp(0)";

/* ── ເປັນວຽກຂອງຊ່າງຄົນນີ້ບໍ ────────────────────────────────────── */

export type JobOwner = {
  code: string;
  tech: string | null;
  cancelled: boolean;
  accepted: boolean;
  onsite: boolean;
  stage: number;
};

async function ownerOf(workflow: Workflow, code: string): Promise<JobOwner | null> {
  const rows =
    workflow === "install"
      ? await query<JobOwner>(
          `select code, nullif(tech_code,'') as tech, cancel_date is not null as cancelled,
                  tech_confirm is not null as accepted, true as onsite,
                  (${INSTALL_STAGE_SQL})::int as stage
             from ods_tb_install a where a.code=$1`,
          [code],
        )
      : await query<JobOwner>(
          `select code, nullif(emp_code,'') as tech, status = 6 as cancelled,
                  repair_confirm is not null as accepted,
                  coalesce(service_type,'') in ('IH','PS') as onsite,
                  (${STAGE_SQL})::int as stage
             from tb_product a where a.code=$1`,
          [code],
        );
  return rows.rows[0] ?? null;
}

/**
 * ຊ່າງແຕະໄດ້ແຕ່ວຽກຂອງຕົນ — ຄືກົດເກນຂອງເວັບ (guardJob ໃນ actions/installation
 * ແລະ loadJob ໃນ actions/repair). ຫົວໜ້າຊ່າງ/ຜູ້ຈັດການ ແຕະໄດ້ໝົດ.
 */
export async function ownJob(session: Session, workflow: Workflow, code: string): Promise<FlowResult & { job?: JobOwner }> {
  const job = await ownerOf(workflow, code);
  if (!job) return { ok: false, error: "ບໍ່ພົບງານນີ້" };
  if (job.cancelled) return { ok: false, error: "ງານນີ້ຖືກຍົກເລີກແລ້ວ" };
  if (roleOf(session) === "technical" && (job.tech ?? "") !== session.username) {
    return { ok: false, error: "ງານນີ້ບໍ່ແມ່ນຂອງທ່ານ" };
  }
  return { ok: true, message: "", job };
}

/**
 * Mobile ເປັນພື້ນທີ່ລົງມືຂອງຜູ້ຮັບງານ, ບໍ່ແມ່ນໜ້າຄຸ້ມຄອງ.
 * ຈຶ່ງບັງຄັບ ownership ທຸກ role; ສິດຫົວໜ້າທີ່ເຮັດງານຂອງຄົນອື່ນ
 * ຍັງຄົງໄວ້ສຳລັບ workflow ຝັ່ງ web ຜ່ານ ownJob ຕາມເດີມ.
 */
export async function ownMobileJob(session: Session, workflow: Workflow, code: string): Promise<FlowResult> {
  const job = await ownerOf(workflow, code);
  if (!job) return { ok: false, error: "ບໍ່ພົບງານນີ້" };
  if (job.cancelled) return { ok: false, error: "ງານນີ້ຖືກຍົກເລີກແລ້ວ" };
  if ((job.tech ?? "") !== session.username) {
    return { ok: false, error: "ງານນີ້ບໍ່ແມ່ນວຽກທີ່ມອບໝາຍໃຫ້ທ່ານ" };
  }
  return { ok: true, message: "" };
}

/* ── ຮັບງານ / ປະຕິເສດງານ ───────────────────────────────────────── */

export async function acceptInstall(session: Session, code: string): Promise<FlowResult> {
  const own = await ownJob(session, "install", code);
  if (!own.ok) return own;

  const done = await query(
    `update ods_tb_install set tech_confirm=${NOW}
      where code=$1 and tech_confirm is null and coalesce(tech_code,'') <> '' and job_finish is null`,
    [code],
  );
  if (!done.rowCount) {
    // ກົດຊ້ຳ (ຫຼື ສອງເຄື່ອງພ້ອມກັນ) ບໍ່ຄວນເປັນ error — ຮັບໄປແລ້ວກໍ່ຖືວ່າສຳເລັດ
    const already = await query<{ n: number }>(
      "select count(*)::int n from ods_tb_install where code=$1 and tech_confirm is not null",
      [code],
    );
    if (already.rows[0]?.n) return { ok: true, message: `ຮັບງານຕິດຕັ້ງ ${code} ສຳເລັດ` };
    return { ok: false, error: "ຮັບງານບໍ່ໄດ້ — ງານນີ້ຍັງບໍ່ມີຊ່າງ ຫຼື ປິດໄປແລ້ວ" };
  }

  await logChange("ods_tb_install", code, "ຊ່າງຮັບງານແລ້ວ");
  return { ok: true, message: `ຮັບງານຕິດຕັ້ງ ${code} ສຳເລັດ` };
}

export async function acceptRepair(session: Session, code: string): Promise<FlowResult> {
  const own = await ownJob(session, "repair", code);
  if (!own.ok) return own;

  const done = await query(
    `update tb_product a set repair_confirm=${NOW}
      where a.code=$1 and repair_confirm is null and (${STAGE_SQL}) = 1`,
    [code],
  );
  if (!done.rowCount) {
    const already = await query<{ n: number }>(
      "select count(*)::int n from tb_product where code=$1 and repair_confirm is not null",
      [code],
    );
    if (already.rows[0]?.n) return { ok: true, message: `ຮັບງານສ້ອມ ${code} ສຳເລັດ` };
    return { ok: false, error: "ຮັບງານບໍ່ໄດ້ — ງານບໍ່ໄດ້ຢູ່ຂັ້ນລໍກວດເຊັກ" };
  }

  await logChange("tb_product", code, "ຊ່າງຮັບງານສ້ອມແລ້ວ");
  return { ok: true, message: `ຮັບງານສ້ອມ ${code} ສຳເລັດ` };
}

/**
 * ປະຕິເສດງານ — ຊ່າງບໍ່ຮັບ ພ້ອມເຫດຜົນ.
 *
 * ງານກັບໄປຄິວ "ລໍຖ້າຈັດຊ່າງ" ຂອງ CS ທັນທີ (ລ້າງຊື່ຊ່າງອອກ) ບໍ່ດັ່ງນັ້ນມັນຈະນອນຢູ່
 * ໃນຄິວ "ລໍຊ່າງຮັບງານ" ຕະຫຼອດການ ໂດຍທີ່ຊ່າງບໍ່ມີວັນກົດຮັບ.
 * ປະຕິເສດຫຼັງ **ຮັບງານແລ້ວ ຫຼື ຂໍເບີກອາໄຫຼ່ແລ້ວ ບໍ່ໄດ້** — ເອກະສານອອກໃນນາມຊ່າງຄົນນັ້ນແລ້ວ.
 */
export async function rejectJob(
  session: Session,
  workflow: Workflow,
  code: string,
  reason: string,
): Promise<FlowResult> {
  const clean = reason.trim();
  if (clean.length < 3) return { ok: false, error: "ກະລຸນາໃສ່ເຫດຜົນທີ່ປະຕິເສດ" };

  const own = await ownJob(session, workflow, code);
  if (!own.ok) return own;
  if (!own.job?.tech) return { ok: false, error: "ງານນີ້ຍັງບໍ່ມີຊ່າງ" };

  const released =
    workflow === "install"
      ? await query(
          `update ods_tb_install set tech_code = null, tech_before = tech_code
            where code = $1 and tech_confirm is null and start_install is null and job_finish is null`,
          [code],
        )
      : await query(
          // ຝັ່ງສ້ອມ: ປະຕິເສດໄດ້ກ່ອນລົງມືກວດເຊັກ/ສ້ອມ (ຂັ້ນ 1 = ລໍຖ້າກວດເຊັກ)
          `update tb_product a set emp_code = '', repair_confirm = null
            where a.code = $1 and repair_confirm is null and (${STAGE_SQL}) = 1`,
          [code],
        );

  if (!released.rowCount) {
    return {
      ok: false,
      error: "ປະຕິເສດບໍ່ໄດ້ — ງານນີ້ຮັບ ຫຼື ເລີ່ມລົງມືໄປແລ້ວ (ຕິດຕໍ່ CS ເພື່ອປ່ຽນຊ່າງ)",
    };
  }

  await query(
    "insert into ods_job_reject(workflow, job_code, tech_code, reason) values($1,$2,$3,$4)",
    [workflow, code, session.username, clean],
  );

  // CS ຕ້ອງຮູ້ທັນທີ — ບໍ່ດັ່ງນັ້ນງານກັບເຂົ້າຄິວແລ້ວກໍ່ນອນຢູ່ບ່ອນນັ້ນຕໍ່
  await logChange(
    workflow === "install" ? "ods_tb_install" : "tb_product",
    code,
    `ຊ່າງ ${session.username} ປະຕິເສດງານ — ${clean} (ງານກັບເຂົ້າຄິວຈັດຊ່າງ)`,
    { roles: ["admin", "manager"] },
  );
  return { ok: true, message: "ປະຕິເສດງານແລ້ວ — ງານກັບໄປຄິວຈັດຊ່າງ" };
}

/* ── ຂັ້ນຕອນຕິດຕັ້ງ ─────────────────────────────────────────────── */

/**
 * ເລີ່ມຕິດຕັ້ງ.
 *
 * ── check-in ບັງຄັບ **ສະເພາະແອັບ** (13-07-2026) ──
 * check-in ຄືຫຼັກຖານວ່າຊ່າງ **ໄປຮອດໜ້າງານຈິງ** (ພິກັດ + ຮູບ) ⇒ ມີຄວາມໝາຍກໍ່ຕໍ່ເມື່ອ
 * ຄົນກົດຄືຊ່າງທີ່ຢູ່ໜ້າງານ = **ແອັບມືຖື**.
 * ຝັ່ງ **ເວັບ** ຄົນທີ່ກົດມັກເປັນ CS/ຫົວໜ້າ ທີ່ນັ່ງຢູ່ຫ້ອງການ (ຊ່າງໂທບອກແລ້ວກົດແທນ)
 * ⇒ ບັງຄັບ check-in ຢູ່ເວັບ = **ງານຕັນ** (ຄົນກົດບໍ່ໄດ້ຢູ່ໜ້າງານ ຈຶ່ງ check-in ບໍ່ໄດ້).
 * ⇒ ເວັບບໍ່ບັງຄັບ · ແອັບບັງຄັບ (ຝັ່ງເອີ້ນເປັນຄົນບອກ ບໍ່ແມ່ນເດົາຢູ່ນີ້).
 */
export async function startInstallFlow(
  session: Session,
  code: string,
  options: { requireCheckin?: boolean } = {},
): Promise<FlowResult> {
  const own = await ownJob(session, "install", code);
  if (!own.ok) return own;

  if (options.requireCheckin) {
    const arrived = await query<{ n: number }>(
      "select count(*)::int n from ods_job_checkin where workflow='install' and job_code=$1 and tech_code=$2",
      [code, session.username],
    );
    if (!arrived.rows[0]?.n) return { ok: false, error: "ຕ້ອງ check-in ໜ້າງານກ່ອນເລີ່ມຕິດຕັ້ງ" };
  }

  const done = await query(
    `update ods_tb_install set start_install=${NOW}
      where code=$1 and start_install is null and tech_confirm is not null and job_finish is null`,
    [code],
  );
  if (!done.rowCount) return { ok: false, error: "ເລີ່ມຕິດຕັ້ງບໍ່ໄດ້ — ຍັງບໍ່ໄດ້ຮັບງານ ຫຼື ເລີ່ມໄປແລ້ວ" };

  await logChange("ods_tb_install", code, "ເລີ່ມຕິດຕັ້ງ");
  return { ok: true, message: `ເລີ່ມຕິດຕັ້ງ ${code}` };
}

/**
 * ຮູບຜົນງານ — **ບັງຄັບຢ່າງໜ້ອຍ 1 ຮູບ ຕອນຈົບງານຕິດຕັ້ງ**.
 *
 * ຮູບ check-in ຄືສະພາບ "ກ່ອນເຮັດ" ແລະ ຮູບ QC ຖ່າຍໂດຍ**ຄົນອື່ນ** ໃນມື້ຕໍ່ມາ
 * ⇒ ບໍ່ມີຫຼັກຖານວ່າຕອນຊ່າງອອກຈາກໜ້າງານ ວຽກຢູ່ໃນສະພາບໃດ. ພໍລູກຄ້າຄ້ານ ຫຼື QC ຕົກ
 * ກໍ່ຖຽງກັນບໍ່ຈົບ. ຝັ່ງສ້ອມ **ບໍ່ບັງຄັບ** (ວຽກສ່ວນຫຼາຍຢູ່ໃນສູນ ແລະ ເຄື່ອງຍັງຢູ່ໃນມືເຮົາ).
 */
async function savePhotos(
  client: PoolClient,
  session: Session,
  workflow: Workflow,
  code: string,
  photos: string[],
  note: string,
): Promise<number> {
  let saved = 0;
  for (const photo of photos) {
    if (!photo) continue;
    await client.query(
      `insert into ods_job_photo(workflow, job_code, kind, photo, note, created_by)
       values($1,$2,'finish',$3,nullif($4,''),$5)`,
      [workflow, code, photo, note, session.username],
    );
    saved += 1;
  }
  return saved;
}

export async function finishInstallFlow(
  session: Session,
  code: string,
  photos: string[] = [],
): Promise<FlowResult> {
  const own = await ownJob(session, "install", code);
  if (!own.ok) return own;

  const clean = photos.filter(Boolean);
  if (clean.length === 0) {
    return { ok: false, error: "ຕ້ອງແນບຮູບຜົນງານຢ່າງໜ້ອຍ 1 ຮູບ ກ່ອນຈົບງານຕິດຕັ້ງ" };
  }

  if (!db) return { ok: false, error: "ບໍ່ພົບ DATABASE_URL" };
  const client = await db.connect();
  let saved = 0;
  try {
    await client.query("begin");
    const done = await client.query(
      `update ods_tb_install set finish_install=${NOW}
        where code=$1 and finish_install is null and start_install is not null`,
      [code],
    );
    if (!done.rowCount) {
      await client.query("rollback");
      return { ok: false, error: "ບັນທຶກບໍ່ໄດ້ — ຍັງບໍ່ໄດ້ເລີ່ມຕິດຕັ້ງ ຫຼື ຈົບໄປແລ້ວ" };
    }
    saved = await savePhotos(client, session, "install", code, clean, "");
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    console.error("finishInstallFlow failed", error);
    return { ok: false, error: "ບັນທຶກຜົນງານບໍ່ສຳເລັດ" };
  } finally {
    client.release();
  }
  await logChange("ods_tb_install", code, `ຕິດຕັ້ງສຳເລັດ · ຮູບຜົນງານ ${saved} ຮູບ — ລໍຖ້າກວດຮັບຄຸນນະພາບ`);
  return { ok: true, message: `ຕິດຕັ້ງ ${code} ສຳເລັດ — ລໍຖ້າ QC` };
}

/** ຮູບຜົນງານຂອງງານ — ໃຊ້ຢູ່ໜ້າ QC ແລະ ໜ້າລາຍລະອຽດ */
export async function jobPhotos(workflow: Workflow, code: string) {
  return (
    await query<{ id: number; photo: string; created_by: string; created_at: string }>(
      `select id, photo, created_by, to_char(created_at,'DD-MM-YYYY HH24:MI') as created_at
         from ods_job_photo
        where workflow=$1 and job_code=$2 and kind='finish'
        order by id`,
      [workflow, code],
    )
  ).rows;
}

/* ── ຂັ້ນຕອນສ້ອມແປງ ─────────────────────────────────────────────── */

/** ເລີ່ມສ້ອມແປງ — check-in ບັງຄັບສະເພາະ **ແອັບ** ແລະ **ງານນອກສະຖານທີ່** (ເບິ່ງ startInstallFlow) */
export async function startRepairFlow(
  session: Session,
  code: string,
  options: { requireCheckin?: boolean } = {},
): Promise<FlowResult> {
  const own = await ownJob(session, "repair", code);
  if (!own.ok) return own;
  if (options.requireCheckin && own.job?.onsite) {
    const arrived = await query<{ n: number }>(
      "select count(*)::int n from ods_job_checkin where workflow='repair' and job_code=$1 and tech_code=$2",
      [code, session.username],
    );
    if (!arrived.rows[0]?.n) return { ok: false, error: "ຕ້ອງ check-in ໜ້າງານກ່ອນເລີ່ມສ້ອມແປງ" };
  }

  // ຂັ້ນ 8 = ລໍຖ້າສ້ອມແປງ ເທົ່ານັ້ນ (ເງື່ອນໄຂຢູ່ໃນ WHERE — ຢ່າຍ້າຍອອກ)
  const done = await query(`update tb_product a set time_repair=${NOW} where a.code=$1 and (${STAGE_SQL}) = 8`, [code]);
  if (!done.rowCount) return { ok: false, error: 'ເລີ່ມສ້ອມບໍ່ໄດ້ — ໃບນີ້ບໍ່ໄດ້ຢູ່ຂັ້ນ "ລໍຖ້າສ້ອມແປງ"' };

  await logChange("tb_product", code, "ເລີ່ມສ້ອມແປງ");
  return { ok: true, message: `ເລີ່ມສ້ອມແປງ ${code}` };
}

export async function finishRepairFlow(
  session: Session,
  code: string,
  note: string,
  photos: string[] = [],
): Promise<FlowResult> {
  const own = await ownJob(session, "repair", code);
  if (!own.ok) return own;
  if (own.job?.onsite && photos.filter(Boolean).length === 0) {
    return { ok: false, error: "ງານສ້ອມນອກສະຖານທີ່ຕ້ອງມີຮູບຜົນງານຢ່າງໜ້ອຍ 1 ຮູບ" };
  }

  // ຂັ້ນ 9 = ກຳລັງສ້ອມແປງ ເທົ່ານັ້ນ
  if (!db) return { ok: false, error: "ບໍ່ພົບ DATABASE_URL" };
  const client = await db.connect();
  let saved = 0;
  try {
    await client.query("begin");
    const done = await client.query(
      `update tb_product a set status=5, time_finish_repair=${NOW}, repair_note=nullif($2,'')
        where a.code=$1 and (${STAGE_SQL}) = 9`,
      [code, note.trim()],
    );
    if (!done.rowCount) {
      await client.query("rollback");
      return { ok: false, error: 'ບັນທຶກບໍ່ໄດ້ — ໃບນີ້ບໍ່ໄດ້ຢູ່ຂັ້ນ "ກຳລັງສ້ອມແປງ"' };
    }
    saved = await savePhotos(client, session, "repair", code, photos.filter(Boolean), note.trim());
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    console.error("finishRepairFlow failed", error);
    return { ok: false, error: "ບັນທຶກຜົນງານບໍ່ສຳເລັດ" };
  } finally {
    client.release();
  }
  await logChange(
    "tb_product",
    code,
    `${note.trim() ? `ສ້ອມແປງສຳເລັດ: ${note.trim()}` : "ສ້ອມແປງສຳເລັດ"}${saved ? ` · ຮູບ ${saved} ຮູບ` : ""} — ລໍຖ້າກວດຮັບຄຸນນະພາບ`,
  );
  return { ok: true, message: `ສ້ອມແປງ ${code} ສຳເລັດ — ລໍຖ້າ QC` };
}

/* ── check-in / check-out ໜ້າງານ ────────────────────────────────── */

export type CheckinInput = { lat?: number | null; lng?: number | null; photo?: string | null; note?: string };

/**
 * ວຽກນອກສະຖານທີ່ຕ້ອງມີຫຼັກຖານວ່າຊ່າງໄປຮອດຈິງ.
 * ຝັ່ງຕິດຕັ້ງ = ລົງໜ້າງານສະເໝີ · ຝັ່ງສ້ອມ = ສະເພາະງານນອກສູນ (ບໍ່ບັງຄັບຢູ່ນີ້ —
 * ແອັບຮູ້ຈາກ service_type ແລ້ວຈຶ່ງສະແດງປຸ່ມ).
 */
export async function checkIn(
  session: Session,
  workflow: Workflow,
  code: string,
  input: CheckinInput,
): Promise<FlowResult> {
  const own = await ownJob(session, workflow, code);
  if (!own.ok) return own;
  if (!own.job?.accepted) {
    return { ok: false, error: "ຕ້ອງກົດຮັບງານກ່ອນ ຈຶ່ງສາມາດ check-in ໄດ້" };
  }
  if (!own.job?.onsite) return { ok: false, error: "ງານນີ້ເຮັດຢູ່ໃນສູນ ບໍ່ຕ້ອງ check-in" };
  const allowedStages = workflow === "install" ? [4, 5] : [1, 2, 8, 9];
  if (!allowedStages.includes(own.job.stage)) {
    return { ok: false, error: "ຂັ້ນປັດຈຸບັນຍັງບໍ່ສາມາດ check-in ໄດ້" };
  }
  if (!input.photo) return { ok: false, error: "ຕ້ອງຖ່າຍຮູບໜ້າງານກ່ອນ check-in" };

  const done = await query(
    `insert into ods_job_checkin(workflow, job_code, tech_code, checkin_lat, checkin_lng, checkin_photo, note)
     values($1,$2,$3,$4,$5,nullif($6,''),nullif($7,''))
     on conflict do nothing`,
    [workflow, code, session.username, input.lat ?? null, input.lng ?? null, input.photo ?? "", input.note ?? ""],
  );
  // ດັດຊະນີ unique ກັນການ check-in ຊ້ຳ (ຍັງບໍ່ check-out) ⇒ 0 ແຖວ = ເປີດຄ້າງຢູ່ແລ້ວ
  if (!done.rowCount) return { ok: false, error: "ທ່ານ check-in ງານນີ້ຢູ່ແລ້ວ" };

  await logChange(
    workflow === "install" ? "ods_tb_install" : "tb_product",
    code,
    `ຊ່າງ check-in ໜ້າງານ${input.lat != null && input.lng != null ? ` (${input.lat.toFixed(5)}, ${input.lng.toFixed(5)})` : ""}`,
  );
  return { ok: true, message: "check-in ສຳເລັດ" };
}

export async function checkOut(
  session: Session,
  workflow: Workflow,
  code: string,
  input: CheckinInput,
): Promise<FlowResult> {
  const done = await query(
    `update ods_job_checkin
        set checkout_at=${NOW}, checkout_lat=$4, checkout_lng=$5,
            note = coalesce(nullif($6,''), note)
      where workflow=$1 and job_code=$2 and tech_code=$3 and checkout_at is null`,
    [workflow, code, session.username, input.lat ?? null, input.lng ?? null, input.note ?? ""],
  );
  if (!done.rowCount) return { ok: false, error: "ບໍ່ພົບການ check-in ທີ່ຄ້າງຢູ່" };

  await logChange(
    workflow === "install" ? "ods_tb_install" : "tb_product",
    code,
    "ຊ່າງ check-out ຈາກໜ້າງານ",
  );
  return { ok: true, message: "check-out ສຳເລັດ" };
}

/** ໃຊ້ຢູ່ແອັບ — ງານນີ້ຊ່າງ check-in ຄ້າງຢູ່ບໍ */
export async function openCheckin(session: Session, workflow: Workflow, code: string) {
  const rows = await query<{ id: number; checkin_at: string }>(
    `select id, to_char(checkin_at,'DD-MM-YYYY HH24:MI') as checkin_at
       from ods_job_checkin
      where workflow=$1 and job_code=$2 and tech_code=$3 and checkout_at is null`,
    [workflow, code, session.username],
  );
  return rows.rows[0] ?? null;
}
