import { query, queryOdg } from "@/lib/db";

/**
 * **ລາຍງານປະຈຳເດືອນຂອງຜູ້ຈັດການ** — ລວມລາຍຮັບເປັນ**ບາດ**ຈາກ 3 ແຫຼ່ງ:
 *
 *   ຕິດຕັ້ງ   = ຄ່າບໍລິການຕິດຕັ້ງ (ic_inventory 9701xx) ໃນບິນຂາຍ ERP (trans_flag 44)
 *   ສ້ອມແປງ  = ໃບສະເໜີລາຄາທີ່ລູກຄ້າຮັບແລ້ວ (ic_trans flag 17 · 1/1) — ນິຍາມດຽວກັບ
 *              lib/service-money (ACCEPTED_QUOTE) ⇒ ຕົວເລກຕົງກັບລາຍງານລາຍຮັບງານສ້ອມ
 *   ອື່ນໆ    = ຕິດຕັ້ງໂຄງການ · ຄ່າໄລຍະທາງ · ວຽກບຳລຸງຮັກສາ (ods_tb_maintenance)
 *
 * ── ບົດຮຽນຈາກຂໍ້ມູນຈິງ (ວັດ 03-08-2026) ──
 * · ແຖວ ic_trans_detail.sum_amount ເປັນ**ບາດ**ຢູ່ແລ້ວ ເຖິງໃບຈະເປັນສະກຸນກີບ
 *   (ກວດ: line_sum = ic_trans.total_amount ບໍ່ແມ່ນ total_amount_2) ⇒ ບໍ່ຕ້ອງແປງ.
 * · **ຍົກເວັ້ນ**ໃບໂຄງການ *HSV* (CAHSV/INHSV ສຳນັກງານໃຫຍ່): ປ້ອນຄ່າເປັນ**ກີບ**ທັງໃບ
 *   ທັງທີ່ currency_code='01' (ແຖວ 1-2 ລ້ານ/ແຖວ — ຄ່າຕິດຕັ້ງ 2 ລ້ານບາດບໍ່ມີຈິງ)
 *   ⇒ ໃບຕະກູນ HSV ຫານອັດຕາກີບ (tb_bill_rate code 02) ກ່ອນລວມ.
 * · ຄ່າຕິດຕັ້ງເຄື່ອງໃຊ້ໄຟຟ້າ (970101-0013) ເກືອບທຸກແຖວລາຄາ 0 (ຕິດຕັ້ງຟຣີພ່ວງການຂາຍ)
 *   — ຕົວເລກຕ່ຳແມ່ນຄວາມຈິງ ບໍ່ແມ່ນ bug.
 */

export const REV_CATEGORIES = ["install_ac", "install_app", "repair_ac", "repair_app", "other"] as const;
export type RevCategory = (typeof REV_CATEGORIES)[number];

export type MonthRevenue = Record<RevCategory, number> & {
  /** YYYY-MM */
  month: string;
  total: number;
  /** ເປົ້າຂອງເດືອນ (ods_revenue_target) — 0 ຖ້າຍັງບໍ່ຕັ້ງ */
  target: number;
};

/**
 * ລະຫັດບໍລິການຕິດຕັ້ງ**ແອ** — pin ຕາຍຕົວຈາກ ic_inventory ຈິງ (03-08-2026)
 * ຢ່າໃຊ້ "ທີ່ເຫຼືອ = ແອ": ລະຫັດ 970102-0012/0013 ເປັນເຄື່ອງປັບອາກາດແຕ່ຢູ່ຕະກູນ 970102
 * ແລະ ລະຫັດໃໝ່ທີ່ ERP ເພີ່ມພາຍຫຼັງຕ້ອງຖືກຈັດເປັນເຄື່ອງໃຊ້ໄຟຟ້າໂດຍປົກກະຕິ.
 */
const INSTALL_AC_ITEMS = new Set([
  "970101-0001", // SERVICE CHARGE ຄ່າຕິດຕັ້ງແອ
  "970101-0015", // ແອ WT 9000-12000 BTU
  "970101-0016", // ແອ WT 18000-36000 BTU
  "970101-0017", // ຕູ້ຕັ້ງ Floor Standing
  "970101-0018", // Cassette Type
  "970101-0019", // ຕໍ່ທໍ່ແອ
  "970102-0012", // ເຄື່ອງປັບອາກາດ Floor Standing (ຢູ່ຕະກູນ 970102)
  "970102-0013", // ເຄື່ອງປັບອາກາດ Cassette (ຢູ່ຕະກູນ 970102)
]);

