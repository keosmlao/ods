import { NoticeForm } from "@/components/notice-form";
import { query } from "@/lib/db";

/**
 * ຝັ່ງລູກຄ້າ — ຟອມແຈ້ງສ້ອມສາທາລະນະ (ບໍ່ຕ້ອງ login).
 * ດຶງ ແຂວງ + ເມືອງ **ທັງໝົດ** ລົງໄປ cascade ຢູ່ client (ບໍ່ເປີດ API ໃໝ່ໃຫ້ສາທາລະນະ).
 */
export const dynamic = "force-dynamic";

export default async function ReportRepairPage() {
  const [provinces, cities] = await Promise.all([
    query<{ code: string; name_1: string }>("select code, name_1 from province order by roworder asc"),
    query<{ code: string; name_1: string; province: string }>(
      "select code, name_1, province from city order by roworder asc",
    ),
  ]);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4 text-center shadow-sm">
        <h1 className="text-lg font-bold text-slate-700">ແຈ້ງສ້ອມເຄື່ອງ</h1>
        <p className="mt-0.5 text-xs text-slate-500">ຕື່ມຂໍ້ມູນ ແລ້ວທີມງານຈະຕິດຕໍ່ກັບຄືນ</p>
      </div>
      <NoticeForm mode="public" provinces={provinces.rows} cities={cities.rows} />
    </div>
  );
}
