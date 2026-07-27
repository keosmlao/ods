export type DebtSummary = {
  suppliers: number;
  documents: number;
  total: string;
  overdue_documents: number;
  overdue_total: string;
};

export type SupplierDebt = {
  ap_code: string;
  ap_name: string;
  total: string;
};

const money = (value: string) =>
  Number(value).toLocaleString("en-US", { maximumFractionDigits: 2 });

export function formatSupplierDebtReport(
  head: string,
  summary: DebtSummary,
  suppliers: SupplierDebt[],
): string {
  const top = suppliers.map(
    (row, index) => `${index + 1}. ${row.ap_name || row.ap_code}: ${money(row.total)}`,
  );

  return [
    head,
    `• ຄ້າງຊຳລະທັງໝົດ: ${money(summary.total)} (${summary.documents} ໃບ · ${summary.suppliers} supplier)`,
    `• ເກີນກຳນົດ: ${money(summary.overdue_total)} (${summary.overdue_documents} ໃບ)`,
    ...(top.length ? ["• 5 supplier ເກີນກຳນົດສູງສຸດ:", ...top] : []),
  ].join("\n");
}
