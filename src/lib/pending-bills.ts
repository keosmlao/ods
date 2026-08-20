import { billRemarkRefs } from "@/lib/bill-remark-refs";
import { query, queryOdg } from "@/lib/db";

/**
 * **ບິນທີ່ລູກຄ້າຈ່າຍຄ່າຕິດຕັ້ງແລ້ວ ແຕ່ຍັງບໍ່ໄດ້ເປີດໃບງານ (ຄົບ).**
 *
 * ── ຮູຮົ່ວທີ່ບໍ່ມີໜ້າໃດເຫັນ ──
 * ຄິວທຸກໜ້າຂອງໂມດູນຕິດຕັ້ງເລີ່ມນັບຈາກ **ໃບງານທີ່ເປີດແລ້ວ** ⇒ ບິນທີ່ CS **ລືມເປີດ**
 * ບໍ່ປາກົດຢູ່ໃສເລີຍ — ບໍ່ມີໃຜຮູ້ວ່າມີງານທີ່ລູກຄ້າຈ່າຍເງິນມາແລ້ວແຕ່ບໍ່ມີໃຜໄປຕິດ.
 *
 * ຂໍ້ມູນຈິງ (90 ມື້): ບິນທີ່ຂາຍຄ່າຕິດຕັ້ງ 742 ໃບ / 921 ໜ່ວຍ ⇒
 *   · **79 ໃບ ບໍ່ໄດ້ເປີດໃບງານເລີຍ** (125 ໜ່ວຍ)
 *   · **8 ໃບ ເປີດບໍ່ຄົບ** ຕາມຈຳນວນທີ່ຈ່າຍ (ຂາດອີກ 56 ໜ່ວຍ)
 *   ⇒ ລວມ **181 ໜ່ວຍຄ້າງອອກໃບງານ** ບິນເກົ່າສຸດຄ້າງມາແຕ່ເດືອນເມສາ.
 *
 * ── ວິທີນັບ ──
 * "ຈຳນວນທີ່ຈ່າຍ" = ຈຳນວນແຖວ **ບໍລິການຕິດຕັ້ງ** ໃນບິນ (9701xx · 970102xx) — ອັນດຽວ
 * ກັບທີ່ຟອມເປີດງານໃຊ້ຕັ້ງຄ່າ "ຈະຕິດຕັ້ງຈັກໜ່ວຍ" (api/installations/bills).
 * "ເປີດແລ້ວ" = ນັບໃບງານ ODS ທີ່ doc_ref_1 = ເລກບິນ (ບໍ່ນັບໃບທີ່ຍົກເລີກ).
 * ⚠️ ຄົນລະຖານຂໍ້ມູນ (ERP ↔ ODS) ⇒ ນັບຄົນລະບ່ອນແລ້ວຄ່ອຍທາບກັນ.
 */
/** ລາຍການໃນບິນ — ສິນຄ້າທີ່ຕ້ອງຕິດຕັ້ງ ຫຼື ແຖວຄ່າບໍລິການຕິດຕັ້ງ */
export type BillLine = { item_code: string; item_name: string; qty: number };

