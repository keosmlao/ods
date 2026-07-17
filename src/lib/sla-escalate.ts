import { logChange } from "@/lib/chatter-log";
import { query } from "@/lib/db";
import { pushToUser } from "@/lib/push";

/**
 * **ເຕືອນອັດຕະໂນມັດ ເມື່ອນາລິກາ 24 ຊມ ໃກ້ໝົດ** (ງານຕິດຕັ້ງ).
 *
 * ── ເປັນຫຍັງ ──
 * ນາລິກາຢູ່ໃນຄິວແລ້ວ — ແຕ່ຄົນທີ່ **ບໍ່ເປີດໜ້ານັ້ນ** ບໍ່ຮູ້ຫຍັງເລີຍ. ຄໍຂວດ 2 ຂັ້ນ
 * (ຂໍ້ມູນ 90 ມື້): **ລໍຈັດຊ່າງ 44 ຊມ** ແລະ **ລໍຊ່າງກົດຮັບງານ 44 ຊມ** ⇒ ຕ້ອງເຕືອນ
 * ອອກໄປຫາຄົນທີ່ຕ້ອງລົງມື ບໍ່ແມ່ນລໍໃຫ້ລາວມາເປີດເບິ່ງເອງ.
 *
 * ── ເຕືອນໃຜ ──
 *   unassigned  (ຍັງບໍ່ຈັດຊ່າງ ແລະ ເຫຼືອ < 12 ຊມ) → CS/ຜູ້ຈັດການ (chatter)
 *   unaccepted  (ຈັດແລ້ວ ແຕ່ຊ່າງຍັງບໍ່ກົດຮັບ ແລະ ເຫຼືອ < 12 ຊມ)
 *                → **push ເຂົ້າມືຖືຊ່າງ** + chatter ຫາຫົວໜ້າຊ່າງ (ຍົກລະດັບ)
 *
 * ⚠️ ເຕືອນ **ເທື່ອດຽວຕໍ່ງານຕໍ່ປະເພດ** (ods_sla_escalation) — ແຈ້ງເຕືອນທີ່ດັງເກີນ
 * ຄືແຈ້ງເຕືອນທີ່ຖືກເມີນ.
 *
 * ⚠️ ຄວາມລົ້ມເຫຼວຂອງ push **ຫ້າມພາໃຫ້ຕົວກວດພັງ** (lib/push ຈັບ error ໄວ້ໝົດແລ້ວ).
 */

/** ເຫຼືອໜ້ອຍກວ່ານີ້ = ເຕືອນ (ຊົ່ວໂມງ) */
const WARN_HOURS = 12;

export type EscalationResult = { unassigned: number; unaccepted: number };

type Job = {
  code: string;
  tech: string | null;
  customer: string | null;
  location: string | null;
  hours_left: number;
};

const LEFT = `extract(epoch from (a.doc_ref_date + interval '24 hours' - localtimestamp))/3600`;

export async function escalateInstallSla(): Promise<EscalationResult> {
  const result: EscalationResult = { unassigned: 0, unaccepted: 0 };

  // ── ① ຍັງບໍ່ຈັດຊ່າງ ⇒ ເຕືອນ CS/ຜູ້ຈັດການ ──
  const unassigned = await query<Job>(
    `select a.code, nullif(a.tech_code,'') as tech, c.name_1 as customer,
        coalesce(nullif(a.location_inst,''), c.address) as location,
        round((${LEFT})::numeric, 1)::float as hours_left
      from ods_tb_install a
      left join ar_customer c on c.code = a.cust_code
     where a.cancel_date is null and a.job_finish is null and a.finish_install is null
       and coalesce(a.tech_code,'') = ''
       and a.doc_ref_date is not null
       and (${LEFT}) < $1
       and not exists (
         select 1 from ods_sla_escalation e where e.job_code = a.code and e.kind = 'unassigned')`,
    [WARN_HOURS],
  );

  for (const job of unassigned.rows) {
    const late = job.hours_left < 0;
    await logChange(
      "ods_tb_install",
      job.code,
      `${late ? "⏰ ເລີຍກຳນົດ 24 ຊມ ແລ້ວ" : `⏰ ເຫຼືອ ${job.hours_left} ຊມ ຈະຄົບ 24 ຊມ`} — ງານນີ້ **ຍັງບໍ່ໄດ້ຈັດຊ່າງ**` +
        ` · ລູກຄ້າ ${job.customer ?? "-"}${job.location ? ` · ${job.location}` : ""}`,
      { roles: ["admin", "manager"] },
    );
    await query("insert into ods_sla_escalation(job_code, kind) values($1,'unassigned') on conflict do nothing", [
      job.code,
    ]);
    result.unassigned += 1;
  }

  // ── ② ຈັດແລ້ວ ແຕ່ຊ່າງຍັງບໍ່ກົດຮັບ ⇒ push ຫາຊ່າງ + ຍົກໃຫ້ຫົວໜ້າ ──
  const unaccepted = await query<Job>(
    `select a.code, nullif(a.tech_code,'') as tech, c.name_1 as customer,
        coalesce(nullif(a.location_inst,''), c.address) as location,
        round((${LEFT})::numeric, 1)::float as hours_left
      from ods_tb_install a
      left join ar_customer c on c.code = a.cust_code
     where a.cancel_date is null and a.job_finish is null and a.finish_install is null
       and coalesce(a.tech_code,'') <> '' and a.tech_confirm is null
       and a.doc_ref_date is not null
       and (${LEFT}) < $1
       and not exists (
         select 1 from ods_sla_escalation e where e.job_code = a.code and e.kind = 'unaccepted')`,
    [WARN_HOURS],
  );

  for (const job of unaccepted.rows) {
    if (!job.tech) continue;
    const late = job.hours_left < 0;
    const headline = late ? "⏰ ເລີຍກຳນົດ 24 ຊມ ແລ້ວ" : `⏰ ເຫຼືອ ${job.hours_left} ຊມ`;

    // ຊ່າງຢູ່ໜ້າງານ ບໍ່ໄດ້ເປີດເວັບຄ້າງໄວ້ ⇒ ຕ້ອງເຂົ້າມືຖື
    await pushToUser(job.tech, `${headline} — ຍັງບໍ່ໄດ້ກົດຮັບງານ`, `${job.code} · ${job.location ?? ""}`, {
      workflow: "install",
      code: job.code,
    });
    // ຫົວໜ້າຊ່າງ/ຜູ້ຈັດການ ຕ້ອງຮູ້ນຳ — ຖ້າຊ່າງເງີຍ ຕ້ອງປ່ຽນຄົນ
    await logChange(
      "ods_tb_install",
      job.code,
      `${headline} — ຊ່າງ ${job.tech} **ຍັງບໍ່ກົດຮັບງານ** · ລູກຄ້າ ${job.customer ?? "-"}`,
      { roles: ["headtechnical", "manager"], users: [job.tech] },
    );
    await query("insert into ods_sla_escalation(job_code, kind) values($1,'unaccepted') on conflict do nothing", [
      job.code,
    ]);
    result.unaccepted += 1;
  }

  return result;
}
