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
  /** **ສິນຄ້າທີ່ຈະຕິດຕັ້ງ** (ກຸ່ມ 11 ເຄື່ອງໃຊ້ໄຟຟ້າ · 12 ແອ) — ບອກວ່າບິນນີ້ຈະໄປຕິດຫຍັງ */
  items: BillLine[];
  /** ແຖວຄ່າບໍລິການຕິດຕັ້ງທີ່ພະນັກງານຂາຍໃສ່ໄວ້ (9701xx · 970102xx) */
  services: BillLine[];
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
    query<{ doc_no: string; opened: number }>(
      `select doc_ref_1 as doc_no, count(*)::int as opened
         from ods_tb_install
        where coalesce(doc_ref_1,'') <> '' and cancel_date is null
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
   * ກຸ່ມ 11 (ເຄື່ອງໃຊ້ໄຟຟ້າ) · 12 (ແອ) · ຕັດໜ່ວຍນອກ [H] ຂອງແອອອກ (ນັບເປັນຊຸດ).
   */
  const lines = await queryOdg<BillLine & { doc_no: string; kind: "item" | "service" }>(
    `select d.doc_no, d.item_code, d.item_name, sum(d.qty)::float as qty,
        case when d.item_code like '9701%' or d.item_code like '970102%' then 'service' else 'item' end as kind
       from ic_trans_detail d
      where d.trans_flag = 44
        and d.doc_no = any($1::text[])
        and (
          d.item_code like '9701%' or d.item_code like '970102%'
          or ((d.item_code like '11%' or d.item_code like '12%')
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

  return pending;
}
