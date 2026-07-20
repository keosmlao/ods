import { ClaimBrandManager } from "@/components/manage/claim-brand-manager";
import { getSession } from "@/lib/auth";
import { listBrandClaims } from "@/lib/claim-brand";
import { getErpBrands } from "@/lib/erp-master";
import { searchSuppliers } from "@/lib/erp-supplier";
import { APPROVER_SIDE, roleOf } from "@/lib/roles";
import { BadgeDollarSign } from "lucide-react";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function ClaimBrandsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!APPROVER_SIDE.includes(roleOf(session))) redirect("/forbidden");

  const [brands, suppliers, config] = await Promise.all([
    getErpBrands().catch(() => []),
    searchSuppliers("", 1000).catch(() => []),
    listBrandClaims(),
  ]);

  return (
    <div className="w-full space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-lg font-bold text-slate-700">
          <BadgeDollarSign className="size-5 text-teal-600" /> ຕັ້ງຄ່າ ຫຍີ່ຫໍ້ ເກັບເງินกับ supplier
        </h1>
        <p className="mt-1 text-sm text-slate-500">ຫຍີ່ຫໍ້ໃด ສອมในประกัน → ເກັບຄ່າສ້ອມກັບ supplier (ບໍ່ເກັບลูกค้า). ງານยี่ห้อนี้ ส่งคืนแล้ว → ขึ้น candidate CLM-C อัตโนมัติ.</p>
      </div>
      <ClaimBrandManager brands={brands} suppliers={suppliers.map((s) => ({ code: s.code, name: s.name }))} initial={config} />
    </div>
  );
}
