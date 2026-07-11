import { RequestForm, type RequestHead } from "@/components/stock/request-form";
import { EditableSpareLines, type SpareLine } from "@/components/stock/spare-lines";
import type { Shelf, Warehouse } from "@/components/stock/wh-shelf-select";
import { ErrorBox, PageTitle } from "@/components/ui";
import { query, queryOdg } from "@/lib/db";
import { docPrefix } from "@/lib/doc-no";
import { ALLOWED_SHELVES, REQUEST_WAREHOUSES } from "@/lib/stock-constants";
import { notFound } from "next/navigation";

/** ods: stock.py /show_req/<roworder> + templates/stock/req_page.html */

type Props = { params: Promise<{ roworder: string }> };

async function getHead(roworder: string) {
  const sql = `select to_char(a.time_finish_check,'DD-MM-YYYY HH24:MI:SS') checked_at,
      b.name_1||'-'||b.tel customer, a.name_1||'-'||a.sn product, a.warrunty warranty,
      a.issue, a.emp_code technician, a.code product_code
    from tb_product a
    left join ar_customer b on b.code = a.cust_code
    where a.roworder = $1`;
  return (await query<RequestHead>(sql, [roworder])).rows[0] ?? null;
}

async function getLines(productCode: string) {
  const sql = `select row_number() over (order by roworder)::int rnum, item_code, item_name, qty, unit_code, roworder
    from tb_used_spare where product_code = $1 order by roworder`;
  return (await query<SpareLine>(sql, [productCode])).rows;
}

/** ຕົວຢ່າງເລກທີ — ເລກຈິງອອກຕອນບັນທຶກ (ພາຍໃນ transaction ທີ່ລັອກແລ້ວ) */
async function previewDocNo() {
  const prefix = docPrefix("SIO");
  const sql = `select coalesce(max(substring(doc_no from ${prefix.length + 1})::int), 0) + 1 seq
    from ic_trans where doc_no like $1 and substring(doc_no from ${prefix.length + 1}) ~ '^[0-9]+$'`;
  const seq = (await query<{ seq: number }>(sql, [`${prefix}%`])).rows[0]?.seq ?? 1;
  return `${prefix}${String(seq).padStart(4, "0")}`;
}

async function getWarehouses() {
  const warehouses = await queryOdg<Warehouse>(
    `select code, name_1 from ic_warehouse where code = any($1::text[]) order by code asc`,
    [[...REQUEST_WAREHOUSES]],
  );
  const shelves = await queryOdg<Shelf>(
    `select code, name_1, whcode from ic_shelf where whcode = any($1::text[]) and code = any($2::text[]) order by code`,
    [[...REQUEST_WAREHOUSES], [...ALLOWED_SHELVES]],
  );
  return { warehouses: warehouses.rows, shelves: shelves.rows };
}

export default async function StockRequestFormPage({ params }: Props) {
  const { roworder } = await params;

  const head = await getHead(roworder);
  if (!head) notFound();

  const [lines, docNo, wh] = await Promise.all([getLines(head.product_code), previewDocNo(), getWarehouses()]);
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });

  return (
    <div className="w-full space-y-6">
      <PageTitle sub="ໃບຂໍເບີກ">ໃບຂໍເບີກອາໄຫຼ່</PageTitle>

      <RequestForm
        head={head}
        docNo={docNo}
        today={today}
        warehouses={wh.warehouses}
        shelves={wh.shelves}
        hasSpares={lines.length > 0}
      />

      <EditableSpareLines lines={lines} roworder={roworder} />

      {lines.length === 0 && <ErrorBox>ຍັງບໍ່ມີອາໄຫຼ່ໃນລາຍການ — ກົດ &quot;ເລືອກ&quot; ເພື່ອເພີ່ມອາໄຫຼ່</ErrorBox>}
    </div>
  );
}
