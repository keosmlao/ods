import { logChange } from "@/lib/chatter-log";
import type { Session } from "@/lib/auth";
import type { Workflow } from "@/lib/commission";
import { db, query, queryOdg } from "@/lib/db";
import type { FlowResult } from "@/lib/job-flow";
import { roleOf, type Role } from "@/lib/roles";

/**
 * ດ່ານກວດຮັບຄຸນນະພາບ — **ແກນ** ທີ່ໃຊ້ຮ່ວມກັນລະຫວ່າງ ເວັບ (actions/qc.ts)
 * ແລະ ແອັບມືຖື (/api/mobile/qc).
 *
 * ຫຼັກການ (ຢ່າແກ້ໂດຍບໍ່ຄິດ):
 * ① ຄົນເຮັດ **ກວດງານຂອງຕົນເອງບໍ່ໄດ້** — ບໍ່ດັ່ງນັ້ນດ່ານນີ້ບໍ່ມີຄວາມໝາຍ
 * ② ໃຜກວດໄດ້ **ຜູ້ຈັດການກຳນົດ** (ods_qc_role) ບໍ່ຝັງໃນໂຄດ
 * ③ ຕົກ QC = ງານກັບໄປຫາຊ່າງ ພ້ອມເຫດຜົນ (ສ້ອມ → ຂັ້ນ 8 ລໍຖ້າສ້ອມແປງ — ເບິ່ງ TABLE.sendBackSet)
 */

export const MAX_PHOTO_CHARS = 400_000;

/**
 * `finishCol` = ຖັນ "ເຮັດວຽກຈົບ" (ເງື່ອນໄຂເຂົ້າດ່ານ QC) ·
 * `returnedCol` = ຖັນ "ປິດງານແລ້ວ" (ຫຼັງຈາກນີ້ QC ແຕະບໍ່ໄດ້ອີກ).
 */
/**
 * `sendBackSet` = ຖັນທີ່ຂຽນຕອນ **ຕົກ QC** — ບໍ່ແມ່ນລ້າງແຕ່ `finishCol` ສະເໝີໄປ.
 *
 * ── ສ້ອມ: ຕົກ QC ⇒ ກັບໄປ "ລໍຖ້າສ້ອມແປງ" (ຂັ້ນ 8) — 26-08-2026 ຕາມຄຳສັ່ງ ──
 * ລ້າງແຕ່ `time_finish_repair` ຢ່າງດຽວ ວຽກຕົກຂັ້ນ **9 (ກຳລັງສ້ອມແປງ)** ເພາະ
 * `time_repair` ຍັງຢູ່ — ແຕ່ຕອນນັ້ນບໍ່ມີໃຜກຳລັງສ້ອມແທ້ໆ ວຽກລໍຊ່າງມາຮັບໄປແກ້ຄືນ.
 * ລ້າງທັງສອງ ⇒ ຕົກຂັ້ນ 8 (ຊຸດຖັນດຽວກັບຂັ້ນ 8 ຂອງ lib/stage-fix) ແລະ ສະແຕມ
 * `qc_reject_at` ໃຫ້ນາລິກາຂັ້ນ 8 ເລີ່ມນັບໃໝ່ (ບໍ່ດັ່ງນັ້ນຈະນັບຈາກ spare_finish ເກົ່າ
 * ⇒ ວຽກທີ່ຫາກໍ່ກັບມາຈະຂຶ້ນວ່າຄ້າງຫຼາຍສິບມື້ ແລະ ເກີນ SLA ທັນທີ).
 * ຝັ່ງຕິດຕັ້ງຄືເກົ່າ: ລ້າງ `finish_install` ⇒ ກັບໄປ "ກຳລັງຕິດຕັ້ງ".
 */
const TABLE: Record<
  Workflow,
  {
    name: string;
    finishCol: string;
    returnedCol: string;
    model: string;
    sendBackSet: string;
    /** ຄົນທີ່ເຮັດງານ · ເວລາເລີ່ມ — ເກັບເຂົ້າ ods_qc_round ກ່ອນຖັນຖືກລ້າງ */
    workerCol: string;
    startCol: string;
  }
> = {
  install: {
    name: "ods_tb_install",
    finishCol: "finish_install",
    returnedCol: "job_finish",
    model: "ods_tb_install",
    sendBackSet: "finish_install = null",
    workerCol: "tech_code",
    startCol: "start_install",
  },
  repair: {
    name: "tb_product",
    finishCol: "time_finish_repair",
    returnedCol: "return_complete",
    model: "tb_product",
    sendBackSet: "time_finish_repair = null, time_repair = null, qc_reject_at = localtimestamp(0)",
    workerCol: "emp_code",
    startCol: "time_repair",
  },
};