/** ບໍ່ແມ່ນທັງແອ/ເຄື່ອງໃຊ້ໄຟຟ້າ — ເຂົ້າໝວດ "ລາຍໄດ້ອື່ນໆ" */
const INSTALL_OTHER_ITEMS = new Set([
  "970101-0004", // ບໍລິການຕິດຕັ້ງໂຄງການ (ໃບ *HSV — ຄ່າເປັນກີບ)
  "970101-0020", // ຄ່າບໍລິການໄລຍະທາງ KM (ໃຊ້ໄດ້ທັງສອງໝວດ ແຍກບໍ່ອອກ)
]);

/** ໝວດສິນຄ້າ "ແອ" ຂອງ ERP (ic_category) — ໃຊ້ຈັດໝວດງານສ້ອມຕາມ item_code ຂອງວຽກ */
const ERP_AC_CATEGORY = "032";
/** ຄ່າເກົ່າຂອງ tb_product.p_type ທີ່ໝາຍເຖິງແອ (ວຽກທີ່ບໍ່ມີ item_code) */
const LEGACY_AC_TYPES = new Set(["032", "03", "ແອ"]);

const emptyMonth = (month: string): MonthRevenue => ({
  month, install_ac: 0, install_app: 0, repair_ac: 0, repair_app: 0, other: 0, total: 0, target: 0,
});

const monthKey = (year: number, month: number) => `${year}-${String(month).padStart(2, "0")}`;

/** ອັດຕາກີບຕໍ່ບາດ (tb_bill_rate code 02 ~690) — 0 = ອ່ານບໍ່ໄດ້ (ແຖວກີບຈະຖືກຂ້າມ) */
/** ອັດຕາ ກີບ/ບາດ (tb_bill_rate code 02) — export ໃຫ້ໜ້າອື່ນແປງໜ່ວຍໄດ້ດ້ວຍອັດຕາດຽວກັນ */
export async function kipPerBaht(): Promise<number> {
  const result = await queryOdg<{ rate: string | null }>(
    `select exchange_rate rate from tb_bill_rate where code='02'`,
  );
  return Number(result.rows[0]?.rate ?? 0);
}

/**
 * ຕາຕະລາງລາຍຮັບລາຍເດືອນ ຂອງ `year` ແລະ `year-1` (ເອົາປີກາຍມານຳເພື່ອຖັນທຽບ) —
 * key = "YYYY-MM" ຄົບທຸກເດືອນຂອງສອງປີ (ເດືອນບໍ່ມີຂໍ້ມູນ = 0 ບໍ່ແມ່ນ undefined).
 */
