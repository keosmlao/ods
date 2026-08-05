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

/** ໃບເບີກ 1 ໃບ ພ້ອມລາຍການຂອງມັນເອງ — ບອກໄດ້ວ່າ **ໃບໃດ ໃຜເບີກ ຈ່າຍຫຍັງແດ່** */
export type DispatchDoc = {
  doc_no: string;
  doc_date: string | null;
  /** ຜູ້ອອກໃບເບີກ (ic_trans.user_created) — ໃຫ້ທວງຄືນຖືກຄົນ */
  user_created: string | null;
  items: DocItem[];
};

export type WithdrawRound = {
  items: DocItem[];
  round: number;
  doc_no: string;
  doc_date: string | null;
  wh_code: string | null;
  lines: number;
  qty: number;
  /** ໃບເບີກຂອງສາງ (SWC) — ຫວ່າງ = ສາງຍັງບໍ່ຈ່າຍ. ຫຼາຍໃບຄັ່ນດ້ວຍ ", " */
  dispatch_no: string | null;
  dispatch_date: string | null;
  /** ລາຍການທີ່ **ສາງເບີກອອກຈິງ** ລວມທຸກໃບ — ໃຊ້ທຽບກັບ "ທີ່ຂໍ" ເປັນຍອດລວມ */
  dispatch_items: DocItem[];
  /**
   * ໃບເບີກ **ແຍກເປັນລາຍໃບ** ພ້ອມລາຍການຂອງໃບນັ້ນເອງ.
   *
   * ⚠️ ເປັນຫຍັງຕ້ອງມີ ນອກຈາກ `dispatch_items`: 1 ໃບຂໍຖືກເບີກເປັນຫຼາຍໃບໄດ້ (ຄົນລະສາງ
   * ຫຼື ຄົນລະເທື່ອ) — ພົບຈິງ 4 ໃບຕໍ່ຮອບດຽວ. ຕອນລວມໝົດເປັນກ້ອນດຽວ ຄົນເບິ່ງ
   * **ບອກບໍ່ໄດ້ວ່າໃບໃດຈ່າຍຫຍັງ** ⇒ ຕາມຂອງບໍ່ຖືກ ແລະ ທວງສາງບໍ່ຖືກໃບ.
   */
  dispatches: DispatchDoc[];
  /** ໃບຮັບຂອງຊ່າງ (PISP) — ຫວ່າງ = ຈ່າຍແລ້ວແຕ່ຊ່າງຍັງບໍ່ກົດຮັບ */
  pick_no: string | null;
  pick_date: string | null;
  /** ລາຍການທີ່ **ຊ່າງກົດຮັບຈິງ** — ໃບ PISP ເກົ່າ 540/2298 ໃບບໍ່ມີລາຍການ ⇒ ອາດຫວ່າງ */
  pick_items: DocItem[];
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
  requested: { label: "ລໍສາງເບີກ", next: "ສາງ", tone: "bg-brand-orange-300 text-brand-900" },
  dispatched: { label: "ສາງເບີກແລ້ວ ລໍຊ່າງຮັບ", next: "ຊ່າງ", tone: "bg-brand-50 text-brand-700" },
  received: { label: "ຊ່າງຮັບແລ້ວ", next: "—", tone: "bg-brand-50 text-brand-800" },
};

export const PURCHASE_STATE: Record<PurchaseRound["state"], { label: string; next: string; tone: string }> = {
  waiting_approve: { label: "ລໍອະນຸມັດ", next: "ຜູ້ຈັດການ", tone: "bg-brand-orange-300 text-brand-900" },
  approved: { label: "ອະນຸມັດແລ້ວ — ຕິດຕາມຢູ່ ERP", next: "ຈັດຊື້", tone: "bg-brand-50 text-brand-700" },
  rejected: { label: "ບໍ່ອະນຸມັດ", next: "—", tone: "bg-brand-orange-50 text-brand-orange-700" },
};


