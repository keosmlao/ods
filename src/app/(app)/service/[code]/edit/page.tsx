import { LinkPending } from "@/components/link-pending";
import { ServiceEditForm, type ServiceHead } from "@/components/service-edit-form";
import { query } from "@/lib/db";
import { getErpBrands, getErpCategories, getErpTechnicians } from "@/lib/erp-master";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

/**
 * ຄື /rcpdedit/<roworder> ຂອງ ods (ໃຊ້ code ແທນ roworder)
 *
 * ແກ້ບັກ: ໜ້ານີ້ເຄີຍດຶງ ປະເພດສິນຄ້າ/ຫຍີ່ຫໍ້/ຊ່າງ ຈາກ tb_type, tb_brand ແລະ users ຂອງ ODS
 * ເຊິ່ງເປັນຕາຕະລາງທີ່ເລີກໃຊ້ແລ້ວ (tb_type ເຫຼືອພຽງ 3 ແຖວ) → ລາຍການ dropdown ເກືອບຫວ່າງ
 * ແລະ ບໍ່ຕົງກັບໜ້າ "ໃບຮັບເຄື່ອງໃໝ່" ທີ່ດຶງຈາກ ERP ຢູ່ແລ້ວ.
 * ດຽວນີ້ໃຊ້ແຫຼ່ງດຽວກັນກັບໜ້າສ້າງໃໝ່ (ic_category / ic_brand / odg_employee).
 */
type Props = { params: Promise<{ code: string }> };

export default async function EditService({ params }: Props) {
  const { code } = await params;

  // doc_date_ref ເປັນ varchar — ຫ້າມເອົາໄປໃສ່ to_char()
  const head = (
    await query<ServiceHead>(
      `select a.code, a.name_1, coalesce(a.sn,'') sn, coalesce(a.p_model,'') p_model, coalesce(a.p_type,'') p_type,
         coalesce(a.p_brand,'') p_brand, coalesce(a.p_access,'') p_access, coalesce(a.warrunty,'') warrunty,
         coalesce(a.p_delivery,'') p_delivery, coalesce(a.service_type,'') service_type, coalesce(a.issue,'') issue,
         coalesce(a.p_abrasion,'') p_abrasion, coalesce(a.cust_code,'') cust_code, coalesce(a.emp_code,'') emp_code,
         coalesce(a.ap_code,'') ap_code, coalesce(a.doc_def,'') doc_def, coalesce(a.doc_date_ref,'') doc_date_ref,
         coalesce(a.location_repair,'') location_repair,
         coalesce(to_char(a.appoint_date,'YYYY-MM-DD'),'') appoint_date,
         a.location_lat, a.location_lng,
         coalesce(b.name_1,'') cust_name, coalesce(b.tel,'') tel,
         coalesce(concat_ws('-', nullif(b.address,''), d.name_1, c.name_1),'') address
       from tb_product a
       left join ar_customer b on b.code = a.cust_code
       left join province c on c.code = b.provine
       left join city d on d.code = b.city and d.province = b.provine
       where a.code = $1 limit 1`,
      [code],
    )
  ).rows[0];
  if (!head) notFound();

  const [types, brands, techs, imageRows] = await Promise.all([
    getErpCategories(),
    getErpBrands(),
    getErpTechnicians(),
    // ຕັດແຖວທີ່ product_url ເປັນ null ອອກ — ບໍ່ດັ່ງນັ້ນຊ່ອງຮູບຈະຊີ້ໄປ /api/uploads/null
    query<{ product_url: string; line_number: number }>(
      `select product_url, coalesce(line_number,0) line_number from product_image
       where iteme_code = $1 and coalesce(product_url,'') <> ''
       order by line_number, roworder desc`,
      [code],
    ),
  ]);

  // ຮູບຫຼ້າສຸດຂອງແຕ່ລະ line
  const images: Record<number, string> = {};
  for (const row of imageRows.rows) if (!(row.line_number in images)) images[row.line_number] = row.product_url;

  return (
    <div className="w-full space-y-4">
      <div>
        <Link
          href={`/service/${code}`}
          className="mb-2 inline-flex items-center gap-1.5 text-xs font-medium text-teal-600 hover:underline"
        >
          <ArrowLeft className="size-3.5" />
          ກັບໜ້າໃບຮັບເຄື່ອງ
          <LinkPending className="size-3" />
        </Link>
        <h1 className="text-xl font-bold text-slate-700">ແກ້ໄຂໃບຮັບເຄື່ອງ #{head.code}</h1>
        <p className="mt-0.5 text-xs text-slate-500">{head.name_1} {head.sn && <span className="text-slate-400">· {head.sn}</span>}</p>
      </div>

      {/* ຊ່າງເກັບເປັນ "ຊື່ຫຼິ້ນ" ຢູ່ tb_product.emp_code — ຄ່າ ແລະ ປ້າຍຈຶ່ງເປັນອັນດຽວກັນ */}
      <ServiceEditForm
        head={head}
        types={types}
        brands={brands}
        techs={techs.map((tech) => ({ code: tech.code, username: tech.code }))}
        images={images}
      />
    </div>
  );
}
