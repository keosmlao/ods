import { query } from "@/lib/db";
import { employeeCode } from "@/lib/erp-employee";
import { listTechnicians } from "@/lib/technicians";
import type { Session } from "@/lib/auth";
import { SETTING, settingEnabled } from "@/lib/settings";

/**
 * **ອັນດັບຊ່າງປະຈຳເດືອນ** — ຈາກ `ods_service_payout` (ຄ່າຄອມທີ່ແຊ່ໄວ້ຕອນປິດງານ),
 * ຊຸດຂໍ້ມູນອັນດຽວກັບໜ້າຄ່າຄອມຂອງຜູ້ຈັດການ ⇒ ຕົວເລກຂອງສອງຝ່າຍບໍ່ຂັດກັນ.
 *
 * ── ເປັນຫຍັງໃຫ້ຊ່າງເຫັນ ──
 * ຊ່າງອາຍຸ 15–25 ຂັບເຄື່ອນດ້ວຍການແຂ່ງກັບໝູ່ຫຼາຍກວ່າຄຳສັ່ງຈາກຫົວໜ້າ. ຕົວເລກນີ້
 * ມີຢູ່ແລ້ວ ພຽງແຕ່ຖືກເກັບໄວ້ໃຫ້ຜູ້ຈັດການເບິ່ງຝ່າຍດຽວ.
 *
 * ── ຄວາມເປັນສ່ວນຕົວ ──
 * ຄ່າຕັ້ງຕົ້ນ **ບໍ່ສະແດງຈຳນວນເງິນຂອງຄົນອື່ນ** (ເຫັນແຕ່ຈຳນວນໃບ + ເງິນຂອງຕົນເອງ) —
 * ການເປີດເຜີຍລາຍໄດ້ລະຫວ່າງເພື່ອນຮ່ວມງານ ສ້າງບັນຫາໄດ້ຫຼາຍກວ່າແຮງຈູງໃຈ.
 * ຜູ້ຈັດການເປີດເຕັມໄດ້ທີ່ ຕັ້ງຄ່າລະບົບ (`mobile_rank_money`).
 */
export type RankRow = {
  rank: number;
  name: string;
  jobs: number;
  /** null = ຖືກເຊື່ອງຕາມການຕັ້ງຄ່າ (ບໍ່ແມ່ນ 0) */
  total_thb: number | null;
  me: boolean;
};

export type MobileRank = {
  month: string;
  /** ອັນດັບຂອງຜູ້ຮ້ອງຂໍ (0 = ຍັງບໍ່ມີໃບປິດເດືອນນີ້) */
  my_rank: number;
  my_jobs: number;
  my_total_thb: number;
  /** ຫ່າງຈາກຄົນເໜືອໜ້າຈັກໃບ (null = ຢູ່ອັນດັບ 1 ຫຼື ຍັງບໍ່ຕິດອັນດັບ) */
  jobs_to_next: number | null;
  show_money: boolean;
  rows: RankRow[];
};

export async function mobileRank(session: Session, month = ""): Promise<MobileRank> {
  const valid = /^\d{4}-\d{2}$/.test(month);
  const first = valid ? `${month}-01` : new Date().toISOString().slice(0, 8) + "01";

  const rows = query
    ? (
        await query<{ employee_code: string | null; job_code: string; pay_thb: number }>(
          `select p.employee_code, p.job_code, p.pay_thb::float8 pay_thb
             from ods_service_payout p
            where p.closed_at >= $1::date
              and p.closed_at < ($1::date + interval '1 month')`,
          [first],
        )
      ).rows
    : [];

  const techs = await listTechnicians();
  const nameOf = new Map(techs.map((tech) => [tech.code, tech.name]));

  // ຄົນດຽວອາດປາກົດເປັນ 2 ລະຫັດ (ERP + ຊື່ຫຼິ້ນ) ⇒ ນັບຕາມລະຫັດທີ່ payout ເກັບ ຄືກັບໜ້າຄ່າຄອມ
  const byPerson = new Map<string, { jobs: Set<string>; total: number }>();
  for (const row of rows) {
    const code = (row.employee_code ?? "").trim();
    if (!code) continue;
    const person = byPerson.get(code) ?? { jobs: new Set<string>(), total: 0 };
    person.jobs.add(row.job_code);
    person.total += row.pay_thb;
    byPerson.set(code, person);
  }

  const mine = [...new Set([await employeeCode(session.username), session.username].filter(Boolean))];
  const showMoney = await settingEnabled(SETTING.MOBILE_RANK_MONEY);

  const ranked = [...byPerson.entries()]
    .map(([code, person]) => ({
      code,
      name: nameOf.get(code) ?? code,
      jobs: person.jobs.size,
      total: person.total,
      me: mine.includes(code),
    }))
    // ຮຽງດ້ວຍ **ຈຳນວນໃບ** ກ່ອນ ແລ້ວຄ່ອຍເງິນ — ຄົນທີ່ໄດ້ໃບໃຫຍ່ 2 ໃບ ບໍ່ຄວນຊະນະ
    // ຄົນທີ່ເຮັດ 20 ໃບ ໃນລະບົບທີ່ຈຸດປະສົງຄືໃຫ້ວຽກຄ້າງຫຼຸດລົງ
    .sort((a, b) => b.jobs - a.jobs || b.total - a.total)
    .map((person, index) => ({ ...person, rank: index + 1 }));

  const me = ranked.find((person) => person.me);

  return {
    month: valid ? month : first.slice(0, 7),
    my_rank: me?.rank ?? 0,
    my_jobs: me?.jobs ?? 0,
    my_total_thb: me?.total ?? 0,
    jobs_to_next:
      me && me.rank > 1 ? Math.max(0, ranked[me.rank - 2].jobs - me.jobs) + 1 : null,
    show_money: showMoney,
    rows: ranked.map((person) => ({
      rank: person.rank,
      name: person.name,
      jobs: person.jobs,
      // ເງິນຂອງ**ຕົນເອງ**ເຫັນສະເໝີ — ຂອງຄົນອື່ນຂຶ້ນກັບການຕັ້ງຄ່າ
      total_thb: showMoney || person.me ? person.total : null,
      me: person.me,
    })),
  };
}
