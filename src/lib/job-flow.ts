import { logChange } from "@/lib/chatter-log";
import type { Session } from "@/lib/auth";
import type { Workflow } from "@/lib/commission";
import { query } from "@/lib/db";
import { db } from "@/lib/db";
import { roleOf } from "@/lib/roles";
import { INSTALL_STAGE_SQL } from "@/lib/install-stage";
import { STAGE_SQL } from "@/lib/stage";
import { TRANS } from "@/lib/stock-constants";
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
          // PS ນອກສະຖານທີ່ສະເພາະຕອນໄປຮັບ (ຍັງບໍ່ pickup_at); ຮັບເຂົ້າສູນແລ້ວ = ຢູ່ສູນ.
          // ⚠️ ຕ້ອງຕົງກັບ REPAIR_ONSITE (mobile-jobs) + tech-flow — ບໍ່ດັ່ງນັ້ນ PS ຢູ່ສູນ
          // ຈະຖືກ startRepair/finish ບັງຄັບ check-in ທີ່ເຮັດບໍ່ໄດ້ ⇒ ວຽກຄ້າງ.
          `select code, nullif(emp_code,'') as tech, status = 6 as cancelled,
                  repair_confirm is not null as accepted,
                  (coalesce(service_type,'')='IH' or (coalesce(service_type,'')='PS' and pickup_at is null)) as onsite,
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

  /**
   * ຫຼັງຊ່າງຮັບງານ ຕ້ອງອອກຈາກຄິວຮັບທັນທີ:
   *   • ໝວດແອ (ODS tb_category = 03) → ລໍຖ້າເບີກອາໄຫຼ່
   *   • ສິນຄ້າອື່ນ              → ລໍຖ້າຕິດຕັ້ງ
   * ກຳນົດ used_spare ໃນ UPDATE ດຽວກັບ tech_confirm ເພື່ອບໍ່ໃຫ້ມີຊ່ວງທີ່ງານຢູ່ຜິດຄິວ.
   * ກວດຊື່ "ແອ" ນຳ ເພື່ອຮອງຮັບຂໍ້ມູນເກົ່າທີ່ pro_type_code ຫວ່າງ.
   */
  const done = await query(
    `update ods_tb_install a
      set tech_confirm=${NOW},
          used_spare=case
            when trim(coalesce(a.pro_type_code,''))='03' or trim(coalesce(a.pro_type,''))='ແອ' then 1
            else 0
          end
      where a.code=$1 and (${INSTALL_STAGE_SQL}) = 1`,
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

  await logChange("ods_tb_install", code, "ຊ່າງຮັບງານແລ້ວ", { author: session.username, roles: ["admin", "manager"] });
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

  await logChange("tb_product", code, "ຊ່າງຮັບງານສ້ອມແລ້ວ", { author: session.username, roles: ["admin", "manager"] });
  return { ok: true, message: `ຮັບງານສ້ອມ ${code} ສຳເລັດ` };
}

/**
 * ຊ່າງໜ້າງານ (IH) **ສ້ອມບໍ່ໄດ້ ⇒ ນຳເຄື່ອງເຂົ້າສູນ**. ແປງ IH→PS (ໄປຮັບມາສ້ອມຢູ່ສູນ)
 * ເພາະຜົນລັບຄືກັນ: ເຄື່ອງເດີນທາງເຂົ້າສູນ → ສ້ອມ → **ຕ້ອງສົ່ງຄືນ** (ຕ່າງຈາກ IH ທີ່ຈົບໜ້າງານ).
 *
 * ຊ່າງເລືອກ **ວິທີເອົາເຄື່ອງເຂົ້າ** — ຄວບຄຸມດ້ວຍ `mode`:
 * - "pickup" (ຂົນສົ່ງມາຮັບ): pickup_at=null ⇒ ເຂົ້າຄິວ "ລໍໄປຮັບເຄື່ອງ" (ຂັ້ນ 0);
 *   ຂົນສົ່ງໄປຮັບ ແລ້ວ CS ກົດ "ຮັບເຂົ້າສູນ" (receivePickup) ⇒ ຂັ້ນ 1 ກວດຄືນຢູ່ສູນ.
 * - "carry" (ເອົາກັບພ້ອມ): ຊ່າງຫອບເຄື່ອງກັບເອງທັນທີ ⇒ pickup_at=now ຄືມາຮອດສູນແລ້ວ
 *   ⇒ ຂ້າມຄິວໄປຮັບ ຕົກເຂົ້າຂັ້ນ 1 "ລໍຖ້າກວດເຊັກ" ຢູ່ສູນເລີຍ.
 * - ລ້າງ time_check/time_finish_check ⇒ ກວດຄືນຢູ່ສູນດ້ວຍເຄື່ອງມືສູນ.
 * - ອະນຸຍາດຕັ້ງແຕ່ຫຼັງເລີ່ມກວດຈົນກ່ອນລົງມືສ້ອມ (ຂັ້ນ 1–8) — ຫຼັງເລີ່ມສ້ອມ/ອອກໃບແລ້ວ ຫ້າມ.
 */
export async function bringRepairToCenter(
  session: Session,
  code: string,
  reason: string,
  mode: "pickup" | "carry" = "pickup",
): Promise<FlowResult> {
  const own = await ownJob(session, "repair", code);
  if (!own.ok) return own;

  const why = reason.trim();
  if (!why) return { ok: false, error: "ກະລຸນາໃສ່ເຫດຜົນທີ່ສ້ອມໜ້າງານບໍ່ໄດ້" };

  // ເອົາກັບພ້ອມ = ຊ່າງຫອບເຄື່ອງເຂົ້າສູນເອງ ⇒ ໝາຍ pickup_at ທັນທີ (ຂ້າມຄິວໄປຮັບ).
  const carry = mode === "carry";
  const done = await query(
    `update tb_product a set
        service_type='PS', pickup_start=${NOW}, pickup_at=${carry ? NOW : "null"},
        time_check=null, time_finish_check=null
      where a.code=$1 and coalesce(service_type,'')='IH' and (${STAGE_SQL}) between 1 and 8`,
    [code],
  );
  if (!done.rowCount) {
    return { ok: false, error: "ນຳເຂົ້າສູນບໍ່ໄດ້ — ວຽກບໍ່ແມ່ນ IH ໜ້າງານ ຫຼື ລົງມືສ້ອມ/ອອກໃບໄປແລ້ວ" };
  }

  // ນຳເຂົ້າສູນ = ຊ່າງອອກຈາກໜ້າງານ ⇒ ປິດ check-in ທີ່ຄ້າງ (checkout ອັດຕະໂນມັດ)
  await query(
    `update ods_job_checkin set checkout_at=${NOW}
      where workflow='repair' and job_code=$1 and tech_code=$2 and checkout_at is null`,
    [code, session.username],
  );

  const how = carry ? "ຊ່າງເອົາກັບພ້ອມ" : "ໃຫ້ຂົນສົ່ງໄປຮັບ";
  await logChange("tb_product", code, `ສ້ອມໜ້າງານບໍ່ໄດ້ → ນຳເຂົ້າສູນ (IH→PS · ${how}): ${why}`, { author: session.username, roles: ["admin", "manager"] });
  return {
    ok: true,
    message: carry
      ? `ນຳ ${code} ເຂົ້າສູນແລ້ວ (ເອົາກັບພ້ອມ) — ຢູ່ຄິວ ລໍຖ້າກວດເຊັກ`
      : `ນຳ ${code} ເຂົ້າສູນແລ້ວ — ລໍຂົນສົ່ງໄປຮັບ`,
  };
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
          `update ods_tb_install a
              set tech_code = null, tech_before = tech_code,
                  assigt_time = null, user_assigt = null
            where a.code = $1 and (${INSTALL_STAGE_SQL}) = 1`,
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
    { author: session.username, roles: ["admin", "manager"] },
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
    `update ods_tb_install a set start_install=${NOW}
      where a.code=$1 and (${INSTALL_STAGE_SQL}) = 4 and a.start_install is null`,
    [code],
  );
  if (!done.rowCount) return { ok: false, error: "ເລີ່ມຕິດຕັ້ງບໍ່ໄດ້ — ຕ້ອງຮັບງານ ແລະ ຮັບອາໄຫຼ່ໃຫ້ຄົບກ່ອນ" };

  await logChange("ods_tb_install", code, "ເລີ່ມຕິດຕັ້ງ", { author: session.username, roles: ["admin", "manager"] });
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
  kind: "finish" | "check" = "finish",
): Promise<number> {
  let saved = 0;
  for (const photo of photos) {
    if (!photo) continue;
    await client.query(
      `insert into ods_job_photo(workflow, job_code, kind, photo, note, created_by)
       values($1,$2,$3,$4,nullif($5,''),$6)`,
      [workflow, code, kind, photo, note, session.username],
    );
    saved += 1;
  }
  return saved;
}

/** ບັນທຶກຮູບຕອນກວດເຊັກ (kind='check') — ໃຊ້ໃນ transaction ຂອງ saveCheckFlow */
export async function saveCheckPhotos(
  client: PoolClient,
  session: Session,
  code: string,
  photos: string[],
): Promise<number> {
  return savePhotos(client, session, "repair", code, photos.filter(Boolean), "", "check");
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
      `update ods_tb_install a set finish_install=${NOW}
        where a.code=$1 and (${INSTALL_STAGE_SQL}) = 5
          and a.start_install is not null and a.finish_install is null`,
      [code],
    );
    if (!done.rowCount) {
      await client.query("rollback");
      return { ok: false, error: "ບັນທຶກບໍ່ໄດ້ — ຍັງບໍ່ໄດ້ເລີ່ມຕິດຕັ້ງ ຫຼື ຈົບໄປແລ້ວ" };
    }
    saved = await savePhotos(client, session, "install", code, clean, "");
    // ຈົບງານຕິດຕັ້ງ ⇒ checkout ອັດຕະໂນມັດ (ວຽກໜ້າງານ) — ຄືກັບຝັ່ງສ້ອມ
    await client.query(
      `update ods_job_checkin set checkout_at=${NOW}
        where workflow='install' and job_code=$1 and tech_code=$2 and checkout_at is null`,
      [code, session.username],
    );
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    console.error("finishInstallFlow failed", error);
    return { ok: false, error: "ບັນທຶກຜົນງານບໍ່ສຳເລັດ" };
  } finally {
    client.release();
  }
  await logChange("ods_tb_install", code, `ຕິດຕັ້ງສຳເລັດ · ຮູບຜົນງານ ${saved} ຮູບ — ລໍຖ້າກວດຮັບຄຸນນະພາບ`, { author: session.username, roles: ["admin", "manager"] });
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

/** ຮູບຕາມຊະນິດ (finish/check) — base64 ຈາກ ods_job_photo */
async function jobPhotosByKind(workflow: Workflow, code: string, kind: "finish" | "check") {
  return (
    await query<{ photo: string }>(
      `select photo from ods_job_photo
        where workflow=$1 and job_code=$2 and kind=$3 order by id`,
      [workflow, code, kind],
    )
  ).rows.map((r) => r.photo);
}

/**
 * ຮູບຕອນຮັບເຄື່ອງ (ໃບຮັບເຄື່ອງ) — ເກັບເປັນ **ໄຟລ໌** ຢູ່ product_image (iteme_code = ລະຫັດງານ),
 * ບໍ່ແມ່ນ base64. route /api/uploads ໃຊ້ cookie session ⇒ ແອັບ (Bearer) ດຶງ URL ກົງບໍ່ໄດ້
 * ⇒ ອ່ານໄຟລ໌ແປງເປັນ data-URI base64 ໃຫ້ແອັບເລີຍ (ຄືກັບຮູບ QC). ຂ້າມວິດີໂອ (ໃຫຍ່ເກີນ).
 */
async function receivePhotos(code: string): Promise<string[]> {
  const rows = (
    await query<{ product_url: string }>(
      `select product_url from product_image
        where iteme_code=$1 and coalesce(product_url,'') <> ''
          and lower(product_url) ~ '\\.(jpe?g|png|gif|webp)$'
        order by line_number`,
      [code],
    )
  ).rows;
  const { readUpload } = await import("@/lib/uploads");
  const { basename, extname } = await import("node:path");
  const mime: Record<string, string> = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".webp": "image/webp",
  };
  const out: string[] = [];
  for (const { product_url } of rows.slice(0, 12)) {
    const file = basename(product_url);
    const type = mime[extname(file).toLowerCase()];
    if (!type) continue;
    const buf = await readUpload(file);
    // ໄຟລ໌ຫາຍ — ຂ້າມໄປ
    if (buf) out.push(`data:${type};base64,${buf.toString("base64")}`);
  }
  return out;
}

/** ຊຸດຮູບຂອງງານສຳລັບແອັບ: ຕອນຮັບເຄື່ອງ · ຕອນກວດເຊັກ · ຕອນສ້ອມ/ຕິດຕັ້ງສຳເລັດ */
export async function jobPhotoSets(workflow: Workflow, code: string) {
  const [receive, check, finish] = await Promise.all([
    receivePhotos(code),
    jobPhotosByKind(workflow, code, "check"),
    jobPhotosByKind(workflow, code, "finish"),
  ]);
  return { receive, check, finish };
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

  await logChange("tb_product", code, "ເລີ່ມສ້ອມແປງ", { author: session.username, roles: ["admin", "manager"] });
  return { ok: true, message: `ເລີ່ມສ້ອມແປງ ${code}` };
}

/**
 * ອາໄຫຼ່ຂອງວຽກຕ້ອງ **ຮັບຄົບກ່ອນ** ຈຶ່ງບັນທຶກ "ສ້ອມແປງສຳເລັດ" ໄດ້.
 *
 * ແຕ່ກ່ອນເປັນແຕ່ຄຳເຕືອນຢູ່ໜ້າຈໍ ⇒ ຊ່າງກົດຈົບໄດ້ທັງທີ່ອາໄຫຼ່ບໍ່ເຄີຍຖືກຂໍເບີກ/ເບີກອອກສາງ
 * → ວຽກປິດແລ້ວ ແຕ່ບັນຊີສາງບໍ່ຕົງກັບຂອງຈິງ ແລະ ບໍ່ມີໃຜກັບມາແກ້ອີກ.
 * ທຸກສະຖານະທີ່ຕິດຢູ່ນີ້ມີໜ້າສຳລັບແກ້ສະເໝີ (ຂໍເບີກ / ສາງເບີກ / ຮັບອາໄຫຼ່)
 * ຫຼື ລຶບແຖວທີ່ບໍ່ໄດ້ໃຊ້ຈິງອອກຈາກໜ້າສ້ອມແປງ.
 */
async function pendingSpareBlocker(code: string): Promise<string | null> {
  const onDoc = (flag: number) => `exists (select 1 from ic_trans_detail d
      where d.product_code = s.product_code and d.item_code = s.item_code and d.trans_flag = ${flag})`;
  const row = (
    await query<{ waiting: number; not_requested: number; not_issued: number }>(
      `select count(*) filter (where s.pick_finish is null)::int waiting,
          count(*) filter (where s.pick_finish is null and not ${onDoc(TRANS.REQUEST)})::int not_requested,
          count(*) filter (where s.pick_finish is null and not ${onDoc(TRANS.DISPATCH)})::int not_issued
        from tb_used_spare s where s.product_code = $1`,
      [code],
    )
  ).rows[0];
  if (!row?.waiting) return null;
  if (row.not_requested)
    return `ຍັງມີອາໄຫຼ່ ${row.not_requested} ລາຍການທີ່ບໍ່ໄດ້ສ້າງໃບຂໍເບີກ — ຕ້ອງຂໍເບີກ ແລະ ຮັບອາໄຫຼ່ໃຫ້ຄົບກ່ອນ ຈຶ່ງບັນທຶກສ້ອມແປງສຳເລັດໄດ້ (ຖ້າບໍ່ໄດ້ໃຊ້ຈິງ ໃຫ້ລຶບອອກຈາກລາຍການ)`;
  if (row.not_issued)
    return `ສາງຍັງບໍ່ທັນເບີກອາໄຫຼ່ອອກໃຫ້ ${row.not_issued} ລາຍການ — ລໍຖ້າສາງເບີກອອກ ແລະ ຮັບອາໄຫຼ່ກ່ອນ ຈຶ່ງບັນທຶກສ້ອມແປງສຳເລັດໄດ້`;
  return `ຍັງມີອາໄຫຼ່ ${row.waiting} ລາຍການທີ່ຍັງບໍ່ໄດ້ກົດຮັບ — ໄປຢືນຢັນຮັບອາໄຫຼ່ທີ່ໜ້າ "ຮັບອາໄຫຼ່" ກ່ອນ ຈຶ່ງບັນທຶກສ້ອມແປງສຳເລັດໄດ້`;
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

  // ບໍ່ຖືກຂັ້ນຕອນ = ບໍ່ໃຫ້ຈົບ — ໃຊ້ທັງເວັບ ແລະ ແອັບມືຖື ເພາະຢູ່ flow ດຽວກັນ
  const blocker = await pendingSpareBlocker(code);
  if (blocker) return { ok: false, error: blocker };

  /**
   * ຮັບໄດ້ **ທັງຂັ້ນ 8 (ລໍຖ້າສ້ອມ) ແລະ 9 (ກຳລັງສ້ອມ)** — ຈົບໂດຍບໍ່ຕ້ອງກົດ "ເລີ່ມສ້ອມ" ກ່ອນ.
   *
   * ⚠️ ບົດຮຽນຈາກຂໍ້ມູນ (04-08-2026 · ເບິ່ງ docs/repair-redesign.md):
   * 970/1,059 ໃບ (92%) ກົດ "ເລີ່ມສ້ອມ" ແລ້ວ "ສ້ອມສຳເລັດ" ຫ່າງກັນ **ບໍ່ເຖິງ 5 ນາທີ** ⇒ ຂັ້ນ
   * "ກຳລັງສ້ອມ" median = 0.0 ຊມ, ບໍ່ໄດ້ບອກຄວາມຈິງຫຍັງ ມີແຕ່ບັງຄັບໃຫ້ກົດເພີ່ມ 1 ເທື່ອ
   * (ແລະ 367 ໃບລົງເອີຍວ່າ "ຈົບກ່ອນເລີ່ມ" ຍ້ອນກົດຍ້ອນຫຼັງ).
   * ⇒ ຖ້າ time_repair ຍັງຫວ່າງ ໃຫ້ຖືວ່າ **ເລີ່ມພ້ອມກັບຈົບ** (coalesce) — ຂັ້ນ ແລະ ລາຍງານ
   * ຍັງເຫັນ "ເລີ່ມສ້ອມ" ຄືເກົ່າ ໂດຍບໍ່ຕ້ອງໃຫ້ຄົນກົດ.
   * ດ່ານອາໄຫຼ່ (pendingSpareBlocker ຂ້າງເທິງ) ຍັງບັງຄັບຄືເກົ່າ ⇒ ບໍ່ໄດ້ຂ້າມລະບຽບສາງ.
   */
  if (!db) return { ok: false, error: "ບໍ່ພົບ DATABASE_URL" };
  const client = await db.connect();
  let saved = 0;
  try {
    await client.query("begin");
    const done = await client.query(
      `update tb_product a set status=5,
          time_repair = coalesce(a.time_repair, ${NOW}),
          time_finish_repair=${NOW}, repair_note=nullif($2,'')
        where a.code=$1 and (${STAGE_SQL}) in (8, 9)`,
      [code, note.trim()],
    );
    if (!done.rowCount) {
      await client.query("rollback");
      return { ok: false, error: 'ບັນທຶກບໍ່ໄດ້ — ໃບນີ້ບໍ່ໄດ້ຢູ່ຂັ້ນ "ລໍຖ້າສ້ອມແປງ" ຫຼື "ກຳລັງສ້ອມແປງ"' };
    }
    saved = await savePhotos(client, session, "repair", code, photos.filter(Boolean), note.trim());
    // ຈົບງານ ⇒ **checkout ອັດຕະໂນມັດ** (ວຽກໜ້າງານ) — ຊ່າງບໍ່ຕ້ອງກົດ checkout ເອງ;
    // ປິດ check-in ທີ່ຍັງເປີດຄ້າງຂອງຊ່າງຄົນນີ້. ຢູ່ໃນ transaction ດຽວກັບການຈົບງານ.
    await client.query(
      `update ods_job_checkin set checkout_at=${NOW}
        where workflow='repair' and job_code=$1 and tech_code=$2 and checkout_at is null`,
      [code, session.username],
    );
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
    { author: session.username, roles: ["admin", "manager"] },
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
  /**
   * ── 1 ໃບງານ = **ຫຼາຍຮອບເຂົ້າໜ້າງານ** (06-08-2026) ──
   * ຕິດຕັ້ງແອຫຼາຍໜ່ວຍ · ລໍງານໄຟຟ້າ · ຝົນຕົກ ⇒ ຊ່າງກັບມາອີກມື້. ວັດແລ້ວ **65 ໃບ/ປີ**
   * ວັນຈົບ ≠ ວັນເລີ່ມ ແຕ່ລະບົບບັນທຶກໄດ້ຮອບດຽວ ⇒ ບອກບໍ່ໄດ້ວ່າໄປຈັກເທື່ອ.
   * ດຽວນີ້ check-in ຕອນຂັ້ນ **5 (ກຳລັງຕິດຕັ້ງ)** ໄດ້ນຳ ⇒ ແຕ່ລະຮອບເປັນ 1 ແຖວ
   * ຢູ່ `ods_job_checkin` (ຕາຕະລາງນີ້ຮອງຮັບຫຼາຍແຖວຕໍ່ງານຢູ່ແລ້ວ).
   * ⚠️ ຄ່າຄອມຍັງຄິດ **ຕໍ່ໃບງານ** ຄືເກົ່າ (ຕົກລົງ 06-08-2026) — ຮອບບໍ່ກະທົບເງິນ.
   */
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

  /**
   * **check-in = ເລີ່ມສ້ອມ** (ງານສ້ອມນອກສູນ) — ຊ່າງໄປຮອດໜ້າງານແລ້ວ ຄືເລີ່ມລົງມືແລ້ວ
   * ⇒ ບໍ່ຕ້ອງໃຫ້ກົດ "ເລີ່ມສ້ອມ" ອີກປຸ່ມ. ຂຽນສະເພາະໃບທີ່ຢູ່ຂັ້ນ 8 (ລໍຖ້າສ້ອມ) ແລະ ຍັງຫວ່າງ
   * ⇒ ບໍ່ທັບເວລາເກົ່າ ແລະ ບໍ່ດຶງໃບທີ່ຍັງບໍ່ຜ່ານດ່ານອາໄຫຼ່/ກວດເຊັກໃຫ້ຂ້າມຂັ້ນ.
   * (ເບິ່ງ docs/repair-redesign.md §3.4 — check-in ແທນປຸ່ມ "ເລີ່ມສ້ອມ")
   */
  if (workflow === "repair" && own.job.stage === 8) {
    await query(
      `update tb_product a set time_repair = ${NOW}
        where a.code = $1 and a.time_repair is null and (${STAGE_SQL}) = 8`,
      [code],
    );
  }

  await logChange(
    workflow === "install" ? "ods_tb_install" : "tb_product",
    code,
    `ຊ່າງ check-in ໜ້າງານ${input.lat != null && input.lng != null ? ` (${input.lat.toFixed(5)}, ${input.lng.toFixed(5)})` : ""}`,
    { author: session.username, roles: ["admin", "manager"] },
  );
  return { ok: true, message: "check-in ສຳເລັດ" };
}

/**
 * **ຮອບນີ້ຍັງບໍ່ຈົບ — ນັດເຂົ້າຮອບຕໍ່ໄປ** (ງານຕິດຕັ້ງ).
 *
 * ── ບັນຫາທີ່ແກ້ ──
 * ຊ່າງມີແຕ່ 2 ທາງເລືອກ: ກົດ "ຈົບງານ" (ທັງທີ່ຍັງບໍ່ຈົບ ⇒ QC ແລະ ລູກຄ້າປະເມີນເລີ່ມແລ່ນຜິດ)
 * ຫຼື ປະໄວ້ງຽບໆ (⇒ ງານຄາຢູ່ "ກຳລັງຕິດຕັ້ງ" ໂດຍບໍ່ມີໃຜຮູ້ວ່າຈະກັບໄປມື້ໃດ).
 * ອັນນີ້ຄືທາງທີສາມ: **ປິດຮອບນີ້ + ບອກວັນທີ່ຈະກັບໄປ** ໂດຍງານຄາຢູ່ຂັ້ນເດີມ.
 *
 * ບໍ່ແຕະ `finish_install` ⇒ ຂັ້ນບໍ່ຂະຍັບ · ອັບເດດ `appoint_date` ⇒ ຄິວງານປະຈຳວັນ
 * ຂອງມື້ນັ້ນຂຶ້ນເອງ · ປິດ check-in ທີ່ຄ້າງໃຫ້ (ຖ້າຊ່າງລືມກົດ check-out).
 */
export async function scheduleNextVisit(
  session: Session,
  code: string,
  input: { next_date: string; reason: string },
): Promise<FlowResult> {
  const own = await ownJob(session, "install", code);
  if (!own.ok) return own;
  if (own.job?.stage !== 5) {
    return { ok: false, error: 'ນັດຮອບຕໍ່ໄປໄດ້ສະເພາະງານທີ່ "ກຳລັງຕິດຕັ້ງ"' };
  }
  const reason = input.reason.trim();
  if (!reason) return { ok: false, error: "ກະລຸນາໃສ່ເຫດຜົນ ວ່າຍັງບໍ່ຈົບຍ້ອນຫຍັງ" };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.next_date)) return { ok: false, error: "ກະລຸນາເລືອກວັນນັດຮອບຕໍ່ໄປ" };

  /**
   * ປິດຮອບທີ່ຍັງເປີດຄ້າງ — **ຂອງທຸກຄົນ ບໍ່ແມ່ນສະເພາະຕົນ**: ຮອບກ່ອນອາດເປັນ
   * ຊ່າງຄົນອື່ນ (ປ່ຽນຊ່າງກາງທາງ — ເບິ່ງ handoverInstallTech) ທີ່ລືມ check-out
   * ⇒ ຖ້າປິດແຕ່ຂອງຕົນ ແຖວເກົ່າຈະຄ້າງເປັນ "ຍັງຢູ່ໜ້າງານ" ຕະຫຼອດໄປ.
   */
  await query(
    `update ods_job_checkin set checkout_at=${NOW}
      where workflow='install' and job_code=$1 and checkout_at is null`,
    [code],
  );

  const done = await query(
    `update ods_tb_install a set appoint_date=$2::date
      where a.code=$1 and (${INSTALL_STAGE_SQL}) = 5`,
    [code, input.next_date],
  );
  if (!done.rowCount) return { ok: false, error: "ບັນທຶກບໍ່ໄດ້ — ງານນີ້ບໍ່ໄດ້ຢູ່ຂັ້ນກຳລັງຕິດຕັ້ງແລ້ວ" };

  await logChange("ods_tb_install", code, `ຮອບນີ້ຍັງບໍ່ຈົບ — ນັດເຂົ້າຮອບຕໍ່ໄປ ${input.next_date} · ${reason}`, {
    author: session.username,
    roles: ["admin", "manager"],
  });
  return { ok: true, message: `ນັດເຂົ້າຮອບຕໍ່ໄປ ${input.next_date} ແລ້ວ` };
}

/** ຮອບເຂົ້າໜ້າງານທັງໝົດຂອງໃບງານ — ໜ້າໃບງານ ແລະ ແອັບ ໃຊ້ຮ່ວມກັນ */
export type JobVisit = {
  id: number;
  tech_code: string | null;
  checkin_at: string | null;
  checkout_at: string | null;
  minutes: number | null;
  note: string | null;
};

export async function jobVisits(workflow: Workflow, code: string): Promise<JobVisit[]> {
  return (
    await query<JobVisit>(
      `select id, nullif(tech_code,'') tech_code,
          to_char(checkin_at,'DD-MM-YYYY HH24:MI') checkin_at,
          to_char(checkout_at,'DD-MM-YYYY HH24:MI') checkout_at,
          case when checkout_at is null then null
               else round(extract(epoch from (checkout_at - checkin_at)) / 60)::int end minutes,
          nullif(note,'') note
        from ods_job_checkin
       where workflow=$1 and job_code=$2
       order by id`,
      [workflow, code],
    )
  ).rows;
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
    { author: session.username, roles: ["admin", "manager"] },
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
