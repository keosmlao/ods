import { CancelJobButton, DeleteJobButton } from "@/components/installation/job-buttons";
import { LinkPending } from "@/components/link-pending";
import { LinkButton } from "@/components/ui";
import { getSession } from "@/lib/auth";
import { query } from "@/lib/db";
import { INSTALL_CANCELLED, INSTALL_CLOSED, INSTALL_OPEN, INSTALL_STAGE_TIME_COL } from "@/lib/install-stage";
import { Ban, Bell, CheckCircle2, FilePlus2, History, ListChecks, Loader, Pencil, Printer } from "lucide-react";
import Link from "next/link";
import {
  INSTALL_PLAIN_COLUMNS,
  INSTALL_SEARCH,
  INSTALL_SORTABLE_COLUMNS,
  InstallCells,
  InstallTableHead,
  ListHeader,
  PAGE_SIZE,
  Pager,
  TableShell,
  TabsAndSearch,
  fetchInstallRows,
  installOrderBy,
  readParams,
  type ListSearchParams,
  type TabItem,
} from "./shared";

/**
 * ຖອດແບບຈາກ ods: /Home_install + /api/install_list (install_admin.py) — ອອກແບບໃໝ່.
 * ຂັ້ນຂອງງານມາຈາກ @/lib/install-stage (ບ່ອນດຽວຂອງທັງລະບົບ).
 */
export const dynamic = "force-dynamic";

type Tab = "open" | "done" | "closed" | "cancelled";
type Props = { searchParams: Promise<ListSearchParams> };

/** ຖັງງານ — ລວມກັນແລ້ວໄດ້ທຸກແຖວຂອງ ods_tb_install ພໍດີ (ຍົກເວັ້ນ done ທີ່ຢູ່ໃນ open ນຳ) */
const BUCKET: Record<Tab, string> = {
  open: INSTALL_OPEN,
  done: `${INSTALL_OPEN} and a.finish_install is not null`,
  closed: INSTALL_CLOSED,
  cancelled: INSTALL_CANCELLED,
};

async function getCounts(tech: string | null) {
  const params = tech ? [tech] : [];
  const mine = tech ? "and a.tech_code = $1" : "";
  const sql = `select
      count(*) filter (where ${BUCKET.open})::int open,
      count(*) filter (where ${BUCKET.done})::int done,
      count(*) filter (where ${BUCKET.closed})::int closed,
      count(*) filter (where ${BUCKET.cancelled})::int cancelled,
      count(*) filter (where ${INSTALL_OPEN} and (a.tech_code is null or a.tech_code = '')
        and a.start_install is null)::int unassigned
    from ods_tb_install a where true ${mine}`;
  const row = (
    await query<{ open: number; done: number; closed: number; cancelled: number; unassigned: number }>(sql, params)
  ).rows[0];
  return {
    open: row?.open ?? 0,
    done: row?.done ?? 0,
    closed: row?.closed ?? 0,
    cancelled: row?.cancelled ?? 0,
    unassigned: row?.unassigned ?? 0,
  };
}

