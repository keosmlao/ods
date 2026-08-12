import { queryOdg } from "@/lib/db";
import { serviceStaffCodes } from "@/lib/erp-employee";
import { ERP_PURCHASE, SERVICE_SIDE_SQL } from "@/lib/stock-constants";

/**
 * **ນິຍາມຄິວ "ລໍອະນຸມັດໃບສັ່ງຊື້ (PO)" ບ່ອນດຽວ** — ໜ້າ /approvals/purchase-orders
 * ກັບ ຕົວເລກຂ້າງເມນູ (lib/nav-counts) ຕ້ອງໃຊ້ອັນນີ້ຮ່ວມກັນ.
 *
 * ── ເປັນຫຍັງຕ້ອງແຍກອອກມາ (12-08-2026) ──
 * ແຕ່ກ່ອນສອງບ່ອນຂຽນເງື່ອນໄຂ**ຄົນລະຊຸດ**: ໜ້ານັບ "ໃບຂອງສູນ" ດ້ວຍ `OURS` ແຕ່ badge
 * ຍັງນັບ "ໃບທີ່ບໍ່ອ້າງອີງໃບໃດ" ເປັນຂອງເຮົາ (ນິຍາມເກົ່າທີ່ໜ້າຖິ້ມໄປແລ້ວ ເພາະໃບຊື້ຕຸນ
 * ຂອງຝ່າຍອື່ນໄຫຼເຂົ້າມາ) ⇒ ວັດແທ້ badge **54** ແຕ່ໜ້າມີ **6** ແຖວ (ຜິດກົດເກນ ①).
 */

/** $1 = PO · $2 = WPRA · $3 = WPOA · $4 = ລະຫັດພະນັກງານສູນ */
export const poQueueParams = (staff: string[]) =>
  [ERP_PURCHASE.ORDER, ERP_PURCHASE.PR_APPROVE, ERP_PURCHASE.ORDER_APPROVE, staff];

/**
 * ── CTE ແທນ subquery ຕໍ່ແຖວ (31-07-2026) ──
 *
 * ⚠️ WPOA ຜູກທາງຫົວໃບ — ແຖວຂອງມັນ ref_doc_no ຫວ່າງ 100% (15,240 ແຖວ) ⇒ ຕ້ອງຈັບຄູ່
 * ດ້ວຍ `split_part(w.doc_ref,' ',1) = t.doc_no`. ຖ້າຂຽນເປັນ subquery ທີ່ຜູກກັບແຕ່ລະແຖວ
 * ຈະໃຊ້ index ບໍ່ໄດ້ ແລະ ວັດແທ້ **25.8 ວິນາທີ** (ຄົນເປີດໜ້າຄິວແລ້ວນັ່ງລໍ).
 * ກວາດ WPOA ຮອບດຽວໄວ້ໃນ CTE ແລ້ວຄົ້ນ ⇒ **0.4 ວິນາທີ** ຜົນລັບ 48 ໃບຄືກັນເປັນຕົວຕໍ່ຕົວ.
 */
export const PO_QUEUE_CTES = `with wpoa as (
  select split_part(trim(coalesce(doc_ref,'')),' ',1) as po,
      min(doc_no) as doc_no, to_char(min(doc_date),'DD-MM-YYYY') as doc_date
    from ic_trans where trans_flag=$3 and doc_date >= current_date - 400
   group by 1
),
from_spr as (
  select distinct d.doc_no from ic_trans_detail d
    join ic_trans_detail w on w.doc_no = d.ref_doc_no and w.trans_flag=$2 and w.ref_doc_no like 'SPR%'
   where d.trans_flag=$1
)`;

/**
 * PO ຂອງ**ສູນບໍລິການ** — ນິຍາມດຽວກັນກັບໜ້າລາຍການ PO (ເບິ່ງ `OURS` ຢູ່ນັ້ນ):
 * ERP ຕິດ side_code=400 · ຫຼື ມາຈາກຕ່ອງໂສ້ SPR ຂອງວຽກສ້ອມ · ຫຼື ຜູ້ອອກເປັນພະນັກງານສູນ.
 * ⚠️ ຢ່າເອົາ "ໃບທີ່ບໍ່ອ້າງອີງໃບໃດ" ມານັບເປັນຂອງເຮົາຄືເມື່ອກ່ອນ — ໃບຊື້ຕຸນຂອງຝ່າຍອື່ນ
 * ຈະໄຫຼເຂົ້າຄິວອະນຸມັດຂອງສູນ (1,400+ ໃບ/ປີ) ແລະ ຜູ້ອະນຸມັດຈະກົດອະນຸມັດໃບຂອງຄົນອື່ນ.
 */
export const PO_QUEUE_OURS = `(${SERVICE_SIDE_SQL()}
  or t.doc_no in (select doc_no from from_spr)
  or (coalesce(t.creator_code,'') <> '' and t.creator_code = any($4)))`;

/**
 * ອະນຸມັດແລ້ວບໍ — **ອ່ານຈາກ CTE** ຢ່າຖາມຕໍ່ແຖວ.
 * ⚠️ ບົດຮຽນ (12-08-2026): ຮຸ່ນກ່ອນເອົາ CTE ມາໃຊ້ແຕ່ໃນ `where` ສ່ວນ**ເລກໃບ WPOA**
 * ແລະ **ວັນອະນຸມັດ** ຍັງເປັນ subquery ຕໍ່ແຖວທີ່ຕ້ອງ `split_part(doc_ref)` ⇒ index
 * ໃຊ້ບໍ່ໄດ້ ແລະ ຕ້ອງກວາດ ic_trans ຄືນ **ຕໍ່ໜຶ່ງແຖວ**. ແທັບ "ອະນຸມັດແລ້ວ" ມີ 200 ແຖວ
 * ⇒ ວັດແທ້ **8-12 ວິນາທີ**. ຕອນນີ້ join CTE ເອົາທັງສາມຄ່າພ້ອມກັນ ⇒ ຕໍ່າກວ່າ 1 ວິນາທີ.
 */
export const PO_QUEUE_APPROVED = `w.po is not null`;

/** ຂອບເຂດວັນທີຂອງຄິວ — ໜ້າ ກັບ badge ຕ້ອງໃຊ້ອັນດຽວກັນ */
export const PO_QUEUE_WINDOW = `t.doc_date >= current_date - 365`;

/**
 * ຈຳນວນ PO ທີ່ລໍອະນຸມັດ — ໃຊ້ທັງ badge ຂ້າງເມນູ ແລະ ຕົວເລກເທິງແທັບຂອງໜ້າ.
 * ນັບຢ່າງດຽວ (ບໍ່ດຶງ 200 ແຖວພ້ອມ subquery ຊື່ຜູ້ສະໜອງ/ເລກ SPR ມາຖິ້ມຄືເມື່ອກ່ອນ).
 */
export async function countWaitingPoApprovals(staff?: string[]): Promise<number> {
  const codes = staff ?? (await serviceStaffCodes());
  const rows = await queryOdg<{ count: number }>(
    `${PO_QUEUE_CTES}
     select count(*)::int count from ic_trans t
      left join wpoa w on w.po = t.doc_no
      where t.trans_flag=$1 and ${PO_QUEUE_WINDOW} and ${PO_QUEUE_OURS} and not ${PO_QUEUE_APPROVED}`,
    poQueueParams(codes),
  );
  return rows.rows[0]?.count ?? 0;
}
