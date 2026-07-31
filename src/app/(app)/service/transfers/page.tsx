import { ReceiveTransferButton } from "@/components/service/receive-transfer-button";
import { LinkPending } from "@/components/link-pending";
import { PageTitle } from "@/components/ui";
import { requireRoleOrRedirect } from "@/lib/guard";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getLocale } from "@/lib/i18n/locale";
import { pendingTransfers } from "@/lib/job-center";
import { centerLabel } from "@/lib/repair-center";
import { STOCK_COUNT_SIDE } from "@/lib/roles";
import { PackageCheck } from "lucide-react";
import Link from "next/link";

/**
 * **ລໍຮັບໂອນເຄື່ອງ** — ເຄື່ອງທີ່ໂອນຂ້າມສູນ (ຂົວຫຼວງ ↔ ດອນຕີ້ວ) ແລະ ປາຍທາງຍັງບໍ່ກົດຮັບ.
 *
 * ແຕ່ກ່ອນການໂອນຢູ່ໃນ modal ຂອງໜ້າ**ກວດນັບສະຕັອກ**ບ່ອນດຽວ ⇒ ໂອນແລ້ວບໍ່ມີບ່ອນເຕືອນວ່າ
 * ປາຍທາງຕ້ອງກົດ "ຮັບເຂົ້າ" ⇒ ເຄື່ອງລອຍຢູ່ລະຫວ່າງທາງໂດຍບໍ່ມີໃຜຮູ້ (ຂໍ້ມູນຈິງ 31-07-2026:
 * ods_job_transfer 0 ແຖວ — ຄວາມສາມາດນີ້ມີແຕ່ບໍ່ເຄີຍຖືກໃຊ້).
 */
export const dynamic = "force-dynamic";

export default async function JobTransfersPage() {
  await requireRoleOrRedirect(STOCK_COUNT_SIDE);
  const t = (await getDictionary(await getLocale())).jobTransfer;
  const rows = await pendingTransfers();

  return (
    <div className="w-full space-y-4">
      <PageTitle sub={t.pageSub}>{t.pageTitle}</PageTitle>

      {rows.length === 0 ? (
        <div className="grid place-items-center gap-2 rounded-xl border border-slate-200 bg-white p-10 text-sm text-slate-400 shadow-sm">
          <PackageCheck className="size-6 text-emerald-500" />
          {t.empty}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="bg-slate-50 text-left text-xs text-slate-500">
              <tr>
                <th className="px-3 py-2">{t.colJob}</th>
                <th className="px-3 py-2">{t.colCustomer}</th>
                <th className="px-3 py-2">{t.colProduct}</th>
                <th className="px-3 py-2">{t.colFrom}</th>
                <th className="px-3 py-2">{t.colTo}</th>
                <th className="px-3 py-2">{t.colReason}</th>
                <th className="px-3 py-2">{t.colSent}</th>
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
                  <td className="px-3 py-2 text-xs text-slate-600">
                    {row.product || "-"}
                    {row.sn && <span className="block text-slate-400">S/N {row.sn}</span>}
                  </td>
                  <td className="px-3 py-2 text-xs">{centerLabel(row.from_center)}</td>
                  <td className="px-3 py-2 text-xs font-semibold text-slate-800">{centerLabel(row.to_center)}</td>
                  <td className="max-w-64 px-3 py-2 text-xs text-slate-500">{row.reason || "-"}</td>
                  <td className="px-3 py-2 text-xs text-slate-500">
                    {row.created_at}
                    <span className="block text-slate-400">{t.by} {row.created_by || "-"}</span>
                  </td>
                  <td className="px-3 py-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${row.days >= 3 ? "bg-red-100 text-red-700" : row.days >= 1 ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-600"}`}>
                      {row.days} {t.days}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <ReceiveTransferButton code={row.job_code} label={t.receive} busyLabel={t.receiving} />
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