export async function monthlyRevenueMatrix(year: number): Promise<Map<string, MonthRevenue>> {
  const from = `${year - 1}-01-01`;
  const to = `${year + 1}-01-01`;

  const matrix = new Map<string, MonthRevenue>();
  for (const y of [year - 1, year]) {
    for (let m = 1; m <= 12; m++) matrix.set(monthKey(y, m), emptyMonth(monthKey(y, m)));
  }
  const add = (month: string, category: RevCategory, amount: number) => {
    const row = matrix.get(month);
    if (!row || !Number.isFinite(amount)) return;
    row[category] += amount;
    row.total += amount;
  };

  const rate = await kipPerBaht();

  /* ── ຕິດຕັ້ງ (ERP) — ຄ່າບໍລິການ 9701xx ໃນບິນຂາຍ ── */
  const install = await queryOdg<{ month: string; item_code: string; fmt: string | null; amount: number }>(
    `select to_char(d.doc_date,'YYYY-MM') as month, d.item_code, t.doc_format_code fmt,
            -- ແຖວທີ່ບໍ່ໄດ້ປ້ອນລາຄາ (sum_amount = 0) ⇒ ຖອຍໄປໃຊ້ລາຄາມາດຕະຖານ
            -- ① ic_inventory_price ແຖວສຸດທ້າຍທີ່ມີລາຄາ (ບໍ່ຜູກ to_date)
            -- ② ບໍ່ມີໃນຕາຕະລາງລາຄາເລີຍ ⇒ ລາຄາທີ່ເຄີຍອອກບິນຫຼ້າສຸດຂອງລະຫັດນັ້ນ
            -- (ວັດ 04-08-2026: ຄ່າຕິດຕັ້ງເຄື່ອງໃຊ້ໄຟຟ້າ 970101-0013 ບໍ່ມີແຖວລາຄາເລີຍ
            --  ແຕ່ອອກບິນຈິງ 500-1,000 ບາດ ⇒ ຖ້າບໍ່ຖອຍ ຈະນັບເປັນ 0 ທັງເດືອນ)
            sum(coalesce(nullif(d.sum_amount, 0), d.qty * coalesce(
              (select pr.sale_price1 from ic_inventory_price pr
                where pr.ic_code = d.item_code and pr.currency_code = '01'
                  and coalesce(pr.sale_price1,0) > 0
                order by pr.from_date desc nulls last, pr.roworder desc limit 1),
              (select p2.price from ic_trans_detail p2
                 join ic_trans t2 on t2.doc_no = p2.doc_no
                where p2.item_code = d.item_code and coalesce(p2.price,0) > 0
                  and t2.doc_date <= d.doc_date
                order by t2.doc_date desc limit 1), 0)))::float8 amount
       from ic_trans_detail d
       join ic_trans t on t.doc_no = d.doc_no and t.trans_flag = 44
      where d.trans_flag = 44 and d.item_code like '9701%'
        and d.doc_date >= $1 and d.doc_date < $2
      group by 1, 2, 3`,
    [from, to],
  );
  for (const row of install.rows) {
    // ໃບໂຄງການ *HSV = ຄ່າເປັນກີບ (ເບິ່ງໝາຍເຫດເທິງ) — ແປງເປັນບາດກ່ອນ
    const isKipDoc = (row.fmt ?? "").includes("HSV");
    const baht = isKipDoc ? (rate > 0 ? row.amount / rate : 0) : row.amount;
    const category: RevCategory = INSTALL_OTHER_ITEMS.has(row.item_code)
      ? "other"
      : INSTALL_AC_ITEMS.has(row.item_code)
        ? "install_ac"
        : "install_app";
    add(row.month, category, baht);
  }

  /* ── ສ້ອມແປງ (ODS) — ໃບສະເໜີລາຄາທີ່ຮັບແລ້ວ ຕໍ່ວຽກ ── */
  const repair = await query<{ month: string; item_code: string | null; p_type: string | null; amount: number }>(
    `select to_char(x.d,'YYYY-MM') as month, x.item_code, x.p_type, sum(x.quoted)::float8 amount
       from (
         select max(q.doc_date) d,
                nullif(trim(coalesce(a.item_code,'')),'') item_code,
                trim(coalesce(a.p_type,'')) p_type,
                sum(q.total_amount) quoted
           from ic_trans q
           join tb_product a on a.code = q.product_code
          where q.trans_flag = 17
            and coalesce(q.aprove_status,0) = 1
            and coalesce(q.aprove_status_2,0) = 1
            and q.doc_date >= $1 and q.doc_date < $2
          group by a.code, 2, 3
       ) x
      group by 1, 2, 3`,
    [from, to],
  );
  // ຈັດໝວດແອ/ໄຟຟ້າ ດ້ວຍ ic_category ຂອງ ERP (ດຶງເທື່ອດຽວທັງຊຸດ — ຄື commission-record)
  const codes = [...new Set(repair.rows.map((row) => row.item_code).filter((c): c is string => !!c))];
  const acCodes = new Set<string>();
  if (codes.length) {
    const cats = await queryOdg<{ code: string; item_category: string | null }>(
      `select code, item_category from ic_inventory where code = any($1::varchar[])`,
      [codes],
    );
    for (const row of cats.rows) if (row.item_category === ERP_AC_CATEGORY) acCodes.add(row.code);
  }
  for (const row of repair.rows) {
    const isAc = row.item_code
      ? acCodes.has(row.item_code)
      : LEGACY_AC_TYPES.has(row.p_type ?? "");
    add(row.month, isAc ? "repair_ac" : "repair_app", row.amount);
  }

  /* ── ອື່ນໆ: ວຽກບຳລຸງຮັກສາ (ຈ່າຍແລ້ວ) — ຄ່າເປັນກີບ (ເບິ່ງ lib/maintenance) ── */
  try {
    const maint = await query<{ month: string; amount: number }>(
      `select to_char(m.paid_at,'YYYY-MM') as month, sum(m.total)::float8 amount
         from ods_tb_maintenance m
        where m.paid_at is not null and m.paid_at >= $1 and m.paid_at < $2
        group by 1`,
      [from, to],
    );
    for (const row of maint.rows) add(row.month, "other", rate > 0 ? row.amount / rate : 0);
  } catch {
    // ຕາຕະລາງຍັງບໍ່ມີ (migration ຍັງບໍ່ແລ່ນ) — ຂ້າມ ບໍ່ໃຫ້ລາຍງານລົ້ມ
  }

  /* ── ເປົ້າ (ODS) ── */
  try {
    const targets = await query<{ year: number; month: number; amount: number }>(
      `select year, month, amount::float8 amount from ods_revenue_target where year between $1 and $2`,
      [year - 1, year],
    );
    for (const row of targets.rows) {
      const cell = matrix.get(monthKey(row.year, row.month));
      if (cell) cell.target = row.amount;
    }
  } catch {
    // ຕາຕະລາງເປົ້າຍັງບໍ່ມີ — ສະແດງເປົ້າ 0 ໄປກ່ອນ
  }

  return matrix;
}
