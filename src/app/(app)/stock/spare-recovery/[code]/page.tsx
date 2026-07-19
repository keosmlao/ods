import { OutstandingSpares } from "@/app/(app)/approvals/cancellations/outstanding-spares";
import { Card, PageTitle } from "@/components/ui";
import { query } from "@/lib/db";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getLocale } from "@/lib/i18n/locale";
import { getOutstandingSpares, groupByDoc } from "@/lib/outstanding-spares";
import { PackageCheck } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

/**
 * **ຈັດການອາໄຫຼ່ຄ້າງນອກສາງ ຂອງ 1 ໃບຮັບເຄື່ອງ** — ໜ້າຂອງ**ສາງ**.
 *
 * ໜ້າດຽວກັນນີ້ມີຢູ່ຝັ່ງອະນຸມັດແລ້ວ (/approvals/cancellations/<code>) ແຕ່ນັ້ນເປີດໄດ້ແຕ່
 * ຜູ້ຈັດການ/ຫົວໜ້າຊ່າງ ແລະ ມີສ່ວນ "ອະນຸມັດ/ບໍ່ອະນຸມັດ" ປົນຢູ່ ⇒ ຄົນສາງທີ່ຕ້ອງໄປເອົາຂອງຄືນ
 * ເຂົ້າບໍ່ໄດ້. ບ່ອນນີ້ເອົາສະເພາະສ່ວນທີ່ສາງໃຊ້: ລາຍການອາໄຫຼ່ + ປຸ່ມຂໍສົ່ງຄືນ.
 *
 * ບໍ່ຍ້າຍສະຕັອກເອງ — ປຸ່ມພາໄປຂັ້ນຕອນເກົ່າ (ໃບຂໍສົ່ງຄືນ 59 → ສາງຮັບເຂົ້າ 58).
 */
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ code: string }> };

type Head = {
  code: string;
  customer: string | null;
  product: string | null;
  model: string | null;
  sn: string | null;
  brand: string | null;
  technician: string | null;
  issue: string | null;
  cancel_finish: string | null;
  request_cancel: string | null;
  return_complete: string | null;
  status: number | null;
};

export default async function SpareRecoveryDetail({ params }: Props) {
  const { code } = await params;
  const t = (await getDictionary(await getLocale())).spareRecoveryDetail;

  const head = (
    await query<Head>(
      `select a.code, concat_ws('-', b.name_1, b.tel) customer, a.name_1 product, a.p_model model, a.sn,
          a.p_brand brand, a.emp_code technician, a.issue, a.request_cancel, a.status,
          to_char(a.cancel_finish,'DD-MM-YYYY HH24:MI') cancel_finish,
          to_char(a.return_complete,'DD-MM-YYYY HH24:MI') return_complete
        from tb_product a
        left join ar_customer b on b.code = a.cust_code
       where a.code = $1`,
      [code],
    )
  ).rows[0];
  if (!head) notFound();

  const docs = groupByDoc(await getOutstandingSpares(head.code));

  return (
    <div className="w-full max-w-4xl space-y-5">
      <PageTitle sub={t.subtitle}>
        {t.title} {head.code}
      </PageTitle>

      <Card title={t.cardTitle}>
        <dl className="grid gap-2.5 text-xs sm:grid-cols-2">
          <div className="flex gap-2">
            <dt className="shrink-0 text-slate-500">{t.labelCustomer}:</dt>
            <dd className="text-slate-800">{head.customer || "-"}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="shrink-0 text-slate-500">{t.labelDevice}:</dt>
            <dd className="text-slate-800">
              {head.product || "-"} {head.model} · <span className="font-bold text-[#790404]">{head.sn || "-"}</span>
            </dd>
          </div>
          <div className="flex gap-2">
            <dt className="shrink-0 text-slate-500">{t.labelTechnician}:</dt>
            <dd className="font-medium text-slate-800">{head.technician || "-"}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="shrink-0 text-slate-500">{t.labelRequestCancel}:</dt>
            <dd className="text-slate-800">{head.request_cancel || "-"}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="shrink-0 text-slate-500">{t.labelApproveCancel}:</dt>
            <dd className="text-slate-800">{head.cancel_finish || t.notApproved}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="shrink-0 text-slate-500">{t.labelReturnToCustomer}:</dt>
            <dd className="text-slate-800">{head.return_complete || t.notReturned}</dd>
          </div>
        </dl>
        <p className="mt-3 text-[11px] text-slate-400">
          {t.viewFullReceipt}{" "}
          <Link href={`/service/${head.code}`} className="font-semibold text-[#0536a9] hover:underline">
            /service/{head.code}
          </Link>
        </p>
      </Card>

      {docs.length > 0 ? (
        <OutstandingSpares code={head.code} docs={docs} />
      ) : (
        <div className="flex items-center gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
          <PackageCheck className="size-5 shrink-0 text-emerald-600" />
          <p className="text-xs font-semibold text-emerald-800">{t.allRecovered}</p>
        </div>
      )}
    </div>
  );
}