/**
 * ── ຮອບປັດຈຸບັນ (26-08-2026 ຕາມຄຳສັ່ງ "ຕ້ອງເກັບປະຫວັດທຸກຢ່າງ") ──
 * ຮອບ = ຈຳນວນເທື່ອທີ່ QC **ສົ່ງງານກັບ** ໄປແລ້ວ + 1 (ຍັງບໍ່ເຄີຍຖືກສົ່ງກັບ = ຮອບ 1).
 *
 * ເປັນຫຍັງບໍ່ເກັບເປັນຖັນໃນໃບງານ: ຮອບ **ອະນຸມານໄດ້ຈາກປະຫວັດ** (ods_qc_round) ຢູ່ແລ້ວ
 * ⇒ ຖັນເພີ່ມມີແຕ່ຈະຫຼົ້ນກັບປະຫວັດເມື່ອບ່ອນໃດບ່ອນນຶ່ງລືມອັບເດດ.
 */
export async function qcRound(workflow: Workflow, jobCode: string): Promise<number> {
  const row = await query<{ n: number }>(
    "select count(*)::int as n from ods_qc_round where workflow = $1 and job_code = $2",
    [workflow, jobCode],
  );
  return (row.rows[0]?.n ?? 0) + 1;
}

export type QcItem = {
  id: number;
  name: string;
  require_photo: boolean;
  passed: boolean | null;
  note: string | null;
  photo: string | null;
};

export type QcAnswer = { item_id: number; passed: boolean; note: string; photo: string };

/** role ນີ້ກວດສາຍງານໃດໄດ້ (ods_qc_role — ຜູ້ຈັດການກຳນົດ) */
export async function qcWorkflowsFor(role: Role): Promise<Workflow[]> {
  const rows = await query<{ workflow: Workflow }>("select workflow from ods_qc_role where role = $1", [role]);
  return rows.rows.map((row) => row.workflow);
}

/**
 * ── ປະຫວັດຮອບທີ່ **ຖືກ QC ສົ່ງກັບ** (ods_qc_round) ──
 * ຮອບທີ່ຜ່ານບໍ່ຢູ່ໃນນີ້ — ເວລາຂອງມັນຍັງນອນຢູ່ໃນໃບງານຄືເກົ່າ. ອັນນີ້ຄືສິ່ງທີ່
 * **ຈະຫາຍໄປ** ຖ້າບໍ່ເກັບ: ຮອບ 1 ໃຜເຮັດ · ແຕ່ໃສຫາໃສ · ຕົກຍ້ອນຫຍັງ.
 */
export type QcRoundRow = {
  round: number;
  worker: string | null;
  started_at: string | null;
  finished_at: string | null;
  rejected_at: string;
  rejected_by: string;
  failed: number;
  checked: number;
  reason: string | null;
};

export async function qcRounds(workflow: Workflow, jobCode: string): Promise<QcRoundRow[]> {
  return (
    await query<QcRoundRow>(
      `select round, worker,
          to_char(started_at,'DD-MM-YYYY HH24:MI') as started_at,
          to_char(finished_at,'DD-MM-YYYY HH24:MI') as finished_at,
          to_char(rejected_at,'DD-MM-YYYY HH24:MI') as rejected_at,
          rejected_by, failed, checked, reason
         from ods_qc_round
        where workflow = $1 and job_code = $2
        order by round`,
      [workflow, jobCode],
    )
  ).rows;
}

/** ກວດ QC ງານນີ້ໄດ້ບໍ — role ຢູ່ໃນ ods_qc_role **ແລະ** ບໍ່ແມ່ນຄົນເຮັດງານນັ້ນເອງ */
export async function canQcJob(session: Session, workflow: Workflow, jobCode: string): Promise<FlowResult> {
  const allowed = await qcWorkflowsFor(roleOf(session));
  if (!allowed.includes(workflow)) return { ok: false, error: "ບໍ່ມີສິດກວດຮັບຄຸນນະພາບ" };

  const worker = await query<{ who: string | null }>(
    workflow === "install"
      ? "select nullif(tech_code,'') as who from ods_tb_install where code=$1"
      : "select nullif(emp_code,'') as who from tb_product where code=$1",
    [jobCode],
  );
  if (worker.rows[0]?.who === session.username) {
    return { ok: false, error: "ກວດຮັບງານຂອງຕົນເອງບໍ່ໄດ້ — ຕ້ອງໃຫ້ຄົນອື່ນກວດ" };
  }
  return { ok: true, message: "" };
}

