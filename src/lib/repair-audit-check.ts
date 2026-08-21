/**
 * **ກວດສອບງານສ້ອມແປງ ທຽບ KPI — ການຄິດຄຳນວນລ້ວນ (ບໍ່ແຕະ DB, ບໍ່ແຕະ UI).**
 *
 * ── ຕອບ 2 ຄຳຖາມ ທີ່ຄົນລະເລື່ອງກັນ ──
 *   ① **ຊ້າ** — ແຕ່ລະຂັ້ນ (1 ຮັບງານ … 11 ລໍສົ່ງຄືນ/ປິດງານ) ໃຊ້ເວລາເທົ່າໃດ ທຽບ SLA
 *      ຂອງຂັ້ນນັ້ນ (lib/repair-sla) ⇒ ເກີນເທົ່າໃດ, ຂັ້ນໃດເກີນຫຼາຍສຸດ.
 *   ② **ຜິດຂັ້ນຕອນ** — timeline ຂອງງານນັ້ນ **ເປັນໄປບໍ່ໄດ້**: ເວລາຖອຍຫຼັງ (ຈົບການສ້ອມ
 *      ກ່ອນເລີ່ມສ້ອມ) · ຂ້າມຈຸດ (ສົ່ງຄືນໂດຍບໍ່ຜ່ານ QC) · ບັນທຶກ 3 ຂັ້ນພ້ອມກັນວິນາທີດຽວ.
 *
 * ຂໍ້ ② **ບໍ່ແມ່ນເລື່ອງໄວ/ຊ້າ** — ມັນແປວ່າ *ຕົວເລກ KPI ຂອງງານນັ້ນເຊື່ອບໍ່ໄດ້* ⇒ ຕ້ອງແຍກ
 * ລາຍງານ ບໍ່ໃຫ້ປົນກັບງານທີ່ຊ້າແທ້. ຫົວໜ້າຈຶ່ງຮູ້ວ່າ "ຕ້ອງໄປໄລ່ວຽກ" ຫຼື "ຕ້ອງໄປແກ້ການບັນທຶກ".
 *
 * ── ເປັນຫຍັງບໍ່ໃຊ້ lib/repair-timeline ຊື່ໆ ──
 * ໜ້າ timeline ໃຊ້ `coalesce(...)` ຖອຍໄປໃຊ້ຖັນກ່ອນໜ້າ ເມື່ອຖັນທີ່ຄວນມີເປັນ null ⇒ ຈຸດທີ່
 * **ຖືກຂ້າມ ຍັງມີເວລາສະແດງ** (ດີສຳລັບການສະແດງ — ບໍ່ໃຫ້ຂັ້ນຫວ່າງ). ແຕ່ການກວດສອບຕ້ອງການ
 * ຄວາມຈິງດິບ: null = **ບໍ່ເຄີຍເກີດຂຶ້ນ**. ຈຶ່ງນິຍາມຈຸດກວດຂອງຕົນເອງແບບ **ບໍ່ມີ coalesce**
 * (ຍົກເວັ້ນ `intake` ທີ່ຕ້ອງຮູ້ວ່ານາລິກາເລີ່ມຈັກໂມງ).
 *
 * ⚠️ ໄຟລ໌ນີ້ **ບໍ່ມີ import ຈັກອັນ** — tests/repair-audit.test.mts ເອີ້ນມັນໂດຍກົງຜ່ານ
 * node --experimental-strip-types (ບໍ່ມີ bundler ແກ້ "@/…") ຈຶ່ງຕ້ອງພໍພຽງຕົວເອງ.
 * SLA ຊົ່ວໂມງ **ບໍ່ໄດ້ຢູ່ນີ້** — ຮັບເປັນ callback (`targetHours`) ຈາກ lib/repair-sla
 * ⇒ ນະໂຍບາຍ SLA ຍັງມີບ່ອນດຽວ ບໍ່ມີສຳເນົາທີ່ຈະຫຼົງກັນ.
 */

/* ────────────────────────────────────────────────────────── ຈຸດກວດ (checkpoint) */

export type CheckpointKey =
  | "intake"
  | "check_start"
  | "check_done"
  | "quote_start"
  | "quote_done"
  | "spare_request"
  | "spare_order"
  | "spare_arrive"
  | "spare_ready"
  | "repair_start"
  | "repair_done"
  | "qc_done"
  | "returned";

