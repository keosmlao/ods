import { acceptJob, techFilter, unacceptJob } from "@/app/actions/installation";
import { JobButton } from "@/components/installation/job-buttons";
import { RejectButton } from "@/components/installation/reject-button";
import { Check } from "lucide-react";
import { query } from "@/lib/db";
import { INSTALL_ACCEPT_CLOCK } from "@/lib/install-stage";
import { CheckCircle2, Clock } from "lucide-react";
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
 * ຖອດແບບຈາກ ods: /tech_accept_job + /tech_accept_already + /tech_accept_cc_already
 * + /tech_dont_accept (tech_install.py) — ອອກແບບໃໝ່.
 * ods ຕໍ່ session name ເຂົ້າ SQL ໂດຍກົງ (SQL injection) — ບ່ອນນີ້ໃຊ້ parameter.
 * BUG ໃນ ods: ຕາຕະລາງ "ຮັບງານແລ້ວ" ບໍ່ໄດ້ກັນງານທີ່ຕິດຕັ້ງໄປແລ້ວອອກ ⇒ ສະແດງງານເກົ່ານຳ
 * (ຫຼາຍພັນລາຍການ). ບ່ອນນີ້ເພີ່ມ start_install is null.
 */
export const dynamic = "force-dynamic";

type Tab = "waiting" | "accepted";
type Props = { searchParams: Promise<ListSearchParams> };

/**
 * BUG ທີ່ແກ້ຢູ່ນີ້ (B2): ແທັບ "ລໍຖ້າຮັບງານ" ເຄີຍກອງ `a.reg_start is null` —
 * ພໍໃບຂໍເບີກອອກ (reg_start ຖືກ set) ງານກໍ່ຫາຍອອກຈາກໜ້ານີ້ ⇒ tech_confirm ບໍ່ມີວັນຖືກ set ໄດ້ອີກ
 * ແລະ /installations/work (ຕ້ອງການ tech_confirm) ກໍ່ບໍ່ສະແດງ ⇒ ງານຕາຍ ບໍ່ມີໜ້າໃດພາໄປຕໍ່ໄດ້.
 * ດຽວນີ້ ① saveSpareRequest ບັງຄັບໃຫ້ຮັບງານກ່ອນຈຶ່ງຂໍເບີກໄດ້ (ຕົ້ນທາງ) ແລະ
 * ② ແທັບນີ້ບໍ່ອີງ reg_start ອີກ ແຕ່ອີງ "ຍັງບໍ່ເລີ່ມຕິດຕັ້ງ ແລະ ຍັງບໍ່ປິດງານ" (ຕາໜ່າງຮັບ) —
 * ງານທີ່ຫຼົງເຂົ້າສະຖານະນັ້ນ (ຂໍ້ມູນເກົ່າ) ຈຶ່ງຍັງເຫັນ ແລະ ຮັບງານໄດ້.
 * ຈຳນວນແຖວມື້ນີ້ບໍ່ປ່ຽນ (0 ແຖວທັງກ່ອນ ແລະ ຫຼັງ — ບໍ່ມີງານໃດຢູ່ໃນສະຖານະນັ້ນ).
 *
 * ໂມງຄ້າງ (B6): ນັບຈາກ **ເວລາຈັດຊ່າງ** (assigt_time) ບໍ່ແມ່ນເວລາເປີດງານ —
 * ຄິວນີ້ວັດ "ຊ່າງຮັບຊ້າ", ຄິວຈັດຊ່າງ (/installations/assign) ວັດ "ຜູ້ຈັດຈັດຊ້າ".
 */
const BUCKET: Record<Tab, { where: string; timeCol: string }> = {
  waiting: {
    where: `a.cancel_date is null and a.time_register is not null and a.tech_code is not null
      and a.tech_confirm is null and a.start_install is null and a.job_finish is null`,
    timeCol: INSTALL_ACCEPT_CLOCK,
  },
  accepted: {
    where: `a.cancel_date is null and a.time_register is not null and a.tech_code is not null
      and a.tech_confirm is not null and a.reg_start is null and a.start_install is null`,
    timeCol: "a.tech_confirm",
  },
};

async function getCounts(tech: string | null) {
  const params = tech ? [tech] : [];
  const mine = tech ? "and a.tech_code = $1" : "";
  const row = (
    await query<{ waiting: number; accepted: number }>(
      `select count(*) filter (where ${BUCKET.waiting.where})::int waiting,
              count(*) filter (where ${BUCKET.accepted.where})::int accepted
       from ods_tb_install a where true ${mine}`,
      params,
    )
  ).rows[0];
  return { waiting: row?.waiting ?? 0, accepted: row?.accepted ?? 0 };
}

export default async function AcceptPage({ searchParams }: Props) {
  const tech = await techFilter();
  const raw = await searchParams;
  const tab: Tab = raw.tab === "accepted" ? "accepted" : "waiting";
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
    `/installations/accept?${new URLSearchParams({ ...(target !== "waiting" && { tab: target }), ...(q && { q }) })}`;
  const sortHref = (key: string, nextDir: "asc" | "desc") =>
    `/installations/accept?${new URLSearchParams({ ...base(), sort: key, dir: nextDir })}`;
  const pageHref = (n: number) =>
    `/installations/accept?${new URLSearchParams({ ...base(), sort, dir, ...(n > 1 && { page: String(n) }) })}`;

  const TABS: TabItem<Tab>[] = [
    { key: "waiting", label: "ລໍຖ້າຮັບງານຕິດຕັ້ງ", icon: Clock, count: counts.waiting },
    { key: "accepted", label: "ຮັບງານເເລ້ວ (ລໍຖ້າດຳເນີນການ)", icon: CheckCircle2, count: counts.accepted },
  ];

  return (
    <div className="w-full space-y-4">
      <ListHeader
        title="ຮັບງານຕິດຕັ້ງ"
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

      <TableShell total={jobs.total} minWidth={1300}>
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
              <InstallCells row={row} timeLabel={tab === "waiting" ? "ວັນ/ເວລາຈັດຊ່າງ" : "ວັນ/ເວລາຮັບງານ"} />
              <td className="whitespace-nowrap px-3 py-2.5">
                {tab === "waiting" ? (
                  <div className="flex justify-center gap-2">
                    {/* ຮັບງານ = ການກະທຳຫຼັກ (ເດັ່ນ) · ບໍ່ຮັບ = ຂໍ້ຍົກເວັ້ນ (ປຸ່ມຮອງ) */}
                    <JobButton code={row.code} action={acceptJob} tone="success" className="h-8 px-3 text-xs">
                      <Check className="size-3.5" />
                      ຮັບງານ
                    </JobButton>
                    {/* ບໍ່ຮັບງານ = ປະຕິເສດ **ພ້ອມເຫດຜົນ** (lib/job-flow — ອັນດຽວກັບແອັບມືຖື) */}
                    <RejectButton workflow="install" code={row.code} />
                  </div>
                ) : (
                  <div className="flex justify-center">
                    <JobButton
                      code={row.code}
                      action={unacceptJob}
                      tone="danger"
                      className="h-8 px-3 text-xs"
                      confirmTitle={`ຍົກເລີກຮັບງານ ${row.code}?`}
                      confirmTone="danger"
                    >
                      ຍົກເລີກຮັບງານ
                    </JobButton>
                  </div>
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
