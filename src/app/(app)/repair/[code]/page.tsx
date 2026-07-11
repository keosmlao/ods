import { Chatter } from "@/components/chatter/chatter";
import { LinkPending } from "@/components/link-pending";
import { RepairForm, type RepairHead, type SpareLine } from "@/components/repair/repair-form";
import { query } from "@/lib/db";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

/** ຖອດແບບຈາກ ods: repair.py show_repar() + templates/repair/repair_page.html (ອອກແບບໃໝ່) */

type Props = { params: Promise<{ code: string }> };

export default async function RepairDetail({ params }: Props) {
  const { code } = await params;

  const head = (
    await query<RepairHead>(
      `select a.code, a.roworder, to_char(a.time_finish_check,'DD-MM-YYYY HH24:MI') finished_check,
          concat_ws('-', b.name_1, b.tel) customer, concat_ws(' · ', a.name_1, a.sn) product, a.p_brand brand,
          a.warrunty warranty, a.issue, a.issue_2, a.emp_code technician, a.repair_note,
          to_char(a.time_repair,'DD-MM-YYYY HH24:MI') repair_started,
          greatest(0, round(extract(epoch from (localtimestamp - a.time_repair))))::int repair_seconds,
          (a.spare_reg is not null) spare_requested,
          (a.qt_start is not null and a.qt_finish is not null) quotation_done
        from tb_product a
        left join ar_customer b on b.code=a.cust_code
        where a.code=$1 limit 1`,
      [code],
    )
  ).rows[0];
  if (!head) notFound();

  /*
   * ສະຖານະຂອງອາໄຫຼ່ແຕ່ລະແຖວ — ອີງໃສ່ບັນຊີເອກະສານ (ic_trans_detail) ບໍ່ແມ່ນຖັນຂອງ tb_used_spare
   * ເພາະຖັນພວກນັ້ນເຊື່ອບໍ່ໄດ້ກັບຂໍ້ມູນເກົ່າ (ເບິ່ງໝາຍເຫດໃນ actions/stock.ts).
   *   requested = ຢູ່ໃນໃບຂໍເບີກ (122) ແລ້ວ
   *   issued    = ສາງເບີກອອກ (56) ແລ້ວ  ⇒ ຫ້າມຊ່າງລຶບ/ແກ້
   *   picked    = ຊ່າງຮັບຂອງແລ້ວ (pick_finish — stamp ຢູ່ໜ້າ /stock/requests/pickup)
   */
  const lines = (
    await query<SpareLine>(
      `select row_number() over (order by s.roworder)::int rnum, s.roworder, s.item_code, s.item_name,
          s.qty::text qty, s.unit_code, (s.pick_finish is not null) picked,
          exists(select 1 from ic_trans_detail d
                 where d.product_code=s.product_code and d.item_code=s.item_code and d.trans_flag=56) issued,
          exists(select 1 from ic_trans_detail d
                 where d.product_code=s.product_code and d.item_code=s.item_code and d.trans_flag=122) requested
        from tb_used_spare s where s.product_code=$1 order by s.roworder`,
      [code],
    )
  ).rows;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-4">
      <div>
        <Link href="/repair" className="mb-2 inline-flex items-center gap-1.5 text-xs font-medium text-teal-600">
          <ArrowLeft className="size-3.5" />
          ກັບລາຍການ
          <LinkPending className="size-3" />
        </Link>
        <h1 className="text-xl font-bold text-slate-700">ສ້ອມແປງ #{head.code}</h1>
      </div>
      <RepairForm head={head} lines={lines} />
      <Chatter model="tb_product" resId={head.code} />
    </div>
  );
}
