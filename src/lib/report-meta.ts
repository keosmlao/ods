/** ລາຍງານອັດຕະໂນມັດ — key + ป้าย (pure, client import ໄດ້). builder ຢູ່ report-build.ts (server). */
export const REPORT_META: { key: string; label: string }[] = [
  { key: "daily-receipts", label: "ຮັບສິນຄ້າສ້ອມ ປະຈຳວັນ" },
  { key: "daily-installs", label: "ການຕິດຕັ້ງ ປະຈຳວັນ" },
  { key: "pending-status", label: "ສິນຄ້າ pending ຕາມສະຖານະ" },
  { key: "purchase-3d", label: "ສັ່ງຊື້ອາໄຫຼ່ ເກີນ 3 ວັນ" },
  { key: "supplier-debt", label: "supplier ຄ້າງຊຳລະ" },
  { key: "claim-money", label: "ເງິນເຄມ ຈາກ supplier" },
];

export const reportLabel = (key: string) => REPORT_META.find((r) => r.key === key)?.label ?? key;
