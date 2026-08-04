import { LinkPending } from "@/components/link-pending";
import { BackLink } from "@/components/back-link";
import type { ServicePrefill } from "@/components/service-form";
import { ServiceIntake } from "@/components/service-intake";
import { getErpBrands, getErpCategories } from "@/lib/erp-master";
import { technicianOptions } from "@/lib/technicians";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

/**
 * **ຮັບເຄື່ອງເຂົ້າງານເຄມ** — route ຂອງເຄມເອງ (ບໍ່ຜູກກັບ /service/new ອີກ 31-07-2026).
 *
 * ຟອມຮັບເຄື່ອງ (ServiceIntake) ໃຊ້ຮ່ວມກັນ **ໂດຍເຈດຕະນາ**: ຂໍ້ມູນທີ່ຮັບຄືກັນທຸກຊ່ອງ
 * (ລູກຄ້າ · ສິນຄ້າ · S/N · ຮູບ · ອາການ) ⇒ ຄັດລອກອີກສະບັບ = ຕ້ອງແກ້ສອງບ່ອນຕະຫຼອດໄປ.
 * ສິ່ງທີ່ **ແຍກ** ຄື route · ເມນູ · ຫົວຂໍ້ · ຄິວ · ລາຍງານ (ເບິ່ງ lib/dashboard-status).
 */
export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<ServicePrefill> };

export default async function NewClaimJob({ searchParams }: Props) {
  const prefill = await searchParams;
  const [types, brands, techs] = await Promise.all([
    getErpCategories(),
    getErpBrands(),
    technicianOptions(),
  ]);

  return (
    <div className="w-full space-y-4">
      <div>
        <BackLink fallback="/claims/jobs" label="ກັບຄິວງານເຄມ" />
        <h1 className="text-xl font-bold text-slate-700">🛡️ ຮັບເຄື່ອງເຂົ້າງານເຄມ</h1>
        <p className="mt-0.5 text-xs text-slate-500">
          ຮ້ານຄ້າ/ລູກຄ້າສົ່ງມາເຄມ → ອອກເລກງານໃຫ້ຮ້ານ → ສ້າງໃບເຄມ CLM-B ອັດຕະໂນມັດ
        </p>
      </div>

      {/* kind=claim ບັງຄັບຈາກ route ນີ້ — ຟອມບໍ່ມີປຸ່ມສະຫຼັບໄປງານສ້ອມແລ້ວ */}
      <ServiceIntake types={types} brands={brands} techs={techs} prefill={{ ...prefill, kind: "claim" }} />
    </div>
  );
}
