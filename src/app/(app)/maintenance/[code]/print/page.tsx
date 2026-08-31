import { PrintButton } from "@/components/print-button";
import { getCompany } from "@/components/report/print-layout";
import { maintenanceJob } from "@/lib/maintenance";
import { listTechnicians } from "@/lib/technicians";
import Image from "next/image";
import { notFound } from "next/navigation";

/**
 * ພິມ **ໃບງານສ້ອມບຳລຸງ** — ຖອດແບບຈາກ ໃບຮັບເຄື່ອງສ້ອມແປງ (/service/[code]/print):
 * ໂຄງ 2 ພາສາ ລາວ/ອັງກິດ · ຫົວກະດາດ ແລະ ຊຸດລາຍເຊັນອັນດຽວກັນ · A4 · ພິມຜ່ານ browser
 * ⇒ ເລືອກ "Save as PDF" ໄດ້ ໂດຍບໍ່ຕ້ອງເພີ່ມ dependency (ຄືປຸ່ມ PrintButton ໜ້າອື່ນ).
 *
 * ຕ່າງຈາກໃບຮັບເຄື່ອງ 2 ຈຸດ — ຕັ້ງໃຈ ບໍ່ແມ່ນລືມ:
 * ① **ບໍ່ມີ QR ຕິດຕາມ** — ໜ້າສາທາລະນະ /track ອ່ານແຕ່ `tb_product` ແຕ່ງານບຳລຸງຢູ່
 *    `ods_tb_maintenance` ⇒ QR ຈະພາລູກຄ້າໄປໜ້າ "ບໍ່ພົບໃບ". ໃສ່ໄດ້ເມື່ອ /track
 *    ຮູ້ຈັກງານບຳລຸງແລ້ວເທົ່ານັ້ນ.
 * ② ແທນຊ່ອງ ອາການ/ຕຳນິ ຂອງເຄື່ອງສ້ອມ ດ້ວຍ **ຕາຕະລາງລາຍການບໍລິການ + ຍອດລວມ**
 *    (ods_tb_maintenance_detail) — ຊ່າງຖືໃບນີ້ໄປໜ້າງານ ແລະ ລູກຄ້າເຊັນຮັບຢູ່ນຳ.
 */
export const dynamic = "force-dynamic";

/** ຫ້ອງປ້າຍ 2 ພາສາ (ລາວ / ອັງກິດ) — ຄືກັນກັບໃບຮັບເຄື່ອງສ້ອມແປງ */
function LabelCell({ lo, en, width }: { lo: string; en: string; width?: string }) {
  return (
    <td className="border border-black px-2 py-1 align-top" style={width ? { width } : undefined}>
      <div>{lo}</div>
      <div className="text-[10px] leading-tight text-slate-600">{en}</div>
    </td>
  );
}

function ValueCell({ value, colSpan }: { value: string | null; colSpan?: number }) {
  return (
    <td className="border border-black px-2 py-1 align-top font-semibold" colSpan={colSpan}>
      {value || " "}
    </td>
  );
}

