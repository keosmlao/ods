"use server";
import { query } from "@/lib/db";
import { requireRole } from "@/lib/guard";
import { pushToUser } from "@/lib/push";
import { PUSH_EVENT_KINDS, PUSH_MODELS } from "@/lib/push-event-shared";
import { PUSH_STATUS_ROLES, PUSH_WORKFLOWS } from "@/lib/push-status-shared";
import { PUSH_KINDS, type PushKind } from "@/lib/push-recipient";
import { APPROVER_SIDE } from "@/lib/roles";
import { revalidatePath } from "next/cache";

/**
 * ກຳນົດຜູ້ຮັບແຈ້ງເຕືອນເຂົ້າມືຖື — ໜ້າ /manage/push-recipients.
 * ກົດ/ຄວາມໝາຍຂອງ active: ເບິ່ງ lib/push-recipient (ບໍ່ມີແຖວ = ຕາມ role ຄືເກົ່າ).
 */
const PATH = "/manage/push-recipients";

export type PushRecipientState = { error?: string; sent?: number };

function validKind(kind: string): kind is PushKind {
  return (PUSH_KINDS as readonly string[]).includes(kind);
}

/**
 * ຊ່ວງ **deploy ໂຄດແລ້ວ ແຕ່ຍັງບໍ່ໄດ້ແລ່ນ migration** (ໂປຣເຈັກນີ້ແລ່ນ migration ດ້ວຍມື —
 * docs/06-deploy.md) ⇒ ຕາຕະລາງຍັງບໍ່ມີ. ບອກໃຫ້ຮູ້ວ່າຕ້ອງເຮັດຫຍັງ ດີກວ່າໜ້າຈໍລົ້ມເສີຍໆ.
 */
const MISSING_TABLE = "42P01";

async function guardedWrite(run: () => Promise<unknown>): Promise<PushRecipientState> {
  try {
    await run();
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === MISSING_TABLE) {
      return { error: "ຍັງບໍ່ໄດ້ແລ່ນ migration 2026-08-08-push-recipients.sql ໃສ່ຖານ ⇒ ບັນທຶກບໍ່ໄດ້" };
    }
    console.error("push recipient write failed", error);
    return { error: "ບັນທຶກບໍ່ສຳເລັດ" };
  }
  revalidatePath(PATH);
  return {};
}

/** ເປີດ/ປິດຜູ້ຮັບຄົນນຶ່ງ — ບັນທຶກເປັນແຖວສະເໝີ ເພື່ອໃຫ້ "ຕັ້ງໃຈເລືອກ" ຕ່າງຈາກ "ຍັງບໍ່ໄດ້ຕັ້ງ" */
export async function setPushRecipient(
  kind: string,
  username: string,
  active: boolean,
): Promise<PushRecipientState> {
  const guard = await requireRole(APPROVER_SIDE, "ບໍ່ມີສິດກຳນົດຜູ້ຮັບແຈ້ງເຕືອນ");
  if (!guard.ok) return { error: guard.error };
  if (!validKind(kind)) return { error: "ປະເພດບໍ່ຖືກຕ້ອງ" };

  const name = username.trim();
  if (!name) return { error: "ບໍ່ມີຊື່ຜູ້ໃຊ້" };

  return guardedWrite(() =>
    query(
      `insert into ods_push_recipient(kind, username, active, updated_by)
       values($1,$2,$3,$4)
       on conflict (kind, username) do update
          set active = excluded.active, updated_by = excluded.updated_by, updated_at = localtimestamp(0)`,
      [kind, name, active, guard.session.username],
    ),
  );
}

/** ລ້າງການກຳນົດຂອງປະເພດນຶ່ງ ⇒ ກັບໄປສົ່ງຕາມ role ຄືເກົ່າ */
export async function resetPushRecipients(kind: string): Promise<PushRecipientState> {
  const guard = await requireRole(APPROVER_SIDE, "ບໍ່ມີສິດກຳນົດຜູ້ຮັບແຈ້ງເຕືອນ");
  if (!guard.ok) return { error: guard.error };
  if (!validKind(kind)) return { error: "ປະເພດບໍ່ຖືກຕ້ອງ" };

  return guardedWrite(() => query(`delete from ods_push_recipient where kind = $1`, [kind]));
}

/**
 * **ຍິງອັນໃດເຂົ້າແອັບ** — ເປີດ/ປິດ Firebase push ຂອງ (ປະເພດງານ × ປະເພດເຫດການ).
 * ⚠️ ບໍ່ແຕະກ່ອງແຈ້ງເຕືອນ: ແຖວຍັງຂຽນລົງ ods_notification ຄົບ ⇒ ເວັບ/ແອັບຍັງເຫັນທຸກຢ່າງ.
 */
