import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const stageSource = readFileSync(new URL("../src/lib/stage.ts", import.meta.url), "utf8");
const syncSource = readFileSync(new URL("../src/lib/erp-purchase.ts", import.meta.url), "utf8");

test("purchase lines hold the job in purchasing only until ERP confirms arrival", () => {
  /**
   * ສັນຍາ (03-08-2026): ຄວາມຈິງຢູ່**ແຖວເອກະສານ** ບໍ່ແມ່ນທຸງວຽກ — ວຽກສັ່ງຊື້/ເບີກ
   * ຫຼາຍຮອບມີທຸງ spare_arrive ຄືນດຽວບໍ່ພໍ (ຮອບໃໝ່ຖືກຮອບເກົ່າບັງ). ດ່ານຂັ້ນ 7 ຈຶ່ງ
   * ກວດແຖວ SIO status=5 ທີ່ **arrive_at ຫວ່າງ** — syncErpPurchase ສະແຕມໃຫ້ຈາກ
   * ໃບຮັບເຂົ້າ ERP (ທຽບ item_code ຄົບ): ລາຍການໃດມາຮອດ ແຖວນັ້ນຕ້ອງບໍ່ຢ່າງວຽກໄວ້.
   */
  assert.match(
    stageSource,
    /when coalesce\(a\.used_spare,0\) = 1\s+and exists[\s\S]*?d\.arrive_at is null\)\s+then 7/,
    "pending purchase lines without arrive_at must hold the job at stage 7",
  );
  assert.match(
    stageSource,
    /a\.spare_reg is null\s+and not exists/,
    "a job with an existing request doc must skip stage 5 and go to withdrawing",
  );
});

test("purchase sync cannot update or notify the same arrival twice", () => {
  // ຫຼັງສະແຕມແຖວແລ້ວ STAGE_7 ບໍ່ເປັນຈິງອີກ (ແຖວມີ arrive_at) ⇒ ວຽກບໍ່ເຂົ້າ
  // open query ຊ້ຳ — ທຸງ idempotent ຍ້າຍຈາກ spare_arrive is null ມາຢູ່ແຖວ.
  assert.match(
    syncSource,
    /select a\.code from tb_product a where \$\{STAGE_7\}/,
    "sync candidate query must select only jobs still at stage 7",
  );
  assert.match(
    syncSource,
    /update ic_trans_detail set arrive_at = \$2::timestamp[\s\S]*?and arrive_at is null/,
    "row stamp must skip lines already stamped (idempotent per line)",
  );
  assert.match(
    syncSource,
    /spare_arrive = coalesce\(a\.spare_arrive, \$2::timestamp\)/,
    "job flag must keep the first-round arrival (row stamp carries later rounds)",
  );
});