/**
 * ລາຍການທີ່ຕ້ອງກວດ — ກອງຕາມ **ໝວດສິນຄ້າ ERP** ຂອງງານນັ້ນ ບວກລາຍການທົ່ວໄປ.
 * ຖາມສອງຈັງຫວະ (ODS → ERP) ເພາະ join ຂ້າມຖານບໍ່ໄດ້.
 */
export async function qcChecklistFor(workflow: Workflow, jobCode: string): Promise<QcItem[]> {
  const job = await query<{ item_code: string | null }>(
    workflow === "install"
      ? "select item_code from ods_tb_install where code=$1"
      : "select item_code from tb_product where code=$1",
    [jobCode],
  );

  let category: string | null = null;
  const itemCode = job.rows[0]?.item_code;
  if (itemCode) {
    const erp = await queryOdg<{ item_category: string | null }>("select item_category from ic_inventory where code=$1", [
      itemCode,
    ]);
    category = erp.rows[0]?.item_category ?? null;
  }

  /**
   * ຄຳຕອບທີ່ເອົາມາໃສ່ໃຫ້ = **ຮອບປັດຈຸບັນ** ເທົ່ານັ້ນ. ຮອບກ່ອນໜ້າ (ທີ່ຖືກສົ່ງກັບ)
   * ຍັງນອນຢູ່ໃນຕາຕະລາງເປັນປະຫວັດ ແຕ່ບໍ່ຄວນເດັ້ງມາເປັນຄຳຕອບຕັ້ງຕົ້ນ — ຮອບໃໝ່
   * ຄືການກວດໃໝ່ ບໍ່ແມ່ນການແກ້ຄຳຕອບເກົ່າ.
   */
  const round = await qcRound(workflow, jobCode);
  return (
    await query<QcItem>(
      `select i.id, i.name, i.require_photo, r.passed, r.note, r.photo
         from ods_qc_item i
         left join ods_qc_result r
           on r.item_id = i.id and r.workflow = $1 and r.job_code = $2 and r.round = $4
        where i.workflow = $1 and i.is_active
          and (i.category_code is null or i.category_code = $3)
        order by i.sort_order, i.id`,
      [workflow, jobCode, category, round],
    )
  ).rows;
}

export type SaveQcInput = {
  workflow: Workflow;
  jobCode: string;
  answers: QcAnswer[];
  signer_name: string;
  signer_tel: string;
  signature: string;
};

/**
 * ບັນທຶກຜົນ QC.
 * ຜ່ານທຸກຂໍ້ → stamp qc_finish ⇒ ງານໄປຂັ້ນຕໍ່ໄປ.
 * ຕົກຂໍ້ໃດຂໍ້ນຶ່ງ → **ງານກັບໄປຫາຊ່າງ** (ສ້ອມ = ຂັ້ນ 8 ລໍຖ້າສ້ອມແປງ) ພ້ອມເຫດຜົນຢູ່ chatter.
 */
