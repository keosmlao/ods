import { query } from "@/lib/db";
import { MAINTENANCE_STAGE_SQL, maintenanceStageLabel } from "@/lib/maintenance-stage";
import type { TimelineStep } from "@/lib/repair-timeline";

/**
 * ເສັ້ນເວລາຂອງງານບຳລຸງຮັກສາ (ລ້າງແອ) — ຄູ່ຂະໜານ repair/install timeline
 * ແຕ່ໃຊ້ຖັນ ods_tb_maintenance (MAINTENANCE_STAGE_TIME_COL). ຂັ້ນ 0..6.
 */
const ENTRY: Record<number, string> = {
  0: "a.time_register",
  1: "coalesce(a.assign_time, a.appoint_date, a.time_register)",
  2: "coalesce(a.tech_confirm, a.assign_time, a.appoint_date, a.time_register)",
  3: "a.start_clean",
  4: "a.finish_clean",
  5: "a.qc_finish",
  6: "a.job_finish",
};

export async function maintenanceTimeline(code: string): Promise<{ steps: TimelineStep[]; cancelledAt: string | null }> {
  const sel = Object.entries(ENTRY)
    .map(([n, expr]) => `extract(epoch from ${expr})::float e${n}, to_char(${expr},'DD-MM-YYYY HH24:MI') s${n}`)
    .join(",\n    ");
  const r = (
    await query<Record<string, number | string | null>>(
      `select (${MAINTENANCE_STAGE_SQL})::int stage,
          extract(epoch from localtimestamp)::float now_epoch,
          extract(epoch from a.cancel_date)::float ecancel, to_char(a.cancel_date,'DD-MM-YYYY HH24:MI') scancel,
          ${sel}
        from ods_tb_maintenance a where a.code = $1`,
      [code],
    )
  ).rows[0];
  if (!r) return { steps: [], cancelledAt: null };

  const rawStage = r.stage as number;
  const now = r.now_epoch as number;
  const list = [0, 1, 2, 3, 4, 5, 6];

  const rows = list.map((n) => ({
    stage: n,
    label: maintenanceStageLabel(n),
    at: (r[`s${n}`] as string | null) ?? null,
    epoch: (r[`e${n}`] as number | null) ?? null,
  }));

  const cancelled = rawStage < 0;
  let current = rawStage;
  if (cancelled) {
    current = list[0];
    rows.forEach((x) => {
      if (x.epoch != null) current = x.stage;
    });
  }

  const TERMINAL = 6; // ສຳເລັດ — ປາຍທາງ

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
