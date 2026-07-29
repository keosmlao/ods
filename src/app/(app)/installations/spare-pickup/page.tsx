import { syncErpDispatch } from "@/lib/erp-dispatch";
import { techFilter } from "@/app/actions/installation";
import { LinkPending } from "@/components/link-pending";
import { PackageCheck } from "lucide-react";
import Link from "next/link";
import {
  DocCell,
  INSTALL_DOC_COLUMN,
  INSTALL_DOC_SEARCH,
  INSTALL_DOC_SORT_SQL,
  INSTALL_PLAIN_COLUMNS_NO_STATUS,
  INSTALL_SORTABLE_COLUMNS,
  InstallCells,
  InstallTableHead,
  ListHeader,
  PAGE_SIZE,
  Pager,
  SearchBar,
  TableShell,
  fetchInstallDocRows,
  installOrderBy,
  readParams,
  type InstallDocRow,
  type ListSearchParams,
} from "../shared";

/**
 * ຊ່າງຮັບອາໄຫຼ່ຂອງງານຕິດຕັ້ງ (PISP, trans_flag 166).
 * ຖອດແບບຈາກ ods: /home_rc_spare (tech_reg_install.py) — ອອກແບບໃໝ່ ໃຫ້ຄືກັນກັບໜ້າ /checking.
 * ods ຕໍ່ session name ເຂົ້າ SQL ໂດຍກົງ (tech_reg_install.py:355) — ບ່ອນນີ້ໃຊ້ parameter.
 *
 * ໝາຍເຫດ: ຕາຕະລາງ "ລາຍການຮັບອາໄຫຼ່ສຳເລັດ" ຖືກຕັດອອກ — ໜ້າວຽກສະແດງແຕ່ສິ່ງທີ່ຍັງຄ້າງ,
 * ປະຫວັດການຮັບອາໄຫຼ່ເບິ່ງໄດ້ຢູ່ /reports/job-dispatch ແລະ /reports/stock.
 */
export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<ListSearchParams> };

/**
 * ຈັດແຖວໃບເບີກໃຫ້ໃບຂອງ**ງານດຽວກັນຢູ່ຕິດກັນ** ໂດຍຮັກສາລຳດັບເດີມ (ອີງງານທີ່ໂຜ່ກ່ອນ).
 * ຄືນເປັນ array ຂອງກຸ່ມ [ [docA1, docA2...], [docB1...] ] — ໃບທຳອິດຂອງກຸ່ມ = ໃບຫຼັກ.
 */
function groupByJob(rows: InstallDocRow[]): InstallDocRow[][] {
  const groups: InstallDocRow[][] = [];
  const at = new Map<string, number>();
  for (const row of rows) {
    const g = at.get(row.code);
    if (g === undefined) {
      at.set(row.code, groups.length);
      groups.push([row]);
    } else {
      groups[g].push(row);
    }
  }
  return groups;
}

/**
 * ໃບເບີກ SWC (56) ທີ່ຊ່າງຍັງບໍ່ທັນມາຮັບ (ຍັງບໍ່ມີ PISP ອ້າງອີງ) — ອີງ **ເອກະສານ** ຢ່າງດຽວ (B4/B7).
 *
 * ກ່ອນແກ້ ໜ້ານີ້ຍັງກອງດ້ວຍ `a.used_spare = 1`, `a.reg_start is not null` ແລະ ຮຽກຮ້ອງໃຫ້ມີແຖວ
 * tb_used_spare ທີ່ reg_finish notnull / pick_finish null. ສາມເງື່ອນໄຂນັ້ນລ້ວນອີງຄ່າທີ່ **ຊິດອອກ
 * ຈາກຄວາມຈິງໄດ້**: INST-6883 ແລະ INST-6892 ມີ used_spare=0 (ທຸງຖືກປັດລົງພາຍຫຼັງ) ທັງທີ່ສາງເບີກ
 * ອາໄຫຼ່ອອກໄປແລ້ວ ⇒ ໃບເບີກ 9 ໃບຂອງສອງງານນີ້ **ບໍ່ປາກົດຢູ່ໜ້າໃດເລີຍ** ແລະ ຊ່າງເຊັນຮັບບໍ່ໄດ້.
 * ດຽວນີ້ໃຊ້ນິຍາມດຽວກັນກັບ savePickSpare (ໃບເບີກຂອງງານທີ່ຍັງບໍ່ປິດ/ບໍ່ຍົກເລີກ ແລະ ຍັງບໍ່ມີ PISP)
 * ⇒ ໜ້າ ແລະ ການ stamp ຂັ້ນ ບໍ່ມີວັນຂັດກັນ ແລະ ໃບເບີກທຸກໃບມີບ່ອນຮັບສະເໝີ.
 *
 * ຜົນຕໍ່ຈຳນວນແຖວ: 0 → 9 (ໃບເບີກຈິງທີ່ຖືກເຊື່ອງໄວ້ຂອງ INST-6883 = 4 ໃບ, INST-6892 = 5 ໃບ).
 */
