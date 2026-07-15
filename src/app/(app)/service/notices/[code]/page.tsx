import { LinkPending } from "@/components/link-pending";
import type { Product } from "@/components/product-picker";
import { ServiceNoticeForm, type Notice } from "@/components/service-notice-form";
import { query, queryOdg } from "@/lib/db";
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
      `select a.code, coalesce(a.creator_name,'') creator_name,
         coalesce(nullif(a.telephone,''), b.tel, '') telephone,
         coalesce(a.name_1,'') name_1, coalesce(a.sn,'') sn, coalesce(a.issue,'') issue, coalesce(a.remark,'') remark,
         coalesce(to_char(a.time_notice,'DD-MM-YYYY HH24:MI'),'') noticed, coalesce(a.p_brand,'') p_brand,
         coalesce(a.p_model,'') p_model, coalesce(a.service_type,'') service_type, coalesce(a.ref_code,'') ref_code,
         coalesce(nullif(a.cust_code,''), b.code, '') cust_code,
         coalesce(a.doc_ref,'') doc_ref, coalesce(a.location_repair,'') location_repair,
         coalesce(to_char(a.appoint_date,'YYYY-MM-DD'),'') appoint_date,
         a.location_lat, a.location_lng,
         coalesce(b.name_1,'') cust_name,
         coalesce(concat_ws('-', nullif(b.address,''), d.name_1, c.name_1),'') cust_address
       from tb_product_notice a
       left join lateral (
         select customer.* from ar_customer customer
          where (coalesce(a.cust_code,'') <> '' and customer.code = a.cust_code)
             or (coalesce(a.ref_code,'') <> '' and customer.ref_code = a.ref_code)
          order by case when customer.code = a.cust_code then 0 else 1 end, customer.code
          limit 1
       ) b on true
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

  /*
   * ໃບແຈ້ງຈາກ ERP ມີ doc_ref + SN + ຊື່ສິນຄ້າຢູ່ແລ້ວ. ຈັບລາຍການບິນຕົ້ນທາງໃຫ້ໄດ້
   * ກ່ອນ render ເພື່ອຕື່ມ item_code, ຫຍີ່ຫໍ້, model, ໝວດ, ບິນ ແລະ ວັນທີບິນ.
   * ຈັດລຳດັບ SN ກ່ອນ ເພາະບິນດຽວອາດມີຫຼາຍສິນຄ້າ.
   */
  const initialProduct = notice.ref_code && (notice.doc_ref || notice.name_1 || notice.sn)
    ? (await queryOdg<Product>(
        `select d.item_code, d.item_name,
           coalesce(i.item_brand,'') brand,
           coalesce(i.item_model,'') model,
           coalesce(i.item_category,'') product_type,
           d.doc_no, to_char(d.doc_date,'YYYY-MM-DD') doc_date,
           'purchase'::text source
         from public.ic_trans_detail d
         left join public.ic_inventory i on i.code = d.item_code
         where d.cust_code = $1
           and d.trans_type = 2 and d.trans_flag in (30, 44)
           and (
             (nullif($2,'') is not null and d.doc_no = $2)
             or lower(trim(d.item_name)) = lower(trim($3))
           )
         order by
           case when nullif($4,'') is not null and exists (
             select 1 from public.sn_trans_detail s
              where s.doc_ref = d.doc_no and s.item_code = d.item_code
                and (s.sn = $4 or s.isn = $4)
           ) then 0 else 1 end,
           case when d.doc_no = $2 then 0 else 1 end,
           case when lower(trim(d.item_name)) = lower(trim($3)) then 0 else 1 end,
           d.doc_date desc, d.roworder desc
         limit 1`,
        [notice.ref_code, notice.doc_ref, notice.name_1, notice.sn],
      )).rows[0] ?? null
    : null;

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
        initialProduct={initialProduct}
      />
    </div>
  );
}
