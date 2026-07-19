import { type Option, payeeOptions, rateOptions } from "@/app/actions/service-rate";
import { Card } from "@/components/ui";
import { ROLE_LABEL, type Workflow } from "@/lib/commission";
import { query } from "@/lib/db";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getLocale } from "@/lib/i18n/locale";
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
  PS: "ໄປຮັບເຄື່ອງທີ່ບ້ານລູກຄ້າມາສ້ອມຢູ່ສູນ",
};

export default async function ServiceRatesPage() {
  const t = (await getDictionary(await getLocale())).serviceRatesPage;
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
    // ຜູ້ຮັບເງິນ — ຝ່າຍບໍລິການ ຂອງ ERP (ເບິ່ງໝາຍເຫດເລື່ອງຕົວຕົນໃນ actions/service-rate)
    payeeOptions(),
  ]);

  // ຊື່ໝວດ — ຈັບຄູ່ຢູ່ຝັ່ງ app ເພາະ ODS ກັບ ERP ຄົນລະຖານ (join ຂ້າມບໍ່ໄດ້).
  // ແບບ/ຂະໜາດ ບໍ່ໂຫຼດມາທັງໝົດອີກແລ້ວ (56 + 489 ແຖວ) ⇒ ຕາຕະລາງສະແດງລະຫັດ
  // ພ້ອມຄຳອະທິບາຍທີ່ຄົນປ້ອນ (label) ເຊິ່ງບອກຂະໜາດຢູ່ແລ້ວ.
  const nameOf = (list: Option[], code: string | null) =>
    code ? (list.find((option) => option.code === code)?.name ?? code) : null;

  const rows: RateRow[] = rates.rows.map((rate) => ({
    ...rate,
    category_name: nameOf(options.categories, rate.category_code),
    design_name: rate.design_code,
    size_name: rate.size_code,
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
      <div>
        <h1 className="text-xl font-bold text-slate-700">{t.pageTitle}</h1>
        <p className="mt-0.5 text-xs text-slate-500">{t.pageSubtitle}</p>
      </div>

      <AddRateForm categories={options.categories} />

      <div className="space-y-2">
        <h2 className="text-sm font-bold text-slate-700">
          {t.activeRates} ({rows.length})
        </h2>
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-xs" style={{ minWidth: 900 }}>
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-slate-600">
                  <th className="whitespace-nowrap px-3 py-2.5 font-semibold">{t.colWorkflow}</th>
                  <th className="whitespace-nowrap px-3 py-2.5 font-semibold">{t.colLabel}</th>
                  <th className="whitespace-nowrap px-3 py-2.5 font-semibold">{t.colServiceType}</th>
                  <th className="whitespace-nowrap px-3 py-2.5 font-semibold">{t.colCategory}</th>
                  <th className="whitespace-nowrap px-3 py-2.5 font-semibold">{t.colDesign}</th>
                  <th className="whitespace-nowrap px-3 py-2.5 font-semibold">{t.colSize}</th>
                  <th className="whitespace-nowrap px-3 py-2.5 font-semibold">{t.colAmount}</th>
                  <th className="px-3 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {rows.map((rate) => (
                  <tr key={rate.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="whitespace-nowrap px-3 py-2.5 text-xs">
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                          rate.workflow === "install" ? "bg-violet-50 text-violet-700" : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {rate.workflow === "install" ? t.workflowInstall : t.workflowRepair}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-xs font-medium text-slate-800">{rate.label}</td>
                    {/* ຫວ່າງ = "ທຸກອັນ" — ສະແດງໃຫ້ຊັດ ບໍ່ດັ່ງນັ້ນຄົນອ່ານຄິດວ່າຂໍ້ມູນຂາດ */}
                    <td className="px-3 py-2.5 text-xs text-slate-500">
                      {rate.service_type ? (SERVICE_TYPE_LABEL[rate.service_type] ?? rate.service_type) : t.all}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-slate-500">{rate.category_name ?? t.all}</td>
                    <td className="px-3 py-2.5 text-xs text-slate-500">{rate.design_name ?? t.all}</td>
                    <td className="px-3 py-2.5 text-xs text-slate-500">{rate.size_name ?? t.all}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-xs font-bold text-slate-900">
                      {Number(rate.amount_thb).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <DeactivateRateButton id={rate.id} label={rate.label} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {rows.length === 0 && (
            <p className="py-12 text-center text-xs text-slate-400">{t.noRates}</p>
          )}
        </section>
        <p className="text-[11px] text-slate-400">
          {t.priorityHintPrefix}
          <b>{t.priorityHintBold}</b> {t.priorityHintSuffix}
        </p>
      </div>

      <section className="grid gap-4 xl:grid-cols-2">
        <SplitForm workflow="repair" current={splitOf("repair")} />
        <SplitForm workflow="install" current={splitOf("install")} />
      </section>

      <Card title={t.cardTitle}>
        <p className="mb-3 text-xs text-slate-500">
          <b className="text-slate-700">{ROLE_LABEL.technician}</b> {t.payeeHintMid} <b>{t.payeeHintUndefined}</b>{" "}
          {t.payeeHintTail}
        </p>
        <div className="grid gap-5 xl:grid-cols-2">
          {(["repair", "install"] as Workflow[]).map((workflow) => (
            <div key={workflow} className="space-y-2">
              <h3 className="text-xs font-bold text-slate-700">
                {workflow === "repair" ? t.workflowRepair : t.workflowInstall}
              </h3>
              {["supervisor", "team_lead", "admin"].map((role) => (
                <PayeeForm
                  key={role}
                  workflow={workflow}
                  role={role}
                  current={payeeOf(workflow, role)}
                  employees={employees}
                />
              ))}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
