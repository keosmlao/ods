import { DocForm } from "@/components/stock/doc-form";
import { SpareLineTable, type SpareLine } from "@/components/stock/spare-lines";
import { Card, ErrorBox, PageTitle, Table } from "@/components/ui";
import { query } from "@/lib/db";
import { docPrefix } from "@/lib/doc-no";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getLocale } from "@/lib/i18n/locale";
import { LINE_STATUS, TRANS } from "@/lib/stock-constants";
import { AlertTriangle } from "lucide-react";
import { notFound } from "next/navigation";

/** ods: stock.py /showdisp/<roworder> + templates/stock/showdispatch.html */

type Props = { params: Promise<{ roworder: string }> };

/** ແຖວທີ່ຂໍມາ ແຕ່ເບີກບໍ່ໄດ້ (ບໍ່ມີຂອງໃນສາງ/ທີ່ເກັບຂອງໃບຂໍເບີກນີ້) */
type Missing = { item_code: string; item_name: string | null; qty: string; unit_code: string | null; status: number | null };

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
  const t = (await getDictionary(await getLocale())).dispatchRoworder;

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

  /*
   * ແຖວທີ່ຈະ **ບໍ່** ຖືກເບີກເທື່ອນີ້ — ເມື່ອກ່ອນບໍ່ໄດ້ສະແດງເລີຍ: ສາງກົດ "ບັນທຶກ" ໂດຍນຶກວ່າ
   * ເບີກຄົບ ແຕ່ຄວາມຈິງເບີກໄດ້ພຽງບາງລາຍການ. ດຽວນີ້ບອກໃຫ້ຮູ້ກ່ອນບັນທຶກ ແລະ ວຽກຈະຄ້າງຢູ່
   * ຂັ້ນອາໄຫຼ່ຕໍ່ໄປ (ບໍ່ຖືກ stamp spare_finish — ເບິ່ງ actions/stock.ts saveDispatch).
   * ນັບແຖວທີ່ຄ້າງຂອງ **ທຸກ** ໃບຂໍເບີກຂອງວຽກນີ້ ບໍ່ແມ່ນສະເພາະໃບນີ້.
   */
  const missing = await query<Missing>(
    `select a.item_code, a.item_name, a.qty::text qty, a.unit_code, a.status
     from ic_trans_detail a
     left join ic_trans b on a.doc_no = b.doc_no
     where a.trans_flag = $1 and a.product_code = $2 and a.status in ($3,$4)
       and coalesce((select round(balance_qty,2) from odg_stock_balance_location(a.item_code, b.wh_code, b.shelf_code) limit 1), 0) <= 0
     order by a.doc_no, a.roworder`,
    [TRANS.REQUEST, bill.product_code ?? "", LINE_STATUS.PENDING, LINE_STATUS.ON_PURCHASE_ORDER],
  );

  const docNo = await previewDocNo();
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });

  return (
    <div className="w-full space-y-6">
      <PageTitle sub={t.pageSub}>{t.pageTitle}</PageTitle>

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

      {/* ເບີກບໍ່ຄົບ → ບອກໃຫ້ຮູ້ກ່ອນກົດບັນທຶກ */}
      {missing.rows.length > 0 && (
        <p className="flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
          <AlertTriangle className="size-4 shrink-0" />
          {t.notEnough} {missing.rows.length} {t.notEnoughSuffix}
        </p>
      )}

      <SpareLineTable lines={lines.rows} />

      {missing.rows.length > 0 && (
        <Card title={`${t.missingTitle} ${missing.rows.length} ${t.missingTitleSuffix}`}>
          <Table head={[t.colCode, t.colSpareName, t.colQty, t.colUnit, t.colStatus]} minWidth={700}>
            {missing.rows.map((line) => (
              <tr key={line.item_code} className="border-b border-slate-100">
                <td className="px-3 py-3">{line.item_code}</td>
                <td className="px-3 py-3">{line.item_name ?? "-"}</td>
                <td className="px-3 py-3 text-center">{Number(line.qty)}</td>
                <td className="px-3 py-3 text-center">{line.unit_code ?? "-"}</td>
                <td className="px-3 py-3 text-center">
                  {line.status === LINE_STATUS.ON_PURCHASE_ORDER ? (
                    <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-700">
                      {t.purchasing}
                    </span>
                  ) : (
                    <span className="rounded bg-red-50 px-1.5 py-0.5 text-[10px] font-semibold text-red-700">
                      {t.notInThisWarehouse}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </Table>
          <p className="mt-3 text-xs text-slate-400">{t.transferOrPurchaseHint}</p>
        </Card>
      )}

      {lines.rows.length === 0 && <ErrorBox>{t.noSpareAvailable}</ErrorBox>}
    </div>
  );
}
