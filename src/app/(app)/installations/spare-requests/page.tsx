import { syncErpDispatch } from "@/lib/erp-dispatch";
import { deleteSpareRequest, techFilter } from "@/app/actions/installation";
import { DeleteSpareRequestButton } from "@/components/installation/spare-request-buttons";
import { LinkPending } from "@/components/link-pending";
import { query } from "@/lib/db";
import { Eye, PackagePlus } from "lucide-react";
import Link from "next/link";
import {
  DocCell,
  INSTALL_DOC_COLUMN,
  INSTALL_DOC_SEARCH,
  INSTALL_DOC_SORT_SQL,
  INSTALL_PLAIN_COLUMNS,
  INSTALL_PLAIN_COLUMNS_NO_STATUS,
  INSTALL_SEARCH,
  INSTALL_SORTABLE_COLUMNS,
  InstallCells,
  InstallTableHead,
  ListHeader,
  PAGE_SIZE,
  Pager,
  SearchBar,
  TableShell,
  fetchInstallDocRows,
  fetchInstallRows,
  installOrderBy,
  readParams,
  type InstallDocRow,
  type InstallRow,
  type ListSearchParams,
} from "../shared";

/**
 * ຖອດແບບຈາກ ods: /home_in_request (tech_reg_install.py) — ອອກແບບໃໝ່ ໃຫ້ຄືກັນກັບໜ້າ /checking.
 * ods ຕໍ່ session name ເຂົ້າ SQL ໂດຍກົງ — ບ່ອນນີ້ໃຊ້ parameter.
 *
 * 2 ແທັບ ລ້ວນເປັນວຽກທີ່ຍັງຄ້າງ:
 *   ລໍຖ້າຂໍເບີກ  — ງານທີ່ໃຊ້ອາໄຫຼ່ ແຕ່ຊ່າງຍັງບໍ່ທັນສ້າງໃບຂໍເບີກ (SION)
 *   ກຳລັງຂໍເບີກ — ໃບ SION ທີ່ສ້າງແລ້ວ ຂອງງານທີ່ຍັງບໍ່ທັນປິດ (ods ບໍ່ໄດ້ກັນງານທີ່ປິດແລ້ວອອກ ⇒ 2,000+ ແຖວທີ່ບໍ່ມີຫຍັງໃຫ້ເຮັດ)
 */
export const dynamic = "force-dynamic";

type Tab = "waiting" | "requested";
type Props = { searchParams: Promise<ListSearchParams> };

type ReqRow = InstallDocRow & { reg_finished: number };

/**
 * ງານທີ່ໃຊ້ອາໄຫຼ່ ແຕ່ຍັງບໍ່ທັນຂໍເບີກ — **ຊ່າງຕ້ອງຮັບງານກ່ອນ** (B2).
 *
 * ກ່ອນແກ້ ໜ້ານີ້ບໍ່ໄດ້ຮຽກຮ້ອງ tech_confirm ເລີຍ ⇒ ຂໍເບີກໄດ້ກ່ອນຊ່າງຮັບງານ, reg_start ຖືກ set,
 * ແລ້ວງານກໍ່ຫາຍອອກຈາກໜ້າ /installations/accept (ທັງສອງແທັບກອງ reg_start is null) ⇒
 * tech_confirm ບໍ່ມີວັນຖືກ set ໄດ້ອີກ ⇒ /installations/work ບໍ່ສະແດງ ⇒ ງານຕາຍຖາວອນ
 * (ຫຼັງສາງເບີກແລ້ວ ລຶບໃບຂໍເບີກກໍ່ບໍ່ໄດ້). saveSpareRequest ບັງຄັບກົດເກນນີ້ຢູ່ຝັ່ງ server ນຳ.
 * ຈຳນວນແຖວມື້ນີ້ບໍ່ປ່ຽນ (0 → 0).
 */
const WAIT_WHERE = `a.reg_start is null and a.used_spare = 1 and a.cancel_date is null
  and a.job_finish is null and a.tech_confirm is not null`;

/** ໃບ SION ຂອງງານທີ່ຍັງບໍ່ທັນປິດ — left join ຈຶ່ງໄດ້ຈຳນວນແຖວຄືເກົ່າ (ມີໃບເກົ່າທີ່ຫາງານຄູ່ບໍ່ພົບ) */
const REQ_FROM = `from ic_trans ic
  left join ods_tb_install a on a.code = ic.product_code
  left join ar_customer c on c.code = a.cust_code`;