export default async function MaintenanceJobSheet({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const [data, technicians, company] = await Promise.all([
    maintenanceJob(decodeURIComponent(code)),
    listTechnicians(),
    getCompany(),
  ]);
  if (!data) notFound();
  const { job, details, steps } = data;

  const techName = (value: string | null) => technicians.find((t) => t.code === value)?.name ?? value ?? null;
  const helpers = (job.helpers ?? []).map(techName).filter(Boolean).join(" · ");
  // ວັນ/ເວລາເປີດງານ = ຂັ້ນ 0 ຂອງ timeline (ຈັດຮູບແບບ DD-MM-YYYY HH24:MI ມາແລ້ວ)
  const [openedDate, openedTime] = (steps[0]?.at ?? "").split(" ");
  const kip = (value: number) => value.toLocaleString();

  return (
    <div className="mx-auto max-w-[210mm] bg-white p-8 text-sm text-black print:p-0">
      <style>{`@media print { @page { size: A4; margin: 12mm } .no-print { display: none !important } }`}</style>

      <div className="no-print mb-4 flex items-center justify-between rounded-lg bg-slate-100 px-4 py-2">
        <span className="text-xs text-slate-600">ໃບງານສ້ອມບຳລຸງ #{job.code}</span>
        <PrintButton />
      </div>

      {/* ຫົວກະດາດ: ໂລໂກ້ · ຂໍ້ມູນບໍລິສັດ · ເລກທີໃບງານ */}
      <header className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <Image src="/ods-logo.png" alt="ODIEN Service & Spare Parts" width={72} height={72} priority className="h-16 w-auto object-contain" />
          <div className="text-xs leading-5">
            <p className="text-sm font-bold">{company.name_1 || "ODIEN SERVICE"}</p>
            {company.name_2 && <p>{company.name_2}</p>}
            {company.address && <p>ຕັ້ງຢູ່: {company.address}</p>}
            {company.tel && <p>ໂທລະສັບ: {company.tel}</p>}
          </div>
        </div>
        <div className="text-xs leading-5">
          <p>ວັນທີ: {openedDate || "-"}</p>
          <p>ເວລາ: {openedTime || "-"}</p>
          <p>
            ເລກທີໃບງານ: <b className="text-base">{job.code}</b>
          </p>
        </div>
      </header>

      <h1 className="my-3 text-center text-xl font-bold">ໃບງານສ້ອມບຳລຸງ</h1>

      {/* ຂໍ້ມູນລູກຄ້າ */}
      <p className="mb-1 font-bold underline">ຂໍ້ມູນລູກຄ້າ / Customer Information</p>
      <table className="w-full border-collapse text-xs">
        <tbody>
          <tr>
            <LabelCell lo="ຊື່ລູກຄ້າ" en="Customer Name" width="180px" />
            <ValueCell value={job.cust_name} />
            <LabelCell lo="ໂທລະສັບ" en="Tel" width="130px" />
            <ValueCell value={job.cust_tel} />
          </tr>
          <tr>
            <LabelCell lo="ທີ່ຢູ່ໜ້າງານ" en="Site Address" />
            <ValueCell value={job.location} colSpan={3} />
          </tr>
        </tbody>
      </table>

      {/* ຂໍ້ມູນງານ */}
      <p className="mb-1 mt-4 font-bold underline">ຂໍ້ມູນງານ / Job Information</p>
      <table className="w-full border-collapse text-xs">
        <tbody>
          <tr>
            <LabelCell lo="ວັນນັດເຂົ້າໜ້າງານ" en="Appointment Date" width="180px" />
            <ValueCell value={job.appoint_date} />
            <LabelCell lo="ສະຖານະ" en="Status" width="130px" />
            <ValueCell value={job.stage_label} />
          </tr>
          <tr>
            <LabelCell lo="ຊ່າງຜູ້ຮັບຜິດຊອບ" en="Technician" />
            <ValueCell value={techName(job.emp_code)} />
            <LabelCell lo="ນັດຄັ້ງຕໍ່ໄປ" en="Next Due" width="130px" />
            <ValueCell value={job.next_due} />
          </tr>
          <tr>
            <LabelCell lo="ຊ່າງຮ່ວມ" en="Assisting Technicians" />
            <ValueCell value={helpers || null} colSpan={3} />
          </tr>
          <tr>
            <LabelCell lo="ໝາຍເຫດ" en="Remark" />
            <ValueCell value={job.remark} colSpan={3} />
          </tr>
        </tbody>
      </table>

      {/* ລາຍການບໍລິການ */}
      <p className="mb-1 mt-4 font-bold underline">ລາຍການບໍລິການ / Service Items</p>
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr>
            <LabelCell lo="ລຳດັບ" en="No." width="50px" />
            <LabelCell lo="ລາຍການບໍລິການ" en="Service" />
            <LabelCell lo="ຈຳນວນ" en="Qty" width="70px" />
            <LabelCell lo="ລາຄາ (ກີບ)" en="Price" width="110px" />
            <LabelCell lo="ລວມ (ກີບ)" en="Amount" width="120px" />
          </tr>
        </thead>
        <tbody>
          {details.map((detail, index) => (
            <tr key={detail.id}>
              <td className="border border-black px-2 py-1 text-center">{index + 1}</td>
              <td className="border border-black px-2 py-1 font-semibold">{detail.name}</td>
              <td className="border border-black px-2 py-1 text-center tabular-nums">{detail.qty}</td>
              <td className="border border-black px-2 py-1 text-right tabular-nums">{kip(detail.price)}</td>
              <td className="border border-black px-2 py-1 text-right tabular-nums">{kip(detail.price * detail.qty)}</td>
            </tr>
          ))}
          {details.length === 0 && (
            <tr>
              <td className="border border-black px-2 py-3 text-center text-slate-500" colSpan={5}>
                ຍັງບໍ່ໄດ້ໃສ່ລາຍການບໍລິການ
              </td>
            </tr>
          )}
          <tr>
            <td className="border border-black px-2 py-1 text-right font-bold" colSpan={4}>
              ລວມທັງໝົດ / Total
            </td>
            <td className="border border-black px-2 py-1 text-right text-sm font-bold tabular-nums">{kip(job.total)}</td>
          </tr>
        </tbody>
      </table>

      {/* ລາຍເຊັນ */}
      <div className="mt-12 grid grid-cols-3 text-center text-xs">
        <div>
          <p>................</p>
          <p className="mt-1">ລູກຄ້າຜູ້ຮັບບໍລິການ</p>
        </div>
        <div>
          <p>....{techName(job.emp_code) || ""}..</p>
          <p className="mt-1">ຊ່າງຜູ້ປະຕິບັດງານ</p>
        </div>
        <div>
          <p>................</p>
          <p className="mt-1">ຜູ້ກວດຮັບງານ</p>
        </div>
      </div>

      {company.tel && <p className="mt-8 text-center font-bold">ຕິດຕໍ່ໂດຍກົງ: ໂທ {company.tel}</p>}
      <p className="mt-1 text-center text-base font-bold">ODIEN SERVICES 5S &quot;SPEED SMART STANDARD SURE SMILE&quot;</p>
    </div>
  );
}
