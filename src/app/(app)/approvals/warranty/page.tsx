import { WarrantyDecideButtons } from "@/components/approvals/warranty-decide";
import { LinkPending } from "@/components/link-pending";
import { PageTitle } from "@/components/ui";
import { requireRoleOrRedirect } from "@/lib/guard";
import { APPROVER_SIDE } from "@/lib/roles";
import { warrantyQueue } from "@/lib/warranty-request";
import { ShieldAlert } from "lucide-react";
import Link from "next/link";

/**
 * **ຄິວອະນຸມັດ ປ່ຽນສະຖານະການຮັບປະກັນ**.
 *
 * ຊ່າງກົດ "ໝົດຮັບປະກັນ" ຕອນກວດເຊັກ = **ຄຳຂໍ** (lib/tech-flow) ເພາະມັນຕັດສິນວ່າ
 * ລູກຄ້າຕ້ອງຈ່າຍ ຫຼື ບໍ່. ໃບ **ໄປຕໍ່ບໍ່ໄດ້** ຈົນກວ່າຈະຕັດສິນຢູ່ໜ້ານີ້.
 */
export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ tab?: string }> };

const TABS = [
  { key: "pending", label: "ລໍອະນຸມັດ" },
  { key: "approved", label: "ອະນຸມັດແລ້ວ" },
  { key: "rejected", label: "ບໍ່ອະນຸມັດ" },
] as const;

export default async function WarrantyApprovalsPage({ searchParams }: Props) {
  await requireRoleOrRedirect(APPROVER_SIDE);
  const tab = (await searchParams).tab;
  const state = tab === "approved" || tab === "rejected" ? tab : "pending";
  const rows = await warrantyQueue(state);

  return (
    <div className="w-full space-y-4">
      <PageTitle sub="ຊ່າງຂໍປ່ຽນເປັນ “ໝົດຮັບປະກັນ” = ລູກຄ້າຕ້ອງຈ່າຍ ⇒ ຕ້ອງອະນຸມັດກ່ອນ ງານຈຶ່ງໄປຕໍ່ໄດ້">
        ອະນຸມັດປ່ຽນສະຖານະການຮັບປະກັນ
      </PageTitle>

      <div className="flex w-fit overflow-hidden rounded-lg border border-slate-300 bg-white">
        {TABS.map(({ key, label }) => (
          <Link
            key={key}
            href={key === "pending" ? "/approvals/warranty" : `/approvals/warranty?tab=${key}`}
            className={`inline-flex h-9 items-center gap-1.5 border-l border-slate-300 px-3 text-xs font-medium first:border-l-0 ${
              state === key ? "bg-brand-900 text-white" : "bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            {label}
            <LinkPending className="size-3" />
          </Link>
        ))}
      </div>

      {rows.length === 0 ? (
        <p className="rounded-xl border border-brand-200 bg-brand-50/50 p-6 text-center text-sm font-semibold text-brand-800">
          ບໍ່ມີຄຳຂໍໃນກຸ່ມນີ້
        </p>
      ) : (
        <ul className="space-y-3">
          {rows.map((row) => (
            <li key={row.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-sm font-bold text-slate-800">
                    <ShieldAlert className="size-4 text-brand-900" />
                    <Link href={`/service/${row.job_code}`} className="hover:underline">
                      #{row.job_code}
                    </Link>
                    <span className="text-slate-400">·</span>
                    <span className="font-normal text-slate-600">{row.product ?? "-"}</span>
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {row.customer ?? "-"}
                    {row.tech && <span className="ml-2 text-slate-400">· ຊ່າງ {row.tech}</span>}
                  </p>
                  <p className="mt-2 text-xs">
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 font-semibold text-slate-600">
                      {row.from_warranty}
                    </span>
                    <span className="mx-1.5 text-slate-400">→</span>
                    <span className="rounded bg-brand-orange-300 px-1.5 py-0.5 font-semibold text-brand-900">
                      {row.to_warranty}
                    </span>
                  </p>
                  {/* ເຫດຜົນຄືຫຼັກຖານເມື່ອລູກຄ້າຄ້ານ ⇒ ສະແດງເຕັມ ບໍ່ຕັດ */}
                  <p className="mt-2 whitespace-pre-wrap rounded-lg bg-slate-50 p-2.5 text-xs text-slate-700">
                    {row.reason}
                  </p>
                  <p className="mt-1.5 text-[11px] text-slate-400">
                    ຂໍໂດຍ {row.requested_by} · {row.requested_at}
                    {row.age_days > 0 && <span className="ml-1 font-semibold text-brand-900">· ຄ້າງ {row.age_days} ມື້</span>}
                    {row.decided_by && (
                      <span className="ml-2">
                        · ຕັດສິນໂດຍ {row.decided_by} {row.decided_at}
                        {row.decide_note ? ` · ${row.decide_note}` : ""}
                      </span>
                    )}
                  </p>
                </div>

                {state === "pending" && <WarrantyDecideButtons id={row.id} />}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
