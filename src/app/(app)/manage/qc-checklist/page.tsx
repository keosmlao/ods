import { qcItems } from "@/app/actions/qc-admin";
import { rateOptions } from "@/app/actions/service-rate";
import { Card, Empty, PageTitle, Table } from "@/components/ui";
import { WORKFLOW_LABEL } from "@/lib/qc";
import { requireRoleOrRedirect } from "@/lib/guard";
import { Camera } from "lucide-react";
import { ItemForm, ItemRowActions } from "./checklist-forms";

/**
 * ຕັ້ງລາຍການກວດຮັບຄຸນນະພາບ — ຜູ້ຈັດການເທົ່ານັ້ນ.
 *
 * ⚠️ ຖ້າສາຍງານໃດ **ບໍ່ມີລາຍການເລີຍ** ງານຂອງສາຍງານນັ້ນຈະຄ້າງຢູ່ຂັ້ນ QC ຕະຫຼອດ
 * (ຜ່ານ QC ບໍ່ໄດ້ ⇒ ຕິດຕັ້ງປິດງານບໍ່ໄດ້ · ສ້ອມອອກໃບຮັບເງິນບໍ່ໄດ້) ⇒ ເຕືອນໄວ້ຢູ່ໜ້ານີ້.
 */
export const dynamic = "force-dynamic";

export default async function QcChecklistPage() {
  await requireRoleOrRedirect(["manager"]);
  const [items, options] = await Promise.all([qcItems(), rateOptions()]);
  const categoryName = new Map(options.categories.map((category) => [category.code, category.name]));

  return (
    <div className="space-y-6">
      <PageTitle sub="ດ່ານກ່ອນສົ່ງມອບລູກຄ້າ — ງານທີ່ບໍ່ຜ່ານຈະຖືກສົ່ງກັບໃຫ້ຊ່າງແກ້">ລາຍການກວດຮັບຄຸນນະພາບ</PageTitle>

      {(["install", "repair"] as const)
        .filter((workflow) => !items.some((item) => item.workflow === workflow && item.is_active))
        .map((workflow) => (
          <p key={workflow} className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            ສາຍງານ <b>{WORKFLOW_LABEL[workflow]}</b> ຍັງບໍ່ມີລາຍການກວດທີ່ເປີດໃຊ້ ⇒ ງານຂອງສາຍງານນີ້ຈະ
            <b> ຄ້າງຢູ່ຂັ້ນ QC ຕະຫຼອດ</b> ຈົນກວ່າຈະເພີ່ມລາຍການ.
          </p>
        ))}

      <Card title="ລາຍການທີ່ຕ້ອງກວດ" actions={<ItemForm categories={options.categories} />}>
        {items.length === 0 ? (
          <Empty>ຍັງບໍ່ມີລາຍການ</Empty>
        ) : (
          <Table head={["ສາຍງານ", "ໝວດສິນຄ້າ", "ລາຍການ", "ລຳດັບ", "ຮູບ", "ສະຖານະ", "ໃຊ້ແລ້ວ", ""]} minWidth={900}>
            {items.map((item) => (
              <tr key={item.id} className={`border-b border-slate-100 ${item.is_active ? "" : "bg-slate-50 opacity-60"}`}>
                <td className="px-3 py-2 text-center">{WORKFLOW_LABEL[item.workflow]}</td>
                <td className="px-3 py-2 text-center text-slate-600">
                  {item.category_code ? (categoryName.get(item.category_code) ?? item.category_code) : "ທຸກໝວດ"}
                </td>
                <td className="px-3 py-2 font-semibold text-slate-700">{item.name}</td>
                <td className="px-3 py-2 text-center text-slate-500">{item.sort_order}</td>
                <td className="px-3 py-2 text-center">
                  {item.require_photo ? <Camera className="mx-auto size-4 text-teal-600" /> : "-"}
                </td>
                <td className="px-3 py-2 text-center">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                      item.is_active ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-500"
                    }`}
                  >
                    {item.is_active ? "ເປີດໃຊ້" : "ປິດ"}
                  </span>
                </td>
                <td className="px-3 py-2 text-center text-slate-500">{item.used > 0 ? `${item.used} ງານ` : "-"}</td>
                <td className="px-3 py-2">
                  <ItemRowActions item={item} categories={options.categories} />
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      {/* "ໃຜກວດ QC ໄດ້" ຍ້າຍໄປຢູ່ໜ້າ **ກຳນົດສິດ** (/manage/employees) ແລ້ວ —
          ເລື່ອງສິດຄວນຢູ່ບ່ອນດຽວ ບໍ່ແມ່ນກະຈາຍໄປຕາມໜ້າຕ່າງໆ */}
    </div>
  );
}
