import { query } from "@/lib/db";

/**
 * **ເງິນຂອງງານສ້ອມ — ນິຍາມບ່ອນດຽວຂອງລະບົບ.**
 *
 * ── ເງິນຢູ່ໃສ (ວັດຈາກຂໍ້ມູນຈິງ 17-07-2026) ──
 *   ໃບສະເໜີລາຄາ QT (ic_trans trans_flag=17) — 1,089 ໃບອະນຸມັດ = 3,362,569 ບາດ  ← **ຍອດທີ່ຕ້ອງເກັບ**
 *   ໃບຮັບເງິນ SIN (ic_trans trans_flag=44) — 4,456 ໃບ **ຍອດ 0.00 ທຸກໃບ**       ← ໃຊ້ບໍ່ໄດ້
 *   ⇒ ຢ່າໄປອ່ານ SIN ຫາເງິນ. ຍອດທີ່ຕ້ອງເກັບ = QT ທີ່ **ອະນຸມັດພາຍໃນ (aprove_status=1)
 *     ແລະ ລູກຄ້າຕົກລົງ (aprove_status_2=1)** — ໃບທີ່ລູກຄ້າບໍ່ຕົກລົງ ບໍ່ແມ່ນໜີ້.
 *
 * ── ຈ່າຍແລ້ວຢູ່ໃສ ──
 *   `ods_service_payment` (migration 2026-07-17) — 1 ງານ ຈ່າຍໄດ້ຫຼາຍງວດ.
 *   ຄ້າງຊຳລະ = ຍອດ QT ທີ່ຕົກລົງ − ຜົນລວມທີ່ຈ່າຍ.
 *
 * ── ສະກຸນເງິນ ──
 *   QT ຄິດເປັນ **ບາດ** (currency_code=01) ແລ້ວ ODS ເກັບຍອດກີບໄວ້ທີ່ `total_amount_2`
 *   ພ້ອມ `exchange_rate` (ຕົວຢ່າງຈິງ: 2,800 ບາດ × 690 = 1,932,000 ກີບ).
 *   ການຊຳລະບັນທຶກເປັນ **ບາດ** ໃຫ້ຕົງກັບໃບ ⇒ ທຽບກັນໄດ້ໂດຍບໍ່ຕ້ອງແປງ.
 */

/** ໃບສະເໜີລາຄາທີ່ **ລູກຄ້າຕົກລົງແລ້ວ** = ໜີ້ຈິງ (ອະນຸມັດພາຍໃນ + ລູກຄ້າຮັບ) */
export const ACCEPTED_QUOTE = `q.trans_flag = 17 and coalesce(q.aprove_status,0) = 1 and coalesce(q.aprove_status_2,0) = 1`;

/**
 * ປະເພດລູກຄ້າ — ນິຍາມຢູ່ `lib/cust-kind` (ໄຟລ໌ທີ່ບໍ່ແຕະຖານຂໍ້ມູນ) ເພາະ **client
 * component ກໍ່ໃຊ້ປ້າຍນີ້**: import ຈາກໄຟລ໌ນີ້ຈະດຶງ `pg` ເຂົ້າ browser ແລ້ວ build ພັງ.
 * re-export ໄວ້ ⇒ ໜ້າ server ທີ່ import ຈາກບ່ອນນີ້ຢູ່ແລ້ວ ບໍ່ຕ້ອງແກ້.
 */
import type { CustKind } from "@/lib/cust-kind";
export { CUST_KIND_LABEL, UNSET_KIND_LABEL, type CustKind } from "@/lib/cust-kind";

export type ServiceDebtRow = {
  job: string;
  customer: string | null;
  customer_code: string | null;
  cust_kind: CustKind | null;
  tel: string | null;
  product: string | null;
  /** ໃບສະເໜີລາຄາ (ອາດມີຫຼາຍໃບຕໍ່ງານ ⇒ ລວມ) */
  quoted_thb: string;
  paid_thb: string;
  due_thb: string;
  quote_no: string | null;
  quote_date: string | null;
  /** ສົ່ງເຄື່ອງຄືນລູກຄ້າແລ້ວບໍ — ຄືນແລ້ວແຕ່ຍັງບໍ່ຈ່າຍ = ຄວາມສ່ຽງ */
  returned_on: string | null;
  last_paid_on: string | null;
  /** ນັບມື້ຈາກມື້ລູກຄ້າຕົກລົງລາຄາ ຫາມື້ນີ້ */
  age_days: number | null;
};

