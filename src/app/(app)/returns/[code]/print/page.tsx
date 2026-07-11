import { getRates } from "@/app/actions/return";
import { query } from "@/lib/db";
import { notFound } from "next/navigation";

/**
 * ໃບຮັບເງິນ (ພິມ) — ods ບໍ່ມີໜ້ານີ້ (ປຸ່ມ "ເບີ່ງ" ໃນ HomeReturn.html ຊີ້ໄປ '#'),
 * ຈຶ່ງອີງໂຄງໜ້າຈາກ templates/invoice.html (ໜ້າພິມໃບສະເໜີລາຄາ) ມາເຮັດໃຫ້ຄົບ.
 *
 * [code] ຮັບໄດ້ທັງ ເລກບິນ SIN ແລະ ລະຫັດເຄື່ອງ (tb_product.code).
 */

type Head = {
  doc_no: string;
  doc_date: string | null;
  remark: string | null;
  user_created: string | null;
  total_amount: string | null;
  cust_name: string | null;
  tel: string | null;
  address: string | null;
  product: string | null;
  model: string | null;
  brand: string | null;
  sn: string | null;
  warranty: string | null;
  issue: string | null;
  issue_2: string | null;
  emp_code: string | null;
};

type Line = { rnum: number; item_code: string; item_name: string; qty: string; unit_code: string | null; price: string; sum_amount: string };
type Company = { name_1: string | null; name_2: string | null; address: string | null; tel: string | null };
type Payment = { item_code: string | null; item_name: string | null; total_value: string; exchange_rate: string | null; total_value_2: string };

