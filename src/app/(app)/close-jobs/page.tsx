import { closeJob } from "@/app/actions/installation";
import { closeRepairJob } from "@/app/actions/repair";
import { JobButton } from "@/components/installation/job-buttons";
import { LinkPending } from "@/components/link-pending";
import { RowLink } from "@/components/row-link";
import { query } from "@/lib/db";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getLocale } from "@/lib/i18n/locale";
import { installStageIs } from "@/lib/install-stage";
import { ChevronLeft, ChevronRight, HardHat, Printer, Search, Wrench } from "lucide-react";
import Link from "next/link";

/**
 * **ປິດງານ — ສ້ອມ ແລະ ຕິດຕັ້ງ ຢູ່ໜ້າດຽວ.**
 *
 * ── ເປັນຫຍັງລວມສອງສາຍງານ ──
 * ການປິດງານເປັນວຽກ **ຫຼັງບ້ານຂອງ CS** ອັນດຽວກັນທັງສອງສາຍ (ກວດເອກະສານຄົບ → ປິດ)
 * ແຕ່ແຕ່ກ່ອນຢູ່ຄົນລະບ່ອນ ແລະ ຝັ່ງສ້ອມ**ບໍ່ມີເລີຍ** (ຈົບຢູ່ "ສົ່ງຄືນສຳເລັດ" ແລ້ວປະໄວ້).
 *
 *   ສ້ອມ    → ຂັ້ນ 12 "ສົ່ງຄືນສຳເລັດ" ທີ່ຍັງບໍ່ໄດ້ປິດ (`tb_product.job_close` ຫວ່າງ)
 *   ຕິດຕັ້ງ → ຂັ້ນ 8 "ລໍຖ້າປິດງານ" (ຄິວດຽວກັບ /installations/close — actions closeJob)
 *
 * ໜ້າລະ 10 ແຖວ ⇒ ຄິວສ້ອມມີ 5,000+ ໃບຄ້າງແຕ່ໜ້າຍັງເບົາ (ນັບ + ດຶງສະເພາະໜ້າທີ່ເປີດ).
 */
export const dynamic = "force-dynamic";

const PAGE_SIZE = 10;

type Tab = "repair" | "install";
type Props = { searchParams: Promise<{ tab?: string; q?: string; page?: string }> };

type Row = {
  code: string;
  customer: string | null;
  product: string | null;
  model: string | null;
  sn: string | null;
  tech: string | null;
  done_at: string | null;
};

/** ຂັ້ນ 12 ຝັ່ງສ້ອມ = ສົ່ງຄືນແລ້ວ ແລະ ບໍ່ຖືກຍົກເລີກ (ລຳດັບ case ຂອງ STAGE_SQL ຮັບປະກັນ) */
const REPAIR_WHERE = "a.return_complete is not null and a.job_close is null and coalesce(a.status,0) <> 6";
const REPAIR_SEARCH = `(a.code ilike $Q or a.sn ilike $Q or a.name_1 ilike $Q or a.p_model ilike $Q
  or c.name_1 ilike $Q or a.emp_code ilike $Q)`;
const INSTALL_SEARCH = `(a.code ilike $Q or a.pro_sn ilike $Q or a.item_name ilike $Q or a.pro_model ilike $Q
  or c.name_1 ilike $Q or a.tech_code ilike $Q)`;

async function fetchRows(tab: Tab, q: string, page: number) {
  const params: (string | number)[] = [];
  const where = [tab === "repair" ? REPAIR_WHERE : installStageIs(8)];
  if (q) {
    params.push(`%${q}%`);
    where.push((tab === "repair" ? REPAIR_SEARCH : INSTALL_SEARCH).replaceAll("$Q", `$${params.length}`));
  }
  const filter = where.join(" and ");

  const from =
    tab === "repair"
      ? "from tb_product a left join ar_customer c on c.code = a.cust_code"
      : "from ods_tb_install a left join ar_customer c on c.code = a.cust_code";
  const columns =
    tab === "repair"
      ? `a.code, concat_ws('-', c.name_1, c.tel) customer, a.name_1 product, a.p_model model, a.sn,
         a.emp_code tech, to_char(a.return_complete,'DD-MM-YYYY HH24:MI') done_at`
      : `a.code, concat_ws('-', c.name_1, c.tel) customer, a.item_name product, a.pro_model model, a.pro_sn sn,
         a.tech_code tech, to_char(coalesce(a.complain_finish, a.qc_finish),'DD-MM-YYYY HH24:MI') done_at`;
  const orderBy = tab === "repair" ? "a.return_complete desc" : "coalesce(a.complain_finish, a.qc_finish) desc";

  const [rows, count] = await Promise.all([
    query<Row>(
      `select ${columns} ${from} where ${filter} order by ${orderBy} limit $${params.length + 1} offset $${params.length + 2}`,
      [...params, PAGE_SIZE, (page - 1) * PAGE_SIZE],
    ),
    query<{ total: number }>(`select count(*)::int total ${from} where ${filter}`, params),
  ]);
  return { rows: rows.rows, total: count.rows[0]?.total ?? 0 };
}

