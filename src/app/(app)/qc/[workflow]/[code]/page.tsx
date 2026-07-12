import { canQc, qcChecklist } from "@/app/actions/qc";
import { Card, Empty, ErrorBox, PageTitle } from "@/components/ui";
import type { Workflow } from "@/lib/commission";
import { qcJob, WORKFLOW_LABEL } from "@/lib/qc";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { QcForm } from "./qc-form";

/**
 * ໜ້າກວດຮັບຄຸນນະພາບ ຂອງງານດຽວ.
 *
 * ດ່ານ 3 ຊັ້ນ (ຊັ້ນສຸດທ້າຍຢູ່ actions/qc.ts ຈຶ່ງລັດຜ່ານດ້ວຍ URL ບໍ່ໄດ້):
 *   ① ງານຕ້ອງຢູ່ຂັ້ນ "ລໍກວດຮັບຄຸນນະພາບ" ຈິງ — ບໍ່ດັ່ງນັ້ນ 404 (ກັນກວດຊ້ຳ/ກວດງານທີ່ຍັງບໍ່ຈົບ)
 *   ② role ຕ້ອງຢູ່ໃນ ods_qc_role ແລະ **ບໍ່ແມ່ນຄົນເຮັດງານນັ້ນເອງ**
 *   ③ ຕ້ອງມີລາຍການ checklist — ບໍ່ມີ = ຜ່ານ QC ດ້ວຍການບໍ່ກວດຫຍັງເລີຍ ຈຶ່ງກັນໄວ້
 */
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ workflow: string; code: string }> };

export default async function QcJobPage({ params }: Props) {
  const { workflow: raw, code } = await params;
  if (raw !== "install" && raw !== "repair") notFound();
  const workflow = raw as Workflow;

  const job = await qcJob(workflow, code);
  if (!job) notFound();

  if (!(await canQc(workflow, code))) redirect("/forbidden");

  const items = await qcChecklist(workflow, code);

  return (
    <div className="space-y-5">
      <PageTitle sub={`${WORKFLOW_LABEL[workflow]} · ${code}`}>ກວດຮັບຄຸນນະພາບ</PageTitle>

      <Link href="/qc" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
        <ArrowLeft className="size-4" /> ກັບຄິວ QC
      </Link>

      <Card title="ຂໍ້ມູນງານ">
        <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          <Field label="ລູກຄ້າ" value={job.customer} />
          <Field label="ສິນຄ້າ" value={[job.item, job.detail].filter(Boolean).join(" · ")} />
          <Field label="ຊ່າງຜູ້ເຮັດ" value={job.worker} />
          <Field label="ສຳເລັດເມື່ອ" value={job.finished_at} />
        </dl>
      </Card>

      <Card title={`ລາຍການທີ່ຕ້ອງກວດ (${items.length})`}>
        {items.length === 0 ? (
          <div className="space-y-3">
            <ErrorBox>
              ຍັງບໍ່ໄດ້ຕັ້ງລາຍການກວດຮັບຂອງສາຍງານນີ້ — ຜ່ານ QC ບໍ່ໄດ້ຈົນກວ່າຜູ້ຈັດການຈະຕັ້ງລາຍການໃຫ້ກ່ອນ.
            </ErrorBox>
            <Empty>
              <Link href="/manage/qc-checklist" className="font-semibold text-teal-700 hover:underline">
                ໄປໜ້າຕັ້ງລາຍການກວດຮັບ
              </Link>
            </Empty>
          </div>
        ) : (
          <QcForm workflow={workflow} jobCode={code} items={items} />
        )}
      </Card>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex gap-2">
      <dt className="w-28 shrink-0 text-slate-500">{label}</dt>
      <dd className="font-semibold text-slate-700">{value?.trim() ? value : "-"}</dd>
    </div>
  );
}
