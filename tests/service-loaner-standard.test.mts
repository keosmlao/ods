import assert from "node:assert/strict";
import test from "node:test";
import { claimMarkChange } from "../src/lib/claim-shared.ts";
import { loanerHoldMessage, outsideStandardCodes } from "../src/lib/loaner-shared.ts";

/* ── ເຄື່ອງສຳຮອງ (loaner) ─────────────────────────────────────── */

test("ບໍ່ມີເຄື່ອງສຳຮອງຄ້າງ = ສົ່ງເຄື່ອງຄືນລູກຄ້າໄດ້", () => {
  assert.equal(loanerHoldMessage([]), null);
});

test("ຍັງບໍ່ຮັບຄືນ = ຫ້າມ ແລະ ບອກທຸກໜ່ວຍພ້ອມ ISN", () => {
  const message = loanerHoldMessage([
    { item_name: "ຈໍ LED 32", isn: "011B0005839" },
    { item_name: "ຈັກຊັກ 8KG", isn: "008A0000707" },
  ]);
  assert.ok(message);
  // ຕ້ອງບອກ **ທຸກ** ໜ່ວຍ ບໍ່ແມ່ນແຕ່ໜ່ວຍທຳອິດ — ຄົນໜ້າເຄົາເຕີຕ້ອງຮູ້ວ່າຈະທວງຫຍັງແດ່
  assert.ok(message.includes("ຈໍ LED 32"));
  assert.ok(message.includes("011B0005839"));
  assert.ok(message.includes("ຈັກຊັກ 8KG"));
  assert.ok(message.includes("008A0000707"));
});

/* ── ດ່ານ "ເບີກອາໄຫຼ່ນອກມາດຕະຖານ" ─────────────────────────────── */

test("ລາຍການທີ່ຢູ່ໃນມາດຕະຖານ ຫຼື ຢູ່ໃນກະຕ່າແລ້ວ = ຜ່ານ", () => {
  const known = ["140507-0200", "140401-0200"];
  assert.deepEqual(outsideStandardCodes(known, ["140507-0200"]), []);
  assert.deepEqual(outsideStandardCodes(known, ["140507-0200", "140401-0200"]), []);
});

test("ລາຍການນອກມາດຕະຖານຖືກຄືນທັງໝົດ (ບໍ່ແມ່ນແຕ່ອັນທຳອິດ)", () => {
  const outside = outsideStandardCodes(["140507-0200"], ["140507-0200", "999999-0001", "999999-0002"]);
  assert.deepEqual(outside, ["999999-0001", "999999-0002"]);
});

test("ຍັງບໍ່ໄດ້ນິຍາມມາດຕະຖານ (ຫວ່າງ) = ທຸກລາຍການເປັນນອກມາດຕະຖານ", () => {
  // ນີ້ຄືເຫດຜົນທີ່ສະວິດຕ້ອງເປີດເປັນຄ່າຕັ້ງຕົ້ນ ຈົນກວ່າຈະນິຍາມຢູ່ /manage/install-standard
  assert.deepEqual(outsideStandardCodes([], ["140507-0200"]), ["140507-0200"]);
});

/* ── ໝາຍ "ຂໍເຄມ" ໃສ່ໃບງານສ້ອມ ─────────────────────────────────── */

test("ສ້ອມ → ເຄມ (ຍັງບໍ່ມີໃບເຄມ) = ສ້າງ CLM-B ໃຫ້", () => {
  assert.equal(claimMarkChange({ kind: "repair", claimNo: null }, "claim"), "create-claim");
});

test("ເປັນເຄມຢູ່ແລ້ວ ແລະ ມີໃບເຄມ = ອັບເດດໃບເກົ່າ ບໍ່ສ້າງໃບຊ້ຳ", () => {
  assert.equal(claimMarkChange({ kind: "claim", claimNo: "CLM00007" }, "claim"), "sync-claim");
});

test("ເຄມ → ສ້ອມ ທັງທີ່ມີໃບເຄມແລ້ວ = ຫ້າມ", () => {
  assert.equal(claimMarkChange({ kind: "claim", claimNo: "CLM00007" }, "repair"), "blocked");
});

test("ເຄມ → ສ້ອມ ແຕ່ຍັງບໍ່ມີໃບເຄມ = ປ່ຽນໄດ້", () => {
  assert.equal(claimMarkChange({ kind: "claim", claimNo: null }, "repair"), "none");
});

test("ງານສ້ອມທຳມະດາ = ບໍ່ແຕະໃບເຄມ", () => {
  assert.equal(claimMarkChange({ kind: "repair", claimNo: null }, "repair"), "none");
});