export type PendingBill = {
  /** ຖືກໝາຍວ່າ "ບໍ່ຕ້ອງເປີດໃບງານ" ແລ້ວ (ods_bill_dismissed) — ພ້ອມເຫດຜົນ */
  dismissed?: { reason: string; by: string; at: string };
  doc_no: string;
  doc_date: string;
  cust_name: string | null;
  telephone: string | null;
  /** ຈຳນວນຄ່າຕິດຕັ້ງທີ່ລູກຄ້າຈ່າຍ */
  paid: number;
  /** ໃບງານທີ່ເປີດແລ້ວ */
  opened: number;
  /** ຍັງຂາດຈັກໜ່ວຍ */
  missing: number;
  /** ຄ້າງມາຈັກມື້ */
  days: number;
  /** **ສິນຄ້າທີ່ຈະຕິດຕັ້ງ** (ກຸ່ມ 11 ເຄື່ອງໃຊ້ໄຟຟ້າ · 12 ແອ · 13 ຈັກຊັກ) — ບອກວ່າບິນນີ້ຈະໄປຕິດຫຍັງ */
  items: BillLine[];
  /**
   * ສິນຄ້າຂ້າງເທິງ **ບໍ່ໄດ້ຢູ່ໃນບິນນີ້** — ມາຈາກເອກະສານທີ່ remark ອ້າງໄວ້
   * (ໃບເບີກ WEOK260002 ຫຼື ບິນຂາຍ CAK…) ⇒ ຕ້ອງບອກຄົນວ່າຂໍ້ມູນມາຈາກໃສ.
   * null = ສິນຄ້າຢູ່ໃນບິນດຽວກັນ ຄືປົກກະຕິ.
   */
  items_doc_no?: string | null;
  /** 44 = ບິນຂາຍເຄື່ອງ · 56 = ໃບເບີກສາງ (ໃຊ້ຕິດປ້າຍໃຫ້ຖືກ) */
  items_doc_flag?: 44 | 56 | null;
  /** ແຖວຄ່າບໍລິການຕິດຕັ້ງທີ່ພະນັກງານຂາຍໃສ່ໄວ້ (9701xx · 970102xx) */
  services: BillLine[];
  /**
   * ── ຂົນສົ່ງເອົາເຄື່ອງໄປສົ່ງແລ້ວບໍ ──
   * ສຳຄັນຕໍ່ຄິວນີ້: ບິນທີ່ **ຍັງບໍ່ໄດ້ສົ່ງເຄື່ອງ** ຍັງບໍ່ຄວນຈັດຊ່າງໄປຕິດ
   * (ໄປຮອດແລ້ວບໍ່ມີເຄື່ອງ) ⇒ CS ຈັດລຳດັບໄດ້ຖືກວ່າໃບໃດຮີບໄດ້.
   * ຄ່າດິບຈາກ ERP: `ສົ່ງແລ້ວ` / `ຄ້າງສົ່ງ` · null = ບໍ່ຢູ່ໃນລະບົບຂົນສົ່ງ (ຫອບເອງ)
   */
  ship_status: string | null;
  ship_date: string | null;
  /** ຮູບຫຼັກຖານການສົ່ງທີ່ຄົນສົ່ງຖ່າຍໄວ້ — 0 = ບໍ່ມີຫຼັກຖານ */
  proof: number;
};

/** ບໍ່ໄລ່ຍ້ອນຫຼັງເກີນນີ້ — ບິນເກົ່າກວ່ານີ້ຖືວ່າຈົບໄປແລ້ວ (ຫຼື ຕິດເອງ) */
const DAYS = 120;

/**
 * ບິນທີ່ຄ້າງ — **ຕັດບິນທີ່ຖືກໝາຍວ່າ "ຄົບແລ້ວ" ອອກ** (ods_bill_dismissed).
 * ບາງບິນຄ້າງຕະຫຼອດໄປໂດຍບໍ່ມີໃຜຜິດ (ລູກຄ້າຍົກເລີກ · ຕິດເອງ · ບິນເກົ່າທີ່ຕິດໄປແລ້ວ)
 * ⇒ ຄິວທີ່ປິດບໍ່ໄດ້ ຄືຄິວທີ່ຄົນຈະເລີກເບິ່ງ. `withDismissed` = ເອົາລາຍການທີ່ຖືກໝາຍມານຳ.
 */