/** ລາຍການສິນຄ້າຂອງແຕ່ລະໃບ — ດຶງເທື່ອດຽວ ແລ້ວແຈກໃສ່ຮອບ */
async function itemsByDoc(docNos: string[]): Promise<Record<string, DocItem[]>> {
  const keys = [...new Set(docNos.filter(Boolean))];
  if (keys.length === 0) return {};
  const { rows } = await query<DocItem & { doc_no: string }>(
    `select d.doc_no, d.item_code, d.item_name, coalesce(d.qty,0)::float8 qty
       from ic_trans_detail d where d.doc_no = any($1::text[])
      -- ⚠️ ods.ic_trans_detail ບໍ່ມີ line_number (ມີແຕ່ຕາຕະລາງຝັ່ງ ERP) — ຮຽງດ້ວຍ roworder
      order by d.doc_no, d.roworder`,
    [keys],
  );
  const map: Record<string, DocItem[]> = {};
  for (const { doc_no, ...item } of rows) (map[doc_no] ??= []).push(item);
  return map;
}

/** `string_agg` ລວມຫຼາຍໃບເປັນ "A, B" ⇒ ແຍກກັບຄືນເປັນລາຍການເລກໃບ */
function splitDocs(agg: string | null): string[] {
  return (agg ?? "").split(",").map((part) => part.trim()).filter(Boolean);
}

/** ຫຼາຍໃບອາດມີສິນຄ້າຕົວດຽວກັນ ⇒ ລວມຈຳນວນເຂົ້າກັນ ບໍ່ໃຫ້ໂຊ້ວຊ້ຳ */
function mergeItems(lists: DocItem[][]): DocItem[] {
  const map = new Map<string, DocItem>();
  for (const item of lists.flat()) {
    const found = map.get(item.item_code);
    if (found) found.qty += item.qty;
    else map.set(item.item_code, { ...item });
  }
  return [...map.values()];
}

/**
 * ຮອບຂໍເບີກທັງໝົດຂອງໃບງານ.
 *
 * ⚠️ 1 ໃບຂໍ ອາດຖືກເບີກເປັນຫຼາຍໃບ (ຄົນລະສາງ) ⇒ ລວມເລກໃບດ້ວຍ string_agg
 * ບໍ່ດັ່ງນັ້ນ join ຈະຄູນແຖວ ແລ້ວນັບຮອບຜິດ.
 */
