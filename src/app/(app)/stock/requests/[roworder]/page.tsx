import { RequestForm, type RequestHead } from "@/components/stock/request-form";
import { EditableSpareLines, type SpareLine } from "@/components/stock/spare-lines";
import type { Shelf, Warehouse } from "@/components/stock/wh-shelf-select";
import { Card, ErrorBox, PageTitle, Table } from "@/components/ui";
import { query, queryOdg } from "@/lib/db";
import { docPrefix } from "@/lib/doc-no";
import { ALLOWED_SHELVES, REQUEST_WAREHOUSES, TRANS } from "@/lib/stock-constants";
import { notFound } from "next/navigation";

/** ods: stock.py /show_req/<roworder> + templates/stock/req_page.html */

type Props = { params: Promise<{ roworder: string }> };

/** ແຖວກະຕ່າ + ທຸງວ່າ "ຂໍໄປແລ້ວ" (ມີໃນໃບຂໍເບີກ 122 ແລ້ວ ແລະ ຍັງບໍ່ໄດ້ສົ່ງຄືນ) */
type Row = SpareLine & { requested: boolean };

async function getHead(roworder: string) {
  const sql = `select to_char(a.time_finish_check,'DD-MM-YYYY HH24:MI:SS') checked_at,
      b.name_1||'-'||b.tel customer, a.name_1||'-'||a.sn product, a.warrunty warranty,
      a.issue, a.emp_code technician, a.code product_code
    from tb_product a
    left join ar_customer b on b.code = a.cust_code
    where a.roworder = $1`;
  return (await query<RequestHead>(sql, [roworder])).rows[0] ?? null;
}

/**
 * ແຖວກະຕ່າ ພ້ອມ "ຈຳນວນທີ່ຖືກຂໍໄປແລ້ວ" ຂອງອາໄຫຼ່ຕົວນັ້ນ.
 * ໃບຂໍເບີກຈະເອົາສະເພາະ "ຈຳນວນທີ່ຍັງຄ້າງ" (qty - covered) ເທົ່ານັ້ນ
 * — ເບິ່ງ OUTSTANDING_SPARES ໃນ actions/stock.ts. ບ່ອນນີ້ສະແດງໃຫ້ຜູ້ໃຊ້ເຫັນວ່າ
 * ອັນໃດຈະຢູ່ໃນໃບ ອັນໃດຂໍໄປແລ້ວ ຈຶ່ງບໍ່ແປກໃຈຕອນໃບອອກມາສັ້ນກວ່າກະຕ່າ.
 */
async function getLines(productCode: string) {
  // ຈຳນວນສະສົມຂອງອາໄຫຼ່ຕົວດຽວກັນ (cum) ທຽບກັບຈຳນວນທີ່ຂໍໄປແລ້ວ (covered)
  // ⇒ ແຖວທີ່ຢູ່ພາຍໃນຈຳນວນທີ່ຂໍໄປແລ້ວ = "ຂໍໄປແລ້ວ" (ໃຊ້ໄດ້ເຖິງມີແຖວອາໄຫຼ່ຕົວດຽວກັນຫຼາຍແຖວ)
  const sql = `select rnum, item_code, item_name, qty, unit_code, roworder, (cum <= covered) requested
    from (
      select row_number() over (order by s.roworder)::int rnum, s.item_code, s.item_name, s.qty,
        s.unit_code, s.roworder,
        sum(s.qty) over (partition by s.item_code order by s.roworder
                         rows between unbounded preceding and current row) cum,
        coalesce((select sum(case when d.trans_flag = $2 then d.qty else -d.qty end)
                  from ic_trans_detail d
                  where d.product_code = s.product_code and d.item_code = s.item_code
                    and d.trans_flag in ($2,$3)), 0) covered
      from tb_used_spare s where s.product_code = $1
    ) t order by rnum`;
  return (await query<Row>(sql, [productCode, TRANS.REQUEST, TRANS.RETURN_REQUEST])).rows;
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

  // ໃບນີ້ຈະມີແຕ່ແຖວທີ່ຍັງບໍ່ໄດ້ຂໍ — ອາໄຫຼ່ທີ່ຂໍ/ເບີກໄປແລ້ວ ບໍ່ຖືກຂໍຊ້ຳອີກ
  const pending = lines.filter((line) => !line.requested);
  const requested = lines.filter((line) => line.requested);

  return (
    <div className="w-full space-y-6">
      <PageTitle sub="ໃບຂໍເບີກ">ໃບຂໍເບີກອາໄຫຼ່</PageTitle>

      <RequestForm
        head={head}
        docNo={docNo}
        today={today}
        warehouses={wh.warehouses}
        shelves={wh.shelves}
        hasSpares={pending.length > 0}
      />

      <EditableSpareLines lines={pending} roworder={roworder} />

      {/* ຂໍໄປແລ້ວ — ສະແດງໄວ້ໃຫ້ຮູ້ ແຕ່ຈະບໍ່ເຂົ້າໃບໃໝ່ (ກັນສາງເບີກອາໄຫຼ່ຕົວດຽວກັນສອງເທື່ອ) */}
      {requested.length > 0 && (
        <Card title={`ຂໍເບີກໄປແລ້ວ ${requested.length} ລາຍການ (ຈະບໍ່ຖືກຂໍຊ້ຳ)`}>
          <Table head={["ລະຫັດສິນຄ້າ", "ຊື່ສິນຄ້າ", "ຈຳນວນ", "ຫົວໜ່ວຍ"]} minWidth={700}>
            {requested.map((line) => (
              <tr key={line.roworder} className="border-b border-slate-100 text-slate-500">
                <td className="px-3 py-3">{line.item_code}</td>
                <td className="px-3 py-3">{line.item_name ?? "-"}</td>
                <td className="px-3 py-3 text-center">{Number(line.qty)}</td>
                <td className="px-3 py-3 text-center">{line.unit_code ?? "-"}</td>
              </tr>
            ))}
          </Table>
          <p className="mt-3 text-xs text-slate-400">
            ອາໄຫຼ່ທີ່ຢູ່ໃນໃບຂໍເບີກເກົ່າແລ້ວ ຈະບໍ່ຖືກເອົາເຂົ້າໃບໃໝ່ — ຕິດຕາມສະຖານະໄດ້ທີ່ໜ້າ &quot;ໃບຂໍເບີກອາໄຫຼ່&quot;
          </p>
        </Card>
      )}

      {lines.length === 0 && <ErrorBox>ຍັງບໍ່ມີອາໄຫຼ່ໃນລາຍການ — ກົດ &quot;ເລືອກ&quot; ເພື່ອເພີ່ມອາໄຫຼ່</ErrorBox>}

      {lines.length > 0 && pending.length === 0 && (
        <ErrorBox>ອາໄຫຼ່ທຸກລາຍການຂອງວຽກນີ້ ຖືກຂໍເບີກ ຫຼື ເບີກອອກໄປແລ້ວ — ຖ້າຕ້ອງການອາໄຫຼ່ເພີ່ມ ໃຫ້ກົດ &quot;ເລືອກ&quot;</ErrorBox>
      )}
    </div>
  );
}
