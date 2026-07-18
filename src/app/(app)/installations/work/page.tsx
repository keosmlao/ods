import { startInstall, techFilter } from "@/app/actions/installation";
import { FinishInstallButton } from "@/components/installation/finish-install-button";
import { UndoStartInstallButton } from "@/components/installation/undo-buttons";
import { JobButton } from "@/components/installation/job-buttons";
import { installStageIs } from "@/lib/install-stage";
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
  installOrderBy,
  readParams,
  type ListSearchParams,
} from "../shared";

/**
 * ຖອດແບບຈາກ ods: /tech_install + /start_tech_install + /finish_tech_install (tech_install.py)
 * — ອອກແບບໃໝ່.
 * ods ຕໍ່ session name ເຂົ້າ SQL ໂດຍກົງ (tech_install.py:157) — ບ່ອນນີ້ໃຊ້ parameter.
 * ods ຍັງລືມໃສ່ວົງເລັບໃນ WHERE ຂອງຕາຕະລາງ "ລໍຖ້າຕິດຕັ້ງ" ⇒ AND/OR ຜູກຜິດ.
 * ຂັ້ນ 4 ແມ່ນລໍຖ້າຕິດຕັ້ງ; ກົດເລີ່ມແລ້ວຈະເຂົ້າຂັ້ນ 5 ກຳລັງຕິດຕັ້ງ.
 */
export const dynamic = "force-dynamic";

type Queue = "waiting" | "doing";
export type WorkQueueProps = { searchParams: Promise<ListSearchParams> };

const BUCKET: Record<Queue, { where: string; timeCol: string }> = {
  // ຂັ້ນ 4 = ຮັບອາໄຫຼ່ຄົບແລ້ວ (ຫຼື ບໍ່ໃຊ້ອາໄຫຼ່) ແລະ ຍັງບໍ່ເລີ່ມ · ຕ້ອງຮັບງານກ່ອນ (tech_confirm)
  waiting: {
    where: `${installStageIs(4)} and a.tech_confirm is not null and a.start_install is null`,
    timeCol: "coalesce(a.pick_finish, a.tech_confirm, a.time_register)",
  },
  doing: { where: installStageIs(5), timeCol: "a.start_install" },
};

const TIME_LABEL: Record<Queue, string> = {
  waiting: "ວັນ/ເວລາຮັບອາໄຫຼ່",
  doing: "ວັນ/ເວລາເລີ່ມຕິດຕັ້ງ",
};

export async function InstallationWorkQueue({ searchParams, queue }: WorkQueueProps & { queue: Queue }) {
  const tech = await techFilter();
  const raw = await searchParams;
  const { q, page, sort, dir } = readParams(raw);

  const bucket = BUCKET[queue];
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

  const jobs = await fetchInstallRows({
    where: where.join(" and "),
    params,
    orderBy: installOrderBy(sort, dir, bucket.timeCol),
    page,
  });

  const pages = Math.max(1, Math.ceil(jobs.total / PAGE_SIZE));
  const basePath = queue === "doing" ? "/installations/work/doing" : "/installations/work";
  const base = () => ({ ...(q && { q }) });
  const sortHref = (key: string, nextDir: "asc" | "desc") =>
    `${basePath}?${new URLSearchParams({ ...base(), sort: key, dir: nextDir })}`;
  const pageHref = (n: number) =>
    `${basePath}?${new URLSearchParams({ ...base(), sort, dir, ...(n > 1 && { page: String(n) }) })}`;

  return (
    <div className="w-full space-y-4">
      <ListHeader
        title={queue === "doing" ? "ກຳລັງຕິດຕັ້ງ" : "ລໍຖ້າຕິດຕັ້ງ"}
        scope={tech ? "ສະແດງສະເພາະງານຂອງທ່ານ" : "ສະແດງທຸກງານ"}
        total={jobs.total}
        page={page}
        pages={pages}
      />

      <SearchBar
        q={q}
        sort={sort}
        dir={dir}
        placeholder="ຄົ້ນຫາ ເລກທີ, ເລກບິນ, ລູກຄ້າ, ຊ່າງ, ລາຍການ..."
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
              <InstallCells row={row} timeLabel={TIME_LABEL[queue]} />
              <td className="whitespace-nowrap px-3 py-2.5 text-center">
                {queue === "waiting" && (
                  <JobButton code={row.code} action={startInstall} tone="primary" className="h-8 px-3 text-xs">
                    ເລີ່ມຕິດຕັ້ງ
                  </JobButton>
                )}
                {queue === "doing" && (
                  <div className="flex items-center justify-center gap-2">
                    {/* ຈົບງານຕິດຕັ້ງ = ຕ້ອງແນບຮູບຜົນງານ (ບັງຄັບຢູ່ lib/job-flow — ແອັບກໍ່ບັງຄັບຄືກັນ) */}
                    <FinishInstallButton code={row.code} />
                    {/* ກົດ "ເລີ່ມຕິດຕັ້ງ" ຜິດງານ → ດຶງກັບໄປ "ລໍຖ້າຊ່າງຕິດຕັ້ງ" (ກົດເກນຢູ່ server) */}
                    <UndoStartInstallButton code={row.code} variant="icon" />
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

export default function WorkPage(props: WorkQueueProps) {
  return <InstallationWorkQueue {...props} queue="waiting" />;
}
