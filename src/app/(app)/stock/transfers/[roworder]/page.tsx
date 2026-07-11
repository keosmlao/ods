import { Card, ErrorBox, PageTitle, Table } from "@/components/ui";
import { query, queryOdg } from "@/lib/db";
import { docPrefix } from "@/lib/doc-no";
import { LINE_STATUS, TRANS } from "@/lib/stock-constants";
import Link from "next/link";
import { notFound } from "next/navigation";
import { TransferForm } from "./transfer-form";

/** ods: stock.py /showrequesttrans/<id>/<doc_code> (:993) + templates/stock/showstockretrans.html */

type Props = { params: Promise<{ roworder: string }> };

type Line = {
  roworder: number;
  doc_no: string;
  doc_date: string | null;
  customer: string | null;
  product: string | null;
  p_model: string | null;
  sn: string | null;
  issue: string | null;
  warranty: string | null;
  product_code: string | null;
  item_code: string;
  item_name: string | null;
  qty: string;
  unit_code: string | null;
  /** ຍອດຄົງເຫຼືອລວມທຸກສາງ ແລະ ຍອດໃນສາງຂອງໃບຂໍເບີກ */
  total_balance: string | null;
  wh_balance: string | null;
  /** ຂໍໂອນລາຍການນີ້ໄປແລ້ວບໍ */
  transfer_requested: boolean;
};

/**
 * ເລກທີໃບຂໍໂອນອັນຕໍ່ໄປ (ສະແດງລ່ວງໜ້າ — ເລກຈິງອອກຕອນບັນທຶກໃນ transaction ທີ່ລັອກແລ້ວ).
 * ເບິ່ງທັງ ODS ແລະ ERP ເພາະລະບົບເກົ່າ (Flask) ຍັງອອກເລກ SFRK ລົງ ERP ຢູ່.
 */
async function previewDocNo() {
  const prefix = docPrefix("SFRK");
  const sql = `select coalesce(max(substring(doc_no from ${prefix.length + 1})::int), 0) + 1 seq
    from ic_trans where doc_no like $1 and substring(doc_no from ${prefix.length + 1}) ~ '^[0-9]+$'`;
  const [ods, erp] = await Promise.all([
    query<{ seq: number }>(sql, [`${prefix}%`]),
    queryOdg<{ seq: number }>(sql, [`${prefix}%`]),
  ]);
  const seq = Math.max(ods.rows[0]?.seq ?? 1, erp.rows[0]?.seq ?? 1);
  return `${prefix}${String(seq).padStart(4, "0")}`;
}

/** ແຖວອາໄຫຼ່ທີ່ຈະຂໍໂອນ ພ້ອມຫົວໃບຂໍເບີກຂອງມັນ */
async function getLine(roworder: string) {
  const sql = `select a.roworder, a.doc_no, to_char(b.doc_date,'DD-MM-YYYY') doc_date,
      coalesce(d.name_1,'')||'-'||coalesce(d.tel,'') customer,
      c.name_1 product, c.p_model, c.sn, c.issue, c.warrunty warranty, a.product_code,
      a.item_code, a.item_name, a.qty, a.unit_code,
      round(st.total_balance, 2)::text total_balance,
      round(st.current_wh_balance, 2)::text wh_balance,
      exists(select 1 from ic_trans t
             join ic_trans_detail td on td.doc_no = t.doc_no and td.trans_flag = t.trans_flag
             where t.trans_flag = $2 and t.doc_ref = a.doc_no and td.item_code = a.item_code
               and coalesce(t.status,0) = ${LINE_STATUS.PENDING}) transfer_requested
    from ic_trans_detail a
    left join ic_trans b on b.doc_no = a.doc_no
    left join tb_product c on c.code = a.product_code
    left join ar_customer d on d.code = c.cust_code
    cross join lateral (
      select sum(coalesce(balance_qty,0)) total_balance,
        sum(case when wh_code = b.wh_code then coalesce(balance_qty,0) else 0 end) current_wh_balance
      from odg_stock_balance_location(a.item_code, '', '')
    ) st
    where a.roworder = $1 and a.trans_flag = $3
    limit 1`;
  return (await query<Line>(sql, [roworder, TRANS.TRANSFER, TRANS.REQUEST])).rows[0] ?? null;
}

export default async function TransferRequestPage({ params }: Props) {
  const { roworder } = await params;
  const line = await getLine(roworder);
  if (!line) notFound();

  const docNo = await previewDocNo();
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });
  const otherWh = Number(line.total_balance ?? 0) - Number(line.wh_balance ?? 0);

  return (
    <div className="w-full space-y-6">
      <PageTitle sub="ຂໍໂອນອາໄຫຼ່ຈາກສາງອື່ນເຂົ້າສາງຂອງໃບຂໍເບີກ — ໃບນີ້ບໍ່ຂະຫຍັບສະຕັອກ, ສາງໃຫຍ່ຕ້ອງອອກໃບໂອນ (FT) ໃນ ERP">
        ໃບຂໍໂອນອາໄຫຼ່
      </PageTitle>

      <TransferForm
        docNo={docNo}
        today={today}
        docRef={line.doc_no}
        roworder={line.roworder}
        itemName={line.item_name ?? line.item_code}
        defaultRemark={`${line.product_code ?? ""} ${line.customer ?? ""}`.trim()}
        fields={[
          { label: "ເລກທິໃບຂໍເບີກ:", value: line.doc_no },
          { label: "ວັນທີ:", value: line.doc_date },
          { label: "ລູກຄ້າ:", value: line.customer },
          { label: "ຊື່ສິນຄ້າ:", value: line.product },
          { label: "ລູ້ນ/Model:", value: line.p_model },
          { label: "ເລກເຄື່ອງ/sn:", value: line.sn },
          { label: "ອາການເສຍ:", value: line.issue, accent: true },
          { label: "ປະກັນ:", value: line.warranty },
        ]}
      />

      {line.transfer_requested && (
        <ErrorBox>
          ອາໄຫຼ່ລາຍການນີ້ຂໍໂອນໄປແລ້ວ ແລະ ຍັງລໍຖ້າຂອງມາຮອດ —{" "}
          <Link href="/stock/transfers" className="font-semibold underline">
            ເບິ່ງໜ້າຕິດຕາມການໂອນ
          </Link>
        </ErrorBox>
      )}

      <Card title="ອາໄຫຼ່ທີ່ຂໍໂອນ">
        <Table head={["#", "ລະຫັດສິນຄ້າ", "ຊື່ສິນຄ້າ", "ຈຳນວນ", "ຫົວໜ່ວຍ", "ຄົງເຫຼືອສາງນີ້", "ຄົງເຫຼືອສາງອື່ນ"]} minWidth={900}>
          <tr className="border-b border-slate-100">
            <td className="px-3 py-3 text-center">1</td>
            <td className="px-3 py-3">{line.item_code}</td>
            <td className="px-3 py-3">{line.item_name ?? "-"}</td>
            <td className="px-3 py-3 text-center">{Number(line.qty)}</td>
            <td className="px-3 py-3 text-center">{line.unit_code ?? "-"}</td>
            <td className="px-3 py-3 text-center">{Number(line.wh_balance ?? 0)}</td>
            <td className="px-3 py-3 text-center font-semibold text-emerald-700">{otherWh}</td>
          </tr>
        </Table>
      </Card>
    </div>
  );
}
