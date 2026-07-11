import { notFound } from "next/navigation";
import { query } from "@/lib/db";
import { Chatter } from "@/components/chatter/chatter";
import { CustomerForm, type Customer } from "@/components/manage/customer-form";

/** ເເກ້ໄຂລູກຄ້າ — ແທນ /edit_custpage/<id> + /edit_cust ຂອງ ods */
type Props = { params: Promise<{ code: string }> };

export default async function EditCustomerPage({ params }: Props) {
  const { code } = await params;

  const customer = (
    await query<Customer>(
      "select code, name_1, name_2, address, provine, city, tel from ar_customer where code = $1",
      [decodeURIComponent(code)],
    )
  ).rows[0];
  if (!customer) notFound();

  const [provinces, cities] = await Promise.all([
    query<{ code: string; name_1: string }>("select code, name_1 from province order by roworder asc"),
    // ເມືອງຂອງແຂວງລູກຄ້າ — ໂຫລດລ່ວງໜ້າ ເພື່ອໃຫ້ເມືອງທີ່ເລືອກໄວ້ສະແດງທັນທີ
    customer.provine
      ? query<{ code: string; name_1: string }>(
          "select code, name_1 from city where province = $1 order by roworder asc",
          [customer.provine],
        )
      : Promise.resolve({ rows: [] }),
  ]);

  return (
    <div className="w-full space-y-5">
      <CustomerForm provinces={provinces.rows} customer={customer} initialCities={cities.rows} />
      <Chatter model="ar_customer" resId={customer.code} />
    </div>
  );
}
