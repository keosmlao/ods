import { query } from "@/lib/db";
import { STAGE_SQL, stageLabel } from "@/lib/stage";

/**
 * ເສັ້ນເວລາຂອງງານສ້ອມ — **ຂັ້ນຕອນໄປຕາມ service_type** (ປ້າຍຈາກ stageLabel: IH/PS/CI/ST ຕ່າງ).
 * ເວລາເຂົ້າແຕ່ລະຂັ້ນ = ນິຍາມດຽວກັບ STAGE_TIME_COL (lib/stage) ⇒ ບໍ່ຫຼົ້ນກັບ elapsed.
 *
 * PS/IH ໄປໜ້າງານ ⇒ ມີຂັ້ນ 0 (ໄປຮັບເຄື່ອງ / ນັດ+ຈັດຊ່າງ) · CI/ST ເລີ່ມແຕ່ຂັ້ນ 1 (ຮັບງານ).
 */
const ENTRY: Record<number, string> = {
  0: "coalesce(a.pickup_at, a.appoint_date, a.time_register)",
  1: "coalesce(a.pickup_at, a.appoint_date, a.time_register)",
  2: "a.time_check",
  3: "coalesce(a.qt_start, a.time_finish_check)",
  4: "coalesce(a.qt_start, a.time_finish_check)",
  5: "coalesce(a.spare_arrive, a.qt_finish, a.time_finish_check)",
  6: "coalesce(a.spare_arrive, a.spare_reg)",
  7: "a.spare_order",
  8: "coalesce(a.spare_finish, a.qt_finish, a.time_finish_check)",
  9: "a.time_repair",
  10: "a.time_finish_repair",
  11: "coalesce(a.qc_finish, a.cancel_finish, a.cancel_start)",
  12: "a.return_complete",
};

export type TimelineStep = {
  stage: number;
  label: string;
  at: string | null;
  durationSeconds: number | null;
  state: "done" | "current" | "pending";
};

export async function repairTimeline(code: string): Promise<{ steps: TimelineStep[]; cancelledAt: string | null }> {
  const sel = Object.entries(ENTRY)
    .map(([n, expr]) => `extract(epoch from ${expr})::float e${n}, to_char(${expr},'DD-MM-YYYY HH24:MI') s${n}`)
    .join(",\n    ");
  const r = (
    await query<Record<string, number | string | null>>(
      `select (${STAGE_SQL})::int stage, a.service_type,
          extract(epoch from localtimestamp)::float now_epoch,
          extract(epoch from a.cancel_start)::float ecancel, to_char(a.cancel_start,'DD-MM-YYYY HH24:MI') scancel,
          ${sel}
        from tb_product a where a.code = $1`,
      [code],
    )
  ).rows[0];
  if (!r) return { steps: [], cancelledAt: null };

  const svc = (r.service_type as string | null) ?? "";
  const rawStage = r.stage as number;
  const now = r.now_epoch as number;
  const onsite = svc === "PS" || svc === "IH";
  const list = onsite ? [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

  const rows = list.map((n) => ({ stage: n, label: stageLabel(n, svc), at: (r[`s${n}`] as string | null) ?? null, epoch: (r[`e${n}`] as number | null) ?? null }));

  // ຂັ້ນຍົກເລີກ-ຍັງບໍ່ອະນຸມັດ (STAGE_SQL = -1): ຄິດຂັ້ນປັດຈຸບັນ = ຂັ້ນສຸດທ້າຍທີ່ໄປຮອດ (ມີເວລາ)
  const cancelled = rawStage < 0;
  let current = rawStage;
  if (cancelled) {
    current = list[0];
    rows.forEach((x) => { if (x.epoch != null) current = x.stage; });
  }

  const steps: TimelineStep[] = rows.map((x, idx) => {
    const state: TimelineStep["state"] = x.stage < current ? "done" : x.stage === current ? (cancelled ? "done" : "current") : "pending";
    let durationSeconds: number | null = null;
    if (state !== "pending" && x.epoch != null) {
      const end = state === "current" ? now : (rows[idx + 1]?.epoch ?? now);
      durationSeconds = Math.max(0, Math.round(end - x.epoch));
    }
    return { stage: x.stage, label: x.label, at: state === "pending" ? null : x.at, durationSeconds, state };
  });

  return { steps, cancelledAt: cancelled ? (r.scancel as string | null) : null };
}
