import type { Workflow } from "@/lib/commission";
import { query } from "@/lib/db";
import { INSTALL_STAGE_SQL } from "@/lib/install-stage";
import { pushToUser } from "@/lib/push";
import { STAGE_SQL } from "@/lib/stage";

/**
 * **ວຽກກັບມາຢູ່ມືຊ່າງ ⇒ ແຈ້ງເຂົ້າແອັບ.**
 *
 * ── ບັນຫາທີ່ແກ້ ──
 * ແຕ່ກ່ອນແຈ້ງເຕືອນອອກແອັບ **ສະເພາະຕອນມອບໝາຍງານ** (ເປີດໃບ / ຈັດຊ່າງ) ເທົ່ານັ້ນ.
 * ແຕ່ວຽກ **ກັບມາຫາຊ່າງອີກຫຼາຍຮອບ** ໂດຍທີ່ຊ່າງບໍ່ຮູ້ເລີຍ:
 *   • ອາໄຫຼ່ມາຮອດ → "ລໍຖ້າສ້ອມແປງ"  (ຊ່າງລໍອາໄຫຼ່ຢູ່ ແຕ່ບໍ່ມີໃຜບອກວ່າມາແລ້ວ)
 *   • ອະນຸມັດລາຄາແລ້ວ → ສ້ອມຕໍ່ໄດ້
 *   • ຮັບເຄື່ອງເຂົ້າສູນແລ້ວ → "ລໍຖ້າກວດເຊັກ"
 * ⇒ ງານນອນຢູ່ຄິວຈົນກວ່າຊ່າງຈະບັງເອີນເປີດແອັບເບິ່ງເອງ.
 *
 * ໃຊ້ **ຂັ້ນປັດຈຸບັນ** ເປັນຕົວຕັດສິນ (ບໍ່ແມ່ນເດົາຈາກຈຸດທີ່ເອີ້ນ) ⇒ ເອີ້ນຫຼັງປ່ຽນຂັ້ນສຳເລັດ
 * ບ່ອນໃດກໍ່ໄດ້ ແລ້ວມັນຈະຕັດສິນເອງວ່າຄວນແຈ້ງບໍ ແລະ ແຈ້ງວ່າແນວໃດ.
 * ບໍ່ຄວນໂຍນ error ຕໍ່ — ການແຈ້ງເຕືອນລົ້ມ ຫ້າມເຮັດໃຫ້ວຽກຫຼັກລົ້ມ.
 */

/** ຂັ້ນທີ່ "ໝາກບານຢູ່ຕີນຊ່າງ" ພ້ອມຄຳແຈ້ງ */
const REPAIR_STAGE_MESSAGE: Record<number, string> = {
  0: "ໄປຮັບເຄື່ອງທີ່ລູກຄ້າ",
  1: "ລໍຖ້າກວດເຊັກ — ກົດຮັບງານແລ້ວເລີ່ມກວດ",
  8: "ອາໄຫຼ່ພ້ອມແລ້ວ — ລໍຖ້າສ້ອມແປງ",
};

const INSTALL_STAGE_MESSAGE: Record<number, string> = {
  1: "ລໍຖ້າຊ່າງຮັບງານ",
  4: "ອາໄຫຼ່ພ້ອມແລ້ວ — ລໍຖ້າຕິດຕັ້ງ",
};

async function techOf(workflow: Workflow, code: string) {
  return (
    workflow === "install"
      ? (
          await query<{ tech: string | null; stage: number; title: string | null }>(
            `select nullif(a.tech_code,'') as tech, (${INSTALL_STAGE_SQL})::int as stage,
                a.item_name as title
              from ods_tb_install a where a.code = $1`,
            [code],
          )
        ).rows[0]
      : (
          await query<{ tech: string | null; stage: number; title: string | null }>(
            `select nullif(a.emp_code,'') as tech, (${STAGE_SQL})::int as stage,
                concat_ws(' ', a.name_1, a.p_model) as title
              from tb_product a where a.code = $1`,
            [code],
          )
        ).rows[0]
  );
}

export async function notifyTechStage(workflow: Workflow, code: string): Promise<void> {
  try {
    const row = await techOf(workflow, code);

    // ຍັງບໍ່ໄດ້ຈັດຊ່າງ = ບໍ່ມີໃຜໃຫ້ແຈ້ງ (ວຽກຢູ່ຄິວ CS ຈັດຊ່າງ)
    if (!row?.tech) return;

    const message =
      workflow === "install" ? INSTALL_STAGE_MESSAGE[row.stage] : REPAIR_STAGE_MESSAGE[row.stage];
    if (!message) return; // ຂັ້ນນີ້ບໍ່ແມ່ນວຽກຂອງຊ່າງ ⇒ ບໍ່ລົບກວນ

    await pushToUser(row.tech, message, `${code}${row.title ? ` · ${row.title}` : ""}`, {
      workflow,
      code,
    });
  } catch (error) {
    console.error("notifyTechStage failed", error);
  }
}

/**
 * **ສາງເບີກອາໄຫຼ່ອອກແລ້ວ (ຍັງບໍ່ຄົບ) ⇒ ບອກຊ່າງທັນທີ.**
 *
 * ຄູ່ກັບ notifyTechStage — ອັນນັ້ນເຕືອນຕອນອາໄຫຼ່ **ຄົບ**, ອັນນີ້ເຕືອນຕອນ
 * ໃບເບີກຂອງ ERP ຖືກດຶງເຂົ້າມາ **ທຸກໃບ** ເພື່ອຊ່າງຮູ້ທັນທີວ່າເບີກແລ້ວ
 * (ບໍ່ຕ້ອງລໍໃຫ້ຄົບທຸກລາຍການ ຫຼື ເປີດໜ້າຄິວເອງ).
 */
export async function notifyTechDispatched(
  workflow: Workflow,
  code: string,
  dispatchDocNo: string,
): Promise<void> {
  try {
    const row = await techOf(workflow, code);
    if (!row?.tech) return;
    await pushToUser(row.tech, "ເບີກອາໄຫຼ່ແລ້ວ", `${code} · ໃບເບີກ ${dispatchDocNo}`, {
      workflow,
      code,
    });
  } catch (error) {
    console.error("notifyTechDispatched failed", error);
  }
}