export async function pendingInstallBills(withDismissed = false): Promise<PendingBill[]> {
  const [bills, jobs, dismissed] = await Promise.all([
    queryOdg<{ doc_no: string; doc_date: string; cust_name: string | null; telephone: string | null; paid: number }>(
      `select sv.doc_no,
          to_char(max(sv.doc_date),'YYYY-MM-DD') as doc_date,
          max(coalesce(c.name_1,'')) as cust_name,
          max(coalesce(c.telephone,'')) as telephone,
          round(sum(sv.qty))::int as paid
        from ic_trans_detail sv
        join ic_trans t on t.doc_no = sv.doc_no and t.trans_flag = 44
        left join ar_customer c on c.code = t.cust_code
       where sv.trans_flag = 44
         and (sv.item_code like '9701%' or sv.item_code like '970102%')
         and sv.doc_date >= current_date - ${DAYS}
       group by sv.doc_no`,
    ),
    /**
     * ── ນັບໃບງານ **ລວມໃບທີ່ຍົກເລີກແລ້ວ** (ແກ້ 06-08-2026 ຕາມຄຳສັ່ງ) ──
     * ເມື່ອກ່ອນມີ `and cancel_date is null` ⇒ ພໍ CS ດຶງບິນມາອອກໃບງານ ແລ້ວ**ຍົກເລີກ
     * ການຕິດຕັ້ງ** (ລູກຄ້າບໍ່ເອົາ · ຕິດບໍ່ໄດ້ · ອອກຜິດ) ບິນນັ້ນ **ເດັ້ງກັບເຂົ້າຄິວ
     * "ບິນຄ້າງອອກໃບງານ" ອີກ** ⇒ ຄົນໄປເປີດງານໃໝ່ຊ້ຳ ຫຼື ທວງກັນລ້າໆ ທັງທີ່ຕັດສິນໃຈໄປແລ້ວ.
     *
     * ຄິວນີ້ຖາມຄຳຖາມດຽວ: "ບິນນີ້ເຄີຍຖືກຈັດການແລ້ວບໍ" ⇒ **ເຄີຍອອກໃບງານ = ຈັດການແລ້ວ**
     * ບໍ່ວ່າໃບນັ້ນຈະຈົບ ຫຼື ຖືກຍົກເລີກ. ຢາກເປີດໃໝ່ ⇒ ເປີດຈາກໜ້າງານຕິດຕັ້ງໄດ້ຕາມປົກກະຕິ.
     */
    query<{ doc_no: string; opened: number }>(
      `select doc_ref_1 as doc_no, count(*)::int as opened
         from ods_tb_install
        where coalesce(doc_ref_1,'') <> ''
        group by doc_ref_1`,
    ),
    query<{ doc_no: string; reason: string; by: string; at: string }>(
      `select doc_no, reason, dismissed_by as by, to_char(dismissed_at,'DD-MM-YYYY') as at
         from ods_bill_dismissed`,
    ),
  ]);

  const opened = new Map(jobs.rows.map((row) => [row.doc_no, row.opened]));
  const marked = new Map(dismissed.rows.map((row) => [row.doc_no, row]));
  const today = Date.now();

  const pending: PendingBill[] = bills.rows
    .map((bill) => {
      const already = opened.get(bill.doc_no) ?? 0;
      const mark = marked.get(bill.doc_no);
      return {
        ...bill,
        opened: already,
        missing: bill.paid - already,
        days: Math.floor((today - new Date(`${bill.doc_date}T00:00:00`).getTime()) / 86_400_000),
        dismissed: mark ? { reason: mark.reason, by: mark.by, at: mark.at } : undefined,
        items: [] as BillLine[],
        services: [] as BillLine[],
        ship_status: null as string | null,
        ship_date: null as string | null,
        proof: 0,
      };
    })
    /**
     * ── ມີໃບງານແລ້ວ = ຈັດການແລ້ວ (ນະໂຍບາຍ 13-07-2026) ──
     * ເມື່ອກ່ອນຍັງທວງບິນທີ່ "ເປີດບໍ່ຄົບ" (ໃບງານ < ຈຳນວນຄ່າຕິດຕັ້ງ) ແຕ່ການທຽບຈຳນວນນັ້ນ
     * ເຊື່ອບໍ່ໄດ້: ຄ່າຕິດຕັ້ງ 1 ແຖວອາດຄຸມຫຼາຍໜ່ວຍ · ແອນັບເປັນຊຸດ · ບາງບິນຕິດພຽງບາງໜ່ວຍ
     * ຕາມທີ່ຕົກລົງກັບລູກຄ້າ ⇒ ບິນທີ່ CS ເປີດງານໄປແລ້ວຖືກທວງຊ້ຳໂດຍບໍ່ມີເຫດ.
     * ດຽວນີ້ຄິວນີ້ຖາມຄຳຖາມດຽວ: **"ບິນນີ້ຍັງບໍ່ມີໃບງານຈັກໃບບໍ"**.
     */
    .filter((bill) => bill.opened === 0)
    // ໝາຍວ່າຄົບແລ້ວ ⇒ ອອກຈາກຄິວ (ຍົກເວັ້ນຕອນຂໍ "ລາຍການທີ່ໝາຍໄວ້")
    .filter((bill) => (withDismissed ? Boolean(bill.dismissed) : !bill.dismissed))
    // ຄ້າງດົນສຸດຂຶ້ນກ່ອນ — ນັ້ນຄືລູກຄ້າທີ່ລໍດົນສຸດ
    .sort((left, right) => right.days - left.days);

  if (pending.length === 0) return pending;

  /**
   * ── ລາຍລະອຽດ: ບິນນີ້ຈະໄປຕິດ **ຫຍັງ** ──
   * ບອກແຕ່ "ຄ້າງ 1 ໜ່ວຍ" ບໍ່ພຽງພໍ — ຄົນຕ້ອງຮູ້ວ່າແມ່ນແອ ຫຼື ຈັກຊັກ ຈຶ່ງຈັດຊ່າງ/ອາໄຫຼ່ຖືກ.
   * ນິຍາມ "ສິນຄ້າທີ່ຕິດຕັ້ງໄດ້" ອັນດຽວກັບ api/installations/bills:
   * ກຸ່ມ 11 (ເຄື່ອງໃຊ້ໄຟຟ້າ) · 12 (ແອ) · 13 (ຈັກຊັກ ແລະ ອື່ນໆ) ·
   * ຕັດໜ່ວຍນອກ [H] ຂອງແອອອກ (ນັບເປັນຊຸດ).
   * ⚠️ 2 ບ່ອນນີ້ຕ້ອງກົງກັນສະເໝີ — ຖ້າກຸ່ມໃດຂາດຢູ່ນີ້ ຄິວຈະຂຶ້ນ "ບໍ່ມີລາຍການ",
   * ຖ້າຂາດຢູ່ bills API ບິນຈະ **ຫາຍທັງໃບ** (ເຫດ CAK26009268 · 28-07-2026).
   */
  const lines = await queryOdg<BillLine & { doc_no: string; kind: "item" | "service" }>(
    `select d.doc_no, d.item_code, d.item_name, sum(d.qty)::float as qty,
        case when d.item_code like '9701%' or d.item_code like '970102%' then 'service' else 'item' end as kind
       from ic_trans_detail d
      where d.trans_flag = 44
        and d.doc_no = any($1::text[])
        and (
          d.item_code like '9701%' or d.item_code like '970102%'
          or ((d.item_code like '11%' or d.item_code like '12%' or d.item_code like '13%')
              and d.item_type in (0,1,3) and d.item_name not ilike '%[H]%')
        )
      group by d.doc_no, d.item_code, d.item_name
      order by d.doc_no, d.item_code`,
    [pending.map((bill) => bill.doc_no)],
  );

  for (const bill of pending) {
    const own = lines.rows.filter((row) => row.doc_no === bill.doc_no);
    bill.items = own.filter((row) => row.kind === "item");
    bill.services = own.filter((row) => row.kind === "service");
  }

  await fillItemsFromRefDocs(pending);

  /**
   * ── ສະຖານະການສົ່ງ + ຫຼັກຖານ ──
   * ສອງ query ນ້ອຍ ດ້ວຍລາຍການເລກບິນທີ່ຄັດແລ້ວ (ບໍ່ແມ່ນ join ເຂົ້າ query ຫຼັກ —
   * bill_tracking_tms ບໍ່ມີ index ຢູ່ doc_no, ເບິ່ງເຫດຜົນທີ່ api/installations/bills).
   */
  const docs = pending.map((bill) => bill.doc_no);
  const [ship, proof] = await Promise.all([
    queryOdg<{ doc_no: string; status_ship: string | null; ship_date: string | null }>(
      `select distinct on (doc_no) doc_no, status_ship, to_char(ship_date,'DD-MM-YYYY') as ship_date
         from bill_tracking_tms
        where doc_no = any($1::text[])
        order by doc_no, ship_date desc nulls last`,
      [docs],
    ),
    queryOdg<{ bill_no: string; photos: number }>(
      `select d.bill_no,
          (max(case when coalesce(d.url_img,'') <> '' then 1 else 0 end)
           + (select count(*)::int from odg_tms_delivery_images i where i.bill_no = d.bill_no)) as photos
         from odg_tms_detail d
        where d.bill_no = any($1::text[])
        group by d.bill_no`,
      [docs],
    ),
  ]);

  const shipBy = new Map(ship.rows.map((row) => [row.doc_no, row]));
  const proofBy = new Map(proof.rows.map((row) => [row.bill_no, Number(row.photos) || 0]));
  for (const bill of pending) {
    const found = shipBy.get(bill.doc_no);
    bill.ship_status = found?.status_ship ?? null;
    bill.ship_date = found?.ship_date ?? null;
    bill.proof = proofBy.get(bill.doc_no) ?? 0;
  }

  return pending;
}

