import assert from "node:assert/strict";
import test from "node:test";
import {
  analyzeRepairJob,
  AUDIT_CHECKPOINTS,
  BULK_RUN,
  CRITICAL_RATIO,
  formatSpan,
  isAuditProblem,
  SEVERE_RATIO,
  STAGE_SPANS,
  type AuditInput,
  type CheckpointKey,
} from "../src/lib/repair-audit-check.ts";

/**
 * ການກວດສອບງານສ້ອມ — ກົດເກນທີ່ **ຫ້າມພັງ**.
 * ໃຊ້ SLA ປອມ (2 ຊມ ທຸກຂັ້ນ) ຈຶ່ງທົດສອບ **ຕົວກົດເກນ** ບໍ່ແມ່ນທົດສອບຄ່ານະໂຍບາຍ
 * (ນະໂຍບາຍປ່ຽນໄດ້ຢູ່ lib/repair-sla ໂດຍທີ່ test ບໍ່ຄວນແດງ).
 */
const HOUR = 3600;
const T0 = 1_700_000_000;
const sla2h = () => 2;

const job = (points: Partial<Record<CheckpointKey, number>>, extra: Partial<AuditInput> = {}): AuditInput => ({
  code: "TEST",
  serviceType: "CI",
  warrantyExpired: false,
  usedSpare: false,
  stage: 9,
  cancelled: false,
  hasTech: true,
  now: T0 + 1000 * HOUR,
  openUntil: T0 + 1000 * HOUR,
  points,
  ...extra,
});

test("ຂັ້ນທີ່ຈົບພາຍໃນ SLA ບໍ່ຖືກລາຍງານ", () => {
  const result = analyzeRepairJob(
    job({ intake: T0, check_start: T0 + HOUR, check_done: T0 + 2 * HOUR, repair_start: T0 + 3 * HOUR, repair_done: T0 + 4 * HOUR, qc_done: T0 + 5 * HOUR, returned: T0 + 6 * HOUR }, { stage: 12 }),
    sla2h,
  );
  assert.equal(result.breaches.length, 0);
  assert.equal(result.broken, false);
  assert.equal(result.flag, "ok");
  assert.equal(isAuditProblem(result), false);
});

test("ເກີນ SLA ຫຼາຍເທົ່າ ⇒ critical ແລະ ບອກຂັ້ນທີ່ຮ້າຍສຸດ", () => {
  const over = CRITICAL_RATIO * 2 * HOUR + HOUR; // ເກີນ 4 ເທົ່າ ຂອງ SLA 2 ຊມ
  const result = analyzeRepairJob(
    job({ intake: T0, check_start: T0 + over, check_done: T0 + over + HOUR }, { stage: 2 }),
    sla2h,
  );
  assert.equal(result.flag, "critical");
  assert.equal(result.worst?.stage, 1);
  assert.ok((result.worst?.ratio ?? 0) >= CRITICAL_RATIO);
  assert.equal(isAuditProblem(result), true);
});

test("ເກີນເລັກນ້ອຍ = watch ບໍ່ແມ່ນ problem (ບໍ່ດັ່ງນັ້ນລາຍງານຈະມີທຸກງານ)", () => {
  const result = analyzeRepairJob(
    job({ intake: T0, check_start: T0 + 2.5 * HOUR, check_done: T0 + 3 * HOUR }, { stage: 2 }),
    sla2h,
  );
  assert.equal(result.flag, "watch");
  assert.ok((result.worst?.ratio ?? 0) < SEVERE_RATIO);
  assert.equal(isAuditProblem(result), false);
});

test("**ຂັ້ນທີ່ຍັງເປີດ ມີໄດ້ອັນດຽວ** — ຂັ້ນປັດຈຸບັນເທົ່ານັ້ນ (ກັນນັບເວລາຊ້ຳ)", () => {
  // ງານຢູ່ຂັ້ນ 6: ຂັ້ນ 5 ກັບ 8 ກໍ່ມີຈຸດເລີ່ມແລ້ວ ແຕ່ຫ້າມນັບເປັນ "ຄ້າງ" ພ້ອມກັນ
  const result = analyzeRepairJob(
    job(
      { intake: T0, check_start: T0 + HOUR, check_done: T0 + 2 * HOUR, spare_request: T0 + 3 * HOUR },
      { stage: 6, usedSpare: true },
    ),
    sla2h,
  );
  const open = result.spans.filter((span) => span.state === "open");
  assert.equal(open.length, 1);
  assert.equal(open[0].stage, 6);
});

test("ຂັ້ນ 0 (ລໍໄປຮັບເຄື່ອງ / ລໍນັດໝາຍ) ນັບຢູ່ຂັ້ນ 1 — ບໍ່ໃຫ້ນາລິກາຫາຍ", () => {
  const result = analyzeRepairJob(job({ intake: T0 }, { stage: 0, serviceType: "PS" }), sla2h);
  const open = result.spans.filter((span) => span.state === "open");
  assert.equal(open.length, 1);
  assert.equal(open[0].stage, 1);
});

