import { query } from "@/lib/db";
import { nextCustomerCode } from "@/app/actions/customer";
import { CustomerForm } from "@/components/manage/customer-form";

/** ເພີ່ມລູກຄ້າ — ແທນ /addcust + /save_cust ຂອງ ods */
export default async function NewCustomerPage() {
  const [provinces, nextCode] = await Promise.all([
    query<{ code: string; name_1: string }>("select code, name_1 from province order by roworder asc"),
    nextCustomerCode(),
  ]);

  return <CustomerForm provinces={provinces.rows} nextCode={nextCode} />;
}