export type Checkpoint = {
  key: CheckpointKey;
  label: string;
  /**
   * SQL ຂອງເວລາຈຸດນີ້ — **alias tb_product = a** (ຂໍ້ຕົກລົງດຽວກັບ STAGE_SQL).
   * ຢູ່ຄູ່ກັບ label ບ່ອນນີ້ ⇒ ເພີ່ມ/ແກ້ຈຸດກວດແກ້ບ່ອນດຽວ, ຝັ່ງ SQL ບໍ່ຫຼົງກັບຝັ່ງ JS.
   */
  column: string;
  /**
   * ຢູ່ໃນ **ກະດູກສັນຫຼັງ** ບໍ — ຄື ຈຸດທີ່ທຸກງານຕ້ອງຜ່ານ **ຕາມລຳດັບນີ້ແທ້**
   * ⇒ ໃຊ້ກວດ "ເວລາຖອຍຫຼັງ". ຈຸດອາໄຫຼ່ບໍ່ຢູ່ໃນນີ້ ເພາະ workflow ໃໝ່ **ສັ່ງຊື້ກ່ອນ
   * ອອກໃບຂໍເບີກ** ໄດ້ (ເບິ່ງໝາຍເຫດຂັ້ນ 7 ໃນ lib/stage) ⇒ ລຳດັບຂອງມັນບໍ່ຄົງທີ່
   * ຈຶ່ງກວດເປັນ **ຄູ່** ແທນ (SPARE_PAIRS).
   */
  spine: boolean;
};

export const AUDIT_CHECKPOINTS: readonly Checkpoint[] = [
  /**
   * ນາລິກາເລີ່ມ = **ວັນລົງທະບຽນໃບງານ** ທຸກປະເພດບໍລິການ — ຄືກັບ `STAGE_TIME_COL` ຂັ້ນ 1
   * (lib/stage) ⇒ ຕົວເລກຂອງໜ້ານີ້ຕົງກັບ SLA compliance ຢູ່ /reports/kpi.
   *
   * ⚠️ **ຫ້າມ** ໃຊ້ `coalesce(pickup_at, appoint_date, time_register)` ຄືໜ້າ timeline:
   * ນະໂຍບາຍຂັ້ນ 1 ("ຮັບງານ ແລະເລີ່ມກວດ") ໃຫ້ PS 24 ຊມ ແລະ IH 12 ຊມ **ລວມເວລາໄປຮັບ/ໄປນັດ**
   * ຢູ່ແລ້ວ ⇒ ນັບຈາກວັນທີ່ໄປຮັບ ຈະລຶບເວລາລໍທັງໝົດອອກ. ຂໍ້ມູນຈິງ 21-08-2026: ໃບ 7053 (CI)
   * ລົງທະບຽນ 22-05 ແຕ່ pickup_at/appoint_date ເປັນ 21-07 ⇒ ຫາຍໄປ **60 ມື້** ແລະ ຂັ້ນ 1
   * ຂຶ້ນວ່າ "0 ວິນາທີ" ທັງທີ່ລູກຄ້າລໍ 2 ເດືອນ.
   */
  { key: "intake", label: "ຮັບເຄື່ອງເຂົ້າລະບົບ", column: "a.time_register", spine: true },
  { key: "check_start", label: "ເລີ່ມກວດເຊັກ", column: "a.time_check", spine: true },
  { key: "check_done", label: "ກວດເຊັກຈົບ", column: "a.time_finish_check", spine: true },
  { key: "quote_start", label: "ເລີ່ມສະເໜີລາຄາ", column: "a.qt_start", spine: true },
  { key: "quote_done", label: "ລູກຄ້າອະນຸມັດລາຄາ", column: "a.qt_finish", spine: true },
  { key: "spare_request", label: "ອອກໃບຂໍເບີກອາໄຫຼ່", column: "a.spare_reg", spine: false },
  { key: "spare_order", label: "ສັ່ງຊື້ອາໄຫຼ່", column: "a.spare_order", spine: false },
  { key: "spare_arrive", label: "ອາໄຫຼ່ມາຮອດສາງ", column: "a.spare_arrive", spine: false },
  { key: "spare_ready", label: "ໄດ້ຮັບອາໄຫຼ່ຄົບ", column: "a.spare_finish", spine: false },
  { key: "repair_start", label: "ເລີ່ມສ້ອມ", column: "a.time_repair", spine: true },
  { key: "repair_done", label: "ສ້ອມສຳເລັດ", column: "a.time_finish_repair", spine: true },
  { key: "qc_done", label: "ຜ່ານ QC", column: "a.qc_finish", spine: true },
  { key: "returned", label: "ສົ່ງຄືນ / ປິດງານ", column: "a.return_complete", spine: true },
];

export const CHECKPOINT_LABEL: Record<CheckpointKey, string> = Object.fromEntries(
  AUDIT_CHECKPOINTS.map((point) => [point.key, point.label]),
) as Record<CheckpointKey, string>;

const ORDER: CheckpointKey[] = AUDIT_CHECKPOINTS.map((point) => point.key);
const SPINE: CheckpointKey[] = AUDIT_CHECKPOINTS.filter((point) => point.spine).map((point) => point.key);

/** ຄູ່ທີ່ຕ້ອງມາກ່ອນ-ຫຼັງກັນ ນອກກະດູກສັນຫຼັງ (ສາຍອາໄຫຼ່ ລຳດັບບໍ່ຄົງທີ່ ⇒ ກວດເປັນຄູ່) */
const SPARE_PAIRS: readonly [CheckpointKey, CheckpointKey][] = [
  ["check_done", "spare_request"],
  ["spare_request", "spare_ready"],
  ["spare_order", "spare_arrive"],
  ["spare_arrive", "spare_ready"],
  ["spare_ready", "repair_start"],
];

