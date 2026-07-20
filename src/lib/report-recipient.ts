import { query } from "@/lib/db";

/** ຜູ້ຮັບລາຍງານອັດຕະໂນມັດ (email/line) — ຈັດການໃນ UI (/manage/report-recipients). */
export type Recipient = { id: number; report: string; channel: "email" | "line"; target: string; name: string | null; active: boolean };

export async function listRecipients(report = "claim"): Promise<Recipient[]> {
  return (await query<Recipient>(`select id, report, channel, target, name, active from ods_report_recipient where report = $1 order by channel, id`, [report])).rows;
}

/** target ທີ່ active — ໃຫ້ cron ໃຊ້ (email list + line id list) */
export async function recipientTargets(report = "claim"): Promise<{ emails: string[]; lineIds: string[] }> {
  const rows = (await query<{ channel: string; target: string }>(`select channel, target from ods_report_recipient where report = $1 and active`, [report])).rows;
  return {
    emails: rows.filter((r) => r.channel === "email").map((r) => r.target),
    lineIds: rows.filter((r) => r.channel === "line").map((r) => r.target),
  };
}