export async function setPushEvent(model: string, kind: string, enabled: boolean): Promise<PushRecipientState> {
  const guard = await requireRole(APPROVER_SIDE, "ບໍ່ມີສິດກຳນົດແຈ້ງເຕືອນ");
  if (!guard.ok) return { error: guard.error };

  const okModel = PUSH_MODELS.some((row) => row.model === model);
  const okKind = PUSH_EVENT_KINDS.some((row) => row.kind === kind);
  if (!okModel || !okKind) return { error: "ປະເພດບໍ່ຖືກຕ້ອງ" };

  return guardedWrite(() =>
    query(
      `insert into ods_push_event(model, kind, enabled, updated_by)
       values($1,$2,$3,$4)
       on conflict (model, kind) do update
          set enabled = excluded.enabled, updated_by = excluded.updated_by, updated_at = localtimestamp(0)`,
      [model, kind, enabled, guard.session.username],
    ),
  );
}

/**
 * **ສະຖານະໃດ ຄວນແຈ້ງໃຜ** — ເປີດ/ປິດ push ຂອງ (ສາຍງານ × ຂັ້ນ × ສິດ).
 * ບັນທຶກທຸກຄັ້ງທີ່ກົດ (ເຖິງຄ່າຈະຕົງກັບຄ່າຕັ້ງຕົ້ນ) ⇒ "ຜູ້ຈັດການຢືນຢັນແລ້ວ" ຕ່າງຈາກ "ຍັງບໍ່ເຄີຍແຕະ".
 */
export async function setPushStatus(
  workflow: string,
  stage: number,
  role: string,
  enabled: boolean,
): Promise<PushRecipientState> {
  const guard = await requireRole(APPROVER_SIDE, "ບໍ່ມີສິດກຳນົດແຈ້ງເຕືອນ");
  if (!guard.ok) return { error: guard.error };

  const flow = PUSH_WORKFLOWS.find((row) => row.workflow === workflow);
  const okStage = flow?.stages.some((row) => row.stage === stage);
  const okRole = PUSH_STATUS_ROLES.some((row) => row.role === role);
  if (!flow || !okStage || !okRole) return { error: "ສະຖານະ ຫຼື ສິດ ບໍ່ຖືກຕ້ອງ" };

  return guardedWrite(() =>
    query(
      `insert into ods_push_status(workflow, stage, role, enabled, updated_by)
       values($1,$2,$3,$4,$5)
       on conflict (workflow, stage, role) do update
          set enabled = excluded.enabled, updated_by = excluded.updated_by, updated_at = localtimestamp(0)`,
      [workflow, stage, role, enabled, guard.session.username],
    ),
  );
}

/** ລ້າງການແກ້ຂອງສາຍງານນຶ່ງ ⇒ ກັບໄປໃຊ້ຄ່າຕັ້ງຕົ້ນທີ່ຢູ່ໃນໂຄ້ດ */
export async function resetPushStatus(workflow: string): Promise<PushRecipientState> {
  const guard = await requireRole(APPROVER_SIDE, "ບໍ່ມີສິດກຳນົດແຈ້ງເຕືອນ");
  if (!guard.ok) return { error: guard.error };
  if (!PUSH_WORKFLOWS.some((row) => row.workflow === workflow)) return { error: "ສາຍງານບໍ່ຖືກຕ້ອງ" };

  return guardedWrite(() => query("delete from ods_push_status where workflow = $1", [workflow]));
}

/**
 * ຍິງທົດສອບໃສ່ຄົນດຽວ — ພິສູດວ່າ "ຕັ້ງຄ່າແລ້ວ ແລະ ເຄື່ອງລາວຮັບໄດ້ຈິງ".
 * ບໍ່ຜ່ານ applyPushChoice ໂດຍຕັ້ງໃຈ: ນີ້ຄືການທົດສອບເສັ້ນທາງ ບໍ່ແມ່ນການແຈ້ງເຕືອນຈິງ.
 */
export async function sendTestPush(username: string): Promise<PushRecipientState> {
  const guard = await requireRole(APPROVER_SIDE, "ບໍ່ມີສິດທົດສອບ");
  if (!guard.ok) return { error: guard.error };

  const name = username.trim();
  if (!name) return { error: "ບໍ່ມີຊື່ຜູ້ໃຊ້" };

  const devices = (
    await query<{ n: number }>("select count(*)::int n from ods_push_token where lower(user_code) = lower($1)", [
      name,
    ])
  ).rows[0]?.n;
  if (!devices) return { error: `“${name}” ຍັງບໍ່ມີເຄື່ອງລົງທະບຽນ — ໃຫ້ລາວ login ແອັບ ແລະ ອະນຸຍາດການແຈ້ງເຕືອນກ່ອນ` };

  await pushToUser(name, "ທົດສອບແຈ້ງເຕືອນ", `ສົ່ງໂດຍ ${guard.session.username}`, { kind: "test" });
  return { sent: devices };
}
