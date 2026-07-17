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
 * ③ ຕົກ QC = ລ້າງຖັນ "ສຳເລັດ" ⇒ ງານກັບໄປຫາຊ່າງ ພ້ອມເຫດຜົນ
 */

export const MAX_PHOTO_CHARS = 400_000;

/**
 * `finishCol` = ຖັນ "ເຮັດວຽກຈົບ" (ເງື່ອນໄຂເຂົ້າດ່ານ QC) ·
 * `returnedCol` = ຖັນ "ປິດງານແລ້ວ" (ຫຼັງຈາກນີ້ QC ແຕະບໍ່ໄດ້ອີກ).
 */
const TABLE: Record<Workflow, { name: string; finishCol: string; returnedCol: string; model: string }> = {
  install: { name: "ods_tb_install", finishCol: "finish_install", returnedCol: "job_finish", model: "ods_tb_install" },
  repair: { name: "tb_product", finishCol: "time_finish_repair", returnedCol: "return_complete", model: "tb_product" },
};

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

  return (
    await query<QcItem>(
      `select i.id, i.name, i.require_photo, r.passed, r.note, r.photo
         from ods_qc_item i
         left join ods_qc_result r
           on r.item_id = i.id and r.workflow = $1 and r.job_code = $2
        where i.workflow = $1 and i.is_active
          and (i.category_code is null or i.category_code = $3)
        order by i.sort_order, i.id`,
      [workflow, jobCode, category],
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
 * ຕົກຂໍ້ໃດຂໍ້ນຶ່ງ → ລ້າງຖັນ "ສຳເລັດ" ⇒ **ງານກັບໄປຫາຊ່າງ** ພ້ອມເຫດຜົນຢູ່ chatter.
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
    if (item.require_photo && answer.passed && !answer.photo) {
      return { ok: false, error: `"${item.name}" ຕ້ອງແນບຮູບ` };
    }
  }
  if (input.answers.length !== items.length) return { ok: false, error: "ຕ້ອງກວດໃຫ້ຄົບທຸກຂໍ້" };

  const failed = input.answers.filter((answer) => !answer.passed);
  const table = TABLE[input.workflow];

  const client = await db.connect();
  try {
    await client.query("begin");

    for (const answer of input.answers) {
      await client.query(
        `insert into ods_qc_result(workflow, job_code, item_id, passed, note, photo, checked_by)
         values($1,$2,$3,$4,nullif($5,''),nullif($6,''),$7)
         on conflict (workflow, job_code, item_id) do update
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
        ],
      );
    }

    if (failed.length > 0) {
      /**
       * ສົ່ງກັບໃຫ້ຊ່າງ — ລ້າງຖັນ "ສຳເລັດ" (qc_finish ຍັງເປັນ null ຢູ່ແລ້ວ).
       * ດ່ານດຽວກັນກັບກິ່ງ "ຜ່ານ": ງານທີ່ **ສົ່ງຄືນລູກຄ້າໄປແລ້ວ** ຫ້າມແຕະ —
       * ບໍ່ດັ່ງນັ້ນ QC ຍ້ອນຫຼັງຈະລຶບເວລາເຮັດວຽກຈົບຖິ້ມ ໂດຍວຽກຍັງຄ້າງຂັ້ນ "ສົ່ງຄືນສຳເລັດ".
       */
      const sentBack = await client.query(
        `update ${table.name} set ${table.finishCol} = null
          where code = $1 and ${table.finishCol} is not null and ${table.returnedCol} is null`,
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
          where code = $1 and ${table.finishCol} is not null and qc_finish is null`,
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

  const reasons = failed
    .map((answer) => `${itemById.get(answer.item_id)?.name}${answer.note ? ` (${answer.note})` : ""}`)
    .join(" · ");

  await logChange(
    table.model,
    input.jobCode,
    failed.length > 0
      ? `QC ບໍ່ຜ່ານ ${failed.length}/${input.answers.length} ຂໍ້ — ສົ່ງກັບໃຫ້ຊ່າງແກ້: ${reasons}`
      : `QC ຜ່ານຄົບ ${input.answers.length} ຂໍ້`,
  );

  return failed.length > 0
    ? { ok: true, message: `QC ບໍ່ຜ່ານ ${failed.length} ຂໍ້ — ສົ່ງກັບໃຫ້ຊ່າງແກ້ແລ້ວ` }
    : { ok: true, message: "QC ຜ່ານ — ງານໄປຂັ້ນຕໍ່ໄປແລ້ວ" };
}
