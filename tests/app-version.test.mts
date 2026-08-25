import assert from "node:assert/strict";
import test from "node:test";
import { compareVersions, parseVersion } from "../src/lib/app-version.ts";

test("ອ່ານເວີຊັນຮູບແບບ pubspec (x.y.z+build)", () => {
  assert.deepEqual(parseVersion("1.11.0+33"), [1, 11, 0, 33]);
  assert.deepEqual(parseVersion(" 1.11.0 "), [1, 11, 0]);
  assert.deepEqual(parseVersion(""), []);
});

test("ເກົ່າກວ່າ = ຕ້ອງອັບເດດ", () => {
  assert.equal(compareVersions("1.10.9", "1.11.0") < 0, true);
  assert.equal(compareVersions("1.11.0", "1.11.0"), 0);
  assert.equal(compareVersions("1.11.1", "1.11.0") > 0, true);
});

test("ຊ່ອງທີ່ຂາດ = 0 (1.11 ເທົ່າກັບ 1.11.0)", () => {
  assert.equal(compareVersions("1.11", "1.11.0"), 0);
  assert.equal(compareVersions("2", "1.99.99") > 0, true);
});

test("ເລກ build ນັບນຳ — APK ໃໝ່ທີ່ບໍ່ຂຶ້ນເລກເວີຊັນ ຍັງຖືວ່າໃໝ່ກວ່າ", () => {
  // ຊ່າງອັບເດດແອັບແຕ່ຄົນ build ລືມຂຶ້ນ x.y.z ⇒ ຢ່າໃຫ້ຄົນທີ່ໂຫຼດແລ້ວຖືກບັງຄັບຊ້ຳ
  assert.equal(compareVersions("1.11.0+32", "1.11.0+33") < 0, true);
  assert.equal(compareVersions("1.11.0+33", "1.11.0+33"), 0);
  // ບອກແຕ່ເລກເວີຊັນ (ບໍ່ມີ build) ⇒ ຖືວ່າ build 0 = ເກົ່າກວ່າ APK ທີ່ມີ build
  assert.equal(compareVersions("1.11.0", "1.11.0+33") < 0, true);
});
