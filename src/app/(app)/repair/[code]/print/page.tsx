import { query } from "@/lib/db";
import { notFound } from "next/navigation";

/**
 * ໃບສ້ອມແປງ / ອາໄຫຼ່ທີ່ໃຊ້ (ພິມ) — ຖອດແບບຈາກ ods: repair.py showbilrp()
 * + templates/stock/showbilldipatch.html
 *
 * ods ຮັບ doc_no ຂອງໃບຂໍເບີກ (ic_trans trans_flag 122) ແຕ່ລິ້ງໃນ home_repair.html
 * ສົ່ງຊື່ລູກຄ້າໄປແທນ doc_no (ບັກຂອງ ods → ໜ້ານັ້ນເປີດບໍ່ໄດ້ຈັກເທື່ອ).
 * ບ່ອນນີ້ຮັບ "ລະຫັດເຄື່ອງ" (tb_product.code) ຄືກັບໜ້າອື່ນຂອງລະບົບ
 * ແລ້ວຫາໃບຂໍເບີກ SIO ຂອງເຄື່ອງໜ່ວຍນັ້ນເອງ.
 *
 * ລາຍການອາໄຫຼ່ດຶງຈາກ tb_used_spare (ແຫຼ່ງຂໍ້ມູນຈິງຂອງລະບົບ — ic_trans_detail
 * ຂອງໃບ SIO ກ໊ອບປີ້ມາຈາກຕາຕະລາງນີ້ຢູ່ແລ້ວ) ຈຶ່ງເຫັນອາໄຫຼ່ໄດ້ເຖິງແມ່ນຍັງບໍ່ທັນອອກໃບຂໍເບີກ.
 */

type Head = {
  code: string;
  registered: string | null;
  finished_check: string | null;
  repair_started: string | null;
  repair_finished: string | null;
  customer: string | null;
  tel: string | null;
  product: string | null;
  model: string | null;
  brand: string | null;
  sn: string | null;
  warranty: string | null;
  issue: string | null;
  issue_2: string | null;
  technician: string | null;
  repair_note: string | null;
  used_spare: number | null;
};

type Doc = { doc_no: string; doc_date: string | null; doc_ref: string | null; doc_ref_date: string | null; remark: string | null };
type Line = { rnum: number; item_code: string; item_name: string | null; qty: string; unit_code: string | null; picked: boolean };
type Company = { name_1: string | null; name_2: string | null; address: string | null; tel: string | null };