/* ──────────────────────────────────────────────────── ຂັ້ນ SLA (span ລະຫວ່າງຈຸດ) */

/** ເງື່ອນໄຂທີ່ຂັ້ນນີ້ **ມີຢູ່ຈິງ** ໃນງານນັ້ນ (ບໍ່ແມ່ນທຸກງານມີສະເໜີລາຄາ/ອາໄຫຼ່) */
type SpanScope = "always" | "quote" | "spare" | "purchase";

export type StageSpan = {
  /** ເລກຂັ້ນ — **ຕົງກັບ REPAIR_STAGE_POLICIES** (lib/repair-sla) ຈຶ່ງເອົາ SLA ມາທຽບໄດ້ */
  stage: number;
  /** ຈຸດເລີ່ມ — ອັນທຳອິດທີ່ **ມີເວລາ** ຊະນະ (ງານທີ່ບໍ່ມີສະເໜີລາຄາ/ອາໄຫຼ່ ຖອຍໄປໃຊ້ຈຸດກ່ອນ) */
  from: readonly CheckpointKey[];
  to: CheckpointKey;
  /**
   * ຈຸດທີ່ **ພິສູດວ່າງານຜ່ານຂັ້ນນີ້ໄປແລ້ວ** — ຖ້າຈຸດນີ້ມີເວລາ ແຕ່ `to` ຫວ່າງ
   * ⇒ ຂັ້ນນີ້ **ຖືກຂ້າມ** (ບໍ່ແມ່ນ "ຍັງລໍຢູ່"). ຂາດອັນນີ້ຈະແຍກ "ຂ້າມ" ກັບ "ລໍ" ບໍ່ອອກ.
   * (ຂັ້ນປັດຈຸບັນຢູ່ຫຼັງຂັ້ນນີ້ ກໍ່ນັບເປັນຫຼັກຖານຄືກັນ — ເບິ່ງ `analyzeRepairJob`)
   */
  proof: CheckpointKey | null;
  scope: SpanScope;
};

/**
 * 11 ຂັ້ນຂອງສາຍງານສ້ອມ — ຈາກ "ຮັບເຄື່ອງ" ຮອດ "ສົ່ງຄືນ/ປິດງານ".
 * ຂັ້ນ 13-16 (ເຄມ) ບໍ່ຢູ່ນີ້ — ງານເຄມມີສາຍງານ ແລະ ລາຍງານຂອງຕົນເອງ.
 */
export const STAGE_SPANS: readonly StageSpan[] = [
  { stage: 1, from: ["intake"], to: "check_start", proof: "check_done", scope: "always" },
  { stage: 2, from: ["check_start"], to: "check_done", proof: "repair_start", scope: "always" },
  { stage: 3, from: ["check_done"], to: "quote_start", proof: "quote_done", scope: "quote" },
  { stage: 4, from: ["quote_start", "check_done"], to: "quote_done", proof: "repair_start", scope: "quote" },
  { stage: 5, from: ["quote_done", "check_done"], to: "spare_request", proof: "spare_ready", scope: "spare" },
  { stage: 6, from: ["spare_arrive", "spare_request"], to: "spare_ready", proof: "repair_start", scope: "spare" },
  { stage: 7, from: ["spare_order"], to: "spare_arrive", proof: "repair_start", scope: "purchase" },
  { stage: 8, from: ["spare_ready", "quote_done", "check_done"], to: "repair_start", proof: "repair_done", scope: "always" },
  { stage: 9, from: ["repair_start"], to: "repair_done", proof: "qc_done", scope: "always" },
  { stage: 10, from: ["repair_done"], to: "qc_done", proof: "returned", scope: "always" },
  { stage: 11, from: ["qc_done"], to: "returned", proof: null, scope: "always" },
];

/* ─────────────────────────────────────────────────────────────── ຂອບເຂດ "ຜິດປົກກະຕິ" */

/**
 * ເກີນ SLA ຈັກເທົ່າ ຈຶ່ງເອີ້ນວ່າ "**ຫຼາຍເກີນໄປ**".
 * ເກີນເລັກນ້ອຍ (1.2 ເທົ່າ) ເປັນເລື່ອງທຳມະດາຂອງວຽກຈິງ ⇒ ຖ້າຕີວ່າມີບັນຫາໝົດ ລາຍງານຈະ
 * ມີທຸກງານ ແລ້ວກໍ່ບໍ່ມີໃຜເບິ່ງ. 2 ເທົ່າ = ໃຊ້ເວລາເປັນ**ສອງເທົ່າ**ຂອງທີ່ຕົກລົງໄວ້ — ອະທິບາຍໄດ້.
 */
