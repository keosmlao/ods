import { JOB_HEAD_COLUMNS, JobHeader, type JobHead } from "@/components/installation/job-header";
import { SpareRequestForm, type SpareLine } from "@/components/installation/spare-request-form";
import { Card, Empty, PageTitle, Table } from "@/components/ui";
import { query, queryOdg } from "@/lib/db";
import { notFound } from "next/navigation";

/** ຖອດແບບຈາກ ods: /in_add_req/<id> + req_page.html (tech_reg_install.py) */
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ code: string }> };

export default async function SpareRequestPage({ params }: Props) {
  const code = decodeURIComponent((await params).code);

  const [head, lines, standard, warehouses] = await Promise.all([
    query<JobHead>(
      `select ${JOB_HEAD_COLUMNS}
       from ods_tb_install a
       left join ar_customer c on c.code = a.cust_code
       where a.code = $1 limit 1`,
      [code],
    ),
    query<SpareLine>(
      `select roworder, item_code, item_name, round(qty,0) as qty, unit_code
       from tb_used_spare where product_code = $1 order by roworder asc`,
      [code],
    ),
    query<{ rnum: string; item_code: string; item_name: string; qty: string; unit_code: string | null }>(
      `select row_number() over (order by line_number asc) as rnum, item_code, item_name, round(qty,2) as qty, unit_code
       from ods_tb_install_detail where code = $1 order by line_number asc`,
      [code],
    ),
    queryOdg<{ code: string; name_1: string }>(
      `select code, name_1 from ic_warehouse where code in ('1103','1104','1204','1203','1206') order by code asc`,
    ),
  ]);

  if (!head.rows[0]) notFound();
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="w-full space-y-5">
      <PageTitle>ໃບຂໍເບີກຕິດຕັ້ງ</PageTitle>
      <JobHeader head={head.rows[0]} />

      <Card title="ອຸປະກອນຕິດຕັ້ງມາດຕະຖານ">
        {standard.rows.length === 0 ? (
          <Empty />
        ) : (
          <Table head={["ລຳດັບ", "ລະຫັດ", "ຊື່ອຸປະກອນ", "ຈຳນວນ", "ຫົວໜ່ວຍ"]} minWidth={700}>
            {standard.rows.map((row) => (
              <tr key={`${row.item_code}-${row.rnum}`} className="border-b border-slate-100">
                <td className="px-3 py-2 text-center">{row.rnum}</td>
                <td className="whitespace-nowrap px-3 py-2">{row.item_code}</td>
                <td className="px-3 py-2">{row.item_name}</td>
                <td className="px-3 py-2 text-center">{Number(row.qty)}</td>
                <td className="px-3 py-2 text-center">{row.unit_code}</td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      <SpareRequestForm code={code} today={today} lines={lines.rows} warehouses={warehouses.rows} />
    </div>
  );
}
