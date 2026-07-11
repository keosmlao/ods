import { LinkPending } from "@/components/link-pending";
import { getSession } from "@/lib/auth";
import { query } from "@/lib/db";
import { INSTALL_CANCELLED, INSTALL_CLOSED, INSTALL_OPEN, INSTALL_STAGE_TIME_COL } from "@/lib/install-stage";
import { Ban, ChevronLeft, FileBarChart, Layers, ListChecks, Loader, Printer } from "lucide-react";
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
} from "../shared";

/**
 * ຖອດແບບຈາກ ods: /Home_install_all (install_admin.py:559) — ງານຕິດຕັ້ງທັງໝົດ / ປະຫວັດ.
 *
 * ods ດຶງທຸກແຖວ (6,800+) ມາໃສ່ໜ້າດຽວ ແລະ ບໍ່ມີຕົວກອງ.
 * ບ່ອນນີ້ແບ່ງໜ້າຢູ່ຖານຂໍ້ມູນ + ຄົ້ນຫາ + ກອງຊ່ວງວັນທີເປີດງານ.
 */
export const dynamic = "force-dynamic";

type Tab = "all" | "open" | "closed" | "cancelled";
type Props = { searchParams: Promise<ListSearchParams & { from?: string; to?: string }> };

const BUCKET: Record<Tab, string> = {
  all: "true",
  open: INSTALL_OPEN,
  closed: INSTALL_CLOSED,
  cancelled: INSTALL_CANCELLED,
};

const ISO = /^\d{4}-\d{2}-\d{2}$/;

async function getCounts(tech: string | null, dateWhere: string, dateParams: string[]) {
  const params: (string | number)[] = [...dateParams];
  let mine = "";
  if (tech) {
    params.push(tech);
    mine = `and a.tech_code = $${params.length}`;
  }
  const sql = `select
      count(*)::int all_count,
      count(*) filter (where ${INSTALL_OPEN})::int open,
      count(*) filter (where ${INSTALL_CLOSED})::int closed,
      count(*) filter (where ${INSTALL_CANCELLED})::int cancelled
    from ods_tb_install a where true ${dateWhere} ${mine}`;
  const row = (await query<{ all_count: number; open: number; closed: number; cancelled: number }>(sql, params)).rows[0];
  return {
    all: row?.all_count ?? 0,
    open: row?.open ?? 0,
    closed: row?.closed ?? 0,
    cancelled: row?.cancelled ?? 0,
  };
}

