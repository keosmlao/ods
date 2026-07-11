import { finishInstall, startInstall, techFilter } from "@/app/actions/installation";
import { JobButton } from "@/components/installation/job-buttons";
import { query } from "@/lib/db";
import { installStageIs } from "@/lib/install-stage";
import { CheckCircle2, Clock, Wrench } from "lucide-react";
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
 * ຖອດແບບຈາກ ods: /tech_install + /start_tech_install + /finish_tech_install (tech_install.py)
 * — ອອກແບບໃໝ່.
 * ods ຕໍ່ session name ເຂົ້າ SQL ໂດຍກົງ (tech_install.py:157) — ບ່ອນນີ້ໃຊ້ parameter.
 * ods ຍັງລືມໃສ່ວົງເລັບໃນ WHERE ຂອງຕາຕະລາງ "ລໍຖ້າຕິດຕັ້ງ" ⇒ AND/OR ຜູກຜິດ.
 * ບ່ອນນີ້ໃຊ້ຂັ້ນຈາກ @/lib/install-stage ແທນ (ຂັ້ນ 4 = ລໍຖ້າຊ່າງຕິດຕັ້ງ, 5 = ກຳລັງຕິດຕັ້ງ).
 */
export const dynamic = "force-dynamic";

type Tab = "waiting" | "doing" | "done";
type Props = { searchParams: Promise<ListSearchParams> };

const BUCKET: Record<Tab, { where: string; timeCol: string }> = {
  // ຂັ້ນ 4 = ຮັບອາໄຫຼ່ຄົບແລ້ວ (ຫຼື ບໍ່ໃຊ້ອາໄຫຼ່) ແລະ ຍັງບໍ່ເລີ່ມ · ຕ້ອງຮັບງານກ່ອນ (tech_confirm)
  waiting: {
    where: `${installStageIs(4)} and a.tech_confirm is not null`,
    timeCol: "coalesce(a.pick_finish, a.tech_confirm, a.time_register)",
  },
  doing: { where: installStageIs(5), timeCol: "a.start_install" },
  done: {
    where: "a.cancel_date is null and a.start_install is not null and a.finish_install is not null",
    timeCol: "a.finish_install",
  },
};

async function getCounts(tech: string | null) {
  const params = tech ? [tech] : [];
  const mine = tech ? "and a.tech_code = $1" : "";
  const row = (
    await query<{ waiting: number; doing: number; done: number }>(
      `select count(*) filter (where ${BUCKET.waiting.where})::int waiting,
              count(*) filter (where ${BUCKET.doing.where})::int doing,
              count(*) filter (where ${BUCKET.done.where})::int done
       from ods_tb_install a where true ${mine}`,
      params,
    )
  ).rows[0];
  return { waiting: row?.waiting ?? 0, doing: row?.doing ?? 0, done: row?.done ?? 0 };
}

const TIME_LABEL: Record<Tab, string> = {
  waiting: "ວັນ/ເວລາຮັບອາໄຫຼ່",
  doing: "ວັນ/ເວລາເລີ່ມຕິດຕັ້ງ",
  done: "ວັນ/ເວລາຕິດຕັ້ງສຳເລັດ",
};

export default async function WorkPage({ searchParams }: Props) {
  const tech = await techFilter();
  const raw = await searchParams;
  const tab: Tab = raw.tab === "doing" || raw.tab === "done" ? raw.tab : "waiting";
  const { q, page, sort, dir } = readParams(raw);

  const bucket = BUCKET[tab];
  const where = [bucket.where];
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
      orderBy: installOrderBy(sort, dir, bucket.timeCol),
      page,
    }),
  ]);

  const pages = Math.max(1, Math.ceil(jobs.total / PAGE_SIZE));
  const base = () => ({ ...(tab !== "waiting" && { tab }), ...(q && { q }) });
  const tabHref = (target: Tab) =>
    `/installations/work?${new URLSearchParams({ ...(target !== "waiting" && { tab: target }), ...(q && { q }) })}`;
  const sortHref = (key: string, nextDir: "asc" | "desc") =>
    `/installations/work?${new URLSearchParams({ ...base(), sort: key, dir: nextDir })}`;
  const pageHref = (n: number) =>
    `/installations/work?${new URLSearchParams({ ...base(), sort, dir, ...(n > 1 && { page: String(n) }) })}`;

  const TABS: TabItem<Tab>[] = [
    { key: "waiting", label: "ລໍຖ້າຕິດຕັ້ງ", icon: Clock, count: counts.waiting },
    { key: "doing", label: "ກຳລັງຕິດຕັ້ງ", icon: Wrench, count: counts.doing },
    { key: "done", label: "ຕິດຕັ້ງສຳເລັດ", icon: CheckCircle2, count: counts.done },
  ];

  return (
    <div className="w-full space-y-4">
      <ListHeader
        title="ຕິດຕັ້ງ"
        scope={tech ? "ສະແດງສະເພາະງານຂອງທ່ານ" : "ສະແດງທຸກງານ"}
        total={jobs.total}
        page={page}
        pages={pages}
      />

      <TabsAndSearch
        tabs={TABS}
        current={tab}
        tabHref={tabHref}
        q={q}
        sort={sort}
        dir={dir}
        hidden={tab !== "waiting" ? { tab } : {}}
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
            <tr key={row.code} className="border-b border-slate-100 hover:bg-slate-50">
              <InstallCells row={row} timeLabel={TIME_LABEL[tab]} />
              <td className="whitespace-nowrap px-3 py-2.5 text-center">
                {tab === "waiting" && (
                  <JobButton code={row.code} action={startInstall} tone="primary" className="h-8 px-3 text-xs">
                    ເລີ່ມຕິດຕັ້ງ
                  </JobButton>
                )}
                {tab === "doing" && (
                  <JobButton
                    code={row.code}
                    action={finishInstall}
                    tone="success"
                    className="h-8 px-3 text-xs"
                    confirmTitle={`ຕິດຕັ້ງ ${row.code} ສຳເລັດແລ້ວບໍ?`}
                    confirmTone="warning"
                  >
                    ຕິດຕັ້ງສຳເລັດ
                  </JobButton>
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
