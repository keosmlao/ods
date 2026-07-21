import type { Session } from "@/lib/auth";
import { unreadTotal } from "@/lib/chat";
import { unstable_cache } from "next/cache";
import { installStatuses, pipelineOf, repairStatuses } from "@/lib/dashboard-status";
import { query, queryOdg } from "@/lib/db";
import { INSTALL_STAGE_SQL, installStageIs } from "@/lib/install-stage";
import { canAccess, roleOf } from "@/lib/roles";
import { ownJobsOnly } from "@/lib/scope";
import { HAS_OUTSTANDING_SPARES } from "@/lib/outstanding-spares";
import { pendingInstallBills } from "@/lib/pending-bills";
import { CANCELLED_JOBS, NOT_MISSING, STAGE_SQL } from "@/lib/stage";

/**
 * ຕົວເລກຄິວຂອງແຕ່ລະຂັ້ນສ້ອມ — ຄູ່ກັບກຸ່ມເມນູ "ສະຖານະງານສ້ອມ" (lib/navigation).
 *
 * ⚠️ ນັບຕໍ່ **condition ຂອງແຕ່ລະ slug** ບໍ່ແມ່ນຕໍ່ `def.stage` — ຂັ້ນ 0 ມີ 3 slug
 * (wait-pickup · picking-up · wait-schedule) ໃຊ້ stage ດຽວກັນ ⇒ ຖ້າ group ຕາມ stage
 * ທັງ 3 ຈະໄດ້ຍອດຂັ້ນ 0 ອັນດຽວກັນ (badge ຊ້ຳ 6,6,6) ແຕ່ໜ້າປາຍທາງກອງດ້ວຍ sub-condition
 * (PS/pickup_start vs IH) ⇒ ເຫັນ 0,0,6 — ຫຼົ້ນກັບ badge (ຜິດກົດເກນ ①). ໃສ່ ${NOT_MISSING}
 * ໃຫ້ຕົງກັບໜ້າປາຍທາງ (page.tsx push NOT_MISSING). **ບໍ່ກອງຕາມຊ່າງ** ໂດຍເຈດຕະນາ:
 * ໜ້າ /dashboard/status/repair/<slug> ສະແດງທຸກວຽກ (ບໍ່ໃຊ້ ownJobsOnly).
 * key = href ຂອງລາຍການເມນູ; slug + condition ມາຈາກ repairStatuses ບ່ອນດຽວ.
 */
const REPAIR_STAGE_COUNTS = pipelineOf(repairStatuses)
  .map(
    ([slug, def]) =>
      `(select count(*) from tb_product a where (${def.condition}) and ${NOT_MISSING})::int as "/dashboard/status/repair/${slug}"`,
  )
  .join(",\n          ");

/**
 * ຕົວເລກຄິວຂອງແຕ່ລະຂັ້ນຕິດຕັ້ງ — ຄູ່ກັບກຸ່ມເມນູ "ຂັ້ນຕອນຕິດຕັ້ງ" (lib/navigation).
 *
 * ຄືກັບຝັ່ງສ້ອມທຸກປະການ ແຕ່ນັບຈາກ CTE `ist` (ຂັ້ນ ods_tb_install + ຈຳນວນ, ສະແກນເທື່ອດຽວ).
 * **ບໍ່ກອງຕາມຊ່າງ**: ໜ້າ /dashboard/status/install/<slug> ສະແດງທຸກວຽກ (ບໍ່ໃຊ້ ownJobsOnly)
 * ⇒ ຕົວເລກຕ້ອງນັບທຸກວຽກຄືກັນ ຈຶ່ງບໍ່ຫຼົ້ນກັບແຖວທີ່ເຫັນ (ກົດເກນ ①).
 */
const INSTALL_STAGE_COUNTS = pipelineOf(installStatuses)
  .map(([slug, def]) => `coalesce((select n from ist where st = ${def.stage}), 0)::int as "/dashboard/status/install/${slug}"`)
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

/** tag ຂອງຕົວເລກສາຍສັ່ງຊື້ — action ທີ່ປ່ຽນມັນຕ້ອງ revalidateTag ອັນນີ້ */
export const PURCHASE_COUNT_TAG = "purchase-counts";

/** tag ຂອງຕົວເລກ "ບິນຄ້າງອອກໃບງານ" — dismiss/restore ບິນ ຕ້ອງ revalidateTag ອັນນີ້ */
export const PENDING_BILL_COUNT_TAG = "pending-bill-count";

