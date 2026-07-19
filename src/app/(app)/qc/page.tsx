import { qcWorkflows } from "@/app/actions/qc";
import { Elapsed } from "@/components/elapsed";
import { LinkPending } from "@/components/link-pending";
import { MobileCardList } from "@/components/mobile-card-list";
import { getSession } from "@/lib/auth";
import type { Workflow } from "@/lib/commission";
import { elapsedTone } from "@/lib/elapsed-tone";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getLocale } from "@/lib/i18n/locale";
import { qcQueue, WORKFLOW_LABEL, type QcQueueRow } from "@/lib/qc";
import { ClipboardCheck, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

/**
 * ຄິວກວດຮັບຄຸນນະພາບ — ດ່ານກ່ອນສົ່ງມອບລູກຄ້າ.
 *
 * ເຫັນສະເພາະສາຍງານທີ່ role ຂອງຕົນຖືກກຳນົດໃຫ້ກວດ (ods_qc_role — ຜູ້ຈັດການຕັ້ງທີ່
 * /manage/qc-checklist). ບໍ່ຖືກກຳນົດຈັກສາຍງານ = ເຂົ້າໜ້ານີ້ບໍ່ໄດ້.
 *
 * ງານຂອງຕົນເອງຂຶ້ນຢູ່ໃນຄິວຄືກັນ ແຕ່ **ກົດເຂົ້າກວດບໍ່ໄດ້** — ຄົນເຮັດກວດຮັບຂອງຕົນເອງ
 * ບໍ່ໄດ້ ບໍ່ດັ່ງນັ້ນດ່ານນີ້ບໍ່ມີຄວາມໝາຍ (ບັງຄັບຈິງຢູ່ actions/qc.ts ອີກຊັ້ນ).
 */
export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ workflow?: string }> };

export default async function QcPage({ searchParams }: Props) {
  const [{ workflow: wanted }, session, workflows, t] = await Promise.all([
    searchParams,
    getSession(),
    qcWorkflows(),
    getDictionary(await getLocale()).then((d) => d.qcPage),
  ]);
  if (workflows.length === 0) redirect("/forbidden");

  /**
   * ── ເຂົ້າຈາກເມນູ **ຕິດຕັ້ງ** ເຫັນສະເພາະງານຕິດຕັ້ງ · ເຂົ້າຈາກ **ສ້ອມແປງ** ເຫັນສະເພາະງານສ້ອມ ──
   * ໜ້າດຽວກັນ ແຕ່ QC ຄື **ຂັ້ນຕອນຂອງແຕ່ລະສາຍງານ** ⇒ ສະແດງທັງສອງພ້ອມກັນ
   * ເຮັດໃຫ້ຄົນທີ່ມາຈາກສາຍງານນຶ່ງ ຕ້ອງເລື່ອນຜ່ານຄິວຂອງອີກສາຍງານ (ຫຼື ຫຼົງວ່າຄິວຫວ່າງ).
   * ບໍ່ລະບຸ ?workflow ⇒ ສະແດງທຸກສາຍງານທີ່ຄົນນີ້ກວດໄດ້ (ຄືເກົ່າ).
   */
  const shown = workflows.filter((workflow) => !wanted || workflow === wanted);

  const queues = await Promise.all(
    shown.map(async (workflow) => ({ workflow, rows: await qcQueue(workflow) })),
  );

  const total = queues.reduce((sum, { rows }) => sum + rows.length, 0);

  return (
    <div className="w-full space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-700">{t.title}</h1>
        <p className="mt-0.5 text-xs text-slate-500">
          {t.subtitle} · {total.toLocaleString()} {t.items}
        </p>
      </div>

      {queues.map(({ workflow, rows }) => (
        <QcQueueCard key={workflow} workflow={workflow} rows={rows} me={session?.username ?? ""} t={t} />
      ))}
    </div>
  );
}

