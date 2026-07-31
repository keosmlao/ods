import { InstallStandardManager, type StandardLine } from "@/components/manage/install-standard-manager";
import { StandardSuggestions } from "@/components/manage/standard-suggestions";
import { suggestStandardFromHistory } from "@/lib/install-standard";
import { query } from "@/lib/db";
import { requireRoleOrRedirect } from "@/lib/guard";
import { SETTING, settingEnabled } from "@/lib/settings";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getLocale } from "@/lib/i18n/locale";
import { PackageSearch } from "lucide-react";
import Link from "next/link";

/**
 * **ຕັ້ງອາໄຫຼ່ມາດຕະຖານຂອງງານຕິດຕັ້ງ** — ຄູ່ກັບສະວິດ "ເບີກນອກມາດຕະຖານ".
 *
 * ບໍ່ນິຍາມບ່ອນນີ້ = ລະບົບຕົກໄປໃຊ້ຊຸດສິນຄ້າຂອງ ERP (ເຊິ່ງເປັນອົງປະກອບຂອງຕົວເຄື່ອງ
 * ບໍ່ແມ່ນອາໄຫຼ່ຕິດຕັ້ງ) ⇒ ປິດສະວິດແລ້ວຊ່າງເບີກຫຍັງບໍ່ໄດ້. ເບິ່ງ lib/install-standard.
 */
export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ type?: string; size?: string }> };

export default async function InstallStandardPage({ searchParams }: Props) {
  await requireRoleOrRedirect(["manager"]);
  // ໝວດ/ຂະໜາດ ທີ່ກຳລັງເບິ່ງ "ແນະນຳຈາກປະຫວັດ" — ຢູ່ໃນ URL ⇒ ແຊຣ໌ລິ້ງ/ຣີເຟຣຊໄດ້
  const { type: suggestType = "", size: suggestSize = "" } = await searchParams;
  const t = (await getDictionary(await getLocale())).manageInstallStandard;

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

  const suggestions = suggestType ? await suggestStandardFromHistory(suggestType, suggestSize) : [];

  return (
    <div className="w-full space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-lg font-bold text-slate-700">
          <PackageSearch className="size-5 text-teal-600" />
          {t.title}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          {t.sub}
        </p>
      </div>

      <p className={`rounded-xl px-4 py-3 text-xs font-semibold ${freeSearch ? "bg-slate-50 text-slate-600" : "bg-amber-50 text-amber-800"}`}>
        {freeSearch ? (
          <>
            {t.freeSearchOn}{" "}
            <Link href="/manage/settings" className="underline">
              {t.settingsLink}
            </Link>
          </>
        ) : (
          <>{t.freeSearchOff}</>
        )}
      </p>

      {/* ── ແນະນຳຈາກປະຫວັດ — ເລືອກໝວດ (+ຂະໜາດ) ຜ່ານ URL ── */}
      <form className="flex flex-wrap items-end gap-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div>
          <label className="mb-1 block text-xs text-slate-500">{t.historyFilterLabel}</label>
          <select
            name="type"
            defaultValue={suggestType}
            className="h-9 rounded-lg border border-slate-300 px-2.5 text-sm outline-none focus:border-teal-500"
          >
            <option value="">{t.pickCategory}</option>
            {categories.rows.map((category) => (
              <option key={category.code} value={category.code}>
                {category.name_1}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-500">{t.sizeFilterLabel}</label>
          <input
            name="size"
            defaultValue={suggestSize}
            list="install-standard-sizes-filter"
            className="h-9 rounded-lg border border-slate-300 px-2.5 text-sm outline-none focus:border-teal-500"
          />
          <datalist id="install-standard-sizes-filter">
            {sizes.rows.map((row) => (
              <option key={row.pro_size} value={row.pro_size} />
            ))}
          </datalist>
        </div>
        <button className="h-9 rounded-lg border border-teal-300 bg-teal-50 px-3 text-sm font-semibold text-teal-700 hover:bg-teal-100">
          {t.showSuggestions}
        </button>
      </form>

      {suggestType && (
        <StandardSuggestions proTypeCode={suggestType} proSize={suggestSize} rows={suggestions} />
      )}

      <InstallStandardManager
        categories={categories.rows}
        sizes={sizes.rows.map((row) => row.pro_size)}
        lines={lines.rows}
      />
    </div>
  );
}
