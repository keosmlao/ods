import { StockCountClient } from "@/components/stock-count/stock-count-client";
import { getSession } from "@/lib/auth";
import { STOCK_COUNT_SIDE, roleOf } from "@/lib/roles";
import { countedItems } from "@/lib/stock-count";
import { FileBarChart, ScanLine } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

/**
 * **ກວດນັບສະຕ໋ອກເຄື່ອງສ້ອມແປງ** — scan-driven: ຍິງ/ພິມ code ຫຼື SN (job ໃດກໍ່ໄດ້) →
 * ໝາຍ "ນັບແລ້ວ" ບັນທຶກລົງ DB (ods_stock_count) → ຂຶ້ນລາຍການພົບ + ເອົາໄປເຮັດລາຍງານ.
 * ເຫັນສະເພາະ ຫົວໜ້າ/ຜູ້ຈັດການ + ສາງ (STOCK_COUNT_SIDE).
 */
export const dynamic = "force-dynamic";

export default async function StockCountPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!STOCK_COUNT_SIDE.includes(roleOf(session))) redirect("/forbidden");

  const items = await countedItems();

  return (
    <div className="w-full space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="flex items-center gap-2 text-lg font-bold text-slate-700">
          <ScanLine className="size-5 text-teal-600" />
          ກວດນັບສະຕ໋ອກເຄື່ອງສ້ອມແປງ
        </h1>
        <Link
          href="/reports/stock-count"
          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 hover:bg-slate-50"
        >
          <FileBarChart className="size-4 text-teal-600" />
          ລາຍງານຜົນກວດນັບ
        </Link>
      </div>

      <StockCountClient initialItems={items} />
    </div>
  );
}