export const SEVERE_RATIO = 2;
/** 4 ເທົ່າ = ວິກິດ (ຂຶ້ນສີແດງ ແລະ ຂຶ້ນເທິງສຸດຂອງລາຍງານ) */
export const CRITICAL_RATIO = 4;
/**
 * ຈຳນວນຈຸດ**ຕິດກັນ**ທີ່ມີເວລາ**ຄືກັນແທ້ (ວິນາທີດຽວ)** ຈຶ່ງຖືວ່າ "ບັນທຶກຄັ້ງດຽວຫຼາຍຂັ້ນ".
 * 2 ຈຸດຄືກັນ ເປັນໄປໄດ້ (ກົດຈົບ-ກົດຕໍ່ໄວໆ) ⇒ ເລີ່ມສົງໄສທີ່ **3 ຈຸດ**.
 * ຂໍ້ມູນຈິງ 21-08-2026: 634 ງານ 90 ມື້ — 3 ຈຸດ 10 ງານ · 4 ຈຸດ 9 ງານ (ຈຳນວນທີ່ໄລ່ໄດ້ໝົດ).
 */
export const BULK_RUN = 3;

/* ─────────────────────────────────────────────────────────────────────── ຜົນກວດ */

export type SpanState = "done" | "open" | "skipped" | "pending";

export type SpanResult = {
  stage: number;
  state: SpanState;
  /** ຈຸດເລີ່ມທີ່ໃຊ້ຈິງ (ຫຼັງຖອຍໄປໃຊ້ຈຸດກ່ອນ) */
  fromKey: CheckpointKey | null;
  fromAt: number | null;
  toAt: number | null;
  /** ວິນາທີທີ່ໃຊ້ໃນຂັ້ນນີ້ — `open` ນັບເຖິງດຽວນີ້ (ຫຼືເຖິງເວລາທີ່ນາລິກາຖືກຢຸດ) */
  seconds: number | null;
  targetHours: number | null;
  /** ໃຊ້ໄປ ÷ SLA — > 1 = ເກີນ (null = ບໍ່ມີ SLA ຫຼື ວັດບໍ່ໄດ້) */
  ratio: number | null;
  /** ວິນາທີທີ່ເກີນ SLA (0 ຖ້າທັນ) */
  overSeconds: number | null;
};

export type AnomalyKind = "out_of_order" | "skipped" | "future" | "bulk_entry" | "no_tech";

export type Anomaly = {
  kind: AnomalyKind;
  /**
   * `high` = timeline ຜິດແທ້ ⇒ ຕົວເລກ KPI ຂອງງານນີ້ເຊື່ອບໍ່ໄດ້, ຕ້ອງມີຄົນຊີ້ແຈງ.
   * `note` = ຂໍ້ສັງເກດ (ບໍ່ໄດ້ຕີວ່າງານມີບັນຫາເອງ ແຕ່ໜ້າສົງໄສ).
   */
  severity: "high" | "note";
  /** ຂໍ້ຄວາມທີ່ອ່ານອອກເລີຍ ໂດຍບໍ່ຕ້ອງເປີດງານໄປເບິ່ງ */
  detail: string;
  /** ຂັ້ນທີ່ກ່ຽວ (ຖ້າມີ) — ໃຫ້ໜ້າຈໍ/Excel ຈັດກຸ່ມໄດ້ */
  stage?: number;
};

/**
 * ລະດັບຄວາມແຮງ **ດ້ານເວລາ** ຢ່າງດຽວ (ບໍ່ລວມ timeline ຜິດ — ອັນນັ້ນຢູ່ `broken`).
 * ແຍກ 2 ແກນ ເພາະມັນເປັນບັນຫາຄົນລະຊະນິດ ແລະ **ຄົນລະຄົນແກ້**:
 * ຊ້າ = ໄປໄລ່ວຽກ · timeline ຜິດ = ໄປແກ້ການບັນທຶກ (ແລະ ຕົວເລກ KPI ໃບນັ້ນເຊື່ອບໍ່ໄດ້).
 */
export type AuditFlag = "critical" | "problem" | "watch" | "ok";

export type AuditResult = {
  spans: SpanResult[];
  /** ຂັ້ນທີ່ເກີນ SLA — ຮຽງຈາກເກີນຫຼາຍສຸດ */
  breaches: SpanResult[];
  worst: SpanResult | null;
  anomalies: Anomaly[];
  /** timeline ຜິດແທ້ (ມີ anomaly ລະດັບ high) — ຕົວເລກຂອງໃບນີ້ເຊື່ອບໍ່ໄດ້ */
  broken: boolean;
  /** ວິນາທີທັງງານ: ຮັບເຄື່ອງ → ສົ່ງຄືນ (ຫຼືເຖິງດຽວນີ້ ຖ້າຍັງບໍ່ຈົບ) */
  totalSeconds: number | null;
  flag: AuditFlag;
};

/** "ງານທີ່ມີບັນຫາຜິດປົກກະຕິ" ຕາມນິຍາມຂອງລາຍງານ — ຊ້າຫຼາຍ **ຫຼື** timeline ຜິດ */
export const isAuditProblem = (result: AuditResult): boolean =>
  result.broken || result.flag === "critical" || result.flag === "problem";

