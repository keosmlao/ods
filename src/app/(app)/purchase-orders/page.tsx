import { ApprovePoButton } from "@/app/(app)/purchase-orders/approve-po-button";
import { LinkPending } from "@/components/link-pending";
import { getSession } from "@/lib/auth";
import { queryOdg } from "@/lib/db";
import { APPROVER_SIDE, roleOf } from "@/lib/roles";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getLocale } from "@/lib/i18n/locale";
import { ERP_PURCHASE } from "@/lib/stock-constants";
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
 * ສະແດງສະເພາະ PO ຂອງສາຍງານສ້ອມ = PO ທີ່ doc_ref ຊີ້ໃສ່ WPRA ທີ່ອ້າງອີງ SPR
 * (PO ຂອງຝ່າຍອື່ນອ້າງອີງ PRHN/PRTN — ບໍ່ກ່ຽວກັບເຮົາ ບໍ່ເອົາມາປົນ).
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
        days >= 14 ? "bg-red-100 text-red-700" : days >= 7 ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-600"
      }`}
    >
      {days} {t.daysUnit}
    </span>
  );
}

type Props = { searchParams: Promise<{ tab?: string; page?: string; src?: string; q?: string; status?: string }> };

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
  branch_code: string | null;
  total: string | null;
  wpoa: string | null;
  pui: string | null;
  items: number;
  items_received: number;
};

/**
 * ── PO ໃບໃດ "ຂອງເຮົາ" ──
 * ① ຈາກໃບຂໍຊື້ຂອງວຽກສ້ອມ (ຕ່ອງໂສ້ຫາ SPR ພົບ) — 115 ໃບ/ປີ
 * ② **ອອກໂດຍກົງ** (ບໍ່ອ້າງອີງໃບໃດ — ຊື້ຕຸນເຂົ້າສາງ/ຊື້ດ່ວນ, ອອກຈາກລະບົບນີ້ ຫຼື ERP) — 1,305 ໃບ/ປີ
 * ໃບທີ່ອ້າງອີງ PRHN/PRTN = ໃບຂໍຊື້ຂອງ**ຝ່າຍອື່ນ** (767 ໃບ) — ບໍ່ກ່ຽວ ບໍ່ເອົາມາປົນ.
 */
const FROM_SPR = `exists (
  select 1 from ic_trans_detail d
   where d.doc_no=t.doc_no and d.trans_flag=$1
     and d.ref_doc_no in (
       select w.doc_no from ic_trans_detail w
        where w.trans_flag=$2 and w.ref_doc_no like 'SPR%')
)`;
const STANDALONE = `not exists (
  select 1 from ic_trans_detail x
   where x.doc_no=t.doc_no and x.trans_flag=$1 and coalesce(x.ref_doc_no,'') <> ''
)`;
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

const whereOf = (src: "all" | "repair") =>
  `t.trans_flag=$1 and t.doc_date >= current_date - 365 and ${src === "repair" ? FROM_SPR : `(${FROM_SPR} or ${STANDALONE})`}`;

/**
 * ── ເປັນຫຍັງບໍ່ໃຊ້ `whereOf` ໃນການນັບ ──
 * `whereOf` ຖາມ `exists(...)` **ຄືນທຸກແຖວ** ຂອງ ic_trans ⇒ ນັບເທື່ອໜຶ່ງກິນ 566ms.
 * ບ່ອນນີ້ຄິດ "ໃບໃດເປັນຂອງເຮົາ" **ເທື່ອດຽວເປັນຕາຕະລາງ** ແລ້ວ join ⇒ 265ms
 * (ຢືນຢັນແລ້ວວ່າໄດ້ຕົວເລກຕົງກັນຄືເກົ່າ: ທັງໝົດ 1,425 ໃບ · ສະເພາະງານສ້ອມ 116 ໃບ).
 * `wpra` = ໃບອະນຸມັດຂໍຊື້ທີ່ອ້າງອີງ SPR ຂອງງານສ້ອມ · `mine` = ສະຫຼຸບຕໍ່ໃບ PO.
 */
const MINE_CTE = `with wpra as (
    select distinct w.doc_no from ic_trans_detail w
     where w.trans_flag=$2 and w.ref_doc_no like 'SPR%'),
  mine as (
    select d.doc_no,
        bool_or(coalesce(d.ref_doc_no,'') <> '') has_ref,
        bool_or(d.ref_doc_no in (select doc_no from wpra)) from_spr
      from ic_trans_detail d where d.trans_flag=$1 group by d.doc_no)`;

const COUNT_SQL = (src: "all" | "repair", status: PoStatus | null) => `${MINE_CTE}
  select count(*)::int count from ic_trans t
   ${src === "repair" ? "join" : "left join"} mine m on m.doc_no = t.doc_no
   where t.trans_flag=$1 and t.doc_date >= current_date - 365
     and ${src === "repair" ? "m.from_spr" : "(coalesce(m.from_spr,false) or not coalesce(m.has_ref,false))"}
     ${status ? `and ${STATUS_WHERE[status]}` : ""}
     ${SEARCH_SQL(5)}`;

async function countRows(src: "all" | "repair", q = "", status: PoStatus | null = null): Promise<number> {
  try {
    const rows = await queryOdg<{ count: number }>(COUNT_SQL(src, status), [
      ERP_PURCHASE.ORDER, ERP_PURCHASE.PR_APPROVE, ERP_PURCHASE.ORDER_APPROVE, ERP_PURCHASE.RECEIPT, q,
    ]);
    return rows.rows[0]?.count ?? 0;
  } catch {
    return 0;
  }
}

async function getRows(page: number, src: "all" | "repair", q = "", status: PoStatus | null = null): Promise<Row[]> {
  try {
    const rows = await queryOdg<Row>(
      /**
       * ຕັດໜ້າກ່ອນ (po) ແລ້ວຈຶ່ງເອົາຂໍ້ມູນປະກອບ — ບໍ່ດັ່ງນັ້ນ subquery ຈະແລ່ນທົ່ວຕາຕະລາງ.
       * `wpoa` ຜູກທາງ**ຫົວໃບ** (ແຖວຂອງມັນ ref_doc_no ຫວ່າງ 100% — ເບິ່ງ lib/erp-purchase)
       * ແລະ ຕ້ອງ `split_part(trim(doc_ref))` ⇒ index ໃຊ້ບໍ່ໄດ້. ເມື່ອກ່ອນເປັນ subquery
       * ຕໍ່ແຖວ ⇒ ໄລ່ 5,469 ແຖວ **ຕໍ່ PO ໜຶ່ງໃບ** (483ms). ລວມຄ່າໄວ້ກ່ອນແລ້ວ join = 56ms.
       */
      `with po as (
          select t.* from ic_trans t where ${whereOf(src)} ${status ? `and ${STATUS_WHERE[status]}` : ""} ${SEARCH_SQL(8)}
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
        PAGE_SIZE, (page - 1) * PAGE_SIZE, ERP_PURCHASE.PR_REQUEST, q,
      ],
    );
    return rows.rows;
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
        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
          ຮັບເຂົ້າສາງແລ້ວ
        </span>
        <span className="font-mono text-[9px] text-slate-400" title={row.pui}>{row.pui}</span>
      </span>
    );
  }
  if (row.pui) {
    return (
      <span className="inline-flex flex-col items-start gap-0.5">
        <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-semibold text-sky-700">
          {t.receivedPartial} {row.items_received}/{row.items}
        </span>
        <span className="font-mono text-[9px] text-slate-400" title={row.pui}>{row.pui}</span>
      </span>
    );
  }
  if (row.wpoa) {
    return (
      <span className="inline-flex flex-col items-start gap-0.5">
        <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
          {t.statusApproved}
        </span>
        <span className="font-mono text-[9px] text-slate-400">{row.wpoa}</span>
      </span>
    );
  }
  return (
    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">{t.waitApprovalPo}</span>
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
  // ຕົວເລກຂອງທຸກແທັບຄິດພ້ອມກັນ — ຄົນຕ້ອງເຫັນວ່າແຕ່ລະສະຖານະມີຈັກໃບກ່ອນກົດ
  const [rows, total, wait, approved, received, wpraRows, session] = await Promise.all([
    getRows(page, src, q, status),
    countRows(src, q, status),
    countRows(src, q, "wait"),
    countRows(src, q, "approved"),
    countRows(src, q, "received"),
    getWpraWaiting(),
    getSession(),
  ]);
  const t = (await getDictionary(await getLocale())).poList;
  const statusLabels = statusLabel(t);
  const statusCount: Record<PoStatus, number> = { wait, approved, received };
  /** ຮັກສາຕົວກອງອື່ນໄວ້ຕອນກົດປ່ຽນອັນໜຶ່ງ — ບໍ່ດັ່ງນັ້ນຄົນຕັ້ງໃໝ່ໝົດທຸກເທື່ອ */
  const hrefWith = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams();
    const base: Record<string, string> = {};
    if (src === "repair") base.src = "repair";
    if (q) base.q = q;
    if (status) base.status = status;
    Object.entries({ ...base, ...patch }).forEach(([k, v]) => {
      if (v) next.set(k, v);
    });
    const qs = next.toString();
    return qs ? `/purchase-orders?${qs}` : "/purchase-orders";
  };
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const canApprove = APPROVER_SIDE.includes(roleOf(session));
  const pageHref = (p: number) => `/purchase-orders?src=${src}&page=${p}`;

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
            <Link
              href="/purchase-orders"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              <ArrowLeft className="size-3.5" />
              {t.backToPoList}
              <LinkPending className="size-3" />
            </Link>
          ) : (
            <Link
              href="/purchase-orders/new"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-teal-600 px-3 text-xs font-semibold text-white hover:bg-teal-700"
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
          className="flex items-center gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 hover:bg-amber-100"
        >
          <BellRing className="size-5 shrink-0 text-amber-600" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-amber-800">{t.waitingToIssue} — {wpraRows.length} {t.sheets}</p>
            <p className="text-xs text-amber-700">
              {t.waitingToIssueDesc}
            </p>
          </div>
          <span className="shrink-0 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white">{t.issuePo}</span>
          <LinkPending className="size-3 text-amber-600" />
        </Link>
      )}

      {/* ຄິວ WPRA ລໍອອກ PO — ກົດແຖວເປີດໜ້າເອກະສານ (supplier + ອອກ PO ຢູ່ໜ້ານັ້ນ) */}
      {tab === "issue" && (
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-slate-600">
                  <th className="px-3 py-2.5 font-semibold">{t.colApprovalWpra}</th>
                  <th className="px-3 py-2.5 font-semibold">{t.colDate}</th>
                  <th className="px-3 py-2.5 font-semibold">{t.colPending}</th>
                  <th className="px-3 py-2.5 font-semibold">{t.purchaseRequest}</th>
                  <th className="px-3 py-2.5 font-semibold">{t.job}</th>
                  <th className="px-3 py-2.5 font-semibold">{t.branch}</th>
                  <th className="px-3 py-2.5 text-right font-semibold">{t.amount}</th>
                  <th className="px-3 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {wpraRows.map((row) => (
                  <tr key={row.doc_no} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-3 py-2.5 font-bold text-[#0536a9]">{row.doc_no}</td>
                    <td className="whitespace-nowrap px-3 py-2.5">{row.doc_date ?? "-"}</td>
                    <td className="px-3 py-2.5"><AgeBadge days={row.age} t={t} /></td>
                    <td className="whitespace-nowrap px-3 py-2.5 font-mono text-[10px] text-slate-500">{row.spr ?? "-"}</td>
                    <td className="px-3 py-2.5">
                      {isJobCode(row.job) ? (
                        <Link href={`/service/${row.job}`} className="font-medium text-[#0536a9] hover:underline">
                          {row.job}
                        </Link>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5">{branchName(row.branch_code)}</td>
                    <td className="px-3 py-2.5 text-right font-semibold tabular-nums">{row.total ?? "0"}</td>
                    <td className="px-3 py-2.5 text-center">
                      {/* ໄປໜ້າ PO ເຕັມ — ຈັດຊື້ຕ້ອງໃສ່ລາຄາ/ຜູ້ສະໜອງ/ຂົນສົ່ງ/ສາງ ຢູ່ບ່ອນນັ້ນ */}
                      <Link
                        href={`/purchase-orders/new?from=${encodeURIComponent(row.doc_no)}`}
                        className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-teal-600 px-3 text-xs font-semibold text-white hover:bg-teal-700"
                      >
                        <Plus className="size-3.5" />
                        {t.issuePo}
                        <LinkPending className="size-3" />
                      </Link>
                    </td>
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
                src === key ? "bg-slate-900 text-white" : "bg-white text-slate-600 hover:bg-slate-50"
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
                  status === key ? "bg-slate-900 text-white" : "bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                {key ? statusLabels[key] : t.allStatuses}
                {key && <span className="tabular-nums opacity-70">({statusCount[key]})</span>}
                <LinkPending className="size-3" />
              </Link>
            ))}
          </div>

          {/* ຄົ້ນຫາ: ເລກ PO · ຜູ້ສະໜອງ · ເລກ SPR · ເລກວຽກ */}
          <form className="flex items-center gap-1.5">
            {src === "repair" && <input type="hidden" name="src" value="repair" />}
            {status && <input type="hidden" name="status" value={status} />}
            <div className="relative">
              <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
              <input
                name="q"
                defaultValue={q}
                placeholder={t.searchPlaceholder}
                className="h-8 w-72 rounded-lg border border-slate-300 pl-7 pr-2 text-xs focus:border-[#0536a9] focus:outline-none focus:ring-2 focus:ring-[#0536a9]/10"
              />
            </div>
            <button className="inline-flex h-8 items-center rounded-lg bg-[#0536a9] px-3 text-xs font-medium text-white hover:opacity-90">
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
                  <th className="px-3 py-2.5 font-semibold">{t.colPoNumber}</th>
                  <th className="px-3 py-2.5 font-semibold">{t.colDate}</th>
                  <th className="px-3 py-2.5 font-semibold">{t.colAge}</th>
                  <th className="px-3 py-2.5 font-semibold">{t.colSource}</th>
                  <th className="px-3 py-2.5 font-semibold">{t.colSupplier}</th>
                  <th className="px-3 py-2.5 font-semibold">{t.branch}</th>
                  <th className="px-3 py-2.5 text-right font-semibold">{t.amount}</th>
                  <th className="px-3 py-2.5 font-semibold">{t.status}</th>
                  {canApprove && <th className="px-3 py-2.5" />}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.doc_no} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-3 py-2.5 font-bold">
                      {/* ໜ້າເອກະສານຮັບເລກ PO ໂດຍກົງ — ໃບຂອງຕ່ອງໂສ້ SPR ມັນເດັ້ງໄປໜ້າ SPR ເອງ */}
                      <Link href={`/purchase-orders/${encodeURIComponent(row.doc_no)}`} className="text-[#0536a9] hover:underline">
                        {row.doc_no}
                      </Link>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5">{row.doc_date ?? "-"}</td>
                    <td className="px-3 py-2.5"><AgeBadge days={row.age} t={t} /></td>
                    <td className="px-3 py-2.5">
                      {row.spr ? (
                        <span className="inline-flex flex-col items-start">
                          {isJobCode(row.job) ? (
                            <Link href={`/service/${row.job}`} className="font-medium text-[#0536a9] hover:underline">
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
                    <td className="whitespace-nowrap px-3 py-2.5">{branchName(row.branch_code)}</td>
                    <td className="px-3 py-2.5 text-right font-semibold tabular-nums">{row.total ?? "0"}</td>
                    <td className="px-3 py-2.5"><StatusChip row={row} t={t} /></td>
                    {canApprove && (
                      <td className="px-3 py-2.5 text-center">
                        {!row.wpoa && !row.pui && <ApprovePoButton poNo={row.doc_no} back="/purchase-orders" />}
                      </td>
                    )}
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
