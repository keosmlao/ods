import { Chatter } from "@/components/chatter/chatter";
import { InstallEditForm, type InstallRow } from "@/components/installation/install-edit-form";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getLocale } from "@/lib/i18n/locale";
import { JobEditHeader } from "@/components/job-edit-header";
import { query } from "@/lib/db";
import { jobHelpers } from "@/lib/job-techs";
import { listTechnicians } from "@/lib/technicians";
import { permissionFor } from "@/lib/permissions";
import { getSession } from "@/lib/auth";
import { notFound, redirect } from "next/navigation";

/**
 * ຖອດແບບຈາກ ods: /edit_install/<id> + /edit_save_install (install_admin.py).
 * ods ໃຊ້ roworder ໃນ URL — ບ່ອນນີ້ໃຊ້ code ເພາະອ່ານງ່າຍກວ່າ ແລະ ບໍ່ຊ້ຳ.
 */
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ code: string }> };
type Option = { code: string; name_1: string };

export default async function EditInstallation({ params }: Props) {
  // ດ່ານຂອງໜ້າ — ຕົງກັບດ່ານຂອງ updateInstall (ສິດລາຍຄົນ update ຊະນະສິດຕາມຕຳແໜ່ງ)
  const t = (await getDictionary(await getLocale())).jobEdit;
  const fill = (text: string, vars: Record<string, string>) =>
    Object.entries(vars).reduce((out, [k, v]) => out.replaceAll(`{${k}}`, v), text);
  const session = await getSession();
  if (!session) redirect("/login");
  if (!(await permissionFor(session, "/installations")).update) redirect("/forbidden");
  const { code } = await params;

  const [row, categories, brands, techs, helpers] = await Promise.all([
    query<InstallRow>(
      `select a.code, to_char(a.time_register,'DD-MM-YYYY HH24:MI:SS') as time_register, a.cust_code,
         c.name_1 as cust_name, c.tel,
         coalesce(c.address,'') || '-' || coalesce(d.name_1,'') || '-' || coalesce(p.name_1,'') as address,
         a.doc_ref_1, to_char(a.doc_ref_date,'YYYY-MM-DD') as doc_ref_date, a.user_created, a.tech_code, a.remark,
         a.item_code, a.item_name, a.pro_brand, a.pro_model, a.pro_type_code, a.pro_type, a.pro_size,
         coalesce(a.pro_sn_out,'') pro_sn_out,
         to_char(a.appoint_date,'YYYY-MM-DD') as appoint_date, a.location_inst, a.pro_sn,
         left(a.item_code,2) as item_prefix,
         -- ງານປິດແລ້ວ ⇒ ຟອມເປີດໃຫ້ແກ້ສະເພາະ ISN (ເບິ່ງ install-edit-form)
         a.job_finish is not null as closed
       from ods_tb_install a
       left join ar_customer c on c.code = a.cust_code
       left join province p on c.provine = p.code
       left join city d on d.code = c.city and d.province = c.provine
       where a.code = $1 limit 1`,
      [decodeURIComponent(code)],
    ),
    query<Option>("select code,name_1 from tb_category order by name_1"),
    query<Option>("select code,name_1 from tb_brand order by name_1"),
    // ຊ່າງມາຈາກ ERP + ຜູ້ທີ່ຖືກກຳນົດສິດເປັນຊ່າງ (lib/technicians) ບໍ່ແມ່ນຕາຕະລາງ users ເກົ່າ
    listTechnicians(),
    // ຊ່າງຮ່ວມ (10-08-2026) — ຫົວໜ້າຢູ່ `tech_code` ຄືເກົ່າ (ເບິ່ງ lib/job-techs)
    jobHelpers("install", decodeURIComponent(code)),
  ]);

  const install = row.rows[0];
  if (!install) notFound();

  return (
    <div className="w-full space-y-5">
      <JobEditHeader
        back={{ href: `/installations/${encodeURIComponent(install.code)}`, label: t.backInstall }}
        title={fill(t.titleInstall, { code: install.code })}
        subtitle={[install.item_name, install.pro_model, install.cust_name].filter(Boolean).join(" · ")}
        /* ປິດງານແລ້ວ ⇒ updateInstall ຮັບແຕ່ ISN (ເບິ່ງ isnOnlyUpdate) — ບອກໄວ້ກ່ອນ */
        locked={install.closed ? t.lockedInstall : null}
      />
      <InstallEditForm
        row={install}
        categories={categories.rows}
        brands={brands.rows}
        techs={techs}
        helpers={helpers}
        isnOnly={install.closed}
      />
      <Chatter model="ods_tb_install" resId={install.code} />
    </div>
  );
}
