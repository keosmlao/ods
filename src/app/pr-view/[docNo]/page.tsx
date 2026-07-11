import { Card, Empty, Table } from "@/components/ui";
import { query } from "@/lib/db";
import { notFound } from "next/navigation";

/**
 * ຖອດແບບຈາກ ods: order.py view_approve_requestpr() + templates/request_order/view_approve_pr.html
 *
 * ໜ້ານີ້ເປີດສາທາລະນະ (ບໍ່ຕ້ອງ login) ໂດຍເຈດຕະນາ — ods ກໍ່ comment ການເຊັກ login ອອກ
 * ເພື່ອໃຫ້ລິ້ງໃນແຈ້ງເຕືອນເປີດໄດ້ເລີຍ. ຈຶ່ງວາງໄວ້ນອກ route group (app).
 * ອ່ານໄດ້ຢ່າງດຽວ: ບໍ່ມີຟອມ, ບໍ່ມີ action, ບໍ່ມີປຸ່ມທີ່ຂຽນຂໍ້ມູນ.
 */

type Props = { params: Promise<{ docNo: string }> };

type Head = {
  doc_no: string;
  created: string | null;
  doc_ref: string | null;
  doc_ref_date: string | null;
  customer: string | null;
  product: string | null;
  model: string | null;
  sn: string | null;
  issue: string | null;
  warranty: string | null;
  issue_2: string | null;
  emp_code: string | null;
  used_spare: number | null;
  remark: string | null;
  attach_url: string | null;
};

type Line = {
  rnum: number;
  item_code: string;
  item_name: string | null;
  qty: string;
  unit_code: string | null;
  price: string;
  sum_amount: string;
};

const money = (value: string | number) =>
  Number(value ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

async function getHead(docNo: string) {
  const sql = `select a.doc_no, to_char(a.create_date_time_now,'DD-MM-YYYY HH24:MI:SS') created,
      a.doc_ref, a.doc_ref_date,
      concat_ws('-', b.name_1, b.tel) customer,
      c.name_1 product, c.p_model model, c.sn, c.issue, c.warrunty warranty, c.issue_2, c.emp_code,
      c.used_spare, a.remark,
      (select product_url from product_image where iteme_code = a.doc_ref limit 1) attach_url
    from ic_trans a
    left join tb_product c on c.code = a.product_code
    left join ar_customer b on b.code = c.cust_code
    where a.doc_no = $1`;
  return (await query<Head>(sql, [docNo])).rows[0] ?? null;
}

async function getLines(docNo: string) {
  const sql = `select row_number() over (order by roworder)::int rnum, item_code, item_name,
      coalesce(qty,0) qty, unit_code, coalesce(price,0) price, coalesce(sum_amount,0) sum_amount
    from ic_trans_detail where doc_no = $1 order by roworder`;
  return (await query<Line>(sql, [docNo])).rows;
}

export default async function PrViewPage({ params }: Props) {
  const { docNo } = await params;
  const id = decodeURIComponent(docNo);
  const head = await getHead(id);
  if (!head) notFound();

  const lines = await getLines(head.doc_no);
  const total = lines.reduce((sum, line) => sum + Number(line.sum_amount), 0);

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-8">
      <div className="mx-auto w-full max-w-5xl space-y-5">
        <h1 className="text-center text-2xl font-bold text-slate-700">ລາຍລະອຽດສະເໜີຊື້</h1>

        <Card title="ຂໍ້ມູນເອກະສານ">
          <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            <Field label="ເລກທິໃບຂໍເບີກ" value={head.doc_no} />
            <Field label="ວັນທີ" value={head.created} />
            <Field label="ເລກທິໃບກວດເຊັກ" value={head.doc_ref} />
            <Field label="ວັນທີ" value={head.doc_ref_date} />
            <Field label="ລູກຄ້າ" value={head.customer} wide />
            <Field label="ຊື່ສິນຄ້າ" value={head.product} />
            <Field label="ລູ້ນ/Model" value={head.model} />
            <Field label="ເລກເຄື່ອງ/sn" value={head.sn} />
            <Field label="ປະກັນ" value={head.warranty} />
            <Field label="ອາການເສຍ" value={head.issue} wide />
            <Field label="ອາການຊ່າງວິເຄາະ" value={head.issue_2} wide />
            <Field label="ຊ່າງສ້ອມ" value={head.emp_code} />
            <Field label="ໝາຍເຫດ" value={head.remark} />
          </dl>

          <div className="mt-5">
            <p className="mb-1 text-xs text-slate-500">ເອກະສານເເນບ</p>
            {head.attach_url ? (
              // eslint-disable-next-line @next/next/no-img-element -- ໜ້າສາທາລະນະ, ຮູບມາຈາກ route ຂອງໜ້ານີ້ເອງ
              <img
                src={`/pr-view/${encodeURIComponent(head.doc_no)}/attachment`}
                alt="ເອກະສານເເນບ"
                className="h-56 rounded-lg border border-slate-200 object-contain"
              />
            ) : (
              <div className="grid h-56 w-56 place-items-center rounded-lg bg-slate-100 text-sm text-slate-400">
                ບໍ່ມີຮູບ
              </div>
            )}
          </div>
        </Card>

        {head.used_spare === 1 && (
          <Card title="ອາໄຫຼ່ທີ່ໃຊ້">
            {lines.length === 0 ? (
              <Empty />
            ) : (
              <Table head={["#", "ລະຫັດສິນຄ້າ", "ຊື່ສິນຄ້າ", "ຈຳນວນ", "ຫົວໜ່ວຍ", "ລາຄາ", "ລວມ"]} minWidth={800}>
                {lines.map((line) => (
                  <tr key={line.rnum} className="border-b border-slate-100">
                    <td className="px-3 py-2 text-center">{line.rnum}</td>
                    <td className="px-3 py-2">{line.item_code}</td>
                    <td className="px-3 py-2">{line.item_name}</td>
                    <td className="px-3 py-2 text-center">{Number(line.qty)}</td>
                    {/* ods ສະແດງ price ຢູ່ຖັນ "ຫົວໜ່ວຍ" (SQL ກັບ template ບໍ່ກົງກັນ) — ບ່ອນນີ້ແກ້ໃຫ້ຖືກ */}
                    <td className="px-3 py-2 text-center">{line.unit_code}</td>
                    <td className="px-3 py-2 text-right">{money(line.price)}</td>
                    <td className="px-3 py-2 text-right font-semibold">{money(line.sum_amount)}</td>
                  </tr>
                ))}
                <tr className="bg-slate-50 font-bold">
                  <td colSpan={6} className="px-3 py-3 text-right">ລວມ</td>
                  <td className="px-3 py-3 text-right">{money(total)}</td>
                </tr>
              </Table>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}

function Field({ label, value, wide }: { label: string; value: string | null; wide?: boolean }) {
  return (
    <div className={wide ? "sm:col-span-2" : ""}>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="text-slate-800">{value || "-"}</dd>
    </div>
  );
}
