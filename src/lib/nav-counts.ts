import type { Session } from "@/lib/auth";
import { pipelineOf, repairStatuses } from "@/lib/dashboard-status";
import { query } from "@/lib/db";
import { installStageIs } from "@/lib/install-stage";
import { canAccess, roleOf } from "@/lib/roles";
import { ownJobsOnly } from "@/lib/scope";
import { STAGE_SQL } from "@/lib/stage";
import { LINE_STATUS, TRANS } from "@/lib/stock-constants";

/**
 * ຕົວເລກຄິວຂອງແຕ່ລະຂັ້ນສ້ອມ — ຄູ່ກັບກຸ່ມເມນູ "ສະຖານະງານສ້ອມ" (lib/navigation).
 *
 * ນັບຈາກ CTE `rst` (ຂັ້ນ + ຈຳນວນ, ສະແກນ tb_product ເທື່ອດຽວ) ⇒ ບໍ່ຕ້ອງຍິງ 11 subquery.
 * **ບໍ່ກອງຕາມຊ່າງ** ໂດຍເຈດຕະນາ: ໜ້າ /dashboard/status/repair/<slug> ສະແດງທຸກວຽກ
 * (ບໍ່ໃຊ້ ownJobsOnly) ⇒ ຕົວເລກຕ້ອງນັບທຸກວຽກຄືກັນ ຈຶ່ງບໍ່ຫຼົ້ນກັບແຖວທີ່ເຫັນ (ກົດເກນ ①).
 * key = href ຂອງລາຍການເມນູ; slug + ຂັ້ນ ມາຈາກ repairStatuses ບ່ອນດຽວ.
 */
const REPAIR_STAGE_COUNTS = pipelineOf(repairStatuses)
  .map(([slug, def]) => `coalesce((select n from rst where st = ${def.stage}), 0)::int as "/dashboard/status/repair/${slug}"`)
  .join(",\n          ");

/**
 * ຕົວເລກຄິວທີ່ຂຶ້ນຂ້າງລາຍການເມນູ.
 *
 * ── ເປັນຫຍັງຕ້ອງມີ ──
 * ເມນູມີ 51 ລາຍການ ແຕ່ບໍ່ມີສັນຍານໃດບອກວ່າອັນໃດມີວຽກຄ້າງ ⇒ ຄົນຕ້ອງກົດເຂົ້າໄປທຸກໜ້າ
 * ຈຶ່ງຮູ້. ຕົວເລກຢູ່ນີ້ບອກໃຫ້ຮູ້ກ່ອນກົດ.
 *
 * ── ກົດເກນ ──
 * ① ນັບດ້ວຍ **ເງື່ອນໄຂອັນດຽວກັບໜ້າປາຍທາງ** (ຂັ້ນໄດຈາກ lib/stage · lib/install-stage)
 *    ⇒ ຕົວເລກຂ້າງເມນູ ກັບ ຈຳນວນແຖວທີ່ເຫັນຕອນກົດເຂົ້າໄປ ບໍ່ມີທາງຫຼົ້ນກັນ.
 * ② **ຊ່າງເຫັນສະເພາະຂອງຕົນ** (ownJobsOnly) ຄືກັບທຸກໜ້າ.
 * ③ query ດຽວ — sidebar ຢູ່ໃນ layout ຂອງທຸກໜ້າ ⇒ ຈະຍິງຫຼາຍ query ບໍ່ໄດ້.
 * ④ ລົ້ມເຫຼວ = ບໍ່ມີຕົວເລກ (ບໍ່ແມ່ນໜ້າພັງ) — ເມນູສຳຄັນກວ່າຕົວເລກ.
 */
export type NavCounts = Record<string, number>;

