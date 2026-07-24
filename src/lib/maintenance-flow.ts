import type { Session } from "@/lib/auth";
import { logChange } from "@/lib/chatter-log";
import { query } from "@/lib/db";
import type { FlowResult } from "@/lib/job-flow";
import { MAINTENANCE_STAGE_SQL } from "@/lib/maintenance-stage";
import { roleOf } from "@/lib/roles";

/**
 * ຂັ້ນຕອນງານ **ບຳລຸງຮັກສາ (ລ້າງແອ)** ທີ່ຊ່າງລົງມືຈາກແອັບ.
 *
 * ຄູ່ກັບ lib/job-flow (ສ້ອມ/ຕິດຕັ້ງ) — ຫຼັກການດຽວກັນ:
 * **ເງື່ອນໄຂຂັ້ນຢູ່ໃນ WHERE ເອງ** ⇒ ຍິງຄຳສັ່ງໃສ່ວຽກທີ່ບໍ່ໄດ້ຢູ່ຂັ້ນນັ້ນ = ບໍ່ມີຫຍັງເກີດຂຶ້ນ
 * ແລະ ສອງເຄື່ອງກົດພ້ອມກັນກໍ່ບໍ່ຊ້ຳ. ຂັ້ນ: 1 ລໍຊ່າງຮັບ · 2 ລໍໄປລ້າງ · 3 ກຳລັງລ້າງ.
 */

const NOW = "localtimestamp(0)";
const MODEL = "ods_tb_maintenance";

/** ຊ່າງແຕະໄດ້ແຕ່ວຽກຂອງຕົນ (ຫົວໜ້າ/ຜູ້ຈັດການແຕະໄດ້ໝົດ) — ຄືກົດເກນຂອງສ້ອມ/ຕິດຕັ້ງ */
export async function ownMaintenanceJob(session: Session, code: string): Promise<FlowResult> {
  const row = (
    await query<{ tech: string | null; cancelled: boolean }>(
      `select nullif(emp_code,'') as tech, cancel_date is not null as cancelled
         from ${MODEL} where code = $1`,
      [code],
    )
  ).rows[0];
  if (!row) return { ok: false, error: "ບໍ່ພົບງານນີ້" };
  if (row.cancelled) return { ok: false, error: "ງານນີ້ຖືກຍົກເລີກແລ້ວ" };
  if (roleOf(session) === "technical" && (row.tech ?? "") !== session.username) {
    return { ok: false, error: "ງານນີ້ບໍ່ແມ່ນຂອງທ່ານ" };
  }
  return { ok: true, message: "" };
}

/** ຄຳສັ່ງດຽວ: stamp ຖັນເວລາ ຖ້າວຽກຢູ່ຂັ້ນທີ່ຖືກຕ້ອງ */
async function advance(
  session: Session,
  code: string,
  column: "tech_confirm" | "start_clean" | "finish_clean",
  stage: number,
  log: string,
  message: string,
): Promise<FlowResult> {
  const own = await ownMaintenanceJob(session, code);
  if (!own.ok) return own;

  const done = await query(
    `update ${MODEL} a set ${column} = ${NOW}
      where a.code = $1 and a.${column} is null and (${MAINTENANCE_STAGE_SQL}) = ${stage}`,
    [code],
  );
  if (!done.rowCount) {
    return { ok: false, error: `ບັນທຶກບໍ່ໄດ້ — ງານບໍ່ໄດ້ຢູ່ຂັ້ນທີ່ຄາດໄວ້ ຫຼື ເຮັດໄປແລ້ວ` };
  }

  // ຜູ້ຈັດການຕ້ອງເຫັນທຸກການເຄື່ອນໄຫວ — ສົ່ງຊື່ຊ່າງເປັນ author ເພາະຄຳສັ່ງມາຈາກແອັບ (ບໍ່ມີ cookie)
  await logChange(MODEL, code, log, { author: session.username, roles: ["admin", "manager"] });
  return { ok: true, message };
}

export const acceptMaintenance = (session: Session, code: string) =>
  advance(session, code, "tech_confirm", 1, "ຊ່າງຮັບງານບຳລຸງຮັກສາ", `ຮັບງານ ${code} ສຳເລັດ`);

export const startMaintenance = (session: Session, code: string) =>
  advance(session, code, "start_clean", 2, "ເລີ່ມລ້າງ", `ເລີ່ມລ້າງ ${code}`);

export const finishMaintenance = (session: Session, code: string) =>
  advance(session, code, "finish_clean", 3, "ລ້າງສຳເລັດ — ລໍຖ້າກວດ QC", `ລ້າງ ${code} ສຳເລັດ — ລໍ QC`);
