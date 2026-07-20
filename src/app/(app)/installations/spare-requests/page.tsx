import { techFilter } from "@/app/actions/installation";
import { LinkPending } from "@/components/link-pending";
import { query } from "@/lib/db";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getLocale } from "@/lib/i18n/locale";
import { installStageIs } from "@/lib/install-stage";
import { PackagePlus } from "lucide-react";
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
  SearchBar,
  TableShell,
  fetchInstallRows,
  installOrderBy,
  readParams,
  type InstallRow,
  type ListSearchParams,
} from "../shared";

/**
 * ຖອດແບບຈາກ ods: /home_in_request (tech_reg_install.py) — ອອກແບບໃໝ່ ໃຫ້ຄືກັນກັບໜ້າ /checking.
 * ods ຕໍ່ session name ເຂົ້າ SQL ໂດຍກົງ — ບ່ອນນີ້ໃຊ້ parameter.
 * ໜ້ານີ້ມີຄິວດຽວ: ງານແອທີ່ຊ່າງຮັບແລ້ວ ແຕ່ຍັງບໍ່ສ້າງໃບຂໍເບີກ.
 * ຫຼັງສົ່ງຄຳຂໍ ງານຈະໄປເມນູ "ລໍຖ້າຮັບອາໄຫຼ່ຈາກການເບີກ" ທັນທີ.
 */
export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<ListSearchParams> };

/**
 * ງານທີ່ໃຊ້ອາໄຫຼ່ ແຕ່ຍັງບໍ່ທັນຂໍເບີກ — **ຊ່າງຕ້ອງຮັບງານກ່ອນ** (B2).
 *
 * ກ່ອນແກ້ ໜ້ານີ້ບໍ່ໄດ້ຮຽກຮ້ອງ tech_confirm ເລີຍ ⇒ ຂໍເບີກໄດ້ກ່ອນຊ່າງຮັບງານ, reg_start ຖືກ set,
 * ແລ້ວງານກໍ່ຫາຍອອກຈາກໜ້າ /installations/accept (ທັງສອງແທັບກອງ reg_start is null) ⇒
 * tech_confirm ບໍ່ມີວັນຖືກ set ໄດ້ອີກ ⇒ /installations/work ບໍ່ສະແດງ ⇒ ງານຕາຍຖາວອນ
 * (ຫຼັງສາງເບີກແລ້ວ ລຶບໃບຂໍເບີກກໍ່ບໍ່ໄດ້). saveSpareRequest ບັງຄັບກົດເກນນີ້ຢູ່ຝັ່ງ server ນຳ.
 * ຈຳນວນແຖວມື້ນີ້ບໍ່ປ່ຽນ (0 → 0).
 */
const WAIT_WHERE = installStageIs(2);

/**
 * ງານທີ່ **ໃຊ້ອາໄຫຼ່ ແລະ ຍັງບໍ່ຂໍເບີກ ແຕ່ຍັງບໍ່ພ້ອມ** — ຄ້າງຢູ່ຂັ້ນກ່ອນໜ້າ.
 * ບໍ່ບອກ = ຄິວຂຶ້ນ 0 ແລ້ວຄົນເຂົ້າໃຈວ່າ "ງານແອທີ່ຫາກໍ່ເປີດຫາຍໄປໃສ".
 */
const NOT_READY = `a.reg_start is null and a.used_spare = 1 and a.cancel_date is null
  and a.job_finish is null and a.tech_confirm is null`;

async function getBlockedCounts(tech: string | null) {
  const params = tech ? [tech] : [];
  const mine = tech ? "and a.tech_code = $1" : "";
  const blocked = await query<{ unassigned: number; unaccepted: number }>(
    `select count(*) filter (where coalesce(a.tech_code,'') = '')::int unassigned,
        count(*) filter (where coalesce(a.tech_code,'') <> '')::int unaccepted
      from ods_tb_install a where ${NOT_READY} ${mine}`,
    params,
  );
  return {
    unassigned: blocked.rows[0]?.unassigned ?? 0,
    unaccepted: blocked.rows[0]?.unaccepted ?? 0,
  };
}