export default async function InstallationsPage({ searchParams }: Props) {
  const session = await getSession();
  // ຊ່າງເຫັນສະເພາະງານຂອງຕົນ (ຄືກັບ ods /api/install_list)
  const tech = session?.role === "technical" ? session.username : null;

  const raw = await searchParams;
  const tab: Tab =
    raw.tab === "done" || raw.tab === "closed" || raw.tab === "cancelled" ? raw.tab : "open";
  const { q, page, sort, dir } = readParams(raw);

  const where = [BUCKET[tab]];
  const params: (string | number)[] = [];
  if (tech) {
    params.push(tech);
    where.push(`a.tech_code = $${params.length}`);
  }
  if (q) {
    params.push(`%${q}%`);
    where.push(INSTALL_SEARCH.replaceAll("$Q", `$${params.length}`));
  }

  const [counts, jobs] = await Promise.all([
    getCounts(tech),
    fetchInstallRows({
      where: where.join(" and "),
      params,
      orderBy: installOrderBy(sort, dir, INSTALL_STAGE_TIME_COL),
      page,
    }),
  ]);

  const pages = Math.max(1, Math.ceil(jobs.total / PAGE_SIZE));
  const base = () => ({ ...(tab !== "open" && { tab }), ...(q && { q }) });
  const tabHref = (target: Tab) =>
    `/installations?${new URLSearchParams({ ...(target !== "open" && { tab: target }), ...(q && { q }) })}`;
  const sortHref = (key: string, nextDir: "asc" | "desc") =>
    `/installations?${new URLSearchParams({ ...base(), sort: key, dir: nextDir })}`;
  const pageHref = (n: number) =>
    `/installations?${new URLSearchParams({ ...base(), sort, dir, ...(n > 1 && { page: String(n) }) })}`;

  const TABS: TabItem<Tab>[] = [
    { key: "open", label: "ດຳເນີນຢູ່", icon: Loader, count: counts.open },
    { key: "done", label: "ຕິດຕັ້ງສຳເລັດ", icon: CheckCircle2, count: counts.done },
    { key: "closed", label: "ປິດງານເເລ້ວ", icon: ListChecks, count: counts.closed },
    { key: "cancelled", label: "ຍົກເລີກແລ້ວ", icon: Ban, count: counts.cancelled },
  ];

  return (
    <div className="w-full space-y-4">
      <ListHeader
        title="ຕິດຕັ້ງເຄື່ອງ"
        scope={tech ? "ສະແດງສະເພາະງານຂອງທ່ານ" : "ສະແດງທຸກງານ"}
        total={jobs.total}
        page={page}
        pages={pages}
      >
        <Link
          href="/installations/all"
          className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50"
        >
          <History className="size-4" />
          ງານທັງໝົດ
          <LinkPending className="size-3.5" />
        </Link>
      </ListHeader>

      {/* ເມນູຍ່ອຍຂອງໂມດູນຕິດຕັ້ງ */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-4">
        <LinkButton href="/installations/new" tone="success" className="h-9 text-xs">
          <FilePlus2 className="size-4" />
          ເປີດງານຕິດຕັ້ງ
        </LinkButton>
        <LinkButton href="/installations/assign" tone="neutral" className="h-9 border-2 border-[#E74033] text-xs">
          ຈັດງານຊ່າງຕິດຕັ້ງ
          <Bell className="size-4" />
          <span className="grid min-w-5 place-items-center rounded-full bg-red-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
            {counts.unassigned}
          </span>
        </LinkButton>
        <LinkButton href="/installations/accept" tone="neutral" className="h-9 text-xs">ຮັບງານຕິດຕັ້ງ</LinkButton>
        <LinkButton href="/installations/spare-requests" tone="neutral" className="h-9 text-xs">ໃບຂໍເບີກຕິດຕັ້ງ</LinkButton>
        <LinkButton href="/installations/dispatch" tone="neutral" className="h-9 text-xs">ສາງເບີກອາໄຫຼ່</LinkButton>
        <LinkButton href="/installations/spare-pickup" tone="neutral" className="h-9 text-xs">ຮັບອາໄຫຼ່</LinkButton>
        <LinkButton href="/installations/work" tone="neutral" className="h-9 text-xs">ຕິດຕັ້ງ</LinkButton>
        <LinkButton href="/installations/close" tone="neutral" className="h-9 text-xs">ປິດງານ</LinkButton>
      </div>

      <TabsAndSearch
        tabs={TABS}
        current={tab}
        tabHref={tabHref}
        q={q}
        sort={sort}
        dir={dir}
        hidden={tab !== "open" ? { tab } : {}}
      />

      <TableShell total={jobs.total} minWidth={1250}>
        <InstallTableHead
          columns={INSTALL_SORTABLE_COLUMNS}
          plain={INSTALL_PLAIN_COLUMNS}
          sort={sort}
          dir={dir}
          sortHref={sortHref}
        />
        <tbody>
          {jobs.rows.map((row) => {
            const cancelled = Boolean(row.cancel_date);
            return (
              <tr
                key={row.code}
                className={cancelled ? "border-b border-slate-100 bg-[#fce8e6]" : "border-b border-slate-100 hover:bg-slate-50"}
              >
                <InstallCells row={row} />
                <td className="whitespace-nowrap px-3 py-2.5">
                  {cancelled ? (
                    <span className="text-[10px] text-slate-500" title={row.cancel_remark ?? ""}>
                      {row.cancel_code ?? "-"}
                    </span>
                  ) : (
                    <div className="flex items-center justify-center gap-2">
                      <Link
                        href={`/installations/${encodeURIComponent(row.code)}/print`}
                        target="_blank"
                        title="ພິມ"
                        className="text-[#D35400] hover:opacity-70"
                      >
                        <Printer className="size-4" />
                      </Link>
                      {row.stage !== 8 && (
                        <>
                          <Link
                            href={`/installations/${encodeURIComponent(row.code)}/edit`}
                            title="ແກ້ໄຂ"
                            className="text-teal-600 hover:opacity-70"
                          >
                            <Pencil className="size-4" />
                          </Link>
                          <CancelJobButton code={row.code} />
                          <DeleteJobButton code={row.code} />
                        </>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </TableShell>

      <Pager page={page} pages={pages} total={jobs.total} pageHref={pageHref} />
    </div>
  );
}
