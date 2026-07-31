import { InstallStandardManager, type StandardLine } from "@/components/manage/install-standard-manager";
import { query } from "@/lib/db";
import { requireRoleOrRedirect } from "@/lib/guard";
import { SETTING, settingEnabled } from "@/lib/settings";
import { PackageSearch } from "lucide-react";
import Link from "next/link";

/**
 * **ຕັ້ງອາໄຫຼ່ມາດຕະຖານຂອງງານຕິດຕັ້ງ** — ຄູ່ກັບສະວິດ "ເບີກນອກມາດຕະຖານ".
 *
 * ບໍ່ນິຍາມບ່ອນນີ້ = ລະບົບຕົກໄປໃຊ້ຊຸດສິນຄ້າຂອງ ERP (ເຊິ່ງເປັນອົງປະກອບຂອງຕົວເຄື່ອງ
 * ບໍ່ແມ່ນອາໄຫຼ່ຕິດຕັ້ງ) ⇒ ປິດສະວິດແລ້ວຊ່າງເບີກຫຍັງບໍ່ໄດ້. ເບິ່ງ lib/install-standard.
 */
export const dynamic = "force-dynamic";

export default async function InstallStandardPage() {
  await requireRoleOrRedirect(["manager"]);

  const [categories, sizes, lines, freeSearch] = await Promise.all([
    query<{ code: string; name_1: string }>("select code, name_1 from tb_category order by name_1"),
    // ຂະໜາດທີ່ເຄີຍໃຊ້ຈິງໃນໃບງານ — ໃຫ້ຄົນເລືອກຈາກຂອງຈິງ ບໍ່ຕ້ອງເດົາຮູບແບບ
    query<{ pro_size: string }>(
      `select distinct pro_size from ods_tb_install
        where coalesce(pro_size,'') <> '' order by pro_size limit 100`,
    ),
    query<StandardLine>(
      `select s.id, s.pro_type_code, c.name_1 pro_type_name, s.pro_size, s.item_code, s.item_name,
          s.unit_code, s.qty::float8 qty, s.updated_by,
          to_char(s.updated_at,'DD-MM-YYYY HH24:MI') updated_at
        from ods_install_spare_standard s
        left join tb_category c on c.code = s.pro_type_code
       order by c.name_1, s.pro_size, s.item_name`,
    ),
    settingEnabled(SETTING.INSTALL_SPARE_FREE_SEARCH),
  ]);

  return (
    <div className="w-full space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-lg font-bold text-slate-700">
          <PackageSearch className="size-5 text-teal-600" />
          ອາໄຫຼ່ມາດຕະຖານ ຂອງງານຕິດຕັ້ງ
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          ນິຍາມ<b>ຕໍ່ໝວດສິນຄ້າ</b> (ໃສ່ຂະໜາດເພື່ອແຍກຍ່ອຍໄດ້). ໃບຂໍເບີກຈະເອົາລາຍການນີ້ຂຶ້ນເປັນ
          “ມາດຕະຖານ” ພ້ອມຈຳນວນຕັ້ງຕົ້ນ — ຍັງບໍ່ນິຍາມ = ໃຊ້ຊຸດສິນຄ້າຂອງ ERP ຄືເກົ່າ.
        </p>
      </div>

      <p className={`rounded-xl px-4 py-3 text-xs font-semibold ${freeSearch ? "bg-slate-50 text-slate-600" : "bg-amber-50 text-amber-800"}`}>
        {freeSearch ? (
          <>
            ດຽວນີ້ <b>ອະນຸຍາດ</b>ໃຫ້ເບີກອາໄຫຼ່ນອກມາດຕະຖານ (ຊ່າງຄົ້ນ ERP ເພີ່ມເອງໄດ້) —
            ປິດໄດ້ທີ່ <Link href="/manage/settings" className="underline">ການຕັ້ງຄ່າລະບົບ</Link> ເມື່ອນິຍາມລາຍການລຸ່ມນີ້ຄົບແລ້ວ.
          </>
        ) : (
          <>
            ດຽວນີ້ <b>ຫ້າມ</b>ເບີກນອກມາດຕະຖານ — ໝວດທີ່ຍັງບໍ່ມີລາຍການລຸ່ມນີ້ ຊ່າງຈະເບີກອາໄຫຼ່ບໍ່ໄດ້ເລີຍ.
          </>
        )}
      </p>

      <InstallStandardManager
        categories={categories.rows}
        sizes={sizes.rows.map((row) => row.pro_size)}
        lines={lines.rows}
      />
    </div>
  );
}
