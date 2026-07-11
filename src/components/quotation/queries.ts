import { query, queryOdg } from "@/lib/db";
import { docPrefix } from "@/lib/doc-no";
import type { DraftLine, ServiceItem } from "./quote-builder";

/** ລາຍການບໍລິການຈາກ ERP — ຄື spodsql ຂອງ /page_qt ແລະ /editpage_qt */
const SERVICE_ITEMS_SQL = `select a.code, a.name_1, a.unit_cost,
    case when p.sale_price1 is null then '0.00' else trim(to_char(p.sale_price1, '9G999G999D99')) end as price_sv,
    case when p.currency_code='01' then 'ບາດ'
         when p.currency_code='02' then 'ກີບ'
         when p.currency_code='03' then 'ໂດລາ'
         when p.currency_code='04' then 'ຢວນ'
         else 'ບໍ່ມີ' end as unit_of_currency,
    coalesce(to_char(p.from_date, 'dd/mm/yyyy'),'') as from_date,
    coalesce(to_char(p.to_date, 'dd/mm/yyyy'),'') as to_date
  from ic_inventory a
  left join ic_inventory_price p on p.ic_code=a.code and p.ic_code like '97%'
    and current_date between p.from_date and p.to_date and p.currency_code='01'
    and p.cust_group_1='101' and p.cust_group_2='10101'
  where a.code like '97%' order by a.code`;

export async function getServiceItems() {
  return (await queryOdg<ServiceItem>(SERVICE_ITEMS_SQL)).rows;
}

/** ອັດຕາເເລກປ່ຽນກີບ→ບາດ ຄື sql_rate ຂອງ /page_qt (1 / exchange_rate_present ຂອງລະຫັດ '02') */
export async function getKipRate() {
  const rows = (
    await queryOdg<{ baht_price: string }>(
      `select replace(to_char(1/(select exchange_rate_present from erp_currency where code='02'),'9G999G999D99'),' ','') as baht_price
       from erp_currency where code='02'`,
    )
  ).rows;
  return (rows[0]?.baht_price ?? "0").replace(/,/g, "");
}

export async function getDraftLinesByProduct(productCode: string) {
  return (
    await query<DraftLine>(
      `select roworder, item_code, item_name, qty, unit_code, price, sum_amount
       from ic_trans_detail_draft where product_code=$1 and doc_no is null order by roworder`,
      [productCode],
    )
  ).rows;
}

export async function getDraftLinesByDoc(docNo: string) {
  return (
    await query<DraftLine>(
      `select roworder, item_code, item_name, qty, unit_code, price, sum_amount
       from ic_trans_detail_draft where doc_no=$1 order by roworder`,
      [docNo],
    )
  ).rows;
}

/** ເລກທີຄາດຄະເນ (ຕົວຈິງອອກຄືນຕອນບັນທຶກ ພາຍໃນ transaction ທີ່ລັອກແລ້ວ) */
export async function previewDocNo() {
  const prefix = docPrefix("QT");
  const rows = (
    await query<{ seq: number }>(
      `select coalesce(max(substring(doc_no from ${prefix.length + 1})::int), 0) + 1 as seq
       from ic_trans where doc_no like $1 and substring(doc_no from ${prefix.length + 1}) ~ '^[0-9]+$'`,
      [`${prefix}%`],
    )
  ).rows;
  return `${prefix}${String(rows[0]?.seq ?? 1).padStart(5, "0")}`;
}
