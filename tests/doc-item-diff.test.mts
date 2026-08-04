import assert from "node:assert/strict";
import test from "node:test";
import { compareItems } from "../src/lib/doc-item-diff.ts";

const item = (code: string, qty: number) => ({ item_code: code, item_name: code, qty });

test("ຄືກັນທຸກລາຍການ ⇒ ບໍ່ແດງ (ເຖິງລຳດັບແຖວຈະຂ້າມກັນ)", () => {
  // ໃບ SWC ຈິງຮຽງກັບຂ້າມກັບ SIO ⇒ ຕ້ອງທຽບດ້ວຍລະຫັດ ບໍ່ແມ່ນລຳດັບ
  const { mismatch } = compareItems(
    [item("140507-0202", 1), item("130201-0206", 2)],
    [item("130201-0206", 2), item("140507-0202", 1)],
  );
  assert.equal(mismatch, false);
});

test("ເບີກເກີນທີ່ຂໍ ⇒ ແດງ ພ້ອມບອກຈຳນວນທີ່ຄວນເປັນ", () => {
  // ຂໍ້ມູນຈິງ INST-7170: ນ໋ອດລະເບີດ ຂໍ 1 ແຕ່ສາງເບີກ 4
  const { rows, mismatch } = compareItems([item("140507-0234", 4)], [item("140507-0234", 1)]);
  assert.equal(mismatch, true);
  assert.deepEqual(rows[0], { item_code: "140507-0234", item_name: "140507-0234", qty: 4, expected: 1 });
});

test("ຂໍແລ້ວບໍ່ໄດ້ເບີກ ⇒ ຍັງຕ້ອງມີແຖວ ບອກວ່າຂາດ", () => {
  const { rows, mismatch } = compareItems([item("A", 1)], [item("A", 1), item("B", 3)]);
  assert.equal(mismatch, true);
  const missing = rows.find((row) => row.item_code === "B");
  assert.deepEqual(missing, { item_code: "B", item_name: "B", qty: 0, expected: 3 });
});

test("ເບີກຂອງທີ່ບໍ່ໄດ້ຂໍ ⇒ ແດງ (expected 0)", () => {
  const { rows, mismatch } = compareItems([item("X", 2)], []);
  assert.equal(mismatch, true);
  assert.equal(rows[0].expected, 0);
});
