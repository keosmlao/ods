import { Card, Empty, LinkButton, PageTitle, Table } from "@/components/ui";
import { query } from "@/lib/db";
import { STAGE_SQL } from "@/lib/stage";
import { ArrowLeft } from "lucide-react";

/** ods: stock.py /stock_request_agian + templates/stock/request_again.html */

type Row = {
  rnum: number;
  customer: string | null;
  name_1: string | null;
  p_model: string | null;
  sn: string | null;
  p_brand: string | null;
  warrunty: string | null;
  finished_at: string | null;
  elapsed: string | null;
  issue: string | null;
  emp_code: string | null;
  roworder: number;
  status_name: string;
};

/** ຂັ້ນ (stage) ຄຳນວນຢູ່ subquery ແລ້ວ — ບ່ອນນີ້ພຽງແຕ່ແປງເປັນຄຳ */
const STATUS_CASE = `case st_request.stage
  when 1 then 'ລໍຖ້າກວດເຊັກ' when 2 then 'ກຳລັງກວດເຊັກ' when 3 then 'ລໍຖ້າສະເໜີລາຄາ' when 4 then 'ກຳລັງສະເໜີລາຄາ'
  when 5 then 'ລໍຖ້າເບີກອາໄຫຼ່' when 6 then 'ກຳລັງເບີກອາໄຫຼ່' when 7 then 'ກຳລັງສັ່ງຊື້ອາໄຫຼ່' when 8 then 'ລໍຖ້າສ້ອມເເປງ'
  when 9 then 'ກຳລັງສ້ອມເເປງ' when 10 then 'ລໍຖ້າສົ່ງຄືນ' when 11 then 'ສົ່ງຄືນສຳເລັດ' when -1 then 'ຍົກເລີກເເລ້ວ'
  else '-' end`;

/** ເຄື່ອງທີ່ຂໍເບີກໄປແລ້ວ (spare_reg notnull) ແຕ່ຍັງບໍ່ທັນສົ່ງຄືນ → ຂໍເບີກຊ້ຳໄດ້ */
async function getRows() {
  const sql = `select row_number() over (order by st_request.elapsed desc) as rnum,
      st_request.customer, st_request.name_1, st_request.p_model, st_request.sn, st_request.p_brand,
      st_request.warrunty, st_request.finished_at, st_request.elapsed::text elapsed,
      st_request.issue, st_request.emp_code, st_request.roworder, ${STATUS_CASE} status_name
    from (
      select b.name_1||'-'||b.tel customer, a.name_1, a.p_model, a.sn, a.p_brand, a.warrunty,
        to_char(a.time_finish_check,'DD-MM-YYYY HH24:MI:SS') finished_at,
        case when a.time_finish_check > localtimestamp(0) then interval '0'
             else localtimestamp(0) - a.time_finish_check end elapsed,
        a.issue, a.emp_code, a.roworder, a.status, (${STAGE_SQL}) stage
      from tb_product a
      left join ar_customer b on b.code = a.cust_code
      where a.used_spare=1 and a.spare_reg is not null and a.qt_start is not null and a.qt_finish is not null
        and a.warrunty = 'ໝົດຮັບປະກັນ' and a.status != 6 and a.return_complete is null
      union all
      select b.name_1||'-'||b.tel customer, a.name_1, a.p_model, a.sn, a.p_brand, a.warrunty,
        to_char(a.time_finish_check,'DD-MM-YYYY HH24:MI:SS') finished_at,
        case when a.time_finish_check > localtimestamp(0) then interval '0'
             else localtimestamp(0) - a.time_finish_check end elapsed,
        a.issue, a.emp_code, a.roworder, a.status, (${STAGE_SQL}) stage
      from tb_product a
      left join ar_customer b on b.code = a.cust_code
      where a.used_spare=1 and a.spare_reg is not null and a.warrunty = 'ຮັບປະກັນ'
        and a.status != 6 and a.return_complete is null
    ) st_request
    where st_request.status != 6
    order by st_request.elapsed desc`;
  return (await query<Row>(sql)).rows;
}

export default async function StockRequestAgainPage() {
  const rows = await getRows();

  return (
    <div className="w-full space-y-6">
      <PageTitle sub="ໃບຂໍເບີກ">ເລືອກລາຍການເຄື່ອງສ້ອມທີ່ຈະຂໍເບີກຊໍ້າ</PageTitle>

      <Card
        title="ເລືອກລາຍການເຄື່ອງສ້ອມທີ່ຈະຂໍເບີກຊໍ້າ"
        actions={
          <LinkButton href="/stock/requests" tone="neutral">
            <ArrowLeft className="size-4" />
            ກັບຄືນ
          </LinkButton>
        }
      >
        {rows.length === 0 ? (
          <Empty />
        ) : (
          <Table
            head={[
              "ລຳດັບ", "ລູກຄ້າ", "ລາຍການ", "Model", "SN", "ຫຍີ່ຫໍ້", "ຮັບປະກັນ", "ອາການເພ",
              "ວັນ/ເວລາສິ້ນສຸດກວດເຊັກ", "ເວລາທີ່ໃຊ້", "ຊ່າງ", "ສະຖານະ", "",
            ]}
            minWidth={1600}
          >
            {rows.map((row) => (
              <tr key={row.roworder} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="px-3 py-3 text-center">{row.rnum}</td>
                <td className="px-3 py-3">{row.customer ?? "-"}</td>
                <td className="px-3 py-3">{row.name_1 ?? "-"}</td>
                <td className="px-3 py-3">{row.p_model ?? "-"}</td>
                <td className="px-3 py-3">{row.sn ?? "-"}</td>
                <td className="px-3 py-3">{row.p_brand ?? "-"}</td>
                <td className="whitespace-nowrap px-3 py-3">{row.warrunty ?? "-"}</td>
                <td className="max-w-56 truncate px-3 py-3" title={row.issue ?? ""}>{row.issue ?? "-"}</td>
                <td className="whitespace-nowrap px-3 py-3">{row.finished_at ?? "-"}</td>
                <td className="whitespace-nowrap px-3 py-3">{row.elapsed ?? "-"}</td>
                <td className="px-3 py-3">{row.emp_code ?? "-"}</td>
                <td className="whitespace-nowrap px-3 py-3">{row.status_name}</td>
                <td className="px-3 py-3 text-center">
                  <LinkButton href={`/stock/requests/${row.roworder}`} className="h-8 px-3 text-xs">
                    ຂໍເບີກ
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
