import { query } from "@/lib/db";

/** ຜູ້ຮັບລາຍງານອັດຕະໂນມັດ (email/line) — ໃຊ້ຮ່ວມທຸກລາຍງານ. ຈັດການ /manage/report-recipients. */
export type Recipient = { id: number; channel: "email" | "line"; target: string; name: string | null; active: boolean };

export async function listRecipients(): Promise<Recipient[]> {
  return (await query<Recipient>(`select id, channel, target, name, active from ods_report_recipient order by channel, id`)).rows;
}

/** target ທີ່ active — ໃຫ້ cron ໃຊ້ (email list + line id list) */
export async function recipientTargets(): Promise<{ emails: string[]; lineIds: string[] }> {
  const rows = (await query<{ channel: string; target: string }>(`select channel, target from ods_report_recipient where active`)).rows;
  return {
    emails: rows.filter((r) => r.channel === "email").map((r) => r.target),
    lineIds: rows.filter((r) => r.channel === "line").map((r) => r.target),
  };
}