/** ຄ້າງຊຳລະ: ງານທີ່ລູກຄ້າຕົກລົງລາຄາແລ້ວ ແຕ່ຍັງຈ່າຍບໍ່ຄົບ */
export type DebtFilter = { onlyDue?: boolean; kind?: CustKind | "unset"; from?: string; to?: string };

export async function serviceDebts(filter: DebtFilter = {}): Promise<ServiceDebtRow[]> {
  const where: string[] = [ACCEPTED_QUOTE];
  const params: string[] = [];
  if (filter.from && filter.to) {
    params.push(filter.from, filter.to);
    where.push(`q.doc_date::date between $${params.length - 1} and $${params.length}`);
  }
  if (filter.kind === "unset") where.push(`c.cust_kind is null`);
  else if (filter.kind) {
    params.push(filter.kind);
    where.push(`c.cust_kind = $${params.length}`);
  }

  const having = filter.onlyDue ? `having sum(q.total_amount) > coalesce(max(p.paid),0)` : "";

  return (
    await query<ServiceDebtRow>(
      `select a.code job,
          c.name_1 customer, a.cust_code customer_code, c.cust_kind, c.tel,
          concat_ws(' ', a.name_1, a.p_model) product,
          to_char(sum(q.total_amount),'FM999,999,999,990.00') quoted_thb,
          to_char(coalesce(max(p.paid),0),'FM999,999,999,990.00') paid_thb,
          to_char(sum(q.total_amount) - coalesce(max(p.paid),0),'FM999,999,999,990.00') due_thb,
          string_agg(distinct q.doc_no, ', ') quote_no,
          to_char(max(q.doc_date),'DD-MM-YYYY') quote_date,
          to_char(max(a.return_complete),'DD-MM-YYYY') returned_on,
          to_char(max(p.last_paid),'DD-MM-YYYY') last_paid_on,
          (current_date - max(q.doc_date)::date)::int age_days
        from ic_trans q
        join tb_product a on a.code = q.product_code
        left join ar_customer c on c.code = a.cust_code
        left join lateral (
          select sum(amount_thb) paid, max(paid_on) last_paid
            from ods_service_payment where job_code = a.code
        ) p on true
       where ${where.join(" and ")}
       group by a.code, c.name_1, a.cust_code, c.cust_kind, c.tel, a.name_1, a.p_model
       ${having}
       order by (sum(q.total_amount) - coalesce(max(p.paid),0)) desc, max(q.doc_date)`,
      params,
    )
  ).rows;
}

export type MoneySummary = {
  jobs: number;
  quoted: number;
  paid: number;
  due: number;
};

/** ສະຫຼຸບຍອດ — ໃຊ້ຂໍ້ມູນຊຸດດຽວກັບຕາຕະລາງ (ຢ່າຄິດຄືນດ້ວຍ SQL ອື່ນ ຈະບໍ່ຕົງກັນ) */
export function summarize(rows: ServiceDebtRow[]): MoneySummary {
  const num = (value: string) => Number(value.replace(/,/g, "")) || 0;
  return {
    jobs: rows.length,
    quoted: rows.reduce((sum, row) => sum + num(row.quoted_thb), 0),
    paid: rows.reduce((sum, row) => sum + num(row.paid_thb), 0),
    due: rows.reduce((sum, row) => sum + num(row.due_thb), 0),
  };
}

export const thb = (value: number) => value.toLocaleString("en-US", { maximumFractionDigits: 2 });

/* ── ສະຫຼຸບລາຍຮັບຈາກງານສ້ອມ ─────────────────────────────────────── */

export type RevenueRow = {
  month: string;
  jobs: number;
  quoted: string;
  paid: string;
  due: string;
};

/**
 * ລາຍຮັບຕາມເດືອນ — ນັບຕາມ **ວັນທີໃບສະເໜີລາຄາ** (ມື້ທີ່ຕົກລົງລາຄາ ບໍ່ແມ່ນມື້ຈ່າຍ)
 * ເພື່ອໃຫ້ "ຕົກລົງ / ຮັບແລ້ວ / ຄ້າງ" ຂອງເດືອນນັ້ນທຽບກັນໄດ້ໃນແຖວດຽວ.
 */
