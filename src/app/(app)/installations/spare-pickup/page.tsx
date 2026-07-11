import { techFilter } from "@/app/actions/installation";
import { Card, Empty, LinkButton, PageTitle, Table } from "@/components/ui";
import { query } from "@/lib/db";
import { remainingCase } from "@/lib/install-status";

/**
 * ຖອດແບບຈາກ ods: /home_rc_spare (tech_reg_install.py).
 * ods ຕໍ່ session name ເຂົ້າ SQL ໂດຍກົງ (tech_reg_install.py:355) — ບ່ອນນີ້ໃຊ້ parameter.
 */
export const dynamic = "force-dynamic";

type Row = {
  rnum: number;
  doc_no: string;
  doc_date: string | null;
  stamp: string | null;
  code: string;
  customer: string | null;
  item_name: string | null;
  pro_brand: string | null;
  pro_model: string | null;
  pro_type: string | null;
  pro_size: string | null;
  user_created: string | null;
  tech_code: string | null;
  remaining: string | null;
};

const HEAD = ["ລຳດັບ", "ເລກທີເບີກ", "ວັນ/ເວລາເບີກ", "ເລກທີເປີດງານ", "ລູກຄ້າ", "ລາຍການຕິດຕັ້ງ",
  "ຍີ່ຫໍ້", "model", "ປະເພດ", "ຂະໜາດ", "ຜູ້ສ້າງ", "ຮອດປະຈຸບັນ", "ຊ່າງ"];

export default async function SparePickupPage() {
  const tech = await techFilter();
  const params = tech ? [tech] : [];

  const [waiting, done] = await Promise.all([
    // SWC ທີ່ຍັງບໍ່ທັນຮັບ (ຍັງບໍ່ມີ PISP ອ້າງອີງ)
    query<Row>(
      `select row_number() over (order by ic.doc_no asc)::int as rnum, ic.doc_no,
         to_char(ic.doc_date,'DD-MM-YYYY') as doc_date,
         to_char(ic.create_date_time_now,'DD-MM-YYYY HH24:MI:SS') as stamp,
         a.code, a.cust_code || '-' || coalesce(c.name_1,'') as customer,
         a.item_name, a.pro_brand, a.pro_model, a.pro_type, a.pro_size,
         a.user_created, a.tech_code, ${remainingCase("ic.create_date_time_now")} as remaining
       from ods_tb_install a
       left join ar_customer c on c.code = a.cust_code
       join ic_trans ic on ic.product_code = a.code and ic.trans_flag = 56
       where a.used_spare = 1 and a.reg_start is not null and a.cancel_date is null
         and a.code in (select distinct product_code from tb_used_spare
                        where reg_finish is not null and pick_finish is null and product_code like 'INST%')
         and ic.doc_no not in (select doc_ref from ic_trans where trans_flag = 166 and doc_ref is not null)
         ${tech ? "and a.tech_code = $1" : ""}
       order by ic.doc_no asc`,
      params,
    ),
    query<Row>(
      `select row_number() over (order by ic.doc_no asc)::int as rnum, ic.doc_no,
         to_char(ic.doc_date,'DD-MM-YYYY') as doc_date,
         to_char(ic.create_date_time_now,'DD-MM-YYYY HH24:MI:SS') as stamp,
         ic.product_code as code, b.cust_code || '-' || coalesce(c.name_1,'') as customer,
         b.item_name, b.pro_brand, b.pro_model, b.pro_type, b.pro_size,
         ic.user_created, b.tech_code, ${remainingCase("ic.create_date_time_now")} as remaining
       from ic_trans ic
       left join ods_tb_install b on b.code = ic.product_code and b.used_spare = 1
       left join ar_customer c on c.code = b.cust_code
       where ic.trans_flag = 166 and ic.job_type = 'install'
         ${tech ? "and b.tech_code = $1" : ""}
       order by ic.doc_no desc
       limit 50`,
      params,
    ),
  ]);

  const cells = (row: Row) => (
    <>
      <td className="px-3 py-2 text-center">{row.rnum}</td>
      <td className="whitespace-nowrap px-3 py-2 font-bold text-[#0536a9]">{row.doc_no}</td>
      <td className="whitespace-nowrap px-3 py-2">{row.stamp ?? row.doc_date}</td>
      <td className="whitespace-nowrap px-3 py-2">{row.code}</td>
      <td className="px-3 py-2">{row.customer}</td>
      <td className="max-w-72 truncate px-3 py-2" title={row.item_name ?? ""}>{row.item_name}</td>
      <td className="px-3 py-2">{row.pro_brand}</td>
      <td className="px-3 py-2">{row.pro_model}</td>
      <td className="px-3 py-2">{row.pro_type}</td>
      <td className="px-3 py-2">{row.pro_size}</td>
      <td className="px-3 py-2 text-center">{row.user_created}</td>
      <td className="whitespace-nowrap px-3 py-2 text-right">{row.remaining ?? "-"}</td>
      <td className="px-3 py-2 text-center">{row.tech_code}</td>
    </>
  );

  return (
    <div className="w-full space-y-5">
      <PageTitle>ຮັບອາໄຫຼ່ (ຕິດຕັ້ງ)</PageTitle>

      <Card title="ລາຍການລໍຖ້າຮັບອາໄຫຼ່ (ຕິດຕັ້ງ)">
        {waiting.rows.length === 0 ? (
          <Empty />
        ) : (
          <Table head={[...HEAD, ""]} minWidth={1700}>
            {waiting.rows.map((row) => (
              <tr key={row.doc_no} className="border-b border-slate-100 hover:bg-slate-50">
                {cells(row)}
                <td className="px-3 py-2 text-center">
                  <LinkButton href={`/installations/spare-pickup/${encodeURIComponent(row.doc_no)}`}>
                    ຮັບອາໄຫຼ່
                  </LinkButton>
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      <Card title="ລາຍການຮັບອາໄຫຼ່ສຳເລັດ">
        {done.rows.length === 0 ? (
          <Empty />
        ) : (
          <Table head={[...HEAD, ""]} minWidth={1700}>
            {done.rows.map((row) => (
              <tr key={row.doc_no} className="border-b border-slate-100 hover:bg-slate-50">
                {cells(row)}
                <td className="px-3 py-2 text-center">
                  <LinkButton
                    href={`/installations/spare-pickup/view/${encodeURIComponent(row.doc_no)}`}
                    tone="neutral"
                  >
                    ເບິ່ງ
                  </LinkButton>
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </div>
  );
}
