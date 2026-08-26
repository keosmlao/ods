import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { stageFixSql } from "../src/lib/stage-fix.ts";

const src = (name: string) => readFileSync(new URL(`../src/lib/${name}`, import.meta.url), "utf8");

/**
 * ── ຕົກ QC ⇒ ວຽກສ້ອມກັບໄປ "ລໍຖ້າສ້ອມແປງ" (ຂັ້ນ 8) — 26-08-2026 ຕາມຄຳສັ່ງ ──
 * ຂັ້ນບໍ່ໄດ້ເກັບເປັນຄໍລຳ ⇒ "ກັບໄປຂັ້ນ 8" ແມ່ນ **ຊຸດຖັນເວລາ** ທີ່ຕ້ອງລ້າງໃຫ້ຄົບ.
 * ລ້າງແຕ່ time_finish_repair ວຽກຈະຄາຢູ່ຂັ້ນ 9 (ກຳລັງສ້ອມແປງ) ໂດຍບໍ່ມີໃຜກຳລັງສ້ອມ.
 */
const sendBackSetOf = (workflow: string) => {
  const found = src("qc-flow.ts").match(
    new RegExp(`${workflow}:\\s*\\{[^}]*sendBackSet:\\s*"([^"]*)"`),
  );
  assert.ok(found, `ບໍ່ພົບ sendBackSet ຂອງ ${workflow} ໃນ lib/qc-flow`);
  return found[1];
};
const repairSendBack = sendBackSetOf("repair");

test("ຕົກ QC (ສ້ອມ) ລ້າງທັງ time_repair ແລະ time_finish_repair ⇒ ຕົກຂັ້ນ 8", () => {
  assert.match(repairSendBack, /time_finish_repair = null/);
  assert.match(repairSendBack, /time_repair = null/);
});

test("ຊຸດຖັນຂອງ QC ຕົງກັບຂັ້ນ 8 ຂອງ lib/stage-fix", () => {
  // stage-fix ນິຍາມ "ຂັ້ນ 8 ໜ້າຕາແນວໃດ" ໄວ້ບ່ອນດຽວ — QC ຕ້ອງລ້າງຊຸດດຽວກັນ
  const fix = stageFixSql(8, "localtimestamp(0)");
  for (const column of ["time_repair", "time_finish_repair"]) {
    assert.ok(fix.includes(`${column} = null`), `stage-fix ຂັ້ນ 8 ຕ້ອງລ້າງ ${column}`);
    assert.ok(repairSendBack.includes(`${column} = null`), `QC ຕ້ອງລ້າງ ${column} ຄືກັນ`);
  }
});

test("ນາລິກາຂັ້ນ 8 ເລີ່ມນັບຈາກ qc_reject_at ກ່ອນຖັນອາໄຫຼ່ເກົ່າ", () => {
  // ບໍ່ດັ່ງນັ້ນວຽກທີ່ຫາກໍ່ຖືກສົ່ງກັບຈະຂຶ້ນວ່າຄ້າງຫຼາຍສິບມື້ ແລະ ເກີນ SLA ທັນທີ
  assert.match(repairSendBack, /qc_reject_at = localtimestamp\(0\)/);
  const stage8 = src("stage.ts").split("when 8  then ")[1].split("\n")[0];
  assert.match(stage8, /^coalesce\(a\.qc_reject_at,/, "STAGE_TIME_COL ຂັ້ນ 8");
  const entry8 = src("repair-timeline.ts").split("  8: ")[1].split("\n")[0];
  assert.match(entry8, /coalesce\(a\.qc_reject_at,/, "repair-timeline ENTRY[8] ຕ້ອງບໍ່ຫຼົ້ນກັບ STAGE_TIME_COL");
});

test("ຝັ່ງຕິດຕັ້ງບໍ່ຖືກແຕະ — ຍັງລ້າງແຕ່ finish_install", () => {
  const installSendBack = sendBackSetOf("install");
  assert.match(installSendBack, /finish_install = null/);
  assert.doesNotMatch(installSendBack, /qc_reject_at/);
});

/* ── ຕົກ QC ແລ້ວປະຫວັດຕ້ອງບໍ່ຫາຍ (26-08-2026 ຕາມຄຳສັ່ງ) ──────────────────── */

const qcFlow = src("qc-flow.ts");

test("ເກັບປະຫວັດຮອບ **ກ່ອນ** ລ້າງຖັນ — ບໍ່ດັ່ງນັ້ນອ່ານໄດ້ແຕ່ null", () => {
  const archive = qcFlow.indexOf("insert into ods_qc_round");
  const clear = qcFlow.indexOf("set ${table.sendBackSet}");
  assert.ok(archive > 0 && clear > 0, "ຕ້ອງມີທັງການເກັບປະຫວັດ ແລະ ການລ້າງຖັນ");
  assert.ok(archive < clear, "insert ods_qc_round ຕ້ອງມາກ່ອນ update ທີ່ລ້າງຖັນ");
});

test("ທຸກຖັນທີ່ QC ລ້າງ ຖືກເກັບເຂົ້າປະຫວັດກ່ອນ", () => {
  const archive = qcFlow.slice(
    qcFlow.indexOf("insert into ods_qc_round"),
    qcFlow.indexOf("set ${table.sendBackSet}"),
  );
  // ຖັນທີ່ຖືກລ້າງ = ຖັນທີ່ຕ້ອງມີບ່ອນເກັບ (qc_reject_at ເປັນຖັນໃໝ່ ບໍ່ແມ່ນຂໍ້ມູນທີ່ຫາຍ)
  const cleared = repairSendBack
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.endsWith("= null"))
    .map((part) => part.replace(" = null", ""));
  assert.deepEqual(cleared, ["time_finish_repair", "time_repair"]);
  assert.ok(archive.includes("${table.startCol}"), "ຕ້ອງເກັບເວລາເລີ່ມ");
  assert.ok(archive.includes("${table.finishCol}"), "ຕ້ອງເກັບເວລາຈົບ");
  assert.ok(archive.includes("${table.workerCol}"), "ຕ້ອງເກັບວ່າໃຜເຮັດ");
  assert.match(qcFlow, /startCol: "time_repair"/);
  assert.match(qcFlow, /finishCol: "time_finish_repair"/);
});

test("ຄຳຕອບ QC ຜູກກັບຮອບ ⇒ ຮອບໃໝ່ບໍ່ຂຽນທັບຮອບເກົ່າ", () => {
  assert.match(qcFlow, /insert into ods_qc_result\(workflow, job_code, round, item_id/);
  assert.match(qcFlow, /on conflict \(workflow, job_code, round, item_id\)/);
  // ອ່ານຄືນກໍ່ຕ້ອງກອງຕາມຮອບ ບໍ່ດັ່ງນັ້ນຄຳຕອບເກົ່າຈະເດັ້ງມາເປັນຄ່າຕັ້ງຕົ້ນຂອງຮອບໃໝ່
  assert.match(qcFlow, /r\.round = \$4/);
  assert.match(src("qc.ts"), /r\.round = 1 \+ \(select count\(\*\) from ods_qc_round/);
});
