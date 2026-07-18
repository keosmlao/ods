import { query, queryOdg } from "@/lib/db";
import { TRANS } from "@/lib/stock-constants";

export const ISO_MONTH = /^\d{4}-\d{2}$/;

export type InstallSpareItemRow = {
  item_code: string;
  item_name: string;
  unit_code: string;
  documents: number;
  jobs: number;
  issued_qty: string;
  returned_qty: string;
  net_qty: string;
};

export type InstallSpareTechRow = {
  tech_code: string;
  tech_name: string;
  documents: number;
  jobs: number;
  item_types: number;
  issued_qty: string;
  returned_qty: string;
  net_qty: string;
};

export type InstallSpareTotals = {
  documents: number;
  jobs: number;
  item_types: number;
  issued_qty: string;
  returned_qty: string;
  net_qty: string;
};

const BASE = `with issued as (
  select h.doc_no, h.product_code job_code,
    coalesce(nullif(i.tech_code,''),'-') tech_code,
    coalesce(nullif(u.name_1,''),nullif(u.username,''),nullif(i.tech_code,''),'-') tech_name,
    coalesce(nullif(d.item_code,''),'-') item_code,
    coalesce(nullif(d.item_name,''),'-') item_name,
    coalesce(nullif(d.unit_code,''),'-') unit_code,
    sum(coalesce(d.qty,0))::numeric issued_qty
  from ic_trans h
  join ic_trans_detail d on d.doc_no=h.doc_no and d.trans_flag=h.trans_flag
  left join ods_tb_install i on i.code=h.product_code
  left join users u on u.code=i.tech_code
  where h.trans_flag=$2 and h.job_type='install'
    and h.doc_date >= $1::date and h.doc_date < ($1::date + interval '1 month')
  group by h.doc_no,h.product_code,i.tech_code,u.name_1,u.username,d.item_code,d.item_name,d.unit_code
), returned as (
  select request.doc_ref dispatch_doc,
    coalesce(nullif(d.item_code,''),'-') item_code,
    sum(coalesce(d.qty,0))::numeric returned_qty
  from ic_trans received
  join ic_trans request on request.doc_no=received.doc_ref and request.trans_flag=$4
  join ic_trans_detail d on d.doc_no=received.doc_no and d.trans_flag=received.trans_flag
  where received.trans_flag=$3
  group by request.doc_ref,d.item_code
), detail as (
  select issued.*,
    least(issued.issued_qty,coalesce(returned.returned_qty,0))::numeric returned_qty,
    greatest(issued.issued_qty-coalesce(returned.returned_qty,0),0)::numeric net_qty
  from issued
  left join returned on returned.dispatch_doc=issued.doc_no and returned.item_code=issued.item_code
)`;

const args = (month: string) => [`${month}-01`, TRANS.DISPATCH, TRANS.RECEIVE_BACK, TRANS.RETURN_REQUEST];

export async function fetchMonthlyInstallSpares(month: string) {
  const params = args(month);
  const [items, techs, totals] = await Promise.all([
    query<InstallSpareItemRow>(
      `${BASE}
       select item_code,max(item_name) item_name,unit_code,
         count(distinct doc_no)::int documents,count(distinct job_code)::int jobs,
         sum(issued_qty)::text issued_qty,sum(returned_qty)::text returned_qty,sum(net_qty)::text net_qty
       from detail group by item_code,unit_code
       order by sum(net_qty) desc,item_code`,
      params,
    ),
    query<InstallSpareTechRow>(
      `${BASE}
       select tech_code,max(tech_name) tech_name,
         count(distinct doc_no)::int documents,count(distinct job_code)::int jobs,
         count(distinct item_code)::int item_types,
         sum(issued_qty)::text issued_qty,sum(returned_qty)::text returned_qty,sum(net_qty)::text net_qty
       from detail group by tech_code
       order by sum(net_qty) desc,tech_code`,
      params,
    ),
    query<InstallSpareTotals>(
      `${BASE}
       select count(distinct doc_no)::int documents,count(distinct job_code)::int jobs,
         count(distinct item_code)::int item_types,
         coalesce(sum(issued_qty),0)::text issued_qty,
         coalesce(sum(returned_qty),0)::text returned_qty,
         coalesce(sum(net_qty),0)::text net_qty
       from detail`,
      params,
    ),
  ]);
  const techCodes = techs.rows.map((row) => row.tech_code).filter((code) => code !== "-");
  const erpNames = techCodes.length
    ? await queryOdg<{ employee_code: string; fullname_lo: string }>(
        `select employee_code,coalesce(nullif(fullname_lo,''),employee_code) fullname_lo
           from odg_employee where employee_code = any($1::varchar[])`,
        [techCodes],
      ).catch(() => ({ rows: [] as { employee_code: string; fullname_lo: string }[] }))
    : { rows: [] as { employee_code: string; fullname_lo: string }[] };
  const names = new Map(erpNames.rows.map((row) => [row.employee_code, row.fullname_lo]));

  return {
    items: items.rows,
    techs: techs.rows.map((row) => ({ ...row, tech_name: names.get(row.tech_code) ?? row.tech_name })),
    totals: totals.rows[0] ?? {
      documents: 0,
      jobs: 0,
      item_types: 0,
      issued_qty: "0",
      returned_qty: "0",
      net_qty: "0",
    },
  };
}

export function filterInstallSpareItems(rows: InstallSpareItemRow[], q: string) {
  const needle = q.trim().toLocaleLowerCase();
  if (!needle) return rows;
  return rows.filter((row) =>
    `${row.item_code} ${row.item_name} ${row.unit_code}`.toLocaleLowerCase().includes(needle),
  );
}