export type AuditInput = {
  code: string;
  serviceType: string | null;
  /** ໝົດຮັບປະກັນ ⇒ ຕ້ອງມີຂັ້ນສະເໜີລາຄາ (ຄືເງື່ອນໄຂໃນ STAGE_SQL) */
  warrantyExpired: boolean;
  usedSpare: boolean;
  /** ຂັ້ນປັດຈຸບັນ (STAGE_SQL) — ໃຊ້ບອກ "ໃຜຮັບຜິດຊອບດຽວນີ້" ຢູ່ຝັ່ງເອີ້ນ */
  stage: number;
  cancelled: boolean;
  /** ມີຊ່າງຮັບຜິດຊອບບໍ (emp_code) */
  hasTech: boolean;
  /** ດຽວນີ້ (epoch ວິນາທີ) — ໃຊ້ຫາ "ເວລາລ້ຳໜ້າ" */
  now: number;
  /**
   * ນັບເວລາຂັ້ນທີ່ຍັງເປີດ **ເຖິງເວລານີ້** — ປົກກະຕິ = `now` ແຕ່ງານທີ່ຖືກໝາຍ
   * "ວຽກມີບັນຫາ" ນາລິກາຢຸດ (ຄືກັບ STAGE_ELAPSED_SQL) ⇒ ບໍ່ໃຫ້ງານທີ່ລໍອາໄຫຼ່ນອກ
   * 300 ມື້ ກົບຕົວເລກຂອງທຸກຄົນໄວ້.
   */
  openUntil: number;
  points: Partial<Record<CheckpointKey, number | null>>;
};

/** SLA ຊົ່ວໂມງຂອງຂັ້ນ ຕາມປະເພດບໍລິການ — ສົ່ງມາຈາກ lib/repair-sla (ບໍ່ສຳເນົາໄວ້ນີ້) */
export type TargetHours = (stage: number, serviceType: string | null) => number | null;

const applies = (scope: SpanScope, input: AuditInput, at: (key: CheckpointKey) => number | null) => {
  if (scope === "quote") return input.warrantyExpired;
  if (scope === "spare") return input.usedSpare;
  if (scope === "purchase") return at("spare_order") != null;
  return true;
};

/** ວິນາທີ → "3 ມື້ 4 ຊມ" / "5 ຊມ 20 ນທ" / "40 ນທ" — ໃຊ້ຮ່ວມ ໜ້າຈໍ ແລະ Excel */
export function formatSpan(seconds: number | null): string {
  if (seconds == null) return "-";
  const value = Math.round(Math.abs(seconds));
  const sign = seconds < 0 ? "-" : "";
  if (value < 60) return `${sign}${value} ວິນາທີ`;
  const minutes = Math.floor(value / 60);
  if (minutes < 60) return `${sign}${minutes} ນທ`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    const rest = minutes % 60;
    return rest ? `${sign}${hours} ຊມ ${rest} ນທ` : `${sign}${hours} ຊມ`;
  }
  const days = Math.floor(hours / 24);
  const rest = hours % 24;
  return rest ? `${sign}${days} ມື້ ${rest} ຊມ` : `${sign}${days} ມື້`;
}

/** SLA ຊົ່ວໂມງ → ຂໍ້ຄວາມສັ້ນ ("2 ຊມ" / "7 ມື້") */
export function formatTarget(hours: number | null): string {
  if (!hours) return "-";
  return hours % 24 === 0 && hours >= 24 ? `${hours / 24} ມື້` : `${hours} ຊມ`;
}

/**
 * ກວດງານໜຶ່ງໜ່ວຍ — ຄືນທັງ "ຂັ້ນໃດເກີນ SLA" ແລະ "timeline ຜິດຢູ່ໃສ".
 * ບໍ່ມີ side effect, ບໍ່ຖາມ DB ⇒ ທົດສອບໄດ້ຄົບທຸກກໍລະນີ (tests/repair-audit.test.mts).
 */
