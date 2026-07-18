import { syncErpDispatch } from "@/lib/erp-dispatch";
import { techFilter } from "@/app/actions/installation";
import { LinkPending } from "@/components/link-pending";
import { query } from "@/lib/db";
import { installStageIs } from "@/lib/install-stage";
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
  const waitingWarehouse = await query<{ total: number }>(
    `select count(*)::int total from ods_tb_install a
      where ${installStageIs(3)} and a.reg_finish is null ${tech ? "and a.tech_code=$1" : ""}`,
    tech ? [tech] : [],
  );
  const raw = await searchParams;
  const { q, page, sort, dir } = readParams(raw);

  const params: (string | number)[] = [];
  const where = [WHERE];
  if (tech) {
    params.push(tech);
    where.push(`a.tech_code = $${params.length}`);
  }
  if (q) {
    params.push(`%${q}%`);
    where.push(INSTALL_DOC_SEARCH.replaceAll("$Q", `$${params.length}`));
  }

  const list = await fetchInstallDocRows<InstallDocRow>({
    from: FROM,
    where: where.join(" and "),
    params,
    // ຄ້າງນັບຈາກເວລາທີ່ສາງເບີກອອກ (reg_finish)
    orderBy: installOrderBy(sort, dir, "a.reg_finish", INSTALL_DOC_SORT_SQL),
    page,
  });

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

      {(waitingWarehouse.rows[0]?.total ?? 0) > 0 && (
        <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
          ມີ {waitingWarehouse.rows[0]?.total ?? 0} ງານທີ່ສົ່ງຄຳຂໍເບີກແລ້ວ ແລະກຳລັງລໍສາງ ERP ເບີກອາໄຫຼ່. ເມື່ອສາງເບີກແລ້ວຈະຂຶ້ນລາຍການໃຫ້ຊ່າງກົດຮັບດ້ານລຸ່ມ.
        </p>
      )}

      <SearchBar q={q} sort={sort} dir={dir} placeholder="ຄົ້ນຫາ ເລກທີເບີກ, ລະຫັດຕິດຕັ້ງ, ລູກຄ້າ, ຊ່າງ, ລາຍການ..." />

      <TableShell total={list.total} minWidth={1450}>
        <InstallTableHead
          columns={INSTALL_SORTABLE_COLUMNS}
          plain={INSTALL_PLAIN_COLUMNS_NO_STATUS}
          trailing={[{ ...INSTALL_DOC_COLUMN, label: "ເລກທີເບີກ" }]}
          sort={sort}
          dir={dir}
          sortHref={sortHref}
        />
        <tbody>
          {list.rows.map((row) => (
            <tr key={row.doc_no} className="border-b border-slate-100 hover:bg-slate-50">
              <InstallCells row={row} timeLabel="ວັນ/ເວລາເບີກ" showStatus={false} />
              <DocCell row={row} />
              <td className="whitespace-nowrap px-3 py-2.5 text-center">
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
          ))}
        </tbody>
      </TableShell>

      <Pager page={page} pages={pages} total={list.total} pageHref={pageHref} />
    </div>
  );
}
