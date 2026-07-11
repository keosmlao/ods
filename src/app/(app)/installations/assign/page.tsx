import { AssignTechButton, type AssignRow } from "@/components/installation/assign-tech";
import { JobButton } from "@/components/installation/job-buttons";
import { Card, Empty, PageTitle, Table } from "@/components/ui";
import { chooseNewTech } from "@/app/actions/installation";
import { query } from "@/lib/db";
import { installStageIs } from "@/lib/install-stage";
import { remainingCase } from "@/lib/install-status";

/**
 * ຖອດແບບຈາກ ods: /assign_tech_install + /assign_tech_submit + /choose_new_tech (install_admin.py).
 * ຂັ້ນຂອງງານມາຈາກ @/lib/install-stage (ຂັ້ນ 0 = ລໍຖ້າຈັດຊ່າງ).
 */
export const dynamic = "force-dynamic";

type Row = AssignRow & {
  rnum: number;
  time_register: string | null;
  appoint_show: string | null;
  doc_ref_1: string | null;
  item_name: string | null;
  pro_brand: string | null;
  pro_model: string | null;
  pro_type: string | null;
  pro_size: string | null;
  user_created: string | null;
  remaining: string | null;
  tech_before: string | null;
  tech_code: string | null;
};

const COLUMNS = `row_number() over (order by a.roworder asc)::int as rnum, a.code,
  to_char(a.time_register,'DD-MM-YYYY HH24:MI:SS') as time_register,
  coalesce(to_char(a.appoint_date,'DD-MM-YYYY'),'') as appoint_show,
  to_char(a.appoint_date,'YYYY-MM-DD') as appoint_date,
  a.cust_code || '-' || coalesce(c.name_1,'') as customer,
  a.doc_ref_1, a.item_name, a.pro_brand, a.pro_model, a.pro_type, a.pro_size,
  a.user_created, ${remainingCase("a.time_register")} as remaining,
  coalesce(a.remark,'') as remark, coalesce(a.location_inst,'') as location_inst,
  coalesce(a.tech_before,'-') as tech_before, a.tech_code`;

const HEAD = ["ລຳດັບ", "ເລກທີເປີດງານ", "ວັນທີເປີດງານ", "ວັນທີນັດຕິດຕັ້ງ", "ລູກຄ້າ", "ລາຍການຕິດຕັ້ງ",
  "ຍີ່ຫໍ້", "model", "ປະເພດ", "ຂະໜາດ", "ຜູ້ສ້າງ", "ຮອດປະຈຸບັນ"];

export default async function AssignPage() {
  const [waitAssign, waitAccept, techs] = await Promise.all([
    query<Row>(
      `select ${COLUMNS}
       from ods_tb_install a
       left join ar_customer c on c.code = a.cust_code
       where ${installStageIs(0)}
       order by a.roworder asc`,
    ),
    query<Row>(
      `select ${COLUMNS}
       from ods_tb_install a
       left join ar_customer c on c.code = a.cust_code
       where a.time_register is not null and a.tech_code is not null and a.tech_confirm is null
         and a.reg_start is null and a.cancel_date is null
       order by a.roworder asc`,
    ),
    query<{ code: string; username: string }>("select code,username from users where roles='technical' order by username"),
  ]);

  const cells = (row: Row) => (
    <>
      <td className="px-3 py-2 text-center">{row.rnum}</td>
      <td className="whitespace-nowrap px-3 py-2 font-bold text-[#0536a9]">{row.code}</td>
      <td className="whitespace-nowrap px-3 py-2">{row.time_register}</td>
      <td className="whitespace-nowrap px-3 py-2 text-center">{row.appoint_show || "-"}</td>
      <td className="px-3 py-2">{row.customer}</td>
      <td className="max-w-72 truncate px-3 py-2" title={row.item_name ?? ""}>{row.item_name}</td>
      <td className="px-3 py-2">{row.pro_brand}</td>
      <td className="px-3 py-2">{row.pro_model}</td>
      <td className="px-3 py-2">{row.pro_type}</td>
      <td className="px-3 py-2">{row.pro_size}</td>
      <td className="px-3 py-2 text-center">{row.user_created}</td>
      <td className="whitespace-nowrap px-3 py-2 text-right">{row.remaining ?? "-"}</td>
    </>
  );

  return (
    <div className="w-full space-y-5">
      <PageTitle>ຈັດງານຊ່າງຕິດຕັ້ງ</PageTitle>

      <Card title="ລາຍການລໍຖ້າຈັດ ຊ່າງ ງານຕິດຕັ້ງ">
        {waitAssign.rows.length === 0 ? (
          <Empty />
        ) : (
          <Table head={[...HEAD, "ຊ່າງກ່ອນໜ້ານີ້", ""]} minWidth={1500}>
            {waitAssign.rows.map((row) => (
              <tr key={row.code} className="border-b border-slate-100 hover:bg-slate-50">
                {cells(row)}
                <td className="px-3 py-2 text-center">{row.tech_before}</td>
                <td className="px-3 py-2 text-center">
                  <AssignTechButton row={row} techs={techs.rows} />
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      <Card title="ລາຍການລໍຖ້າຊ່າງຮັບງານຕິດຕັ້ງ">
        {waitAccept.rows.length === 0 ? (
          <Empty />
        ) : (
          <Table head={[...HEAD, "ຊ່າງທີ່ເລືອກ", ""]} minWidth={1500}>
            {waitAccept.rows.map((row) => (
              <tr key={row.code} className="border-b border-slate-100 hover:bg-slate-50">
                {cells(row)}
                <td className="px-3 py-2 text-center">{row.tech_code}</td>
                <td className="px-3 py-2 text-center">
                  <JobButton code={row.code} action={chooseNewTech} tone="danger">ເລືອກໃໝ່</JobButton>
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </div>
  );
}
