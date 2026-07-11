import { LinkPending } from "@/components/link-pending";
import type { ServicePrefill } from "@/components/service-form";
import { ServiceIntake } from "@/components/service-intake";
import { getErpBrands, getErpCategories, getErpTechnicians } from "@/lib/erp-master";
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
    getErpTechnicians(),
  ]);

  return (
    <div className="w-full space-y-4">
      <div>
        <Link href="/service" className="mb-2 inline-flex items-center gap-1.5 text-xs font-medium text-teal-600 hover:underline">
          <ArrowLeft className="size-3.5" />
          ກັບລາຍການຮັບສິນຄ້າເຂົ້າສ້ອມ
          <LinkPending className="size-3" />
        </Link>
        <h1 className="text-xl font-bold text-slate-700">ໃບຮັບເຄື່ອງເຂົ້າສ້ອມ</h1>
        <p className="mt-0.5 text-xs text-slate-500">ຮັບສິນຄ້າຂອງລູກຄ້າເຂົ້າສ້ອມ — ຍິງບາໂຄດ ຫຼື ປ້ອນຂໍ້ມູນເອງ</p>
      </div>

      <ServiceIntake types={types} brands={brands} techs={techs} prefill={prefill} />
    </div>
  );
}
