import { chooseNewTech } from "@/app/actions/installation";
import { AssignTechButton } from "@/components/installation/assign-tech";
import { JobButton } from "@/components/installation/job-buttons";
import { query } from "@/lib/db";
import { installStageIs } from "@/lib/install-stage";
import { Clock, UserCheck } from "lucide-react";
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
  type InstallRow,
  type ListSearchParams,
  type TabItem,
} from "../shared";

/**
 * ຖອດແບບຈາກ ods: /assign_tech_install + /assign_tech_submit + /choose_new_tech (install_admin.py)
 * — ອອກແບບໃໝ່ ໃຫ້ຄືກັນກັບໜ້າ /checking (ຄົ້ນຫາ, ຈັດຮຽງ, ແບ່ງໜ້າຢູ່ server, ຕົວນັບເວລາຄ້າງ).
 * ຂັ້ນຂອງງານມາຈາກ @/lib/install-stage (ຂັ້ນ 0 = ລໍຖ້າຈັດຊ່າງ).
 */
export const dynamic = "force-dynamic";

type Tab = "assign" | "accept";
type Props = { searchParams: Promise<ListSearchParams> };

/** ຊ່ອງເພີ່ມ: ຂໍ້ມູນທີ່ modal "ເລືອກຊ່າງ" ຕ້ອງໃຊ້ + ຊ່າງກ່ອນໜ້ານີ້ */
type Row = InstallRow & {
  appoint_input: string | null;
  remark: string | null;
  tech_before: string | null;
};

const EXTRA = `to_char(a.appoint_date,'YYYY-MM-DD') appoint_input,
  coalesce(a.remark,'') remark,
  coalesce(a.tech_before,'-') tech_before`;

const BUCKET: Record<Tab, { where: string; timeCol: string }> = {
  // ຂັ້ນ 0 = ຍັງບໍ່ມີຊ່າງ
  assign: { where: installStageIs(0), timeCol: "a.time_register" },
  // ຈັດຊ່າງແລ້ວ ແຕ່ຊ່າງຍັງບໍ່ທັນຮັບງານ — ຜູ້ຈັດການປ່ຽນຊ່າງໄດ້ຢູ່ນີ້
  accept: {
    where: `a.time_register is not null and a.tech_code is not null and a.tech_confirm is null
      and a.reg_start is null and a.cancel_date is null`,
    timeCol: "a.time_register",
  },
};

async function getCounts() {
  const row = (
    await query<{ assign: number; accept: number }>(
      `select count(*) filter (where ${BUCKET.assign.where})::int assign,
              count(*) filter (where ${BUCKET.accept.where})::int accept
       from ods_tb_install a`,
    )
  ).rows[0];
  return { assign: row?.assign ?? 0, accept: row?.accept ?? 0 };
}

export default async function AssignPage({ searchParams }: Props) {
  const raw = await searchParams;
  const tab: Tab = raw.tab === "accept" ? "accept" : "assign";
  const { q, page, sort, dir } = readParams(raw);

  const bucket = BUCKET[tab];
  const where = [bucket.where];
  const params: (string | number)[] = [];
  if (q) {
    params.push(`%${q}%`);
    where.push(INSTALL_SEARCH.replaceAll("$Q", `$${params.length}`));
  }

  const [counts, jobs, techs] = await Promise.all([
    getCounts(),
    fetchInstallRows<Row>({
      where: where.join(" and "),
      params,
      orderBy: installOrderBy(sort, dir, bucket.timeCol),
      page,
      extraColumns: EXTRA,
    }),
    query<{ code: string; username: string }>(
      "select code,username from users where roles='technical' order by username",
    ),
  ]);

  const pages = Math.max(1, Math.ceil(jobs.total / PAGE_SIZE));
  const base = () => ({ ...(tab !== "assign" && { tab }), ...(q && { q }) });
  const tabHref = (target: Tab) =>
    `/installations/assign?${new URLSearchParams({ ...(target !== "assign" && { tab: target }), ...(q && { q }) })}`;
  const sortHref = (key: string, nextDir: "asc" | "desc") =>
    `/installations/assign?${new URLSearchParams({ ...base(), sort: key, dir: nextDir })}`;
  const pageHref = (n: number) =>
    `/installations/assign?${new URLSearchParams({ ...base(), sort, dir, ...(n > 1 && { page: String(n) }) })}`;

  const TABS: TabItem<Tab>[] = [
    { key: "assign", label: "ລໍຖ້າຈັດຊ່າງ", icon: Clock, count: counts.assign },
    { key: "accept", label: "ລໍຖ້າຊ່າງຮັບງານ", icon: UserCheck, count: counts.accept },
  ];

  return (
    <div className="w-full space-y-4">
      <ListHeader
        title="ຈັດງານຊ່າງຕິດຕັ້ງ"
        scope={tab === "assign" ? "ລາຍການລໍຖ້າຈັດ ຊ່າງ ງານຕິດຕັ້ງ" : "ລາຍການລໍຖ້າຊ່າງຮັບງານຕິດຕັ້ງ"}
        total={jobs.total}
        page={page}
        pages={pages}
      />

      <TabsAndSearch tabs={TABS} current={tab} tabHref={tabHref} q={q} sort={sort} dir={dir} hidden={tab !== "assign" ? { tab } : {}} />

      <TableShell total={jobs.total} minWidth={1350}>
        <InstallTableHead
          columns={INSTALL_SORTABLE_COLUMNS}
          plain={[...INSTALL_PLAIN_COLUMNS, tab === "assign" ? "ຊ່າງກ່ອນໜ້ານີ້" : "ຊ່າງທີ່ເລືອກ"]}
          sort={sort}
          dir={dir}
          sortHref={sortHref}
        />
        <tbody>
          {jobs.rows.map((row) => (
            <tr key={row.code} className="border-b border-slate-100 hover:bg-slate-50">
              <InstallCells row={row} timeLabel="ວັນ/ເວລາເປີດງານ" />
              <td className="whitespace-nowrap px-3 py-2.5 text-center">
                {tab === "assign" ? (row.tech_before || "-") : (row.tech_code || "-")}
              </td>
              <td className="whitespace-nowrap px-3 py-2.5 text-center">
                {tab === "assign" ? (
                  <AssignTechButton
                    row={{
                      code: row.code,
                      customer: row.customer,
                      location_inst: row.location_inst,
                      appoint_date: row.appoint_input,
                      remark: row.remark,
                    }}
                    techs={techs.rows}
                  />
                ) : (
                  <JobButton
                    code={row.code}
                    action={chooseNewTech}
                    tone="danger"
                    className="h-8 px-3 text-xs"
                    confirmTitle={`ເລືອກຊ່າງໃໝ່ໃຫ້ ${row.code}?`}
                    confirmTone="warning"
                  >
                    ເລືອກໃໝ່
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