export async function saveQcFlow(session: Session, input: SaveQcInput): Promise<FlowResult> {
  const guard = await canQcJob(session, input.workflow, input.jobCode);
  if (!guard.ok) return guard;
  if (!db) return { ok: false, error: "ບໍ່ພົບ DATABASE_URL" };
  if (input.answers.length === 0) return { ok: false, error: "ຍັງບໍ່ໄດ້ກວດຈັກຂໍ້" };

  const items = await qcChecklistFor(input.workflow, input.jobCode);
  const itemById = new Map(items.map((item) => [item.id, item]));

  for (const answer of input.answers) {
    const item = itemById.get(answer.item_id);
    if (!item) return { ok: false, error: "ພົບລາຍການກວດທີ່ບໍ່ແມ່ນຂອງງານນີ້" };
    if (answer.photo && answer.photo.length > MAX_PHOTO_CHARS) {
      return { ok: false, error: `ຮູບຂອງ "${item.name}" ໃຫຍ່ເກີນໄປ — ກະລຸນາຖ່າຍໃໝ່` };
    }
    // ຮູບ QC = ທາງເລືອກ (ບໍ່ບັງຄັບ) — ຖ່າຍໄດ້ ຫຼື ບໍ່ຖ່າຍກໍ່ຜ່ານໄດ້
  }
  if (input.answers.length !== items.length) return { ok: false, error: "ຕ້ອງກວດໃຫ້ຄົບທຸກຂໍ້" };

  const failed = input.answers.filter((answer) => !answer.passed);
  // ຄິດກ່ອນເປີດ transaction — ຂໍ້ຄວາມນີ້ໄປທັງ ods_qc_round (ປະຫວັດ) ແລະ chatter
  const reasons = failed
    .map((answer) => `${itemById.get(answer.item_id)?.name}${answer.note ? ` (${answer.note})` : ""}`)
    .join(" · ");
  const table = TABLE[input.workflow];
  const installActive = input.workflow === "install" ? "and cancel_date is null and complain_finish is null" : "";

  const client = await db.connect();
  let savedRound = 1;
  try {
    await client.query("begin");

    /**
     * ຮອບຄິດໃນ transaction (ບໍ່ແມ່ນເອົາຄ່າທີ່ອ່ານໄວ້ກ່ອນໜ້າ) ⇒ ສອງຄົນກົດພ້ອມກັນ
     * ຄົນນຶ່ງຈະຕົກ unique (workflow, job_code, round) ຂອງ ods_qc_round ແລ້ວ rollback
     * ບໍ່ແມ່ນຂຽນທັບກັນງຽບໆ.
     */
    const round =
      ((
        await client.query<{ n: number }>(
          "select count(*)::int as n from ods_qc_round where workflow = $1 and job_code = $2",
          [input.workflow, input.jobCode],
        )
      ).rows[0]?.n ?? 0) + 1;
    savedRound = round;

    for (const answer of input.answers) {
      await client.query(
        `insert into ods_qc_result(workflow, job_code, round, item_id, passed, note, photo, checked_by)
         values($1,$2,$8,$3,$4,nullif($5,''),nullif($6,''),$7)
         on conflict (workflow, job_code, round, item_id) do update
            set passed = excluded.passed, note = excluded.note, photo = excluded.photo,
                checked_by = excluded.checked_by, checked_at = localtimestamp(0)`,
        [
          input.workflow,
          input.jobCode,
          answer.item_id,
          answer.passed,
          answer.note ?? "",
          answer.photo ?? "",
          session.username,
          round,
        ],
      );
    }

    if (failed.length > 0) {
      /**
       * ── ① ເກັບປະຫວັດຮອບນີ້ **ກ່ອນ** ລ້າງຖັນ (26-08-2026 ຕາມຄຳສັ່ງ) ──
       * ຖັນເວລາທີ່ກຳລັງຈະຖືກລ້າງ (ໃຜເຮັດ · ເລີ່ມ · ຈົບ) ຄື **ຫຼັກຖານດຽວ** ຂອງຮອບນັ້ນ —
       * ລ້າງໄປແລ້ວກູ້ບໍ່ໄດ້ ແລະ ລາຍງານຈະນັບຄືກັບວ່າຮອບນັ້ນບໍ່ເຄີຍເກີດ. ຢູ່ transaction
       * ດຽວກັນກັບການລ້າງ ⇒ ບໍ່ມີຊ່ອງທີ່ "ລ້າງແລ້ວແຕ່ບໍ່ໄດ້ເກັບ".
       * ເງື່ອນໄຂ where ຕົງກັບ update ຂ້າງລຸ່ມ ⇒ ງານທີ່ແຕະບໍ່ໄດ້ ກໍ່ບໍ່ມີແຖວປະຫວັດຫຼອກ.
       */
      await client.query(
        `insert into ods_qc_round
            (workflow, job_code, round, worker, started_at, finished_at, rejected_by, failed, checked, reason)
         select $1::varchar, $2::varchar, $3::int, nullif(a.${table.workerCol},''),
                a.${table.startCol}, a.${table.finishCol},
                $4::varchar, $5::int, $6::int, nullif($7,'')
           from ${table.name} a
          where a.code = $2::varchar and a.${table.finishCol} is not null
            and a.${table.returnedCol} is null ${installActive}`,
        [input.workflow, input.jobCode, round, session.username, failed.length, input.answers.length, reasons],
      );

      /**
       * ── ② ສົ່ງກັບໃຫ້ຊ່າງ — ຂຽນຊຸດຖັນຂອງສາຍງານນັ້ນ (TABLE.sendBackSet) ──
       * qc_finish ຍັງເປັນ null ຢູ່ແລ້ວ. ສ້ອມ ⇒ ຕົກຂັ້ນ 8 "ລໍຖ້າສ້ອມແປງ" ·
       * ຕິດຕັ້ງ ⇒ ກັບໄປ "ກຳລັງຕິດຕັ້ງ".
       * ດ່ານດຽວກັນກັບກິ່ງ "ຜ່ານ": ງານທີ່ **ສົ່ງຄືນລູກຄ້າໄປແລ້ວ** ຫ້າມແຕະ —
       * ບໍ່ດັ່ງນັ້ນ QC ຍ້ອນຫຼັງຈະລຶບເວລາເຮັດວຽກຈົບຖິ້ມ ໂດຍວຽກຍັງຄ້າງຂັ້ນ "ສົ່ງຄືນສຳເລັດ".
       */

      const sentBack = await client.query(
        `update ${table.name} set ${table.sendBackSet}
          where code = $1 and ${table.finishCol} is not null and ${table.returnedCol} is null ${installActive}`,
        [input.jobCode],
      );
      if (!sentBack.rowCount) {
        await client.query("rollback");
        return { ok: false, error: "ສົ່ງງານກັບບໍ່ໄດ້ — ງານນີ້ຍັງບໍ່ທັນເຮັດສຳເລັດ ຫຼື ປິດໄປແລ້ວ" };
      }
    } else {
      /**
       * ── ຕ້ອງເຮັດວຽກຈົບແລ້ວ ຈຶ່ງ QC ໄດ້ ──
       * ເງື່ອນໄຂຢູ່ໃນ WHERE ເອງ (ບໍ່ແມ່ນກວດກ່ອນແລ້ວຄ່ອຍຂຽນ) ຕາມກົດຂອງ lib/job-flow.
       *
       * ແຕ່ກ່ອນເປັນ `where code = $1` ລ້ວນໆ ⇒ stamp qc_finish ໃສ່ວຽກຂັ້ນໃດກໍ່ໄດ້.
       * ອັນຕະລາຍເພາະ STAGE_SQL ອ່ານ **qc_finish ຄູ່ກັບ time_finish_repair**:
       *   when time_finish_repair is not null and qc_finish is not null then 11 (ລໍສົ່ງຄືນ)
       *   when time_finish_repair is not null                          then 10 (ລໍກວດ QC)
       * ⇒ QC ໄວ້ລ່ວງໜ້າ ແລ້ວພໍຊ່າງກົດຈົບ ວຽກຈະ **ໂດດ 9 → 11 ຂ້າມດ່ານ QC ທັງດ່ານ**
       * ໂດຍບໍ່ມີໃຜຮູ້ — ແລະ ດ່ານກັນຂອງ actions/return (qc_finish is not null) ກໍ່ຜ່ານນຳ.
       *
       * ຍັງບໍ່ມີໃບໃດຕິດຮູນີ້ (ກວດ 4,406 ໃບທີ່ QC ແລ້ວ = 0 ໃບ) — ອຸດກ່ອນມີ.
       */
      const stamped = await client.query(
        `update ${table.name} set qc_finish = localtimestamp(0), qc_by = $2
          where code = $1 and ${table.finishCol} is not null and qc_finish is null
            and ${table.returnedCol} is null ${installActive}`,
        [input.jobCode, session.username],
      );
      if (!stamped.rowCount) {
        await client.query("rollback");
        return {
          ok: false,
          error: "ກວດ QC ບໍ່ໄດ້ — ງານນີ້ຍັງບໍ່ທັນເຮັດສຳເລັດ ຫຼື ຜ່ານ QC ໄປແລ້ວ",
        };
      }
      if (input.signer_name.trim()) {
        await client.query(
          `insert into ods_qc_signature(workflow, job_code, signer_name, signer_tel, signature)
           values($1,$2,$3,nullif($4,''),nullif($5,''))
           on conflict (workflow, job_code) do update
              set signer_name = excluded.signer_name, signer_tel = excluded.signer_tel,
                  signature = excluded.signature, signed_at = localtimestamp(0)`,
          [
            input.workflow,
            input.jobCode,
            input.signer_name.trim(),
            input.signer_tel.trim(),
            input.signature.slice(0, MAX_PHOTO_CHARS),
          ],
        );
      }
    }

    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    console.error("saveQcFlow failed", error);
    return { ok: false, error: "ບັນທຶກບໍ່ສຳເລັດ" };
  } finally {
    client.release();
  }

  await logChange(
    table.model,
    input.jobCode,
    failed.length > 0
      ? `QC ຮອບ ${savedRound} ບໍ່ຜ່ານ ${failed.length}/${input.answers.length} ຂໍ້ — ສົ່ງກັບໃຫ້ຊ່າງແກ້: ${reasons}`
      : `QC ຮອບ ${savedRound} ຜ່ານຄົບ ${input.answers.length} ຂໍ້`,
    { author: session.username },
  );

  return failed.length > 0
    ? { ok: true, message: `QC ບໍ່ຜ່ານ ${failed.length} ຂໍ້ — ສົ່ງກັບໃຫ້ຊ່າງແກ້ແລ້ວ` }
    : { ok: true, message: "QC ຜ່ານ — ງານໄປຂັ້ນຕໍ່ໄປແລ້ວ" };
}
