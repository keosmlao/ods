import { saveDispatch } from "@/app/actions/installation";
import { DocSaveForm } from "@/components/installation/doc-save-form";
import { JOB_HEAD_COLUMNS, JobHeader, type JobHead } from "@/components/installation/job-header";
import { Card, Empty, ErrorBox, PageTitle, Table } from "@/components/ui";
import { query } from "@/lib/db";
import { notFound } from "next/navigation";

/** ຖອດແບບຈາກ ods: /showdisp_install/<id> + /save_dispatch_install (tech_install.py) */
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ docNo: string }> };

type Line = {
  rnum: string;
  item_code: string;
  item_name: string;
  qty: string;
  unit_code: string | null;
  stock: string;
};

export default async function DispatchDetail({ params }: Props) {
  const docNo = decodeURIComponent((await params).docNo);

  const doc = await query<{ product_code: string }>(
    "select product_code from ic_trans where doc_no=$1 and trans_flag=122 limit 1",
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
    query<Line>(
      `select row_number() over (order by a.roworder asc) as rnum, a.item_code, a.item_name, a.qty, a.unit_code,
         coalesce(st.balance_qty,0) as stock
       from ic_trans_detail a
       left join ic_trans b on b.doc_no = a.doc_no
       left join get_odg_stock_balance('2099-12-31', a.item_code, b.wh_code, b.shelf_code) st on st.ic_code = a.item_code
       where a.doc_no = $1 and a.status in (0,5)
       order by a.roworder asc`,
      [docNo],
    ),
  ]);

  if (!head.rows[0]) notFound();

  const short = lines.rows.filter((line) => Number(line.qty) > Number(line.stock));
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="w-full space-y-5">
      <PageTitle sub={`ເລກຂໍເບີກ ${docNo}`}>ເບີກອາໄຫຼ່ອອກຈາກສາງ</PageTitle>
      <JobHeader head={head.rows[0]} />

      <Card title="ລາຍການອາໄຫຼ່">
        {lines.rows.length === 0 ? (
          <Empty>ບໍ່ມີລາຍການສຳລັບເບີກ!</Empty>
        ) : (
          <>
            {short.length > 0 && <ErrorBox>ຈຳນວນບໍ່ພຽງພໍສຳລັບເບີກອະໄຫຼ່!</ErrorBox>}
            <Table head={["ລຳດັບ", "ລະຫັດ", "ຊື່ອຸປະກອນ", "ຈຳນວນ", "ຫົວໜ່ວຍ", "ຄົງເຫຼືອໃນສາງ"]} minWidth={800}>
              {lines.rows.map((line) => {
                const enough = Number(line.qty) <= Number(line.stock);
                return (
                  <tr key={`${line.item_code}-${line.rnum}`} className="border-b border-slate-100">
                    <td className="px-3 py-2 text-center">{line.rnum}</td>
                    <td className="whitespace-nowrap px-3 py-2">{line.item_code}</td>
                    <td className="px-3 py-2">{line.item_name}</td>
                    <td className="px-3 py-2 text-center">{Number(line.qty)}</td>
                    <td className="px-3 py-2 text-center">{line.unit_code}</td>
                    <td className={`px-3 py-2 text-right ${enough ? "" : "font-bold text-red-600"}`}>
                      {Number(line.stock)}
                    </td>
                  </tr>
                );
              })}
            </Table>
          </>
        )}
      </Card>

      <DocSaveForm
        action={saveDispatch}
        docRef={docNo}
        productCode={productCode}
        today={today}
        backHref="/installations/dispatch"
        submitLabel="ເບີກ"
        disabled={lines.rows.length === 0 || short.length > 0}
      />
    </div>
  );
}
