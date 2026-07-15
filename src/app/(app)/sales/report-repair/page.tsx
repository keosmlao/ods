import { NoticeForm } from "@/components/notice-form";
import { PageTitle } from "@/components/ui";
import { query } from "@/lib/db";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

/**
 * ຝັ່ງພະນັກງານຂາຍ — ແຈ້ງສ້ອມແທນລູກຄ້າ (creator ຕິດຊື່ພະນັກງານ ໃນ log).
 * ໃຊ້ NoticeForm ອັນດຽວກັບຝັ່ງລູກຄ້າ ແຕ່ mode="sales".
 */
export const dynamic = "force-dynamic";

export default async function SalesReportRepairPage() {
  const [provinces, cities] = await Promise.all([
    query<{ code: string; name_1: string }>("select code, name_1 from province order by roworder asc"),
    query<{ code: string; name_1: string; province: string }>(
      "select code, name_1, province from city order by roworder asc",
    ),
  ]);

  return (
    <div className="mx-auto w-full max-w-2xl space-y-4">
      <Link href="/sales" className="inline-flex items-center gap-1.5 text-xs font-medium text-teal-600 hover:underline">
        <ArrowLeft className="size-3.5" />
        ກັບໜ້າພະນັກງານຂາຍ
      </Link>
      <PageTitle sub="ຕື່ມຂໍ້ມູນລູກຄ້າ ແລ້ວທີມບໍລິການຈະຮັບເຄື່ອງເຂົ້າສ້ອມ">ແຈ້ງສ້ອມແທນລູກຄ້າ</PageTitle>
      <NoticeForm mode="sales" provinces={provinces.rows} cities={cities.rows} />
    </div>
  );
}
