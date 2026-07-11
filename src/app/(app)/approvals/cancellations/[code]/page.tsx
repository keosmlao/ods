import { CancelApproveActions } from "@/components/quotation/approve-actions";
import { Card, PageTitle } from "@/components/ui";
import { query } from "@/lib/db";
import Image from "next/image";
import { notFound } from "next/navigation";

/** ຖອດແບບຈາກ ods: Services.py cc_approve_page() + templates/Service/approve_cc_page.html */

type Props = { params: Promise<{ code: string }> };

type Head = {
  customer: string | null;
  product: string | null;
  model: string | null;
  sn: string | null;
  brand: string | null;
  warranty: string | null;
  issue: string | null;
  issue_2: string | null;
  technician: string | null;
  code: string;
  product_url: string | null;
  cust_code: string | null;
  remark: string | null;
  cancel_finish: string | null;
  request_cancel: string | null;
};

function Field({ label, value, accent }: { label: string; value: string | null; accent?: boolean }) {
  return (
    <div className="flex gap-2">
      <dt className="shrink-0 text-slate-500">{label}:</dt>
      <dd className={accent ? "font-medium text-[#b91c1c]" : "text-slate-800"}>{value || "-"}</dd>
    </div>
  );
}

export default async function CancellationDetailPage({ params }: Props) {
  const { code } = await params;

  const head = (
    await query<Head>(
      `select concat_ws('-', b.name_1, b.tel) customer, a.name_1 product, a.p_model model, a.sn, a.p_brand brand,
          a.warrunty warranty, a.issue, a.issue_2, a.emp_code technician, a.code, c.product_url,
          b.code cust_code, a.remark, a.request_cancel,
          to_char(a.cancel_finish,'DD-MM-YYYY HH24:MI:SS') cancel_finish
        from tb_product a
        left join ar_customer b on b.code = a.cust_code
        left join product_image c on a.code = c.iteme_code and c.line_number = 0
        where a.code = $1`,
      [code],
    )
  ).rows[0];

  if (!head) notFound();

  return (
    <div className="w-full space-y-5">
      <PageTitle sub="ອະນຸມັດຍົກເລີກເຄື່ອງສ້ອມ">ອະນຸມັດຍົກເລີກເຄື່ອງສ້ອມ</PageTitle>

      <Card title={`ລະຫັດຮັບເຄື່ອງ ${head.code}`}>
        {head.cancel_finish ? (
          <p className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
            ອະນຸມັດຍົກເລີກເເລ້ວ ({head.cancel_finish})
          </p>
        ) : (
          <CancelApproveActions productCode={head.code} />
        )}

        <div className="mt-5 grid gap-5 md:grid-cols-3">
          <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2 md:col-span-2">
            <Field label="ລູກຄ້າ" value={head.customer} />
            <Field label="ຊື່ສິນຄ້າ" value={head.product} />
            <Field label="Model" value={head.model} accent />
            <Field label="SN" value={head.sn} />
            <Field label="ຫຍີ່ຫໍ້" value={head.brand} accent />
            <Field label="ຮັບປະກັນ" value={head.warranty} />
            <Field label="ອາການ" value={head.issue} accent />
            <Field label="ອາການຊ່າງ" value={head.issue_2} />
            <Field label="ຊ່າງ" value={head.technician} />
            <Field label="ຜູ້ຂໍຍົກເລີກ" value={head.request_cancel} />
            <div className="flex gap-2 sm:col-span-2">
              <dt className="shrink-0 text-slate-500">ໝາຍເຫດ:</dt>
              <dd className="text-slate-800">{head.remark || "-"}</dd>
            </div>
          </dl>

          <div className="grid place-items-start justify-center">
            {head.product_url ? (
              <a href={`/api/uploads/${encodeURIComponent(head.product_url)}`} target="_blank" rel="noreferrer">
                <Image
                  src={`/api/uploads/${encodeURIComponent(head.product_url)}`}
                  alt=""
                  width={200}
                  height={200}
                  unoptimized
                  className="size-48 rounded-lg object-cover"
                />
              </a>
            ) : (
              <span className="grid size-48 place-items-center rounded-lg bg-slate-100 text-sm text-slate-400">ບໍ່ມີຮູບ</span>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
