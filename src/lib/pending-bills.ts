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
export type PendingBill = {
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
};

/** ບໍ່ໄລ່ຍ້ອນຫຼັງເກີນນີ້ — ບິນເກົ່າກວ່ານີ້ຖືວ່າຈົບໄປແລ້ວ (ຫຼື ຕິດເອງ) */
const DAYS = 120;

export async function pendingInstallBills(): Promise<PendingBill[]> {
  const [bills, jobs] = await Promise.all([
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
  ]);

  const opened = new Map(jobs.rows.map((row) => [row.doc_no, row.opened]));
  const today = Date.now();

  return bills.rows
    .map((bill) => {
      const already = opened.get(bill.doc_no) ?? 0;
      return {
        ...bill,
        opened: already,
        missing: bill.paid - already,
        days: Math.floor((today - new Date(`${bill.doc_date}T00:00:00`).getTime()) / 86_400_000),
      };
    })
    .filter((bill) => bill.missing > 0)
    // ຄ້າງດົນສຸດຂຶ້ນກ່ອນ — ນັ້ນຄືລູກຄ້າທີ່ລໍດົນສຸດ
    .sort((left, right) => right.days - left.days);
}
