import { LinkPending } from "@/components/link-pending";
import { PageTitle } from "@/components/ui";
import { claimStatuses, pipelineOf } from "@/lib/dashboard-status";
import { query } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { CLAIM_SIDE, roleOf } from "@/lib/roles";
import { ArrowRight, FilePlus2, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

/**
 * **ຄິວງານເຄມ** — ໜ້າລວມຂອງເຄມເອງ (ບໍ່ຜູກກັບຄິວສ້ອມອີກ 31-07-2026).
 *
 * ແຕ່ກ່ອນຄິວເຄມຢູ່ /work/repair/<slug> ຮ່ວມກັບຂັ້ນສ້ອມ 12 ຂັ້ນ
 * ⇒ ຄົນເຄມຕ້ອງເຂົ້າ "ໂລກຂອງສ້ອມ" ຈຶ່ງເຮັດວຽກໄດ້. ດຽວນີ້ເຂົ້າ /claims/jobs ບ່ອນດຽວ.
 * ນິຍາມຂັ້ນຍັງມາຈາກ lib/dashboard-status.claimStatuses ບ່ອນດຽວ (ຕົວເລກບໍ່ຫຼົ້ນກັນ).
 */
export const dynamic = "force-dynamic";

export default async function ClaimJobsIndex() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!CLAIM_SIDE.includes(roleOf(session))) redirect("/forbidden");

  const stages = pipelineOf(claimStatuses);
  const counts = (
    await query<Record<string, number>>(
      `select ${stages
        .map(([slug, def]) => `(select count(*) from tb_product a where ${def.condition})::int as "${slug}"`)
        .join(", ")}`,
    )
  ).rows[0];
  const total = stages.reduce((sum, [slug]) => sum + Number(counts?.[slug] ?? 0), 0);

  return (
    <div className="w-full space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <PageTitle sub={`ງານເຄມທີ່ດຳເນີນຢູ່ ${total} ໃບ — ຮັບຈາກຮ້ານ → ກວດ → ຕັດສິນ → ຄືນຮ້ານ`}>
          ຄິວງານເຄມ
        </PageTitle>
        <Link
          href="/claims/new"
          className="inline-flex h-10 items-center gap-2 rounded-lg bg-violet-600 px-4 text-sm font-semibold text-white hover:bg-violet-700"
        >
          <FilePlus2 className="size-4" />
          ຮັບເຄື່ອງເຄມ
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {stages.map(([slug, def], index) => {
          const count = Number(counts?.[slug] ?? 0);
          return (
            <Link
              key={slug}
              href={`/claims/jobs/${slug}`}
              className={`rounded-xl border p-4 shadow-sm transition hover:shadow ${
                count > 0 ? "border-violet-200 bg-white" : "border-slate-200 bg-slate-50/60"
              }`}
            >
              <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-400">
                <ShieldCheck className="size-3.5" />
                ຂັ້ນ {index + 1}
              </p>
              <p className="mt-1 text-sm font-bold text-slate-700">{def.label}</p>
              <p className={`mt-2 text-2xl font-black tabular-nums ${count > 0 ? "text-violet-700" : "text-slate-300"}`}>
                {count}
              </p>
              <span className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-violet-600">
                ເປີດເບິ່ງ <ArrowRight className="size-3" />
                <LinkPending className="size-3" />
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
