import { DocForm } from "@/components/stock/doc-form";
import { SpareLineTable, type SpareLine } from "@/components/stock/spare-lines";
import { ErrorBox, PageTitle } from "@/components/ui";
import { query } from "@/lib/db";
import { docPrefix } from "@/lib/doc-no";
import { LINE_STATUS } from "@/lib/stock-constants";
import { notFound } from "next/navigation";

/** ods: stock.py /showdisp/<roworder> + templates/stock/showdispatch.html */

type Props = { params: Promise<{ roworder: string }> };

type Head = {
  doc_no: string;
  doc_date: string | null;
  customer: string | null;
  product: string | null;
  p_model: string | null;
  sn: string | null;
  issue: string | null;
  warranty: string | null;
  product_code: string | null;
};

async function previewDocNo() {
  const prefix = docPrefix("SWC");
  const sql = `select coalesce(max(substring(doc_no from ${prefix.length + 1})::int), 0) + 1 seq
    from ic_trans where doc_no like $1 and substring(doc_no from ${prefix.length + 1}) ~ '^[0-9]+$'`;
  const seq = (await query<{ seq: number }>(sql, [`${prefix}%`])).rows[0]?.seq ?? 1;
  return `${prefix}${String(seq).padStart(4, "0")}`;
}

export default async function ShowDispatchPage({ params }: Props) {
  const { roworder } = await params;

  const head = await query<Head>(
    `select a.doc_no, to_char(a.doc_date,'DD-MM-YYYY') doc_date,
       coalesce(b.name_1,'')||'-'||coalesce(b.tel,'') customer,
       c.name_1 product, c.p_model, c.sn, c.issue, c.warrunty warranty, a.product_code
     from ic_trans a
     left join tb_product c on c.code = a.product_code
     left join ar_customer b on b.code = c.cust_code
     where a.doc_no = (select doc_no from ic_trans_detail where roworder = $1)`,
    [roworder],
  );
  const bill = head.rows[0];
  if (!bill) notFound();

  // ສະເພາະແຖວທີ່ຍັງບໍ່ທັນເບີກ ແລະ ມີຂອງໃນສາງ/ທີ່ເກັບຂອງໃບຂໍເບີກນີ້
  const lines = await query<Omit<SpareLine, "roworder">>(
    `select row_number() over ()::int rnum, a.item_code, a.item_name, a.qty, a.unit_code
     from ic_trans_detail a
     left join ic_trans b on a.doc_no = b.doc_no
     where a.doc_no = $1 and a.status in ($2,$3)
       and (select round(balance_qty,2) from odg_stock_balance_location(a.item_code, b.wh_code, b.shelf_code) limit 1) > 0`,
    [bill.doc_no, LINE_STATUS.PENDING, LINE_STATUS.ON_PURCHASE_ORDER],
  );

  const docNo = await previewDocNo();
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });

  return (
    <div className="w-full space-y-6">
      <PageTitle sub="ເບີກອາໄຫຼ່">ໃບເບີກອາໄຫຼ່</PageTitle>

      <DocForm
        kind="dispatch"
        backHref="/stock/dispatch"
        docNo={docNo}
        today={today}
        docRef={bill.doc_no}
        productCode={bill.product_code ?? ""}
        defaultRemark={`${bill.product_code ?? ""} ${bill.customer ?? ""}`.trim()}
        disabled={lines.rows.length === 0}
        fields={[
          { label: "ເລກທິໃບກວດເຊັກ:", value: bill.doc_no },
          { label: "ວັນທີ:", value: bill.doc_date },
          { label: "ລູກຄ້າ:", value: bill.customer },
          { label: "ຊື່ສິນຄ້າ:", value: bill.product },
          { label: "ລູ້ນ/Model:", value: bill.p_model },
          { label: "ເລກເຄື່ອງ/sn:", value: bill.sn },
          { label: "ອາການເສຍ:", value: bill.issue, accent: true },
          { label: "ປະກັນ:", value: bill.warranty },
        ]}
      />

      <SpareLineTable lines={lines.rows} />

      {lines.rows.length === 0 && <ErrorBox>ບໍ່ມີອາໄຫຼ່ທີ່ເບີກໄດ້ໃນສາງນີ້</ErrorBox>}
    </div>
  );
}
