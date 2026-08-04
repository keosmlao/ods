import { query, queryOdg } from "@/lib/db";
import { LINE_STATUS, TRANS } from "@/lib/stock-constants";

/**
 * **ອາໄຫຼ່ຂອງໃບງານສ້ອມ — ອ່ານເປັນ "ຮອບ"**.
 *
 * ── ເປັນຫຍັງຕ້ອງມີໄຟລ໌ນີ້ ──
 * ວຽກໜຶ່ງ **ຂໍເບີກ ແລະ ສັ່ງຊື້ໄດ້ຫຼາຍເທື່ອ** ຕາມຄວາມຈິງ (ກວດແລ້ວຂໍຮອບ 1 → ຮື້ອອກມາພົບ
 * ຕ້ອງໃຊ້ເພີ່ມ → ຂໍຮອບ 2 → ສາງບໍ່ມີ → ສັ່ງຊື້ …). ຂໍ້ມູນຈິງ 04-08-2026:
 * **399 ໃບງານຂໍເບີກຫຼາຍກວ່າ 1 ຮອບ** (ຮອດ 4 ຮອບ) ແລະ **81 ໃບສັ່ງຊື້ຫຼາຍຮອບ**.
 *
 * ແຕ່ `tb_product` ເກັບແຕ່ **timestamp ດຽວຕໍ່ຂັ້ນ** (`spare_reg` · `spare_finish` ·
 * `spare_order` · `spare_arrive`) ⇒ ຮອບຫຼັງທັບຮອບກ່ອນ, ບາງໃບ `spare_finish` ຢູ່ກ່ອນ
 * `spare_reg` (ໃບ 6917) ແລະ **ບໍ່ມີບ່ອນໃດໃນລະບົບເຫັນວ່າຮອບໃດຄ້າງຢູ່ໃສ**.
 *
 * ⇒ ບ່ອນນີ້ບໍ່ອ່ານ 4 ຖັນນັ້ນເລີຍ — ອ່ານຈາກ **ເອກະສານ** ເຊິ່ງເປັນຄວາມຈິງ:
 *   ຂໍເບີກ  SIO (122) → ສາງເບີກ SWC (56) → ຊ່າງຮັບ PISP (166)
 *   ຂໍຊື້   RQ  (78, ຢູ່ ODS) → ອະນຸມັດ → ໃບ ERP (ຕິດຕາມຕໍ່ຢູ່ lib/erp-purchase)
 * (ຫຼັກການດຽວກັນກັບ lib/install-spare-gate: "ບັນຊີເອກະສານເທົ່ານັ້ນທີ່ບອກຄວາມຈິງໄດ້")
 */

/** ໃບຂໍເບີກ 1 ຮອບ ພ້ອມປາຍທາງຂອງມັນ */
/** ລາຍການສິນຄ້າໃນໃບ (ຊື່ + ຈຳນວນ) — ຄົນຢາກເຫັນວ່າ "ອາໄຫຼ່ຫຍັງ" ບໍ່ແມ່ນແຕ່ "ກີ່ລາຍການ" */
export type DocItem = { item_code: string; item_name: string | null; qty: number };

export type WithdrawRound = {
  items: DocItem[];
  round: number;
  doc_no: string;
  doc_date: string | null;
  wh_code: string | null;
  lines: number;
  qty: number;
  /** ໃບເບີກຂອງສາງ (SWC) — ຫວ່າງ = ສາງຍັງບໍ່ຈ່າຍ */
  dispatch_no: string | null;
  dispatch_date: string | null;
  /** ໃບຮັບຂອງຊ່າງ (PISP) — ຫວ່າງ = ຈ່າຍແລ້ວແຕ່ຊ່າງຍັງບໍ່ກົດຮັບ */
  pick_no: string | null;
  pick_date: string | null;
  state: "requested" | "dispatched" | "received";
};