/**
 * ນັບບິນທີ່ຄ້າງອອກໃບງານ — ຂ້າມ 2 database (ບິນ ERP · ໃບງານ/dismiss ODS · ໄລ່ໃນ JS)
 * ⇒ ໃສ່ subquery ໃນ query ດຽວບໍ່ໄດ້. ໃຊ້ **ຟັງຊັນອັນດຽວກັບໜ້າ** (pendingInstallBills)
 * ⇒ badge = ຈຳນວນແຖວແທັບ "ຍັງບໍ່ມີໃບງານ" ແທ້ (ກົດເກນ ①). ໜັກ ⇒ cache 60 ວິ + tag:
 * dismissBill/restoreBill ເອີ້ນ `revalidateTag(PENDING_BILL_COUNT_TAG)` ⇒ ສົດທັນທີ.
 * **ບໍ່ຂຶ້ນກັບຜູ້ໃຊ້** (ບໍ່ກອງຕາມຊ່າງ) ⇒ cache ຮ່ວມທັງລະບົບໄດ້.
 */
const cachedPendingBillCount = unstable_cache(
  async () => (await pendingInstallBills()).length,
  ["nav-counts-pending-bills"],
  { revalidate: 60, tags: [PENDING_BILL_COUNT_TAG] },
);

/**
 * ນັບໃບຂໍຊື້/ໃບສັ່ງຊື້ທີ່ຄ້າງ ຢູ່ ERP — **ບໍ່ຂຶ້ນກັບຜູ້ໃຊ້** ຈຶ່ງ cache ຮ່ວມກັນທັງລະບົບໄດ້.
 * ERP ລົ້ມ ⇒ ໂຍນ error ອອກໄປ ໃຫ້ຜູ້ເອີ້ນຄົງຄ່າເກົ່າ (ເມນູຫ້າມລົ້ມຕາມ ERP).
 */
const cachedErpCounts = unstable_cache(
  async () => {
    const erp = await queryOdg<{ spr: number; wpra: number; po: number }>(ERP_COUNT_SQL);
    return { spr: erp.rows[0]?.spr ?? 0, wpra: erp.rows[0]?.wpra ?? 0, po: erp.rows[0]?.po ?? 0 };
  },
  ["nav-counts-erp"],
  { revalidate: 60, tags: [PURCHASE_COUNT_TAG] },
);