/**
 * ── ບິນຄ່າຕິດຕັ້ງທີ່ **ບໍ່ມີແຖວສິນຄ້າຢູ່ໃນຕົນເອງ** ──
 *
 * ຮ້ານອອກໃບຄ່າຕິດຕັ້ງແຍກ (CAKSV… · INKSV… · CAHSV…) ⇒ ໃບນັ້ນມີແຕ່ແຖວບໍລິການ 9701xx
 * ⇒ ຖັນ "ສິນຄ້າທີ່ຈະຕິດຕັ້ງ" ຂຶ້ນ "ບໍ່ພົບສິນຄ້າ…" ⇒ CS ບອກບໍ່ໄດ້ວ່າຈະໄປຕິດຫຍັງ
 * ຈັດຊ່າງ/ອາໄຫຼ່ບໍ່ຖືກ ຕ້ອງໄປເປີດ ERP ອ່ານໝາຍເຫດເອງ.
 *
 * ເລກເອກະສານຕົ້ນທາງຢູ່ໃນ `remark` ຢູ່ແລ້ວ (lib/bill-remark-refs) ⇒ ດຶງສິນຄ້າຈາກ
 * ເອກະສານນັ້ນມາໃສ່ ພ້ອມບອກວ່າມາຈາກໃບໃດ (`items_doc_no`):
 *   · **44** ບິນຂາຍເຄື່ອງ  — CAKSV26000282 → CAK26010017
 *   · **56** ໃບເບີກສາງ    — CAKSV26000283 → WEOK260002
 *
 * ⚠️ ບໍ່ແຕະຄ່າ `paid` / `opened` / ຄິວ: ນີ້ແມ່ນຂໍ້ມູນປະກອບໃຫ້ຄົນອ່ານ ບໍ່ແມ່ນເກນເຂົ້າ-ອອກຄິວ
 * (ຄິວຍັງຖາມຄຳຖາມດຽວ: "ບິນນີ້ຍັງບໍ່ມີໃບງານຈັກໃບບໍ").
 *
 * ນິຍາມ "ສິນຄ້າທີ່ຕິດຕັ້ງໄດ້" ຕ້ອງຕົງກັບ query ຫຼັກຂ້າງເທິງ ແລະ api/installations/bills.
 */
