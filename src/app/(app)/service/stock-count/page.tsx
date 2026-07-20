import { StockCountClient } from "@/components/stock-count/stock-count-client";
import { getSession } from "@/lib/auth";
import { APPROVER_SIDE, roleOf } from "@/lib/roles";
import { SETTING, settingEnabled } from "@/lib/settings";
import { inScopeRepairJobs } from "@/lib/stock-count";
import { ScanLine, TriangleAlert } from "lucide-react";
import { redirect } from "next/navigation";

/**
 * **ກວດນັບສະຕ໋ອກເຄື່ອງສ້ອມແປງ** — ສະແກນ barcode ຂອງເຄື່ອງທຸກອັນທີ່ຄວນຢູ່ໃນສູນ
 * (ຍັງບໍ່ສົ່ງຄືນ). ອັນທີ່ບໍ່ຖືກສະແກນ = ບໍ່ພົບຕົວ ⇒ ໝາຍ ‘ຕ້ອງກວດ’ ອັດຕະໂນມັດ.
 * ເຫັນສະເພາະ ຫົວໜ້າ/ຜູ້ອະນຸມັດ (APPROVER_SIDE) — server ກວດຊ້ຳ.
 */
export const dynamic = "force-dynamic";

export default async function StockCountPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!APPROVER_SIDE.includes(roleOf(session))) redirect("/forbidden");

  const [enabled, jobs] = await Promise.all([settingEnabled(SETTING.JOB_HOLD), inScopeRepairJobs()]);

  return (
    <div className="w-full space-y-4">
      <h1 className="flex items-center gap-2 text-lg font-bold text-slate-700">
        <ScanLine className="size-5 text-teal-600" />
        ກວດນັບສະຕ໋ອກເຄື່ອງສ້ອມແປງ
      </h1>

      {!enabled && (
        <p className="flex items-center gap-2 rounded-xl bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-800">
          <TriangleAlert className="size-4 shrink-0" />
          ຄວາມສາມາດ “ໝາຍວຽກມີບັນຫາ” ຖືກປິດຢູ່ — ນັບໄດ້ ແຕ່ຈະໝາຍ ‘ຕ້ອງກວດ’ ບໍ່ໄດ້ຈົນກວ່າຜູ້ຈັດການເປີດທີ່ ການຕັ້ງຄ່າລະບົບ.
        </p>
      )}

      <StockCountClient jobs={jobs} />
    </div>
  );
}
