import { PrintButton } from "@/components/print-button";
import { query, queryOdg } from "@/lib/db";
import { poTotals } from "@/lib/erp-po";
import { ERP_PURCHASE, payTermLabel } from "@/lib/stock-constants";
import { notFound } from "next/navigation";

/**
 * **ໃບສັ່ງຊື້ (PO) — ໜ້າພິມ** ສົ່ງໃຫ້ຜູ້ສະໜອງ.
 *
 * ຮັບ**ເລກ PO ໂດຍກົງ** (ບໍ່ແມ່ນເລກ SPR ຄືໜ້າເອກະສານ) ເພາະໃບທີ່ພິມອອກຄື PO ໃບນັ້ນ.
 * ອ່ານທຸກຢ່າງຈາກ ERP — ຍອດຄິດດ້ວຍ `poTotals` ອັນດຽວກັບຕອນຂຽນໃບ ⇒ ເລກເທິງເຈ້ຍ
 * ຕົງກັບເລກໃນ ERP ສະເໝີ (ຢ່າຄິດຄືນເອງ). ຫົວບໍລິສັດມາຈາກ ODS `company_profile`
 * ຄືໜ້າພິມອື່ນຂອງລະບົບ.
 */
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ docNo: string }> };

type Head = {
  doc_no: string;
  doc_date: string | null;
  send_date: string | null;
  branch_code: string | null;
  remark: string | null;
  ref_doc: string | null;
  supplier_code: string | null;
  supplier_name: string | null;
  supplier_address: string | null;
  supplier_tel: string | null;
  transport_name: string | null;
  wh_name: string | null;
  currency_name: string | null;
  currency_symbol: string | null;
  exchange_rate: string | null;
  vat_type: number | null;
  vat_rate: string | null;
  /** 0 = ສົດ · >0 = ຕິດໜີ້ N ວັນ (ເບິ່ງ payTermLabel) */
  credit_day: number | null;
  /** ວັນຄົບກຳນົດຈ່າຍ — ERP ຄິດເປັນ doc_date + credit_day */
  credit_date: string | null;
  /** ລະຫັດພະນັກງານ — ຊື່ຢູ່ ODS (odg_erp_user) ຄົນລະຖານ ⇒ ດຶງແຍກ */
  creator_code: string | null;
};

type Line = { item_code: string; item_name: string | null; unit_code: string | null; qty: string; price: string; sum_amount: string };
type Company = { name_1: string | null; name_2: string | null; address: string | null; tel: string | null };

const money = (value: number) => value.toLocaleString(undefined, { maximumFractionDigits: 2 });

