"use server";
import { logChange } from "@/lib/chatter-log";
import { db, query } from "@/lib/db";
import { requireRole } from "@/lib/guard";
import { STOCK_COUNT_SIDE } from "@/lib/roles";
import { SERVICE_TYPE_LABEL } from "@/lib/sla";
import { stageLabel } from "@/lib/stage";
import { revalidatePath } from "next/cache";

export type JobStageState = { error?: string; ok?: boolean };

const SERVICE_TYPES = ["CI", "ST", "IH", "PS"];
const TS = "localtimestamp";
const N = "null";

/**
 * ── ບັງຄັບ "ຂັ້ນ" ຂອງໃບຮັບເຄື່ອງສ້ອມ (tb_product) ──
 * ຂັ້ນ **ຄິດຈາກເວລາ** (lib/stage STAGE_SQL) ບໍ່ແມ່ນຄ່າທີ່ເກັບໄວ້ ⇒ ການ "ຕັ້ງຂັ້ນ" ຄື
 * ການຂຽນຊຸດຖັນເວລາໃຫ້ STAGE_SQL ອ່ານໄດ້ຂັ້ນເປົ້າ. ແຜນນີ້ຖືກ **ກວດຄືນກັບ DB ຈິງ**
 * (rollback) ວ່າທຸກຂັ້ນ 1-12 ອອກມາຖືກຕົງ. ⚠️ ນີ້ຂ້າມ workflow ປົກກະຕິ — ໃຊ້ແກ້ຂໍ້ມູນ
 * ຜິດ (ເຊັ່ນ ຕອນກວດນັບພົບວ່າຂັ້ນ/ປະເພດບໍລິການບໍ່ຖືກ) ບໍ່ແມ່ນເດີນງານປົກກະຕິ.
 */
function stagePlan(stage: number): Record<string, string> {
  const base: Record<string, string> = {
    status: "case when status = 6 then 1 else status end",
    cancel_start: N, cancel_finish: N, request_cancel: N,
    return_complete: N,
    pickup_at: TS, appoint_date: TS, // ຫຼົບ stage-0 (PS/IH)
    time_check: TS, time_finish_check: TS, // ຜ່ານກວດເຊັກ
    qt_start: TS, qt_finish: TS, // ສະເໜີລາຄາຈົບ ⇒ ຂ້າມ branch ຮັບປະກັນ 3/4
    used_spare: "0", // ບໍ່ໃຊ້ອາໄຫຼ່ ⇒ else 8
    spare_order: N, spare_order_finish: N, spare_arrive: N, spare_reg: N, spare_finish: N,
    time_repair: N, time_finish_repair: N, qc_finish: N,
  };
  switch (stage) {
    case 1: return { ...base, time_check: N, time_finish_check: N };
    case 2: return { ...base, time_finish_check: N };
    case 3: return { ...base, warrunty: "'ໝົດຮັບປະກັນ'", qt_start: N, qt_finish: N };
    case 4: return { ...base, warrunty: "'ໝົດຮັບປະກັນ'", qt_finish: N };
    case 5: return { ...base, used_spare: "1", spare_reg: N, spare_order: N, spare_arrive: N };
    case 6: return { ...base, used_spare: "1", spare_reg: TS, spare_finish: N, spare_order: N };
    case 7: return { ...base, used_spare: "1", spare_order: TS, spare_order_finish: N, spare_arrive: N };
    case 8: return { ...base };
    case 9: return { ...base, time_repair: TS };
    case 10: return { ...base, time_finish_repair: TS };
    case 11: return { ...base, time_finish_repair: TS, qc_finish: TS };
    case 12: return { ...base, return_complete: TS };
    default: throw new Error("bad stage");
  }
}

/** ປັບປຸງ ປະເພດບໍລິການ + ຂັ້ນ ຈາກໜ້າກວດນັບ (ບັງຄັບຂຽນ, ບັນທຶກ chatter). */
export async function setJobServiceStage(code: string, serviceType: string, stage: number): Promise<JobStageState> {
  const g = await requireRole(STOCK_COUNT_SIDE, "ບໍ່ມີສິດປັບປຸງງານ");
  if (!g.ok) return { error: g.error };
  if (!db) return { error: "ບໍ່ພົບ DATABASE_URL" };
  const svc = serviceType.trim().toUpperCase();
  if (!SERVICE_TYPES.includes(svc)) return { error: "ປະເພດບໍລິການບໍ່ຖືກ (CI/ST/IH/PS)" };
  if (!Number.isInteger(stage) || stage < 1 || stage > 12) return { error: "ຂັ້ນຕ້ອງ 1-12" };

  const before = (
    await query<{ product: string | null; service_type: string | null }>(
      `select a.name_1 product, a.service_type from tb_product a where a.code = $1`,
      [code],
    )
  ).rows[0];
  if (!before) return { error: "ບໍ່ພົບໃບຮັບເຄື່ອງນີ້" };

  const plan = stagePlan(stage);
  const setClause = Object.entries(plan).map(([col, val]) => `${col} = ${val}`).join(", ");
  try {
    await db.query(
      `update tb_product set ${setClause}, service_type = $2, user_edit = $3 where code = $1`,
      [code, svc, g.session.username],
    );
  } catch (error) {
    console.error("setJobServiceStage failed", error);
    return { error: "ປັບປຸງບໍ່ສຳເລັດ" };
  }

  const svcLabel = (from: string | null) => SERVICE_TYPE_LABEL[from ?? ""] ?? (from ?? "-");
  const detail =
    `ປັບປຸງງານ ${code} (${before.product ?? "-"}) ໂດຍ ${g.session.username} · ` +
    `ບໍລິການ ${svcLabel(before.service_type)} → ${svcLabel(svc)} · ຂັ້ນ → ${stage} ${stageLabel(stage, svc)}`;
  await logChange("tb_product", code, detail, { roles: ["manager", "stock"] });

  revalidatePath("/reports/stock-count");
  revalidatePath("/dashboard");
  return { ok: true };
}
