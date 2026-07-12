import { type Option, rateOptions } from "@/app/actions/service-rate";
import { Card, Empty, PageTitle, Table } from "@/components/ui";
import { ROLE_LABEL, type Workflow } from "@/lib/commission";
import { query } from "@/lib/db";
import { AddRateForm, DeactivateRateButton, PayeeForm, SplitForm } from "./rate-forms";

/**
 * ກຳນົດ ຄ່າບໍລິການ · ການແບ່ງເງິນ · ຜູ້ຮັບເງິນ — **ຜູ້ຈັດການເທົ່ານັ້ນ** (lib/roles).
 *
 * ມິຕິຂອງອັດຕາ (ໝວດ/ແບບ/ຂະໜາດ) ມາຈາກ **ERP** ບ່ອນດຽວ ⇒ ບໍ່ມີທາງທີ່ອັດຕາຈະອ້າງອີງ
 * ຂະໜາດທີ່ບໍ່ມີຈິງ ແລະ ບໍ່ຕ້ອງເກັບຂະໜາດຊ້ຳໃນ ODS.
 */
export const dynamic = "force-dynamic";

type RateRow = {
  id: number;
  workflow: string;
  label: string;
  amount_thb: string;
  service_type: string | null;
  category_name: string | null;
  design_name: string | null;
  size_name: string | null;
};

const SERVICE_TYPE_LABEL: Record<string, string> = {
  CI: "ລູກຄ້ານຳເຄື່ອງເຂົ້າ",
  ST: "ສ້ອມໃນສາງ",
  IH: "ສ້ອມບ້ານລູກຄ້າ",
  PS: "ໄປຮັບບ້ານລູກຄ້າ",
};

