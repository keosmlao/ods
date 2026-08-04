import { DocForm } from "@/components/stock/doc-form";
import type { SpareLine } from "@/components/stock/spare-lines";
import { Card, ErrorBox, PageTitle, Table } from "@/components/ui";
import { query } from "@/lib/db";
import { docPrefix } from "@/lib/doc-no";
import { syncErpDispatchForDocRef } from "@/lib/erp-dispatch";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getLocale } from "@/lib/i18n/locale";
import { LINE_STATUS } from "@/lib/stock-constants";
import { getBalances } from "@/lib/stock-balance";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { notFound, redirect } from "next/navigation";

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
  wh_code: string | null;
  shelf_code: string | null;
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
       c.name_1 product, c.p_model, c.sn, c.issue, c.warrunty warranty, a.product_code,
       a.wh_code, a.shelf_code
     from ic_trans a
     left join tb_product c on c.code = a.product_code
     left join ar_customer b on b.code = c.cust_code
     where a.doc_no = (select doc_no from ic_trans_detail where roworder = $1)`,
    [roworder],
  );
  const bill = head.rows[0];
  if (!bill) notFound();

  // ກວດໃບນີ້ຈາກ ERP ໂດຍກົງ: ERP SWC.doc_ref = ODS SIO.doc_no.
  // ຖ້າສາງເບີກໃນ ERP ໄປແລ້ວ ດຶງເຂົ້າ ODS ທັນທີ ແລ້ວພາໄປຫນ້າຊ່າງຮັບອາໄຫຼ່.
  const erpSync = await syncErpDispatchForDocRef(bill.doc_no);
  if (erpSync.imported > 0) redirect(`/stock/requests/pickup?q=${encodeURIComponent(bill.doc_no)}`);

  const lines = await query<Omit<SpareLine, "roworder"> & { status: number | null }>(
    `select row_number() over ()::int rnum, a.item_code, a.item_name, a.qty, a.unit_code
       ,a.status
     from ic_trans_detail a
     where a.doc_no = $1 and a.status in ($2,$3)
     order by a.roworder`,
    [bill.doc_no, LINE_STATUS.PENDING, LINE_STATUS.ON_PURCHASE_ORDER],
  );
  const balances = await getBalances(lines.rows.map((line) => line.item_code));
  const warehouse = bill.wh_code ?? "";
  const shelf = bill.shelf_code ?? "";
  const locationKey = `${warehouse}:${shelf}`;
  const requestedByItem = new Map<string, number>();
  for (const line of lines.rows) requestedByItem.set(line.item_code, (requestedByItem.get(line.item_code) ?? 0) + Number(line.qty));
  const available = (itemCode: string) => {
    const balance = balances.get(itemCode);
    return shelf ? (balance?.byLocation.get(locationKey) ?? 0) : (balance?.byWarehouse.get(warehouse) ?? 0);
  };
  const insufficient = [...requestedByItem].filter(([itemCode, qty]) => available(itemCode) < qty);

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
        disabled={lines.rows.length === 0 || insufficient.length > 0}
        fields={[
          { label: "ເລກທິໃບກວດເຊັກ:", value: bill.doc_no },
          { label: "ວັນທີ:", value: bill.doc_date },
          { label: "ລູກຄ້າ:", value: bill.customer },
          { label: "ຊື່ສິນຄ້າ:", value: bill.product },
          { label: "ລູ້ນ/Model:", value: bill.p_model },
          { label: "ເລກເຄື່ອງ/sn:", value: bill.sn },
          { label: "ອາການເສຍ:", value: bill.issue, accent: true },
          { label: "ປະກັນ:", value: bill.warranty },
          { label: "ສາງ/ບ່ອນເກັບ:", value: `${bill.wh_code ?? "-"} / ${bill.shelf_code ?? "-"}` },
        ]}
      />

      {/* ເບີກບໍ່ຄົບ → ບອກໃຫ້ຮູ້ກ່ອນກົດບັນທຶກ */}
      {insufficient.length > 0 && (
        <p className="flex items-center gap-2 rounded-lg border border-brand-orange-400 bg-brand-orange-100 px-4 py-3 text-sm font-semibold text-brand-900">
          <AlertTriangle className="size-4 shrink-0" />
          ສິນຄ້າໃນສາງ/ບ່ອນເກັບບໍ່ພໍ {insufficient.length} ລາຍການ — ຍັງບໍ່ສາມາດກົດເບີກໄດ້
        </p>
      )}

      <Card title={`ລາຍການອາໄຫຼ່ · ສາງ ${bill.wh_code ?? "-"} / ${bill.shelf_code ?? "-"}`}>
        <Table head={["#", t.colCode, t.colSpareName, "ຈຳນວນທີ່ຂໍ", "ມີໃນສາງ", t.colUnit, "ກວດສອບ"]} minWidth={850}>
          {lines.rows.map((line) => {
            const stock = available(line.item_code);
            const needed = requestedByItem.get(line.item_code) ?? Number(line.qty);
            const enough = stock >= needed;
            return (
              <tr key={`${line.item_code}-${line.rnum}`} className="border-b border-slate-100">
                <td className="px-3 py-3 text-center">{line.rnum}</td>
                <td className="px-3 py-3">{line.item_code}</td>
                <td className="px-3 py-3">{line.item_name ?? "-"}</td>
                <td className="px-3 py-3 text-center">{Number(line.qty)}</td>
                <td className={`px-3 py-3 text-center font-bold ${enough ? "text-brand-800" : "text-brand-orange-700"}`}>{stock.toLocaleString()}</td>
                <td className="px-3 py-3 text-center">{line.unit_code ?? "-"}</td>
                <td className="px-3 py-3 text-center">
                  {enough ? (
                    <span className="inline-flex items-center gap-1 rounded bg-brand-50 px-2 py-1 text-[10px] font-semibold text-brand-800">
                      <CheckCircle2 className="size-3" /> ພຽງພໍ
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded bg-brand-orange-50 px-2 py-1 text-[10px] font-semibold text-brand-orange-700">
                      <AlertTriangle className="size-3" /> ຂາດ {Math.max(0, needed - stock).toLocaleString()}
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </Table>
      </Card>

      {lines.rows.length === 0 && <ErrorBox>{t.noSpareAvailable}</ErrorBox>}
    </div>
  );
}
