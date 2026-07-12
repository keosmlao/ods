import { QuoteApproveActions, UndoApprovalButton } from "@/components/quotation/approve-actions";
import { QuoteDetail, type DetailHead, type DetailLine, type DetailTotals } from "@/components/quotation/quote-detail";
import { query } from "@/lib/db";
import Link from "next/link";
import { notFound } from "next/navigation";

/** ຖອດແບບຈາກ ods: qt.py qt_forapprove_detail() + templates/approve/qt/detail.html */

type Props = { params: Promise<{ docNo: string }> };

type Head = DetailHead &
  DetailTotals & {
    aprove_status: number;
    aprove_status_2: number;
    remark_2: string | null;
  };

export default async function ApproveQuotationDetailPage({ params }: Props) {
  const { docNo } = await params;

  const [headResult, lineResult] = await Promise.all([
    query<Head>(
      `select a.doc_no, to_char(a.doc_date,'DD-MM-YYYY') doc_date, concat_ws('-', b.name_1, b.tel) customer,
          c.name_1 product, c.p_model model, c.sn, c.p_brand brand, c.issue, c.warrunty warranty, c.issue_2,
          c.user_regis, c.emp_code technician, a.user_created, a.approver1, e.product_url, c.code product_code,
          coalesce(a.total_value,0)::text total_value, coalesce(a.total_discount,0)::text total_discount,
          a.vat_rate::text, a.total_vat_value::text, coalesce(a.total_amount,0)::text total_amount,
          a.exchange_rate::text, a.total_amount_2::text,
          coalesce(a.aprove_status,0)::int aprove_status, coalesce(a.aprove_status_2,0)::int aprove_status_2,
          a.remark_2
        from ic_trans a
        left join ar_customer b on b.code = a.cust_code
        left join tb_product c on c.code = a.product_code
        left join product_image e on e.iteme_code = a.product_code and e.line_number = 0
        where a.doc_no = $1 and a.trans_flag = 17`,
      [docNo],
    ),
    query<DetailLine>(
      `select item_code, item_name, qty, unit_code, price, sum_amount
       from ic_trans_detail where doc_no=$1 and trans_flag=17 order by roworder`,
      [docNo],
    ),
  ]);

  const head = headResult.rows[0];
  if (!head) notFound();

  const decided = head.aprove_status !== 0;
  const customerAnswered = head.aprove_status_2 !== 0;
  // ຕັດສິນໄປແລ້ວ → ບໍ່ສະແດງປຸ່ມອະນຸມັດອີກ (ກົດແລ້ວ server ກໍ່ປະຕິເສດຢູ່ດີ = ທາງຕັນທີ່ໜ້າຈໍ)
  // ແທນດ້ວຍ "ຖອນຄືນ" ຕາບໃດທີ່ລູກຄ້າຍັງບໍ່ຕອບ
  const banner = decided ? (
    <div
      className={`rounded-xl border p-4 text-sm ${
        head.aprove_status === 2 ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-800"
      }`}
    >
      <p className="font-semibold">
        {head.aprove_status === 2 ? "ບໍ່ອະນຸມັດແລ້ວ" : "ອະນຸມັດພາຍໃນແລ້ວ"}
        {head.approver1 ? ` · ໂດຍ ${head.approver1}` : ""}
      </p>
      {head.remark_2?.trim() && <p className="mt-1">ໝາຍເຫດ: {head.remark_2}</p>}
      {customerAnswered && (
        <p className="mt-1 text-xs">
          ລູກຄ້າ{head.aprove_status_2 === 1 ? "ຕົກລົງ" : "ບໍ່ຕົກລົງ"}ແລ້ວ — ຖອນຄືນຢູ່ນີ້ບໍ່ໄດ້
          (ໃຫ້ຖອນຄຳຕອບຂອງລູກຄ້າກ່ອນ ທີ່ໜ້າ “ລູກຄ້າອະນຸມັດ” ແທັບ “ຕອບແລ້ວ”)
        </p>
      )}
    </div>
  ) : undefined;

  return (
    <QuoteDetail
      head={head}
      lines={lineResult.rows}
      totals={head}
      showApprover={decided}
      banner={banner}
      actions={
        decided ? (
          <div className="flex flex-wrap items-center gap-2">
            {!customerAnswered && <UndoApprovalButton docNo={head.doc_no} size="md" />}
            <Link
              href="/approvals/quotations"
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              ອອກ
            </Link>
          </div>
        ) : (
          <QuoteApproveActions docNo={head.doc_no} productCode={head.product_code ?? ""} />
        )
      }
    />
  );
}