export function analyzeRepairJob(input: AuditInput, targetHours: TargetHours): AuditResult {
  const at = (key: CheckpointKey) => input.points[key] ?? null;
  /**
   * ຂັ້ນ 0 (PS ລໍໄປຮັບເຄື່ອງ · IH ລໍນັດໝາຍ) **ບໍ່ມີແຖວຂອງຕົນໃນຕາຕະລາງ SLA** —
   * ນະໂຍບາຍນັບມັນຢູ່ໃນຂັ້ນ 1 ("ຮັບງານ / ເລີ່ມກວດ" — PS 24 ຊມ ລວມເວລາໄປຮັບ)
   * ⇒ ຖືວ່າງານຂັ້ນ 0 ກຳລັງເປີດຢູ່ຂັ້ນ 1. ບໍ່ດັ່ງນັ້ນງານທີ່ຄາຢູ່ຂັ້ນ 0 ຈະບໍ່ມີນາລິກາຈັກອັນ.
   */
  const activeStage = input.stage <= 0 ? 1 : input.stage;

  /* ── ① ເວລາຕໍ່ຂັ້ນ ທຽບ SLA ─────────────────────────────────────── */
  const spans: SpanResult[] = [];
  for (const span of STAGE_SPANS) {
    if (!applies(span.scope, input, at)) continue;

    const fromKey = span.from.find((key) => at(key) != null) ?? null;
    const fromAt = fromKey ? at(fromKey) : null;
    const toAt = at(span.to);
    const target = targetHours(span.stage, input.serviceType);

    /**
     * ── **ຂັ້ນທີ່ຍັງເປີດ ມີໄດ້ອັນດຽວ** ──
     * ຂັ້ນທີ່ "ເປີດ" = ຂັ້ນປັດຈຸບັນຂອງງານ (STAGE_SQL) ເທົ່ານັ້ນ. ບໍ່ດັ່ງນັ້ນ ງານທີ່ຢູ່ຂັ້ນ 6
     * ຈະຖືກນັບເປັນ "ຄ້າງ" ຢູ່ຂັ້ນ 5 · 6 · 8 ພ້ອມກັນ (ຂັ້ນ 8 ນັບຈາກ quote_done ຊຶ່ງມີເວລາຢູ່ແລ້ວ)
     * ⇒ ເວລາຖືກນັບຊ້ຳ 3 ເທື່ອ ແລະ ຕາຕະລາງບອກ "ຄໍຂວດ" ຜິດ. ວັດແລ້ວກັບຂໍ້ມູນຈິງ 21-08-2026:
     * ງານ 7053 (ຂັ້ນ 6) ລາຍງານ 3 ຂັ້ນເປີດພ້ອມກັນ ກ່ອນຈະແກ້ບ່ອນນີ້.
     *
     * ຂັ້ນປັດຈຸບັນ **ຢູ່ຫຼັງ** ຂັ້ນນີ້ ⇒ ຖືວ່າຜ່ານໄປແລ້ວ (ຫຼັກຖານອີກຢ່າງ ນອກຈາກ `proof`):
     * ຂໍ້ມູນເກົ່າບາງໃບບໍ່ໄດ້ຕັ້ງຖັນຂອງຂັ້ນນັ້ນເລີຍ (ເຊັ່ນ spare_reg — ເບິ່ງໝາຍເຫດຂັ້ນ 5/6
     * ໃນ lib/stage) ⇒ ຖ້າຖືວ່າ "ຍັງລໍ" ນາລິກາຈະເດີນຢູ່ຂັ້ນທີ່ງານອອກໄປແລ້ວ.
     */
    const passed =
      (span.proof != null && at(span.proof) != null) ||
      at("returned") != null ||
      // ⚠️ ຂັ້ນອາໄຫຼ່ (5·6·7) **ບໍ່ໄປຕາມເລກ**: workflow ໃໝ່ ສັ່ງຊື້/ຮັບເຂົ້າ (7) **ກ່ອນ**
      // ອອກໃບຂໍເບີກ (5) ໄດ້ (ເບິ່ງໝາຍເຫດຂັ້ນ 7 ໃນ lib/stage) ⇒ "ຂັ້ນ 7 > ຂັ້ນ 5" ບໍ່ໄດ້
      // ພິສູດວ່າຜ່ານຂັ້ນ 5 ໄປແລ້ວ. ໃຊ້ໄດ້ສະເພາະຂັ້ນທີ່ລຳດັບຄົງທີ່ ⇒ ຫຼີກ false positive
      // "ຂ້າມຂັ້ນ" ຂອງງານທີ່ພຽງແຕ່ກຳລັງລໍອາໄຫຼ່ຢູ່.
      (span.scope === "always" || span.scope === "quote"
        ? activeStage > span.stage && activeStage <= 12
        : false);

    let state: SpanState;
    let seconds: number | null = null;
    if (toAt != null && fromAt != null) {
      state = "done";
      seconds = toAt - fromAt;
    } else if (toAt != null) {
      // ມີເວລາຈົບ ແຕ່ບໍ່ມີເວລາເລີ່ມ — ວັດບໍ່ໄດ້ ແຕ່ຜ່ານໄປແລ້ວ
      state = "done";
    } else if (activeStage === span.stage && at("returned") == null && fromAt != null) {
      state = "open";
      seconds = Math.max(0, input.openUntil - fromAt);
    } else if (passed) {
      state = "skipped";
    } else {
      state = "pending";
    }

    // ratio ຄິດຈາກເວລາທີ່ບໍ່ຕິດລົບ — ເວລາຖອຍຫຼັງເປັນເລື່ອງຂອງ ② ບໍ່ແມ່ນເລື່ອງ SLA
    const usable = seconds == null ? null : Math.max(0, seconds);
    const ratio = usable != null && target ? usable / (target * 3600) : null;
    spans.push({
      stage: span.stage,
      state,
      fromKey,
      fromAt,
      toAt,
      seconds,
      targetHours: target,
      ratio,
      overSeconds: usable != null && target ? Math.max(0, usable - target * 3600) : null,
    });
  }

  const breaches = spans
    .filter((span) => span.ratio != null && span.ratio > 1)
    .sort((left, right) => (right.ratio ?? 0) - (left.ratio ?? 0));
  const worst = breaches[0] ?? null;

  /* ── ② timeline ຖືກຕ້ອງບໍ ────────────────────────────────────────── */
  const anomalies: Anomaly[] = [];
  const stamp = (key: CheckpointKey) => `${CHECKPOINT_LABEL[key]}`;

  // ເວລາຖອຍຫຼັງ ໃນກະດູກສັນຫຼັງ — ທຽບກັບຈຸດກ່ອນໜ້າ**ທີ່ມີເວລາ** (ຈຸດຫວ່າງບໍ່ບັງ)
  let previous: { key: CheckpointKey; at: number } | null = null;
  for (const key of SPINE) {
    const value = at(key);
    if (value == null) continue;
    if (previous && value < previous.at) {
      anomalies.push({
        kind: "out_of_order",
        severity: "high",
        detail: `${stamp(key)} ເກີດກ່ອນ ${stamp(previous.key)} (ຖອຍຫຼັງ ${formatSpan(previous.at - value)})`,
      });
    }
    // ຈຸດຕໍ່ໄປຕ້ອງທຽບກັບ "ອັນຫຼ້າສຸດ" ບໍ່ແມ່ນອັນທີ່ໃຫຍ່ສຸດ — ບໍ່ດັ່ງນັ້ນຄວາມຜິດອັນດຽວຈະລາຍງານຫຼາຍເທື່ອ
    previous = { key, at: value };
  }

  // ຄູ່ສາຍອາໄຫຼ່ (ລຳດັບບໍ່ຄົງທີ່ ⇒ ກວດເປັນຄູ່)
  for (const [earlier, later] of SPARE_PAIRS) {
    const first = at(earlier);
    const second = at(later);
    if (first == null || second == null || second >= first) continue;
    anomalies.push({
      kind: "out_of_order",
      severity: "high",
      detail: `${stamp(later)} ເກີດກ່ອນ ${stamp(earlier)} (ຖອຍຫຼັງ ${formatSpan(first - second)})`,
    });
  }

  // ຂ້າມຂັ້ນ — ຈາກຜົນ span ຂ້າງເທິງ (ບໍ່ຄິດຄືນໃໝ່ ⇒ ບໍ່ມີທາງບອກຄົນລະເລື່ອງກັບຕາຕະລາງ)
  for (const span of spans) {
    if (span.state !== "skipped") continue;
    // ງານທີ່ຖືກຍົກເລີກ: ບໍ່ຜ່ານ QC/ສ້ອມ ເປັນເລື່ອງປົກກະຕິ ⇒ ບໍ່ນັບເປັນຄວາມຜິດ
    if (input.cancelled) continue;
    const definition = STAGE_SPANS.find((item) => item.stage === span.stage);
    if (!definition) continue;
    /**
     * ⚠️ ຂັ້ນອາໄຫຼ່ = **ຂໍ້ສັງເກດ ບໍ່ແມ່ນຄວາມຜິດ**. ຄວາມຈິງຂອງສາຍອາໄຫຼ່ຢູ່ທີ່ **ແຖວ SIO**
     * (ic_trans_detail.arrive_at ຕໍ່ລາຍການ) ບໍ່ແມ່ນທຸງລວມຢູ່ຫົວໃບ — ທຸງ `spare_arrive`
     * ຖືກສະແຕມແຕ່ຕອນ syncErpPurchase ໄລ່ໃບຮັບເຂົ້າຄົບ ⇒ ຂໍ້ມູນຈິງ 21-08-2026 ມີ
     * spare_order 35 ໃບ ແຕ່ spare_arrive ພຽງ 8 ໃບ. ຖ້າຕີເປັນ "timeline ຜິດ" ຈະໄດ້
     * 19 ໃບປອມ ກົບ 13 ໃບຜິດແທ້ໆໄວ້ຈົນຫາບໍ່ພົບ (ວັດແລ້ວ ກ່ອນຈະແກ້ບ່ອນນີ້).
     */
    const spareChain = definition.scope === "spare" || definition.scope === "purchase";
    anomalies.push({
      kind: "skipped",
      severity: spareChain ? "note" : "high",
      stage: span.stage,
      detail: spareChain
        ? `ຂັ້ນ ${span.stage}: ບໍ່ມີທຸງ "${CHECKPOINT_LABEL[definition.to]}" ຢູ່ຫົວໃບງານ (ຄວາມຈິງອາໄຫຼ່ຢູ່ແຖວໃບຂໍເບີກ/ໃບສັ່ງຊື້)`
        : `ຂັ້ນ ${span.stage}: ບໍ່ມີການບັນທຶກ "${CHECKPOINT_LABEL[definition.to]}" ແຕ່ງານຜ່ານຂັ້ນນີ້ໄປແລ້ວ`,
    });
  }

  // ເວລາລ້ຳໜ້າ — ບັນທຶກໄວ້ໃນອະນາຄົດ (ພິມວັນທີຜິດ)
  for (const key of ORDER) {
    const value = at(key);
    if (value != null && value > input.now) {
      anomalies.push({
        kind: "future",
        severity: "high",
        detail: `${stamp(key)} ເປັນເວລາໃນອະນາຄົດ (ລ້ຳໜ້າ ${formatSpan(value - input.now)})`,
      });
    }
  }

  // ບັນທຶກຫຼາຍຂັ້ນພ້ອມກັນ — ວິນາທີດຽວກັນຕິດກັນ ≥ BULK_RUN ຈຸດ
  let run: CheckpointKey[] = [];
  const flushRun = () => {
    if (run.length >= BULK_RUN) {
      anomalies.push({
        kind: "bulk_entry",
        severity: "note",
        detail: `${run.length} ຂັ້ນຖືກບັນທຶກເປັນເວລາດຽວກັນ (${run.map(stamp).join(" = ")}) — ນ່າຈະປ້ອນຄືນຫຼັງ`,
      });
    }
    run = [];
  };
  for (const key of SPINE) {
    const value = at(key);
    if (value == null) {
      flushRun();
      continue;
    }
    const head = run[0];
    if (head && at(head) === value) run.push(key);
    else {
      flushRun();
      run = [key];
    }
  }
  flushRun();

  // ບໍ່ມີຊ່າງ ແຕ່ງານເດີນໜ້າໄປແລ້ວ — ຄ່າຄອມ/ຄວາມຮັບຜິດຊອບຫາຍ
  if (!input.hasTech && at("check_start") != null) {
    anomalies.push({ kind: "no_tech", severity: "note", detail: "ບໍ່ມີຊ່າງຮັບຜິດຊອບໃນໃບງານ ແຕ່ເລີ່ມກວດເຊັກໄປແລ້ວ" });
  }

  /* ── ສະຫຼຸບ ─────────────────────────────────────────────────────── */
  const intake = at("intake");
  const returned = at("returned");
  const totalSeconds = intake == null ? null : (returned ?? input.openUntil) - intake;

  const ratio = worst?.ratio ?? 0;
  const broken = anomalies.some((item) => item.severity === "high");
  const flag: AuditFlag =
    ratio >= CRITICAL_RATIO ? "critical" : ratio >= SEVERE_RATIO ? "problem" : breaches.length ? "watch" : "ok";

  return { spans, breaches, worst, anomalies, broken, totalSeconds, flag };
}

