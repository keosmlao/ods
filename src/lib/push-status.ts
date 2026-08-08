import { query } from "@/lib/db";
import { INSTALL_STAGE_SQL } from "@/lib/install-stage";
import { PUSH_STATUS_ROLES, PUSH_WORKFLOWS, pushStatusOn, type PushStatusRole } from "@/lib/push-status-shared";
import { STAGE_SQL } from "@/lib/stage";

/**
 * **ສະຖານະໃດ ຄວນແຈ້ງໃຜ** — ພາກທີ່ຖາມຖານ. ຕາຕະລາງ/ຄ່າຕັ້ງຕົ້ນຢູ່ lib/push-status-shared.
 */
export * from "@/lib/push-status-shared";

/**
 * ຂັ້ນ**ປັດຈຸບັນ**ຂອງໃບ — ອ່ານຫຼັງການປ່ຽນແປງຖືກບັນທຶກແລ້ວ ⇒ ໄດ້ຂັ້ນ**ໃໝ່** ທີ່ວຽກຫາກໍ່ຍ້າຍເຂົ້າ
 * ເຊິ່ງແມ່ນຂັ້ນທີ່ຄົນຕໍ່ໄປຕ້ອງລົງມື (ບໍ່ແມ່ນຂັ້ນເກົ່າທີ່ຫາກໍ່ອອກມາ).
 *
 * ໃຊ້ `STAGE_SQL` / `INSTALL_STAGE_SQL` **ອັນດຽວກັບຄິວງານ** (lib/dashboard-status)
 * ⇒ ຂັ້ນທີ່ໃຊ້ຕັດສິນການແຈ້ງເຕືອນ ກັບ ຂັ້ນທີ່ຄົນເຫັນຢູ່ໜ້າຄິວ ບໍ່ມີທາງບໍ່ຕົງກັນ.
 *
 * ຄືນ `null` = ໃບປະເພດທີ່**ບໍ່ມີຂັ້ນ** (ic_trans · ar_customer …) ຫຼື ຫາໃບບໍ່ພົບ
 * ⇒ ຜູ້ເອີ້ນຕ້ອງຖອຍໄປໃຊ້ພຶດຕິກຳເກົ່າ ບໍ່ແມ່ນ "ບໍ່ແຈ້ງໃຜ".
 */
export async function statusOf(model: string, resId: string): Promise<{ workflow: string; stage: number } | null> {
  try {
    if (model === "ods_tb_install") {
      const row = (
        await query<{ stage: number }>(
          `select (${INSTALL_STAGE_SQL})::int as stage from ods_tb_install a where a.code = $1`,
          [resId],
        )
      ).rows[0];
      return row ? { workflow: "install", stage: row.stage } : null;
    }
    if (model === "tb_product") {
      const row = (
        await query<{ stage: number; job_kind: string }>(
          `select (${STAGE_SQL})::int as stage, coalesce(a.job_kind,'repair') as job_kind
             from tb_product a where a.code = $1`,
          [resId],
        )
      ).rows[0];
      if (!row) return null;
      return { workflow: row.job_kind === "claim" ? "claim" : "repair", stage: row.stage };
    }
    return null;
  } catch (error) {
    console.error("statusOf failed", error);
    return null;
  }
}

/** ຄ່າທີ່ຜູ້ຈັດການແກ້ເອງ — ຖານລົ້ມ/ຍັງບໍ່ໄດ້ແລ່ນ migration ⇒ Map ຫວ່າງ = ໃຊ້ຄ່າຕັ້ງຕົ້ນໃນໂຄ້ດ */
export async function pushStatusOverrides(): Promise<Map<string, boolean>> {
  try {
    const rows = (
      await query<{ workflow: string; stage: number; role: string; enabled: boolean }>(
        "select workflow, stage, role, enabled from ods_push_status",
      )
    ).rows;
    return new Map(rows.map((row) => [`${row.workflow}:${row.stage}:${row.role}`, row.enabled]));
  } catch (error) {
    console.error("pushStatusOverrides failed", error);
    return new Map();
  }
}

/**
 * ສິດທີ່ຄວນໄດ້ຮັບ push ສຳລັບໃບນີ້ ຢູ່ຂັ້ນປັດຈຸບັນ.
 * `null` = ໃບບໍ່ມີຂັ້ນ ⇒ ຜູ້ເອີ້ນຖອຍໄປໃຊ້ພຶດຕິກຳເກົ່າ · `[]` = ຂັ້ນນີ້ຕັ້ງໃຈບໍ່ແຈ້ງກຸ່ມໃດ.
 */
export async function rolesForPush(model: string, resId: string): Promise<PushStatusRole[] | null> {
  const found = await statusOf(model, resId);
  if (!found) return null;

  /**
   * ── ຂັ້ນທີ່**ບໍ່ມີໃນຕາຕະລາງ** ⇒ ຖອຍໄປໃຊ້ພຶດຕິກຳເກົ່າ ບໍ່ແມ່ນ "ບໍ່ແຈ້ງໃຜ" ──
   * ວັດຈິງ: ມີໃບເຄມນອນຢູ່ຂັ້ນ 8 ("ລໍຖ້າສ້ອມ" ຂອງສາຍສ້ອມ) ເຊິ່ງບໍ່ຢູ່ໃນລາຍການຂັ້ນຂອງເຄມ.
   * ຖ້າຖືວ່າ "ບໍ່ພົບ = ບໍ່ແຈ້ງ" ໃບພວກນີ້ຈະງຽບໄປໂດຍບໍ່ມີໃຜຮູ້ — ແລະ ອັນນີ້ຄືອາການ
   * ດຽວກັນກັບບັນຫາທີ່ພວມແກ້ຢູ່. ຂັ້ນໃໝ່ທີ່ເພີ່ມມາພາຍຫຼັງກໍ່ໄດ້ຜົນຄືກັນ.
   */
  const flow = PUSH_WORKFLOWS.find((row) => row.workflow === found.workflow);
  if (!flow?.stages.some((row) => row.stage === found.stage)) {
    console.warn(`rolesForPush: ${found.workflow} ຂັ້ນ ${found.stage} ບໍ່ມີໃນຕາຕະລາງ — ແຈ້ງຄືເກົ່າໄປກ່ອນ`);
    return null;
  }

  const overrides = await pushStatusOverrides();
  return PUSH_STATUS_ROLES.map((row) => row.role).filter((role) =>
    pushStatusOn(overrides, found.workflow, found.stage, role),
  );
}