export async function withdrawRounds(code: string): Promise<WithdrawRound[]> {
  const rows = (
    await query<Omit<WithdrawRound, "round" | "state" | "items" | "dispatch_items" | "pick_items">>(
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

  // ດຶງລາຍການຂອງ **ທັງ 3 ຂັ້ນ** ເທື່ອດຽວ (ຂໍ · ສາງເບີກ · ຊ່າງຮັບ) — ຄົນເຮັດວຽກຕ້ອງທຽບໄດ້ວ່າ
  // ຂໍຫຍັງ ⇒ ສາງເບີກໃຫ້ຫຍັງແດ່ ⇒ ຊ່າງຮັບຫຍັງແດ່
  const items = await itemsByDoc(
    rows.flatMap((row) => [row.doc_no, ...splitDocs(row.dispatch_no), ...splitDocs(row.pick_no)]),
  );

  /**
   * ວັນທີຂອງໃບເບີກ **ແຕ່ລະໃບ** — `dispatch_date` ຂ້າງເທິງເປັນ min() ຂອງທັງກຸ່ມ
   * ຈຶ່ງໃຊ້ບອກວັນຂອງໃບໃດໃບໜຶ່ງບໍ່ໄດ້. ຖາມເທື່ອດຽວສຳລັບທຸກຮອບ.
   */
  const dispatchHeads = new Map<string, { doc_date: string | null; user_created: string | null }>(
    rows.flatMap((row) => splitDocs(row.dispatch_no)).length > 0
      ? (
          await query<{ doc_no: string; doc_date: string | null; user_created: string | null }>(
            `select doc_no, to_char(doc_date,'DD-MM-YYYY') doc_date, nullif(user_created,'') user_created
               from ic_trans where doc_no = any($1::text[])`,
            [rows.flatMap((row) => splitDocs(row.dispatch_no))],
          )
        ).rows.map((row) => [row.doc_no, { doc_date: row.doc_date, user_created: row.user_created }])
      : [],
  );

  return rows.map((row, index) => ({
    ...row,
    items: items[row.doc_no] ?? [],
    dispatch_items: mergeItems(splitDocs(row.dispatch_no).map((doc) => items[doc] ?? [])),
    // ແຍກລາຍໃບ — ລຳດັບຕາມ string_agg (ຮຽງຕາມເລກໃບ) ⇒ ຄົງທີ່ທຸກຄັ້ງທີ່ໂຫຼດ
    dispatches: splitDocs(row.dispatch_no).map((doc) => ({
      doc_no: doc,
      doc_date: dispatchHeads.get(doc)?.doc_date ?? row.dispatch_date,
      user_created: dispatchHeads.get(doc)?.user_created ?? null,
      items: items[doc] ?? [],
    })),
    pick_items: mergeItems(splitDocs(row.pick_no).map((doc) => items[doc] ?? [])),
    round: index + 1,
    state: row.pick_no ? "received" : row.dispatch_no ? "dispatched" : "requested",
  }));
}

/** ລາຍການສິນຄ້າຂອງໃບຝັ່ງ **ERP** — ຕາຕະລາງນັ້ນມີ line_number (ຝັ່ງ ODS ບໍ່ມີ) */
async function itemsByDocOdg(docNos: string[]): Promise<Record<string, DocItem[]>> {
  const keys = [...new Set(docNos.filter(Boolean))];
  if (keys.length === 0) return {};
  const { rows } = await queryOdg<DocItem & { doc_no: string }>(
    `select d.doc_no, d.item_code, d.item_name, coalesce(d.qty,0)::float8 qty
       from ic_trans_detail d where d.doc_no = any($1::text[])
      order by d.doc_no, d.line_number`,
    [keys],
  );
  const map: Record<string, DocItem[]> = {};
  for (const { doc_no, ...item } of rows) (map[doc_no] ??= []).push(item);
  return map;
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
  /** ລາຍການຂອງແຕ່ລະຂັ້ນຝັ່ງ ERP — ຄົນຕ້ອງເຫັນວ່າ "ສັ່ງຫຍັງ ມາຫຍັງ" ບໍ່ແມ່ນແຕ່ເລກໃບ */
  spr_items: DocItem[];
  approve_items: DocItem[];
  order_items: DocItem[];
  receipt_items: DocItem[];
  /**
   * ⚠️ ໃບ ERP ເລກນີ້ **ບໍ່ມີສິນຄ້າກົງກັບໃບຂໍຊື້ຂອງວຽກນີ້ເລີຍ** ⇒ ຄົນລະໃບກັນ (ເລກຊົນກັນ 2 ລະບົບ).
   * ວັດ 04-08-2026: 88/560 ຕ່ອງໂສ້ (16%) ເປັນແບບນີ້ — ຕົວຢ່າງ SPR26060009 ຢູ່ ODS ເປັນແຜງແອ HITACHI
   * ແຕ່ຢູ່ ERP ເປັນຂອບຢາງຕູ້ເຢັນ SAMSUNG ⇒ ຖ້າບໍ່ໝາຍ ຄົນຈະເຫັນ "ຮັບເຂົ້າສາງແລ້ວ" ຂອງວຽກຄົນອື່ນ.
   */
  mismatch: boolean;
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

    // ── ລາຍການສິນຄ້າຂອງແຕ່ລະຂັ້ນ ──
    // ຝັ່ງ ERP ອ່ານຈາກ public.ic_trans_detail (ມີ line_number); ຝັ່ງ ODS ໃຊ້ itemsByDoc ຄືເກົ່າ.
    const erpDocs = chains.flatMap((chain) => [
      chain.spr,
      ...splitDocs(chain.approve_no),
      ...splitDocs(chain.order_no),
      ...splitDocs(chain.receipt_no),
    ]);
    const [erpItems, rqItems] = await Promise.all([itemsByDocOdg(erpDocs), itemsByDoc(keys)]);
    const pick = (agg: string | null) => mergeItems(splitDocs(agg).map((doc) => erpItems[doc] ?? []));

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
            spr_items: erpItems[row.spr] ?? [],
            approve_items: pick(chain?.approve_no ?? null),
            order_items: pick(chain?.order_no ?? null),
            receipt_items: pick(chain?.receipt_no ?? null),
            // ມີໃບຢູ່ ERP ແຕ່ບໍ່ມີສິນຄ້າຮ່ວມກັບໃບຂໍຊື້ຂອງວຽກ ⇒ ຜູກຜິດໃບ
            mismatch:
              (erpItems[row.spr]?.length ?? 0) > 0 &&
              !(erpItems[row.spr] ?? []).some((item) =>
                (rqItems[row.rq] ?? []).some((want) => want.item_code === item.item_code),
              ),
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