const ERP_COUNT_SQL = `select
            (select count(*)::int from ic_trans t
              where t.trans_flag = 2 and t.doc_format_code = 'SPR' and t.doc_date >= current_date - 365
                and not exists (select 1 from ic_trans_detail w where w.trans_flag = 4 and w.ref_doc_no = t.doc_no)) spr,
            /**
             * ── ສອງຄິວ **ຄົນລະຄົນ** (17-07-2026) ──
             *   wpra = ໃບຂໍຊື້ອະນຸມັດແລ້ວ ແຕ່ຍັງບໍ່ອອກ PO  → ວຽກ**ຈັດຊື້** (ເມນູ ໃບສັ່ງຊື້)
             *   po   = PO ທີ່ຍັງບໍ່ມີ WPOA                → ວຽກ**ຜູ້ອະນຸມັດ** (ເມນູ ອະນຸມັດ)
             * ເມື່ອກ່ອນບວກລວມກັນໄວ້ເມນູດຽວ ⇒ ຜູ້ອະນຸມັດເຫັນເລກທີ່ລວມວຽກຂອງຄົນອື່ນ.
             * ເອົາສະເພາະສາຍຂອງເຮົາ (ຕ່ອງໂສ້ SPR ຫຼື PO ອອກໂດຍກົງ) ບໍ່ເອົາຂອງຝ່າຍອື່ນ.
             */
            (select count(*)::int from ic_trans w
              where w.trans_flag = 4 and w.doc_ref like 'SPR%' and w.doc_date >= current_date - 365
                and not exists (select 1 from ic_trans_detail p where p.trans_flag = 6 and p.ref_doc_no = w.doc_no)) wpra,
            (select count(*)::int from ic_trans t
              where t.trans_flag = 6 and t.doc_date >= current_date - 365
                -- WPOA ຜູກທາງ**ຫົວໃບ** (ແຖວ ref_doc_no ຫວ່າງ 100%) — ເບິ່ງ lib/erp-purchase
                and not exists (select 1 from ic_trans a where a.trans_flag = 8
                                 and split_part(trim(coalesce(a.doc_ref,'')),' ',1) = t.doc_no)
                and (exists (select 1 from ic_trans_detail d where d.doc_no = t.doc_no and d.trans_flag = 6
                              and d.ref_doc_no in (select w2.doc_no from ic_trans_detail w2
                                                    where w2.trans_flag = 4 and w2.ref_doc_no like 'SPR%'))
                     or not exists (select 1 from ic_trans_detail x where x.doc_no = t.doc_no
                                     and x.trans_flag = 6 and coalesce(x.ref_doc_no,'') <> ''))) po`;

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
        `with ist as (
          -- ຂັ້ນຕິດຕັ້ງ: ສະແກນ ods_tb_install ເທື່ອດຽວ ⇒ ຄູ່ກັບກຸ່ມເມນູ "ຂັ້ນຕອນຕິດຕັ້ງ".
          -- ຂັ້ນ 0-8 ແມ່ນຄິວເປີດ; INSTALL_STAGE_SQL ຈັດ -1/9 ເປັນຍົກເລີກ/ປິດແລ້ວ.
          -- ⇒ count ຕໍ່ຂັ້ນ = ຈຳນວນແຖວໜ້າ /dashboard/status/install/<slug> ພໍດີ (ກົດເກນ ①).
          select (${INSTALL_STAGE_SQL}) st, count(*)::int n
          from ods_tb_install a
          group by 1
        )
        select
          -- ── ສ້ອມແປງ (ຂັ້ນ 1,2,8,9 ບໍ່ເຄີຍມີ status=6 ⇒ ບໍ່ຕ້ອງກອງ) ──
          (select count(*) from tb_product a
            where (${STAGE_SQL}) in (1,2) ${mineRepair})::int as "/checking",
          (select count(*) from tb_product a
            where (${STAGE_SQL}) in (8,9) ${mineRepair})::int as "/repair",
          -- ຂັ້ນ 11 ລວມງານຍົກເລີກ-ເຄື່ອງຍັງຢູ່ ⇒ **ບໍ່ກອງ status** ໃຫ້ຕົງກັບໜ້າປາຍທາງ
          (select count(*) from tb_product a
            where (${STAGE_SQL}) = 11)::int as "/returns",
          (select count(*) from ic_trans t
            where t.trans_flag = 17 and t.aprove_status = 1 and t.aprove_status_2 = 0)::int as "/quotations/customer-approval",

          -- ── ຕິດຕັ້ງ ──
          (select count(*) from ods_tb_install a
            where ${installStageIs(0)})::int as "/installations/assign",
          -- ລໍຖ້າຊ່າງຮັບ
          (select count(*) from ods_tb_install a
            where ${installStageIs(1)} ${mineInstall})::int as "/installations/accept",
          -- ໃບຂໍເບີກ: ແທັບ "ລໍຖ້າຂໍເບີກ" (WAIT_WHERE ຂອງ /installations/spare-requests) — ໃຊ້ອາໄຫຼ່ ຮັບງານແລ້ວ ແຕ່ຍັງບໍ່ຂໍເບີກ
          (select count(*) from ods_tb_install a
            where ${installStageIs(2)} ${mineInstall})::int as "/installations/spare-requests",
          -- ກຳລັງຂໍເບີກ (REQ_WHERE: ໃບ SION 122 ຂອງງານທີ່ຍັງບໍ່ປິດ) — key ສັງເຄາະ resolve → rule /installations/spare-requests
          (select count(*) from ic_trans ic
            left join ods_tb_install a on a.code = ic.product_code
            where ic.trans_flag = 122 and ic.job_type = 'install' and a.job_finish is null ${mineInstall})::int as "/installations/spare-requests/requested",
          -- ລໍຖ້າຮັບອາໄຫຼ່: ລວມຕັ້ງແຕ່ສົ່ງຄຳຂໍຈົນຊ່າງຮັບຄົບ
          (select count(*) from ods_tb_install a
            where ${installStageIs(3)} ${mineInstall})::int as "/installations/spare-pickup",
          (select count(*) from ods_tb_install a
            where ${installStageIs(4)} ${mineInstall})::int as "/installations/work",
          (select count(*) from ods_tb_install a
            where ${installStageIs(5)} ${mineInstall})::int as "/installations/work/doing",
          (select count(*) from ods_tb_install a
            where ${installStageIs(8)})::int as "/installations/close",
          -- ── ອະນຸມັດ (ເງື່ອນໄຂອັນດຽວກັບ APPROVALS_SQL / CANCEL_REQUESTS_SQL ຂອງ lib/dashboard) ──
          (select count(*) from ic_trans t
            where t.trans_flag = 17 and t.aprove_status = 0)::int as "/approvals/quotations",
          (select count(*) from tb_product a
            where a.status = 6 and a.cancel_start is not null and a.cancel_finish is null)::int as "/approvals/cancellations",
          (select count(*) from ic_trans t
            where t.trans_flag = 78 and t.aprove_status = 0)::int as "/approvals/purchase-requests",

          -- ── ອາໄຫຼ່ຄ້າງນອກສາງ: ວຽກຍົກເລີກທີ່ຍັງມີແຖວໃບເບີກ status=0 (lib/outstanding-spares) ──
          (select count(*) from tb_product a
            where ${CANCELLED_JOBS} and ${HAS_OUTSTANDING_SPARES})::int as "/stock/spare-recovery",

          -- ── ຄຸນນະພາບ ──
          (select count(*) from tb_product a where a.status <> 6 and (${STAGE_SQL}) = 10)::int
            + (select count(*) from ods_tb_install a where ${installStageIs(6)})::int as "/qc",
          (select count(*) from ods_tb_install a where ${installStageIs(6)})::int as "/qc/install",

          -- ── ສະຖານະງານສ້ອມ: ຂັ້ນຮັບງານຖືກລວມເຂົ້າ wait-check ແລ້ວ ──
          ${REPAIR_STAGE_COUNTS},

          -- ── 9 ຄິວຫຼັກຂອງງານຕິດຕັ້ງ (0-8) ──
          ${INSTALL_STAGE_COUNTS}`,
        args,
      )
    ).rows[0];
    if (!row) return {};

    /**
     * ── ຕົວເລກຈາກ **ERP** — cache 60 ວິນາທີ (17-07-2026) ──
     * ໃບຂໍຊື້/ໃບສັ່ງຊື້ຢູ່ ERP ບ່ອນດຽວແລ້ວ ⇒ ຕົວເລກຕ້ອງມາຈາກ ERP. ແຕ່ຄຳຖາມນີ້
     * **ໜັກ 700ms** (ERP ic_trans 310,000 ແຖວ · ຕ້ອງໄລ່ຕ່ອງໂສ້ເພື່ອບໍ່ໃຫ້ນັບໃບຂອງຝ່າຍອື່ນ)
     * ແລະ sidebar ຢູ່ layout ⇒ **ທຸກໆການກົດເມນູຈ່າຍ 700ms** ທັງທີ່ຕົວເລກປ່ຽນນານໆເທື່ອ.
     * ⇒ cache ໄວ້ 60 ວິ + ຕິດ tag: action ໃດປ່ຽນຕົວເລກ (ອະນຸມັດ/ອອກ PO/ຍົກເລີກ)
     * ເອີ້ນ `revalidateTag(PURCHASE_COUNT_TAG)` ⇒ ຕົວເລກສົດທັນທີ ບໍ່ຕ້ອງລໍ 60 ວິ.
     * ຫຍໍ້ເງື່ອນໄຂໃຫ້ໄວບໍ່ໄດ້ — ຈະຂັດກົດເກນ ① (ຕົວເລກຕ້ອງຕົງກັບໜ້າປາຍທາງ).
     */
    try {
      const erp = await cachedErpCounts();
      row["/approvals/purchase-requests"] = erp.spr;
      // ຈັດຊື້ເຫັນ "ລໍອອກ PO" · ຜູ້ອະນຸມັດເຫັນ "ລໍອະນຸມັດ PO" — ຄົນລະຄິວ ຄົນລະເມນູ
      row["/purchase-orders"] = erp.wpra;
      row["/approvals/purchase-orders"] = erp.po;
    } catch (error) {
      console.error("nav-counts ERP purchase count failed", error);
    }

    /**
     * ຂໍ້ຄວາມແຊັດທີ່ຍັງບໍ່ໄດ້ອ່ານ — ຕາຕະລາງຄົນລະອັນ ແລະ ຂຶ້ນກັບຕົວຄົນ ຈຶ່ງຖາມແຍກ
     * (ດັດເຂົ້າ query ໃຫຍ່ບໍ່ໄດ້). ລົ້ມ ⇒ ບໍ່ມີຕົວເລກ ບໍ່ແມ່ນເມນູພັງ.
     */
    try {
      row["/chat"] = await unreadTotal(session.username, role);
    } catch (error) {
      console.error("nav-counts chat unread failed", error);
    }

    /**
     * ບິນຄ້າງອອກໃບງານ — cache 60 ວິ (ຂ້າມ 2 DB · ໜັກ). ລົ້ມ ⇒ ບໍ່ມີຕົວເລກ ບໍ່ແມ່ນເມນູພັງ.
     */
    try {
      row["/installations/pending-bills"] = await cachedPendingBillCount();
    } catch (error) {
      console.error("nav-counts pending-bill count failed", error);
    }

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
