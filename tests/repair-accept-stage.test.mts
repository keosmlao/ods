import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

/**
 * ── ປຸ່ມ "ຮັບງານ" ທີ່ໂຊ້ວ ຕ້ອງກົດໄດ້ແທ້ ──
 * ແອັບເອົາ `action` ຈາກ REPAIR_ACTION (lib/mobile-jobs) ແຕ່ຄົນຂຽນຈິງແມ່ນ acceptRepair
 * (lib/job-flow). ສອງບ່ອນນີ້ **ຂອບເຂດຂັ້ນຕ້ອງຕົງກັນ** — ບໍ່ດັ່ງນັ້ນຊ່າງເຫັນປຸ່ມ ກົດແລ້ວເດັ້ງ error.
 *
 * ເຄີຍພັງມາແລ້ວ (26-08-2026): ການປ່ຽນຊ່າງລ້າງ repair_confirm ທຸກຂັ້ນ ⇒ ວຽກຢູ່ຂັ້ນອາໄຫຼ່
 * ໂຊ້ວ "ຮັບງານ" (REPAIR_ACTION ຍອມຂັ້ນ < 9) ແຕ່ acceptRepair ບັງຄັບຂັ້ນ 1 ⇒ 7 ໃບຄ້າງ.
 */
const range = "between 1 and 8";

test("acceptRepair ຮັບຂັ້ນ 1–8", () => {
  const src = readFileSync(new URL("../src/lib/job-flow.ts", import.meta.url), "utf8");
  const body = src.split("export async function acceptRepair(")[1].split("\nexport ")[0];
  assert.match(
    body,
    new RegExp(`repair_confirm is null and \\(\\$\\{STAGE_SQL\\}\\) ${range}`),
    "acceptRepair ຕ້ອງອະນຸຍາດຂັ້ນ 1–8 (ຂັ້ນ 0 ລໍໄປຮັບເຄື່ອງ ແລະ ≥ 9 ລົງມືສ້ອມແລ້ວ ບໍ່ຮັບ)",
  );
});

test("REPAIR_ACTION ໂຊ້ວ 'accept' ໃນຂອບເຂດດຽວກັນ", () => {
  const src = readFileSync(new URL("../src/lib/mobile-jobs.ts", import.meta.url), "utf8");
  const body = src.split("const REPAIR_ACTION = `")[1].split("`;")[0];
  const accept = body.split("\n").find((line) => line.includes("then 'accept'"));
  assert.ok(accept, "REPAIR_ACTION ຕ້ອງມີສາຂາ 'accept'");
  assert.match(
    accept,
    new RegExp(`repair_confirm is null and \\(\\$\\{STAGE_SQL\\}\\) ${range}`),
    "ຂອບເຂດຂັ້ນຂອງ 'accept' ຕ້ອງຕົງກັບ acceptRepair",
  );
});

test("ຄິວ 'ລໍຖ້າຊ່າງຮັບ' ໃຊ້ຂອບເຂດຂັ້ນດຽວກັນ", () => {
  // ຄິວທີ່ໂຊ້ວໃບທີ່ຮັບບໍ່ໄດ້ = ຄິວທີ່ຈັດການບໍ່ໄດ້ ⇒ ຕ້ອງຕົງກັບ acceptRepair
  const src = readFileSync(new URL("../src/lib/dashboard-status.ts", import.meta.url), "utf8");
  const cond = src.split('"wait-accept": {')[1].split("},")[0];
  assert.match(cond, new RegExp(`\\(\\$\\{STAGE_SQL\\}\\) ${range}`));
  assert.match(cond, /repair_confirm is null/);
  assert.match(cond, /NOT_CLAIM/, "ງານເຄມມີຄິວຂອງມັນເອງ ຢ່າປົນ");
});
