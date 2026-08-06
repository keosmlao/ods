import { productTypeOptions, serviceItemOptions } from "@/app/actions/service-charge";
import { rateOptions } from "@/app/actions/service-rate";
import { Card, PageTitle, Table } from "@/components/ui";
import { aobConfig } from "@/lib/erp-aob";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getLocale } from "@/lib/i18n/locale";
import { listServiceCharges } from "@/lib/service-charge";
import { AddChargeForm, AobConfigForm, DeleteChargeButton, EditChargeRow } from "./charge-forms";

/**
 * **ຈັບຄູ່ ປະເພດເຄື່ອງ → ຄ່າບໍລິການສ້ອມແປງ** — ໜ້າໃບຮັບເງິນເອົາການຕັ້ງຄ່ານີ້ໄປຕື່ມ
 * ລາຍການໃຫ້ອັດຕະໂນມັດ (ໃນປະກັນ = 0). ຜູ້ຈັດການເທົ່ານັ້ນ (ບັງຄັບຢູ່ action).
 *
 * ຢ່າສັບສົນກັບ /manage/service-rates — ອັນນັ້ນຄື **ຄ່າຄອມທີ່ຈ່າຍພະນັກງານ**,
 * ອັນນີ້ຄື **ລາຍການທີ່ເກັບຈາກລູກຄ້າ**. ໂຄງມິຕິ ແລະ ສູດຈັບຄູ່ຄືກັນທຸກຢ່າງ.
 */
export const dynamic = "force-dynamic";

export default async function ServiceChargesPage() {
  const t = (await getDictionary(await getLocale())).serviceCharges;
  const serviceTypeLabel: Record<string, string> = { CI: t.stCI, ST: t.stST, IH: t.stIH, PS: t.stPS };
  const [options, productTypes, services, rows, aob] = await Promise.all([
    rateOptions(),
    productTypeOptions(),
    serviceItemOptions(),
    listServiceCharges(),
    aobConfig(),
  ]);
  const productTypeName = (code: string | null) =>
    code ? (productTypes.find((p) => p.code === code)?.name ?? code) : t.allTypes;
  const categoryName = (code: string | null) =>
    code ? (options.categories.find((c) => c.code === code)?.name ?? code) : t.allCategories;

  return (
    <div className="w-full space-y-4">
      <PageTitle sub={t.sub}>{t.title}</PageTitle>

      <AddChargeForm categories={options.categories} productTypes={productTypes} services={services} />

      <AobConfigForm config={aob} />

      <Card>
        <Table head={[t.colProductType, t.colServiceType, t.colCategory, t.colDesign, t.colSize, t.colItem, t.colPrice, t.colUpdated, ""]} minWidth={1000}>
          {rows.length === 0 && (
            <tr>
              <td colSpan={9} className="py-10 text-center text-xs text-slate-400">
                {t.emptyTable}
              </td>
            </tr>
          )}
          {rows.map((row) => (
            <tr key={row.id} className="border-b border-slate-100">
              <td className="px-3 py-2 font-medium text-slate-700">{productTypeName(row.product_type)}</td>
              <td className="px-3 py-2">{row.service_type ? serviceTypeLabel[row.service_type] ?? row.service_type : t.allTypes}</td>
              <td className="px-3 py-2">{categoryName(row.category_code)}</td>
              <td className="px-3 py-2 text-slate-500">{row.design_code ?? "—"}</td>
              <td className="px-3 py-2 text-slate-500">{row.size_code ?? "—"}</td>
              {/* ລາຍການ + ລາຄາ **ແກ້ໄດ້ຢູ່ນີ້ເລີຍ** (ບັນທຶກແລ້ວທັບແຖວເດີມຕາມມິຕິ) */}
              <td className="px-3 py-2" colSpan={2}>
                <EditChargeRow row={row} services={services} />
                <span className="mt-0.5 block truncate text-[10px] text-slate-400">{row.service_name ?? "-"}</span>
              </td>
              <td className="px-3 py-2 text-[11px] text-slate-400">{row.updated_at}{row.updated_by ? ` · ${row.updated_by}` : ""}</td>
              <td className="px-3 py-2 text-center"><DeleteChargeButton id={row.id} /></td>
            </tr>
          ))}
        </Table>
        <p className="mt-3 text-[11px] text-slate-400">{t.footer}</p>
      </Card>
    </div>
  );
}
