/**
 * ── "1 ໃບງານ = ຫຼາຍຮອບເຂົ້າໜ້າງານ" ຢູ່ບ່ອນດຽວ ───────────────────────
 *
 * ໃບງານຕິດຕັ້ງ 1 ໃບ ຄຸມ **ເຄື່ອງ 1 ໜ່ວຍ** ແຕ່ຊ່າງອາດຕ້ອງເຂົ້າໜ້າງານຫຼາຍຮອບ
 * (ລໍງານໄຟຟ້າ · ຝົນຕົກ · ອາໄຫຼ່ຍັງບໍ່ມາ · ລູກຄ້າຂໍເລື່ອນ). ຮອບເກັບຢູ່ `ods_job_checkin`
 * — ຂັ້ນຂອງງານ **ບໍ່ຂະຍັບ** ຕາມຮອບ (ເບິ່ງ lib/job-flow.scheduleNextVisit).
 *
 * ໄຟລ໌ນີ້ເປັນ **ຄຳສັບກາງ** ຂອງການສະແດງຮອບ ⇒ ໜ້າລາຍການ · timeline · ໜ້າລາຍລະອຽດ
 * ແລະ ໃບພິມ ເວົ້າຄືກັນໝົດ (ບໍ່ດັ່ງນັ້ນແຕ່ລະໜ້າຈະຄິດ "ຮອບ" ຄົນລະແບບ).
 *
 * ⚠️ ບໍ່ import @/lib/db ຢູ່ນີ້ — ໜ້າລາຍການເອີ້ນຈາກ client component ນຳ
 * (ເບິ່ງເຫດຜົນຢູ່ AGENTS: pg → dns ພັງຕອນ build).
 */

/** ຮອບເຂົ້າໜ້າງານ 1 ຮອບ ໃນຮູບແບບທີ່ສະແດງໄດ້ (ໃຊ້ຮ່ວມ server ແລະ client) */
export type JobVisitStep = {
  /** ຮອບທີ (1, 2, 3 …) */
  n: number;
  tech: string | null;
  /** ເວລາເຂົ້າ/ອອກ ຈັດຮູບແບບມາຈາກ SQL ແລ້ວ — ບໍ່ມີບັນຫາເຂດເວລາຢູ່ browser */
  at: string | null;
  out: string | null;
  minutes: number | null;
  /**
   * "ຮອບນີ້ຍັງບໍ່ຈົບຍ້ອນຫຍັງ" — ໃສ່ຕອນນັດຮອບຕໍ່ໄປ (ods_job_checkin.next_reason).
   * null = ຮອບນີ້ຈົບປົກກະຕິ ຫຼື ເປັນຂໍ້ມູນເກົ່າກ່ອນມີຖັນນີ້.
   */
  reason: string | null;
};

/** ຊົ່ວໂມງ/ນາທີ ແບບອ່ານງ່າຍ — "12 ຊມ 30 ນທ" · "45 ນທ" */
export function minutesLabel(minutes: number | null | undefined) {
  if (!minutes) return "-";
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (!hours) return `${rest} ນທ`;
  return rest ? `${hours} ຊມ ${rest} ນທ` : `${hours} ຊມ`;
}

/**
 * **ຮອບຕໍ່ໄປຄືຮອບທີເທົ່າໃດ ແລະ ຮອບກ່ອນຄ້າງຍ້ອນຫຍັງ** — ຂໍ້ມູນຂອງແຖບເຕືອນ
 * ຢູ່ຫົວໜ້າຈໍໃບງານ (ທັງເວັບ ແລະ ແອັບ).
 *
 * ຊ່າງທີ່ໄປຮອບ 3 ອາດເປັນຄົນລະຄົນກັບຮອບ 1 ⇒ ຕ້ອງຮູ້ວ່າໄປແລ້ວຈະພົບຫຍັງ
 * **ກ່ອນອອກລົດ** ບໍ່ແມ່ນຫຼັງໄປຮອດ.
 */
export type NextRoundHint = {
  /** ຮອບທີ່ກຳລັງຈະເຮັດ (ຮອບທີ່ຍັງບໍ່ check-out = ຮອບປັດຈຸບັນ ບໍ່ບວກເພີ່ມ) */
  round: number;
  /** ເວລາຂອງຮອບກ່ອນ (ອອກ ຫຼື ເຂົ້າ ຖ້າຍັງບໍ່ອອກ) */
  lastAt: string | null;
  reason: string | null;
  /** ຊ່າງຍັງ check-in ຄ້າງຢູ່ຮອບນີ້ */
  open: boolean;
};

export function nextRoundHint(visits: JobVisitStep[]): NextRoundHint | null {
  const last = visits.at(-1);
  if (!last) return null;
  const open = last.out == null;
  return {
    round: open ? last.n : last.n + 1,
    lastAt: last.out ?? last.at,
    reason: last.reason,
    open,
  };
}

/**
 * ສະຫຼຸບຮອບແບບບັນທັດດຽວ — "ຮອບທີ 3 · ໜ້າງານ 12 ຊມ".
 * ຄືນ `null` ເມື່ອຍັງບໍ່ເຄີຍເຂົ້າໜ້າງານ ⇒ ຜູ້ເອີ້ນເຊື່ອງບັນທັດນັ້ນໄປເລີຍ
 * (ບໍ່ໃຫ້ຂຽນ "0 ຮອບ" ເຕັມຕາຕະລາງ ເພາະງານສ່ວນຫຼາຍຈົບໃນຮອບດຽວ).
 */
export function visitSummaryLabel(rounds: number | null, minutes: number | null) {
  if (!rounds) return null;
  const onsite = minutes ? ` · ໜ້າງານ ${minutesLabel(minutes)}` : "";
  return `ຮອບທີ ${rounds}${onsite}`;
}