const REQ_WHERE = "ic.trans_flag = 122 and ic.job_type = 'install' and a.job_finish is null";

/**
 * ງານທີ່ **ໃຊ້ອາໄຫຼ່ ແລະ ຍັງບໍ່ຂໍເບີກ ແຕ່ຍັງບໍ່ພ້ອມ** — ຄ້າງຢູ່ຂັ້ນກ່ອນໜ້າ.
 * ບໍ່ບອກ = ຄິວຂຶ້ນ 0 ແລ້ວຄົນເຂົ້າໃຈວ່າ "ງານແອທີ່ຫາກໍ່ເປີດຫາຍໄປໃສ".
 */
const NOT_READY = `a.reg_start is null and a.used_spare = 1 and a.cancel_date is null
  and a.job_finish is null and a.tech_confirm is null`;

async function getCounts(tech: string | null) {
  const params = tech ? [tech] : [];
  const mine = tech ? "and a.tech_code = $1" : "";
  const [waiting, requested, blocked] = await Promise.all([
    query<{ total: number }>(
      `select count(*)::int total from ods_tb_install a where ${WAIT_WHERE} ${mine}`,
      params,
    ),
    query<{ total: number }>(`select count(*)::int total ${REQ_FROM} where ${REQ_WHERE} ${mine}`, params),
    query<{ unassigned: number; unaccepted: number }>(
      `select count(*) filter (where coalesce(a.tech_code,'') = '')::int unassigned,
          count(*) filter (where coalesce(a.tech_code,'') <> '')::int unaccepted
        from ods_tb_install a where ${NOT_READY} ${mine}`,
      params,
    ),
  ]);
  return {
    waiting: waiting.rows[0]?.total ?? 0,
    requested: requested.rows[0]?.total ?? 0,
    unassigned: blocked.rows[0]?.unassigned ?? 0,
    unaccepted: blocked.rows[0]?.unaccepted ?? 0,
  };
}

