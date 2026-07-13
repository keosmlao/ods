import { chooseNewTech } from "@/app/actions/installation";
import { AssignTechButton } from "@/components/installation/assign-tech";
import { SlaChip } from "@/components/installation/sla-chip";
import { INSTALL_LEFT_SQL } from "@/lib/install-sla";
import { JobButton } from "@/components/installation/job-buttons";
import { query } from "@/lib/db";
import { listTechnicians } from "@/lib/technicians";
import { INSTALL_ACCEPT_CLOCK, installStageIs } from "@/lib/install-stage";
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
  /** ວິນາທີທີ່ຍັງເຫຼືອຈົນຄົບ 24 ຊມ ນັບແຕ່ອອກບິນ (ຕິດລົບ = ເລີຍກຳນົດ) */
  sla_left: number | null;
};

const EXTRA = `to_char(a.appoint_date,'YYYY-MM-DD') appoint_input,
  coalesce(a.remark,'') remark,
  coalesce(a.tech_before,'-') tech_before,
  (${INSTALL_LEFT_SQL}) as sla_left`;

/**
 * ໂມງຄ້າງຂອງສອງຄິວນີ້ວັດຄົນລະຢ່າງ (B6):
 *   ລໍຖ້າຈັດຊ່າງ  → ນັບຈາກ time_register (ຜູ້ຈັດຍັງບໍ່ໄດ້ລົງມື)
 *   ລໍຖ້າຊ່າງຮັບງານ → ນັບຈາກ assigt_time (ຈັດແລ້ວ ຊ່າງຍັງບໍ່ຮັບ) — ຖອຍໄປໃຊ້ time_register
 *                    ສຳລັບ 6,829 ແຖວເກົ່າທີ່ບໍ່ມີ assigt_time ຈຶ່ງບໍ່ມີໂມງ 20,000 ວັນ.
 * ແທັບ accept ບໍ່ກອງ reg_start ອີກແລ້ວ (B2 — ເບິ່ງ /installations/accept) ແຕ່ປຸ່ມ "ເລືອກໃໝ່"
 * (chooseNewTech) ປະຕິເສດເອງ ຖ້າມີໃບຂໍເບີກແລ້ວ. ຈຳນວນແຖວມື້ນີ້ບໍ່ປ່ຽນ (0 → 0).
 */
const BUCKET: Record<Tab, { where: string; timeCol: string }> = {
  // ຂັ້ນ 0 = ຍັງບໍ່ມີຊ່າງ
  assign: { where: installStageIs(0), timeCol: "a.time_register" },
  // ຈັດຊ່າງແລ້ວ ແຕ່ຊ່າງຍັງບໍ່ທັນຮັບງານ — ຜູ້ຈັດການປ່ຽນຊ່າງໄດ້ຢູ່ນີ້
  accept: {
    where: `a.time_register is not null and a.tech_code is not null and a.tech_confirm is null
      and a.start_install is null and a.job_finish is null and a.cancel_date is null`,
    timeCol: INSTALL_ACCEPT_CLOCK,
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
  /**
   * ── ຮຽງຕາມ **ນາລິກາ 24 ຊມ** ເປັນຄ່າຕັ້ງຕົ້ນ ──
   * ເມື່ອກ່ອນຮຽງຕາມ "ຄ້າງມາດົນ" ນັບຈາກເວລາເປີດງານ ⇒ ງານທີ່ບິນອອກກ່ອນ (ລູກຄ້າລໍດົນກວ່າ)
   * ອາດຢູ່ລຸ່ມສຸດ ຖ້າ CS ຫາກໍ່ເປີດໃບງານໃຫ້ມັນ. ດຽວນີ້ຮຽງດ້ວຍ **ເວລາທີ່ຍັງເຫຼືອ**
   * ⇒ ງານທີ່ເລີຍກຳນົດ/ໃກ້ໝົດ ຂຶ້ນເທິງສຸດ (ບິນເກົ່າທີ່ບໍ່ມີວັນທີ ຕົກລຸ່ມສຸດ).
   */
  const { q, page, sort, dir } = readParams(raw, "sla");

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
    // ລາຍຊື່ຊ່າງ = ພະນັກງານ ERP ທີ່ role ສຸດທ້າຍເປັນຊ່າງ (ລວມຄົນທີ່ຜູ້ຈັດການ
    // ກຳນົດສິດເອງຢູ່ /manage/employees) — ບ່ອນດຽວຂອງລະບົບ (lib/technicians)
    listTechnicians(),
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
          plain={["24 ຊມ ຈາກບິນ", ...INSTALL_PLAIN_COLUMNS, tab === "assign" ? "ຊ່າງກ່ອນໜ້ານີ້" : "ຊ່າງທີ່ເລືອກ"]}
          sort={sort}
          dir={dir}
          sortHref={sortHref}
        />
        <tbody>
          {jobs.rows.map((row) => (
            <tr key={row.code} className="border-b border-slate-100 hover:bg-slate-50">
              <InstallCells row={row} timeLabel={tab === "assign" ? "ວັນ/ເວລາເປີດງານ" : "ວັນ/ເວລາຈັດຊ່າງ"} />
              {/* ນາລິກາ 24 ຊມ ນັບແຕ່ອອກບິນ — ຄໍຂວດອັນດັບ 1 ຢູ່ຂັ້ນນີ້ (44 ຊມ) */}
              <td className="whitespace-nowrap px-3 py-2.5 text-center">
                <SlaChip left={row.sla_left} />
              </td>
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
                    techs={techs}
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