test("ນາລິກາຢຸດຢູ່ openUntil (ງານທີ່ຖືກໝາຍ ວຽກມີບັນຫາ)", () => {
  const stopped = T0 + 10 * HOUR;
  const result = analyzeRepairJob(job({ intake: T0 }, { stage: 1, openUntil: stopped }), sla2h);
  assert.equal(result.spans.find((span) => span.stage === 1)?.seconds, 10 * HOUR);
});

test("ເວລາຖອຍຫຼັງ ⇒ timeline ຜິດ (broken) ແລະ ບອກຄູ່ຈຸດທີ່ຜິດ", () => {
  const result = analyzeRepairJob(
    job({ intake: T0, check_start: T0 + HOUR, check_done: T0 + 2 * HOUR, repair_start: T0 + 5 * HOUR, repair_done: T0 + 3 * HOUR }, { stage: 10 }),
    sla2h,
  );
  assert.equal(result.broken, true);
  const found = result.anomalies.find((item) => item.kind === "out_of_order");
  assert.ok(found);
  assert.match(found.detail, /ສ້ອມສຳເລັດ/);
  assert.equal(found.severity, "high");
});

test("ຄວາມຜິດອັນດຽວ ລາຍງານເທື່ອດຽວ (ບໍ່ລາມໄປທຸກຈຸດທີ່ຕາມມາ)", () => {
  // `ຮັບເຄື່ອງ` ຖືກປ້ອນຊ້າກວ່າທຸກຈຸດ ⇒ ຜິດ **1 ຄູ່** (intake→check_start) ບໍ່ແມ່ນ 4 ຄູ່
  const result = analyzeRepairJob(
    job(
      { intake: T0 + 20 * HOUR, check_start: T0 + 10 * HOUR, check_done: T0 + 11 * HOUR, repair_start: T0 + 12 * HOUR, repair_done: T0 + 13 * HOUR },
      { stage: 10 },
    ),
    sla2h,
  );
  const found = result.anomalies.filter((item) => item.kind === "out_of_order");
  assert.equal(found.length, 1);
  assert.match(found[0].detail, /ເລີ່ມກວດເຊັກ/);
});

test("ສົ່ງຄືນໂດຍບໍ່ຜ່ານ QC = ຂ້າມຂັ້ນ (high)", () => {
  const result = analyzeRepairJob(
    job({ intake: T0, check_start: T0 + HOUR, check_done: T0 + 2 * HOUR, repair_start: T0 + 3 * HOUR, repair_done: T0 + 4 * HOUR, returned: T0 + 5 * HOUR }, { stage: 12 }),
    sla2h,
  );
  const skipped = result.anomalies.find((item) => item.kind === "skipped" && item.stage === 10);
  assert.ok(skipped);
  assert.equal(skipped.severity, "high");
  assert.equal(result.broken, true);
});

test("ງານທີ່ຍົກເລີກ ບໍ່ຖືກຫາວ່າຂ້າມຂັ້ນ (ບໍ່ຜ່ານ QC ເປັນເລື່ອງປົກກະຕິ)", () => {
  const result = analyzeRepairJob(
    job({ intake: T0, check_start: T0 + HOUR, check_done: T0 + 2 * HOUR, returned: T0 + 5 * HOUR }, { stage: 12, cancelled: true }),
    sla2h,
  );
  assert.equal(result.anomalies.filter((item) => item.kind === "skipped").length, 0);
});

test("ສາຍອາໄຫຼ່: ຂັ້ນ 7 ບໍ່ມີທຸງ 'ມາຮອດ' = ຂໍ້ສັງເກດ ບໍ່ແມ່ນ timeline ຜິດ", () => {
  // ຄວາມຈິງຂອງອາໄຫຼ່ຢູ່ແຖວ SIO — ທຸງຫົວໃບຫວ່າງເປັນເລື່ອງທຳມະດາ (19/35 ໃບ ໃນຂໍ້ມູນຈິງ)
  const result = analyzeRepairJob(
    job(
      { intake: T0, check_start: T0 + HOUR, check_done: T0 + 2 * HOUR, spare_request: T0 + 3 * HOUR, spare_order: T0 + 4 * HOUR, spare_ready: T0 + 5 * HOUR, repair_start: T0 + 6 * HOUR, repair_done: T0 + 7 * HOUR },
      { stage: 10, usedSpare: true },
    ),
    sla2h,
  );
  const skipped = result.anomalies.filter((item) => item.kind === "skipped");
  assert.ok(skipped.length > 0);
  assert.ok(skipped.every((item) => item.severity === "note"));
  assert.equal(result.broken, false);
});

