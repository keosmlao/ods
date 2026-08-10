import { query } from "@/lib/db";
import { logChange } from "@/lib/chatter-log";
import { pushToUser } from "@/lib/push";

/**
 * **ຊ່າງຮ່ວມ — 1 ໃບງານ ໃສ່ຊ່າງໄດ້ຫຼາຍຄົນ** (10-08-2026 ຕາມຄຳສັ່ງ).
 *
 * ── ຮູບແບບ: ຫົວໜ້າ 1 ຄົນ + ຊ່າງຮ່ວມ N ຄົນ ──
 * **ຫົວໜ້າ** ຢູ່ຊ່ອງເກົ່າຂອງແຕ່ລະຕາຕະລາງ (`ods_tb_install.tech_code` ·
 * `tb_product.emp_code` · `ods_tb_maintenance.emp_code`) ⇒ ລາຍງານ · ຄິວ · ERP ·
 * ໜ້າເວັບທັງໝົດທີ່ອ່ານຊ່ອງນັ້ນ ບໍ່ຕ້ອງແກ້ຈັກແຖວ ແລະ ຍັງມີ "ຄົນຮັບຜິດຊອບ" ຄົນດຽວຊັດເຈນ.
 * **ຊ່າງຮ່ວມ** ຢູ່ `ods_job_tech` ⇒ ໄດ້ສິດ **ເຫັນງານໃນແອັບ · check-in/out · ຖ່າຍຮູບ ·
 * ເກັບ ISN/SN** ແຕ່ **ຮັບງານ/ຈົບງານ ເປັນຂອງຫົວໜ້າຄົນດຽວ** (ຕົກລົງ 10-08-2026) —
 * ບໍ່ດັ່ງນັ້ນ 2 ຄົນກົດຈົບພ້ອມກັນ ແລ້ວບໍ່ຮູ້ວ່າໃຜຮັບຜິດຊອບຜົນງານ.
 *
 * ── ຄ່າຄອມບໍ່ຕ້ອງແກ້ ──
 * `lib/commission` ແບ່ງຕາມ **ຮອບ check-in ຈິງ** ຢູ່ແລ້ວ ⇒ ຊ່າງຮ່ວມທີ່ໄປໜ້າງານຈິງ
 * ໄດ້ສ່ວນແບ່ງເອງ · ຄົນທີ່ໃສ່ຊື່ໄວ້ແຕ່ບໍ່ໄດ້ໄປ ບໍ່ໄດ້ຫຍັງ (ຖືກຕ້ອງກວ່າການແບ່ງຕາມລາຍຊື່).
 */

export type TechWorkflow = "install" | "repair" | "maintenance";

/** ຕາຕະລາງ chatter ຂອງແຕ່ລະສາຍງານ — ໃຫ້ປະຫວັດການໃສ່/ຖອດຊ່າງລົງໃບງານນັ້ນ */
const CHATTER_MODEL: Record<TechWorkflow, string> = {
  install: "ods_tb_install",
  repair: "tb_product",
  maintenance: "ods_tb_maintenance",
};

const JOB_WORD: Record<TechWorkflow, string> = {
  install: "ຕິດຕັ້ງ",
  repair: "ສ້ອມ",
  maintenance: "ບຳລຸງຮັກສາ",
};

/**
 * ເງື່ອນໄຂ SQL "ຄົນນີ້ເປັນຊ່າງຮ່ວມຂອງງານແຖວນີ້ບໍ" — ໃສ່ໃນ where ຂອງລາຍການວຽກ.
 *
 * `jobColumn` = ຖັນລະຫັດງານຂອງ query ນັ້ນ (ປົກກະຕິ `a.code`) · `param` = ຕົວແປຂອງ
 * ລະຫັດຊ່າງ. ເອົາໄວ້ບ່ອນດຽວ ເພື່ອໃຫ້ 3 ສາຍງານຖາມຄືກັນ ແລະ ບໍ່ລືມ workflow.
 */
export const IS_HELPER_SQL = (workflow: TechWorkflow, jobColumn = "a.code", param = "$1") =>
  `exists (select 1 from ods_job_tech t
            where t.workflow = '${workflow}' and t.job_code = ${jobColumn} and t.tech_code = ${param})`;

/** ຊ່າງຮ່ວມຂອງໃບງານ (ບໍ່ລວມຫົວໜ້າ) */
export async function jobHelpers(workflow: TechWorkflow, code: string): Promise<string[]> {
  return (
    await query<{ tech_code: string }>(
      `select tech_code from ods_job_tech
        where workflow=$1 and job_code=$2 order by added_at, tech_code`,
      [workflow, code],
    )
  ).rows.map((row) => row.tech_code);
}

