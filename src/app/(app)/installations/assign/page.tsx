import { AssignTechButton } from "@/components/installation/assign-tech";
import { SlaChip } from "@/components/installation/sla-chip";
import { INSTALL_LEFT_SQL } from "@/lib/install-sla";
import { listTechnicians } from "@/lib/technicians";
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
  type InstallRow,
  type ListSearchParams,
} from "../shared";

/**
 * ຖອດແບບຈາກ ods: /assign_tech_install + /assign_tech_submit + /choose_new_tech (install_admin.py)
 * — ອອກແບບໃໝ່ ໃຫ້ຄືກັນກັບໜ້າ /checking (ຄົ້ນຫາ, ຈັດຮຽງ, ແບ່ງໜ້າຢູ່ server, ຕົວນັບເວລາຄ້າງ).
 * ຂັ້ນຂອງງານມາຈາກ @/lib/install-stage (ຂັ້ນ 0 = ລໍຖ້າຈັດຊ່າງ).
 */
export const dynamic = "force-dynamic";

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
 * ຄິວລໍຖ້າຊ່າງຮັບຢູ່ /installations/accept ເປັນໜ້າແຍກ; ໜ້ານີ້ບໍ່ມີ tab ຊ້ອນ.
 */
const WAIT_ASSIGN = { where: installStageIs(0), timeCol: "a.time_register" };

export default async function AssignPage({ searchParams }: Props) {
  const raw = await searchParams;
  /**
   * ── ຮຽງຕາມ **ນາລິກາ 24 ຊມ** ເປັນຄ່າຕັ້ງຕົ້ນ ──
   * ເມື່ອກ່ອນຮຽງຕາມ "ຄ້າງມາດົນ" ນັບຈາກເວລາເປີດງານ ⇒ ງານທີ່ບິນອອກກ່ອນ (ລູກຄ້າລໍດົນກວ່າ)
   * ອາດຢູ່ລຸ່ມສຸດ ຖ້າ CS ຫາກໍ່ເປີດໃບງານໃຫ້ມັນ. ດຽວນີ້ຮຽງດ້ວຍ **ເວລາທີ່ຍັງເຫຼືອ**
   * ⇒ ງານທີ່ເລີຍກຳນົດ/ໃກ້ໝົດ ຂຶ້ນເທິງສຸດ (ບິນເກົ່າທີ່ບໍ່ມີວັນທີ ຕົກລຸ່ມສຸດ).
   */
  const { q, page, sort, dir } = readParams(raw, "sla");

  const where = [WAIT_ASSIGN.where];
  const params: (string | number)[] = [];
  if (q) {
    params.push(`%${q}%`);
    where.push(INSTALL_SEARCH.replaceAll("$Q", `$${params.length}`));
  }

  const [jobs, techs] = await Promise.all([
    fetchInstallRows<Row>({
      where: where.join(" and "),
      params,
      orderBy: installOrderBy(sort, dir, WAIT_ASSIGN.timeCol),
      page,
      extraColumns: EXTRA,
    }),
    // ລາຍຊື່ຊ່າງ = ພະນັກງານ ERP ທີ່ role ສຸດທ້າຍເປັນຊ່າງ (ລວມຄົນທີ່ຜູ້ຈັດການ
    // ກຳນົດສິດເອງຢູ່ /manage/employees) — ບ່ອນດຽວຂອງລະບົບ (lib/technicians)
    listTechnicians(),
  ]);

  const pages = Math.max(1, Math.ceil(jobs.total / PAGE_SIZE));
  const base = () => ({ ...(q && { q }) });
  const sortHref = (key: string, nextDir: "asc" | "desc") =>
    `/installations/assign?${new URLSearchParams({ ...base(), sort: key, dir: nextDir })}`;
  const pageHref = (n: number) =>
    `/installations/assign?${new URLSearchParams({ ...base(), sort, dir, ...(n > 1 && { page: String(n) }) })}`;

  return (
    <div className="w-full space-y-4">
      <ListHeader
        title="ລໍຖ້າຈັດຊ່າງ"
        scope="ລາຍການລໍຖ້າຈັດຊ່າງງານຕິດຕັ້ງ"
        total={jobs.total}
        page={page}
        pages={pages}
      />

      <SearchBar q={q} sort={sort} dir={dir} />

      <TableShell total={jobs.total} minWidth={1350}>
        <InstallTableHead
          columns={INSTALL_SORTABLE_COLUMNS}
          plain={["24 ຊມ ຈາກບິນ", ...INSTALL_PLAIN_COLUMNS, "ຊ່າງກ່ອນໜ້ານີ້"]}
          sort={sort}
          dir={dir}
          sortHref={sortHref}
        />
        <tbody>
          {jobs.rows.map((row) => (
            <tr key={row.code} className="border-b border-slate-100 hover:bg-slate-50">
              <InstallCells row={row} timeLabel="ວັນ/ເວລາເປີດງານ" />
              {/* ນາລິກາ 24 ຊມ ນັບແຕ່ອອກບິນ — ຄໍຂວດອັນດັບ 1 ຢູ່ຂັ້ນນີ້ (44 ຊມ) */}
              <td className="whitespace-nowrap px-3 py-2.5 text-center">
                <SlaChip left={row.sla_left} />
              </td>
              <td className="whitespace-nowrap px-3 py-2.5 text-center">
                {row.tech_before || "-"}
              </td>
              <td className="whitespace-nowrap px-3 py-2.5 text-center">
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
              </td>
            </tr>
          ))}
        </tbody>
      </TableShell>

      <Pager page={page} pages={pages} total={jobs.total} pageHref={pageHref} />
    </div>
  );
}