test("ຂັ້ນ 7 ຢູ່ຫຼັງຂັ້ນ 5 ຕາມເລກ ແຕ່ **ບໍ່ພິສູດ** ວ່າຜ່ານຂັ້ນ 5 (workflow ສັ່ງຊື້ກ່ອນຂໍເບີກ)", () => {
  const result = analyzeRepairJob(
    job({ intake: T0, check_start: T0 + HOUR, check_done: T0 + 2 * HOUR, spare_order: T0 + 3 * HOUR }, { stage: 7, usedSpare: true }),
    sla2h,
  );
  assert.equal(result.spans.find((span) => span.stage === 5)?.state, "pending");
  assert.equal(result.broken, false);
});

test("ບັນທຶກຫຼາຍຂັ້ນວິນາທີດຽວກັນ = ຂໍ້ສັງເກດ (ບໍ່ຕີວ່າ timeline ຜິດ)", () => {
  const result = analyzeRepairJob(
    job({ intake: T0, check_start: T0, check_done: T0, repair_start: T0 + HOUR }, { stage: 9 }),
    sla2h,
  );
  const bulk = result.anomalies.find((item) => item.kind === "bulk_entry");
  assert.ok(bulk);
  assert.equal(bulk.severity, "note");
  assert.equal(result.broken, false);
  assert.ok(BULK_RUN >= 3);
});

test("2 ຈຸດຄືກັນ ຍັງບໍ່ນັບ (ກົດຈົບ-ກົດຕໍ່ໄວໆ ເປັນໄປໄດ້)", () => {
  const result = analyzeRepairJob(job({ intake: T0, check_start: T0, check_done: T0 + HOUR }, { stage: 9 }), sla2h);
  assert.equal(result.anomalies.filter((item) => item.kind === "bulk_entry").length, 0);
});

test("ເວລາໃນອະນາຄົດ ⇒ ຜິດ", () => {
  const result = analyzeRepairJob(job({ intake: T0, check_start: T0 + 2000 * HOUR }, { stage: 2 }), sla2h);
  assert.ok(result.anomalies.some((item) => item.kind === "future"));
  assert.equal(result.broken, true);
});

test("ບໍ່ມີຊ່າງ ແຕ່ເລີ່ມກວດແລ້ວ = ຂໍ້ສັງເກດ", () => {
  const result = analyzeRepairJob(job({ intake: T0, check_start: T0 + HOUR }, { stage: 2, hasTech: false }), sla2h);
  assert.ok(result.anomalies.some((item) => item.kind === "no_tech"));
  assert.equal(result.broken, false);
});

test("ຂັ້ນສະເໜີລາຄາ ນັບສະເພາະງານໝົດຮັບປະກັນ", () => {
  const inWarranty = analyzeRepairJob(job({ intake: T0, check_start: T0 + HOUR, check_done: T0 + 2 * HOUR }, { stage: 8 }), sla2h);
  const expired = analyzeRepairJob(
    job({ intake: T0, check_start: T0 + HOUR, check_done: T0 + 2 * HOUR }, { stage: 8, warrantyExpired: true }),
    sla2h,
  );
  assert.equal(inWarranty.spans.some((span) => span.stage === 3), false);
  assert.equal(expired.spans.some((span) => span.stage === 3), true);
});

test("ບໍ່ມີ SLA ⇒ ບໍ່ຕັດສິນວ່າຊ້າ (ratio ເປັນ null)", () => {
  const result = analyzeRepairJob(job({ intake: T0, check_start: T0 + 500 * HOUR }, { stage: 2 }), () => null);
  assert.equal(result.breaches.length, 0);
  assert.equal(result.flag, "ok");
});

test("ຈຸດກວດ ແລະ ຂັ້ນ SLA ຜູກກັນຄົບ — ບໍ່ມີ key ຫຼົງ", () => {
  const keys = new Set(AUDIT_CHECKPOINTS.map((point) => point.key));
  for (const span of STAGE_SPANS) {
    assert.ok(keys.has(span.to), `span ${span.stage} to=${span.to} ບໍ່ມີໃນຈຸດກວດ`);
    for (const from of span.from) assert.ok(keys.has(from), `span ${span.stage} from=${from} ບໍ່ມີໃນຈຸດກວດ`);
    if (span.proof) assert.ok(keys.has(span.proof), `span ${span.stage} proof=${span.proof} ບໍ່ມີໃນຈຸດກວດ`);
  }
  // ທຸກຈຸດກວດຕ້ອງມີ SQL ທີ່ alias ເປັນ a. (ຂໍ້ຕົກລົງດຽວກັບ STAGE_SQL)
  for (const point of AUDIT_CHECKPOINTS) assert.match(point.column, /a\./);
});

test("formatSpan ອ່ານອອກ ທຸກຊ່ວງ", () => {
  assert.equal(formatSpan(null), "-");
  assert.equal(formatSpan(30), "30 ວິນາທີ");
  assert.equal(formatSpan(90 * 60), "1 ຊມ 30 ນທ");
  assert.equal(formatSpan(2 * 86400), "2 ມື້");
  assert.equal(formatSpan(2 * 86400 + 3 * HOUR), "2 ມື້ 3 ຊມ");
});