async function fillItemsFromRefDocs(pending: PendingBill[]) {
  // ບິນທີ່ມີສິນຄ້າຂອງຕົນເອງແລ້ວ ບໍ່ຕ້ອງໄປໄລ່ຫາ — ຂໍ້ມູນໃນບິນຖືກກວ່າໝາຍເຫດສະເໝີ
  const blind = pending.filter((bill) => bill.items.length === 0);
  if (blind.length === 0) return;

  const refs = await billRemarkRefs(blind.map((bill) => bill.doc_no));
  if (refs.length === 0) return;

  const lines = await queryOdg<BillLine & { doc_no: string; trans_flag: number }>(
    `select d.doc_no, d.trans_flag::int as trans_flag, d.item_code, d.item_name,
        sum(d.qty)::float as qty
       from ic_trans_detail d
      where d.trans_flag in (44, 56)
        and d.doc_no = any($1::text[])
        and (d.item_code like '11%' or d.item_code like '12%' or d.item_code like '13%')
        and d.item_type in (0,1,3)
        and d.item_name not ilike '%[H]%'
      group by d.doc_no, d.trans_flag, d.item_code, d.item_name
      order by d.doc_no, d.item_code`,
    [[...new Set(refs.map((ref) => ref.ref_doc))]],
  );

  for (const bill of blind) {
    /**
     * ໝາຍເຫດອາດອ້າງຫຼາຍໃບ (CAKSV26000275 ອ້າງທັງໃບເບີກ ແລະ ບິນຂາຍ) ⇒ ເອົາໃບ**ທຳອິດ
     * ທີ່ມີສິນຄ້າຕິດຕັ້ງໄດ້ແທ້**. `billRemarkRefs` ຮຽງບິນຂາຍ (44) ມາກ່ອນໃບເບີກ (56)
     * ເພາະບິນຂາຍມີທັງລູກຄ້າ ແລະ ISN ⇒ ເປັນຕົ້ນທາງທີ່ຄົບກວ່າ.
     */
    for (const ref of refs.filter((row) => row.doc_no === bill.doc_no)) {
      const found = lines.rows.filter((row) => row.doc_no === ref.ref_doc);
      if (found.length === 0) continue;
      bill.items = found.map(({ item_code, item_name, qty }) => ({ item_code, item_name, qty }));
      bill.items_doc_no = ref.ref_doc;
      bill.items_doc_flag = ref.ref_flag;
      break;
    }
  }
}
