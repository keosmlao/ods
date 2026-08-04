import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { nextActor, summarizeSpareLines } from "../src/lib/repair-next-action.ts";

/**
 * ສູນວຽກງານສ້ອມ ຈັດກຸ່ມວຽກຕາມ "ຜູ້ເຮັດຕໍ່" — nextActor() ແມ່ນນິຍາມບ່ອນດຽວ
 * ທີ່ທັງໜ້າເວັບ ແລະ ແອັບມືຖືໃຊ້ຮ່ວມກັນ ⇒ ຜົນຂອງມັນຕ້ອງຖືກລັອກໄວ້ດ້ວຍ test.
 */

test("every open repair stage maps to exactly one actor", () => {
  const expected: [number, string][] = [
    [0, "cs"],
    [1, "cs"],
    [2, "tech"],
    [3, "tech"],
    [4, "tech"],
    [5, "tech"],
    [6, "stock"],
    [7, "purchase"],
    [8, "tech"],
    [9, "tech"],
    [10, "qc"],
    [11, "cs"],
  ];
  for (const [stage, actor] of expected) {
    assert.equal(nextActor(stage)?.actor, actor, `stage ${stage} must belong to ${actor}`);
  }
});

test("stages outside the open repair pipeline have no next actor", () => {
  for (const stage of [-1, 12, 13, 14, 15, 16]) {
    assert.equal(nextActor(stage), null, `stage ${stage} must return null`);
  }
});

test("stage 0 and 11 respect PS vs IH service type", () => {
  assert.equal(nextActor(0, null, "PS")?.label, "ລໍໄປຮັບເຄື່ອງ");
  assert.equal(nextActor(0, null, "IH")?.label, "ລໍນັດໝາຍ/ຈັດຊ່າງໄປສ້ອມ");
  assert.equal(nextActor(11, null, "PS")?.label, "ລໍຖ້າສົ່ງຄືນ");
  assert.equal(nextActor(11, null, "IH")?.label, "ລໍປິດງານ");
});

test("purchase-pending lines win over stage in the spare zone (5-9)", () => {
  // ຮອບ 2 ກຳລັງສັ່ງຊື້ ທັງທີ່ວຽກຢູ່ຂັ້ນລໍສ້ອມແລ້ວ — ເອກະສານເປັນຄວາມຈິງ
  const onOrder = { pending: 0, onOrder: 2, arrived: 0 };
  for (const stage of [5, 6, 7, 8, 9]) {
    assert.equal(nextActor(stage, onOrder)?.actor, "purchase", `stage ${stage} with on-order lines`);
  }
});

test("ready-to-withdraw lines route the job to the warehouse", () => {
  // ຂອງມາຮອດສາງແລ້ວ (arrive_at ບໍ່ຫວ່າງ) ແມ່ນວຽກສາງ ບໍ່ແມ່ນ "ກຳລັງສັ່ງຊື້" ອີກ
  const arrived = { pending: 0, onOrder: 0, arrived: 3 };
  const pending = { pending: 2, onOrder: 0, arrived: 0 };
  for (const stage of [6, 7, 8, 9]) {
    assert.equal(nextActor(stage, arrived)?.actor, "stock");
    assert.equal(nextActor(stage, pending)?.actor, "stock");
  }
});

test("line overrides stop outside the spare zone — QC and return keep their actor", () => {
  const onOrder = { pending: 0, onOrder: 1, arrived: 0 };
  assert.equal(nextActor(10, onOrder)?.actor, "qc");
  assert.equal(nextActor(11, onOrder)?.actor, "cs");
  assert.equal(nextActor(2, onOrder)?.actor, "tech");
});

test("summarizeSpareLines buckets lines by status + arrival", () => {
  const summary = summarizeSpareLines([
    { status: 0, arrived: false },
    { status: null, arrived: false }, // null = PENDING (ຄືກັບ coalesce(status,0))
    { status: 1, arrived: false }, // ເບີກແລ້ວ — ບໍ່ນັບເຂົ້າກຸ່ມໃດ
    { status: 5, arrived: false },
    { status: 5, arrived: true },
  ]);
  assert.deepEqual(summary, { pending: 2, onOrder: 1, arrived: 1 });
});

test("line status values stay in sync with lib/stock-constants", () => {
  // repair-next-action.ts ບໍ່ມີ import (node:test ເອີ້ນໂດຍກົງ) ຈຶ່ງຝັງຄ່າ 0/5 ເອງ —
  // ຖ້າ stock-constants ປ່ຽນ ຕ້ອງມາແກ້ນຳ ບໍ່ດັ່ງນັ້ນສອງບ່ອນຈະຄິດບໍ່ຕົງກັນ.
  const constants = readFileSync(new URL("../src/lib/stock-constants.ts", import.meta.url), "utf8");
  assert.match(constants, /PENDING: 0/, "LINE_STATUS.PENDING must stay 0");
  assert.match(constants, /ON_PURCHASE_ORDER: 5/, "LINE_STATUS.ON_PURCHASE_ORDER must stay 5");
});