const FROM = `from ic_trans ic
  join ods_tb_install a on a.code = ic.product_code
  left join ar_customer c on c.code = a.cust_code`;
const WHERE = `ic.trans_flag = 56 and ic.job_type = 'install'
  and a.cancel_date is null and a.job_finish is null
  and ic.doc_no not in (select doc_ref from ic_trans where trans_flag = 166 and doc_ref is not null)`;

export default async function SparePickupPage({ searchParams }: Props) {
  // ດຶງໃບເບີກທີ່ສາງອອກໃນ ERP ກັບມາກ່ອນ ⇒ ຄິວທີ່ເຫັນເປັນຄວາມຈິງລ້າສຸດ (lib/erp-dispatch)
  await syncErpDispatch();

  const tech = await techFilter();
  const raw = await searchParams;
  const { q, page, sort, dir } = readParams(raw);

  const params: (string | number)[] = [];
  const pendingParams: (string | number)[] = [];
  const where = [WHERE];
  const pendingWhere = [
    `ic.trans_flag = 122 and ic.job_type = 'install'
     and a.cancel_date is null and a.job_finish is null
     and exists (
       select 1 from ic_trans_detail pending_line
       where pending_line.doc_no = ic.doc_no
         and pending_line.trans_flag = 122
         and pending_line.status = 0
     )`,
  ];
  if (tech) {
    params.push(tech);
    where.push(`a.tech_code = $${params.length}`);
    pendingParams.push(tech);
    pendingWhere.push(`a.tech_code = $${pendingParams.length}`);
  }
  if (q) {
    params.push(`%${q}%`);
    where.push(INSTALL_DOC_SEARCH.replaceAll("$Q", `$${params.length}`));
    pendingParams.push(`%${q}%`);
    pendingWhere.push(INSTALL_DOC_SEARCH.replaceAll("$Q", `$${pendingParams.length}`));
  }

  const [list, pendingWarehouse] = await Promise.all([
    fetchInstallDocRows<InstallDocRow>({
      from: FROM,
      where: where.join(" and "),
      params,
      // ຄ້າງນັບຈາກເວລາທີ່ສາງເບີກອອກ (reg_finish)
      orderBy: installOrderBy(sort, dir, "a.reg_finish", INSTALL_DOC_SORT_SQL),
      page,
    }),
    fetchInstallDocRows<InstallDocRow>({
      from: FROM,
      where: pendingWhere.join(" and "),
      params: pendingParams,
      orderBy: "coalesce(ic.create_date_time_now, ic.doc_date) asc nulls last",
      page: 1,
    }),
  ]);

  const pages = Math.max(1, Math.ceil(list.total / PAGE_SIZE));
  const base = (): Record<string, string> => (q ? { q } : {});
  const sortHref = (key: string, nextDir: "asc" | "desc") =>
    `/installations/spare-pickup?${new URLSearchParams({ ...base(), sort: key, dir: nextDir })}`;
  const pageHref = (n: number) =>
    `/installations/spare-pickup?${new URLSearchParams({ ...base(), sort, dir, ...(n > 1 && { page: String(n) }) })}`;

  return (
    <div className="w-full space-y-4">
      <ListHeader
        title="ຮັບອາໄຫຼ່ (ຕິດຕັ້ງ)"
        scope={`ລາຍການລໍຖ້າຮັບອາໄຫຼ່ · ${tech ? "ສະແດງສະເພາະງານຂອງທ່ານ" : "ສະແດງທຸກງານ"}`}
        total={list.total}
        page={page}
        pages={pages}
      />

      <SearchBar q={q} sort={sort} dir={dir} placeholder="ຄົ້ນຫາ ເລກທີເບີກ, ລະຫັດຕິດຕັ້ງ, ລູກຄ້າ, ຊ່າງ, ລາຍການ..." />

      {pendingWarehouse.total > 0 && (
        <section className="space-y-2">
          <div className="flex items-center justify-between gap-3 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <p className="font-semibold">
              ລໍສາງ ERP ເບີກອາໄຫຼ່
              <span className="ml-2 rounded-full bg-amber-200 px-2 py-0.5 text-xs">{pendingWarehouse.total}</span>
            </p>
            <span className="text-xs">ຍັງບໍ່ສາມາດກົດຮັບໄດ້</span>
          </div>
          <TableShell total={pendingWarehouse.total} minWidth={1450}>
            <InstallTableHead
              columns={INSTALL_SORTABLE_COLUMNS}
              plain={INSTALL_PLAIN_COLUMNS_NO_STATUS}
              trailing={[{ ...INSTALL_DOC_COLUMN, label: "ເລກທີຂໍເບີກ" }]}
              sort={sort}
              dir={dir}
              sortHref={sortHref}
            />
            <tbody>
              {groupByJob(pendingWarehouse.rows).map((docs) =>
                docs.map((row, index) => (
                  <tr key={row.doc_no} className="border-b border-amber-100 bg-amber-50/30">
                    {index === 0 ? (
                      <InstallCells row={row} timeLabel="ວັນ/ເວລາຂໍເບີກ" showStatus={false} />
                    ) : (
                      <td colSpan={7} className="py-2 pl-10 text-xs text-slate-400">
                        ↳ ໃບຂໍເບີກເພີ່ມຂອງ <span className="font-semibold">{row.code}</span>
                      </td>
                    )}
                    <DocCell row={row} />
                    <td className="whitespace-nowrap px-3 py-2.5 text-center">
                      <span className="rounded-lg bg-amber-100 px-3 py-1.5 text-xs font-semibold text-amber-800">
                        ລໍສາງເບີກ
                      </span>
                    </td>
                  </tr>
                )),
              )}
            </tbody>
          </TableShell>
          {pendingWarehouse.total > PAGE_SIZE && (
            <p className="text-right text-xs text-slate-400">
              ສະແດງ {PAGE_SIZE} ລາຍການທຳອິດ — ໃຊ້ຊ່ອງຄົ້ນຫາເພື່ອຫາ Job
            </p>
          )}
        </section>
      )}

      <TableShell total={list.total} minWidth={1450}>
        <InstallTableHead
          columns={INSTALL_SORTABLE_COLUMNS}
          plain={INSTALL_PLAIN_COLUMNS_NO_STATUS}
          trailing={[{ ...INSTALL_DOC_COLUMN, label: "ເລກທີເບີກ" }]}
          sort={sort}
          dir={dir}
          sortHref={sortHref}
        />
        {/*
          ── ຈັດກຸ່ມຕາມງານ ──
          ໃບເບີກ SWC ອີງ **ເອກະສານ** (1 ງານ ມີໄດ້ຫຼາຍໃບ — INST-6892 ມີ 5 ໃບ). ແຕ່ກ່ອນ
          ຂໍ້ມູນງານຊ້ຳທຸກແຖວ ⇒ ເບິ່ງຄືລາຍການຊ້ຳ. ດຽວນີ້ສະແດງຂໍ້ມູນງານ **ຄັ້ງດຽວ** ຢູ່ໃບທຳອິດ,
          ໃບເບີກທີ່ເຫຼືອຫຍໍ້ລົງ (↳) ຕິດຢູ່ໃຕ້ — ແຕ່ລະໃບຍັງກົດຮັບໄດ້ຄືເກົ່າ (ບໍ່ປ່ຽນ flow ຮັບ).
        */}
        <tbody>
          {groupByJob(list.rows).map((docs) =>
            docs.map((row, i) => {
              const first = i === 0;
              const cellBg = first ? "" : "bg-slate-50/60";
              return (
                <tr
                  key={row.doc_no}
                  className={`hover:bg-slate-50 ${first ? "border-t-2 border-slate-200" : "border-t border-dashed border-slate-100"}`}
                >
                  {first ? (
                    <InstallCells row={row} timeLabel="ວັນ/ເວລາເບີກ" showStatus={false} />
                  ) : (
                    <td colSpan={7} className={`py-2 pl-10 text-xs text-slate-400 ${cellBg}`}>
                      ↳ ໃບເບີກເພີ່ມຂອງ <span className="font-semibold text-slate-500">{row.code}</span>
                    </td>
                  )}
                  <DocCell row={row} />
                  <td className={`whitespace-nowrap px-3 py-2.5 text-center ${cellBg}`}>
                    <Link
                      href={`/installations/spare-pickup/${encodeURIComponent(row.doc_no)}`}
                      className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-teal-600 px-3 text-xs font-semibold text-white hover:bg-teal-700"
                    >
                      <PackageCheck className="size-3.5" />
                      ຮັບອາໄຫຼ່
                      <LinkPending className="size-3" />
                    </Link>
                  </td>
                </tr>
              );
            }),
          )}
        </tbody>
      </TableShell>

      <Pager page={page} pages={pages} total={list.total} pageHref={pageHref} />
    </div>
  );
}
