import { query } from "@/lib/db";

/**
 * **ຕື່ມ ISN/SN ຄືນໃຫ້ໃບງານຕິດຕັ້ງເກົ່າ ຈາກໃບຈ່າຍສິນຄ້າອອກສາງ** (07-08-2026).
 *
 * ── ເປັນຫຍັງມີ ──
 * ໃບງານ 1 ປີຫຼັງ **2,559 ໃບຂາດ ISN/SN** (ຫວ່າງ ຫຼື ໃສ່ "-") ⇒ ຮັບປະກັນ/ສ້ອມພາຍຫຼັງ
 * ອ້າງອີງບໍ່ໄດ້ວ່າແມ່ນເຄື່ອງໜ່ວຍໃດ. ຄວາມຈິງມີຢູ່ ERP ແລ້ວ: `sn_trans_detail` ຂອງ
 * **ໃບຈ່າຍ (DPC…)** ທີ່ອ້າງບິນ (CAK…) ບອກໄວ້ວ່າຈ່າຍໜ່ວຍໃດໃຫ້ບິນໃດ.
 *
 * ── ເປັນຫຍັງເປັນ "ປຸ່ມ" ບໍ່ແມ່ນ cron ──
 * ນີ້ຄືການ**ລ້າງຂໍ້ມູນເກົ່າເທື່ອດຽວ** ບໍ່ແມ່ນວຽກປະຈຳ. ໃບງານ**ໃໝ່**ບໍ່ຕ້ອງໃຊ້ອັນນີ້ —
 * ຊ່າງເປັນຄົນເກັບເລກຢູ່ໜ້າງານ (ເບິ່ງ lib/install-scan) ຊຶ່ງເປັນຫຼັກຖານທີ່ໜັກກວ່າ.
 * ⚠️ ຢ່າເອົາໄປແລ່ນອັດຕະໂນມັດກັບໃບທີ່ຍັງເຮັດຢູ່ — ຈະກາຍເປັນການ "ຕື່ມແທນຊ່າງ".
 *
 * ── ກົດ (ດຽວກັນກັບຕອນຊ່າງຍິງ) ──
 *   ① ຕື່ມສະເພາະຊ່ອງ**ຫວ່າງ** — "-" ແລະ "N/A" ນັບເປັນຫວ່າງ (ຂໍ້ມູນເກົ່າໃສ່ໄວ້ແນວນັ້ນ)
 *   ② ໜ່ວຍທີ່ໃບອື່ນ**ຂອງບິນດຽວກັນ**ຈອງໄປແລ້ວ ບໍ່ເອົາຄືນ — ກັນເລກຊ້ຳ
 *      (ຮູເກົ່າຈິງ: INST-7213 ກັບ INST-7214 ໄດ້ເລກອັນດຽວກັນຍ້ອນພິມມື)
 *   ③ ແອ: `[C]` = ໜ່ວຍໃນ · `[H]` = ໜ່ວຍນອກ (ຜ່ານ ic_inventory_set_detail)
 *   ④ ເກັບ **SN ໂຮງງານ** ຖ້າ ERP ຮູ້ ບໍ່ດັ່ງນັ້ນເກັບ ISN
 *   ⑤ ບັນທຶກລົງ chatter ວ່າ "ລະບົບຕື່ມ" — **ບໍ່ຍິງແຈ້ງເຕືອນ** (1,050 × 258 ຄົນ
 *      = ຖ້ວມກ່ອງທຸກຄົນ ແລະ ບໍ່ມີໃຜຕ້ອງລົງມືກັບຂໍ້ມູນເກົ່າ)
 *
 * ແລ່ນຊ້ຳໄດ້: ຮອບສອງຈະບໍ່ຕື່ມຫຍັງອີກ ເພາະຊ່ອງບໍ່ຫວ່າງແລ້ວ.
 */

/** ຄ່າ "ບໍ່ແມ່ນເລກຈິງ" ⇒ ນັບເປັນຫວ່າງ — ຫຼັກການດຽວກັບ realSerial ຂອງ lib/install-scan */
const EMPTY = (column: string) =>
  `nullif(nullif(nullif(upper(trim(${column})),''),'-'),'N/A')`;

/**
 * ແຜນການຕື່ມ — ຄິດຄັ້ງດຽວແລ້ວໃຊ້ຊ້ຳທັງຕອນສະແດງ ແລະ ຕອນລົງມື ⇒ ຕົວເລກທີ່ຄົນເຫັນ
 * ກັບສິ່ງທີ່ຖືກຂຽນ ແມ່ນອັນດຽວກັນສະເໝີ.
 *
 * ⚠️ `sn_trans_detail` ບໍ່ມີ index ຢູ່ doc_ref ⇒ ກວາດຮອບດຽວດ້ວຍ `in (…)` ຂອງບິນທັງໝົດ
 * (ວັດແທ້ ~3 ວິນາທີ ສຳລັບ 1 ປີ). ຢ່າຂຽນເປັນ subquery ຕໍ່ແຖວ — ຈະກາຍເປັນນາທີ.
 */
