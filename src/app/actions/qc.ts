"use server";
import { logChange } from "@/app/actions/chatter";
import { getSession } from "@/lib/auth";
import type { Workflow } from "@/lib/commission";
import { db, query, queryOdg } from "@/lib/db";
import { roleOf } from "@/lib/roles";
import { revalidatePath } from "next/cache";
import { z } from "zod";

/**
 * ດ່ານກວດຮັບຄຸນນະພາບ (QC gate).
 *
 * ── ຫຼັກການ ──
 * ① **ຄົນເຮັດບໍ່ໄດ້ກວດຂອງຕົນເອງ** — ຊ່າງທີ່ຕິດຕັ້ງ/ສ້ອມ ກວດຮັບງານຕົນເອງບໍ່ໄດ້.
 *    ບໍ່ດັ່ງນັ້ນ QC gate ບໍ່ມີຄວາມໝາຍເລີຍ (ກົດຜ່ານເອງໄດ້).
 * ② **ໃຜກວດໄດ້ ຜູ້ຈັດການກຳນົດ** (ods_qc_role) — ບໍ່ຝັງ role ໄວ້ໃນໂຄດ.
 * ③ **QC ບໍ່ຜ່ານ = ສົ່ງກັບໃຫ້ຊ່າງ** ພ້ອມເຫດຜົນ — ບໍ່ແມ່ນປະໄວ້ຄ້າງ.
 *    ຝັ່ງຕິດຕັ້ງລ້າງ finish_install → ງານກັບໄປ "ກຳລັງຕິດຕັ້ງ"
 *    ຝັ່ງສ້ອມລ້າງ time_finish_repair → ງານກັບໄປ "ກຳລັງສ້ອມແປງ"
 * ④ **ຮູບເປັນ base64 ໃນຖານ** (ຕາມທີ່ຜູ້ຈັດການເລືອກ) ⇒ ຈຳກັດຂະໜາດ ບໍ່ດັ່ງນັ້ນ
 *    ຕາຕະລາງຈະບວມເປັນ GB (ຂອງເກົ່າ 200 KB ຕໍ່ຮູບ).
 */
export type QcState = { error?: string; ok?: string };

/** ເພດານຂະໜາດຮູບ — ຝັ່ງ client ບີບກ່ອນສົ່ງ ອັນນີ້ຄືເກາະປ້ອງກັນຊັ້ນສຸດທ້າຍ */
const MAX_PHOTO_CHARS = 400_000; // ≈ 300 KB ຫຼັງ base64

const TABLE: Record<Workflow, { name: string; finishCol: string; jobLabel: string; model: string }> = {
  install: {
    name: "ods_tb_install",
    finishCol: "finish_install",
    jobLabel: "ງານຕິດຕັ້ງ",
    model: "ods_tb_install",
  },
  repair: {
    name: "tb_product",
    finishCol: "time_finish_repair",
    jobLabel: "ໃບຮັບເຄື່ອງ",
    model: "tb_product",
  },
};

/* ── ດ່ານກວດສິດ ─────────────────────────────────────────────────── */

type Guard =
  | { ok: true; username: string }
  | { ok: false; error: string };

/**
 * ກວດ QC ໄດ້ບໍ — role ຕ້ອງຢູ່ໃນ ods_qc_role **ແລະ** ບໍ່ແມ່ນຄົນທີ່ເຮັດງານນັ້ນເອງ.
 */
async function requireQc(workflow: Workflow, jobCode: string): Promise<Guard> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Session ໝົດອາຍຸ" };

  const allowed = await query<{ n: number }>(
    "select count(*)::int n from ods_qc_role where workflow=$1 and role=$2",
    [workflow, roleOf(session)],
  );
  if (!allowed.rows[0]?.n) return { ok: false, error: "ບໍ່ມີສິດກວດຮັບຄຸນນະພາບ" };

  // ຄົນເຮັດບໍ່ໄດ້ກວດຂອງຕົນເອງ
  const worker = await query<{ who: string | null }>(
    workflow === "install"
      ? "select nullif(tech_code,'') as who from ods_tb_install where code=$1"
      : "select nullif(emp_code,'') as who from tb_product where code=$1",
    [jobCode],
  );
  if (worker.rows[0]?.who === session.username) {
    return { ok: false, error: "ກວດຮັບງານຂອງຕົນເອງບໍ່ໄດ້ — ຕ້ອງໃຫ້ຄົນອື່ນກວດ" };
  }
  return { ok: true, username: session.username };
}

