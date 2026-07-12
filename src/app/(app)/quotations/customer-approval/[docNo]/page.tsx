import { CustomerApproveActions, UndoCustomerButton } from "@/components/quotation/approve-actions";
import { QuoteDetail, type DetailHead, type DetailLine, type DetailTotals } from "@/components/quotation/quote-detail";
import { query } from "@/lib/db";
import Link from "next/link";
import { notFound } from "next/navigation";

/** ຖອດແບບຈາກ ods: qt.py cust_qtdetail() + templates/approve/qt/cust_qtdetail.html */

type Props = { params: Promise<{ docNo: string }> };

type Head = DetailHead &
  DetailTotals & {
    aprove_status: number;
    aprove_status_2: number;
    remark_2: string | null;
    /** ເຫດຜົນທີ່ບັນທຶກຕອນລູກຄ້າປະຕິເສດ (tb_product.remark) */
    cancel_reason: string | null;
  };

export default async function CustomerApprovalDetailPage({ params }: Props) {
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
          a.remark_2, c.remark cancel_reason
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

  const answered = head.aprove_status_2 !== 0;
  const pendingInternal = head.aprove_status !== 1;

  const banner = answered ? (
    <div
      className={`rounded-xl border p-4 text-sm ${
        head.aprove_status_2 === 2 ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-800"
      }`}
    >
      <p className="font-semibold">
        {head.aprove_status_2 === 1 ? "ລູກຄ້າຕົກລົງແລ້ວ" : "ລູກຄ້າບໍ່ຕົກລົງ"}
      </p>
      {head.aprove_status_2 === 2 && head.cancel_reason?.trim() && (
        <p className="mt-1">ເຫດຜົນ: {head.cancel_reason}</p>
      )}
      <p className="mt-1 text-xs">ກົດຜິດບໍ? ກົດ “ຖອນຄຳຕອບ” — ຖອນໄດ້ຕາບໃດທີ່ຍັງບໍ່ໄດ້ອອກໃບຮັບເງິນ</p>
    </div>
  ) : pendingInternal ? (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
      <p className="font-semibold">ໃບນີ້ຍັງບໍ່ໄດ້ຮັບອະນຸມັດພາຍໃນ</p>
      <p className="mt-1 text-xs">ບັນທຶກຄຳຕອບຂອງລູກຄ້າບໍ່ໄດ້ຈົນກວ່າຜູ້ອະນຸມັດຈະອະນຸມັດໃບນີ້ກ່ອນ</p>
    </div>
  ) : undefined;

  return (
    <QuoteDetail
      head={head}
      lines={lineResult.rows}
      totals={head}
      showApprover
      banner={banner}
      actions={
        answered || pendingInternal ? (
          <div className="flex flex-wrap items-center gap-2">
            {answered && <UndoCustomerButton docNo={head.doc_no} size="md" />}
            <Link
              href="/quotations/customer-approval"
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              ອອກ
            </Link>
          </div>
        ) : (
          <CustomerApproveActions docNo={head.doc_no} productCode={head.product_code ?? ""} />
        )
      }
    />
  );
}
