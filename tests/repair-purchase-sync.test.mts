import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const stageSource = readFileSync(new URL("../src/lib/stage.ts", import.meta.url), "utf8");
const syncSource = readFileSync(new URL("../src/lib/erp-purchase.ts", import.meta.url), "utf8");

test("pending purchase lines remain visible in purchasing stage after ERP sync", () => {
  assert.match(
    stageSource,
    /when coalesce\(a\.used_spare,0\) = 1\s+and exists/,
    "an ERP arrival stamp must not hide a job while its purchase line is still pending",
  );
  assert.doesNotMatch(
    stageSource,
    /when coalesce\(a\.used_spare,0\) = 1\s+and a\.spare_arrive is null\s+and exists/,
    "spare_arrive is a sync marker, not permission to remove the job from purchasing",
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
