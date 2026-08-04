import { LinkPending } from "@/components/link-pending";
import { BackLink } from "@/components/back-link";
import type { ServicePrefill } from "@/components/service-form";
import { ServiceIntake } from "@/components/service-intake";
import { getErpBrands, getErpCategories } from "@/lib/erp-master";
import { technicianOptions } from "@/lib/technicians";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

type Props = { searchParams: Promise<ServicePrefill> };

export default async function NewService({ searchParams }: Props) {
  // ຄ່າຕື່ມມາຈາກ /service/checksn (ຄື /addrcpro ຂອງ ods)
  const prefill = await searchParams;
  // ປະເພດສິນຄ້າ / ຫຍີ່ຫໍ້ / ຊ່າງ ດຶງຈາກ ERP ໝົດ
  // (tb_type, tb_brand, ແລະ users roles='technical' ຂອງ ODS ບໍ່ໄດ້ໃຊ້ແລ້ວ)
  const [types, brands, techs] = await Promise.all([
    getErpCategories(),
    getErpBrands(),
    technicianOptions(),
  ]);

  return (
    <div className="w-full space-y-4">
      <div>
        <BackLink fallback="/service" label="ກັບລາຍການຮັບສິນຄ້າເຂົ້າສ້ອມ" />
        <h1 className="text-xl font-bold text-slate-700">{prefill.kind === "claim" ? "ຮັບເຄື່ອງເຂົ້າງານເຄມ" : "ໃບຮັບເຄື່ອງເຂົ້າສ້ອມ"}</h1>
        <p className="mt-0.5 text-xs text-slate-500">{prefill.kind === "claim" ? "ຮັບເຄື່ອງ → ອອກເລກງານກວດເຊັກ → ສ້າງ CLM-B ອັດຕະໂນມັດ" : "ຮັບສິນຄ້າຂອງລູກຄ້າເຂົ້າສ້ອມ — ຍິງບາໂຄດ ຫຼື ປ້ອນຂໍ້ມູນເອງ"}</p>
      </div>

      <ServiceIntake types={types} brands={brands} techs={techs} prefill={prefill} />
    </div>
  );
}
