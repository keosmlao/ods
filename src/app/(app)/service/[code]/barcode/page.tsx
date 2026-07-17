import { PrintButton } from "@/components/print-button";
import { code128Svg } from "@/lib/barcode";
import { query } from "@/lib/db";
import { notFound } from "next/navigation";

/**
 * **ປ້າຍບາໂຄດຂອງງານສ້ອມ — ຂະໜາດ 50 × 30 mm** (ປ້າຍສະຕິກເກີ ຕິດໃສ່ເຄື່ອງລູກຄ້າ).
 *
 * ບາໂຄດ Code128 ຂອງ**ເລກງານ** (tb_product.code) ໃຫ້ສະແກນຫາໃບໄດ້ໄວ — ບໍ່ຕ້ອງພິມເລກມື.
 * ສ້າງເປັນ SVG vector ຝັ່ງ server (lib/barcode) ⇒ ພິມຄົມທຸກຂະໜາດ ບໍ່ຕ້ອງ dependency.
 *
 * ຂະໜາດຄຸມດ້ວຍ `@page { size: 50mm 30mm }` — ເຄື່ອງພິມປ້າຍ (label printer) ຫຼື
 * ກົດ "ພິມ" ຂອງ browser ແລ້ວເລືອກຂະໜາດເຈ້ຍ 50×30. ບໍ່ມີ margin ໃຫ້ເສຍເນື້ອທີ່ປ້າຍນ້ອຍ.
 */
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ code: string }> };

type Job = {
  code: string;
  product: string | null;
  sn: string | null;
  brand: string | null;
  customer: string | null;
  reg_date: string | null;
};

export default async function JobBarcodePage({ params }: Props) {
  const { code } = await params;

  const job = (
    await query<Job>(
      `select a.code, a.name_1 product, a.sn, a.p_brand brand,
          c.name_1 customer, to_char(a.time_register,'DD-MM-YYYY') reg_date
        from tb_product a left join ar_customer c on c.code = a.cust_code
       where a.code = $1 limit 1`,
      [code],
    )
  ).rows[0];
  if (!job) notFound();

  // ບາໂຄດຂອງເລກງານ — fit ໃຫ້ຍືດເຕັມກ່ອງ 50mm ບໍ່ວ່າເລກສັ້ນ/ຍາວ
  const barcode = code128Svg(job.code, { height: 46, fit: true });

  return (
    <div className="mx-auto bg-white text-black">
      <style>{`
        @page { size: 50mm 30mm; margin: 0 }
        @media print {
          .no-print { display: none !important }
          html, body { margin: 0 }
          .label { page-break-after: always }
        }
      `}</style>

      <div className="no-print flex items-center justify-between gap-3 p-4">
        <p className="text-sm text-slate-500">
          ປ້າຍ 50 × 30 mm — ເລືອກຂະໜາດເຈ້ຍ 50×30 ຕອນພິມ (ຫຼື ເຄື່ອງພິມປ້າຍ)
        </p>
        <PrintButton label="ພິມປ້າຍ" />
      </div>

      {/* ປ້າຍຈິງ — 50×30mm ພໍດີ. flex ຈັດກາງ ບໍ່ໃຫ້ບາໂຄດຕິດຂອບ */}
      <div
        className="label mx-auto flex flex-col items-center justify-center overflow-hidden border border-slate-200 print:border-0"
        style={{ width: "50mm", height: "30mm", padding: "1.5mm" }}
      >
        {/* ຫຍີ່ຫໍ້ · SN ນ້ອຍໆເທິງສຸດ (ຖ້າມີ) — ຊ່ວຍຢືນຢັນວ່າປ້າຍຖືກເຄື່ອງ */}
        <p className="w-full truncate text-center text-[6pt] leading-none text-slate-700">
          {[job.brand, job.sn].filter(Boolean).join(" · ") || " "}
        </p>

        {/* ບາໂຄດ — ກວ້າງເຕັມປ້າຍ ສູງຄົງທີ່ */}
        <div
          className="w-full"
          style={{ height: "13mm" }}
          // SVG vector ຈາກ server — ບໍ່ມີ user input ໃນ markup (ເລກງານຖືກ Code128 ເຂົ້າລະຫັດ)
          dangerouslySetInnerHTML={{ __html: barcode }}
        />

        {/* ເລກງານ ໃຫ່ຍ ອ່ານດ້ວຍຕາໄດ້ (ຄູ່ກັບບາໂຄດ ຄື label ມາດຕະຖານ) */}
        <p className="text-center text-[13pt] font-bold leading-none tracking-wide">{job.code}</p>

        {/* ລູກຄ້າ + ວັນທີ ນ້ອຍໆລຸ່ມສຸດ */}
        <p className="w-full truncate text-center text-[6pt] leading-none text-slate-700">
          {[job.customer, job.reg_date].filter(Boolean).join(" · ") || " "}
        </p>
      </div>
    </div>
  );
}
