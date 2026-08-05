import { productTypeOptions, serviceItemOptions } from "@/app/actions/service-charge";
import { rateOptions } from "@/app/actions/service-rate";
import { Card, PageTitle, Table } from "@/components/ui";
import { cobConfig } from "@/lib/erp-cob";
import { listServiceCharges } from "@/lib/service-charge";
import { AddChargeForm, CobConfigForm, DeleteChargeButton } from "./charge-forms";

/**
 * **ຈັບຄູ່ ປະເພດເຄື່ອງ → ຄ່າບໍລິການສ້ອມແປງ** — ໜ້າໃບຮັບເງິນເອົາການຕັ້ງຄ່ານີ້ໄປຕື່ມ
 * ລາຍການໃຫ້ອັດຕະໂນມັດ (ໃນປະກັນ = 0). ຜູ້ຈັດການເທົ່ານັ້ນ (ບັງຄັບຢູ່ action).
 *
 * ຢ່າສັບສົນກັບ /manage/service-rates — ອັນນັ້ນຄື **ຄ່າຄອມທີ່ຈ່າຍພະນັກງານ**,
 * ອັນນີ້ຄື **ລາຍການທີ່ເກັບຈາກລູກຄ້າ**. ໂຄງມິຕິ ແລະ ສູດຈັບຄູ່ຄືກັນທຸກຢ່າງ.
 */
export const dynamic = "force-dynamic";

const SERVICE_TYPE_LABEL: Record<string, string> = {
  CI: "ລູກຄ້ານຳເຄື່ອງເຂົ້າ",
  ST: "ສ້ອມໃນສາງ",
  IH: "ສ້ອມບ້ານລູກຄ້າ",
  PS: "ໄປຮັບເຄື່ອງມາສ້ອມຢູ່ສູນ",
};

export default async function ServiceChargesPage() {
  const [options, productTypes, services, rows, cob] = await Promise.all([
    rateOptions(),
    productTypeOptions(),
    serviceItemOptions(),
    listServiceCharges(),
    cobConfig(),
  ]);
  const productTypeName = (code: string | null) =>
    code ? (productTypes.find((p) => p.code === code)?.name ?? code) : "ທຸກປະເພດ";
  const categoryName = (code: string | null) =>
    code ? (options.categories.find((c) => c.code === code)?.name ?? code) : "ທຸກໝວດ";

  return (
    <div className="w-full space-y-4">
      <PageTitle sub="ໜ້າໃບຮັບເງິນຈະຕື່ມລາຍການນີ້ໃຫ້ອັດຕະໂນມັດ · ງານໃນປະກັນລາຄາ 0">
        ຄ່າບໍລິການສ້ອມແປງ ຕາມປະເພດເຄື່ອງ
      </PageTitle>

      <AddChargeForm categories={options.categories} productTypes={productTypes} services={services} />

      <CobConfigForm config={cob} />

      <Card>
        <Table head={["ປະເພດເຄື່ອງ", "ປະເພດບໍລິການ", "ໝວດ ERP", "ແບບ", "ຂະໜາດ", "ລາຍການທີ່ຈະຕື່ມ", "ລາຄາ (ບາດ)", "ແກ້ໄຂລ່າສຸດ", ""]} minWidth={1000}>
          {rows.length === 0 && (
            <tr>
              <td colSpan={9} className="py-10 text-center text-xs text-slate-400">
                ຍັງບໍ່ໄດ້ຕັ້ງຄ່າ — ບິນຈະບໍ່ຕື່ມຄ່າບໍລິການໃຫ້ (ຄົນເລືອກເອງຄືເກົ່າ)
              </td>
            </tr>
          )}
          {rows.map((row) => (
            <tr key={row.id} className="border-b border-slate-100">
              <td className="px-3 py-2 font-medium text-slate-700">{productTypeName(row.product_type)}</td>
              <td className="px-3 py-2">{row.service_type ? SERVICE_TYPE_LABEL[row.service_type] ?? row.service_type : "ທຸກປະເພດ"}</td>
              <td className="px-3 py-2">{categoryName(row.category_code)}</td>
              <td className="px-3 py-2 text-slate-500">{row.design_code ?? "—"}</td>
              <td className="px-3 py-2 text-slate-500">{row.size_code ?? "—"}</td>
              <td className="px-3 py-2">
                <span className="font-mono text-[11px] font-bold text-brand">{row.service_code}</span>
                <span className="block truncate text-[11px] text-slate-500">{row.service_name ?? "-"}</span>
              </td>
              <td className="px-3 py-2 text-right tabular-nums">{row.price_thb.toLocaleString()}</td>
              <td className="px-3 py-2 text-[11px] text-slate-400">{row.updated_at}{row.updated_by ? ` · ${row.updated_by}` : ""}</td>
              <td className="px-3 py-2 text-center"><DeleteChargeButton id={row.id} /></td>
            </tr>
          ))}
        </Table>
        <p className="mt-3 text-[11px] text-slate-400">
          ຈັບຄູ່ແບບ <b>ລະອຽດກວ່າຊະນະ</b>: ຂະໜາດ &gt; ແບບ &gt; ໝວດ ERP &gt; ປະເພດເຄື່ອງ &gt; ປະເພດບໍລິການ — ຫວ່າງ = ໃຊ້ກັບທຸກຄ່າ.
          ໝວດ/ແບບ/ຂະໜາດ ຂອງ ERP ໃຊ້ໄດ້ສະເພາະງານທີ່ມີລະຫັດສິນຄ້າ (ໜ້ອຍກວ່າ 1%) ⇒ ຕັ້ງດ້ວຍ <b>ປະເພດເຄື່ອງ</b> ເປັນຫຼັກ.
          ຕັ້ງແຖວກວ້າງໆ 1 ແຖວ (ຫວ່າງໝົດ) ໄວ້ເປັນຄ່າສຳຮອງກໍ່ໄດ້.
        </p>
      </Card>
    </div>
  );
}
