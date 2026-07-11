import { deleteSpareRequest, techFilter } from "@/app/actions/installation";
import { Card, Empty, LinkButton, PageTitle, Table } from "@/components/ui";
import { DeleteSpareRequestButton } from "@/components/installation/spare-request-buttons";
import { query } from "@/lib/db";
import { remainingCase } from "@/lib/install-status";

/**
 * ຖອດແບບຈາກ ods: /home_in_request (tech_reg_install.py).
 * ods ຕໍ່ session name ເຂົ້າ SQL ໂດຍກົງ — ບ່ອນນີ້ໃຊ້ parameter.
 */
export const dynamic = "force-dynamic";

type WaitRow = {
  rnum: number;
  code: string;
  time_register: string | null;
  customer: string | null;
  doc_ref_1: string | null;
  item_name: string | null;
  pro_brand: string | null;
  pro_model: string | null;
  pro_type: string | null;
  pro_size: string | null;
  user_created: string | null;
  tech_code: string | null;
  remaining: string | null;
};

type ReqRow = {
  rnum: number;
  doc_no: string;
  reg_start: string | null;
  product_code: string;
  customer: string | null;
  item_name: string | null;
  pro_brand: string | null;
  pro_model: string | null;
  pro_type: string | null;
  pro_size: string | null;
  user_created: string | null;
  tech_code: string | null;
  remaining: string | null;
  reg_finished: number;
};

export default async function SpareRequestsPage() {
  const tech = await techFilter();
  const params = tech ? [tech] : [];

  const [waiting, requested] = await Promise.all([
    query<WaitRow>(
      `select row_number() over (order by a.roworder asc)::int as rnum, a.code,
         to_char(a.time_register,'DD-MM-YYYY HH24:MI:SS') as time_register,
         a.cust_code || '-' || coalesce(c.name_1,'') as customer,
         a.doc_ref_1, a.item_name, a.pro_brand, a.pro_model, a.pro_type, a.pro_size,
         a.user_created, a.tech_code, ${remainingCase("a.time_register")} as remaining
       from ods_tb_install a
       left join ar_customer c on c.code = a.cust_code
       where a.reg_start is null and a.used_spare = 1 and a.cancel_date is null
         ${tech ? "and a.tech_code = $1" : ""}
       order by a.roworder asc`,
      params,
    ),
    // ods ບໍ່ໄດ້ກັນໃບຂໍເບີກຂອງງານທີ່ປິດໄປແລ້ວອອກ ⇒ ຕາຕະລາງ "ກຳລັງຂໍເບີກ" ມີ 2,000+ ແຖວ
    // ທີ່ບໍ່ມີຫຍັງໃຫ້ເຮັດແລ້ວ. ບ່ອນນີ້ສະແດງສະເພາະງານທີ່ຍັງບໍ່ທັນປິດ.
    query<ReqRow>(
      `select row_number() over (order by a.doc_no desc)::int as rnum, a.doc_no,
         to_char(b.reg_start,'DD-MM-YYYY HH24:MI:SS') as reg_start,
         a.product_code,
         b.cust_code || '-' || coalesce(c.name_1,'') as customer,
         b.item_name, b.pro_brand, b.pro_model, b.pro_type, b.pro_size,
         a.user_created, b.tech_code, ${remainingCase("b.reg_start")} as remaining,
         case when b.reg_finish is not null then 1 else 0 end as reg_finished
       from ic_trans a
       left join ods_tb_install b on b.code = a.product_code
       left join ar_customer c on c.code = b.cust_code
       where a.trans_flag = 122 and a.job_type = 'install' and b.job_finish is null
         ${tech ? "and b.tech_code = $1" : ""}
       order by a.doc_no desc`,
      params,
    ),
  ]);

  return (
    <div className="w-full space-y-5">
      <PageTitle>ໃບຂໍເບີກຕິດຕັ້ງ</PageTitle>

      <Card title="ລາຍການລໍຖ້າຂໍເບີກ (ຕິດຕັ້ງ)">
        {waiting.rows.length === 0 ? (
          <Empty />
        ) : (
          <Table
            head={["ລຳດັບ", "ເລກທີເປີດງານ", "ລູກຄ້າ", "ລາຍການຕິດຕັ້ງ", "ຍີ່ຫໍ້", "model", "ປະເພດ", "ຂະໜາດ",
              "ຜູ້ສ້າງ", "ວັນ/ເວລາເປີດງານ", "ຮອດປະຈຸບັນ", "ຊ່າງ", ""]}
            minWidth={1600}
          >
            {waiting.rows.map((row) => (
              <tr key={row.code} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="px-3 py-2 text-center">{row.rnum}</td>
                <td className="whitespace-nowrap px-3 py-2 font-bold text-[#0536a9]">{row.code}</td>
                <td className="px-3 py-2">{row.customer}</td>
                <td className="max-w-72 truncate px-3 py-2" title={row.item_name ?? ""}>{row.item_name}</td>
                <td className="px-3 py-2">{row.pro_brand}</td>
                <td className="px-3 py-2">{row.pro_model}</td>
                <td className="px-3 py-2">{row.pro_type}</td>
                <td className="px-3 py-2">{row.pro_size}</td>
                <td className="px-3 py-2 text-center">{row.user_created}</td>
                <td className="whitespace-nowrap px-3 py-2">{row.time_register}</td>
                <td className="whitespace-nowrap px-3 py-2 text-right">{row.remaining ?? "-"}</td>
                <td className="px-3 py-2 text-center">{row.tech_code}</td>
                <td className="px-3 py-2 text-center">
                  <LinkButton href={`/installations/spare-requests/${encodeURIComponent(row.code)}`}>
                    ຂໍເບີກ
                  </LinkButton>
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      <Card title="ລາຍການກຳລັງຂໍເບີກອາໄລ່">
        {requested.rows.length === 0 ? (
          <Empty />
        ) : (
          <Table
            head={["#", "ເລກຂໍເບີກ", "ວັນ/ເວລາຂໍເບີກ", "ລະຫັດຕິດຕັ້ງ", "ລູກຄ້າ", "ລາຍການຕິດຕັ້ງ", "ຍີ່ຫໍ້",
              "model", "ປະເພດ", "ຂະໜາດ", "ຮອດປະຈຸບັນ", "ຊ່າງ", ""]}
            minWidth={1600}
          >
            {requested.rows.map((row) => (
              <tr key={row.doc_no} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="px-3 py-2 text-center">{row.rnum}</td>
                <td className="whitespace-nowrap px-3 py-2 font-bold text-[#0536a9]">{row.doc_no}</td>
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
                <td className="whitespace-nowrap px-3 py-2">
                  <div className="flex items-center justify-center gap-2">
                    <LinkButton
                      href={`/installations/spare-requests/view/${encodeURIComponent(row.doc_no)}`}
                      tone="neutral"
                    >
                      ເບິ່ງ
                    </LinkButton>
                    {row.reg_finished === 0 && (
                      <DeleteSpareRequestButton
                        docNo={row.doc_no}
                        code={row.product_code}
                        action={deleteSpareRequest}
                      />
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </div>
  );
}
