import { qcWorkflows } from "@/app/actions/qc";
import { Elapsed } from "@/components/elapsed";
import { LinkPending } from "@/components/link-pending";
import { Card, Empty, PageTitle, Table } from "@/components/ui";
import { getSession } from "@/lib/auth";
import type { Workflow } from "@/lib/commission";
import { elapsedTone } from "@/lib/elapsed-tone";
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
  const [{ workflow: wanted }, session, workflows] = await Promise.all([
    searchParams,
    getSession(),
    qcWorkflows(),
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

  return (
    <div className="space-y-6">
      <PageTitle sub="ງານທີ່ຊ່າງເຮັດສຳເລັດແລ້ວ ລໍຖ້າກວດຮັບກ່ອນສົ່ງມອບລູກຄ້າ">ກວດຮັບຄຸນນະພາບ (QC)</PageTitle>

      {queues.map(({ workflow, rows }) => (
        <QcQueueCard key={workflow} workflow={workflow} rows={rows} me={session?.username ?? ""} />
      ))}
    </div>
  );
}

function QcQueueCard({
  workflow,
  rows,
  me,
}: {
  workflow: Workflow;
  rows: QcQueueRow[];
  me: string;
}) {
  return (
    <Card
      title={
        <span className="inline-flex items-center gap-2">
          <ShieldCheck className="size-4 text-teal-600" />
          {WORKFLOW_LABEL[workflow]}
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
            {rows.length}
          </span>
        </span>
      }
    >
      {rows.length === 0 ? (
        <Empty>ບໍ່ມີງານລໍກວດຮັບ</Empty>
      ) : (
        <Table head={["ລະຫັດງານ", "ລູກຄ້າ", "ສິນຄ້າ", "ຊ່າງ", "ສຳເລັດເມື່ອ", "ຄ້າງ", ""]} minWidth={900}>
          {rows.map((row) => {
            const mine = !!row.worker && row.worker === me;
            return (
              <tr key={row.code} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="px-3 py-2 text-center font-semibold text-slate-700">{row.code}</td>
                <td className="px-3 py-2">{row.customer ?? "-"}</td>
                <td className="px-3 py-2">
                  {row.item ?? "-"}
                  {row.detail?.trim() && <span className="block text-xs text-slate-400">{row.detail}</span>}
                </td>
                <td className="px-3 py-2 text-center">{row.worker ?? "-"}</td>
                <td className="px-3 py-2 text-center whitespace-nowrap">{row.finished_at ?? "-"}</td>
                <td className="px-3 py-2 text-center">
                  <Elapsed
                    seconds={row.elapsed_seconds}
                    className={`rounded-full px-2 py-0.5 text-xs font-semibold ${elapsedTone(row.elapsed_seconds).chip}`}
                  />
                </td>
                <td className="px-3 py-2 text-center">
                  {mine ? (
                    // ຄົນເຮັດກວດຂອງຕົນເອງບໍ່ໄດ້ — ບອກເຫດຜົນໄວ້ບ່ອນນີ້ ບໍ່ໃຫ້ກົດແລ້ວຄ່ອຍຖືກປະຕິເສດ
                    <span className="text-xs text-slate-400">ງານຂອງທ່ານ — ຕ້ອງໃຫ້ຄົນອື່ນກວດ</span>
                  ) : (
                    <Link
                      href={`/qc/${workflow}/${row.code}`}
                      className="inline-flex h-8 items-center gap-1 rounded-lg bg-teal-600 px-3 text-xs font-semibold text-white hover:bg-teal-700"
                    >
                      <LinkPending className="size-3.5" />
                      <ClipboardCheck className="size-3.5" />
                      {row.checked > 0 ? "ກວດຕໍ່" : "ກວດຮັບ"}
                    </Link>
                  )}
                </td>
              </tr>
            );
          })}
        </Table>
      )}
    </Card>
  );
}
