import { ApprovePoButton } from "@/app/(app)/purchase-orders/approve-po-button";
import { BackLink } from "@/components/back-link";
import { LinkPending } from "@/components/link-pending";
import { getSession } from "@/lib/auth";
import { queryOdg } from "@/lib/db";
import { serviceStaffCodes } from "@/lib/erp-employee";
import { APPROVER_SIDE, roleOf } from "@/lib/roles";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getLocale } from "@/lib/i18n/locale";
import { PURCHASE_COUNT_TAG } from "@/lib/nav-counts";
import { ERP_PURCHASE, SERVICE_SIDE_SQL } from "@/lib/stock-constants";
import { unstable_cache } from "next/cache";
import { ArrowLeft, BellRing, ChevronLeft, ChevronRight, Plus, Search } from "lucide-react";
import Link from "next/link";

type Dict = Record<string, string>;

/**
 * ໃບສັ່ງຊື້ (PO) ຂອງວຽກສ້ອມ — **ອ່ານຈາກ ERP** (trans_flag=6, POT/POH).
 *
 * ໜ້າຕັ້ງຕົ້ນ = **ລາຍການໃບ PO** ແບ່ງໜ້າ (20 ໃບ/ໜ້າ) · ຖັນສະຖານະໄລ່ຮອດທ້າຍຕ່ອງໂສ້:
 * ລໍອະນຸມັດ → ອະນຸມັດແລ້ວ (WPOA) → ຮັບເຂົ້າສາງ (PUI ບາງສ່ວນ/ຄົບ) · ຖັນອາຍຸນັບມື້
 * ຈາກມື້ອອກໃບຫາມື້ນີ້ (ຄ້າງດົນ = ແດງ). ກົດເລກໃບ = ເປີດ**ໜ້າເອກະສານ**ແບບ Odoo.
 * ເທິງລາຍການມີແຈ້ງເຕືອນ WPRA ທີ່ຍັງບໍ່ອອກ PO + ປຸ່ມສ້າງເອກະສານໃໝ່ (ບໍ່ອ້າງອີງວຽກ).
 *
 * ສະແດງ**ສະເພາະໃບຂອງສູນບໍລິການ** — ນິຍາມຢູ່ `OURS` ຂ້າງລຸ່ມ (side_code 400 ·
 * ຕ່ອງໂສ້ SPR · ຜູ້ອອກເປັນພະນັກງານສູນ). ໃບຂອງຝ່າຍອື່ນບໍ່ເອົາມາປົນ.
 */
export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

/** ໃບເກົ່າ doc_ref/remark ເປັນເລກ RQ ຫຼື ຂໍ້ຄວາມ — ລິ້ງສະເພາະທີ່ເປັນລະຫັດວຽກແທ້ */
const isJobCode = (value: string | null): value is string => /^(\d+|INST-\w+)$/.test(value ?? "");

const branchName = (code: string | null) =>
  code === "05" ? "ໂອດ່ຽນໄທ" : code === "00" ? "ສຳນັກງານໃຫ່ຍ" : (code ?? "-");