export default async function AllInstallationsPage({ searchParams }: Props) {
  const session = await getSession();
  const tech = session?.role === "technical" ? session.username : null;

  const raw = await searchParams;
  const tab: Tab = raw.tab === "open" || raw.tab === "closed" || raw.tab === "cancelled" ? raw.tab : "all";
  const { q, page, sort, dir } = readParams(raw, "register");
  const from = ISO.test(raw.from ?? "") ? (raw.from as string) : "";
  const to = ISO.test(raw.to ?? "") ? (raw.to as string) : "";

  // ຕົວກອງຊ່ວງວັນທີເປີດງານ — ໃຊ້ຮ່ວມກັນທັງແຖວ ແລະ ຫົວແທັບ
  const dateParams: string[] = [];
  const dateParts: string[] = [];
  if (from) {
    dateParams.push(from);
    dateParts.push(`a.time_register::date >= $${dateParams.length}::date`);
  }
  if (to) {
    dateParams.push(to);
    dateParts.push(`a.time_register::date <= $${dateParams.length}::date`);
  }
  const dateWhere = dateParts.length ? `and ${dateParts.join(" and ")}` : "";

  const where = [BUCKET[tab], ...dateParts];
  const params: (string | number)[] = [...dateParams];
  if (tech) {
    params.push(tech);
    where.push(`a.tech_code = $${params.length}`);
  }
  if (q) {
    params.push(`%${q}%`);
    where.push(INSTALL_SEARCH.replaceAll("$Q", `$${params.length}`));
  }

  const [counts, jobs] = await Promise.all([
    getCounts(tech, dateWhere, dateParams),
    fetchInstallRows({
      where: where.join(" and "),
      params,
      orderBy: installOrderBy(sort, dir, INSTALL_STAGE_TIME_COL),
      page,
    }),
  ]);

  const pages = Math.max(1, Math.ceil(jobs.total / PAGE_SIZE));
  const keep = { ...(q && { q }), ...(from && { from }), ...(to && { to }) };
  const base = () => ({ ...(tab !== "all" && { tab }), ...keep });
  const tabHref = (target: Tab) =>
    `/installations/all?${new URLSearchParams({ ...(target !== "all" && { tab: target }), ...keep })}`;
  const sortHref = (key: string, nextDir: "asc" | "desc") =>
    `/installations/all?${new URLSearchParams({ ...base(), sort: key, dir: nextDir })}`;
  const pageHref = (n: number) =>
    `/installations/all?${new URLSearchParams({ ...base(), sort, dir, ...(n > 1 && { page: String(n) }) })}`;

  const TABS: TabItem<Tab>[] = [
    { key: "all", label: "ທັງໝົດ", icon: Layers, count: counts.all },
    { key: "open", label: "ດຳເນີນຢູ່", icon: Loader, count: counts.open },
    { key: "closed", label: "ປິດງານເເລ້ວ", icon: ListChecks, count: counts.closed },
    { key: "cancelled", label: "ຍົກເລີກແລ້ວ", icon: Ban, count: counts.cancelled },
  ];

  return (
    <div className="w-full space-y-4">
      <ListHeader
        title="ງານຕິດຕັ້ງທັງໝົດ"
        scope={tech ? "ສະແດງສະເພາະງານຂອງທ່ານ" : "ສະແດງທຸກງານ"}
        total={jobs.total}
        page={page}
        pages={pages}
      >
        <div className="flex items-center gap-2">
          <Link
            href="/installations"
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            <ChevronLeft className="size-4" />
            ກັບຄືນ
            <LinkPending className="size-3.5" />
          </Link>
          <Link
            href="/reports/installations"
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            <FileBarChart className="size-4" />
            ລາຍງານ
            <LinkPending className="size-3.5" />
          </Link>
        </div>
      </ListHeader>

      {/* ຊ່ວງວັນທີເປີດງານ */}
      <form className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm">
        {tab !== "all" && <input type="hidden" name="tab" value={tab} />}
        {q && <input type="hidden" name="q" value={q} />}
        <input type="hidden" name="sort" value={sort} />
        <input type="hidden" name="dir" value={dir} />
        <span className="text-xs font-medium text-slate-600">ວັນທີເປີດງານ</span>
        <input
          type="date"
          name="from"
          defaultValue={from}
          className="h-9 rounded-lg border border-slate-300 px-2.5 text-xs outline-none"
        />
        <span className="text-xs text-slate-400">ຫາ</span>
        <input
          type="date"
          name="to"
          defaultValue={to}
          className="h-9 rounded-lg border border-slate-300 px-2.5 text-xs outline-none"
        />
        <button className="h-9 rounded-lg bg-slate-900 px-4 text-xs font-medium text-white">ກັ່ນຕອງ</button>
        {(from || to) && (
          <Link href="/installations/all" className="text-xs text-slate-500 underline">
            ລ້າງ
          </Link>
        )}
      </form>

      <TabsAndSearch
        tabs={TABS}
        current={tab}
        tabHref={tabHref}
        q={q}
        sort={sort}
        dir={dir}
        hidden={{ ...(tab !== "all" && { tab }), ...(from && { from }), ...(to && { to }) }}
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
          {jobs.rows.map((row) => (
            <tr
              key={row.code}
              className={
                row.cancel_date ? "border-b border-slate-100 bg-[#fce8e6]" : "border-b border-slate-100 hover:bg-slate-50"
              }
            >
              <InstallCells row={row} />
              <td className="whitespace-nowrap px-3 py-2.5 text-center">
                {row.cancel_date ? (
                  <span className="text-[10px] text-slate-500" title={row.cancel_remark ?? ""}>
                    {row.cancel_code ?? "-"}
                  </span>
                ) : (
                  <Link
                    href={`/installations/${encodeURIComponent(row.code)}/print`}
                    target="_blank"
                    title="ພິມ"
                    className="inline-flex text-[#D35400] hover:opacity-70"
                  >
                    <Printer className="size-4" />
                  </Link>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </TableShell>

      <Pager page={page} pages={pages} total={jobs.total} pageHref={pageHref} />
    </div>
  );
}
