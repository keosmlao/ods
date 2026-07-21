import { StockCountReportView } from "@/components/stock-count/stock-count-report-view";
import { getSession } from "@/lib/auth";
import { STOCK_COUNT_SIDE, roleOf } from "@/lib/roles";
import { redirect } from "next/navigation";

/**
 * **ເຄື່ອງນັບບໍ່ພົບ (ຫາຍ)** — ເມນູແຍກ: ດຶງລາຍການທີ່ປິດ "ນັບບໍ່ພົບ" ມາຈັດການ (ນຳກັບຄືນ).
 * ໃຊ້ StockCountReportView ຮ່ວມກັບໜ້າຜົນກວດນັບ ພຽງແຕ່ເປີດ tab "ນັບບໍ່ພົບ" ກ່ອນ.
 */
export const dynamic = "force-dynamic";

export default async function StockCountMissingPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!STOCK_COUNT_SIDE.includes(roleOf(session))) redirect("/forbidden");
  return <StockCountReportView defaultTab="missing" />;
}
