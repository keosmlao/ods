import { InstallDeleteButton } from "@/components/installation/install-delete-button";
import { CancelJobButton } from "@/components/installation/job-buttons";
import { LinkButton } from "@/components/ui";
import { getSession } from "@/lib/auth";
import { query } from "@/lib/db";
import { INSTALL_CANCELLED, INSTALL_OPEN, INSTALL_STAGE_SQL, INSTALL_STAGE_TIME_COL } from "@/lib/install-stage";
import { permissionFor } from "@/lib/permissions";
import { Ban, FilePlus2, Loader, Pencil, Printer } from "lucide-react";
import Link from "next/link";
import { CancelledSpares } from "./cancelled-spares";
import { getInstallOutstandingByJob } from "./outstanding";
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

/**
 * ── ຖອດແທັບ "ຕິດຕັ້ງສຳເລັດ" ແລະ "ປິດງານແລ້ວ" ອອກ (13-07-2026) ──
 * "ປິດງານແລ້ວ" ມີ **6,820 ງານ** ⇒ ນັບ ແລະ ດຶງທຸກເທື່ອທີ່ເປີດໜ້າ ໃນຂະນະທີ່ຄົນເຮັດວຽກ
 * ຕ້ອງການແຕ່ **ງານທີ່ດຳເນີນຢູ່** ⇒ ໜ້າຊ້າໂດຍບໍ່ຈຳເປັນ (ຄືກັບໜ້າ /service ທີ່ຖອດໄປແລ້ວ).
 * ງານທີ່ຈົບແລ້ວເບິ່ງໄດ້: **ຄົ້ນຫາ** · /installations/<ລະຫັດ> · ລາຍງານງານຕິດຕັ້ງ ·
 * KPI · ລາຍງານແບບສອບຖາມລູກຄ້າ.
 * ເຫຼືອ "ຍົກເລີກແລ້ວ" ໄວ້ (3 ງານ — ແລະ ມັນມີໜ້າທີ່ຈິງ: ບອກອາໄຫຼ່ທີ່ຄ້າງນອກສາງ).
 */
type Tab = "open" | "cancelled";
type Props = { searchParams: Promise<ListSearchParams> };

/** ຖັງງານ — ລວມກັນແລ້ວໄດ້ທຸກແຖວຂອງ ods_tb_install ພໍດີ (ຍົກເວັ້ນ done ທີ່ຢູ່ໃນ open ນຳ) */
const BUCKET: Record<Tab, string> = {
  open: INSTALL_OPEN,
  cancelled: INSTALL_CANCELLED,
};

async function getCounts(tech: string | null) {
  const params = tech ? [tech] : [];
  const mine = tech ? "and a.tech_code = $1" : "";
  const sql = `select
      count(*) filter (where ${BUCKET.open})::int open,
      count(*) filter (where ${BUCKET.cancelled})::int cancelled,
      count(*) filter (where ${INSTALL_OPEN} and (a.tech_code is null or a.tech_code = '')
        and a.start_install is null)::int unassigned
    from ods_tb_install a where true ${mine}`;
  const row = (await query<{ open: number; cancelled: number; unassigned: number }>(sql, params)).rows[0];
  return {
    open: row?.open ?? 0,
    cancelled: row?.cancelled ?? 0,
    unassigned: row?.unassigned ?? 0,
  };
}

/** ຂັ້ນທີ່ກອງໄດ້ (ສະເພາະ 8 ຄິວງານດຳເນີນຢູ່: 0..7) */
const OPEN_STAGES = [0, 1, 2, 3, 4, 5, 6, 7];

