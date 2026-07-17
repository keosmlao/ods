import { savePickSpare } from "@/app/actions/installation";
import { DocSaveForm } from "@/components/installation/doc-save-form";
import { JOB_HEAD_COLUMNS, JobHeader, type JobHead } from "@/components/installation/job-header";
import { Card, Empty, PageTitle, Table } from "@/components/ui";
import { getSession } from "@/lib/auth";
import { query } from "@/lib/db";
import { canViewAssignedJob } from "@/lib/scope";
import { notFound, redirect } from "next/navigation";

/** ຖອດແບບຈາກ ods: /pick_spare/<id> + /save_pick_spare (tech_reg_install.py) */
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ docNo: string }> };
type Line = { rnum: string; item_code: string; item_name: string; qty: string; unit_code: string | null };

export default async function PickSpareDetail({ params }: Props) {
  const docNo = decodeURIComponent((await params).docNo);
  const session = await getSession();
  if (!session) redirect("/login");

  const doc = await query<{ product_code: string }>(
    "select product_code from ic_trans where doc_no=$1 and trans_flag=56 and job_type='install' limit 1",
    [docNo],
  );
  if (!doc.rows[0]) notFound();
  const productCode = doc.rows[0].product_code;

  const [head, lines] = await Promise.all([
    query<JobHead>(
      `select ${JOB_HEAD_COLUMNS}
       from ods_tb_install a
       left join ar_customer c on c.code = a.cust_code
       where a.code = $1 limit 1`,
      [productCode],
    ),
    // ລາຍການທັງໝົດຂອງໃບເບີກ — ນິຍາມດຽວກັນກັບ savePickSpare (ໃບໜຶ່ງຮັບເທື່ອດຽວ, ຮັບໝົດໃບ).
    // ກ່ອນໜ້ານີ້ກອງ status = 0 ຢູ່ນີ້ ແຕ່ action ກອງດ້ວຍການ join tb_used_spare ⇒ ສອງບ່ອນບໍ່ຄືກັນ.
    query<Line>(
      `select row_number() over (order by a.roworder asc) as rnum, a.item_code, a.item_name, a.qty, a.unit_code
       from ic_trans_detail a
       where a.trans_flag = 56 and a.doc_no = $1
       order by a.roworder asc`,
      [docNo],
    ),
  ]);

  if (!head.rows[0]) notFound();
  if (!canViewAssignedJob(session, head.rows[0].tech_code)) redirect("/forbidden");
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="w-full space-y-5">
      <PageTitle sub={`ເລກທີເບີກ ${docNo}`}>ຮັບອາໄຫຼ່</PageTitle>
      <JobHeader head={head.rows[0]} />

      <Card title="ລາຍການອາໄຫຼ່">
        {lines.rows.length === 0 ? (
          <Empty>ບໍ່ມີລາຍການສຳລັບຮັບ!</Empty>
        ) : (
          <Table head={["ລຳດັບ", "ລະຫັດ", "ຊື່ອຸປະກອນ", "ຈຳນວນ", "ຫົວໜ່ວຍ"]} minWidth={700}>
            {lines.rows.map((line) => (
              <tr key={`${line.item_code}-${line.rnum}`} className="border-b border-slate-100">
                <td className="px-3 py-2 text-center">{line.rnum}</td>
                <td className="whitespace-nowrap px-3 py-2">{line.item_code}</td>
                <td className="px-3 py-2">{line.item_name}</td>
                <td className="px-3 py-2 text-center">{Number(line.qty)}</td>
                <td className="px-3 py-2 text-center">{line.unit_code}</td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      <DocSaveForm
        action={savePickSpare}
        docRef={docNo}
        productCode={productCode}
        today={today}
        backHref="/installations/spare-pickup"
        submitLabel="ຮັບອາໄຫຼ່"
        disabled={lines.rows.length === 0}
      />
    </div>
  );
}