/** ໃບຂໍຊື້ 1 ຮອບ (ຝັ່ງ ODS — ຕ່ອງໂສ້ ERP ຕິດຕາມແຍກຢູ່ lib/erp-purchase) */
export type PurchaseRound = {
  items: DocItem[];
  round: number;
  doc_no: string;
  doc_date: string | null;
  /** ໃບຂໍເບີກທີ່ເປັນຕົ້ນເຫດ (ຂໍແລ້ວສາງບໍ່ມີ) */
  from_request: string | null;
  lines: number;
  qty: number;
  state: "waiting_approve" | "approved" | "rejected";
};

/** ສະຖານະຂອງແຕ່ລະຮອບ ເປັນຄຳເວົ້າ + ໃຜຕ້ອງລົງມືຕໍ່ */
export const WITHDRAW_STATE: Record<WithdrawRound["state"], { label: string; next: string; tone: string }> = {
  requested: { label: "ລໍສາງເບີກ", next: "ສາງ", tone: "bg-amber-100 text-amber-800" },
  dispatched: { label: "ສາງເບີກແລ້ວ ລໍຊ່າງຮັບ", next: "ຊ່າງ", tone: "bg-blue-50 text-blue-700" },
  received: { label: "ຊ່າງຮັບແລ້ວ", next: "—", tone: "bg-emerald-50 text-emerald-700" },
};

export const PURCHASE_STATE: Record<PurchaseRound["state"], { label: string; next: string; tone: string }> = {
  waiting_approve: { label: "ລໍອະນຸມັດ", next: "ຜູ້ຈັດການ", tone: "bg-amber-100 text-amber-800" },
  approved: { label: "ອະນຸມັດແລ້ວ — ຕິດຕາມຢູ່ ERP", next: "ຈັດຊື້", tone: "bg-blue-50 text-blue-700" },
  rejected: { label: "ບໍ່ອະນຸມັດ", next: "—", tone: "bg-red-50 text-red-700" },
};


/** ລາຍການສິນຄ້າຂອງແຕ່ລະໃບ — ດຶງເທື່ອດຽວ ແລ້ວແຈກໃສ່ຮອບ */
async function itemsByDoc(docNos: string[]): Promise<Record<string, DocItem[]>> {
  const keys = [...new Set(docNos.filter(Boolean))];
  if (keys.length === 0) return {};
  const { rows } = await query<DocItem & { doc_no: string }>(
    `select d.doc_no, d.item_code, d.item_name, coalesce(d.qty,0)::float8 qty
       from ic_trans_detail d where d.doc_no = any($1::text[])
      order by d.doc_no, d.line_number`,
    [keys],
  );
  const map: Record<string, DocItem[]> = {};
  for (const { doc_no, ...item } of rows) (map[doc_no] ??= []).push(item);
  return map;
}

/**
 * ຮອບຂໍເບີກທັງໝົດຂອງໃບງານ.
 *
 * ⚠️ 1 ໃບຂໍ ອາດຖືກເບີກເປັນຫຼາຍໃບ (ຄົນລະສາງ) ⇒ ລວມເລກໃບດ້ວຍ string_agg
 * ບໍ່ດັ່ງນັ້ນ join ຈະຄູນແຖວ ແລ້ວນັບຮອບຜິດ.
 */
