import { PrintButton } from "@/components/print-button";
import { getCompany } from "@/components/report/print-layout";
import { code128Svg } from "@/lib/barcode";
import { query } from "@/lib/db";
import { SERVICE_TYPE_LABEL } from "@/lib/sla";
import { stageLabel, STAGE_SQL } from "@/lib/stage";
import { trackUrl } from "@/lib/track";
import { notFound } from "next/navigation";
import QRCode from "qrcode";

/**
 * **ປ້າຍ tracking ເຄື່ອງສ້ອມ — ຂະໜາດ 100 × 150 mm** (ປ້າຍ thermal ມ້ວນ) — ຕິດໃສ່ເຄື່ອງລູກຄ້າ.
 *
 * ຂໍ້ມູນເຄື່ອງເຕັມ (ສິນຄ້າ/ຍີ່ຫໍ້/SN/ລູກຄ້າ/ຂັ້ນ/ປະເພດບໍລິການ) + **barcode Code128 ຂອງເລກງານ**
 * ⇒ ສະແກນຕິດຕາມໄດ້ໄວ. ຂະໜາດຄຸມດ້ວຍ `@page { size: 100mm 150mm }`.
 */
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ code: string }> };

type Job = {
  code: string;
  product: string | null;
  sn: string | null;
  brand: string | null;
  model: string | null;
  customer: string | null;
  phone: string | null;
  issue: string | null;
  accessory: string | null;
  reg_date: string | null;
  service_type: string | null;
  stage: number;
};

export default async function JobLabelPage({ params }: Props) {
  const { code } = await params;

  const [job, company] = await Promise.all([
    query<Job>(
      `select a.code, a.name_1 product, a.sn, a.p_brand brand, a.p_model model,
          c.name_1 customer, c.tel phone, nullif(trim(coalesce(a.issue,'')),'') issue,
          nullif(trim(coalesce(a.p_access,'')),'') accessory,
          to_char(a.time_register,'DD-MM-YYYY') reg_date,
          a.service_type, (${STAGE_SQL})::int stage
        from tb_product a left join ar_customer c on c.code = a.cust_code
       where a.code = $1 limit 1`,
      [code],
    ).then((r) => r.rows[0]),
    getCompany(),
  ]);
  if (!job) notFound();

  const barcode = code128Svg(job.code, { height: 60, fit: true });
  // QR ໃຫ້ລູກຄ້າສະແກນຕິດຕາມສະຖານະເອງ → ໜ້າສາທາລະນະ /track/<ເລກງານ> (ຄືໃບຮັບເຄື່ອງ)
  const qr = await QRCode.toString(await trackUrl(job.code), { type: "svg", margin: 0, errorCorrectionLevel: "M" });
  const serviceType = job.service_type ? SERVICE_TYPE_LABEL[job.service_type] ?? job.service_type : null;
  const info = (label: string, value: string | null) =>
    value ? (
      <div className="grid grid-cols-[15mm_1fr] items-baseline gap-1.5 border-b border-dotted border-slate-300 py-[1.5px] last:border-0">
        <span className="text-[6.5pt] font-bold uppercase leading-tight tracking-wide text-slate-500">{label}</span>
        <span className="min-w-0 break-words text-[9pt] font-bold leading-tight text-black">{value}</span>
      </div>
    ) : null;

  return (
    <div className="mx-auto bg-white text-black">
      <style>{`
        @page { size: 75mm 100mm; margin: 0 }
        @media print {
          .no-print { display: none !important }
          html, body { margin: 0; padding: 0; width: 75mm; height: 100mm; overflow: hidden }
          .label { position: absolute; inset: 0; width: 75mm !important; height: 100mm !important; border: 0 !important }
        }
      `}</style>

      <div className="no-print flex items-center justify-between gap-3 p-4">
        <p className="text-sm text-slate-500">ປ້າຍ 75 × 100 mm — ເລືອກຂະໜາດເຈ້ຍ 75×100 ຕອນພິມ (ຫຼື ເຄື່ອງພິມປ້າຍ thermal)</p>
        <PrintButton label="ພິມປ້າຍ tracking" />
      </div>

      <div
        className="label mx-auto flex flex-col border border-slate-300 print:border-0"
        style={{ width: "75mm", height: "100mm", padding: "2.5mm" }}
      >
        {/* ── ຫົວ: ສູນບໍລິການ · ປະເພດ · QR ── */}
        <div className="flex items-start justify-between gap-2 border-b-[2.5px] border-black pb-1.5">
          <div className="min-w-0 pt-0.5">
            <div className="truncate text-[10pt] font-black leading-none tracking-tight">{company.name_1 || "ODIEN SERVICE"}</div>
            {company.tel && <div className="mt-1 text-[6pt] font-medium leading-none text-slate-600">ໂທ {company.tel}</div>}
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            {serviceType && (
              <span className="bg-black px-1.5 py-0.5 text-[8pt] font-black leading-none tracking-wide text-white">{job.service_type}</span>
            )}
            {/* QR SVG ຈາກ lib qrcode — URL ຈາກ trackUrl (ບໍ່ມີ user input ດິບໃນ markup) */}
            <div className="[&>svg]:h-[13mm] [&>svg]:w-[13mm]" dangerouslySetInnerHTML={{ __html: qr }} />
            <span className="text-[5pt] font-semibold uppercase tracking-widest text-slate-500">Scan · ຕິດຕາມ</span>
          </div>
        </div>

        {/* ── ຂໍ້ມູນເຄື່ອງ ── */}
        <div className="mt-1.5 flex-1">
          {info("ສິນຄ້າ", job.product)}
          {info("ຍີ່ຫໍ້/ລຸ້ນ", [job.brand, job.model].filter(Boolean).join(" / ") || null)}
          {info("SN", job.sn)}
          {info("ລູກຄ້າ", job.customer)}
          {info("ອາການ", job.issue)}
          {info("ອຸປະກອນ", job.accessory)}
          {info("ຂັ້ນ", stageLabel(job.stage, job.service_type))}
        </div>

        {/* ── ບາໂຄດ + ເລກງານ (hero, inverted band) ── */}
        <div className="mt-auto">
          <div
            className="w-full"
            style={{ height: "12mm" }}
            // SVG vector ຈາກ code128Svg — ບໍ່ມີ user input ໃນ markup (ເລກງານ Code128 ເຂົ້າລະຫັດ)
            dangerouslySetInnerHTML={{ __html: barcode }}
          />
          <div className="mt-1 flex items-stretch overflow-hidden rounded-sm border-[2.5px] border-black">
            <span className="flex items-center bg-black px-1.5 text-[7pt] font-black tracking-widest text-white">JOB</span>
            <span className="flex-1 py-0.5 text-center text-[22pt] font-black leading-none tracking-wider">{job.code}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
