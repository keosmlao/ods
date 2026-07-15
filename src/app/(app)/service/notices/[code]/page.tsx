import { LinkPending } from "@/components/link-pending";
import { ServiceNoticeForm, type Notice } from "@/components/service-notice-form";
import { query } from "@/lib/db";
import { getErpBrands, getErpCategories, getErpTechnicians } from "@/lib/erp-master";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

/**
 * ຄື /cppro_online/<code> ຂອງ ods — ຮັບໃບແຈ້ງສ້ອມອອນລາຍເຂົ້າເປັນງານ
 *
 * ແກ້ບັກ (ຄືກັນກັບໜ້າແກ້ໄຂ): ເຄີຍດຶງ ປະເພດສິນຄ້າ/ຫຍີ່ຫໍ້/ຊ່າງ ຈາກ tb_type, tb_brand, users
 * ເຊິ່ງເລີກໃຊ້ແລ້ວ → dropdown ເກືອບຫວ່າງ. ດຽວນີ້ດຶງຈາກ ERP ຄືກັບໜ້າໃບຮັບເຄື່ອງໃໝ່.
 */
type Props = { params: Promise<{ code: string }> };

export default async function NoticeIntake({ params }: Props) {
  const { code } = await params;
  const noticeCode = decodeURIComponent(code);

  const notice = (
    await query<Notice>(
      `select a.code, coalesce(a.creator_name,'') creator_name, coalesce(a.telephone,'') telephone,
         coalesce(a.name_1,'') name_1, coalesce(a.sn,'') sn, coalesce(a.issue,'') issue, coalesce(a.remark,'') remark,
         coalesce(to_char(a.time_notice,'DD-MM-YYYY HH24:MI'),'') noticed, coalesce(a.p_brand,'') p_brand,
         coalesce(a.p_model,'') p_model, coalesce(a.service_type,'') service_type, coalesce(a.ref_code,'') ref_code,
         coalesce(b.name_1,'') cust_name,
         coalesce(concat_ws('-', nullif(b.address,''), d.name_1, c.name_1),'') cust_address
       from tb_product_notice a
       left join ar_customer b on b.ref_code = a.ref_code and coalesce(a.ref_code,'') <> ''
       left join province c on c.code = b.provine
       left join city d on d.code = b.city and d.province = b.provine
       where a.code = $1 limit 1`,
      [noticeCode],
    )
  ).rows[0];
  if (!notice) notFound();

  // ຮັບເຂົ້າໄປແລ້ວ → ພາໄປໜ້າງານເລີຍ
  const done = (await query<{ code: string }>("select code from tb_product where ref_notice = $1 limit 1", [noticeCode])).rows[0];
  if (done) redirect(`/service/${done.code}`);

  const [types, brands, techs, imageRows] = await Promise.all([
    getErpCategories(),
    getErpBrands(),
    getErpTechnicians(),
    // ຕັດແຖວທີ່ product_url ເປັນ null ອອກ — ບໍ່ດັ່ງນັ້ນຊ່ອງຮູບຈະຊີ້ໄປ /api/uploads/null
    query<{ product_url: string; line_number: number }>(
      `select product_url, coalesce(line_number,0) line_number from product_image
       where ref_code = $1 and coalesce(product_url,'') <> ''
       order by line_number, roworder desc`,
      [noticeCode],
    ),
  ]);

  const images: Record<number, string> = {};
  for (const row of imageRows.rows) if (!(row.line_number in images)) images[row.line_number] = row.product_url;

  return (
    <div className="w-full space-y-4">
      <div>
        <Link href="/service/notices" className="mb-2 inline-flex items-center gap-1.5 text-xs font-medium text-teal-600 hover:underline">
          <ArrowLeft className="size-3.5" />
          ກັບລາຍການລູກຄ້າເເຈ້ງສ້ອມ
          <LinkPending className="size-3" />
        </Link>
        <h1 className="text-xl font-bold text-slate-700">ໃບຮັບເຄື່ອງເຂົ້າສ້ອມ (ລູກຄ້າເເຈ້ງສ້ອມ)</h1>
        <p className="mt-0.5 text-xs text-slate-500">
          ລະຫັດເເຈ້ງສ້ອມ {notice.code}
          {notice.noticed && <span className="text-slate-400"> · ເເຈ້ງເມື່ອ {notice.noticed}</span>}
        </p>
      </div>

      <ServiceNoticeForm
        notice={notice}
        types={types}
        brands={brands}
        techs={techs}
        images={images}
      />
    </div>
  );
}
