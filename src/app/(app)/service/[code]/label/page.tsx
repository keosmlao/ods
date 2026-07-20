import { PrintButton } from "@/components/print-button";
import { code128Svg } from "@/lib/barcode";
import { query } from "@/lib/db";
import { SERVICE_TYPE_LABEL } from "@/lib/sla";
import { stageLabel, STAGE_SQL } from "@/lib/stage";
import { notFound } from "next/navigation";

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
  reg_date: string | null;
  service_type: string | null;
  stage: number;
};

export default async function JobLabelPage({ params }: Props) {
  const { code } = await params;

  const job = (
    await query<Job>(
      `select a.code, a.name_1 product, a.sn, a.p_brand brand, a.p_model model,
          c.name_1 customer, c.tel phone, nullif(trim(coalesce(a.issue,'')),'') issue,
          to_char(a.time_register,'DD-MM-YYYY') reg_date,
          a.service_type, (${STAGE_SQL})::int stage
        from tb_product a left join ar_customer c on c.code = a.cust_code
       where a.code = $1 limit 1`,
      [code],
    )
  ).rows[0];
  if (!job) notFound();

  const barcode = code128Svg(job.code, { height: 60, fit: true });
  const serviceType = job.service_type ? SERVICE_TYPE_LABEL[job.service_type] ?? job.service_type : null;
  const info = (label: string, value: string | null) =>
    value ? (
      <div className="flex gap-1.5">
        <span className="shrink-0 text-[8pt] text-slate-500">{label}</span>
        <span className="min-w-0 flex-1 break-words text-[9pt] font-semibold text-black">{value}</span>
      </div>
    ) : null;

  return (
    <div className="mx-auto bg-white text-black">
      <style>{`
        @page { size: 100mm 150mm; margin: 0 }
        @media print {
          .no-print { display: none !important }
          html, body { margin: 0; padding: 0; width: 100mm; height: 150mm; overflow: hidden }
          .label { position: absolute; inset: 0; width: 100mm !important; height: 150mm !important; border: 0 !important }
        }
      `}</style>

      <div className="no-print flex items-center justify-between gap-3 p-4">
        <p className="text-sm text-slate-500">ປ້າຍ 100 × 150 mm — ເລືອກຂະໜາດເຈ້ຍ 100×150 ຕອນພິມ (ຫຼື ເຄື່ອງພິມປ້າຍ thermal)</p>
        <PrintButton label="ພິມປ້າຍ tracking" />
      </div>

      <div
        className="label mx-auto flex flex-col border border-slate-300 print:border-0"
        style={{ width: "100mm", height: "150mm", padding: "4mm" }}
      >
        {/* ── ຫົວ: ປະເພດບໍລິການ + ຂັ້ນ ── */}
        <div className="flex items-center justify-between border-b-2 border-black pb-1.5">
          <span className="text-[11pt] font-black tracking-wide">ODIEN SERVICE</span>
          {serviceType && (
            <span className="rounded border border-black px-1.5 py-0.5 text-[8pt] font-bold">
              {job.service_type} · {serviceType}
            </span>
          )}
        </div>

        {/* ── ຂໍ້ມູນເຄື່ອງ ── */}
        <div className="mt-2 space-y-1">
          {info("ສິນຄ້າ", job.product)}
          {info("ຍີ່ຫໍ້/ລຸ້ນ", [job.brand, job.model].filter(Boolean).join(" / ") || null)}
          {info("SN", job.sn)}
          {info("ລູກຄ້າ", job.customer)}
          {info("ໂທ", job.phone)}
          {info("ອາການ", job.issue)}
          {info("ຂັ້ນ", stageLabel(job.stage, job.service_type))}
          {info("ຮັບວັນທີ", job.reg_date)}
        </div>

        {/* ── ບາໂຄດ ── ໃຫຍ່ກາງປ້າຍ */}
        <div className="mt-auto flex flex-col items-center">
          <div
            className="w-full"
            style={{ height: "22mm" }}
            // SVG vector ຈາກ code128Svg — ບໍ່ມີ user input ໃນ markup (ເລກງານ Code128 ເຂົ້າລະຫັດ)
            dangerouslySetInnerHTML={{ __html: barcode }}
          />
          <p className="text-center text-[26pt] font-black leading-none tracking-widest">{job.code}</p>
        </div>
      </div>
    </div>
  );
}
