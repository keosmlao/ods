import { syncErpDispatch } from "@/lib/erp-dispatch";
import { LinkPending } from "@/components/link-pending";
import { PackageMinus } from "lucide-react";
import Link from "next/link";
import {
  DocCell,
  INSTALL_DOC_COLUMN,
  INSTALL_DOC_SEARCH,
  INSTALL_DOC_SORT_SQL,
  INSTALL_PLAIN_COLUMNS,
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
 * ສາງເບີກອາໄຫຼ່ໃຫ້ງານຕິດຕັ້ງ (SWC, trans_flag 56).
 * ຖອດແບບຈາກ ods: /showdisp_install + /save_dispatch_install (tech_install.py) — ອອກແບບໃໝ່
 * ໃຫ້ຄືກັນກັບໜ້າ /checking (ຄົ້ນຫາ, ຈັດຮຽງ, ແບ່ງໜ້າຢູ່ server, ຕົວນັບເວລາຄ້າງ).
 * ໃນ ods ໜ້ານີ້ຢູ່ໃນໂມດູນສາງ (spdispatch) — ບ່ອນນີ້ຢູ່ໃນວຽກຕິດຕັ້ງ ເພື່ອໃຫ້ຄົບຂັ້ນຕອນ SION → SWC → PISP.
 *
 * ໝາຍເຫດ: ຕາຕະລາງ "ລາຍການເບີກສຳເລັດ" ຖືກຕັດອອກ — ໜ້າວຽກສະແດງແຕ່ສິ່ງທີ່ຍັງຄ້າງ,
 * ປະຫວັດການເບີກເບິ່ງໄດ້ຢູ່ /reports/stock ແລະ /reports/job-dispatch.
 */
export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<ListSearchParams> };

/** ໃບ SION (122) ທີ່ຍັງບໍ່ທັນຖືກເບີກອອກເປັນ SWC (56) */
const FROM = `from ic_trans ic
  left join ods_tb_install a on a.code = ic.product_code
  left join ar_customer c on c.code = a.cust_code`;
const WHERE = `ic.trans_flag = 122 and ic.job_type = 'install' and a.reg_finish is null
  and ic.doc_no not in (select doc_ref from ic_trans where trans_flag = 56 and doc_ref is not null)`;

export default async function DispatchPage({ searchParams }: Props) {
  // ດຶງໃບເບີກທີ່ສາງອອກໃນ ERP ກັບມາກ່ອນ ⇒ ຄິວທີ່ເຫັນເປັນຄວາມຈິງລ້າສຸດ (lib/erp-dispatch)
  await syncErpDispatch();

  const raw = await searchParams;
  const { q, page, sort, dir } = readParams(raw);

  const params: (string | number)[] = [];
  const where = [WHERE];
  if (q) {
    params.push(`%${q}%`);
    where.push(INSTALL_DOC_SEARCH.replaceAll("$Q", `$${params.length}`));
  }

  const list = await fetchInstallDocRows<InstallDocRow>({
    from: FROM,
    where: where.join(" and "),
    params,
    // ຄ້າງນັບຈາກເວລາທີ່ຊ່າງຂໍເບີກ (reg_start)
    orderBy: installOrderBy(sort, dir, "a.reg_start", INSTALL_DOC_SORT_SQL),
    page,
  });

  const pages = Math.max(1, Math.ceil(list.total / PAGE_SIZE));
  const base = (): Record<string, string> => (q ? { q } : {});
  const sortHref = (key: string, nextDir: "asc" | "desc") =>
    `/installations/dispatch?${new URLSearchParams({ ...base(), sort: key, dir: nextDir })}`;
  const pageHref = (n: number) =>
    `/installations/dispatch?${new URLSearchParams({ ...base(), sort, dir, ...(n > 1 && { page: String(n) }) })}`;

  return (
    <div className="w-full space-y-4">
      <ListHeader
        title="ສາງເບີກອາໄຫຼ່ (ຕິດຕັ້ງ)"
        scope="ລາຍການລໍຖ້າສາງເບີກ"
        total={list.total}
        page={page}
        pages={pages}
      />

      <SearchBar q={q} sort={sort} dir={dir} placeholder="ຄົ້ນຫາ ເລກຂໍເບີກ, ລະຫັດຕິດຕັ້ງ, ລູກຄ້າ, ຊ່າງ, ລາຍການ..." />

      <TableShell total={list.total} minWidth={1450}>
        <InstallTableHead
          columns={INSTALL_SORTABLE_COLUMNS}
          plain={INSTALL_PLAIN_COLUMNS}
          trailing={[{ ...INSTALL_DOC_COLUMN, label: "ເລກຂໍເບີກ" }]}
          sort={sort}
          dir={dir}
          sortHref={sortHref}
        />
        <tbody>
          {list.rows.map((row) => (
            <tr key={row.doc_no} className="border-b border-slate-100 hover:bg-slate-50">
              <InstallCells row={row} timeLabel="ວັນ/ເວລາຂໍເບີກ" />
              <DocCell row={row} />
              <td className="whitespace-nowrap px-3 py-2.5 text-center">
                <Link
                  href={`/installations/dispatch/${encodeURIComponent(row.doc_no)}`}
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-teal-600 px-3 text-xs font-semibold text-white hover:bg-teal-700"
                >
                  <PackageMinus className="size-3.5" />
                  ເບີກ
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