export default async function ServiceRatesPage() {
  const [options, rates, splits, payees, employees] = await Promise.all([
    rateOptions(),
    query<Omit<RateRow, "category_name" | "design_name" | "size_name"> & {
      category_code: string | null;
      design_code: string | null;
      size_code: string | null;
    }>(
      `select id, workflow, service_type, category_code, design_code, size_code, label, amount_thb
         from ods_service_rate where is_active order by workflow, id desc`,
    ),
    query<{ workflow: string; role: string; pct: string }>(
      "select workflow, role, pct from ods_service_commission_split",
    ),
    query<{ workflow: string; role: string; employee_code: string }>(
      "select workflow, role, employee_code from ods_service_commission_payee",
    ),
    /**
     * ⚠️ ຜູ້ຮັບເງິນຕ້ອງມາຈາກ **users ຂອງ ODS** ບໍ່ແມ່ນ odg_employee ຂອງ ERP.
     *
     * ງານບັນທຶກຊ່າງໄວ້ເປັນ users.code (assignTech ເລືອກຈາກຕາຕະລາງນີ້) ແລະ ຄ່າຈິງ
     * ເປັນ **ຊື່ຜູ້ໃຊ້** ('Xiew', 'Mee', 'sak') **ປົນກັບ** ລະຫັດພະນັກງານ ERP ('22040').
     * ຖ້າໃຫ້ເລືອກຜູ້ຮັບຈາກ employee_code ຂອງ ERP (25069) ຄ່າຈະຢູ່ຄົນລະ namespace
     * ກັບ tech_code/emp_code ⇒ ລາຍງານຈັດກຸ່ມເງິນບໍ່ຕົງກັນ ແລະ ເງິນຂອງບາງຄົນຫາຍ.
     * ⇒ ໃຊ້ namespace ອັນດຽວກັບທີ່ງານໃຊ້ຈິງ.
     */
    query<Option>(
      `select code, coalesce(nullif(name_1,''), username, code) as name
         from users where coalesce(code,'') <> '' order by name_1, code`,
    ),
  ]);

  // ຊື່ຂອງ ໝວດ/ແບບ/ຂະໜາດ — ຈັບຄູ່ຢູ່ຝັ່ງ app ເພາະ ODS ກັບ ERP ຄົນລະຖານ (join ຂ້າມບໍ່ໄດ້)
  const nameOf = (list: Option[], code: string | null) =>
    code ? (list.find((option) => option.code === code)?.name ?? code) : null;

  const rows: RateRow[] = rates.rows.map((rate) => ({
    ...rate,
    category_name: nameOf(options.categories, rate.category_code),
    design_name: nameOf(options.designs, rate.design_code),
    size_name: nameOf(options.sizes, rate.size_code),
  }));

  const splitOf = (workflow: Workflow): Record<string, number> => {
    const out: Record<string, number> = { supervisor: 0, team_lead: 0, admin: 0, technician: 0 };
    for (const row of splits.rows.filter((split) => split.workflow === workflow)) out[row.role] = Number(row.pct);
    return out;
  };
  const payeeOf = (workflow: Workflow, role: string) =>
    payees.rows.find((payee) => payee.workflow === workflow && payee.role === role)?.employee_code ?? "";

  return (
    <div className="w-full space-y-5">
      <PageTitle sub="ຄ່າບໍລິການ ແລະ ຄ່າຄອມຂອງຊ່າງ (ບາທ)">ກຳນົດຄ່າບໍລິການ</PageTitle>

      <AddRateForm categories={options.categories} designs={options.designs} sizes={options.sizes} />

      <Card title={`ອັດຕາທີ່ໃຊ້ຢູ່ (${rows.length})`}>
        {rows.length === 0 ? (
          <Empty>ຍັງບໍ່ມີອັດຕາ — ງານທີ່ປິດຈະຍັງບໍ່ຖືກຄິດຄ່າບໍລິການຈົນກວ່າຈະເພີ່ມອັດຕາ</Empty>
        ) : (
          <Table head={["ສາຍງານ", "ຄຳອະທິບາຍ", "ປະເພດບໍລິການ", "ໝວດ", "ແບບ", "ຂະໜາດ", "ບາທ", ""]} minWidth={900}>
            {rows.map((rate) => (
              <tr key={rate.id} className="border-b border-slate-100">
                <td className="whitespace-nowrap px-3 py-2 text-xs">
                  <span
                    className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                      rate.workflow === "install" ? "bg-violet-50 text-violet-700" : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {rate.workflow === "install" ? "ຕິດຕັ້ງ" : "ສ້ອມແປງ"}
                  </span>
                </td>
                <td className="px-3 py-2 text-xs font-medium text-slate-800">{rate.label}</td>
                {/* ຫວ່າງ = "ທຸກອັນ" — ສະແດງໃຫ້ຊັດ ບໍ່ດັ່ງນັ້ນຄົນອ່ານຄິດວ່າຂໍ້ມູນຂາດ */}
                <td className="px-3 py-2 text-xs text-slate-500">
                  {rate.service_type ? (SERVICE_TYPE_LABEL[rate.service_type] ?? rate.service_type) : "ທຸກອັນ"}
                </td>
                <td className="px-3 py-2 text-xs text-slate-500">{rate.category_name ?? "ທຸກອັນ"}</td>
                <td className="px-3 py-2 text-xs text-slate-500">{rate.design_name ?? "ທຸກອັນ"}</td>
                <td className="px-3 py-2 text-xs text-slate-500">{rate.size_name ?? "ທຸກອັນ"}</td>
                <td className="whitespace-nowrap px-3 py-2 text-xs font-bold text-slate-900">
                  {Number(rate.amount_thb).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                </td>
                <td className="px-3 py-2 text-center">
                  <DeactivateRateButton id={rate.id} label={rate.label} />
                </td>
              </tr>
            ))}
          </Table>
        )}
        <p className="mt-2 text-[11px] text-slate-400">
          ຕອນຄິດເງິນ ແຖວທີ່<b>ລະບຸລະອຽດກວ່າຊະນະ</b> (ຂະໜາດ &gt; ແບບ &gt; ໝວດ &gt; ປະເພດບໍລິການ)
        </p>
      </Card>

      <section className="grid gap-4 xl:grid-cols-2">
        <SplitForm workflow="repair" current={splitOf("repair")} />
        <SplitForm workflow="install" current={splitOf("install")} />
      </section>

      <Card title="ໃຜຮັບເງິນຂອງແຕ່ລະບົດບາດ">
        <p className="mb-3 text-xs text-slate-500">
          <b className="text-slate-700">{ROLE_LABEL.technician}</b> ບໍ່ຢູ່ໃນນີ້ — ເອົາຈາກງານເອງ (ຄົນທີ່ຮັບງານ)
          ຈຶ່ງບໍ່ມີທາງກຳນົດຜິດຄົນ. ບົດບາດອື່ນຖ້າ <b>ຍັງບໍ່ກຳນົດ</b> ເງິນຈະຖືກບັນທຶກໄວ້ແຕ່ຄ້າງລໍຜູ້ຮັບ (ບໍ່ຫາຍ).
        </p>
        <div className="grid gap-5 xl:grid-cols-2">
          {(["repair", "install"] as Workflow[]).map((workflow) => (
            <div key={workflow} className="space-y-2">
              <h3 className="text-xs font-bold text-slate-700">
                {workflow === "repair" ? "ສ້ອມແປງ" : "ຕິດຕັ້ງ"}
              </h3>
              {["supervisor", "team_lead", "admin"].map((role) => (
                <PayeeForm
                  key={role}
                  workflow={workflow}
                  role={role}
                  current={payeeOf(workflow, role)}
                  employees={employees.rows}
                />
              ))}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
