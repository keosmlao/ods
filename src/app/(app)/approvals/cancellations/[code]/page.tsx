import { LinkPending } from "@/components/link-pending";
import { Card, PageTitle } from "@/components/ui";
import { query } from "@/lib/db";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getLocale } from "@/lib/i18n/locale";
import { PackageCheck } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CancelDecision } from "../cancel-decision";
import { getOutstandingSpares, groupByDoc } from "@/lib/outstanding-spares";
import { OutstandingSpares } from "../outstanding-spares";

/** ຖອດແບບຈາກ ods: Services.py cc_approve_page() + templates/Service/approve_cc_page.html */

type Props = { params: Promise<{ code: string }> };

type Head = {
  customer: string | null;
  product: string | null;
  model: string | null;
  sn: string | null;
  brand: string | null;
  warranty: string | null;
  /** ເຫດຜົນທີ່ຊ່າງຕັດສິນວ່າໝົດຮັບປະກັນ — ມັກເປັນຕົ້ນເຫດຂອງການຂໍຍົກເລີກ */
  warranty_reason: string | null;
  issue: string | null;
  issue_2: string | null;
  technician: string | null;
  code: string;
  product_url: string | null;
  cust_code: string | null;
  remark: string | null;
  cancel_finish: string | null;
  request_cancel: string | null;
  return_complete: string | null;
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
  const t = (await getDictionary(await getLocale())).cancellationDetail;

  const head = (
    await query<Head>(
      `select concat_ws('-', b.name_1, b.tel) customer, a.name_1 product, a.p_model model, a.sn, a.p_brand brand,
          a.warrunty warranty, a.warranty_reason, a.issue, a.issue_2, a.emp_code technician, a.code, c.product_url,
          b.code cust_code, a.remark, a.request_cancel,
          to_char(a.cancel_finish,'DD-MM-YYYY HH24:MI:SS') cancel_finish,
          to_char(a.return_complete,'DD-MM-YYYY HH24:MI') return_complete
        from tb_product a
        left join ar_customer b on b.code = a.cust_code
        left join product_image c on a.code = c.iteme_code and c.line_number = 0
        where a.code = $1`,
      [code],
    )
  ).rows[0];

  if (!head) notFound();

  // GAP B — ອາໄຫຼ່ທີ່ເບີກອອກໄປແລ້ວ ແຕ່ຍັງບໍ່ໄດ້ສົ່ງຄືນສາງ
  const docs = groupByDoc(await getOutstandingSpares(head.code));

  return (
    <div className="w-full space-y-5">
      <PageTitle sub={t.pageTitle}>{t.pageTitle}</PageTitle>

      <OutstandingSpares code={head.code} docs={docs} />

      <Card title={`${t.receiptCode} ${head.code}`}>
        {head.cancel_finish ? (
          <div className="flex flex-wrap items-center gap-3">
            <p className="flex-1 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
              {t.approvedCancel} ({head.cancel_finish})
              {head.return_complete && <> · {t.returnedToCustomer} ({head.return_complete})</>}
            </p>
            {/* GAP A — ຍົກເລີກແລ້ວກໍ່ຍັງຕ້ອງສົ່ງເຄື່ອງຄືນລູກຄ້າ (ອອກໃບຮັບເງິນຄ່າກວດເຊັກ ຫຼື ບໍ່ອອກກໍ່ໄດ້) */}
            {!head.return_complete && (
              <Link
                href={`/returns/${encodeURIComponent(head.code)}`}
                className="inline-flex h-10 items-center gap-2 rounded-lg bg-teal-600 px-4 text-sm font-semibold text-white hover:bg-teal-700"
              >
                <PackageCheck className="size-4" />
                {t.returnToCustomer}
                <LinkPending className="size-3.5" />
              </Link>
            )}
          </div>
        ) : (
          /* ຍັງບໍ່ອະນຸມັດ → ຕັດສິນໄດ້ 2 ທາງ: ອະນຸມັດ ຫຼື ບໍ່ອະນຸມັດ (ພ້ອມເຫດຜົນ) */
          <CancelDecision productCode={head.code} />
        )}

        <div className="mt-5 grid gap-5 md:grid-cols-3">
          <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2 md:col-span-2">
            <Field label={t.customer} value={head.customer} />
            <Field label={t.productName} value={head.product} />
            <Field label="Model" value={head.model} accent />
            <Field label="SN" value={head.sn} />
            <Field label={t.brand} value={head.brand} accent />
            <Field label={t.warranty} value={head.warranty} />
            {/* ຫຼັກຖານຂອງການຕັດສິນປະກັນ — ຜູ້ອະນຸມັດຕ້ອງເຫັນກ່ອນຕັດສິນຄຳຂໍຍົກເລີກ */}
            {head.warranty_reason && <Field label={t.warrantyVoidReason} value={head.warranty_reason} accent />}
            <Field label={t.issue} value={head.issue} accent />
            <Field label={t.issueChecked} value={head.issue_2} />
            <Field label={t.technician} value={head.technician} />
            <Field label={t.requestedBy} value={head.request_cancel} />
            <div className="flex gap-2 sm:col-span-2">
              <dt className="shrink-0 text-slate-500">{t.remark}:</dt>
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
              <span className="grid size-48 place-items-center rounded-lg bg-slate-100 text-sm text-slate-400">{t.noImage}</span>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