/* ──────────────────────────────────────────── ໝວດສາເຫດ ຂອງບັນທຶກຊີ້ແຈງ (ods_repair_audit) */

/**
 * ໝວດສາເຫດ — ຄ່າໃນຖານ ↔ ຄຳທີ່ຄົນອ່ານ. ບັງຄັບເລືອກໝວດ (ບໍ່ແມ່ນຂຽນລອຍ) ຈຶ່ງສະຫຼຸບເປັນ
 * ຕົວເລກໄດ້ວ່າ "ງານຄ້າງຍ້ອນຫຍັງຫຼາຍສຸດ" — ຄຳຕອບແບບຂຽນລອຍນັບບໍ່ໄດ້.
 * ໝວດ 2 ອັນສຸດທ້າຍແກ້ບັນຫາຄົນລະຊະນິດ: **ຕົວເລກຜິດ** ບໍ່ແມ່ນ **ວຽກຊ້າ**.
 */
export const AUDIT_CAUSE_LABEL: Record<string, string> = {
  spare_wait: "ລໍອາໄຫຼ່ / ສັ່ງຊື້ຊ້າ",
  no_stock: "ອາໄຫຼ່ບໍ່ມີຂາຍ",
  customer_wait: "ລໍລູກຄ້າຕອບ / ອະນຸມັດລາຄາ",
  supplier_wait: "ລໍ Supplier / ຜົນເຄມ",
  tech_load: "ຊ່າງບໍ່ພໍ / ວຽກກອງ",
  external: "ເຫດສຸດວິສັຍ (ຂົນສົ່ງ · ດິນຟ້າອາກາດ)",
  data_entry: "ບັນທຶກເວລາຜິດ / ບໍ່ບັນທຶກຕາມຂັ້ນຕອນ",
  process_skip: "ຂ້າມຂັ້ນຕອນການເຮັດວຽກ",
  other: "ອື່ນໆ",
};

export const AUDIT_CAUSES = Object.keys(AUDIT_CAUSE_LABEL);

export const auditCauseLabel = (cause: string | null | undefined): string =>
  (cause && AUDIT_CAUSE_LABEL[cause]) || "-";

export const ANOMALY_LABEL: Record<AnomalyKind, string> = {
  out_of_order: "ເວລາຜິດລຳດັບ",
  skipped: "ຂ້າມຂັ້ນຕອນ",
  future: "ເວລາລ້ຳໜ້າ",
  bulk_entry: "ບັນທຶກພ້ອມກັນ",
  no_tech: "ບໍ່ມີຊ່າງຮັບຜິດຊອບ",
};

export const AUDIT_FLAG_LABEL: Record<AuditFlag, string> = {
  critical: `ວິກິດ (ເກີນ ${CRITICAL_RATIO} ເທົ່າ)`,
  problem: `ຜິດປົກກະຕິ (ເກີນ ${SEVERE_RATIO} ເທົ່າ)`,
  watch: "ເກີນ SLA ເລັກນ້ອຍ",
  ok: "ຢູ່ໃນ SLA",
};
