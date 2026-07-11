import { Chatter } from "@/components/chatter/chatter";
import { InstallEditForm, type InstallRow } from "@/components/installation/install-edit-form";
import { PageTitle } from "@/components/ui";
import { query } from "@/lib/db";
import { notFound } from "next/navigation";

/**
 * ຖອດແບບຈາກ ods: /edit_install/<id> + /edit_save_install (install_admin.py).
 * ods ໃຊ້ roworder ໃນ URL — ບ່ອນນີ້ໃຊ້ code ເພາະອ່ານງ່າຍກວ່າ ແລະ ບໍ່ຊ້ຳ.
 */
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ code: string }> };
type Option = { code: string; name_1: string };
type Tech = { code: string; username: string };

export default async function EditInstallation({ params }: Props) {
  const { code } = await params;

  const [row, categories, brands, techs] = await Promise.all([
    query<InstallRow>(
      `select a.code, to_char(a.time_register,'DD-MM-YYYY HH24:MI:SS') as time_register, a.cust_code,
         c.name_1 as cust_name, c.tel,
         coalesce(c.address,'') || '-' || coalesce(d.name_1,'') || '-' || coalesce(p.name_1,'') as address,
         a.doc_ref_1, to_char(a.doc_ref_date,'YYYY-MM-DD') as doc_ref_date, a.user_created, a.tech_code, a.remark,
         a.item_code, a.item_name, a.pro_brand, a.pro_model, a.pro_type_code, a.pro_size,
         to_char(a.appoint_date,'YYYY-MM-DD') as appoint_date, a.location_inst, a.pro_sn,
         left(a.item_code,2) as item_prefix
       from ods_tb_install a
       left join ar_customer c on c.code = a.cust_code
       left join province p on c.provine = p.code
       left join city d on d.code = c.city and d.province = c.provine
       where a.code = $1 limit 1`,
      [decodeURIComponent(code)],
    ),
    query<Option>("select code,name_1 from tb_category order by name_1"),
    query<Option>("select code,name_1 from tb_brand order by name_1"),
    query<Tech>("select code,username from users where roles='technical' order by username"),
  ]);

  const install = row.rows[0];
  if (!install) notFound();

  return (
    <div className="w-full space-y-5">
      <PageTitle>ເເກ້ໄຂງານຕິດຕັ້ງ</PageTitle>
      <InstallEditForm row={install} categories={categories.rows} brands={brands.rows} techs={techs.rows} />
      <Chatter model="ods_tb_install" resId={install.code} />
    </div>
  );
}