export default async function RepairPrintPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const product = decodeURIComponent(code);

  const head = (
    await query<Head>(
      `select a.code,
          to_char(a.time_register,'DD-MM-YYYY HH24:MI') registered,
          to_char(a.time_finish_check,'DD-MM-YYYY HH24:MI') finished_check,
          to_char(a.time_repair,'DD-MM-YYYY HH24:MI') repair_started,
          to_char(a.time_finish_repair,'DD-MM-YYYY HH24:MI') repair_finished,
          b.name_1 customer, b.tel, a.name_1 product, a.p_model model, a.p_brand brand, a.sn,
          a.warrunty warranty, a.issue, a.issue_2,
          coalesce(d.name_1, a.emp_code) technician, a.repair_note, coalesce(a.used_spare,0) used_spare
        from tb_product a
        left join ar_customer b on b.code = a.cust_code
        left join tb_techemp d on d.code = a.emp_code
        where a.code = $1 limit 1`,
      [product],
    )
  ).rows[0];
  if (!head) notFound();

  const [doc, lines, company] = await Promise.all([
    query<Doc>(
      `select doc_no, to_char(doc_date,'DD-MM-YYYY') doc_date, doc_ref,
          to_char(doc_ref_date::date,'DD-MM-YYYY') doc_ref_date, remark
        from ic_trans where trans_flag = 122 and product_code = $1
        order by roworder desc limit 1`,
      [product],
    ).then((result) => result.rows[0] ?? null),
    query<Line>(
      `select row_number() over (order by roworder)::int rnum, item_code, item_name,
          coalesce(qty,0)::text qty, unit_code, (pick_finish is not null) picked
        from tb_used_spare where product_code = $1 order by roworder`,
      [product],
    ).then((result) => result.rows),
    query<Company>(`select name_1, name_2, address, tel from company_profile limit 1`).then((r) => r.rows[0] ?? null),
  ]);

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
          <p>ເລກທິໃບຮັບເຄື່ອງ {head.code}</p>
          <p>ວັນທີ {head.registered ?? "-"}</p>
        </div>
      </header>

      <h1 className="my-4 text-center text-xl font-bold">ໃບສ້ອມແປງ</h1>

      {doc && (
        <section className="mb-3 grid grid-cols-2 gap-x-6 gap-y-1 rounded border border-slate-300 p-3 text-sm">
          <p>ເລກທິໃບຂໍເບີກ: {doc.doc_no}</p>
          <p>ວັນທີ: {doc.doc_date ?? "-"}</p>
          <p>ເລກທິໃບກວດເຊັກ: {doc.doc_ref ?? "-"}</p>
          <p>ວັນທີ: {doc.doc_ref_date ?? "-"}</p>
        </section>
      )}

      <section className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
        <p className="col-span-2 font-bold">ຂໍ້ມູນລູກຄ້າ</p>
        <p>ລູກຄ້າ: {head.customer ?? "-"}</p>
        <p>ເບີໂທ: {head.tel ?? "-"}</p>

        <p className="col-span-2 mt-2 font-bold">ຂໍ້ມູນສິນຄ້າ</p>
        <p>ຊື່ສິນຄ້າ: {head.product ?? "-"}</p>
        <p>ລູ້ນ/Model: {head.model ?? "-"}</p>
        <p>ຫຍີ່ຫໍ້: {head.brand ?? "-"}</p>
        <p>ເລກເຄື່ອງ/SN: {head.sn ?? "-"}</p>
        <p className="col-span-2 text-red-700">ອາການເສຍ: {head.issue ?? "-"}</p>
        <p>ປະກັນ: {head.warranty ?? "-"}</p>
        <p>ໃຊ້ອາໄຫຼ່: {head.used_spare === 1 ? "ໃຊ້ອາໄຫຼ່" : "ບໍ່ໃຊ້ອາໃຫຼ່"}</p>

        <p className="col-span-2 mt-2 font-bold">ການສ້ອມແປງ</p>
        <p className="col-span-2">ອາການຊ່າງວິເຄາະ: {head.issue_2 ?? "-"}</p>
        <p>ຊ່າງສ້ອມ: {head.technician ?? "-"}</p>
        <p>ວັນ/ເວລາກວດເຊັກຈົບ: {head.finished_check ?? "-"}</p>
        <p>ວັນ/ເວລາເລີ່ມສ້ອມແປງ: {head.repair_started ?? "-"}</p>
        <p>ວັນ/ເວລາສິ້ນສຸດ: {head.repair_finished ?? "-"}</p>
        <p className="col-span-2">ໝາຍເຫດ: {head.repair_note || doc?.remark || "-"}</p>
      </section>

      {lines.length > 0 && (
        <>
          <p className="mt-5 mb-1 font-bold">ອາໄຫຼ່ທີ່ໃຊ້</p>
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                {["#", "ລະຫັດສິນຄ້າ", "ຊື່ສິນຄ້າ", "ຈຳນວນ", "ຫົວໜ່ວຍ", "ສະຖານະ"].map((cell) => (
                  <th key={cell} className="border border-slate-900 px-2 py-1 font-normal">
                    {cell}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lines.map((line) => (
                <tr key={line.rnum}>
                  <td className="border border-slate-900 px-2 py-1 text-center">{line.rnum}</td>
                  <td className="border border-slate-900 px-2 py-1">{line.item_code}</td>
                  <td className="border border-slate-900 px-2 py-1">{line.item_name ?? "-"}</td>
                  <td className="border border-slate-900 px-2 py-1 text-center">{Number(line.qty)}</td>
                  <td className="border border-slate-900 px-2 py-1 text-center">{line.unit_code ?? "-"}</td>
                  <td className="border border-slate-900 px-2 py-1 text-center">
                    {line.picked ? "ເບີກແລ້ວ" : "ລໍຖ້າເບີກ"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {lines.length === 0 && <p className="mt-5 text-sm text-slate-500">ບໍ່ມີອາໄຫຼ່ທີ່ໃຊ້</p>}

      <div className="mt-16 grid grid-cols-3 gap-4 text-center text-sm">
        {["ລູກຄ້າ", "ຜູ້ອະນຸມັດ", "ຊ່າງສ້ອມ"].map((role) => (
          <div key={role}>
            <p className="mb-12">{role}</p>
            <p className="border-t border-slate-900 pt-1">{role === "ຊ່າງສ້ອມ" ? (head.technician ?? "") : ""}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
