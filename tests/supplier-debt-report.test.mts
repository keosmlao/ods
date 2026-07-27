import assert from "node:assert/strict";
import test from "node:test";
import { formatSupplierDebtReport } from "../src/lib/supplier-debt-report.ts";

test("formats supplier debt totals and falls back to supplier code", () => {
  const text = formatSupplierDebtReport(
    "Supplier debt",
    {
      suppliers: 2,
      documents: 3,
      total: "1250000.50",
      overdue_documents: 2,
      overdue_total: "250000",
    },
    [
      { ap_code: "AP-01", ap_name: "Supplier A", total: "200000" },
      { ap_code: "AP-02", ap_name: "", total: "50000.25" },
    ],
  );

  assert.match(text, /1,250,000\.5 \(3 ໃບ · 2 supplier\)/);
  assert.match(text, /ເກີນກຳນົດ: 250,000 \(2 ໃບ\)/);
  assert.match(text, /1\. Supplier A: 200,000/);
  assert.match(text, /2\. AP-02: 50,000\.25/);
});

test("omits the top-supplier section when there is no overdue debt", () => {
  const text = formatSupplierDebtReport(
    "Supplier debt",
    {
      suppliers: 0,
      documents: 0,
      total: "0",
      overdue_documents: 0,
      overdue_total: "0",
    },
    [],
  );

  assert.doesNotMatch(text, /ສູງສຸດ/);
});