export async function serviceRevenueByMonth(from: string, to: string): Promise<RevenueRow[]> {
  return (
    await query<RevenueRow>(
      // ⚠️ PG11: ຊື່ຫຍໍ້ແບບບໍ່ມີ `as` ຕ້ອງເປັນ IDENT ລ້ວນ — "month" ເປັນ keyword ⇒ ຕ້ອງໃສ່ `as`
      `select to_char(x.m,'MM-YYYY') as month, count(*)::int jobs,
          to_char(sum(x.quoted),'FM999,999,999,990') quoted,
          to_char(sum(x.paid),'FM999,999,999,990') paid,
          to_char(sum(x.quoted - x.paid),'FM999,999,999,990') due
        from (
          select date_trunc('month', max(q.doc_date))::date m,
              a.code, sum(q.total_amount) quoted,
              coalesce((select sum(amount_thb) from ods_service_payment where job_code = a.code),0) paid
            from ic_trans q
            join tb_product a on a.code = q.product_code
           where ${ACCEPTED_QUOTE} and q.doc_date::date between $1 and $2
           group by a.code
        ) x
       group by x.m order by x.m desc`,
      [from, to],
    )
  ).rows;
}

export type KindRow = {
  kind: string;
  jobs: number;
  customers: number;
  in_warranty: number;
  out_warranty: number;
  quoted: string;
  paid: string;
};

/**
 * ງານສ້ອມແຍກຕາມ **ປະເພດລູກຄ້າ** — ນັບຕາມວັນທີຮັບເຄື່ອງ (time_register).
 * ລູກຄ້າທີ່ຍັງບໍ່ໄດ້ລະບຸປະເພດ ຂຶ້ນເປັນກຸ່ມ "ຍັງບໍ່ລະບຸ" — ບໍ່ເດົາຈາກຊື່.
 */
export async function serviceByCustomerKind(from: string, to: string): Promise<KindRow[]> {
  return (
    await query<KindRow>(
      `select coalesce(c.cust_kind,'unset') kind,
          count(*)::int jobs,
          count(distinct a.cust_code)::int customers,
          count(*) filter (where a.warrunty = 'ຮັບປະກັນ')::int in_warranty,
          count(*) filter (where a.warrunty <> 'ຮັບປະກັນ')::int out_warranty,
          to_char(coalesce(sum(q.quoted),0),'FM999,999,999,990') quoted,
          to_char(coalesce(sum(q.paid),0),'FM999,999,999,990') paid
        from tb_product a
        left join ar_customer c on c.code = a.cust_code
        left join lateral (
          select sum(t.total_amount) quoted,
              coalesce((select sum(amount_thb) from ods_service_payment where job_code = a.code),0) paid
            from ic_trans t
           where t.product_code = a.code and t.trans_flag = 17
             and coalesce(t.aprove_status,0) = 1 and coalesce(t.aprove_status_2,0) = 1
        ) q on true
       where a.time_register::date between $1 and $2
       group by coalesce(c.cust_kind,'unset')
       order by count(*) desc`,
      [from, to],
    )
  ).rows;
}

/** ລາຍຮັບຕໍ່ **ຊ່າງ** ຕໍ່ເດືອນ — ໃບສະເໜີລາຄາທີ່ລູກຄ້າຮັບແລ້ວ ຜູກກັບຊ່າງເຈົ້າຂອງໃບງານ */
export type TechRevenueRow = {
  month: string;
  technician: string;
  jobs: number;
  quoted: string;
  paid: string;
  due: string;
};

export async function techRevenueByMonth(from: string, to: string): Promise<TechRevenueRow[]> {
  return (
    await query<TechRevenueRow>(
      /**
       * ນັບຄືກັນກັບ serviceRevenueByMonth (ໃບສະເໜີລາຄາທີ່ອະນຸມັດ 2 ຂັ້ນ) ແຕ່ **ແຍກຕາມຊ່າງ**.
       * ⚠️ ລວມຕໍ່ **ໃບງານ** ກ່ອນ (sub-query) ບໍ່ດັ່ງນັ້ນໃບງານທີ່ມີຫຼາຍໃບສະເໜີຈະຖືກນັບຊ້ຳ.
       * ວຽກທີ່ຍັງບໍ່ຈັດຊ່າງ ⇒ ຈັດເປັນ 'ຍັງບໍ່ຈັດຊ່າງ' ບໍ່ຖິ້ມ (ບໍ່ດັ່ງນັ້ນຍອດລວມບໍ່ຄົບ).
       */
      `select to_char(x.m,'MM-YYYY') as month,
          coalesce(nullif(x.tech,''),'ຍັງບໍ່ຈັດຊ່າງ') technician,
          count(*)::int jobs,
          to_char(sum(x.quoted),'FM999,999,999,990') quoted,
          to_char(sum(x.paid),'FM999,999,999,990') paid,
          to_char(sum(x.quoted - x.paid),'FM999,999,999,990') due
        from (
          select date_trunc('month', max(q.doc_date))::date m,
              a.code, a.emp_code tech, sum(q.total_amount) quoted,
              coalesce((select sum(amount_thb) from ods_service_payment where job_code = a.code),0) paid
            from ic_trans q
            join tb_product a on a.code = q.product_code
           where ${ACCEPTED_QUOTE} and q.doc_date::date between $1 and $2
           group by a.code, a.emp_code
        ) x
       group by x.m, coalesce(nullif(x.tech,''),'ຍັງບໍ່ຈັດຊ່າງ')
       order by x.m desc, sum(x.quoted) desc`,
      [from, to],
    )
  ).rows;
}

