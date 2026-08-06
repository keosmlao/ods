import { LinkPending } from "@/components/link-pending";
import { claimCounts, CLAIM_PAGES } from "@/lib/claim";
import { claimStatuses, pipelineOf } from "@/lib/dashboard-status";
import { query } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { CLAIM_SIDE, roleOf } from "@/lib/roles";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getLocale } from "@/lib/i18n/locale";
import Link from "next/link";
import { redirect } from "next/navigation";

/**
 * **ຄິວງານເຄມ** — ໜ້າລວມຂອງເຄມເອງ (ບໍ່ຜູກກັບຄິວສ້ອມອີກ 31-07-2026).
 *
 * ແຕ່ກ່ອນຄິວເຄມຢູ່ /work/repair/<slug> ຮ່ວມກັບຂັ້ນສ້ອມ 12 ຂັ້ນ
 * ⇒ ຄົນເຄມຕ້ອງເຂົ້າ "ໂລກຂອງສ້ອມ" ຈຶ່ງເຮັດວຽກໄດ້. ດຽວນີ້ເຂົ້າ /claims/jobs ບ່ອນດຽວ.
 * ນິຍາມຂັ້ນຍັງມາຈາກ lib/dashboard-status.claimStatuses ບ່ອນດຽວ (ຕົວເລກບໍ່ຫຼົ້ນກັນ).
 *
 * ອອກແບບໃໝ່ 05-08-2026: ເພີ່ມ pill ໃບເຄມ 3 ປະເພດ (ພ້ອມຈຳນວນເປີດຢູ່) ເຊື່ອມ
 * "ຄິວງານ" ກັບ "ໃບເຄມ" ໃຫ້ໄປມາໄດ້, ບັດຂັ້ນສີສະອາດຂຶ້ນ.
 */
export const dynamic = "force-dynamic";

export default async function ClaimJobsIndex() {
  const t = (await getDictionary(await getLocale())).claimJobs;
  const session = await getSession();
  if (!session) redirect("/login");
  if (!CLAIM_SIDE.includes(roleOf(session))) redirect("/forbidden");

  const stages = pipelineOf(claimStatuses);
  const [counts, openByType] = await Promise.all([
    query<Record<string, number>>(
      `select ${stages
        .map(([slug, def]) => `(select count(*) from tb_product a where ${def.condition})::int as "${slug}"`)
        .join(", ")}`,
    ),
    Promise.all([claimCounts("B"), claimCounts("A"), claimCounts("C")]),
  ]);
  const total = stages.reduce((sum, [slug]) => sum + Number(counts.rows[0]?.[slug] ?? 0), 0);
  const row = counts.rows[0];
  /** ເປີດຢູ່ = ທັງໝົດ − ປິດແລ້ວ (closed/rejected/paid) — ກົດດຽວກັບໜ້າລາຍການເຄມ */
  const openOf = (c: Record<string, number>) => {
    const all = Object.values(c).reduce((a, b) => a + b, 0);
    return all - ((c.closed ?? 0) + (c.rejected ?? 0) + (c.paid ?? 0));
  };

  return (
    <div className="w-full space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-700">{t.queueTitle}</h1>
          <p className="mt-0.5 text-xs text-slate-500">
            {t.queueOpen} <b className="tabular-nums text-slate-700">{total}</b> {t.queueFlow}
          </p>
        </div>
        <Link
          href="/claims/new"
          className="inline-flex h-10 items-center gap-2 rounded-lg bg-brand-orange-600 px-4 text-sm font-semibold text-white hover:bg-brand-orange-700"
        >
          {t.receiveGoods}
        </Link>
      </div>

      {/* ── ໃບເຄມ 3 ປະເພດ (ເຊື່ອມໄປໜ້າລາຍການເຄມ) ── */}
      <div className="grid gap-3 sm:grid-cols-3">
        {CLAIM_PAGES.map((page, i) => {
          const open = openOf(openByType[i]);
          return (
            <Link
              key={page.type}
              href={page.path}
              className="group rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-brand-300 hover:shadow"
            >
              <p className="flex items-center gap-2 text-[11px] font-bold text-slate-400">
                <span className="rounded bg-brand-50 px-1.5 py-0.5 font-mono text-brand-800">CLM-{page.type}</span>
                {page.short}
              </p>
              <p className={`mt-2 text-2xl font-bold tabular-nums ${open > 0 ? "text-amber-700" : "text-slate-300"}`}>
                {open} <span className="text-sm font-semibold text-slate-400">{t.openDocs}</span>
              </p>
              <span className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-brand-700 group-hover:underline">
                {t.openClaimList} <ArrowRight className="size-3" />
              </span>
            </Link>
          );
        })}
      </div>

      {/* ── ຄິວຕາມຂັ້ນ ── */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {stages.map(([slug, def], index) => {
          const count = Number(row?.[slug] ?? 0);
          return (
            <Link
              key={slug}
              href={`/claims/jobs/${slug}`}
              className={`rounded-xl border p-4 shadow-sm transition hover:shadow ${
                count > 0 ? "border-brand-orange-200 bg-white" : "border-slate-200 bg-slate-50/60"
              }`}
            >
              <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-400">
                <ShieldCheck className="size-3.5" />
                {t.stage} {index + 1}
              </p>
              <p className="mt-1 text-sm font-bold text-slate-700">{def.label}</p>
              <p className={`mt-2 text-2xl font-black tabular-nums ${count > 0 ? "text-brand-orange-700" : "text-slate-300"}`}>
                {count}
              </p>
              <span className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-brand-orange-600">
                {t.open} <ArrowRight className="size-3" />
                <LinkPending className="size-3" />
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