export async function withdrawRounds(code: string): Promise<WithdrawRound[]> {
  const rows = (
    await query<Omit<WithdrawRound, "round" | "state">>(
      `select t.doc_no,
          to_char(t.doc_date,'DD-MM-YYYY') doc_date,
          nullif(t.wh_code,'') wh_code,
          (select count(*) from ic_trans_detail d where d.doc_no = t.doc_no)::int lines,
          (select coalesce(sum(d.qty),0) from ic_trans_detail d where d.doc_no = t.doc_no)::float8 qty,
          (select string_agg(distinct sw.doc_no, ', ') from ic_trans sw
            where sw.trans_flag = $2 and sw.doc_ref = t.doc_no) dispatch_no,
          (select to_char(min(sw.doc_date),'DD-MM-YYYY') from ic_trans sw
            where sw.trans_flag = $2 and sw.doc_ref = t.doc_no) dispatch_date,
          (select string_agg(distinct pi.doc_no, ', ') from ic_trans pi
            where pi.trans_flag = 166 and pi.doc_ref in (
              select sw.doc_no from ic_trans sw where sw.trans_flag = $2 and sw.doc_ref = t.doc_no)) pick_no,
          (select to_char(min(pi.doc_date),'DD-MM-YYYY') from ic_trans pi
            where pi.trans_flag = 166 and pi.doc_ref in (
              select sw.doc_no from ic_trans sw where sw.trans_flag = $2 and sw.doc_ref = t.doc_no)) pick_date
        from ic_trans t
       where t.trans_flag = $3 and t.product_code = $1
       order by t.doc_date, t.doc_no`,
      [code, TRANS.DISPATCH, TRANS.REQUEST],
    )
  ).rows;

  const items = await itemsByDoc(rows.map((row) => row.doc_no));
  return rows.map((row, index) => ({
    ...row,
    items: items[row.doc_no] ?? [],
    round: index + 1,
    state: row.pick_no ? "received" : row.dispatch_no ? "dispatched" : "requested",
  }));
}

/** ຮອບຂໍຊື້ທັງໝົດຂອງໃບງານ (RQ ຝັ່ງ ODS) */
export async function purchaseRounds(code: string): Promise<PurchaseRound[]> {
  const rows = (
    await query<Omit<PurchaseRound, "round" | "state"> & { aprove_status: number | null }>(
      `select t.doc_no,
          to_char(t.doc_date,'DD-MM-YYYY') doc_date,
          nullif(split_part(trim(coalesce(t.doc_ref,'')),' ',1),'') from_request,
          (select count(*) from ic_trans_detail d where d.doc_no = t.doc_no)::int lines,
          (select coalesce(sum(d.qty),0) from ic_trans_detail d where d.doc_no = t.doc_no)::float8 qty,
          coalesce(t.aprove_status,0)::int aprove_status
        from ic_trans t
       where t.trans_flag = 78 and t.product_code = $1
       order by t.doc_date, t.doc_no`,
      [code],
    )
  ).rows;

  const items = await itemsByDoc(rows.map((row) => row.doc_no));
  return rows.map(({ aprove_status, ...row }, index) => ({
    ...row,
    items: items[row.doc_no] ?? [],
    round: index + 1,
    // 0 = ຍັງບໍ່ພິຈາລະນາ · 1 = ອະນຸມັດ · 2 = ບໍ່ອະນຸມັດ (ຄືກັບໜ້າ /approvals/purchase-requests)
    state: aprove_status === 1 ? "approved" : aprove_status === 2 ? "rejected" : "waiting_approve",
  }));
}

/**
 * ສະຖານະແຖວຂອງແຕ່ລະໃບຂໍເບີກ (SIO) — **ນິຍາມດຽວກັບຄິວເວັບ** (request_status):
 * ມີແຖວ status=5 ທີ່ arrive_at ຫວ່າງ ⇒ 'purchasing' · ທຸກແຖວ status=1 ⇒ 'issued'
 * · ບາງແຖວ ⇒ 'partial' · ນອກນັ້ນ 'waiting' · ບໍ່ມີແຖວ ⇒ null.
 * API ມືຖືເອົາໄປແທກໃສ່ຮອບ — ຊ່າງເຫັນ "ຮອບໃດກຳລັງສັ່ງຊື້" ຄືກັບເວັບ.
 */
export type RoundLineStatus = {
  status: "waiting" | "partial" | "purchasing" | "issued" | null;
  /** ແຖວກຳລັງສັ່ງຊື້ (status=5 ແລະ arrive_at ຫວ່າງ) */
  on_order: number;
  /** ແຖວທີ່ມາຮອດແລ້ວ (status=5 ແລະ arrive_at ບໍ່ຫວ່າງ) — ພ້ອມເບີກ */
  arrived: number;
};

