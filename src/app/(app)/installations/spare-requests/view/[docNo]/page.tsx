import { Card, Empty, LinkButton, PageTitle, Table } from "@/components/ui";
import { getSession } from "@/lib/auth";
import { query } from "@/lib/db";
import { canViewAssignedJob } from "@/lib/scope";
import { notFound, redirect } from "next/navigation";

/** ຖອດແບບຈາກ ods: /in_view_req/<id> + view_reg_page.html (tech_reg_install.py) */
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ docNo: string }> };

type Head = {
  doc_no: string;
  doc_date: string | null;
  code: string | null;
  item_name: string | null;
  cust_code: string | null;
  cust_name: string | null;
  pro_brand: string | null;
  pro_model: string | null;
  pro_type: string | null;
  pro_size: string | null;
  remark: string | null;
  tech_code: string | null;
};

export default async function ViewSpareRequest({ params }: Props) {
  const docNo = decodeURIComponent((await params).docNo);
  const session = await getSession();
  if (!session) redirect("/login");

  const [head, lines] = await Promise.all([
    query<Head>(
      `select ic.doc_no, to_char(ic.doc_date,'DD-MM-YYYY') as doc_date, a.code, a.item_name,
         a.cust_code, c.name_1 as cust_name, a.pro_brand, a.pro_model, a.pro_type, a.pro_size,
         ic.remark, a.tech_code
       from ic_trans ic
       left join ods_tb_install a on a.code = ic.product_code
       left join ar_customer c on c.code = a.cust_code
       where ic.doc_no = $1 limit 1`,
      [docNo],
    ),
    query<{ rnum: string; item_code: string; item_name: string; qty: string; unit_code: string | null }>(
      `select row_number() over (order by roworder asc) as rnum, item_code, item_name, round(qty,2) as qty, unit_code
       from ic_trans_detail where doc_no = $1 order by roworder asc`,
      [docNo],
    ),
  ]);

  const x = head.rows[0];
  if (!x) notFound();
  if (!canViewAssignedJob(session, x.tech_code)) redirect("/forbidden");

  const fields: [string, string | null][] = [
    ["ເລກຂໍເບີກ", x.doc_no],
    ["ວັນທີ", x.doc_date],
    ["ລະຫັດຕິດຕັ້ງ", x.code],
    ["ລູກຄ້າ", `${x.cust_code ?? ""}-${x.cust_name ?? ""}`],
    ["ລາຍການຕິດຕັ້ງ", x.item_name],
    ["ຍີ່ຫໍ້", x.pro_brand],
    ["model", x.pro_model],
    ["ປະເພດ", x.pro_type],
    ["ຂະໜາດ", x.pro_size],
    ["ຊ່າງ", x.tech_code],
    ["ໝາຍເຫດ", x.remark],
  ];

  return (
    <div className="w-full space-y-5">
      <PageTitle>ລາຍລະອຽດຂໍເບີກ</PageTitle>

      <Card title="ຂໍ້ມູນໃບຂໍເບີກ" actions={<LinkButton href="/installations/spare-requests" tone="neutral">ກັບຄືນ</LinkButton>}>
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {fields.map(([label, value]) => (
            <div key={label} className="border-b border-slate-100 pb-2">
              <dt className="text-xs text-slate-400">{label}</dt>
              <dd className="mt-1 text-sm font-medium text-slate-800">{value || "-"}</dd>
            </div>
          ))}
        </dl>
      </Card>

      <Card title="ອຸປະກອນຕິດຕັ້ງ">
        {lines.rows.length === 0 ? (
          <Empty />
        ) : (
          <Table head={["ລຳດັບ", "ລະຫັດ", "ຊື່ອຸປະກອນ", "ຈຳນວນ", "ຫົວໜ່ວຍ"]} minWidth={700}>
            {lines.rows.map((row) => (
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
    </div>
  );
}