export default async function InstallationsPage({ searchParams }: Props) {
  const session = await getSession();
  // ຊ່າງເຫັນສະເພາະງານຂອງຕົນ (ຄືກັບ ods /api/install_list)
  const tech = session?.role === "technical" ? session.username : null;
  const installPermission = session
    ? await permissionFor(session, "/installations")
    : { read: false, create: false, update: false, delete: false };

  const raw = await searchParams;
  const tab: Tab = raw.tab === "cancelled" ? "cancelled" : "open";
  const { q, page, sort, dir } = readParams(raw);
  /**
   * ຕົວກອງສະຖານະ — ສະເພາະແທັບ "ດຳເນີນຢູ່" (8 ຄິວ: ຂັ້ນ 0..7).
   * ໜ້ານີ້ຄື "ໃບງານ/ລໍຖ້າຈັດຊ່າງ" ⇒ **ຄ່າຕັ້ງຕົ້ນ = ຂັ້ນ 0 (ລໍຖ້າຈັດຊ່າງ)**.
   * ຢາກເຫັນທຸກຂັ້ນ ⇒ ?status=all (chip "ທຸກຂັ້ນ"). status = null ໝາຍວ່າ ທຸກຂັ້ນ.
   */
  const status =
    tab !== "open"
      ? null
      : raw.status === "all"
        ? null
        : OPEN_STAGES.includes(Number(raw.status))
          ? Number(raw.status)
          : 0;

  const where = [BUCKET[tab]];
  const params: (string | number)[] = [];
  if (tech) {
    params.push(tech);
    where.push(`a.tech_code = $${params.length}`);
  }
  if (status !== null) where.push(`(${INSTALL_STAGE_SQL}) = ${status}`);
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

  /**
   * ງານທີ່ຍົກເລີກແລ້ວ ແຕ່ອາໄຫຼ່ຍັງຄ້າງນອກສາງ (B5) — cancelInstall ບໍ່ດຶງອາໄຫຼ່ຄືນເອງ
   * (ຫ້າມຍ້າຍສະຕັອກແບບງຽບໆ) ຈຶ່ງສະແດງໃຫ້ເຫັນຢູ່ນີ້ ແລ້ວພາໄປຂັ້ນຕອນສົ່ງຄືນທີ່ມີຢູ່ແລ້ວ
   * (SRI 59 → SRT 58) — ຄືກັບທີ່ /approvals/cancellations ເຮັດໃຫ້ຝັ່ງສ້ອມ.
   */
  const outstanding =
    tab === "cancelled" ? await getInstallOutstandingByJob(jobs.rows.map((row) => row.code)) : new Map();
  const outstandingJobs = [...outstanding.entries()].map(([code, docs]) => ({ code, docs }));

  const pages = Math.max(1, Math.ceil(jobs.total / PAGE_SIZE));
  // ຕົວກອງສະຖານະຕ້ອງໄປນຳທຸກລິ້ງ (ຈັດຮຽງ/ປ່ຽນໜ້າ) ບໍ່ດັ່ງນັ້ນກົດແລ້ວເດັ້ງອອກຈາກຕົວກອງ
  const base = () => ({
    ...(tab !== "open" && { tab }),
    ...(q && { q }),
    // default (ບໍ່ມີ param) = ຂັ້ນ 0 ⇒ ລິ້ງຈັດຮຽງ/ປ່ຽນໜ້າ ຕ້ອງພົກ status ໄປນຳ (ລວມ "all")
    ...(tab === "open" && { status: status === null ? "all" : String(status) }),
  });
  const tabHref = (target: Tab) =>
    `/installations?${new URLSearchParams({ ...(target !== "open" && { tab: target }), ...(q && { q }) })}`;
  const sortHref = (key: string, nextDir: "asc" | "desc") =>
    `/installations?${new URLSearchParams({ ...base(), sort: key, dir: nextDir })}`;
  const pageHref = (n: number) =>
    `/installations?${new URLSearchParams({ ...base(), sort, dir, ...(n > 1 && { page: String(n) }) })}`;

  // ໜ້ານີ້ = ຄິວ "ລໍຖ້າຈັດຊ່າງ" (ຂັ້ນ 0) — ການເບິ່ງຕໍ່ຂັ້ນອື່ນຍ້າຍໄປກຸ່ມ "ຂັ້ນຕອນຕິດຕັ້ງ" ໃນ sidebar ແລ້ວ
  const TABS: TabItem<Tab>[] = [
    { key: "open", label: "ລໍຖ້າຈັດຊ່າງ", icon: Loader, count: counts.unassigned },
    { key: "cancelled", label: "ຍົກເລີກແລ້ວ", icon: Ban, count: counts.cancelled },
  ];

  return (
    <div className="w-full space-y-4">
      {/*
        ── ຖອດ "ເມນູຍ່ອຍ" ອອກ ──
        ແຖວປຸ່ມ (ຈັດງານຊ່າງ · ຮັບງານ · ໃບຂໍເບີກ · ສາງເບີກ · ຮັບອາໄຫຼ່ · ຕິດຕັ້ງ · ປິດງານ)
        ຄື **ເມນູອັນດຽວກັບ sidebar** ທຸກລາຍການ ແລະ sidebar ມີເລກຄິວຄ້າງໃຫ້ຢູ່ແລ້ວ
        (lib/nav-counts) ⇒ ເປັນທາງນຳທາງຊ້ອນກັນ 2 ບ່ອນ ທີ່ຕ້ອງດູແລໃຫ້ຕົງກັນ.
        ເຫຼືອໄວ້ພຽງ **ການກະທຳຫຼັກຂອງໜ້ານີ້** (ເປີດງານ) — ຢູ່ແຖວດຽວກັບຊື່ໜ້າ.
      */}
      <ListHeader
        title="ຕິດຕັ້ງເຄື່ອງ"
        scope={tech ? "ສະແດງສະເພາະງານຂອງທ່ານ" : "ສະແດງທຸກງານ"}
        total={jobs.total}
        page={page}
        pages={pages}
      >
        {installPermission.create && (
          <LinkButton href="/installations/new" tone="success" className="h-9 text-xs">
            <FilePlus2 className="size-4" />
            ເປີດງານຕິດຕັ້ງ
          </LinkButton>
        )}
      </ListHeader>

      <TabsAndSearch
        tabs={TABS}
        current={tab}
        tabHref={tabHref}
        q={q}
        sort={sort}
        dir={dir}
        hidden={tab !== "open" ? { tab } : {}}
      />

      {tab === "cancelled" && <CancelledSpares jobs={outstandingJobs} />}

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
                  <div className="flex items-center justify-center gap-2">
                    {cancelled ? (
                      <span className="text-[10px] text-slate-500" title={row.cancel_remark ?? ""}>
                        {row.cancel_code ?? "-"}
                      </span>
                    ) : (
                      <>
                        <Link
                          href={`/installations/${encodeURIComponent(row.code)}/print`}
                          target="_blank"
                          title="ພິມ"
                          className="text-[#D35400] hover:opacity-70"
                        >
                          <Printer className="size-4" />
                        </Link>
                        {row.stage !== 8 && installPermission.update && (
                          <>
                            <Link
                              href={`/installations/${encodeURIComponent(row.code)}/edit`}
                              title="ແກ້ໄຂ"
                              className="text-teal-600 hover:opacity-70"
                            >
                              <Pencil className="size-4" />
                            </Link>
                            <CancelJobButton code={row.code} />
                          </>
                        )}
                      </>
                    )}
                    {/* ງານທີ່ຍົກເລີກແລ້ວກໍ່ລຶບໄດ້ — ມັນຄືງານທີ່ຄ້າງໃນລະບົບຫຼາຍທີ່ສຸດ */}
                    {installPermission.delete && <InstallDeleteButton code={row.code} />}
                  </div>
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