export default async function SpareRequestsPage({ searchParams }: Props) {
  // ດຶງໃບເບີກທີ່ສາງອອກໃນ ERP ກັບມາກ່ອນ ⇒ ໃບທີ່ເບີກແລ້ວຫຼຸດອອກຈາກຄິວເອງ (lib/erp-dispatch)
  await syncErpDispatch();

  const tech = await techFilter();
  const raw = await searchParams;
  const tab: Tab = raw.tab === "requested" ? "requested" : "waiting";
  const { q, page, sort, dir } = readParams(raw);

  const params: (string | number)[] = [];
  const where = [tab === "waiting" ? WAIT_WHERE : REQ_WHERE];
  if (tech) {
    params.push(tech);
    where.push(`a.tech_code = $${params.length}`);
  }
  if (q) {
    params.push(`%${q}%`);
    where.push((tab === "waiting" ? INSTALL_SEARCH : INSTALL_DOC_SEARCH).replaceAll("$Q", `$${params.length}`));
  }
  const filter = where.join(" and ");

  const [counts, list] = await Promise.all([
    getCounts(tech),
    tab === "waiting"
      ? fetchInstallRows<InstallRow>({
          where: filter,
          params,
          orderBy: installOrderBy(sort, dir, "a.time_register"),
          page,
        })
      : fetchInstallDocRows<ReqRow>({
          from: REQ_FROM,
          where: filter,
          params,
          // ຄ້າງນັບຈາກເວລາຂໍເບີກ (reg_start)
          orderBy: installOrderBy(sort, dir, "a.reg_start", INSTALL_DOC_SORT_SQL),
          page,
          extraColumns: "case when a.reg_finish is not null then 1 else 0 end reg_finished",
        }),
  ]);

  const pages = Math.max(1, Math.ceil(list.total / PAGE_SIZE));
  const base = () => ({ ...(tab !== "waiting" && { tab }), ...(q && { q }) });
  const sortHref = (key: string, nextDir: "asc" | "desc") =>
    `/installations/spare-requests?${new URLSearchParams({ ...base(), sort: key, dir: nextDir })}`;
  const pageHref = (n: number) =>
    `/installations/spare-requests?${new URLSearchParams({ ...base(), sort, dir, ...(n > 1 && { page: String(n) }) })}`;

  const rows = list.rows as (InstallRow | ReqRow)[];

  return (
    <div className="w-full space-y-4">
      {/* tab ມາຈາກ **ເມນູ sidebar** (?tab=waiting/requested) — ບໍ່ມີ tab ໃນໜ້າ (ຍ້າຍໄປ sidebar) */}
      <ListHeader
        title={tab === "waiting" ? "ລໍຖ້າຂໍເບີກ (ຕິດຕັ້ງ)" : "ກຳລັງຂໍເບີກອາໄຫຼ່ (ຕິດຕັ້ງ)"}
        scope={tech ? "ສະແດງສະເພາະງານຂອງທ່ານ" : "ສະແດງທຸກງານ"}
        total={list.total}
        page={page}
        pages={pages}
      />

      <SearchBar q={q} sort={sort} dir={dir} placeholder="ຄົ້ນຫາ ເລກທີ, ເລກບິນ, ລູກຄ້າ, ຊ່າງ, ລາຍການ..." />

      {/*
        ── ບອກວ່າງານທີ່ "ຫາຍໄປ" ຄ້າງຢູ່ໃສ ──
        ງານທີ່ໃຊ້ອາໄຫຼ່ (ແອ) ຈະຂຶ້ນຄິວນີ້ **ຕໍ່ເມື່ອຊ່າງກົດຮັບງານແລ້ວ** (ກັນໃບເບີກ
        ອອກໃນນາມຊ່າງທີ່ຍັງບໍ່ໄດ້ຮັບງານ ແລ້ວລາວປະຕິເສດ). ບໍ່ບອກ = ຄິວ 0 ແລ້ວຄົນຫາງານບໍ່ພົບ.
      */}
      {tab === "waiting" && counts.unassigned + counts.unaccepted > 0 && (
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-800">
          ຍັງມີງານທີ່ໃຊ້ອາໄຫຼ່ ແຕ່ຍັງບໍ່ຂຶ້ນຄິວນີ້:
          {counts.unassigned > 0 && (
            <Link href="/installations/assign" className="underline">
              {counts.unassigned} ງານ ຍັງບໍ່ໄດ້ຈັດຊ່າງ
            </Link>
          )}
          {counts.unaccepted > 0 && (
            <Link href="/installations/accept" className="underline">
              {counts.unaccepted} ງານ ຊ່າງຍັງບໍ່ກົດຮັບງານ
            </Link>
          )}
          <span className="font-normal">— ຊ່າງຕ້ອງຮັບງານກ່ອນ ຈຶ່ງຂໍເບີກອາໄຫຼ່ໄດ້</span>
        </p>
      )}

      <TableShell total={list.total} minWidth={tab === "waiting" ? 1300 : 1450}>
        <InstallTableHead
          columns={INSTALL_SORTABLE_COLUMNS}
          plain={tab === "requested" ? INSTALL_PLAIN_COLUMNS_NO_STATUS : INSTALL_PLAIN_COLUMNS}
          trailing={tab === "requested" ? [{ ...INSTALL_DOC_COLUMN, label: "ເລກຂໍເບີກ" }] : []}
          sort={sort}
          dir={dir}
          sortHref={sortHref}
        />
        <tbody>
          {rows.map((row) => {
            const req = "doc_no" in row ? row : null;
            return (
              <tr key={req ? req.doc_no : row.code} className="border-b border-slate-100 hover:bg-slate-50">
                <InstallCells row={row} timeLabel={req ? "ວັນ/ເວລາຂໍເບີກ" : "ວັນ/ເວລາເປີດງານ"} showStatus={tab !== "requested"} />
                {req && <DocCell row={req} />}
                <td className="whitespace-nowrap px-3 py-2.5 text-center">
                  {req ? (
                    <span className="flex items-center justify-center gap-2">
                      <Link
                        href={`/installations/spare-requests/view/${encodeURIComponent(req.doc_no)}`}
                        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        <Eye className="size-3.5" />
                        ເບິ່ງ
                        <LinkPending className="size-3" />
                      </Link>
                      {/* ລົບໄດ້ສະເພາະໃບທີ່ສາງຍັງບໍ່ທັນເບີກ */}
                      {req.reg_finished === 0 && (
                        <DeleteSpareRequestButton docNo={req.doc_no} code={req.code} action={deleteSpareRequest} />
                      )}
                    </span>
                  ) : (
                    <Link
                      href={`/installations/spare-requests/${encodeURIComponent(row.code)}`}
                      className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-teal-600 px-3 text-xs font-semibold text-white hover:bg-teal-700"
                    >
                      <PackagePlus className="size-3.5" />
                      ຂໍເບີກ
                      <LinkPending className="size-3" />
                    </Link>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </TableShell>

      <Pager page={page} pages={pages} total={list.total} pageHref={pageHref} />
    </div>
  );
}
