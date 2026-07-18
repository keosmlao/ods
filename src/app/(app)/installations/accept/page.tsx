import { acceptJob, techFilter } from "@/app/actions/installation";
import { JobButton } from "@/components/installation/job-buttons";
import { RejectButton } from "@/components/installation/reject-button";
import { SlaChip } from "@/components/installation/sla-chip";
import { INSTALL_LEFT_SQL } from "@/lib/install-sla";
import { Check } from "lucide-react";
import { INSTALL_ACCEPT_CLOCK } from "@/lib/install-stage";
import {
  INSTALL_PLAIN_COLUMNS,
  INSTALL_SEARCH,
  INSTALL_SORTABLE_COLUMNS,
  InstallCells,
  InstallTableHead,
  ListHeader,
  PAGE_SIZE,
  Pager,
  SearchBar,
  TableShell,
  fetchInstallRows,
  type InstallRow,
  installOrderBy,
  readParams,
  type ListSearchParams,
} from "../shared";

/**
 * ຄິວນີ້ມີແຕ່ງານທີ່ລໍຊ່າງກົດຮັບ. ຫຼັງຮັບແລ້ວຈະບໍ່ມີແທັບພັກກາງ:
 * ແອໄປຄິວເບີກອາໄຫຼ່ ແລະ ສິນຄ້າອື່ນໄປຄິວຕິດຕັ້ງທັນທີ (lib/job-flow).
 */
export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<ListSearchParams> };

/** ນາລິກາ 24 ຊມ ນັບແຕ່ອອກບິນ — ຂັ້ນນີ້ກິນເວລາ 44 ຊມ (ຄໍຂວດຮ່ວມກັບການຈັດຊ່າງ) */
type Row = InstallRow & { sla_left: number | null };
const EXTRA = `(${INSTALL_LEFT_SQL}) as sla_left`;

const WAITING = `a.cancel_date is null and a.time_register is not null and a.tech_code is not null
  and a.tech_confirm is null and a.start_install is null and a.job_finish is null`;

export default async function AcceptPage({ searchParams }: Props) {
  const tech = await techFilter();
  const raw = await searchParams;
  /**
   * ── ຮຽງຕາມ **ນາລິກາ 24 ຊມ** ເປັນຄ່າຕັ້ງຕົ້ນ ──
   * ເມື່ອກ່ອນຮຽງຕາມ "ຄ້າງມາດົນ" ນັບຈາກເວລາເປີດງານ ⇒ ງານທີ່ບິນອອກກ່ອນ (ລູກຄ້າລໍດົນກວ່າ)
   * ອາດຢູ່ລຸ່ມສຸດ ຖ້າ CS ຫາກໍ່ເປີດໃບງານໃຫ້ມັນ. ດຽວນີ້ຮຽງດ້ວຍ **ເວລາທີ່ຍັງເຫຼືອ**
   * ⇒ ງານທີ່ເລີຍກຳນົດ/ໃກ້ໝົດ ຂຶ້ນເທິງສຸດ (ບິນເກົ່າທີ່ບໍ່ມີວັນທີ ຕົກລຸ່ມສຸດ).
   */
  const { q, page, sort, dir } = readParams(raw, "sla");

  const where = [WAITING];
  const params: (string | number)[] = [];
  if (tech) {
    params.push(tech);
    where.push(`a.tech_code = $${params.length}`);
  }
  if (q) {
    params.push(`%${q}%`);
    where.push(INSTALL_SEARCH.replaceAll("$Q", `$${params.length}`));
  }

  const jobs = await fetchInstallRows<Row>({
    where: where.join(" and "),
    params,
    orderBy: installOrderBy(sort, dir, INSTALL_ACCEPT_CLOCK),
    page,
    extraColumns: EXTRA,
  });

  const pages = Math.max(1, Math.ceil(jobs.total / PAGE_SIZE));
  const base = () => ({ ...(q && { q }) });
  const sortHref = (key: string, nextDir: "asc" | "desc") =>
    `/installations/accept?${new URLSearchParams({ ...base(), sort: key, dir: nextDir })}`;
  const pageHref = (n: number) =>
    `/installations/accept?${new URLSearchParams({ ...base(), sort, dir, ...(n > 1 && { page: String(n) }) })}`;

  return (
    <div className="w-full space-y-4">
      <ListHeader
        title="ລໍຖ້າຊ່າງຮັບ"
        scope={tech ? "ສະແດງສະເພາະງານຂອງທ່ານ" : "ສະແດງທຸກງານ"}
        total={jobs.total}
        page={page}
        pages={pages}
      />

      <SearchBar q={q} sort={sort} dir={dir} placeholder="ຄົ້ນຫາ ເລກທີ, ເລກບິນ, ລູກຄ້າ, ຊ່າງ, ລາຍການ..." />

      <TableShell total={jobs.total} minWidth={1300}>
        <InstallTableHead
          columns={INSTALL_SORTABLE_COLUMNS}
          plain={["24 ຊມ ຈາກບິນ", ...INSTALL_PLAIN_COLUMNS]}
          sort={sort}
          dir={dir}
          sortHref={sortHref}
        />
        <tbody>
          {jobs.rows.map((row) => (
            <tr key={row.code} className="border-b border-slate-100 hover:bg-slate-50">
              <InstallCells row={row} timeLabel="ວັນ/ເວລາຈັດຊ່າງ" />
              <td className="whitespace-nowrap px-3 py-2.5 text-center">
                <SlaChip left={row.sla_left} />
              </td>
              <td className="whitespace-nowrap px-3 py-2.5">
                <div className="flex justify-center gap-2">
                  {/* ຮັບງານ = ການກະທຳຫຼັກ (ເດັ່ນ) · ບໍ່ຮັບ = ຂໍ້ຍົກເວັ້ນ (ປຸ່ມຮອງ) */}
                  <JobButton code={row.code} action={acceptJob} tone="success" className="h-8 px-3 text-xs">
                    <Check className="size-3.5" />
                    ຮັບງານ
                  </JobButton>
                  {/* ບໍ່ຮັບງານ = ປະຕິເສດ **ພ້ອມເຫດຜົນ** (lib/job-flow — ອັນດຽວກັບແອັບມືຖື) */}
                  <RejectButton workflow="install" code={row.code} />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </TableShell>

      <Pager page={page} pages={pages} total={jobs.total} pageHref={pageHref} />
    </div>
  );
}
