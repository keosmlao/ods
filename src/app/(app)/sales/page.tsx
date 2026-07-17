import { PageTitle } from "@/components/ui";
import { getSession } from "@/lib/auth";
import { query } from "@/lib/db";
import { OPEN_JOBS } from "@/lib/stage";
import { ClipboardList, Send } from "lucide-react";
import { redirect } from "next/navigation";
import Link from "next/link";

/**
 * ໜ້າຫຼັກຂອງພະນັກງານຂາຍ — ແຈ້ງສ້ອມ · ຕິດຕາມງານ.
 */
export const dynamic = "force-dynamic";

export default async function SalesHomePage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const open =
    (
      await query<{ n: number }>(
        `select count(*)::int n from tb_product a join ar_customer b on b.code = a.cust_code
          where ${OPEN_JOBS}`,
      )
    ).rows[0]?.n ?? 0;

  return (
    <div className="mx-auto w-full max-w-3xl space-y-5">
      <PageTitle sub="ແຈ້ງສ້ອມແທນລູກຄ້າ ແລະ ຕິດຕາມງານສ້ອມ">ພະນັກງານຂາຍ</PageTitle>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <ClipboardList className="mt-0.5 size-5 text-teal-600" />
          <div>
            <p className="text-sm font-semibold text-slate-700">ງານກຳລັງດຳເນີນ</p>
            <p className="mt-1 text-xs text-slate-400">ທັງໝົດ: <b className="text-slate-600">{open}</b> ລາຍການ</p>
          </div>
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          href="/sales/report-repair"
          className="group rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-emerald-300 hover:shadow"
        >
          <Send className="size-6 text-emerald-600" />
          <h2 className="mt-2 font-bold text-slate-700 group-hover:text-emerald-700">ແຈ້ງສ້ອມ</h2>
          <p className="mt-0.5 text-sm text-slate-500">ແຈ້ງເຄື່ອງເສຍແທນລູກຄ້າ — ທີມບໍລິການຮັບເຂົ້າສ້ອມໃຫ້</p>
        </Link>
        <Link
          href="/sales/jobs"
          className="group rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-teal-300 hover:shadow"
        >
          <ClipboardList className="size-6 text-teal-600" />
          <h2 className="mt-2 font-bold text-slate-700 group-hover:text-teal-700">ຕິດຕາມງານສ້ອມ</h2>
          <p className="mt-0.5 text-sm text-slate-500">ເບິ່ງສະຖານະງານສ້ອມຂອງລູກຄ້າໃນເຂດຂອງທ່ານ</p>
        </Link>
      </div>
    </div>
  );
}