/**
 * **ລາຍຮັບງານຕິດຕັ້ງ — ນັບຈາກໃບງານຕິດຕັ້ງໂດຍກົງ**.
 *
 * ── ຕົວເຊື່ອມທີ່ພົບ (ວັດ 04-08-2026) ──
 * `ods_tb_install.doc_ref_1` ເກັບ **ເລກບິນຂາຍ ERP** ໄວ້ (ເຊັ່ນ CAK24002067) — ມີຄົບ 100%.
 * join ໄປ ERP ຕິດ 6,503/6,972 ໃບ ແລະ **6,393 ໃບ (92%) ມີຄ່າບໍລິການຕິດຕັ້ງ 9701xx**
 * ⇒ ຜູກແບບນີ້ເຊື່ອຖືໄດ້ ບໍ່ຕ້ອງເດົາຈາກລູກຄ້າ+ວັນທີ.
 *
 * ⚠️ ຄ່າຝັ່ງ ERP ເປັນ **ບາດ** — ຜູ້ເອີ້ນແປງເອງດ້ວຍ `kipPerBaht()` ຖ້າຢາກເປັນກີບ.
 * ນັບຕາມ **ວັນປິດງານ** (job_finish) = ວັນທີ່ລາຍຮັບເກີດຈິງຂອງສູນບໍລິການ.
 */
export async function installRevenueBetween(from: string, to: string): Promise<{ jobs: number; baht: number }> {
  const { rows } = await query<{ jobs: number; baht: number }>(
    /**
     * ⚠️ **1 ບິນອາດຄຸມຫຼາຍໃບງານ** (ຕົວຢ່າງ CAK26009420 = INST-7162 + INST-7163)
     * ⇒ ຖ້າ sum ຕາມແຖວ join ຈະນັບຍອດບິນນັ້ນ 2 ເທື່ອ. ຈຶ່ງລວມ **ຕໍ່ບິນ** ກ່ອນ (bills)
     * ແລ້ວຈຶ່ງບວກ — ຍອດລວມຈຶ່ງບໍ່ພອງ.
     */
    `with jobs as (
        select a.code, trim(a.doc_ref_1) bill
          from ods.ods_tb_install a
         where a.cancel_date is null and a.job_finish::date between $1 and $2
           and nullif(trim(coalesce(a.doc_ref_1,'')),'') is not null
      ), bills as (
        -- ບາງແຖວ sum_amount = 0 (ບໍ່ໄດ້ປ້ອນລາຄາ) ⇒ ຖອຍໄປໃຊ້ລາຄາຂາຍມາດຕະຖານ
        -- ic_inventory_price (ສະກຸນ '01' = ບາດ) ທີ່ມີຜົນໃນວັນປິດງານ
        select d.doc_no, sum(coalesce(nullif(d.sum_amount, 0),
              d.qty * coalesce(
                -- ບໍ່ຜູກກັບ to_date (ຕາຕະລາງລາຄາຫຼາຍແຖວໝົດອາຍຸແຕ່ຍັງໃຊ້ຈິງ)
                -- ⇒ ເອົາ **ແຖວສຸດທ້າຍທີ່ມີລາຄາ** ຂອງລະຫັດນັ້ນ
                (select pr.sale_price1 from public.ic_inventory_price pr
                  where pr.ic_code = d.item_code and pr.currency_code = '01'
                    and coalesce(pr.sale_price1,0) > 0
                  order by pr.from_date desc nulls last, pr.roworder desc limit 1),
                -- ບາງລະຫັດບໍ່ມີໃນຕາຕະລາງລາຄາເລີຍ (ເຊັ່ນ 970101-0013 ບໍລິການຕິດຕັ້ງເຄື່ອງໃຊ້ໄຟຟ້າ)
                -- ⇒ ໃຊ້ **ລາຄາທີ່ເຄີຍອອກບິນຫຼ້າສຸດ** ຂອງລະຫັດນັ້ນ (ຂໍ້ມູນຈິງ ບໍ່ແມ່ນເດົາ)
                (select p2.price from public.ic_trans_detail p2
                   join public.ic_trans t2 on t2.doc_no = p2.doc_no
                  where p2.item_code = d.item_code and coalesce(p2.price,0) > 0
                    and t2.doc_date <= a.job_finish
                  order by t2.doc_date desc limit 1),
                0))) baht
          from public.ic_trans_detail d
          join jobs j on j.bill = d.doc_no
          join ods.ods_tb_install a on a.code = j.code
         where d.item_code like '9701%'
         group by d.doc_no
      )
      select (select count(*)::int from jobs j join bills b on b.doc_no = j.bill) jobs,
             (select coalesce(sum(b.baht),0)::float8 from bills b) baht`,
    [from, to],
  );
  return rows[0] ?? { jobs: 0, baht: 0 };
}

