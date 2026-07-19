import { PrintButton } from "@/components/quotation/print-button";
import { query } from "@/lib/db";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getLocale } from "@/lib/i18n/locale";
import Link from "next/link";
import { notFound } from "next/navigation";

/** ຖອດແບບຈາກ ods: bill.py qutationprint() + templates/invoice.html */

type Props = { params: Promise<{ docNo: string }> };

type Company = { name_1: string | null; name_2: string | null; address: string | null; tel: string | null };

type Head = {
  doc_no: string;
  doc_date: string | null;
  customer: string | null;
  tel: string | null;
  address: string | null;
  city: string | null;
  province: string | null;
  product: string | null;
  model: string | null;
  sn: string | null;
  brand: string | null;
  warranty: string | null;
  issue_2: string | null;
  technician: string | null;
  user_created: string | null;
  total_value: string;
  total_discount: string;
  vat_rate: string;
  total_vat_value: string;
  total_amount: string;
  exchange_rate: string | null;
  total_amount_2: string | null;
  remark: string | null;
};

type Line = { item_name: string; qty: string; unit_code: string | null; price: string; sum_amount: string };

const money = (v: string | number | null) => {
  const n = Number(String(v ?? "0").replace(/,/g, ""));
  return (Number.isFinite(n) ? n : 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export default async function QuotationPrintPage({ params }: Props) {
  const { docNo } = await params;
  const t = (await getDictionary(await getLocale())).quotationPrint;

  const [companyResult, headResult, lineResult] = await Promise.all([
    query<Company>("select name_1, name_2, address, tel from company_profile"),
    query<Head>(
      `select a.doc_no, to_char(a.doc_date,'DD-MM-YYYY') doc_date, b.name_1 customer, b.tel, b.address,
          g.name_1 city, f.name_1 province, c.name_1 product, c.p_model model, c.sn, c.p_brand brand,
          c.warrunty warranty, c.issue_2, c.emp_code technician, a.user_created, a.remark,
          coalesce(a.total_value, 0)::text total_value,
          coalesce(a.total_discount, 0)::text total_discount,
          coalesce(a.vat_rate, 0)::text vat_rate,
          coalesce(a.total_vat_value, 0)::text total_vat_value,
          coalesce(a.total_amount, 0)::text total_amount,
          a.exchange_rate::text exchange_rate,
          a.total_amount_2::text total_amount_2
        from ic_trans a
        left join ar_customer b on b.code = a.cust_code
        left join tb_product c on c.code = a.product_code
        left join province f on b.provine = f.code
        left join city g on g.code = b.city and g.province = b.provine
        where a.doc_no = $1 and a.trans_flag = 17`,
      [docNo],
    ),
    query<Line>(
      "select item_name, qty, unit_code, price, sum_amount from ic_trans_detail where doc_no=$1 order by roworder",
      [docNo],
    ),
  ]);

  const head = headResult.rows[0];
  if (!head) notFound();
  const company = companyResult.rows[0];
  const lines = lineResult.rows;

  return (
    <div className="mx-auto w-full max-w-4xl bg-white p-8 text-slate-950 print:p-0">
      <div className="no-print mb-6 flex items-center justify-between print:hidden">
        <Link href="/quotations" className="text-sm text-slate-500 hover:underline">
          ← {t.back}
        </Link>
        <PrintButton />
      </div>

      <header className="flex items-start justify-between gap-6 border-b-2 border-slate-900 pb-4">
        <div>
          <h1 className="text-xl font-bold">{company?.name_1 ?? "-"}</h1>
          <p className="text-sm">{company?.name_2 ?? ""}</p>
          <p className="text-sm">{company?.address ?? ""}</p>
          <p className="text-sm">{company?.tel ?? ""}</p>
        </div>
        <div className="text-right text-sm">
          <p>{t.docNo} {head.doc_no}</p>
          <p>{t.date} {head.doc_date ?? "-"}</p>
        </div>
      </header>

      <h2 className="my-5 text-center text-2xl font-bold">{t.title}</h2>

      <section className="mb-4 text-sm">
        <p className="font-bold">{t.customerInfo}</p>
        <p>{t.customer}: {head.customer ?? "-"}</p>
        <p>{t.phone}: {head.tel ?? "-"}</p>
        <p>{t.address}: {[head.address, head.city, head.province].filter(Boolean).join(" ") || "-"}</p>
      </section>

      <section className="mb-4 grid grid-cols-2 gap-x-6 text-sm">
        <p className="col-span-2 font-bold">{t.productInfo}</p>
        <p>{t.product}: {head.product ?? "-"}</p>
        <p>Model: {head.model ?? "-"}</p>
        <p>{t.brand}: {head.brand ?? "-"}</p>
        <p>SN: {head.sn ?? "-"}</p>
        <p>{t.symptom}: {head.issue_2 ?? "-"}</p>
        <p>{t.warranty}: {head.warranty ?? "-"}</p>
        <p className="col-span-2">{t.technician}: {head.technician ?? "-"}</p>
      </section>

      <p className="mb-1 text-sm font-bold">{t.details}</p>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            {[t.colNo, t.colItem, t.colQty, t.colUnit, t.colPrice, t.colTotal].map((cell) => (
              <th key={cell} className="border border-slate-900 px-2 py-1 font-normal">{cell}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {lines.map((line, index) => (
            <tr key={index}>
              <td className="border border-slate-900 px-2 py-1 text-center">{index + 1}</td>
              <td className="border border-slate-900 px-2 py-1">{line.item_name}</td>
              <td className="border border-slate-900 px-2 py-1 text-center">{Number(line.qty)}</td>
              <td className="border border-slate-900 px-2 py-1 text-center">{line.unit_code ?? "-"}</td>
              <td className="border border-slate-900 px-2 py-1 text-right">{money(line.price)} {t.baht}</td>
              <td className="border border-slate-900 px-2 py-1 text-right">{money(line.sum_amount)} {t.baht}</td>
            </tr>
          ))}
          <tr>
            <td colSpan={4} className="px-2 py-1 text-right">{t.subtotal}</td>
            <td colSpan={2} className="border border-slate-900 px-2 py-1 text-right">{money(head.total_value)} {t.baht}</td>
          </tr>
          <tr>
            <td colSpan={4} className="px-2 py-1 text-right">{t.discount}</td>
            <td colSpan={2} className="border border-slate-900 px-2 py-1 text-right">{money(head.total_discount)} {t.baht}</td>
          </tr>
          {/* ອມພ: ໃບເກົ່າ 6 ໃບເທົ່ານັ້ນທີ່ຄິດ ອມພ ຈິງ. ແຕ່ກ່ອນ query coalesce(vat_rate,10)
              ⇒ ທຸກໃບໃໝ່ພິມອອກມາເປັນ "ອມພ 10% = 0.00 ບາດ" ທັງທີ່ບໍ່ໄດ້ຄິດ ອມພ ເລີຍ (ຕົວເລກຫຼອກລູກຄ້າ).
              ດຽວນີ້ສະແດງແຖວນີ້ສະເພາະໃບທີ່ມີ ອມພ ແທ້ */}
          {Number(head.total_vat_value) > 0 && (
            <tr>
              <td colSpan={4} className="px-2 py-1 text-right">{t.vat} {money(head.vat_rate)}%</td>
              <td colSpan={2} className="border border-slate-900 px-2 py-1 text-right">{money(head.total_vat_value)} {t.baht}</td>
            </tr>
          )}
          <tr>
            <td colSpan={4} className="px-2 py-1 text-right font-bold">{t.total}</td>
            <td colSpan={2} className="border border-slate-900 px-2 py-1 text-right font-bold">{money(head.total_amount)} {t.baht}</td>
          </tr>
          <tr>
            <td colSpan={2} className="px-2 py-1 text-right">
              {t.exchangeRate}: {head.exchange_rate === null ? "-" : money(head.exchange_rate)} ,
            </td>
            <td colSpan={2} className="px-2 py-1 text-right">{t.totalKip}</td>
            <td colSpan={2} className="border border-slate-900 px-2 py-1 text-right font-bold">
              {head.total_amount_2 === null ? "-" : money(head.total_amount_2)} {t.kip}
            </td>
          </tr>
        </tbody>
      </table>

      <div className="mt-6 border border-slate-900 p-2 text-sm">
        <u>{t.remark}:</u>
        <p className="min-h-10">{head.remark ?? ""}</p>
      </div>

      <table className="mt-6 w-full border-collapse text-center text-sm">
        <tbody>
          <tr>
            <td className="border border-slate-900 px-2 py-1">{t.customer}</td>
            <td className="border border-slate-900 px-2 py-1">{t.approver}</td>
            <td className="border border-slate-900 px-2 py-1">{t.proposer}</td>
          </tr>
          <tr className="h-24">
            <td className="border border-slate-900" />
            <td className="border border-slate-900" />
            <td className="border border-slate-900 align-bottom text-xs">{head.user_created ?? ""}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
