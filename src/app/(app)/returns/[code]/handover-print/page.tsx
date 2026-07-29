import { PrintButton } from "@/components/print-button";
import { getSession } from "@/lib/auth";
import { query } from "@/lib/db";
import { canViewAssignedJob } from "@/lib/scope";
import { notFound, redirect } from "next/navigation";

type Head = {
  code: string;
  registered: string | null;
  returned: string | null;
  cust_code: string | null;
  customer: string | null;
  tel: string | null;
  address: string | null;
  product: string | null;
  model: string | null;
  brand: string | null;
  sn: string | null;
  accessory: string | null;
  issue: string | null;
  diagnosis: string | null;
  technician: string | null;
};

type Company = {
  name_1: string | null;
  name_2: string | null;
  address: string | null;
  tel: string | null;
};

export default async function ReturnHandoverPrintPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  const code = decodeURIComponent((await params).code);

  const [headResult, companyResult] = await Promise.all([
    query<Head>(
      `select a.code, to_char(a.time_register,'DD-MM-YYYY') registered,
          to_char(coalesce(a.return_complete, a.cancel_finish),'DD-MM-YYYY HH24:MI') returned,
          a.cust_code, c.name_1 customer, c.tel,
          concat_ws(', ', c.address, city.name_1, province.name_1) address,
          a.name_1 product, a.p_model model, a.p_brand brand, a.sn,
          a.p_access accessory, a.issue, a.issue_2 diagnosis, a.emp_code technician
       from tb_product a
       left join ar_customer c on c.code=a.cust_code
       left join province on province.code=c.provine
       left join city on city.code=c.city and city.province=c.provine
       where a.code=$1 limit 1`,
      [code],
    ),
    query<Company>(
      `select name_1, name_2, address, tel from company_profile limit 1`,
    ),
  ]);

  const head = headResult.rows[0];
  if (!head) notFound();
  if (!canViewAssignedJob(session, head.technician)) redirect("/forbidden");
  const company = companyResult.rows[0];

  const fields: [string, string | null][] = [
    ["ເລກທີໃບງານ", head.code],
    ["ວັນທີຮັບເຄື່ອງ", head.registered],
    ["ວັນທີສົ່ງຄືນ", head.returned],
    ["ລູກຄ້າ", `${head.cust_code ?? ""} ${head.customer ?? ""}`.trim()],
    ["ເບີໂທ", head.tel],
    ["ທີ່ຢູ່", head.address],
    ["ສິນຄ້າ", head.product],
    ["ຍີ່ຫໍ້ / Model", [head.brand, head.model].filter(Boolean).join(" / ")],
    ["Serial Number", head.sn],
    ["ອຸປະກອນທີ່ມານຳ", head.accessory],
    ["ອາການເສຍ", head.issue],
    ["ຜົນກວດ / ການສ້ອມ", head.diagnosis],
    ["ຊ່າງຮັບຜິດຊອບ", head.technician],
  ];

  return (
    <main className="mx-auto max-w-3xl bg-white p-8 text-slate-950 print:p-0">
      <style>{`@media print { @page { size:A4; margin:12mm } .no-print { display:none !important } }`}</style>
      <div className="no-print mb-5 flex justify-end">
        <PrintButton label="ພິມໃບຄືນເຄື່ອງ / PDF" />
      </div>

      <header className="flex items-start justify-between gap-6 border-b-2 border-slate-900 pb-4 text-sm">
        <div>
          <p className="text-base font-bold">{company?.name_1}</p>
          <p>{company?.name_2}</p>
          <p>{company?.address}</p>
          <p>{company?.tel}</p>
        </div>
        <div className="text-right">
          <p>ເລກທີ: {head.code}</p>
          <p>ວັນທີ: {head.returned ?? new Date().toLocaleDateString("en-GB")}</p>
        </div>
      </header>

      <h1 className="my-5 text-center text-2xl font-bold">ໃບສົ່ງຄືນເຄື່ອງ</h1>

      <section className="grid grid-cols-2 border-l border-t border-slate-900 text-sm">
        {fields.map(([label, value]) => (
          <div key={label} className="min-h-14 border-b border-r border-slate-900 p-2">
            <p className="text-xs text-slate-500">{label}</p>
            <p className="mt-1 font-medium">{value || "-"}</p>
          </div>
        ))}
      </section>

      <p className="mt-5 text-sm">
        ຜູ້ຮັບໄດ້ກວດສອບເຄື່ອງ ແລະອຸປະກອນປະກອບຕາມລາຍການຂ້າງເທິງແລ້ວ.
      </p>

      <div className="mt-20 grid grid-cols-3 gap-8 text-center text-sm">
        {["ຜູ້ສົ່ງມອບ", "ຜູ້ຮັບເຄື່ອງ", "ຜູ້ອະນຸມັດ"].map((label) => (
          <div key={label}>
            <div className="border-t border-slate-900 pt-2">{label}</div>
            <p className="mt-1 text-xs text-slate-500">ວັນທີ ____ / ____ / ______</p>
          </div>
        ))}
      </div>
    </main>
  );
}
