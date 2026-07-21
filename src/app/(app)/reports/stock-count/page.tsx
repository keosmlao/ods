import { StockCountReportView } from "@/components/stock-count/stock-count-report-view";
import { getSession } from "@/lib/auth";
import { STOCK_COUNT_SIDE, roleOf } from "@/lib/roles";
import { redirect } from "next/navigation";

/**
 * **ລາຍງານຜົນການກວດນັບສະຕັອກ** — ນັບພົບ / ນັບບໍ່ພົບ(ຫາຍ) / ຍັງບໍ່ນັບ (default = ຍັງບໍ່ນັບ).
 * ເນື້ອຫາຢູ່ StockCountReportView (ໃຊ້ຮ່ວມກັບເມນູ "ເຄື່ອງນັບບໍ່ພົບ").
 */
export const dynamic = "force-dynamic";

export default async function StockCountReportPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!STOCK_COUNT_SIDE.includes(roleOf(session))) redirect("/forbidden");
  return <StockCountReportView defaultTab="uncounted" />;
}