export default async function PrintPoPage({ params }: Props) {
  const { docNo } = await params;
  const poNo = decodeURIComponent(docNo);

  const head = (
    await queryOdg<Head>(
      `select t.doc_no,
          to_char(t.doc_date,'DD-MM-YYYY') doc_date,
          to_char(t.send_date,'DD-MM-YYYY') send_date,
          t.branch_code, t.remark, t.doc_ref ref_doc,
          t.cust_code supplier_code,
          (select s.name_1 from ap_supplier s where s.code=t.cust_code limit 1) supplier_name,
          (select nullif(s.address,'') from ap_supplier s where s.code=t.cust_code limit 1) supplier_address,
          (select nullif(s.telephone,'') from ap_supplier s where s.code=t.cust_code limit 1) supplier_tel,
          (select coalesce(nullif(tt.name_1,''), tt.code) from transport_type tt where tt.code=t.transport_code limit 1) transport_name,
          (select coalesce(nullif(w.name_1,''), w.code) from ic_warehouse w
            where w.code = (select d.wh_code from ic_trans_detail d
                             where d.doc_no=t.doc_no and d.trans_flag=$2 and coalesce(d.wh_code,'') <> '' limit 1) limit 1) wh_name,
          (select coalesce(nullif(c.name_1,''), c.code) from erp_currency c where c.code=t.currency_code limit 1) currency_name,
          (select c.symbol from erp_currency c where c.code=t.currency_code limit 1) currency_symbol,
          t.exchange_rate::text, t.vat_type, t.vat_rate::text,
          t.credit_day, to_char(t.credit_date,'DD-MM-YYYY') credit_date,
          nullif(t.creator_code,'') creator_code
        from ic_trans t where t.doc_no=$1 and t.trans_flag=$2`,
      [poNo, ERP_PURCHASE.ORDER],
    )
  ).rows[0];
  if (!head) notFound();

  const [lines, company, creator] = await Promise.all([
    queryOdg<Line>(
      `select item_code, item_name, unit_code, qty::text, coalesce(price,0)::text price,
          coalesce(sum_amount,0)::text sum_amount
         from ic_trans_detail where doc_no=$1 and trans_flag=$2 order by line_number`,
      [poNo, ERP_PURCHASE.ORDER],
    ).then((r) => r.rows),
    query<Company>(`select name_1, name_2, address, tel from company_profile limit 1`).then((r) => r.rows[0] ?? null),
    // ຊື່ພະນັກງານຢູ່ **ODS** (odg_erp_user) — ຂ້າມຖານ join ບໍ່ໄດ້ ຈຶ່ງດຶງແຍກ
    head.creator_code
      ? query<{ name_1: string }>(`select name_1 from odg_erp_user where code=$1 limit 1`, [head.creator_code]).then(
          (r) => r.rows[0]?.name_1 ?? null,
        )
      : Promise.resolve(null),
  ]);

  const value = lines.reduce((sum, line) => sum + Number(line.sum_amount), 0);
  // ນິຍາມ VAT ອັນດຽວກັບຕອນຂຽນໃບ — ຢ່າຄິດຄືນເອງ
  const totals = poTotals(value, { vat_type: head.vat_type ?? 2, vat_rate: Number(head.vat_rate ?? 0) });
  const symbol = head.currency_symbol ?? "";

  return (
    <div className="mx-auto max-w-3xl bg-white p-8 text-slate-950 print:p-0">
      <style>{`@media print { .no-print { display: none !important } @page { margin: 12mm } }`}</style>

      <div className="no-print mb-6 flex items-center justify-between">
        <p className="text-sm text-slate-500">ກົດປຸ່ມ ຫຼື Ctrl/Cmd + P ເພື່ອພິມ</p>
        <PrintButton />
      </div>

      <header className="flex items-start justify-between gap-6 border-b-2 border-slate-900 pb-4">
        <div className="text-sm leading-6">
          <p className="text-base font-bold">{company?.name_1}</p>
          <p>{company?.name_2}</p>
          <p>{company?.address}</p>
          <p>{company?.tel}</p>
        </div>
        <div className="text-right text-sm">
          <p className="font-mono text-base font-bold">{head.doc_no}</p>
          <p>ວັນທີ {head.doc_date ?? "-"}</p>
          <p>ສາຂາ {head.branch_code === "05" ? "ໂອດ່ຽນໄທ" : head.branch_code === "00" ? "ສຳນັກງານໃຫ່ຍ" : (head.branch_code ?? "-")}</p>
        </div>
      </header>

      <h1 className="my-4 text-center text-xl font-bold">ໃບສັ່ງຊື້</h1>

      <section className="mb-3 grid grid-cols-2 gap-x-6 gap-y-1 rounded border border-slate-300 p-3 text-sm">
        <p>
          <span className="text-slate-500">ຜູ້ສະໜອງ: </span>
          <b>{head.supplier_name ?? head.supplier_code ?? "-"}</b>
        </p>
        <p>
          <span className="text-slate-500">ຄາດວ່າຈະມາຮອດ: </span>
          {head.send_date ?? "-"}
        </p>
        {head.supplier_address && (
          <p>
            <span className="text-slate-500">ທີ່ຢູ່: </span>
            {head.supplier_address}
          </p>
        )}
        <p>
          <span className="text-slate-500">ຊ່ອງທາງຈັດສົ່ງ: </span>
          {head.transport_name ?? "-"}
        </p>
        {head.supplier_tel && (
          <p>
            <span className="text-slate-500">ໂທ: </span>
            {head.supplier_tel}
          </p>
        )}
        <p>
          <span className="text-slate-500">ສາງທີ່ຮັບເຂົ້າ: </span>
          {head.wh_name ?? "-"}
        </p>
        <p>
          <span className="text-slate-500">ສະກຸນເງິນ: </span>
          {head.currency_name ?? "-"}
          {head.exchange_rate && Number(head.exchange_rate) !== 1 && ` (× ${Number(head.exchange_rate)})`}
        </p>
        {/* ສົດ/ຕິດໜີ້ — ຜູ້ສະໜອງຕ້ອງເຫັນເງື່ອນໄຂຈ່າຍຢູ່ໜ້າເຈ້ຍ ບໍ່ແມ່ນຮູ້ກັນແຕ່ໃນລະບົບ */}
        <p>
          <span className="text-slate-500">ການຈ່າຍເງິນ: </span>
          <b>{payTermLabel(head.credit_day)}</b>
          {Boolean(head.credit_day) && head.credit_date && ` (ຄົບກຳນົດ ${head.credit_date})`}
        </p>
        {head.ref_doc && (
          <p>
            <span className="text-slate-500">ອ້າງອີງ: </span>
            {head.ref_doc}
          </p>
        )}
        {head.remark && (
          <p className="col-span-2">
            <span className="text-slate-500">ໝາຍເຫດ: </span>
            {head.remark}
          </p>
        )}
      </section>

      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-y border-slate-900 text-left">
            <th className="w-8 py-1.5">#</th>
            <th className="py-1.5">ລາຍການ</th>
            <th className="w-20 py-1.5 text-right">ຈຳນວນ</th>
            <th className="w-16 py-1.5">ຫົວໜ່ວຍ</th>
            <th className="w-28 py-1.5 text-right">ລາຄາ</th>
            <th className="w-28 py-1.5 text-right">ລວມ</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line, index) => (
            <tr key={line.item_code} className="border-b border-slate-200 align-top">
              <td className="py-1.5">{index + 1}</td>
              <td className="py-1.5">
                <span className="block">{line.item_name ?? "-"}</span>
                <span className="block font-mono text-[10px] text-slate-500">{line.item_code}</span>
              </td>
              <td className="py-1.5 text-right tabular-nums">{Number(line.qty).toLocaleString()}</td>
              <td className="py-1.5">{line.unit_code ?? "-"}</td>
              <td className="py-1.5 text-right tabular-nums">{money(Number(line.price))}</td>
              <td className="py-1.5 text-right tabular-nums">{money(Number(line.sum_amount))}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-3 flex justify-end">
        <dl className="w-64 space-y-1 text-sm">
          <div className="flex justify-between">
            <dt className="text-slate-500">{head.vat_type === 0 ? "ຍອດກ່ອນ VAT" : "ຍອດ (ລວມ VAT ແລ້ວ)"}</dt>
            <dd className="tabular-nums">{money(totals.value)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-500">
              VAT {Number(head.vat_rate ?? 0)}%{head.vat_type === 2 && " (ລວມໃນລາຄາ)"}
            </dt>
            <dd className="tabular-nums">{money(totals.vat_value)}</dd>
          </div>
          <div className="flex justify-between border-t border-slate-900 pt-1 text-base font-bold">
            <dt>ລວມທັງໝົດ</dt>
            <dd className="tabular-nums">
              {money(totals.amount)} {symbol}
            </dd>
          </div>
        </dl>
      </div>

      <footer className="mt-12 grid grid-cols-3 gap-6 text-center text-sm">
        {["ຜູ້ສັ່ງຊື້", "ຜູ້ອະນຸມັດ", "ຜູ້ສະໜອງ"].map((role, index) => (
          <div key={role}>
            <div className="h-14 border-b border-slate-400" />
            <p className="mt-1">{role}</p>
            {index === 0 && creator && <p className="text-xs text-slate-500">{creator}</p>}
          </div>
        ))}
      </footer>
    </div>
  );
}