const PLAN = `
  with job as (
    select a.code, a.doc_ref_1 bill, a.item_code,
        ${EMPTY("a.pro_sn")} pro_sn, ${EMPTY("a.pro_sn_out")} pro_sn_out
      from ods_tb_install a
     where a.cancel_date is null and coalesce(a.doc_ref_1,'') <> ''
       and a.doc_ref_date >= current_date - $1::int
  ), issued as (
    select d.doc_ref bill, d.sn isn, nullif(sni.sn,'') sn,
        (d.item_name like '%[H]%') outdoor, d.item_code
      from public.sn_trans_detail d
      left join public.sn_inventory sni on sni.isn = d.sn
     where d.trans_flag = 44 and coalesce(d.sn,'') <> ''
       and d.doc_ref in (select distinct bill from job)
  ), pair as (
    select j.code, j.bill, j.item_code, i.isn, i.sn, i.outdoor
      from job j join issued i on i.bill = j.bill
     where i.item_code = j.item_code
        or i.item_code in (select sd.ic_code from public.ic_inventory_set_detail sd
                            where sd.ic_set_code = j.item_code)
  ), used as (
    select distinct j.bill, upper(replace(replace(v,' ',''),'-','')) val
      from job j, lateral (values (j.pro_sn), (j.pro_sn_out)) t(v) where v is not null
  ), free_unit as (
    select p.*, row_number() over (partition by p.bill, p.item_code, p.outdoor order by p.isn) rn
      from (select distinct bill, item_code, isn, sn, outdoor from pair) p
     where upper(replace(replace(p.isn,' ',''),'-','')) not in (select val from used u where u.bill = p.bill)
       and upper(replace(replace(coalesce(p.sn,'~'),' ',''),'-','')) not in (select val from used u where u.bill = p.bill)
  ), need as (
    select j.code, j.bill, j.item_code, false outdoor,
        row_number() over (partition by j.bill, j.item_code order by j.code) rn
      from job j where j.pro_sn is null
     union all
    select j.code, j.bill, j.item_code, true,
        row_number() over (partition by j.bill, j.item_code order by j.code)
      from job j where j.pro_sn_out is null
  )
  select n.code, n.outdoor, f.isn, coalesce(f.sn, f.isn) as value
    from need n
    join free_unit f on f.bill = n.bill and f.item_code = n.item_code
                    and f.outdoor = n.outdoor and f.rn = n.rn`;

export type BackfillPlan = {
  slots: number;
  jobs: number;
  outdoor: number;
  /** ຕົວຢ່າງ 10 ແຖວທຳອິດ — ໃຫ້ຄົນເບິ່ງກ່ອນກົດ */
  sample: { code: string; outdoor: boolean; isn: string; value: string }[];
};

/** ຈະຕື່ມຫຍັງແດ່ — ອ່ານຢ່າງດຽວ (ໃຫ້ໜ້າຈໍສະແດງກ່ອນຄົນຕັດສິນ) */
export async function planInstallSerialBackfill(days = 365): Promise<BackfillPlan> {
  const rows = (
    await query<{ code: string; outdoor: boolean; isn: string; value: string }>(
      `${PLAN} order by n.code`,
      [days],
    )
  ).rows;
  return {
    slots: rows.length,
    jobs: new Set(rows.map((row) => row.code)).size,
    outdoor: rows.filter((row) => row.outdoor).length,
    sample: rows.slice(0, 10),
  };
}

/** ລົງມືຕື່ມ — ຄືນຈຳນວນຊ່ອງທີ່ຂຽນຈິງ */
export async function runInstallSerialBackfill(actor: string, days = 365): Promise<BackfillPlan & { written: number }> {
  const plan = await planInstallSerialBackfill(days);
  if (plan.slots === 0) return { ...plan, written: 0 };

  const indoor = await query(
    `with plan as (${PLAN})
     update ods_tb_install a
        set pro_sn = plan.value, user_edit = $2
       from plan
      where plan.code = a.code and not plan.outdoor and ${EMPTY("a.pro_sn")} is null`,
    [days, `${actor} (ຕື່ມຈາກໃບຈ່າຍ)`],
  );
  const out = await query(
    `with plan as (${PLAN})
     update ods_tb_install a
        set pro_sn_out = plan.value, user_edit = $2
       from plan
      where plan.code = a.code and plan.outdoor and ${EMPTY("a.pro_sn_out")} is null`,
    [days, `${actor} (ຕື່ມຈາກໃບຈ່າຍ)`],
  );

  /**
   * ປະຫວັດຂອງແຕ່ລະໃບ — ຂຽນ chatter ໂດຍກົງ **ບໍ່ຜ່ານ logChange** ເພາະອັນນັ້ນຈະ
   * ຍິງແຈ້ງເຕືອນຫາຜູ້ຮັບທຸກຄົນ (1,050 ໃບ × 258 ຄົນ = ຖ້ວມກ່ອງທຸກຄົນ ແລະ ບໍ່ມີໃຜ
   * ຕ້ອງລົງມືກັບຂໍ້ມູນເກົ່າ). ຄົນທີ່ຢາກກວດຍ້ອນຫຼັງຍັງເຫັນຢູ່ໃນປະຫວັດຂອງໃບນັ້ນ.
   */
  await query(
    `with plan as (${PLAN})
     insert into ods_chatter_message(model, res_id, kind, body, author, created_at)
     select 'ods_tb_install', plan.code, 'log',
         'ຕື່ມ ' || case when plan.outdoor then 'ໜ່ວຍນອກ' else 'ໜ່ວຍໃນ' end || ': ' || plan.value ||
         ' (ISN ' || plan.isn || ') — ດຶງຈາກໃບຈ່າຍສິນຄ້າຂອງບິນ ໂດຍລະບົບ',
         $2, localtimestamp(0)
       from plan`,
    [days, actor],
  );

  return { ...plan, written: (indoor.rowCount ?? 0) + (out.rowCount ?? 0) };
}
