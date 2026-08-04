import { PrintButton } from "@/components/print-button";
import { getSession } from "@/lib/auth";
import { query } from "@/lib/db";
import { notFound, redirect } from "next/navigation";

/**
 * **ໃບຢືມ-ຄືນເຄື່ອງສຳຮອງ** — ໃຫ້ລູກຄ້າເຊັນຮັບ.
 *
 * ── ເປັນຫຍັງຕ້ອງມີ ──
 * ເຄື່ອງສຳຮອງບໍ່ຜ່ານເອກະສານສາງ (ບໍ່ຕັດສະຕັອກ — ເບິ່ງ lib/loaner) ⇒ ຖ້າບໍ່ມີໃບເຊັນ
 * ຮັບ ເມື່ອເຄື່ອງບໍ່ຄືນ/ເສຍຫາຍ ສູນບໍ່ມີຫຼັກຖານຫຍັງເລີຍ ນອກຈາກແຖວໃນຖານຂໍ້ມູນ.
 * ໃບດຽວໃຊ້ໄດ້ 2 ຕອນ: ຕອນໃຫ້ຢືມ (ຊ່ອງຮັບຄືນຫວ່າງ) ແລະ ຕອນຮັບຄືນ (ຕື່ມໃຫ້ແລ້ວ).
 */
export const dynamic = "force-dynamic";

type Row = {
  id: number;
  job_code: string;
  item_name: string;
  item_code: string | null;
  isn: string;
  sn: string | null;
  lend_time: string;
  lend_by: string;
  lend_note: string | null;
  return_time: string | null;
  return_by: string | null;
  return_note: string | null;
  customer: string | null;
  cust_code: string | null;
  tel: string | null;
  address: string | null;
  product: string | null;
  product_sn: string | null;
};

type Company = { name_1: string | null; name_2: string | null; address: string | null; tel: string | null };

export default async function LoanerPrintPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();

  const [rowResult, companyResult] = await Promise.all([
    query<Row>(
      `select l.id, l.job_code, l.item_name, l.item_code, l.isn, l.sn,
          to_char(l.lend_time,'DD-MM-YYYY HH24:MI') lend_time, l.lend_by, l.lend_note,
          to_char(l.return_time,'DD-MM-YYYY HH24:MI') return_time, l.return_by, l.return_note,
          c.name_1 customer, p.cust_code, c.tel,
          concat_ws(', ', c.address, city.name_1, province.name_1) address,
          p.name_1 product, p.sn product_sn
        from ods_loaner l
        left join tb_product p on p.code = l.job_code
        left join ar_customer c on c.code = p.cust_code
        left join province on province.code = c.provine
        left join city on city.code = c.city and city.province = c.provine
       where l.id = $1 limit 1`,
      [id],
    ),
    query<Company>("select name_1, name_2, address, tel from company_profile limit 1"),
  ]);

  const row = rowResult.rows[0];
  if (!row) notFound();
  const company = companyResult.rows[0];

  const fields: [string, string | null][] = [
    ["ເລກທີໃບຢືມ", `LN-${String(row.id).padStart(5, "0")}`],
    ["ອ້າງອີງໃບງານສ້ອມ", `#${row.job_code}`],
    ["ລູກຄ້າ", `${row.cust_code ?? ""} ${row.customer ?? ""}`.trim()],
    ["ເບີໂທ", row.tel],
    ["ທີ່ຢູ່", row.address],
    ["ເຄື່ອງທີ່ສົ່ງສ້ອມ", [row.product, row.product_sn && `S/N ${row.product_sn}`].filter(Boolean).join(" · ")],
    ["ເຄື່ອງສຳຮອງທີ່ໃຫ້ຢືມ", row.item_name],
    ["ISN / S/N ເຄື່ອງສຳຮອງ", [row.isn, row.sn && `S/N ${row.sn}`].filter(Boolean).join(" · ")],
    ["ວັນທີໃຫ້ຢືມ", `${row.lend_time} (ໂດຍ ${row.lend_by})`],
    ["ສະພາບ/ອຸປະກອນຕອນໃຫ້ຢືມ", row.lend_note],
    ["ວັນທີຮັບຄືນ", row.return_time ? `${row.return_time} (ໂດຍ ${row.return_by})` : null],
    ["ສະພາບຕອນຮັບຄືນ", row.return_note],
  ];

  return (
    <main className="mx-auto max-w-3xl bg-white p-8 text-slate-950 print:p-0">
      <style>{`@media print { @page { size:A4; margin:12mm } .no-print { display:none !important } }`}</style>
      <div className="no-print mb-5 flex justify-end">
        <PrintButton label="ພິມໃບຢືມເຄື່ອງສຳຮອງ / PDF" />
      </div>

      <header className="flex items-start justify-between gap-6 border-b-2 border-brand-900 pb-4 text-sm">
        <div>
          <p className="text-base font-bold">{company?.name_1}</p>
          <p>{company?.name_2}</p>
          <p>{company?.address}</p>
          <p>{company?.tel}</p>
        </div>
        <div className="text-right">
          <p>ເລກທີ: LN-{String(row.id).padStart(5, "0")}</p>
          <p>ວັນທີ: {row.lend_time}</p>
        </div>
      </header>

      <h1 className="my-5 text-center text-2xl font-bold">ໃບຢືມ-ຄືນ ເຄື່ອງສຳຮອງ</h1>

      <section className="grid grid-cols-2 border-l border-t border-brand-900 text-sm">
        {fields.map(([label, value]) => (
          <div key={label} className="min-h-14 border-b border-r border-brand-900 p-2">
            <p className="text-xs text-slate-500">{label}</p>
            <p className="mt-1 font-medium">{value || "-"}</p>
          </div>
        ))}
      </section>

      <ol className="mt-5 space-y-1 text-sm">
        <li>1. ເຄື່ອງສຳຮອງຂ້າງເທິງເປັນ<b>ຊັບສິນຂອງບໍລິສັດ</b> ໃຫ້ລູກຄ້າໃຊ້ຊົ່ວຄາວລະຫວ່າງລໍການສ້ອມເທົ່ານັ້ນ.</li>
        <li>2. ຜູ້ຢືມຮັບຜິດຊອບຄວາມເສຍຫາຍ ຫຼື ການສູນຫາຍ ທີ່ເກີດຂຶ້ນໃນລະຫວ່າງທີ່ຖືຄອງ.</li>
        <li>3. ຕ້ອງສົ່ງເຄື່ອງສຳຮອງຄືນ<b>ໃນມື້ທີ່ມາຮັບເຄື່ອງທີ່ສ້ອມແລ້ວ</b> ພ້ອມອຸປະກອນຕາມລາຍການຂ້າງເທິງ.</li>
      </ol>

      <div className="mt-20 grid grid-cols-3 gap-8 text-center text-sm">
        {["ຜູ້ໃຫ້ຢືມ (ບໍລິສັດ)", "ຜູ້ຢືມ (ລູກຄ້າ)", "ຜູ້ຮັບຄືນ"].map((label) => (
          <div key={label}>
            <div className="border-t border-brand-900 pt-2">{label}</div>
            <p className="mt-1 text-xs text-slate-500">ວັນທີ ....../....../......</p>
          </div>
        ))}
      </div>
    </main>
  );
}
