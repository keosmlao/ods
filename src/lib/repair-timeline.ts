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
  13: "a.time_finish_check",
  14: "coalesce(a.claim_decided_at, a.time_finish_check)",
  15: "coalesce(a.claim_decided_at, a.time_finish_check)",
  16: "coalesce(a.claim_decided_at, a.time_finish_check)",
};

export type TimelineStep = {
  stage: number;
  label: string;
  at: string | null;
  durationSeconds: number | null;
  state: "done" | "current" | "pending";
  /** ຂັ້ນຍ່ອຍທີ່ຢູ່ຈິງ ເມື່ອຂັ້ນນີ້ຮວມມາຈາກຫຼາຍຂັ້ນ (ເຊັ່ນ "ກຳລັງເບີກອາໄຫຼ່") */
  note?: string | null;
};

/**
 * ── ຮວມ 3 ຂັ້ນອາໄຫຼ່ເປັນຂັ້ນດຽວ (26-08-2026 ຕາມຄຳສັ່ງ) ──
 * ຂັ້ນ 5 (ກວດ Stock / ດຳເນີນອາໄຫຼ່) · 6 (ກຳລັງເບີກ) · 7 (ກຳລັງສັ່ງຊື້) ເປັນ
 * **ເລື່ອງດຽວກັນໃນສາຍຕາຄົນອ່ານ**: ລໍອາໄຫຼ່. ແຍກ 3 ແຖວເຮັດໃຫ້ເສັ້ນເວລາຍາວ
 * ໂດຍບໍ່ໄດ້ບອກຫຍັງເພີ່ມ ແລະ ເວລາທີ່ໃຊ້ຈິງຖືກຫັ່ນເປັນ 3 ທ່ອນ ⇒ ເບິ່ງບໍ່ອອກວ່າ
 * "ລໍອາໄຫຼ່ໄປທັງໝົດເທົ່າໃດ".
 *
 * ⚠️ **ຮວມແຕ່ການສະແດງ** — ຂັ້ນຈິງໃນຖານ (STAGE_SQL) ຍັງເປັນ 5/6/7 ຄືເກົ່າ ແລະ
 * ຄິວງານ · ສິດ · ປຸ່ມ ຍັງເດີນຕາມຂັ້ນຈິງ. ຂັ້ນຍ່ອຍທີ່ຢູ່ຕອນນີ້ໄປຢູ່ `note`
 * ⇒ ບໍ່ເສຍຂໍ້ມູນ (ຄວາມຕ່າງລະຫວ່າງ "ລໍເບີກຈາກສາງ" ກັບ "ສັ່ງຊື້ນອກ" ສຳຄັນ).
 */
const SPARE_STAGES = [5, 6, 7];
const SPARE_HEAD = 5;
const SPARE_LABEL = "ອາໄຫຼ່";

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
  const list = rawStage >= 13 && rawStage <= 16
    ? [...(onsite ? [0] : []), 1, 2, rawStage]
    : onsite ? [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

  const all = list.map((n) => ({ stage: n, label: stageLabel(n, svc), at: (r[`s${n}`] as string | null) ?? null, epoch: (r[`e${n}`] as number | null) ?? null }));

  /*
    ຮວມແຖວອາໄຫຼ່: ເອົາ**ອັນທຳອິດທີ່ໄປຮອດຈິງ**ເປັນເວລາເລີ່ມ (ອັນທີ່ຖືກຂ້າມບໍ່ມີເວລາ)
    ⇒ ໄລຍະທີ່ຄິດອອກມາຄື "ລໍອາໄຫຼ່ທັງໝົດ" ບໍ່ແມ່ນທ່ອນໃດທ່ອນໜຶ່ງ.
  */
  const rows = all.filter((x) => !SPARE_STAGES.includes(x.stage) || x.stage === SPARE_HEAD);
  const spareIndex = rows.findIndex((x) => x.stage === SPARE_HEAD);
  if (spareIndex >= 0) {
    const parts = all.filter((x) => SPARE_STAGES.includes(x.stage));
    const started = parts.find((x) => x.epoch != null);
    rows[spareIndex] = {
      stage: SPARE_HEAD,
      label: SPARE_LABEL,
      at: started?.at ?? null,
      epoch: started?.epoch ?? null,
    };
  }

  // ຂັ້ນຍົກເລີກ-ຍັງບໍ່ອະນຸມັດ (STAGE_SQL = -1): ຄິດຂັ້ນປັດຈຸບັນ = ຂັ້ນສຸດທ້າຍທີ່ໄປຮອດ (ມີເວລາ)
  const cancelled = rawStage < 0;
  let current = rawStage;
  if (cancelled) {
    current = list[0];
    rows.forEach((x) => { if (x.epoch != null) current = x.stage; });
  }
  /*
    ຂັ້ນຈິງ 6 ຫຼື 7 ⇒ ແຖວທີ່ຕ້ອງເປັນ "ກຳລັງ" ຄືແຖວອາໄຫຼ່ທີ່ຮວມແລ້ວ (ຫົວ = 5).
    ຖ້າບໍ່ຍ້າຍ ຈະກາຍເປັນ 5 < 6 ⇒ ແຖວອາໄຫຼ່ຂຶ້ນວ່າ "ຜ່ານແລ້ວ" ທັງທີ່ຍັງລໍຢູ່.
  */
  const realStage = current;
  if (SPARE_STAGES.includes(current)) current = SPARE_HEAD;

  // ຂັ້ນ 12 (ສົ່ງຄືນສຳເລັດ / ຈົບງານ) = ປາຍທາງ — ງານຈົບແລ້ວ ບໍ່ມີຂັ້ນທີ່ "ກຳລັງ" ອີກ
  const TERMINAL = 12;

  /**
   * ເວລາຈົບຂອງຂັ້ນທີ່ຜ່ານແລ້ວ = ເວລາເລີ່ມຂອງ **ຂັ້ນຖັດໄປທີ່ໄປຮອດຈິງ**
   * (ຂັ້ນທີ່ຖືກຂ້າມບໍ່ມີເວລາ ⇒ ຕ້ອງຂ້າມມັນໄປ). ບໍ່ໃຊ້ `now` —
   * ບໍ່ດັ່ງນັ້ນຂັ້ນທີ່ຈົບໄປແລ້ວຈະນັບເວລາເພີ່ມຂຶ້ນເລື້ອຍໆ ຄືກັບຍັງຄ້າງຢູ່.
   */
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
        ? (cancelled || x.stage === TERMINAL ? "done" : "current")
        : "pending";

    let durationSeconds: number | null = null;
    if (x.epoch != null) {
      if (state === "current") {
        durationSeconds = Math.max(0, Math.round(now - x.epoch)); // ຍັງຄ້າງຢູ່ຈິງ ⇒ ເດີນໄດ້
      } else if (state === "done") {
        const end = nextReachedEpoch(idx);
        durationSeconds = end == null ? null : Math.max(0, Math.round(end - x.epoch));
      }
    }
    // ຢູ່ຂັ້ນອາໄຫຼ່ຢູ່ ⇒ ບອກນຳວ່າຂັ້ນຍ່ອຍໃດ (ຂໍ້ມູນທີ່ການຮວມຈະກືນຫາຍໄປ)
    const note =
      x.stage === SPARE_HEAD && state === "current" && SPARE_STAGES.includes(realStage)
        ? stageLabel(realStage, svc)
        : null;
    return { stage: x.stage, label: x.label, at: state === "pending" ? null : x.at, durationSeconds, state, note };
  });

  return { steps, cancelledAt: cancelled ? (r.scancel as string | null) : null };
}