/** ຄົນນີ້ເປັນຊ່າງຮ່ວມຂອງງານນີ້ບໍ (ຫົວໜ້າບໍ່ນັບ — ກວດຊ່ອງເກົ່າແຍກຕ່າງຫາກ) */
export async function isJobHelper(
  workflow: TechWorkflow,
  code: string,
  tech: string,
): Promise<boolean> {
  if (!tech) return false;
  return Boolean(
    (
      await query<{ n: number }>(
        `select count(*)::int n from ods_job_tech
          where workflow=$1 and job_code=$2 and tech_code=$3`,
        [workflow, code, tech],
      )
    ).rows[0]?.n,
  );
}

/** ຊ່າງທັງໝົດຂອງງານ (ຫົວໜ້າກ່ອນ ແລ້ວຊ່າງຮ່ວມ) — ໃຫ້ໜ້າສະແດງ ແລະ ການແຈ້ງເຕືອນ */
export async function jobTeam(
  workflow: TechWorkflow,
  code: string,
  lead: string | null,
): Promise<string[]> {
  const helpers = await jobHelpers(workflow, code);
  const clean = (lead ?? "").trim();
  return clean ? [clean, ...helpers.filter((tech) => tech !== clean)] : helpers;
}

/** ແປງຄ່າຈາກຟອມ ("A,B,C") ເປັນລາຍຊື່ສະອາດ — ບໍ່ຊ້ຳ ແລະ ບໍ່ມີຫົວໜ້າປົນ */
export function parseHelpers(raw: FormDataEntryValue | null, lead: string): string[] {
  return [
    ...new Set(
      String(raw ?? "")
        .split(",")
        .map((tech) => tech.trim())
        .filter((tech) => tech && tech !== lead.trim()),
    ),
  ];
}

/**
 * ຕັ້ງລາຍຊື່ຊ່າງຮ່ວມຂອງໃບງານ (ແທນລາຍເກົ່າທັງໝົດ).
 *
 * ຂຽນສະເພາະ**ສ່ວນທີ່ຕ່າງ** ແລ້ວລົງປະຫວັດ + ແຈ້ງເຕືອນສະເພາະຄົນທີ່ຖືກເພີ່ມໃໝ່ —
 * ບັນທຶກຊ້ຳທັງລາຍຊື່ເກົ່າ ບໍ່ຄວນຍິງແຈ້ງເຕືອນຫາທຸກຄົນອີກຮອບ.
 */
export async function setJobHelpers(
  workflow: TechWorkflow,
  code: string,
  helpers: string[],
  options: { by: string; notify?: boolean } = { by: "" },
): Promise<{ added: string[]; removed: string[] }> {
  const wanted = [...new Set(helpers.map((tech) => tech.trim()).filter(Boolean))];
  const current = await jobHelpers(workflow, code);
  const added = wanted.filter((tech) => !current.includes(tech));
  const removed = current.filter((tech) => !wanted.includes(tech));
  if (!added.length && !removed.length) return { added, removed };

  if (removed.length) {
    await query(
      `delete from ods_job_tech where workflow=$1 and job_code=$2 and tech_code = any($3::varchar[])`,
      [workflow, code, removed],
    );
  }
  for (const tech of added) {
    await query(
      `insert into ods_job_tech(workflow, job_code, tech_code, added_by)
       values($1,$2,$3,$4) on conflict do nothing`,
      [workflow, code, tech, options.by || null],
    );
  }

  await logChange(
    CHATTER_MODEL[workflow],
    code,
    [
      added.length ? `ເພີ່ມຊ່າງຮ່ວມ: ${added.join(" · ")}` : "",
      removed.length ? `ຖອດຊ່າງຮ່ວມ: ${removed.join(" · ")}` : "",
    ]
      .filter(Boolean)
      .join(" · "),
    { author: options.by || undefined, users: added },
  );

  // ຊ່າງຮ່ວມຢູ່ໜ້າງານ ບໍ່ໄດ້ເປີດເວັບຄ້າງໄວ້ ⇒ ຕ້ອງເດັ້ງອອກມືຖື (ລົ້ມກໍ່ບໍ່ກະທົບການມອບໝາຍ)
  if (options.notify !== false) {
    for (const tech of added) {
      await pushToUser(tech, `ຖືກເພີ່ມເປັນຊ່າງຮ່ວມ (${JOB_WORD[workflow]})`, code, {
        workflow,
        code,
      });
    }
  }
  return { added, removed };
}

/** ລຶບຊ່າງຮ່ວມທັງໝົດ (ໃຊ້ຕອນດຶງງານກັບຄິວຈັດຊ່າງ / ຍົກເລີກງານ) */
export async function clearJobHelpers(workflow: TechWorkflow, code: string): Promise<void> {
  await query("delete from ods_job_tech where workflow=$1 and job_code=$2", [workflow, code]);
}
