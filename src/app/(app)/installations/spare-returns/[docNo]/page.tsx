import { ReturnRequestForm, type DraftLine } from "@/app/(app)/installations/spare-returns/[docNo]/return-request-form";
import { JOB_HEAD_COLUMNS, JobHeader, type JobHead } from "@/components/installation/job-header";
import { PageTitle } from "@/components/ui";
import { getSession } from "@/lib/auth";
import { query } from "@/lib/db";
import { canViewAssignedJob } from "@/lib/scope";
import { LINE_STATUS, TRANS } from "@/lib/stock-constants";
import { notFound, redirect } from "next/navigation";

/**
 * ໜ້າ "ໃບຂໍສົ່ງຄືນອາໄຫຼ່" ຂອງງານຕິດຕັ້ງ.
 * ຖອດແບບຈາກ ods: /show_return_req_inst/<doc_no> + templates/stock/return_req_page_inst.html
 * (tech_install.py:663). ພາຣາມິເຕີ docNo = ເລກໃບເບີກ SWC.
 *
 * ແຖວຮ່າງຖືກສ້າງໂດຍ action startInstallReturnRequest (ods: /return_req_check_inst).
 * ຖ້າມາຮອດໜ້ານີ້ໂດຍຍັງບໍ່ມີແຖວຮ່າງ (ເຊັ່ນ: refresh ຫຼັງບັນທຶກ) → ກັບໄປໜ້າລາຍການ
 * ແທນທີ່ຈະໂຊ້ໜ້າເປົ່າຄືກັບ ods.
 */
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ docNo: string }> };

export default async function InstallReturnRequestPage({ params }: Props) {
  const session = await getSession();
  if (!session) redirect("/login");
  const docNo = decodeURIComponent((await params).docNo);

  const doc = await query<{ product_code: string; doc_date: string | null }>(
    "select product_code, to_char(doc_date,'DD-MM-YYYY') doc_date from ic_trans where doc_no=$1 and trans_flag=$2 and job_type='install' limit 1",
    [docNo, TRANS.DISPATCH],
  );
  const head = doc.rows[0];
  if (!head) notFound();

  const [job, draft] = await Promise.all([
    query<JobHead>(
      `select ${JOB_HEAD_COLUMNS}
       from ods_tb_install a
       left join ar_customer c on c.code = a.cust_code
       where a.code = $1 limit 1`,
      [head.product_code],
    ),
    // max_qty = ຈຳນວນທີ່ເບີກອອກໄປຈິງ (ic_trans_detail ຂອງໃບ SWC) — ໃຊ້ຈຳກັດຈຳນວນສົ່ງຄືນ
    query<DraftLine>(
      `select dr.roworder, dr.item_code, dr.item_name, dr.qty, dr.unit_code, d.qty max_qty
       from ic_trans_detail_draft dr
       left join ic_trans_detail d on d.roworder = dr.row_ref
       where dr.doc_no=$1 and dr.user_created=$2 and dr.trans_flag=$3
       order by dr.roworder asc`,
      [docNo, session.username, TRANS.DRAFT],
    ),
  ]);

  if (!job.rows[0]) notFound();
  if (!canViewAssignedJob(session, job.rows[0].tech_code)) redirect("/forbidden");
  if (draft.rows.length === 0) {
    // ບໍ່ມີແຖວຮ່າງ — ອາດບັນທຶກໄປແລ້ວ ຫຼື ຊ່າງຍັງບໍ່ທັນຮັບອາໄຫຼ່ (ຍັງບໍ່ມີແຖວ status=1)
    const issued = await query<{ count: number }>(
      "select count(*)::int count from ic_trans_detail where doc_no=$1 and status=$2",
      [docNo, LINE_STATUS.ISSUED],
    );
    if (!issued.rows[0]?.count) redirect("/stock/returns?job=install");
  }

  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });

  return (
    <div className="w-full space-y-5">
      <PageTitle sub={`ເລກທີໃບເບີກ ${docNo} · ວັນທີ ${head.doc_date ?? "-"}`}>ໃບຂໍສົ່ງຄືນອາໄຫຼ່ (ຕິດຕັ້ງ)</PageTitle>

      <JobHeader head={job.rows[0]} />

      <ReturnRequestForm
        docRef={docNo}
        productCode={head.product_code}
        today={today}
        lines={draft.rows}
      />
    </div>
  );
}
