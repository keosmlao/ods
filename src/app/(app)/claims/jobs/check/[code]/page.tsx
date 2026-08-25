import { getDictionary } from "@/lib/i18n/dictionaries";
import { getLocale } from "@/lib/i18n/locale";
import { Chatter } from "@/components/chatter/chatter";
import { CheckForm, type BasketLine, type CheckHead } from "@/components/checking/check-form";
import { LinkPending } from "@/components/link-pending";
import { getSession } from "@/lib/auth";
import { query } from "@/lib/db";
import { canUser } from "@/lib/permissions";
import { canViewAssignedJob } from "@/lib/scope";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

/**
 * **ບັນທຶກຜົນກວດ ຂອງງານເຄມ** — route ຂອງເຄມເອງ (ບໍ່ໄປ /checking/<code> ຂອງສ້ອມ).
 *
 * ຟອມ (CheckForm) ໃຊ້ຮ່ວມກັນ: ຊ່າງບັນທຶກ **ອາການ · ວິທີແກ້ · ອາໄຫຼ່ທີ່ຕ້ອງໃຊ້**
 * ຄືກັນທຸກປະການ. ສິ່ງທີ່ຕ່າງຄື **ບໍລິບົດ**: ຫົວຂໍ້ບອກວ່ານີ້ຄືເຄມ ແລະ ກັບຄືນໄປຄິວເຄມ
 * (ບໍ່ແມ່ນຄິວສ້ອມ) ⇒ ຄົນເຮັດວຽກບໍ່ຫຼົງອອກໄປອີກສາຍງານ.
 * ບັນທຶກແລ້ວໃບເຄມເລື່ອນເປັນ "ກວດ/ຕັດສິນ" ອັດຕະໂນມັດ (actions/checking).
 */
export const dynamic = "force-dynamic";

export default async function ClaimCheckPage({ params }: { params: Promise<{ code: string }> }) {
  const t = (await getDictionary(await getLocale())).claimJobs;
  const { code } = await params;
  const session = await getSession();
  if (!session) redirect("/login");

  const head = (
    await query<CheckHead & { claim_scope: string | null; claim_part_name: string | null }>(
      `select a.code, to_char(a.time_register,'DD-MM-YYYY HH24:MI:SS') registered,
          concat_ws('-', b.name_1, b.tel) customer, concat_ws('-', a.name_1, a.sn) product,
          a.warrunty warranty, a.warranty_reason, a.issue, a.user_regis receiver, a.emp_code technician,
          to_char(a.time_check,'DD-MM-YYYY HH24:MI') check_started,
          greatest(0, round(extract(epoch from (localtimestamp - a.time_check))))::int check_seconds,
          a.service_type, (a.time_finish_check is not null) check_saved,
          a.claim_scope, a.claim_part_name
        from tb_product a
        left join ar_customer b on b.code=a.cust_code
        where a.code=$1 and coalesce(a.job_kind,'repair')='claim' limit 1`,
      [code],
    )
  ).rows[0];
  if (!head) notFound();
  if (!canViewAssignedJob(session, head.technician)) redirect("/forbidden");

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
        <Link href="/claims/jobs/claim-checking" className="mb-3 inline-flex items-center gap-2 text-sm font-medium text-brand-orange-600">
          <ArrowLeft className="size-4" />
          {t.backQueue}
          <LinkPending className="size-3" />
        </Link>
        <h1 className="text-2xl font-bold text-slate-700">{t.checkTitle.replace("{code}", "")}{head.code}</h1>
        {/* ຂອບເຂດເຄມ — ຊ່າງຕ້ອງຮູ້ວ່າກຳລັງກວດ "ທັງເຄື່ອງ" ຫຼື "ສະເພາະອາໄຫຼ່ໃດ" */}
        <p className="mt-1 text-xs text-slate-500">
          {head.claim_scope === "part"
            ? `{t.scopePartWith.replace("{name}", "")}${head.claim_part_name || "-"}`
            : "{t.scopeWholeFull}"}
          {" · "}ບັນທຶກແລ້ວໃບເຄມຈະເລື່ອນເປັນ “ກວດ/ຕັດສິນ” ໃຫ້ອັດຕະໂນມັດ
        </p>
      </div>
      <CheckForm head={head} lines={lines} canUndo={await canUser(session, "/checking/undo", "update")} />
      <Chatter model="tb_product" resId={head.code} />
    </div>
  );
}