/** ຈຳນວນຂອງທັງສອງແທັບ — ໃຫ້ຄົນເຫັນວ່າອີກຝັ່ງມີງານຄ້າງຢູ່ບໍ ໂດຍບໍ່ຕ້ອງກົດເຂົ້າໄປ */
async function counts() {
  const [repair, install] = await Promise.all([
    query<{ total: number }>(
      `select count(*)::int total from tb_product a where ${REPAIR_WHERE}`,
    ),
    query<{ total: number }>(
      `select count(*)::int total from ods_tb_install a where ${installStageIs(8)}`,
    ),
  ]);
  return { repair: repair.rows[0]?.total ?? 0, install: install.rows[0]?.total ?? 0 };
}

export default async function CloseJobsPage({ searchParams }: Props) {
  const params = await searchParams;
  const tab: Tab = params.tab === "install" ? "install" : "repair";
  const q = (params.q ?? "").trim();
  const page = Math.max(1, Number(params.page) || 1);
  const t = (await getDictionary(await getLocale())).closeJobs;

  const [{ rows, total }, tabCounts] = await Promise.all([fetchRows(tab, q, page), counts()]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const href = (next: { tab?: Tab; q?: string; page?: number }) => {
    const value = { tab, q, page, ...next };
    return `/close-jobs?${new URLSearchParams({
      ...(value.tab !== "repair" && { tab: value.tab }),
      ...(value.q && { q: value.q }),
      ...(value.page > 1 && { page: String(value.page) }),
    })}`;
  };

  const TABS: { key: Tab; label: string; icon: typeof Wrench; count: number }[] = [
    { key: "repair", label: t.tabRepair, icon: Wrench, count: tabCounts.repair },
    { key: "install", label: t.tabInstall, icon: HardHat, count: tabCounts.install },
  ];

  return (
    <div className="w-full space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-700">{t.title}</h1>
        <p className="mt-0.5 text-xs text-slate-500">
          {total.toLocaleString()} {t.items} · {t.page} {page}/{pages} · {tab === "repair" ? t.hintRepair : t.hintInstall}
        </p>
      </div>

      {/* ແທັບ + ຄົ້ນຫາ */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm">
        <div className="flex overflow-hidden rounded-lg border border-slate-300">
          {TABS.map(({ key, label, icon: Icon, count }) => (
            <Link
              key={key}
              href={href({ tab: key, page: 1 })}
              className={`inline-flex h-9 items-center gap-1.5 border-l border-slate-300 px-3 text-xs font-medium first:border-l-0 ${
                tab === key ? "bg-brand-900 text-white" : "bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              <Icon className="size-3.5" />
              {label}
              <span
                className={`rounded px-1 text-[10px] font-bold ${tab === key ? "bg-white/20" : "bg-slate-100 text-slate-600"}`}
              >
                {count.toLocaleString()}
              </span>
              <LinkPending className="size-3" />
            </Link>
          ))}
        </div>

        <form className="flex flex-1 items-center gap-2">
          {tab !== "repair" && <input type="hidden" name="tab" value={tab} />}
          <div className="flex h-9 min-w-56 flex-1 items-center gap-2 rounded-lg border border-slate-300 px-2.5">
            <Search className="size-3.5 shrink-0 text-slate-400" />
            <input name="q" defaultValue={q} placeholder={t.searchPlaceholder} className="w-full text-xs outline-none" />
          </div>
          <button className="h-9 rounded-lg bg-brand-900 px-4 text-xs font-medium text-white">{t.search}</button>
          {q && (
            <Link href={href({ q: "", page: 1 })} className="text-xs text-slate-500 underline">
              {t.clear}
            </Link>
          )}
        </form>
      </div>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[1000px] border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-slate-600">
                <th className="whitespace-nowrap px-3 py-2.5 text-center font-semibold">{t.colAction}</th>
                <th className="whitespace-nowrap px-3 py-2.5 font-semibold">{t.colCode}</th>
                <th className="whitespace-nowrap px-3 py-2.5 font-semibold">
                  {tab === "repair" ? t.colReturnedAt : t.colFeedbackAt}
                </th>
                <th className="px-3 py-2.5 font-semibold">{t.colProduct}</th>
                <th className="px-3 py-2.5 font-semibold">{t.colCustomer}</th>
                <th className="whitespace-nowrap px-3 py-2.5 font-semibold">{t.colTech}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <RowLink
                  key={row.code}
                  href={
                    tab === "repair"
                      ? `/service/${encodeURIComponent(row.code)}`
                      : `/installations/${encodeURIComponent(row.code)}`
                  }
                  className="border-b border-slate-100 hover:bg-slate-50"
                >
                  <td className="whitespace-nowrap px-3 py-2.5">
                    <div className="flex items-center justify-center gap-2">
                      <PrintLink tab={tab} code={row.code} label={t.print} />
                      <CloseButton tab={tab} code={row.code} label={t.close} confirm={t.confirmClose} />
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 font-bold text-brand">{row.code}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-slate-500">{row.done_at ?? "-"}</td>
                  <td className="max-w-72 px-3 py-2.5">
                    <span className="block truncate font-medium text-slate-800" title={row.product ?? ""}>
                      {row.product || "-"}
                    </span>
                    <span className="block truncate text-[10px] text-slate-400">
                      {[row.model, row.sn].filter(Boolean).join(" · ") || "-"}
                    </span>
                  </td>
                  <td className="max-w-56 px-3 py-2.5">
                    <span className="block truncate" title={row.customer ?? ""}>
                      {row.customer || "-"}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5">{row.tech || "-"}</td>
                </RowLink>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-12 text-center text-slate-400">
                    {t.noResults}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* ມືຖື — ບັດແທນຕາຕະລາງ */}
        <div className="divide-y divide-slate-100 md:hidden">
          {rows.map((row) => (
            <div key={row.code} className="space-y-2 p-3">
              <div className="flex items-start justify-between gap-2">
                <Link
                  href={
                    tab === "repair"
                      ? `/service/${encodeURIComponent(row.code)}`
                      : `/installations/${encodeURIComponent(row.code)}`
                  }
                  className="font-bold text-brand"
                >
                  {row.code}
                </Link>
                <span className="text-[10px] text-slate-400">{row.done_at ?? "-"}</span>
              </div>
              <p className="text-xs font-medium text-slate-800">{row.product || "-"}</p>
              <p className="text-[10px] text-slate-400">
                {[row.model, row.sn, row.customer, row.tech].filter(Boolean).join(" · ") || "-"}
              </p>
              <div className="flex items-center gap-2">
                <PrintLink tab={tab} code={row.code} label={t.print} />
                <CloseButton tab={tab} code={row.code} label={t.close} confirm={t.confirmClose} />
              </div>
            </div>
          ))}
          {rows.length === 0 && <p className="p-8 text-center text-xs text-slate-400">{t.noResults}</p>}
        </div>
      </section>

      {pages > 1 && (
        <nav className="flex items-center justify-between gap-3 text-xs">
          <span className="text-slate-500">
            {t.showing} {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} {t.of}{" "}
            {total.toLocaleString()}
          </span>
          <div className="flex items-center gap-1">
            <Link
              href={href({ page: page - 1 })}
              aria-disabled={page === 1}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 hover:bg-slate-50 aria-disabled:pointer-events-none aria-disabled:opacity-40"
            >
              <ChevronLeft className="size-3.5" />
              {t.prev}
            </Link>
            <span className="px-3 font-medium text-slate-700">
              {page} / {pages}
            </span>
            <Link
              href={href({ page: page + 1 })}
              aria-disabled={page >= pages}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 hover:bg-slate-50 aria-disabled:pointer-events-none aria-disabled:opacity-40"
            >
              {t.next}
              <ChevronRight className="size-3.5" />
            </Link>
          </div>
        </nav>
      )}
    </div>
  );
}

/** ພິມໃບງານ — ສ້ອມ = ໃບຮັບເຄື່ອງ · ຕິດຕັ້ງ = ໃບຕິດຕັ້ງ (ເປີດແທັບໃໝ່ ບໍ່ໃຫ້ເສຍບ່ອນຢືນໃນຄິວ) */
function PrintLink({ tab, code, label }: { tab: Tab; code: string; label: string }) {
  const href =
    tab === "repair"
      ? `/service/${encodeURIComponent(code)}/print`
      : `/installations/${encodeURIComponent(code)}/print`;
  return (
    <Link
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
    >
      <Printer className="size-3.5" />
      {label}
    </Link>
  );
}

/** ປຸ່ມປິດງານ — ສອງສາຍງານໃຊ້ປຸ່ມດຽວກັນ ຕ່າງກັນແຕ່ action ທີ່ສົ່ງໃຫ້ */
function CloseButton({ tab, code, label, confirm }: { tab: Tab; code: string; label: string; confirm: string }) {
  return (
    <JobButton
      code={code}
      action={tab === "repair" ? closeRepairJob : closeJob}
      tone="success"
      confirmTitle={`${confirm} ${code}?`}
      className="h-8 px-3 text-xs"
    >
      {label}
    </JobButton>
  );
}