/** ໃຊ້ຢູ່ໜ້າ — ຜູ້ນີ້ກົດປຸ່ມ QC ໄດ້ບໍ (ບໍ່ໂຍນ error) */
export async function canQc(workflow: Workflow, jobCode: string): Promise<boolean> {
  return (await requireQc(workflow, jobCode)).ok;
}

/**
 * ສາຍງານທີ່ role ຂອງຜູ້ນີ້ **ກວດໄດ້** — ອ່ານຈາກ ods_qc_role (ຜູ້ຈັດການກຳນົດ).
 *
 * ໜ້າ /qc ເປີດໃຫ້ທຸກ role ຢູ່ໃນຕາຕະລາງສິດ (lib/roles) ໂດຍເຈດຕະນາ ເພາະ "ໃຜກວດໄດ້"
 * ຢູ່ໃນຖານຂໍ້ມູນ ບໍ່ແມ່ນຢູ່ໃນໂຄດ ⇒ ຖ້າຝັງ role ໄວ້ໃນ RULES ແລ້ວຜູ້ຈັດການເພີ່ມ role ໃໝ່
 * ເຂົ້າ ods_qc_role ຄົນນັ້ນຈະຖືກ proxy ກັ້ນຢູ່ໜ້າປະຕູ ໂດຍທີ່ຕັ້ງຄ່າຖືກແລ້ວ.
 * ດ່ານຈິງຈຶ່ງຢູ່ນີ້ — ໜ້າ /qc ເອີ້ນອັນນີ້ ແລ້ວພາໄປ /forbidden ຖ້າຫວ່າງ.
 */
export async function qcWorkflows(): Promise<Workflow[]> {
  const session = await getSession();
  if (!session) return [];
  const result = await query<{ workflow: Workflow }>("select workflow from ods_qc_role where role = $1", [
    roleOf(session),
  ]);
  return result.rows.map((row) => row.workflow);
}

/* ── ລາຍການ checklist ຂອງງານນຶ່ງງານ ─────────────────────────────── */

export type QcItem = {
  id: number;
  name: string;
  require_photo: boolean;
  passed: boolean | null;
  note: string | null;
  photo: string | null;
};

/**
 * ລາຍການທີ່ຕ້ອງກວດ — ກອງຕາມ **ໝວດສິນຄ້າ ERP** ຂອງງານນັ້ນ
 * (ຕິດຕັ້ງແອ ກັບ ຕິດຕັ້ງໂທລະທັດ ກວດຄົນລະຢ່າງ) ບວກລາຍການທົ່ວໄປ (category_code ຫວ່າງ).
 * ພ້ອມຜົນທີ່ບັນທຶກໄວ້ແລ້ວ (ຖ້າມີ) ⇒ ເປີດຄືນມາແກ້ຕໍ່ໄດ້.
 */
export async function qcChecklist(workflow: Workflow, jobCode: string): Promise<QcItem[]> {
  // ໝວດຂອງງານ — ຢູ່ ERP ຈຶ່ງຕ້ອງຖາມສອງຈັງຫວະ (join ຂ້າມຖານບໍ່ໄດ້)
  const job = await query<{ item_code: string | null }>(
    workflow === "install"
      ? "select item_code from ods_tb_install where code=$1"
      : "select item_code from tb_product where code=$1",
    [jobCode],
  );
  let category: string | null = null;
  const itemCode = job.rows[0]?.item_code;
  if (itemCode) {
    const erp = await queryOdg<{ item_category: string | null }>(
      "select item_category from ic_inventory where code=$1",
      [itemCode],
    );
    category = erp.rows[0]?.item_category ?? null;
  }

  const result = await query<QcItem>(
    `select i.id, i.name, i.require_photo,
        r.passed, r.note, r.photo
      from ods_qc_item i
      left join ods_qc_result r
        on r.item_id = i.id and r.workflow = $1 and r.job_code = $2
     where i.workflow = $1 and i.is_active
       and (i.category_code is null or i.category_code = $3)
     order by i.sort_order, i.id`,
    [workflow, jobCode, category],
  );
  return result.rows;
}

