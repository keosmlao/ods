import { StockCountClient } from "@/components/stock-count/stock-count-client";
import { getSession } from "@/lib/auth";
import { APPROVER_SIDE, roleOf } from "@/lib/roles";
import { countedCodes, inScopeRepairJobs } from "@/lib/stock-count";
import { FileBarChart, ScanLine } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

/**
 * **ກວດນັບສະຕ໋ອກເຄື່ອງສ້ອມແປງ** — ສະແກນ/ກົດ ໝາຍ "ນັບແລ້ວ" ຂອງເຄື່ອງ pending ທຸກອັນ.
 * ບັນທຶກລົງ DB (ods_stock_count) ⇒ ແບ່ງກັນຫຼາຍຄົນ + ເອົາໄປເຮັດລາຍງານໄດ້.
 * ເຫັນສະເພາະ ຫົວໜ້າ/ຜູ້ອະນຸມັດ (APPROVER_SIDE).
 */
export const dynamic = "force-dynamic";

export default async function StockCountPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!APPROVER_SIDE.includes(roleOf(session))) redirect("/forbidden");

  const [jobs, counted] = await Promise.all([inScopeRepairJobs(), countedCodes()]);

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

      <StockCountClient jobs={jobs} initialCounted={counted} />
    </div>
  );
}