export async function withdrawLineStatuses(code: string): Promise<Record<string, RoundLineStatus>> {
  const rows = (
    await query<{ doc_no: string; status: RoundLineStatus["status"]; on_order: number; arrived: number }>(
      `select t.doc_no,
          case
            when count(d.doc_no) = 0 then null
            when count(d.doc_no) filter (where coalesce(d.status,0) = ${LINE_STATUS.ON_PURCHASE_ORDER} and d.arrive_at is null) > 0 then 'purchasing'
            when count(d.doc_no) filter (where d.status = ${LINE_STATUS.ISSUED}) = count(d.doc_no) then 'issued'
            when count(d.doc_no) filter (where d.status = ${LINE_STATUS.ISSUED}) > 0 then 'partial'
            else 'waiting'
          end status,
          count(d.doc_no) filter (where coalesce(d.status,0) = ${LINE_STATUS.ON_PURCHASE_ORDER} and d.arrive_at is null)::int on_order,
          count(d.doc_no) filter (where coalesce(d.status,0) = ${LINE_STATUS.ON_PURCHASE_ORDER} and d.arrive_at is not null)::int arrived
        from ic_trans t
        left join ic_trans_detail d on d.doc_no = t.doc_no
       where t.trans_flag = ${TRANS.REQUEST} and t.product_code = $1
       group by t.doc_no`,
      [code],
    )
  ).rows;

  return Object.fromEntries(
    rows.map(({ doc_no, ...status }) => [doc_no, status]),
  );
}


/**
 * **ຕ່ອງໂສ້ຝັ່ງ ERP ຂອງແຕ່ລະໃບຂໍຊື້ (RQ)** — SPR → ອະນຸມັດ WPRA → ໃບສັ່ງຊື້ PO → ອະນຸມັດ PO → ຮັບເຂົ້າສາງ PUI.
 *
 * ໃບ ERP ຜູກກັບ RQ ຜ່ານ `doc_ref` (ຕອນອອກ SPR ລະບົບຂຽນເລກ RQ ໄວ້) — ຂັ້ນຕໍ່ໆໄປໄລ່ດ້ວຍ
 * `ref_doc_no` ຄືກັບ lib/erp-purchase. ⚠️ WPOA ຜູກທາງ **ຫົວໃບ** (doc_ref) ບໍ່ແມ່ນທາງແຖວ.
 * ERP ລົ້ມ ⇒ ຄືນ map ຫວ່າງ (ໜ້າຈໍຍັງເປີດໄດ້ ພຽງແຕ່ບໍ່ມີຕ່ອງໂສ້).
 */
export type ErpChain = {
  spr_no: string | null; spr_date: string | null;
  approve_no: string | null; approve_date: string | null;
  order_no: string | null; order_date: string | null;
  oa_no: string | null;
  receipt_no: string | null; receipt_date: string | null;
};

