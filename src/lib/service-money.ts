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
      `select to_char(x.m,'MM-YYYY') month, count(*)::int jobs,
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
