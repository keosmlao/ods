import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const stageSource = readFileSync(new URL("../src/lib/stage.ts", import.meta.url), "utf8");
const syncSource = readFileSync(new URL("../src/lib/erp-purchase.ts", import.meta.url), "utf8");

test("purchase lines hold the job in purchasing only until ERP confirms arrival", () => {
  /**
   * ສັນຍາເກົ່າ (28-07-2026): ແຖວ status=5 ຢ່າງວຽກໄວ້ຂັ້ນ 7 ບໍ່ວ່າທຸງຈະເປັນຫຍັງ — ຍ້ອນ
   * spare_arrive ຕອນນັ້ນມາຈາກປຸ່ມກົດມື ເຊື່ອບໍ່ໄດ້. ດຽວນີ້ spare_arrive ມາຈາກ
   * syncErpPurchase ຢ່າງດຽວ (ກວດໃບຮັບ ERP ທຽບ item_code ຄົບ) ຈຶ່ງເຊື່ອໄດ້:
   * ຂອງເຂົ້າສາງແລ້ວ ວຽກຕ້ອງອອກຈາກ "ກຳລັງສັ່ງຊື້" — ບໍ່ດັ່ງນັ້ນຄ້າງຕະຫຼອດໄປ
   * ທັງທີ່ມີໃບຂໍເບີກພ້ອມ (ຂໍ້ມູນຈິງ 15 ໃບ, ຄ້າງດົນສຸດ 343 ມື້).
   */
  assert.match(
    stageSource,
    /when coalesce\(a\.used_spare,0\) = 1\s+and a\.spare_arrive is null\s+and exists/,
    "pending purchase lines must hold the job at stage 7 while arrival is unconfirmed",
  );
  assert.match(
    stageSource,
    /a\.spare_reg is null\s+and not exists/,
    "a job with an existing request doc must skip stage 5 and go to withdrawing",
  );
});

test("purchase sync cannot update or notify the same arrival twice", () => {
  assert.match(
    syncSource,
    /select a\.code from tb_product a where a\.spare_arrive is null and \$\{STAGE_7\}/,
    "sync candidate query must exclude jobs already stamped from ERP",
  );
  assert.match(
    syncSource,
    /where a\.code = \$1 and a\.spare_arrive is null and \$\{STAGE_7\}/,
    "sync update must atomically guard against duplicate logs and notifications",
  );
});
