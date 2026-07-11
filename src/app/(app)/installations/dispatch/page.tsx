import { Card, Empty, LinkButton, PageTitle, Table } from "@/components/ui";
import { query } from "@/lib/db";
import { remainingCase } from "@/lib/install-status";

/**
 * ສາງເບີກອາໄຫຼ່ໃຫ້ງານຕິດຕັ້ງ (SWC, trans_flag 56).
 * ຖອດແບບຈາກ ods: /showdisp_install + /save_dispatch_install (tech_install.py).
 * ໃນ ods ໜ້ານີ້ຢູ່ໃນໂມດູນສາງ (spdispatch) — ບ່ອນນີ້ຍ້າຍມາຢູ່ໃນວຽກຕິດຕັ້ງ
 * ເພື່ອໃຫ້ຄົບຂັ້ນຕອນ SION → SWC → PISP.
 */
export const dynamic = "force-dynamic";

type Row = {
  rnum: number;
  doc_no: string;
  doc_date: string | null;
  reg_start: string | null;
  product_code: string;
  customer: string | null;
  item_name: string | null;
  pro_brand: string | null;
  pro_model: string | null;
  pro_type: string | null;
  pro_size: string | null;
  tech_code: string | null;
  user_created: string | null;
  remaining: string | null;
};

const COLUMNS = `row_number() over (order by ic.doc_no asc)::int as rnum, ic.doc_no,
  to_char(ic.doc_date,'DD-MM-YYYY') as doc_date,
  to_char(a.reg_start,'DD-MM-YYYY HH24:MI:SS') as reg_start,
  ic.product_code, a.cust_code || '-' || coalesce(c.name_1,'') as customer,
  a.item_name, a.pro_brand, a.pro_model, a.pro_type, a.pro_size, a.tech_code, ic.user_created,
  ${remainingCase("a.reg_start")} as remaining`;

const HEAD = ["#", "ເລກຂໍເບີກ", "ວັນທີ", "ວັນ/ເວລາຂໍເບີກ", "ລະຫັດຕິດຕັ້ງ", "ລູກຄ້າ", "ລາຍການຕິດຕັ້ງ",
  "ຍີ່ຫໍ້", "model", "ປະເພດ", "ຂະໜາດ", "ຮອດປະຈຸບັນ", "ຊ່າງ"];

export default async function DispatchPage() {
  const [waiting, done] = await Promise.all([
    // SION ທີ່ຍັງບໍ່ທັນຖືກເບີກເປັນ SWC
    query<Row>(
      `select ${COLUMNS}
       from ic_trans ic
       left join ods_tb_install a on a.code = ic.product_code
       left join ar_customer c on c.code = a.cust_code
       where ic.trans_flag = 122 and ic.job_type = 'install' and a.reg_finish is null
         and ic.doc_no not in (select doc_ref from ic_trans where trans_flag = 56 and doc_ref is not null)
       order by ic.doc_no asc`,
    ),
    query<Row>(
      `select ${COLUMNS}
       from ic_trans ic
       left join ods_tb_install a on a.code = ic.product_code
       left join ar_customer c on c.code = a.cust_code
       where ic.trans_flag = 56 and ic.job_type = 'install'
       order by ic.doc_no desc
       limit 50`,
    ),
  ]);

  const cells = (row: Row) => (
    <>
      <td className="px-3 py-2 text-center">{row.rnum}</td>
      <td className="whitespace-nowrap px-3 py-2 font-bold text-[#0536a9]">{row.doc_no}</td>
      <td className="whitespace-nowrap px-3 py-2">{row.doc_date}</td>
      <td className="whitespace-nowrap px-3 py-2">{row.reg_start}</td>
      <td className="whitespace-nowrap px-3 py-2">{row.product_code}</td>
      <td className="px-3 py-2">{row.customer}</td>
      <td className="max-w-72 truncate px-3 py-2" title={row.item_name ?? ""}>{row.item_name}</td>
      <td className="px-3 py-2">{row.pro_brand}</td>
      <td className="px-3 py-2">{row.pro_model}</td>
      <td className="px-3 py-2">{row.pro_type}</td>
      <td className="px-3 py-2">{row.pro_size}</td>
      <td className="whitespace-nowrap px-3 py-2 text-right">{row.remaining ?? "-"}</td>
      <td className="px-3 py-2 text-center">{row.tech_code}</td>
    </>
  );

  return (
    <div className="w-full space-y-5">
      <PageTitle>ສາງເບີກອາໄຫຼ່ (ຕິດຕັ້ງ)</PageTitle>

      <Card title="ລາຍການລໍຖ້າສາງເບີກ">
        {waiting.rows.length === 0 ? (
          <Empty />
        ) : (
          <Table head={[...HEAD, ""]} minWidth={1700}>
            {waiting.rows.map((row) => (
              <tr key={row.doc_no} className="border-b border-slate-100 hover:bg-slate-50">
                {cells(row)}
                <td className="px-3 py-2 text-center">
                  <LinkButton href={`/installations/dispatch/${encodeURIComponent(row.doc_no)}`}>ເບີກ</LinkButton>
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      <Card title="ລາຍການເບີກສຳເລັດ">
        {done.rows.length === 0 ? (
          <Empty />
        ) : (
          <Table head={HEAD} minWidth={1600}>
            {done.rows.map((row) => (
              <tr key={row.doc_no} className="border-b border-slate-100 hover:bg-slate-50">
                {cells(row)}
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </div>
  );
}
