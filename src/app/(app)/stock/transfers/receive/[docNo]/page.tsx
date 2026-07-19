import { Card, ErrorBox, PageTitle, Table } from "@/components/ui";
import { query } from "@/lib/db";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getLocale } from "@/lib/i18n/locale";
import { getBalances } from "@/lib/stock-balance";
import { DEFAULT_WH, LINE_STATUS, TRANS } from "@/lib/stock-constants";
import { notFound } from "next/navigation";
import { ReceiveTransferForm } from "./receive-transfer-form";

/**
 * ຮັບຂອງທີ່ໂອນມາ (ປິດໃບຂໍໂອນ 124) — ຂັ້ນນີ້ບໍ່ມີໃນ ods.
 * ໜ້ານີ້ບອກຄວາມຈິງກ່ອນກົດ: ຍອດຄົງເຫຼືອຈິງຂອງ ERP ຢູ່ສາງປາຍທາງເປັນເທົ່າໃດ.
 * ຖ້າຍັງເປັນ 0 ແປວ່າ ERP ຍັງບໍ່ໄດ້ອອກໃບໂອນ (FT) — ຮັບຂອງບໍ່ໄດ້ (action ກໍ່ກວດຊ້ຳອີກ).
 */

type Props = { params: Promise<{ docNo: string }> };

type Head = {
  doc_no: string;
  doc_date: string | null;
  doc_ref: string | null;
  doc_ref_date: string | null;
  product_code: string | null;
  product: string | null;
  sn: string | null;
  customer: string | null;
  wh_code: string | null;
  shelf_code: string | null;
  remark: string | null;
  status: number | null;
};

type Line = { item_code: string; item_name: string | null; qty: string; unit_code: string | null };

export default async function ReceiveTransferPage({ params }: Props) {
  const t = (await getDictionary(await getLocale())).transfersReceive;
  const { docNo } = await params;
  const code = decodeURIComponent(docNo);

  const head = (
    await query<Head>(
      `select a.doc_no, to_char(a.doc_date,'DD-MM-YYYY') doc_date, a.doc_ref,
         to_char(a.doc_ref_date::date,'DD-MM-YYYY') doc_ref_date, a.product_code,
         c.name_1 product, c.sn, coalesce(d.name_1,'')||'-'||coalesce(d.tel,'') customer,
         a.wh_code, a.shelf_code, a.remark, a.status
       from ic_trans a
       left join tb_product c on c.code = a.product_code
       left join ar_customer d on d.code = c.cust_code
       where a.doc_no = $1 and a.trans_flag = $2
       limit 1`,
      [code, TRANS.TRANSFER],
    )
  ).rows[0];
  if (!head) notFound();

  const lines = (
    await query<Line>(
      `select item_code, item_name, qty, unit_code from ic_trans_detail
       where doc_no = $1 and trans_flag = $2 order by roworder`,
      [code, TRANS.TRANSFER],
    )
  ).rows;

  const toWh = head.wh_code || DEFAULT_WH;
  const balances = await getBalances(lines.map((line) => line.item_code));
  const arrived = lines.map((line) => ({
    ...line,
    inWh: balances.get(line.item_code)?.byWarehouse.get(toWh) ?? 0,
  }));

  const received = (head.status ?? 0) === LINE_STATUS.ISSUED;
  const ready = arrived.length > 0 && arrived.every((line) => line.inWh > 0);

  return (
    <div className="w-full space-y-6">
      <PageTitle sub={`${t.subDestWarehouse} ${toWh})`}>{t.title}</PageTitle>

      <ReceiveTransferForm
        docNo={head.doc_no}
        itemName={arrived.map((line) => line.item_name ?? line.item_code).join(", ")}
        defaultRemark={head.remark ?? ""}
        disabled={received || !ready}
        fields={[
          { label: t.fieldRequestDate, value: head.doc_date },
          { label: t.fieldRequestNo, value: head.doc_ref },
          { label: t.fieldRequestDocDate, value: head.doc_ref_date },
          { label: t.fieldCustomer, value: head.customer },
          { label: t.fieldProductName, value: head.product },
          { label: t.fieldSn, value: head.sn },
          { label: t.fieldToWarehouse, value: `${toWh} / ${head.shelf_code ?? "-"}`, accent: true },
        ]}
      />

      {received && <ErrorBox>{t.alreadyReceived}</ErrorBox>}
      {!received && !ready && (
        <ErrorBox>
          {t.notArrivedPrefix} {toWh} {t.notArrivedSuffix}
        </ErrorBox>
      )}

      <Card title={t.cardTitle}>
        <Table head={["#", t.colItemCode, t.colItemName, t.colQty, t.colUnit, `${t.colBalanceWarehouse} ${toWh}`, t.colStatus]} minWidth={900}>
          {arrived.map((line, index) => (
            <tr key={`${line.item_code}-${index}`} className="border-b border-slate-100">
              <td className="px-3 py-3 text-center">{index + 1}</td>
              <td className="px-3 py-3">{line.item_code}</td>
              <td className="px-3 py-3">{line.item_name ?? "-"}</td>
              <td className="px-3 py-3 text-center">{Number(line.qty)}</td>
              <td className="px-3 py-3 text-center">{line.unit_code ?? "-"}</td>
              <td className="px-3 py-3 text-center font-semibold text-emerald-700">{line.inWh}</td>
              <td className="px-3 py-3 text-center">
                <span
                  className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                    line.inWh > 0 ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
                  }`}
                >
                  {line.inWh > 0 ? t.arrived : t.notArrived}
                </span>
              </td>
            </tr>
          ))}
        </Table>
      </Card>

      {arrived.length === 0 && <ErrorBox>{t.noSpares}</ErrorBox>}
    </div>
  );
}