/** ອາຍຸເອກະສານ — ນັບຈາກມື້ອອກຮອດມື້ນີ້, ຄ້າງດົນສີແດງ (ຂໍຈາກຜູ້ໃຊ້ 17-07-2026) */
function AgeBadge({ days, t }: { days: number | null; t: Dict }) {
  if (days === null) return <span className="text-slate-300">-</span>;
  return (
    <span
      className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-bold tabular-nums ${
        days >= 14 ? "bg-brand-orange-100 text-brand-orange-700" : days >= 7 ? "bg-brand-orange-300 text-brand-900" : "bg-slate-100 text-slate-600"
      }`}
    >
      {days} {t.daysUnit}
    </span>
  );
}

type Props = {
  searchParams: Promise<{ tab?: string; page?: string; src?: string; q?: string; status?: string; days?: string }>;
};

/**
 * ── ຊ່ວງເວລາທີ່ດຶງມາ (ຂໍຈາກຜູ້ໃຊ້ 12-08-2026: "ໃຫ້ limit ລາຍການທີ່ດຶງ") ──
 * ເມື່ອກ່ອນດຶງຍ້ອນຫຼັງ **1 ປີ ຕາຍຕົວ** ⇒ ທຸກໆການເປີດໜ້າໄລ່ໃບ 2,237 ໃບ ທັງທີ່ຄົນ
 * ເບິ່ງແຕ່ໃບຂອງເດືອນນີ້. ຕັ້ງຕົ້ນເປັນ **90 ມື້** ແລ້ວໃຫ້ຜູ້ໃຊ້ຂະຫຍາຍເອງໄດ້ —
 * ໃບເກົ່າກວ່ານັ້ນຍັງເປີດຈາກເລກໃບໄດ້ຕາມປົກກະຕິ (ໜ້າເອກະສານບໍ່ໄດ້ຈຳກັດວັນ).
 */
const DAY_CHOICES = [90, 180, 365] as const;
const DEFAULT_DAYS = 90;
const daysOf = (value: string | undefined) => {
  const n = Number(value);
  return DAY_CHOICES.includes(n as (typeof DAY_CHOICES)[number]) ? n : DEFAULT_DAYS;
};
const dayLabel = (days: number, t: Dict) => (days >= 365 ? t.range1Year : days >= 180 ? t.range6Months : t.range90Days);

/**
 * ຄົ້ນຫາ — **ຄົ້ນຢູ່ server** (ຮ່ວມກັບການແບ່ງໜ້າ) ບໍ່ແມ່ນກອງແຖວທີ່ໂຫຼດມາແລ້ວ:
 * ໂຫຼດມາເທື່ອລະ 20 ໃບຈາກ 116 ໃບ ⇒ ກອງຢູ່ browser ຈະຫາໃບທີ່ຢູ່ໜ້າອື່ນບໍ່ພົບ.
 * ຄົ້ນໄດ້: ເລກ PO · ຜູ້ສະໜອງ (ລະຫັດ/ຊື່) · ເລກ SPR ຕົ້ນທາງ · ເລກວຽກ.
 * SPR/ວຽກ ຢູ່ຄົນລະໃບ ⇒ ຕ້ອງ exists ຜ່ານຕ່ອງໂສ້ PO → WPRA → SPR.
 */
const SEARCH_SQL = (n: number) => `and ($${n} = '' or (
  t.doc_no ilike '%' || $${n} || '%'
  or t.cust_code ilike '%' || $${n} || '%'
  or exists (select 1 from ap_supplier s where s.code = t.cust_code and s.name_1 ilike '%' || $${n} || '%')
  or exists (
    select 1 from ic_trans_detail d
     where d.doc_no = t.doc_no and d.trans_flag = $1
       and exists (
         select 1 from ic_trans w
          where w.doc_no = d.ref_doc_no and w.trans_flag = $2
            and (w.doc_ref ilike '%' || $${n} || '%'
              or trim(coalesce(w.remark,'')) ilike '%' || $${n} || '%')))
))`;

type Row = {
  doc_no: string;
  doc_date: string | null;
  age: number | null;
  spr: string | null;
  job: string | null;
  supplier: string | null;
  supplier_name: string | null;
  creator: string | null;
  creator_name: string | null;
  branch_code: string | null;
  total: string | null;
  wpoa: string | null;
  pui: string | null;
  items: number;
  items_received: number;
};

/**
 * ── PO ໃບໃດ "ຂອງສູນບໍລິການ" (ຂໍຈາກຜູ້ໃຊ້ 12-08-2026) ──
 * ① ERP ຕິດປ້າຍ **side_code = 400 (ຝ່າຍບໍລິການ)** ໃຫ້ແລ້ວ — 273 ໃບ/ປີ
 * ② ອອກຈາກ**ຕ່ອງໂສ້ໃບຂໍຊື້ຂອງວຽກສ້ອມ** (PO → WPRA → SPR) — ໃບເກົ່າ 29 ໃບ
 *    ບໍ່ໄດ້ຕິດປ້າຍ (ສ່ວນຫຼາຍອອກຈາກ ods ເກົ່າ) ⇒ ຂາດຂໍ້ນີ້ບໍ່ໄດ້
 * ③ ຜູ້ອອກໃບເປັນ**ພະນັກງານສູນບໍລິການ** (creator_code ຢູ່ໃນລາຍຊື່ຜູ້ໃຊ້ ODSS) — 10 ໃບ
 * ນອກນັ້ນ = ໃບຂອງຝ່າຍອື່ນ (~1,300 ໃບ/ປີ) — ບໍ່ກ່ຽວ ບໍ່ເອົາມາປົນ.
 *
 * ⚠️ ເມື່ອກ່ອນນັບ "ໃບທີ່ບໍ່ອ້າງອີງໃບໃດ" (ຊື້ຕຸນ) ເປັນຂອງເຮົາ ⇒ ໄດ້ໃບຊື້ຕຸນຂອງ
 * ທຸກຝ່າຍມາປົນ 1,401 ໃບ. ຕັດອອກແລ້ວ ແລະ ໄດ້ໃບບໍລິການທີ່ອ້າງອີງໃບຂໍຊື້ຂອງ
 * ຝ່າຍອື່ນ (PRTM/PRHN ແຕ່ side_code=400) ເພີ່ມມາ 176 ໃບແທນ ⇒ ລວມ 312 ໃບ/ປີ.
 */
const FROM_SPR = `exists (
  select 1 from ic_trans_detail d
   where d.doc_no=t.doc_no and d.trans_flag=$1
     and d.ref_doc_no in (
       select w.doc_no from ic_trans_detail w
        where w.trans_flag=$2 and w.ref_doc_no like 'SPR%')
)`;
/** ພະນັກງານສູນ — ສົ່ງລາຍຊື່ເຂົ້າມາເປັນ array param (ລາຍຊື່ຢູ່ ODS ⇒ join ຂ້າມຖານບໍ່ໄດ້) */
const BY_STAFF = (param: string) => `(coalesce(t.creator_code,'') <> '' and t.creator_code = any(${param}::text[]))`;
/**
 * ── ສະຖານະຂອງ PO — ນິຍາມບ່ອນດຽວ ──
 * ຕ້ອງກອງຢູ່ **ໃນ CTE po** (ກ່ອນ limit/offset) ບໍ່ແມ່ນກອງແຖວທີ່ດຶງມາແລ້ວ:
 * ດຶງເທື່ອລະ 20 ໃບ ⇒ ກອງທີຫຼັງຈະໄດ້ໜ້າທີ່ມີແຖວບໍ່ຄົບ ແລະ ຕົວເລກນັບຜິດ.
 * ນິຍາມຕ້ອງຕົງກັບ StatusChip (ບ່ອນສະແດງ) — ຢ່າໃຫ້ຄົນລະຄວາມໝາຍ.
 */
const HAS_WPOA = `exists (select 1 from ic_trans w where w.trans_flag=$3
   and split_part(trim(coalesce(w.doc_ref,'')),' ',1) = t.doc_no)`;
const HAS_PUI = `exists (select 1 from ic_trans_detail r where r.trans_flag=$4 and r.ref_doc_no = t.doc_no)`;

export type PoStatus = "wait" | "approved" | "received";

const STATUS_WHERE: Record<PoStatus, string> = {
  wait: `not ${HAS_WPOA}`,
  approved: `${HAS_WPOA} and not ${HAS_PUI}`,
  received: HAS_PUI,
};

const statusLabel = (t: Dict): Record<PoStatus, string> => ({
  wait: t.statusWait,
  approved: t.statusApproved,
  received: "ຮັບເຂົ້າສາງແລ້ວ",
});

const statusOf = (value: string | undefined): PoStatus | null =>
  value === "wait" || value === "approved" || value === "received" ? value : null;

/**
 * ── ບອກຊະນິດຂໍ້ມູນຂອງ param ທີ່ບາງເສັ້ນທາງບໍ່ໄດ້ໃຊ້ (ບັກເກົ່າ ພົບ 12-08-2026) ──
 * ຈຳນວນ param ທີ່ສົ່ງໄປຄົງທີ່ ແຕ່ SQL ປະກອບຕາມຕົວກອງ ⇒ ແທັບ "ງານສ້ອມ" ບໍ່ໄດ້ໃຊ້
 * ລາຍຊື່ພະນັກງານ ⇒ param ນັ້ນລອຍ ແລະ Postgres ຟ້ອງ ("bind message supplies 9
 * parameters, but prepared statement requires 8") ⇒ query ລົ້ມ, catch ຄືນວ່າງ.
 * ເງື່ອນໄຂນີ້ຈິງສະເໝີ — ມີໄວ້**ບອກຊະນິດ**ຢ່າງດຽວ ບໍ່ໄດ້ກອງຫຍັງ.
 */
const TYPED_STAFF = (param: string) => `${param}::text[] is not null`;

const whereOf = (src: "all" | "repair", staffParam: string, days: number) =>
  `t.trans_flag=$1 and t.doc_date >= current_date - ${days} and ${
    src === "repair"
      ? `${FROM_SPR} and ${TYPED_STAFF(staffParam)}`
      : `(${SERVICE_SIDE_SQL()} or ${FROM_SPR} or ${BY_STAFF(staffParam)})`
  }`;

export type PoCounts = { total: number } & Record<PoStatus, number>;

const NO_COUNTS: PoCounts = { total: 0, wait: 0, approved: 0, received: 0 };

/**
 * ── ນັບທຸກສະຖານະ **ດ້ວຍ query ດຽວ** (ແກ້ຄວາມຊ້າ 12-08-2026) ──
 * ເມື່ອກ່ອນຍິງ 4 query (ທັງໝົດ · ລໍ · ອະນຸມັດ · ຮັບແລ້ວ) ⇒ ກວາດຕາຕະລາງດຽວກັນ 4 ຮອບ
 * ວັດແທ້ 110ms × 4 ບວກກັບການແຍ່ງ connection ⇒ ໂຄ້ດຂອງໜ້າກິນ 600-1,100ms.
 * ດຽວນີ້ຄິດ "ໃບຂອງເຮົາ + ມີ WPOA ບໍ + ມີ PUI ບໍ" ຮອບດຽວແລ້ວນັບດ້ວຍ filter ⇒ **140ms**.
 *
 * ⚠️ ຢ່າຄິດວ່າ CTE ຈະຖືກ inline — ERP ແລ່ນ **PostgreSQL 11** ທີ່ຈະ materialize CTE ສະເໝີ.
 * ຢ່າຫຼົງເອົາຊຸດ PUI ມາເປັນ CTE ນຳ (ວັດແທ້ 219ms ຕໍ່ຮອບ) — exists ຕໍ່ແຖວໄວກວ່າ
 * ເພາະມີ index (ref_doc_no, trans_flag) ແລະ ແຖວທີ່ຕ້ອງກວດມີແຕ່ 312 ໃບ.
 * `wpoa` ຕ້ອງເປັນຊຸດ (23ms) ເພາະຜູກທາງຫົວໃບດ້ວຍ split_part ⇒ index ໃຊ້ບໍ່ໄດ້.
 */
const COUNT_SQL = (src: "all" | "repair", days: number) => `with spr_po as (
    select distinct d.doc_no from ic_trans_detail d
      join ic_trans_detail w on w.doc_no=d.ref_doc_no and w.trans_flag=$2 and w.ref_doc_no like 'SPR%'
     where d.trans_flag=$1),
  wpoa as (
    select distinct split_part(trim(coalesce(doc_ref,'')),' ',1) po_no
      from ic_trans where trans_flag=$3 and coalesce(doc_ref,'') <> '')
  select count(*)::int total,
     count(*) filter (where not has_wpoa)::int wait,
     count(*) filter (where has_wpoa and not has_pui)::int approved,
     count(*) filter (where has_pui)::int received
   from (
     select (w.po_no is not null) has_wpoa,
         exists (select 1 from ic_trans_detail r where r.trans_flag=$4 and r.ref_doc_no=t.doc_no) has_pui
       from ic_trans t
       left join spr_po s on s.doc_no = t.doc_no
       left join wpoa w on w.po_no = t.doc_no
      where t.trans_flag=$1 and t.doc_date >= current_date - ${days}
        and ${
          src === "repair"
            ? `s.doc_no is not null and ${TYPED_STAFF("$6")}`
            : `(${SERVICE_SIDE_SQL()} or ${BY_STAFF("$6")} or s.doc_no is not null)`
        }
        ${SEARCH_SQL(5)}) x`;

/**
 * ── cache 30 ວິນາທີ + ຜູກ tag ຂອງການສັ່ງຊື້ (12-08-2026) ──
 * ໃບຢູ່ **ERP** ແລະ ປ່ຽນເມື່ອມີຄົນອອກ/ອະນຸມັດ/ຮັບເຂົ້າສາງ — ບໍ່ແມ່ນທຸກວິນາທີ ⇒ ບໍ່ຕ້ອງ
 * ຖາມຄືນທຸກໆການກົດ. ທຸກ action ຂອງສາຍສັ່ງຊື້ເອີ້ນ `updateTag(PURCHASE_COUNT_TAG)`
 * ຢູ່ແລ້ວ (actions/purchase.ts) ⇒ ອອກ PO/ອະນຸມັດແລ້ວ **ເຫັນຜົນທັນທີ** ບໍ່ຕ້ອງລໍ 30 ວິ.
 * ກະແຈ = ຕົວກອງທັງໝົດ (ແຫຼ່ງ · ຊ່ວງວັນ · ຄຳຄົ້ນ · ໜ້າ · ສະຖານະ) ⇒ ບໍ່ປົນກັນ.
 */
const cachedCounts = unstable_cache(
  async (src: "all" | "repair", staff: string[], days: number, q: string): Promise<PoCounts> =>
    (
      await queryOdg<PoCounts>(COUNT_SQL(src, days), [
        ERP_PURCHASE.ORDER, ERP_PURCHASE.PR_APPROVE, ERP_PURCHASE.ORDER_APPROVE, ERP_PURCHASE.RECEIPT, q, staff,
      ])
    ).rows[0] ?? NO_COUNTS,
  ["purchase-orders-counts"],
  { revalidate: 30, tags: [PURCHASE_COUNT_TAG] },
);

async function getCounts(src: "all" | "repair", staff: string[], days: number, q = ""): Promise<PoCounts> {
  try {
    return await cachedCounts(src, staff, days, q);
  } catch (error) {
    console.error("purchase-orders count failed", error);
    return NO_COUNTS;
  }
}

/** ແຖວຂອງໜ້າປັດຈຸບັນ — cache/ຜູກ tag ຄືກັນກັບ `cachedCounts` (ເບິ່ງເຫດຜົນຢູ່ນັ້ນ) */
const cachedRows = unstable_cache(
  async (
    page: number,
    src: "all" | "repair",
    staff: string[],
    days: number,
    q: string,
    status: PoStatus | null,
  ): Promise<Row[]> =>
    (
      await queryOdg<Row>(
      /**
       * ຕັດໜ້າກ່ອນ (po) ແລ້ວຈຶ່ງເອົາຂໍ້ມູນປະກອບ — ບໍ່ດັ່ງນັ້ນ subquery ຈະແລ່ນທົ່ວຕາຕະລາງ.
       * `wpoa` ຜູກທາງ**ຫົວໃບ** (ແຖວຂອງມັນ ref_doc_no ຫວ່າງ 100% — ເບິ່ງ lib/erp-purchase)
       * ແລະ ຕ້ອງ `split_part(trim(doc_ref))` ⇒ index ໃຊ້ບໍ່ໄດ້. ເມື່ອກ່ອນເປັນ subquery
       * ຕໍ່ແຖວ ⇒ ໄລ່ 5,469 ແຖວ **ຕໍ່ PO ໜຶ່ງໃບ** (483ms). ລວມຄ່າໄວ້ກ່ອນແລ້ວ join = 56ms.
       */
      `with po as (
          select t.* from ic_trans t where ${whereOf(src, "$9", days)} ${status ? `and ${STATUS_WHERE[status]}` : ""} ${SEARCH_SQL(8)}
           order by t.doc_no desc limit $5 offset $6),
        wpoa as (
          select split_part(trim(coalesce(doc_ref,'')),' ',1) po_no, min(doc_no) doc_no
            from ic_trans where trans_flag=$3 and coalesce(doc_ref,'') <> '' group by 1)
       select t.doc_no, to_char(t.doc_date,'DD-MM-YYYY') doc_date,
          (current_date - t.doc_date)::int age,
          (select split_part(trim(coalesce(w.doc_ref,'')),' ',1) from ic_trans w
            where w.trans_flag=$2 and w.doc_no in (
              select d2.ref_doc_no from ic_trans_detail d2 where d2.doc_no=t.doc_no and d2.trans_flag=$1)
            limit 1) spr,
          (select split_part(trim(coalesce(s.doc_ref,'')),' ',1) from ic_trans s
            where s.trans_flag=$7 and s.doc_no = (
              select split_part(trim(coalesce(w.doc_ref,'')),' ',1) from ic_trans w
               where w.trans_flag=$2 and w.doc_no in (
                 select d3.ref_doc_no from ic_trans_detail d3 where d3.doc_no=t.doc_no and d3.trans_flag=$1)
               limit 1)) job,
          t.cust_code supplier,
          (select s.name_1 from ap_supplier s where s.code=t.cust_code limit 1) supplier_name,
          /**
           * ຜູ້ສ້າງເອກະສານ — ERP ເກັບເປັນ**ລະຫັດພະນັກງານ** (23015) ⇒ ຫາຊື່ຈາກ odg_employee.
           * ໃບເກົ່າບາງໃບ creator ເປັນຊື່ login ຂອງ ERP (ເຊັ່ນ NARD) ທີ່ບໍ່ມີໃນຕາຕະລາງພະນັກງານ
           * ⇒ ຊື່ເປັນ null ແລ້ວໜ້າຈໍສະແດງລະຫັດນັ້ນແທນ (ດີກວ່າຫວ່າງເປົ່າ).
           */
          t.creator_code creator,
          (select e.fullname_lo from odg_employee e where e.employee_code=t.creator_code limit 1) creator_name,
          t.branch_code,
          to_char(coalesce(t.total_amount,0),'FM999,999,999,990') total,
          wpoa.doc_no wpoa,
          (select string_agg(distinct r.doc_no, ', ') from ic_trans_detail r where r.trans_flag=$4 and r.ref_doc_no=t.doc_no) pui,
          (select count(distinct d.item_code) from ic_trans_detail d where d.doc_no=t.doc_no and d.trans_flag=$1)::int items,
          (select count(distinct r.item_code) from ic_trans_detail r where r.trans_flag=$4 and r.ref_doc_no=t.doc_no)::int items_received
        from po t
        left join wpoa on wpoa.po_no = t.doc_no
       order by t.doc_no desc`,
        [
          ERP_PURCHASE.ORDER, ERP_PURCHASE.PR_APPROVE, ERP_PURCHASE.ORDER_APPROVE, ERP_PURCHASE.RECEIPT,
          PAGE_SIZE, (page - 1) * PAGE_SIZE, ERP_PURCHASE.PR_REQUEST, q, staff,
        ],
      )
    ).rows,
  ["purchase-orders-rows"],
  { revalidate: 30, tags: [PURCHASE_COUNT_TAG] },
);

async function getRows(
  page: number,
  src: "all" | "repair",
  staff: string[],
  days: number,
  q = "",
  status: PoStatus | null = null,
): Promise<Row[]> {
  try {
    return await cachedRows(page, src, staff, days, q, status);
  } catch (error) {
    console.error("purchase-orders read failed", error);
    return [];
  }
}

type WpraRow = {
  doc_no: string;
  doc_date: string | null;
  age: number | null;
  spr: string | null;
  job: string | null;
  branch_code: string | null;
  total: string | null;
};

/** WPRA (ຈາກ SPR ຂອງເຮົາ) ທີ່**ຍັງບໍ່ມີ PO** — ຄິວ "ລໍອອກ PO + ເລືອກຜູ້ສະໜອງ" */
async function getWpraWaiting(): Promise<WpraRow[]> {
  try {
    const rows = await queryOdg<WpraRow>(
      `select t.doc_no, to_char(t.doc_date,'DD-MM-YYYY') doc_date,
          (current_date - t.doc_date)::int age,
          split_part(trim(coalesce(t.doc_ref,'')),' ',1) spr,
          (select split_part(trim(coalesce(s.doc_ref,'')),' ',1) from ic_trans s
            where s.doc_no = split_part(trim(coalesce(t.doc_ref,'')),' ',1) and s.trans_flag=$2 limit 1) job,
          t.branch_code,
          (select to_char(sum(d.sum_amount),'FM999,999,999,990') from ic_trans_detail d
            where d.doc_no=t.doc_no and d.trans_flag=$1) total
        from ic_trans t
       where t.trans_flag=$1 and t.doc_ref like 'SPR%' and t.doc_date >= current_date - 365
         and not exists (select 1 from ic_trans_detail p where p.trans_flag=$3 and p.ref_doc_no=t.doc_no)
       order by t.doc_no desc limit 100`,
      [ERP_PURCHASE.PR_APPROVE, ERP_PURCHASE.PR_REQUEST, ERP_PURCHASE.ORDER],
    );
    return rows.rows;
  } catch (error) {
    console.error("getWpraWaiting failed", error);
    return [];
  }
}

/** ສະຖານະທ້າຍຕ່ອງໂສ້ຂອງ PO ໃບນຶ່ງ — ໄລ່ຮອດ PUI ຮັບເຂົ້າສາງ (ຂໍຈາກຜູ້ໃຊ້ 17-07-2026) */
function StatusChip({ row, t }: { row: Row; t: Dict }) {
  if (row.pui && row.items_received >= row.items) {
    return (
      <span className="inline-flex flex-col items-start gap-0.5">
        <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[10px] font-semibold text-brand-800">
          ຮັບເຂົ້າສາງແລ້ວ
        </span>
        <span className="font-mono text-[9px] text-slate-400" title={row.pui}>{row.pui}</span>
      </span>
    );
  }
  if (row.pui) {
    return (
      <span className="inline-flex flex-col items-start gap-0.5">
        <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[10px] font-semibold text-brand-600">
          {t.receivedPartial} {row.items_received}/{row.items}
        </span>
        <span className="font-mono text-[9px] text-slate-400" title={row.pui}>{row.pui}</span>
      </span>
    );
  }
  if (row.wpoa) {
    return (
      <span className="inline-flex flex-col items-start gap-0.5">
        <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[10px] font-semibold text-brand-700">
          {t.statusApproved}
        </span>
        <span className="font-mono text-[9px] text-slate-400">{row.wpoa}</span>
      </span>
    );
  }
  return (
    <span className="rounded-full bg-brand-orange-300 px-2 py-0.5 text-[10px] font-semibold text-brand-900">{t.waitApprovalPo}</span>
  );
}

export default async function PurchaseOrdersPage({ searchParams }: Props) {
  const params = await searchParams;
  // ໜ້າຕັ້ງຕົ້ນ = **ລາຍການໃບ PO** · ?tab=issue = ຄິວ WPRA ລໍອອກ PO
  const tab = params.tab === "issue" ? "issue" : "list";
  const src = params.src === "repair" ? "repair" : "all";
  const q = (params.q ?? "").trim();
  const status = statusOf(params.status);
  const page = Math.max(1, Number(params.page) || 1);
  // ຊ່ວງເວລາທີ່ດຶງ — ຕັ້ງຕົ້ນ 90 ມື້, ຂະຫຍາຍໄດ້ດ້ວຍ ?days=180/365
  const days = daysOf(params.days);
  /**
   * ລາຍຊື່ພະນັກງານສູນຕ້ອງໄດ້ກ່ອນ (query ໃບກອງດ້ວຍລາຍຊື່ນີ້) ແຕ່ **ຢ່າລໍມັນຢູ່ຊື່ໆ** —
   * ຍິງພ້ອມກັບຄິວ WPRA ແລະ session ທີ່ບໍ່ຂຶ້ນກັບມັນ ⇒ ຫຼຸດ round-trip ຕໍ່ແຖວກັນໜຶ່ງຮອບ.
   */
  const [staff, wpraRows, session] = await Promise.all([serviceStaffCodes(), getWpraWaiting(), getSession()]);
  // ຕົວເລກຂອງທຸກແທັບມາຈາກ **ຮອບດຽວ** (getCounts) — ຄົນຕ້ອງເຫັນວ່າແຕ່ລະສະຖານະມີຈັກໃບກ່ອນກົດ
  const [rows, counts] = await Promise.all([getRows(page, src, staff, days, q, status), getCounts(src, staff, days, q)]);
  // ກອງສະຖານະຢູ່ ⇒ "ທັງໝົດ" ຂອງການແບ່ງໜ້າ = ຈຳນວນຂອງສະຖານະນັ້ນ (ມາຈາກຮອບນັບອັນດຽວກັນ)
  const total = status ? counts[status] : counts.total;
  const t = (await getDictionary(await getLocale())).poList;
  const statusLabels = statusLabel(t);
  const statusCount: Record<PoStatus, number> = counts;
  /** ຮັກສາຕົວກອງອື່ນໄວ້ຕອນກົດປ່ຽນອັນໜຶ່ງ — ບໍ່ດັ່ງນັ້ນຄົນຕັ້ງໃໝ່ໝົດທຸກເທື່ອ */
  const hrefWith = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams();
    const base: Record<string, string> = {};
    if (src === "repair") base.src = "repair";
    if (q) base.q = q;
    if (status) base.status = status;
    if (days !== DEFAULT_DAYS) base.days = String(days);
    Object.entries({ ...base, ...patch }).forEach(([k, v]) => {
      if (v) next.set(k, v);
    });
    const qs = next.toString();
    return qs ? `/purchase-orders?${qs}` : "/purchase-orders";
  };
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const canApprove = APPROVER_SIDE.includes(roleOf(session));
  const pageHref = (p: number) => hrefWith({ page: p > 1 ? String(p) : null });

  return (
    <div className="w-full space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-700">{tab === "issue" ? t.issueQueueTitle : t.poTitle}</h1>
          <p className="mt-0.5 text-xs text-slate-500">
            {tab === "issue"
              ? t.issueSubtitle
              : `${t.listSubtitle} · ${total} ${t.sheets}`}
          </p>
        </div>
        <div className="flex gap-2">
          {tab === "issue" ? (
            <BackLink fallback="/purchase-orders" label="{t.backToPoList}" />
          ) : (
            <Link
              href="/purchase-orders/new"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand-700 px-3 text-xs font-semibold text-white hover:bg-brand-800"
            >
              <Plus className="size-3.5" />
              {t.createPo}
              <LinkPending className="size-3" />
            </Link>
          )}
        </div>
      </div>

      {/* ແຈ້ງເຕືອນ: ໃບອະນຸມັດ (WPRA) ທີ່ຍັງບໍ່ໄດ້ອອກ PO — ຢູ່ໜ້າລາຍການເພື່ອບໍ່ໃຫ້ໃບຄ້າງເງົາ */}
      {tab === "list" && wpraRows.length > 0 && (
        <Link
          href="/purchase-orders?tab=issue"
          className="flex items-center gap-3 rounded-xl border border-brand-orange-400 bg-brand-orange-100 px-4 py-3 hover:bg-brand-orange-300"
        >
          <BellRing className="size-5 shrink-0 text-brand-900" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-brand-900">{t.waitingToIssue} — {wpraRows.length} {t.sheets}</p>
            <p className="text-xs text-brand-900">
              {t.waitingToIssueDesc}
            </p>
          </div>
          <span className="shrink-0 rounded-lg bg-brand-orange-700 px-3 py-1.5 text-xs font-semibold text-white">{t.issuePo}</span>
          <LinkPending className="size-3 text-brand-900" />
        </Link>
      )}

      {/* ຄິວ WPRA ລໍອອກ PO — ກົດແຖວເປີດໜ້າເອກະສານ (supplier + ອອກ PO ຢູ່ໜ້ານັ້ນ) */}
      {tab === "issue" && (
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-slate-600">
                  <th className="px-3 py-2.5" />
                  <th className="px-3 py-2.5 font-semibold">{t.colApprovalWpra}</th>
                  <th className="px-3 py-2.5 font-semibold">{t.colDate}</th>
                  <th className="px-3 py-2.5 font-semibold">{t.colPending}</th>
                  <th className="px-3 py-2.5 font-semibold">{t.purchaseRequest}</th>
                  <th className="px-3 py-2.5 font-semibold">{t.job}</th>
                  <th className="px-3 py-2.5 font-semibold">{t.branch}</th>
                  <th className="px-3 py-2.5 text-right font-semibold">{t.amount}</th>
                </tr>
              </thead>
              <tbody>
                {wpraRows.map((row) => (
                  <tr key={row.doc_no} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-3 py-2.5 text-center">
                      {/* ໄປໜ້າ PO ເຕັມ — ຈັດຊື້ຕ້ອງໃສ່ລາຄາ/ຜູ້ສະໜອງ/ຂົນສົ່ງ/ສາງ ຢູ່ບ່ອນນັ້ນ */}
                      <Link
                        href={`/purchase-orders/new?from=${encodeURIComponent(row.doc_no)}`}
                        className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-brand-700 px-3 text-xs font-semibold text-white hover:bg-brand-800"
                      >
                        <Plus className="size-3.5" />
                        {t.issuePo}
                        <LinkPending className="size-3" />
                      </Link>
                    </td>
                    <td className="px-3 py-2.5 font-bold text-brand">{row.doc_no}</td>
                    <td className="whitespace-nowrap px-3 py-2.5">{row.doc_date ?? "-"}</td>
                    <td className="px-3 py-2.5"><AgeBadge days={row.age} t={t} /></td>
                    <td className="whitespace-nowrap px-3 py-2.5 font-mono text-[10px] text-slate-500">{row.spr ?? "-"}</td>
                    <td className="px-3 py-2.5">
                      {isJobCode(row.job) ? (
                        <Link href={`/service/${row.job}`} className="font-medium text-brand hover:underline">
                          {row.job}
                        </Link>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5">{branchName(row.branch_code)}</td>
                    <td className="px-3 py-2.5 text-right font-semibold tabular-nums">{row.total ?? "0"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {wpraRows.length === 0 && (
            <p className="py-12 text-center text-xs text-slate-400">
              {t.noIssueQueue}
            </p>
          )}
        </section>
      )}

      {/* ຕົວກອງແຫຼ່ງທີ່ມາ — ເຫຼືອແຕ່ "ທັງໝົດ" (ແຖບ "ຈາກໃບຂໍຊື້ວຽກສ້ອມ" ຖືກລົບ 17-07-2026) */}
      {tab === "list" && (
        <div className="flex w-fit overflow-hidden rounded-lg border border-slate-300 bg-white">
          {(
            [
              { key: "all", label: t.all, href: hrefWith({ src: null, page: null }), count: src === "all" ? total : null },
            ] as const
          ).map(({ key, label, href, count }) => (
            <Link
              key={key}
              href={href}
              className={`inline-flex h-8 items-center gap-1.5 border-l border-slate-300 px-3 text-xs font-medium first:border-l-0 ${
                src === key ? "bg-brand-900 text-white" : "bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              {label}
              {count !== null && <span className="tabular-nums opacity-70">({count})</span>}
              <LinkPending className="size-3" />
            </Link>
          ))}
        </div>
      )}

      {/* ຕົວກອງສະຖານະ + ຄົ້ນຫາ — ກອງຢູ່ server ທັງຄູ່ (ຮ່ວມກັບການແບ່ງໜ້າ) */}
      {tab === "list" && (
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex w-fit overflow-hidden rounded-lg border border-slate-300 bg-white">
            {([null, "wait", "approved", "received"] as const).map((key) => (
              <Link
                key={key ?? "all"}
                href={hrefWith({ status: key, page: null })}
                className={`inline-flex h-8 items-center gap-1.5 border-l border-slate-300 px-3 text-xs font-medium first:border-l-0 ${
                  status === key ? "bg-brand-900 text-white" : "bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                {key ? statusLabels[key] : t.allStatuses}
                {key && <span className="tabular-nums opacity-70">({statusCount[key]})</span>}
                <LinkPending className="size-3" />
              </Link>
            ))}
          </div>

          {/* ຊ່ວງເວລາ — ດຶງໜ້ອຍ = ໄວ. ໃບເກົ່າກວ່ານີ້ຍັງເປີດຈາກເລກໃບ ຫຼື ຂະຫຍາຍຊ່ວງໄດ້ */}
          <div className="flex w-fit overflow-hidden rounded-lg border border-slate-300 bg-white">
            {DAY_CHOICES.map((choice) => (
              <Link
                key={choice}
                href={hrefWith({ days: choice === DEFAULT_DAYS ? null : String(choice), page: null })}
                className={`inline-flex h-8 items-center gap-1.5 border-l border-slate-300 px-3 text-xs font-medium first:border-l-0 ${
                  days === choice ? "bg-brand-900 text-white" : "bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                {dayLabel(choice, t)}
                <LinkPending className="size-3" />
              </Link>
            ))}
          </div>

          {/* ຄົ້ນຫາ: ເລກ PO · ຜູ້ສະໜອງ · ເລກ SPR · ເລກວຽກ */}
          <form className="flex items-center gap-1.5">
            {src === "repair" && <input type="hidden" name="src" value="repair" />}
            {status && <input type="hidden" name="status" value={status} />}
            {days !== DEFAULT_DAYS && <input type="hidden" name="days" value={days} />}
            <div className="relative">
              <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
              <input
                name="q"
                defaultValue={q}
                placeholder={t.searchPlaceholder}
                className="h-8 w-72 rounded-lg border border-slate-300 pl-7 pr-2 text-xs focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/10"
              />
            </div>
            <button className="inline-flex h-8 items-center rounded-lg bg-brand px-3 text-xs font-medium text-white hover:opacity-90">
              {t.search}
            </button>
            {q && (
              <Link href={hrefWith({ q: null, page: null })} className="text-xs text-slate-500 hover:underline">
                {t.clear}
              </Link>
            )}
          </form>
        </div>
      )}

      {/* ລາຍການໃບ PO — ສະຖານະໄລ່ຮອດ PUI + ອາຍຸໃບ + ແບ່ງໜ້າ */}
      {tab === "list" && (
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1050px] border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-slate-600">
                  {canApprove && <th className="px-3 py-2.5" />}
                  <th className="px-3 py-2.5 font-semibold">{t.colPoNumber}</th>
                  <th className="px-3 py-2.5 font-semibold">{t.colDate}</th>
                  <th className="px-3 py-2.5 font-semibold">{t.colAge}</th>
                  <th className="px-3 py-2.5 font-semibold">{t.colSource}</th>
                  <th className="px-3 py-2.5 font-semibold">{t.colSupplier}</th>
                  <th className="px-3 py-2.5 font-semibold">{t.colCreator}</th>
                  <th className="px-3 py-2.5 font-semibold">{t.branch}</th>
                  <th className="px-3 py-2.5 text-right font-semibold">{t.amount}</th>
                  <th className="px-3 py-2.5 font-semibold">{t.status}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.doc_no} className="border-b border-slate-100 hover:bg-slate-50">
                    {canApprove && (
                      <td className="px-3 py-2.5 text-center">
                        {!row.wpoa && !row.pui && <ApprovePoButton poNo={row.doc_no} back="/purchase-orders" />}
                      </td>
                    )}
                    <td className="px-3 py-2.5 font-bold">
                      {/* ໜ້າເອກະສານຮັບເລກ PO ໂດຍກົງ — ໃບຂອງຕ່ອງໂສ້ SPR ມັນເດັ້ງໄປໜ້າ SPR ເອງ */}
                      <Link href={`/purchase-orders/${encodeURIComponent(row.doc_no)}`} className="text-brand hover:underline">
                        {row.doc_no}
                      </Link>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5">{row.doc_date ?? "-"}</td>
                    <td className="px-3 py-2.5"><AgeBadge days={row.age} t={t} /></td>
                    <td className="px-3 py-2.5">
                      {row.spr ? (
                        <span className="inline-flex flex-col items-start">
                          {isJobCode(row.job) ? (
                            <Link href={`/service/${row.job}`} className="font-medium text-brand hover:underline">
                              {t.job} {row.job}
                            </Link>
                          ) : (
                            <span className="font-medium text-slate-600">{t.purchaseRequest}</span>
                          )}
                          <span className="font-mono text-[9px] text-slate-400">{row.spr}</span>
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-400">{t.direct}</span>
                      )}
                    </td>
                    <td className="max-w-52 truncate px-3 py-2.5" title={row.supplier_name ?? ""}>
                      <span className="font-mono text-[10px] text-slate-400">{row.supplier ?? "-"}</span>{" "}
                      {row.supplier_name ?? ""}
                    </td>
                    {/* ຜູ້ສ້າງເອກະສານ — ຊື່ພະນັກງານ + ລະຫັດ (ໃບເກົ່າທີ່ບໍ່ມີຊື່ ສະແດງລະຫັດຢ່າງດຽວ) */}
                    <td className="whitespace-nowrap px-3 py-2.5">
                      {row.creator ? (
                        <span className="inline-flex flex-col items-start">
                          <span className="font-medium text-slate-600">{row.creator_name ?? row.creator}</span>
                          {row.creator_name && (
                            <span className="font-mono text-[9px] text-slate-400">{row.creator}</span>
                          )}
                        </span>
                      ) : (
                        <span className="text-slate-300">-</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5">{branchName(row.branch_code)}</td>
                    <td className="px-3 py-2.5 text-right font-semibold tabular-nums">{row.total ?? "0"}</td>
                    <td className="px-3 py-2.5"><StatusChip row={row} t={t} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {rows.length === 0 && (
            <p className="py-12 text-center text-xs text-slate-400">
              {t.noPoPrefix} &ldquo;{t.createPo}&rdquo;
            </p>
          )}

          {/* ── ແບ່ງໜ້າ ── */}
          {pages > 1 && (
            <div className="flex items-center justify-between border-t border-slate-100 px-4 py-2.5 text-xs text-slate-500">
              <span>
                {t.page} {page} / {pages} · {t.all} {total} {t.sheets}
              </span>
              <div className="flex gap-1.5">
                <Link
                  href={pageHref(page - 1)}
                  aria-disabled={page <= 1}
                  className={`inline-flex h-8 items-center gap-1 rounded-lg border px-2.5 font-semibold ${
                    page <= 1
                      ? "pointer-events-none border-slate-200 text-slate-300"
                      : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <ChevronLeft className="size-3.5" />
                  {t.prev}
                </Link>
                <Link
                  href={pageHref(page + 1)}
                  aria-disabled={page >= pages}
                  className={`inline-flex h-8 items-center gap-1 rounded-lg border px-2.5 font-semibold ${
                    page >= pages
                      ? "pointer-events-none border-slate-200 text-slate-300"
                      : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {t.next}
                  <ChevronRight className="size-3.5" />
                </Link>
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
