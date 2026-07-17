import { qcItems } from "@/app/actions/qc-admin";
import { rateOptions } from "@/app/actions/service-rate";
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-700">ລາຍການກວດຮັບຄຸນນະພາບ</h1>
          <p className="mt-0.5 text-xs text-slate-500">
            ດ່ານກ່ອນສົ່ງມອບລູກຄ້າ — ງານທີ່ບໍ່ຜ່ານຈະຖືກສົ່ງກັບໃຫ້ຊ່າງແກ້ · {items.length} ລາຍການ
          </p>
        </div>
        <ItemForm categories={options.categories} />
      </div>

      {(["install", "repair"] as const)
        .filter((workflow) => !items.some((item) => item.workflow === workflow && item.is_active))
        .map((workflow) => (
          <p key={workflow} className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            ສາຍງານ <b>{WORKFLOW_LABEL[workflow]}</b> ຍັງບໍ່ມີລາຍການກວດທີ່ເປີດໃຊ້ ⇒ ງານຂອງສາຍງານນີ້ຈະ
            <b> ຄ້າງຢູ່ຂັ້ນ QC ຕະຫຼອດ</b> ຈົນກວ່າຈະເພີ່ມລາຍການ.
          </p>
        ))}

      <div className="space-y-2">
        <h2 className="text-sm font-bold text-slate-700">ລາຍການທີ່ຕ້ອງກວດ</h2>
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-xs" style={{ minWidth: 900 }}>
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-slate-600">
                  <th className="whitespace-nowrap px-3 py-2.5 font-semibold">ສາຍງານ</th>
                  <th className="whitespace-nowrap px-3 py-2.5 font-semibold">ໝວດສິນຄ້າ</th>
                  <th className="whitespace-nowrap px-3 py-2.5 font-semibold">ລາຍການ</th>
                  <th className="whitespace-nowrap px-3 py-2.5 font-semibold">ລຳດັບ</th>
                  <th className="whitespace-nowrap px-3 py-2.5 font-semibold">ຮູບ</th>
                  <th className="whitespace-nowrap px-3 py-2.5 font-semibold">ສະຖານະ</th>
                  <th className="whitespace-nowrap px-3 py-2.5 font-semibold">ໃຊ້ແລ້ວ</th>
                  <th className="px-3 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className={`border-b border-slate-100 ${item.is_active ? "hover:bg-slate-50" : "bg-slate-50 opacity-60"}`}>
                    <td className="px-3 py-2.5 text-center">{WORKFLOW_LABEL[item.workflow]}</td>
                    <td className="px-3 py-2.5 text-center text-slate-600">
                      {item.category_code ? (categoryName.get(item.category_code) ?? item.category_code) : "ທຸກໝວດ"}
                    </td>
                    <td className="px-3 py-2.5 font-semibold text-slate-700">{item.name}</td>
                    <td className="px-3 py-2.5 text-center text-slate-500">{item.sort_order}</td>
                    <td className="px-3 py-2.5 text-center">
                      {item.require_photo ? <Camera className="mx-auto size-4 text-teal-600" /> : "-"}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                          item.is_active ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-500"
                        }`}
                      >
                        {item.is_active ? "ເປີດໃຊ້" : "ປິດ"}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-center text-slate-500">{item.used > 0 ? `${item.used} ງານ` : "-"}</td>
                    <td className="px-3 py-2.5">
                      <ItemRowActions item={item} categories={options.categories} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {items.length === 0 && <p className="py-12 text-center text-xs text-slate-400">ຍັງບໍ່ມີລາຍການ</p>}
        </section>
      </div>

      {/* "ໃຜກວດ QC ໄດ້" ຍ້າຍໄປຢູ່ໜ້າ **ກຳນົດສິດ** (/manage/employees) ແລ້ວ —
          ເລື່ອງສິດຄວນຢູ່ບ່ອນດຽວ ບໍ່ແມ່ນກະຈາຍໄປຕາມໜ້າຕ່າງໆ */}
    </div>
  );
}
