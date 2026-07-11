import { Chatter } from "@/components/chatter/chatter";
import { CheckForm, type BasketLine, type CheckHead } from "@/components/checking/check-form";
import { getSession } from "@/lib/auth";
import { query } from "@/lib/db";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

/** ຖອດແບບຈາກ ods: check.py pro_ch_detail() + templates/checking/checking_page.html */

type Props = { params: Promise<{ code: string }> };

export default async function CheckingDetail({ params }: Props) {
  const { code } = await params;
  const session = await getSession();
  if (!session) redirect("/login");

  const head = (
    await query<CheckHead>(
      `select a.code, to_char(a.time_register,'DD-MM-YYYY HH24:MI:SS') registered,
          concat_ws('-', b.name_1, b.tel) customer, concat_ws('-', a.name_1, a.sn) product,
          a.warrunty warranty, a.issue, a.user_regis receiver, a.emp_code technician,
          to_char(a.time_check,'DD-MM-YYYY HH24:MI') check_started,
          greatest(0, round(extract(epoch from (localtimestamp - a.time_check))))::int check_seconds,
          a.service_type
        from tb_product a
        left join ar_customer b on b.code=a.cust_code
        where a.code=$1 limit 1`,
      [code],
    )
  ).rows[0];
  if (!head) notFound();

  // ກະຕ່າອາໄຫຼ່ຂອງຜູ້ໃຊ້ຄົນນີ້ ສຳລັບເຄື່ອງໜ່ວຍນີ້
  const lines = (
    await query<BasketLine>(
      `select row_number() over (order by roworder)::int rnum, roworder, item_code, item_name,
          qty::text qty, unit_code
        from ic_trans_detail_draft
        where user_created=$1 and product_code=$2
        order by roworder`,
      [session.username, code],
    )
  ).rows;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5">
      <div>
        <Link href="/checking" className="mb-3 inline-flex items-center gap-2 text-sm font-medium text-teal-600">
          <ArrowLeft className="size-4" />
          ກັບລາຍການ
        </Link>
        <h1 className="text-2xl font-bold text-slate-700">ກວດເຊັກ #{head.code}</h1>
      </div>
      <CheckForm head={head} lines={lines} />
      <Chatter model="tb_product" resId={head.code} />
    </div>
  );
}