const money = (value: string | number | null) =>
  Number(value ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

async function getHead(code: string) {
  const sql = `select a.doc_no, to_char(a.doc_date,'DD-MM-YYYY') doc_date, a.remark, a.user_created, a.total_amount,
      b.name_1 cust_name, b.tel, concat_ws(', ', b.address, d.name_1, c.name_1) address,
      p.name_1 product, p.p_model model, p.p_brand brand, p.sn, p.warrunty warranty,
      p.issue, p.issue_2, p.emp_code
    from ic_trans a
    left join tb_product p on p.code = a.product_code
    left join ar_customer b on b.code = a.cust_code
    left join province c on c.code = b.provine
    left join city d on d.code = b.city and d.province = b.provine
    where a.trans_flag = 44 and (a.doc_no = $1 or a.product_code = $1)
    order by a.roworder desc limit 1`;
  return (await query<Head>(sql, [code])).rows[0] ?? null;
}

export default async function InvoicePrintPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const head = await getHead(decodeURIComponent(code));
  if (!head) notFound();

  const [lines, company, payments, rates] = await Promise.all([
    query<Line>(
      `select row_number() over (order by roworder)::int rnum, item_code, item_name,
          coalesce(qty,0) qty, unit_code, coalesce(price,0) price, coalesce(sum_amount,0) sum_amount
       from ic_trans_detail where trans_flag = 44 and doc_no = $1 order by roworder`,
      [head.doc_no],
    ).then((result) => result.rows),
    query<Company>(`select name_1, name_2, address, tel from company_profile limit 1`).then((r) => r.rows[0] ?? null),
    query<Payment>(
      `select item_code, item_name, coalesce(total_value,0) total_value, exchange_rate,
          coalesce(total_value_2,0) total_value_2
       from cb_trans_detail where trans_flag = 44 and doc_no = $1 order by roworder`,
      [head.doc_no],
    ).then((result) => result.rows),
    getRates(),
  ]);

  const total = Number(head.total_amount ?? 0);

  return (
    <div className="mx-auto max-w-3xl bg-white p-8 text-slate-950 print:p-0">
      <style>{`@media print { .no-print { display: none !important } @page { margin: 12mm } }`}</style>

      <p className="no-print mb-6 text-right text-sm text-slate-500">ກົດ Ctrl/Cmd + P ເພື່ອພິມ</p>

      <header className="flex items-start justify-between gap-6 border-b-2 border-slate-900 pb-4">
        <div className="text-sm leading-6">
          <p className="text-base font-bold">{company?.name_1}</p>
          <p>{company?.name_2}</p>
          <p>{company?.address}</p>
          <p>{company?.tel}</p>
        </div>
        <div className="text-right text-sm">
          <p>ເລກທີ {head.doc_no}</p>
          <p>ວັນທີ {head.doc_date}</p>
        </div>
      </header>

      <h1 className="my-4 text-center text-xl font-bold">ໃບຮັບເງິນ</h1>

      <section className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
        <p className="col-span-2 font-bold">ຂໍ້ມູນລູກຄ້າ</p>
        <p>ລູກຄ້າ: {head.cust_name}</p>
        <p>ເບີໂທ: {head.tel}</p>
        <p className="col-span-2">ທີ່ຢູ່: {head.address}</p>
        <p className="col-span-2 mt-2 font-bold">ຂໍ້ມູນສິນຄ້າ</p>
        <p>ສິນຄ້າ: {head.product}</p>
        <p>Model: {head.model}</p>
        <p>ຫຍີ່ຫໍ້: {head.brand}</p>
        <p>SN: {head.sn}</p>
        <p>ອາການ: {head.issue_2 || head.issue}</p>
        <p>ການຮັບປະກັນ: {head.warranty}</p>
        <p className="col-span-2">ຊ່າງ: {head.emp_code}</p>
      </section>

      <p className="mt-5 mb-1 font-bold">ລາຍລະອຽດ</p>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            {["ລ/ດ", "ລາຍການ", "ຈຳນວນ", "ຫົວໜ່ວຍ", "ລາຄາ", "ລວມ"].map((cell) => (
              <th key={cell} className="border border-slate-900 px-2 py-1 font-normal">{cell}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {lines.map((line) => (
            <tr key={line.rnum}>
              <td className="border border-slate-900 px-2 py-1 text-center">{line.rnum}</td>
              <td className="border border-slate-900 px-2 py-1">{line.item_name}</td>
              <td className="border border-slate-900 px-2 py-1 text-center">{Number(line.qty)}</td>
              <td className="border border-slate-900 px-2 py-1 text-center">{line.unit_code}</td>
              <td className="border border-slate-900 px-2 py-1 text-right">{money(line.price)} ບາດ</td>
              <td className="border border-slate-900 px-2 py-1 text-right">{money(line.sum_amount)} ບາດ</td>
            </tr>
          ))}
          <tr>
            <td colSpan={4} className="px-2 py-1 text-right font-bold">ລວມທັງໝົດ</td>
            <td colSpan={2} className="border border-slate-900 px-2 py-1 text-right font-bold">{money(total)} ບາດ</td>
          </tr>
          <tr>
            <td colSpan={2} className="px-2 py-1 text-right">ອັດຕາເເລກປ່ຽນ: {money(rates["02"])}</td>
            <td colSpan={2} className="px-2 py-1 text-right">ລວມທັງໝົດ (ມູນຄ່າກີບ)</td>
            <td colSpan={2} className="border border-slate-900 px-2 py-1 text-right font-bold">
              {money(total * rates["02"])} ກີບ
            </td>
          </tr>
        </tbody>
      </table>

      {payments.length > 0 && (
        <>
          <p className="mt-5 mb-1 font-bold">ລາຍລະອຽດການຮັບເງິນ</p>
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                {["ຮູບແບບ", "ສະກຸນ", "ຈຳນວນ", "ອັດຕາ", "ເປັນບາດ"].map((cell) => (
                  <th key={cell} className="border border-slate-900 px-2 py-1 font-normal">{cell}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {payments.map((payment, index) => (
                <tr key={index}>
                  <td className="border border-slate-900 px-2 py-1">{payment.item_name || "ເງິນສົດ"}</td>
                  <td className="border border-slate-900 px-2 py-1 text-center">{payment.item_code}</td>
                  <td className="border border-slate-900 px-2 py-1 text-right">{money(payment.total_value)}</td>
                  <td className="border border-slate-900 px-2 py-1 text-right">{money(payment.exchange_rate)}</td>
                  <td className="border border-slate-900 px-2 py-1 text-right">{money(payment.total_value_2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      <p className="mt-4 text-sm"><u>ໝາຍເຫດ:</u> {head.remark}</p>

      <div className="mt-16 grid grid-cols-3 gap-4 text-center text-sm">
        {["ລູກຄ້າ", "ຜູ້ອະນຸມັດ", "ຜູ້ສະເໜີ"].map((role) => (
          <div key={role}>
            <p className="mb-12">{role}</p>
            <p className="border-t border-slate-900 pt-1">
              {role === "ຜູ້ສະເໜີ" ? head.user_created : ""}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
