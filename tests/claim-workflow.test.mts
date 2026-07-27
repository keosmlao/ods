import assert from "node:assert/strict";
import test from "node:test";
import { claimCanTransition, isClaimEditable, isClaimFulfillmentSource } from "../src/lib/claim-shared.ts";

test("claim status moves only one step forward", () => {
  assert.equal(claimCanTransition("A", "sent", "review"), true);
  assert.equal(claimCanTransition("A", "sent", "approved"), false);
  assert.equal(claimCanTransition("A", "review", "sent"), false);
  assert.equal(claimCanTransition("C", "notify", "paid"), false);
});

test("CLM-B resolution and CLM-A rejection use guarded paths", () => {
  assert.equal(claimCanTransition("B", "checking", "done"), false);
  assert.equal(claimCanTransition("A", "draft", "rejected"), false);
  assert.equal(claimCanTransition("A", "sent", "rejected"), true);
  assert.equal(claimCanTransition("A", "review", "rejected"), true);
});

test("CLM-B received→checking and CLM-C →paid are guarded (must go through saveCheck/setClaimPaid)", () => {
  // B ຕ້ອງຜ່ານ ຊ່າງ QC (saveCheck) ຈຶ່ງເຂົ້າ checking — advance ກົງບໍ່ໄດ້ (ກັນ job ຄ້າງ stage ລໍຕັດສິນ)
  assert.equal(claimCanTransition("B", "received", "checking"), false);
  // C paid ຕ້ອງຜ່ານ setClaimPaid (ຕ້ອງມີ pay_method) — advance ກົງບໍ່ໄດ້ (ກັນ paid ໂດຍ pay_method NULL)
  assert.equal(claimCanTransition("C", "notified", "paid"), false);
  assert.equal(claimCanTransition("C", "notify", "notified"), true);
});

test("only initial status is structurally editable", () => {
  assert.equal(isClaimEditable("A", "draft"), true);
  assert.equal(isClaimEditable("B", "received"), true);
  assert.equal(isClaimEditable("C", "notify"), true);
  assert.equal(isClaimEditable("A", "sent"), false);
});

test("customer replacement has exactly three supported fulfillment branches", () => {
  assert.equal(isClaimFulfillmentSource("stock"), true);
  assert.equal(isClaimFulfillmentSource("purchase"), true);
  assert.equal(isClaimFulfillmentSource("supplier"), true);
  assert.equal(isClaimFulfillmentSource("manual"), false);
  assert.equal(isClaimFulfillmentSource(undefined), false);
});