/* ── ບັນທຶກຜົນ QC ───────────────────────────────────────────────── */

const saveSchema = z.object({
  workflow: z.enum(["repair", "install"]),
  job_code: z.string().min(1),
  signer_name: z.string(),
  signer_tel: z.string(),
  signature: z.string(),
});

export type QcAnswer = { item_id: number; passed: boolean; note: string; photo: string };

/**
 * ບັນທຶກຜົນ QC.
 *
 * ຜ່ານທຸກຂໍ້ → stamp qc_finish ⇒ ງານໄປຂັ້ນຕໍ່ໄປ (ລໍແບບປະເມີນ / ລໍສົ່ງຄືນ).
 * ຕົກຂໍ້ໃດຂໍ້ນຶ່ງ → **ສົ່ງກັບໃຫ້ຊ່າງ** (ລ້າງ finish_install / time_finish_repair)
 *   ⇒ ງານກັບໄປ "ກຳລັງຕິດຕັ້ງ" / "ກຳລັງສ້ອມແປງ" ພ້ອມເຫດຜົນຢູ່ chatter.
 */
export async function saveQc(_: QcState, formData: FormData): Promise<QcState> {
  const parsed = saveSchema.safeParse({
    workflow: formData.get("workflow"),
    job_code: formData.get("job_code"),
    signer_name: formData.get("signer_name") ?? "",
    signer_tel: formData.get("signer_tel") ?? "",
    signature: formData.get("signature") ?? "",
  });
  if (!parsed.success) return { error: "ຂໍ້ມູນບໍ່ຄົບ" };
  const { workflow, job_code: jobCode } = parsed.data;

  const guard = await requireQc(workflow, jobCode);
  if (!guard.ok) return { error: guard.error };
  if (!db) return { error: "ບໍ່ພົບ DATABASE_URL" };

  // ຄຳຕອບມາເປັນ JSON ກ້ອນດຽວ (ຮູບ base64 ຍາວ ⇒ ໃສ່ field ແຍກແລ້ວອ່ານຍາກ)
  let answers: QcAnswer[];
  try {
    answers = JSON.parse(String(formData.get("answers") ?? "[]"));
  } catch {
    return { error: "ຂໍ້ມູນຜົນກວດບໍ່ຖືກຕ້ອງ" };
  }
  if (answers.length === 0) return { error: "ຍັງບໍ່ໄດ້ກວດຈັກຂໍ້" };

  // ລາຍການທີ່ຕ້ອງກວດ — ກັນການສົ່ງ item ຂອງງານອື່ນ ຫຼື ຂ້າມຂໍ້ທີ່ບັງຄັບຮູບ
  const items = await qcChecklist(workflow, jobCode);
  const itemById = new Map(items.map((item) => [item.id, item]));

  for (const answer of answers) {
    const item = itemById.get(answer.item_id);
    if (!item) return { error: "ພົບລາຍການກວດທີ່ບໍ່ແມ່ນຂອງງານນີ້" };
    if (answer.photo && answer.photo.length > MAX_PHOTO_CHARS) {
      return { error: `ຮູບຂອງ "${item.name}" ໃຫຍ່ເກີນໄປ — ກະລຸນາຖ່າຍໃໝ່` };
    }
    if (item.require_photo && answer.passed && !answer.photo) {
      return { error: `"${item.name}" ຕ້ອງແນບຮູບ` };
    }
  }
  if (answers.length !== items.length) return { error: "ຕ້ອງກວດໃຫ້ຄົບທຸກຂໍ້" };

  const failed = answers.filter((answer) => !answer.passed);
  const table = TABLE[workflow];

  const client = await db.connect();
  try {
    await client.query("begin");

    for (const answer of answers) {
      await client.query(
        `insert into ods_qc_result(workflow, job_code, item_id, passed, note, photo, checked_by)
         values($1,$2,$3,$4,nullif($5,''),nullif($6,''),$7)
         on conflict (workflow, job_code, item_id) do update
            set passed = excluded.passed, note = excluded.note, photo = excluded.photo,
                checked_by = excluded.checked_by, checked_at = localtimestamp(0)`,
        [workflow, jobCode, answer.item_id, answer.passed, answer.note ?? "", answer.photo ?? "", guard.username],
      );
    }

    if (failed.length > 0) {
      /**
       * ຕົກ QC → **ສົ່ງກັບໃຫ້ຊ່າງ**: ລ້າງຖັນ "ສຳເລັດ" ⇒ ງານກັບໄປຂັ້ນ "ກຳລັງ…"
       * ບໍ່ແມ່ນປະໄວ້ຄ້າງຢູ່ຂັ້ນ QC (ບໍ່ດັ່ງນັ້ນຊ່າງບໍ່ຮູ້ວ່າຕ້ອງກັບໄປແກ້).
       * qc_finish ຍັງເປັນ null ຢູ່ແລ້ວ ຈຶ່ງບໍ່ຕ້ອງລ້າງ.
       */
      await client.query(`update ${table.name} set ${table.finishCol} = null where code = $1`, [jobCode]);
    } else {
      await client.query(
        `update ${table.name} set qc_finish = localtimestamp(0), qc_by = $2 where code = $1`,
        [jobCode, guard.username],
      );
      // ລາຍເຊັນລູກຄ້າ — ບັນທຶກກໍ່ຕໍ່ເມື່ອຜ່ານ (ລູກຄ້າຮັບມອບງານທີ່ຜ່ານແລ້ວ)
      if (parsed.data.signer_name.trim()) {
        await client.query(
          `insert into ods_qc_signature(workflow, job_code, signer_name, signer_tel, signature)
           values($1,$2,$3,nullif($4,''),nullif($5,''))
           on conflict (workflow, job_code) do update
              set signer_name = excluded.signer_name, signer_tel = excluded.signer_tel,
                  signature = excluded.signature, signed_at = localtimestamp(0)`,
          [
            workflow,
            jobCode,
            parsed.data.signer_name.trim(),
            parsed.data.signer_tel.trim(),
            parsed.data.signature.slice(0, MAX_PHOTO_CHARS),
          ],
        );
      }
    }

    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    console.error("saveQc failed", error);
    return { error: "ບັນທຶກບໍ່ສຳເລັດ" };
  } finally {
    client.release();
  }

  const reasons = failed
    .map((answer) => `${itemById.get(answer.item_id)?.name}${answer.note ? ` (${answer.note})` : ""}`)
    .join(" · ");

  await logChange(
    table.model,
    jobCode,
    failed.length > 0
      ? `QC ບໍ່ຜ່ານ ${failed.length}/${answers.length} ຂໍ້ — ສົ່ງກັບໃຫ້ຊ່າງແກ້: ${reasons}`
      : `QC ຜ່ານຄົບ ${answers.length} ຂໍ້`,
  );

  revalidatePath(`/qc/${workflow}/${jobCode}`);
  revalidatePath("/qc");
  revalidatePath("/dashboard");
  return failed.length > 0
    ? { ok: `QC ບໍ່ຜ່ານ ${failed.length} ຂໍ້ — ສົ່ງກັບໃຫ້ຊ່າງແກ້ແລ້ວ` }
    : { ok: "QC ຜ່ານ — ງານໄປຂັ້ນຕໍ່ໄປແລ້ວ" };
}