export async function navCounts(session: Session | null): Promise<NavCounts> {
  if (!session) return {};
  const tech = ownJobsOnly(session);
  const role = roleOf(session);

  // ຊ່າງ: ຝັ່ງສ້ອມກອງດ້ວຍ emp_code · ຝັ່ງຕິດຕັ້ງດ້ວຍ tech_code (ຄືທຸກໜ້າ)
  const mineRepair = tech ? "and a.emp_code = $1" : "";
  const mineInstall = tech ? "and a.tech_code = $1" : "";
  const args = tech ? [tech] : [];

  try {
    const row = (
      await query<NavCounts>(
        `with rst as (
          select (${STAGE_SQL}) st, count(*)::int n
          from tb_product a
          where a.status <> 6
          group by 1
        )
        select
          -- ── ສ້ອມແປງ ──
          (select count(*) from tb_product a
            where a.status <> 6 and (${STAGE_SQL}) in (1,2) ${mineRepair})::int as "/checking",
          (select count(*) from tb_product a
            where a.status <> 6 and (${STAGE_SQL}) in (8,9) ${mineRepair})::int as "/repair",
          (select count(*) from tb_product a
            where a.status <> 6 and (${STAGE_SQL}) = 11)::int as "/returns",
          (select count(*) from ic_trans t
            where t.trans_flag = 17 and t.aprove_status = 1 and t.aprove_status_2 = 0)::int as "/quotations/customer-approval",

          -- ── ຕິດຕັ້ງ ──
          (select count(*) from ods_tb_install a
            where ${installStageIs(0)})::int as "/installations/assign",
          (select count(*) from ods_tb_install a
            where a.cancel_date is null and coalesce(a.tech_code,'') <> ''
              and a.tech_confirm is null and a.start_install is null ${mineInstall})::int as "/installations/accept",
          (select count(*) from ods_tb_install a
            where (${installStageIs(4)} or ${installStageIs(5)}) ${mineInstall})::int as "/installations/work",
          (select count(*) from ods_tb_install a
            where ${installStageIs(8)})::int as "/installations/close",

          -- ── ອະນຸມັດ (ເງື່ອນໄຂອັນດຽວກັບ APPROVALS_SQL / CANCEL_REQUESTS_SQL ຂອງ lib/dashboard) ──
          (select count(*) from ic_trans t
            where t.trans_flag = 17 and t.aprove_status = 0)::int as "/approvals/quotations",
          (select count(*) from tb_product a
            where a.status = 6 and a.cancel_start is not null and a.cancel_finish is null)::int as "/approvals/cancellations",
          (select count(*) from ic_trans t
            where t.trans_flag = 78 and t.aprove_status = 0)::int as "/approvals/purchase-requests",

          -- ── ຄຸນນະພາບ ──
          (select count(*) from tb_product a where a.status <> 6 and (${STAGE_SQL}) = 10)::int
            + (select count(*) from ods_tb_install a where ${installStageIs(6)})::int as "/qc",

          -- ── ສະຖານະງານສ້ອມ (ແຕ່ລະຂັ້ນ 1-11) ──
          ${REPAIR_STAGE_COUNTS},

          -- ── ຄິວຕັດຂວາງຂັ້ນ: ຊ່າງຖືກຈັດແລ້ວ ແຕ່ຍັງບໍ່ກົດຮັບ (ບໍ່ກອງຕາມຊ່າງ, ຄືໜ້າປາຍທາງ) ──
          (select count(*) from tb_product a where ${repairStatuses["wait-accept"].condition})::int
            as "/dashboard/status/repair/wait-accept"`,
        args,
      )
    ).rows[0];
    if (!row) return {};

    /**
     * ຢ່າສົ່ງເລກຂອງໜ້າທີ່ຄົນນີ້ **ເຂົ້າບໍ່ໄດ້** ອອກໄປໃຫ້ browser —
     * ກອງດ້ວຍ canAccess ອັນດຽວກັບທີ່ກອງເມນູ (ບໍ່ແມ່ນລາຍຊື່ຝັງມື ທີ່ຈະລືມອັບເດດ).
     */
    return Object.fromEntries(
      Object.entries(row).filter(([path]) => canAccess(role, path)),
    ) as NavCounts;
  } catch (error) {
    // ຕົວເລກຫາຍໄດ້ — ເມນູຫາຍບໍ່ໄດ້
    console.error("navCounts failed", error);
    return {};
  }
}