export async function erpChainForRq(rqNos: string[]): Promise<Record<string, ErpChain>> {
  const keys = [...new Set(rqNos.filter(Boolean))];
  if (keys.length === 0) return {};
  try {
    /**
     * ຂັ້ນ ①: RQ → SPR **ອ່ານຈາກ ODS** — ໃບ SPR ຢູ່ ERP ມີ `doc_ref` ຫວ່າງ (ກວດແລ້ວ
     * 04-08-2026: SPR26060027 · SPR26070014 ທັງສອງ doc_ref = '') ⇒ ຜູກຈາກຝັ່ງ ERP ບໍ່ໄດ້.
     * ສຳເນົາຝັ່ງ ODS ເກັບ doc_ref = ເລກ RQ ໄວ້ ⇒ ໃຊ້ອັນນັ້ນເປັນສະພານ.
     */
    const bridge = (
      await query<{ rq: string; spr: string; spr_date: string | null }>(
        `select split_part(trim(coalesce(t.doc_ref,'')),' ',1) rq, t.doc_no spr,
            to_char(t.doc_date,'DD-MM-YYYY') spr_date
           from ic_trans t
          where t.trans_flag = 2 and split_part(trim(coalesce(t.doc_ref,'')),' ',1) = any($1::text[])`,
        [keys],
      )
    ).rows;
    if (bridge.length === 0) return {};

    // ຂັ້ນ ②: ຈາກ SPR ໄລ່ຕໍ່ຢູ່ **ERP** (WPRA → PO → WPOA → PUI) ດ້ວຍ ref_doc_no
    const chains = (
      await queryOdg<{
        spr: string;
        approve_no: string | null; approve_date: string | null;
        order_no: string | null; order_date: string | null;
        oa_no: string | null;
        receipt_no: string | null; receipt_date: string | null;
      }>(
        `with ap as (
           select d.ref_doc_no spr, d.doc_no, d.doc_date
             from ic_trans_detail d where d.trans_flag = 4 and d.ref_doc_no = any($1::text[])
         ), po as (
           select ap.spr, d.doc_no, d.doc_date
             from ap join ic_trans_detail d on d.ref_doc_no = ap.doc_no and d.trans_flag = 6
         ), rc as (
           select po.spr, d.doc_no, d.doc_date
             from po join ic_trans_detail d on d.ref_doc_no = po.doc_no and d.trans_flag = 12
         )
         select s.spr,
           (select string_agg(distinct a.doc_no, ', ') from ap a where a.spr = s.spr) approve_no,
           (select to_char(min(a.doc_date),'DD-MM-YYYY') from ap a where a.spr = s.spr) approve_date,
           (select string_agg(distinct o.doc_no, ', ') from po o where o.spr = s.spr) order_no,
           (select to_char(min(o.doc_date),'DD-MM-YYYY') from po o where o.spr = s.spr) order_date,
           (select string_agg(distinct w.doc_no, ', ') from ic_trans w
             where w.trans_flag = 8 and split_part(trim(coalesce(w.doc_ref,'')),' ',1)
                   in (select o.doc_no from po o where o.spr = s.spr)) oa_no,
           (select string_agg(distinct r.doc_no, ', ') from rc r where r.spr = s.spr) receipt_no,
           (select to_char(max(r.doc_date),'DD-MM-YYYY') from rc r where r.spr = s.spr) receipt_date
         from (select unnest($1::text[]) spr) s`,
        [bridge.map((row) => row.spr)],
      )
    ).rows;
    const bySpr = new Map(chains.map((chain) => [chain.spr, chain]));

    return Object.fromEntries(
      bridge.map((row) => {
        const chain = bySpr.get(row.spr);
        return [
          row.rq,
          {
            spr_no: row.spr,
            spr_date: row.spr_date,
            approve_no: chain?.approve_no ?? null,
            approve_date: chain?.approve_date ?? null,
            order_no: chain?.order_no ?? null,
            order_date: chain?.order_date ?? null,
            oa_no: chain?.oa_no ?? null,
            receipt_no: chain?.receipt_no ?? null,
            receipt_date: chain?.receipt_date ?? null,
          } satisfies ErpChain,
        ];
      }),
    );
  } catch (error) {
    console.error("erpChainForRq failed", error);
    return {};
  }
}

/** ອາໄຫຼ່ທັງໝົດຂອງໃບງານ ແຍກເປັນຮອບ — ດຶງພ້ອມກັນ (ບໍ່ຂຶ້ນຕໍ່ກັນ) */
export async function repairSpareRounds(code: string) {
  const [withdrawals, purchases] = await Promise.all([withdrawRounds(code), purchaseRounds(code)]);
  // ຕ່ອງໂສ້ ERP ຂອງທຸກຮອບຊື້ — ດຶງເທື່ອດຽວຫຼັງຮູ້ເລກ RQ ຄົບ
  const erp = await erpChainForRq(purchases.map((round) => round.doc_no));
  return { withdrawals, purchases, erp };
}
