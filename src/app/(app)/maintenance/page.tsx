import { getSession } from "@/lib/auth";
import { MAINTENANCE_OPEN } from "@/lib/maintenance-stage";
import { MAINTENANCE_SIDE, roleOf } from "@/lib/roles";
import { ownJobsOnly } from "@/lib/scope";
import { LinkButton } from "@/components/ui";
import { FilePlus2 } from "lucide-react";
import { redirect } from "next/navigation";
import {
  fetchMaintenanceRows,
  ListHeader,
  MAINT_PLAIN_COLUMNS,
  MAINT_SORTABLE_COLUMNS,
  MAINTENANCE_SEARCH,
  MaintenanceCells,
  MaintTableHead,
  maintenanceOrderBy,
  PAGE_SIZE,
  Pager,
  readParams,
  SearchBar,
  TableShell,
  type ListSearchParams,
} from "./shared";

/** ລາຍການງານສ້ອມບໍລຸງທັງໝົດ (ຄ້າງ) — ໜ້າຕາຄືໜ້າ /installations. */
export const dynamic = "force-dynamic";

export default async function MaintenancePage({ searchParams }: { searchParams: Promise<ListSearchParams> }) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!MAINTENANCE_SIDE.includes(roleOf(session))) redirect("/forbidden");

  const tech = ownJobsOnly(session);
  const { q, page, sort, dir } = readParams(await searchParams);

  const where = [MAINTENANCE_OPEN];
  const params: (string | number)[] = [];
  if (tech) {
    params.push(tech);
    where.push(`a.emp_code = $${params.length}`);
  }
  if (q) {
    params.push(`%${q}%`);
    where.push(MAINTENANCE_SEARCH.replaceAll("$Q", `$${params.length}`));
  }

  const jobs = await fetchMaintenanceRows({ where: where.join(" and "), params, orderBy: maintenanceOrderBy(sort, dir), page, pageSize: PAGE_SIZE });
  const pages = Math.max(1, Math.ceil(jobs.total / PAGE_SIZE));
  const qp = (o: Record<string, string>) => new URLSearchParams(o).toString();
  const sortHref = (key: string, nextDir: "asc" | "desc") => `/maintenance?${qp({ ...(q ? { q } : {}), sort: key, dir: nextDir })}`;
  const pageHref = (n: number) => `/maintenance?${qp({ ...(q ? { q } : {}), sort, dir, ...(n > 1 ? { page: String(n) } : {}) })}`;

  return (
    <div className="w-full space-y-4">
      <ListHeader title="ງານສ້ອມບໍລຸງ" scope={tech ? "ສະແດງສະເພາະງານຂອງທ່ານ" : "ສະແດງທຸກງານ"} total={jobs.total} page={page} pages={pages}>
        <LinkButton href="/maintenance/new" tone="success" className="h-9 text-xs">
          <FilePlus2 className="size-4" />
          ເປີດງານໃໝ່
        </LinkButton>
      </ListHeader>

      <SearchBar q={q} sort={sort} dir={dir} placeholder="ຄົ້ນຫາ ເລກທີ / ລູກຄ້າ / ເບີໂທ / ຊ່າງ..." />

      <TableShell total={jobs.total} minWidth={1100}>
        <MaintTableHead columns={MAINT_SORTABLE_COLUMNS} plain={MAINT_PLAIN_COLUMNS} sort={sort} dir={dir} sortHref={sortHref} />
        <tbody>
          {jobs.rows.map((row) => (
            <tr key={row.code} className="border-b border-slate-100 hover:bg-slate-50">
              <MaintenanceCells row={row} />
              <td className="px-3 py-2.5" />
            </tr>
          ))}
        </tbody>
      </TableShell>

      <Pager page={page} pages={pages} total={jobs.total} pageHref={pageHref} />
    </div>
  );
}