/** ລາຍການລະອຽດ — 1 ແຖວ = 1 ໃບງານຕິດຕັ້ງ ພ້ອມບິນ ແລະ ຄ່າບໍລິການຂອງມັນ */
export type InstallRevenueDetail = {
  code: string;
  finished: string | null;
  bill_no: string | null;
  customer: string | null;
  tech: string | null;
  items: string | null;
  baht: number;
};

export async function installRevenueDetail(from: string, to: string, limit: number): Promise<InstallRevenueDetail[]> {
  return (
    await query<InstallRevenueDetail>(
      `select a.code, to_char(a.job_finish,'DD-MM-YYYY') finished,
          trim(a.doc_ref_1) bill_no,
          coalesce(nullif(c.name_1,''), nullif(a.cust_code,'')) customer,
          nullif(a.tech_code,'') tech,
          string_agg(distinct d.item_name, ' · ') items,
          coalesce(sum(coalesce(nullif(d.sum_amount, 0),
              d.qty * coalesce(
                -- ບໍ່ຜູກກັບ to_date (ຕາຕະລາງລາຄາຫຼາຍແຖວໝົດອາຍຸແຕ່ຍັງໃຊ້ຈິງ)
                -- ⇒ ເອົາ **ແຖວສຸດທ້າຍທີ່ມີລາຄາ** ຂອງລະຫັດນັ້ນ
                (select pr.sale_price1 from public.ic_inventory_price pr
                  where pr.ic_code = d.item_code and pr.currency_code = '01'
                    and coalesce(pr.sale_price1,0) > 0
                  order by pr.from_date desc nulls last, pr.roworder desc limit 1),
                -- ບາງລະຫັດບໍ່ມີໃນຕາຕະລາງລາຄາເລີຍ (ເຊັ່ນ 970101-0013 ບໍລິການຕິດຕັ້ງເຄື່ອງໃຊ້ໄຟຟ້າ)
                -- ⇒ ໃຊ້ **ລາຄາທີ່ເຄີຍອອກບິນຫຼ້າສຸດ** ຂອງລະຫັດນັ້ນ (ຂໍ້ມູນຈິງ ບໍ່ແມ່ນເດົາ)
                (select p2.price from public.ic_trans_detail p2
                   join public.ic_trans t2 on t2.doc_no = p2.doc_no
                  where p2.item_code = d.item_code and coalesce(p2.price,0) > 0
                    and t2.doc_date <= a.job_finish
                  order by t2.doc_date desc limit 1),
                0))),0)::float8 baht
        from ods.ods_tb_install a
        join public.ic_trans_detail d
          on d.doc_no = trim(a.doc_ref_1) and d.item_code like '9701%'
        left join ods.ar_customer c on c.code = a.cust_code
       where a.cancel_date is null and a.job_finish::date between $1 and $2
       group by a.code, a.job_finish, a.doc_ref_1, c.name_1, a.cust_code, a.tech_code
       order by a.job_finish desc, a.code desc
       limit $3`,
      [from, to, limit],
    )
  ).rows;
}
