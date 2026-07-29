import { query } from "@/lib/db";
import { INSTALL_FEEDBACK_TIME_SQL, INSTALL_STAGE_SQL, installStageLabel } from "@/lib/install-stage";
import type { TimelineStep } from "@/lib/repair-timeline";

/**
 * ເສັ້ນເວລາຂອງງານຕິດຕັ້ງ — ຄູ່ຂະໜານກັບ repairTimeline ແຕ່ໃຊ້ຖັນຂອງ ods_tb_install.
 * ເວລາເຂົ້າແຕ່ລະຂັ້ນ = ນິຍາມດຽວກັບ INSTALL_STAGE_TIME_COL (lib/install-stage) ⇒ ບໍ່ຫຼົ້ນກັບ elapsed.
 * ງານບໍ່ໃຊ້ອາໄຫຼ່ຂ້າມຂັ້ນ 2-3 (ບໍ່ມີເວລາ) ⇒ ສະແດງແຕ່ບໍ່ມີໄລຍະ.
 */
const ENTRY: Record<number, string> = {
  0: "a.time_register",
  1: "coalesce(a.assigt_time, a.time_register)",
  2: "a.tech_confirm",
  3: "a.reg_start",
  4: "coalesce(a.pick_finish, a.tech_confirm, a.time_register)",
  5: "a.start_install",
  6: "a.finish_install",
  7: "a.qc_finish",
  8: INSTALL_FEEDBACK_TIME_SQL,
  9: "a.job_finish",
};

export async function installTimeline(code: string): Promise<{ steps: TimelineStep[]; cancelledAt: string | null }> {
  const sel = Object.entries(ENTRY)
    .map(([n, expr]) => `extract(epoch from ${expr})::float e${n}, to_char(${expr},'DD-MM-YYYY HH24:MI') s${n}`)
    .join(",\n    ");
  const r = (
    await query<Record<string, number | string | null>>(
      `select (${INSTALL_STAGE_SQL})::int stage,
          extract(epoch from localtimestamp)::float now_epoch,
          extract(epoch from a.cancel_date)::float ecancel, to_char(a.cancel_date,'DD-MM-YYYY HH24:MI') scancel,
          ${sel}
        from ods_tb_install a where a.code = $1`,
      [code],
    )
  ).rows[0];
  if (!r) return { steps: [], cancelledAt: null };

  const rawStage = r.stage as number;
  const now = r.now_epoch as number;
  const list = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

  const rows = list.map((n) => ({
    stage: n,
    label: installStageLabel(n),
    at: (r[`s${n}`] as string | null) ?? null,
    epoch: (r[`e${n}`] as number | null) ?? null,
  }));

  // ຍົກເລີກ (stage -1): ຂັ້ນປັດຈຸບັນ = ຂັ້ນສຸດທ້າຍທີ່ໄປຮອດຈິງ (ມີເວລາ)
  const cancelled = rawStage < 0;
  let current = rawStage;
  if (cancelled) {
    current = list[0];
    rows.forEach((x) => {
      if (x.epoch != null) current = x.stage;
    });
  }

  const TERMINAL = 9; // ປິດງານແລ້ວ — ປາຍທາງ

  const nextReachedEpoch = (from: number): number | null => {
    for (let j = from + 1; j < rows.length; j += 1) {
      if (rows[j].epoch != null) return rows[j].epoch;
    }
    return null;
  };

  const steps: TimelineStep[] = rows.map((x, idx) => {
    const atCurrent = x.stage === current;
    const state: TimelineStep["state"] = x.stage < current
      ? "done"
      : atCurrent
        ? cancelled || x.stage === TERMINAL
          ? "done"
          : "current"
        : "pending";

    let durationSeconds: number | null = null;
    if (x.epoch != null) {
      if (state === "current") {
        durationSeconds = Math.max(0, Math.round(now - x.epoch));
      } else if (state === "done") {
        const end = nextReachedEpoch(idx);
        durationSeconds = end == null ? null : Math.max(0, Math.round(end - x.epoch));
      }
    }
    return { stage: x.stage, label: x.label, at: state === "pending" ? null : x.at, durationSeconds, state };
  });

  return { steps, cancelledAt: cancelled ? (r.scancel as string | null) : null };
}