function QcQueueCard({
  workflow,
  rows,
  me,
  t,
}: {
  workflow: Workflow;
  rows: QcQueueRow[];
  me: string;
  t: Record<string, string>;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2.5">
        <ShieldCheck className="size-4 text-teal-600" />
        <span className="text-sm font-semibold text-slate-700">{WORKFLOW_LABEL[workflow]}</span>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
          {rows.length}
        </span>
      </div>

      {/* Desktop: ຕາຕະລາງເຕັມ (ເຊື່ອງໃນມືຖື) */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[900px] border-collapse text-xs">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left text-slate-600">
              <th className="whitespace-nowrap px-3 py-2.5 font-semibold">{t.colCode}</th>
              <th className="whitespace-nowrap px-3 py-2.5 font-semibold">{t.customer}</th>
              <th className="whitespace-nowrap px-3 py-2.5 font-semibold">{t.item}</th>
              <th className="whitespace-nowrap px-3 py-2.5 font-semibold">{t.technician}</th>
              <th className="whitespace-nowrap px-3 py-2.5 font-semibold">{t.finishedAt}</th>
              <th className="whitespace-nowrap px-3 py-2.5 font-semibold">{t.pending}</th>
              <th className="px-3 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const mine = !!row.worker && row.worker === me;
              return (
                <tr key={row.code} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-3 py-2.5 text-center font-semibold text-slate-700">{row.code}</td>
                  <td className="px-3 py-2.5">{row.customer ?? "-"}</td>
                  <td className="px-3 py-2.5">
                    {row.item ?? "-"}
                    {row.detail?.trim() && <span className="block text-xs text-slate-400">{row.detail}</span>}
                  </td>
                  <td className="px-3 py-2.5 text-center">{row.worker ?? "-"}</td>
                  <td className="px-3 py-2.5 text-center whitespace-nowrap">{row.finished_at ?? "-"}</td>
                  <td className="px-3 py-2.5 text-center">
                    <Elapsed
                      seconds={row.elapsed_seconds}
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${elapsedTone(row.elapsed_seconds).chip}`}
                    />
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    {mine ? (
                      // ຄົນເຮັດກວດຂອງຕົນເອງບໍ່ໄດ້ — ບອກເຫດຜົນໄວ້ບ່ອນນີ້ ບໍ່ໃຫ້ກົດແລ້ວຄ່ອຍຖືກປະຕິເສດ
                      <span className="text-xs text-slate-400">{t.mineNote}</span>
                    ) : (
                      <Link
                        href={`/qc/${workflow}/${row.code}`}
                        className="inline-flex h-8 items-center gap-1 rounded-lg bg-teal-600 px-3 text-xs font-semibold text-white hover:bg-teal-700"
                      >
                        <LinkPending className="size-3.5" />
                        <ClipboardCheck className="size-3.5" />
                        {row.checked > 0 ? t.continueCheck : t.check}
                      </Link>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile: ບັດຊ້ອນ (ໃຊ້ action ດຽວກັນກັບ desktop) */}
      <div className="p-2 md:hidden">
        <MobileCardList className="space-y-2">
        {rows.map((row) => {
          const mine = !!row.worker && row.worker === me;
          return (
            <div key={row.code} className="rounded-xl border border-slate-200 bg-white p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-slate-700">{row.code}</span>
                <Elapsed
                  seconds={row.elapsed_seconds}
                  className={`rounded-full px-2 py-0.5 text-xs font-semibold ${elapsedTone(row.elapsed_seconds).chip}`}
                />
              </div>
              <p className="mt-1 text-sm text-slate-700">
                {row.item ?? "-"}
                {row.detail?.trim() && <span className="block text-xs text-slate-400">{row.detail}</span>}
              </p>
              <dl className="mt-1.5 space-y-0.5 text-xs text-slate-500">
                <div className="flex gap-1">
                  <dt className="text-slate-400">{t.customer}:</dt>
                  <dd className="text-slate-600">{row.customer ?? "-"}</dd>
                </div>
                <div className="flex gap-1">
                  <dt className="text-slate-400">{t.technician}:</dt>
                  <dd className="text-slate-600">{row.worker ?? "-"}</dd>
                </div>
                <div className="flex gap-1">
                  <dt className="text-slate-400">{t.finishedAt}:</dt>
                  <dd className="text-slate-600">{row.finished_at ?? "-"}</dd>
                </div>
              </dl>
              <div className="mt-2">
                {mine ? (
                  // ຄົນເຮັດກວດຂອງຕົນເອງບໍ່ໄດ້ — ບອກເຫດຜົນໄວ້ບ່ອນນີ້ ບໍ່ໃຫ້ກົດແລ້ວຄ່ອຍຖືກປະຕິເສດ
                  <span className="text-xs text-slate-400">{t.mineNote}</span>
                ) : (
                  <Link
                    href={`/qc/${workflow}/${row.code}`}
                    className="inline-flex h-9 items-center gap-1 rounded-lg bg-teal-600 px-3 text-xs font-semibold text-white hover:bg-teal-700"
                  >
                    <LinkPending className="size-3.5" />
                    <ClipboardCheck className="size-3.5" />
                    {row.checked > 0 ? "ກວດຕໍ່" : "ກວດຮັບ"}
                  </Link>
                )}
              </div>
            </div>
          );
        })}
        </MobileCardList>
      </div>

      {rows.length === 0 && <p className="py-12 text-center text-xs text-slate-400">{t.emptyQueue}</p>}
    </section>
  );
}
