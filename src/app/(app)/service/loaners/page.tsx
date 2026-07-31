import { LinkPending } from "@/components/link-pending";
import { PageTitle } from "@/components/ui";
import { outstandingLoaners } from "@/lib/loaner";
import { requireRoleOrRedirect } from "@/lib/guard";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getLocale } from "@/lib/i18n/locale";
import { SERVICE_SIDE } from "@/lib/roles";
import { PackageCheck, Printer } from "lucide-react";
import Link from "next/link";

/**
 * **ເຄື່ອງສຳຮອງຄ້າງຄືນ** — ໜ່ວຍທີ່ສູນໃຫ້ລູກຄ້າໃຊ້ກ່ອນ ແລະ ຍັງບໍ່ໄດ້ຄືນ.
 *
 * ບໍ່ຕັດສະຕັອກ ERP (ເຄື່ອງຂອງສູນ) ⇒ ຖ້າບໍ່ມີໜ້ານີ້ ຈະບໍ່ມີບ່ອນໃດໃນລະບົບບອກໄດ້ວ່າ
 * ເຄື່ອງສູນຢູ່ບ້ານໃຜແດ່. ຮັບຄືນເຮັດຢູ່ໜ້າໃບງານ (ບ່ອນທີ່ມີບໍລິບົດຄົບ).
 */
export const dynamic = "force-dynamic";

export default async function LoanersPage() {
  await requireRoleOrRedirect(SERVICE_SIDE);
  const t = (await getDictionary(await getLocale())).loaner;
  const rows = await outstandingLoaners();

  return (
    <div className="w-full space-y-4">
      <PageTitle sub={t.pageSub}>{t.pageTitle}</PageTitle>

      {rows.length === 0 ? (
        <div className="grid place-items-center gap-2 rounded-xl border border-slate-200 bg-white p-10 text-sm text-slate-400 shadow-sm">
          <PackageCheck className="size-6 text-emerald-500" />
          {t.pageEmpty}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="bg-slate-50 text-left text-xs text-slate-500">
              <tr>
                <th className="px-3 py-2">{t.colJob}</th>
                <th className="px-3 py-2">{t.colCustomer}</th>
                <th className="px-3 py-2">{t.colProduct}</th>
                <th className="px-3 py-2">{t.colLoaner}</th>
                <th className="px-3 py-2">ISN</th>
                <th className="px-3 py-2">{t.colLent}</th>
                <th className="px-3 py-2">{t.colAge}</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-3 py-2">
                    <Link href={`/service/${row.job_code}`} className="font-semibold text-teal-700 hover:underline">
                      #{row.job_code}
                      <LinkPending className="ml-1 size-3" />
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {row.cust_name || "-"}
                    {row.tel && <span className="block text-slate-400">{row.tel}</span>}
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-600">{row.product || "-"}</td>
                  <td className="px-3 py-2 text-xs font-semibold text-slate-800">{row.item_name}</td>
                  <td className="px-3 py-2 text-xs">
                    {row.isn}
                    {row.sn && <span className="block text-slate-400">S/N {row.sn}</span>}
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-500">
                    {row.lend_time}
                    <span className="block text-slate-400">{t.by} {row.lend_by}</span>
                  </td>
                  <td className="px-3 py-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${row.days >= 30 ? "bg-red-100 text-red-700" : row.days >= 7 ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-600"}`}>
                      {row.days} {t.days}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <a
                      href={`/service/loaners/${row.id}/print`}
                      target="_blank"
                      rel="noreferrer"
                      title={t.printSlip}
                      className="text-[#D35400] hover:opacity-70"
                    >
                      <Printer className="size-4" />
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
