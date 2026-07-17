import { JOB_HEAD_COLUMNS, JobHeader, type JobHead } from "@/components/installation/job-header";
import { Card, Empty, LinkButton, PageTitle, Table } from "@/components/ui";
import { getSession } from "@/lib/auth";
import { query } from "@/lib/db";
import { canViewAssignedJob } from "@/lib/scope";
import { notFound, redirect } from "next/navigation";

/** ຖອດແບບຈາກ ods: /view_rc_spare/<id> (tech_reg_install.py) */
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ docNo: string }> };
type Line = { rnum: string; item_code: string; item_name: string; qty: string; unit_code: string | null };

export default async function ViewPickSpare({ params }: Props) {
  const session = await getSession();
  if (!session) redirect("/login");
  const docNo = decodeURIComponent((await params).docNo);

  const doc = await query<{ product_code: string; doc_ref: string | null; doc_date: string | null }>(
    "select product_code, doc_ref, to_char(doc_date,'DD-MM-YYYY') as doc_date from ic_trans where doc_no=$1 limit 1",
    [docNo],
  );
  if (!doc.rows[0]) notFound();

  const [head, lines] = await Promise.all([
    query<JobHead>(
      `select ${JOB_HEAD_COLUMNS}
       from ods_tb_install a
       left join ar_customer c on c.code = a.cust_code
       where a.code = $1 limit 1`,
      [doc.rows[0].product_code],
    ),
    query<Line>(
      `select row_number() over (order by a.roworder asc) as rnum, a.item_code, a.item_name, a.qty, a.unit_code
       from ic_trans_detail a
       where a.job_type = 'install' and a.doc_no = $1
       order by a.roworder asc`,
      [docNo],
    ),
  ]);

  if (!head.rows[0]) notFound();
  if (!canViewAssignedJob(session, head.rows[0].tech_code)) redirect("/forbidden");

  return (
    <div className="w-full space-y-5">
      <PageTitle sub={`ອ້າງອີງ ${doc.rows[0].doc_ref ?? "-"} · ວັນທີ ${doc.rows[0].doc_date ?? "-"}`}>
        ໃບຮັບອາໄຫຼ່ {docNo}
      </PageTitle>
      <JobHeader head={head.rows[0]} />

      <Card
        title="ລາຍການອາໄຫຼ່"
        actions={<LinkButton href="/installations/spare-pickup" tone="neutral">ກັບຄືນ</LinkButton>}
      >
        {lines.rows.length === 0 ? (
          <Empty />
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
    </div>
  );
}