export default async function SpareRequestsPage({ searchParams }: Props) {
  const t = (await getDictionary(await getLocale())).installSpareRequests;
  const tech = await techFilter();
  const raw = await searchParams;
  const { q, page, sort, dir } = readParams(raw);

  const params: (string | number)[] = [];
  const where = [WAIT_WHERE];
  if (tech) {
    params.push(tech);
    where.push(`a.tech_code = $${params.length}`);
  }
  if (q) {
    params.push(`%${q}%`);
    where.push(INSTALL_SEARCH.replaceAll("$Q", `$${params.length}`));
  }
  const filter = where.join(" and ");

  const [counts, list] = await Promise.all([
    getBlockedCounts(tech),
    fetchInstallRows<InstallRow>({
      where: filter,
      params,
      orderBy: installOrderBy(sort, dir, "a.time_register"),
      page,
    }),
  ]);

  const pages = Math.max(1, Math.ceil(list.total / PAGE_SIZE));
  const base = () => ({ ...(q && { q }) });
  const sortHref = (key: string, nextDir: "asc" | "desc") =>
    `/installations/spare-requests?${new URLSearchParams({ ...base(), sort: key, dir: nextDir })}`;
  const pageHref = (n: number) =>
    `/installations/spare-requests?${new URLSearchParams({ ...base(), sort, dir, ...(n > 1 && { page: String(n) }) })}`;

  return (
    <div className="w-full space-y-4">
      <ListHeader
        title={t.title}
        scope={tech ? t.scopeMine : t.scopeAll}
        total={list.total}
        page={page}
        pages={pages}
      />

      <SearchBar q={q} sort={sort} dir={dir} placeholder={t.searchPlaceholder} />

      {/*
        ── ບອກວ່າງານທີ່ "ຫາຍໄປ" ຄ້າງຢູ່ໃສ ──
        ງານທີ່ໃຊ້ອາໄຫຼ່ (ແອ) ຈະຂຶ້ນຄິວນີ້ **ຕໍ່ເມື່ອຊ່າງກົດຮັບງານແລ້ວ** (ກັນໃບເບີກ
        ອອກໃນນາມຊ່າງທີ່ຍັງບໍ່ໄດ້ຮັບງານ ແລ້ວລາວປະຕິເສດ). ບໍ່ບອກ = ຄິວ 0 ແລ້ວຄົນຫາງານບໍ່ພົບ.
      */}
      {counts.unassigned + counts.unaccepted > 0 && (
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-800">
          {t.blockedNotice}
          {counts.unassigned > 0 && (
            <Link href="/installations/assign" className="underline">
              {counts.unassigned} {t.jobsNotAssigned}
            </Link>
          )}
          {counts.unaccepted > 0 && (
            <Link href="/installations/accept" className="underline">
              {counts.unaccepted} {t.jobsNotAccepted}
            </Link>
          )}
          <span className="font-normal">— {t.mustAcceptFirst}</span>
        </p>
      )}

      <TableShell total={list.total} minWidth={1300}>
        <InstallTableHead
          columns={INSTALL_SORTABLE_COLUMNS}
          plain={INSTALL_PLAIN_COLUMNS}
          sort={sort}
          dir={dir}
          sortHref={sortHref}
        />
        <tbody>
          {list.rows.map((row) => (
            <tr key={row.code} className="border-b border-slate-100 hover:bg-slate-50">
              <InstallCells row={row} timeLabel={t.timeOpenJob} />
              <td className="whitespace-nowrap px-3 py-2.5 text-center">
                <Link
                  href={`/installations/spare-requests/${encodeURIComponent(row.code)}`}
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-teal-600 px-3 text-xs font-semibold text-white hover:bg-teal-700"
                >
                  <PackagePlus className="size-3.5" />
                  {t.request}
                  <LinkPending className="size-3" />
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </TableShell>

      <Pager page={page} pages={pages} total={list.total} pageHref={pageHref} />
    </div>
  );
}
