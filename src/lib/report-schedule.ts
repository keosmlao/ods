import { query } from "@/lib/db";

export type ReportSchedule = { report_key: string; enabled: boolean; send_time: string; last_sent: string | null };

export async function listSchedule(): Promise<ReportSchedule[]> {
  return (await query<ReportSchedule>(
    `select report_key, enabled, send_time, to_char(last_sent,'DD-MM-YYYY') last_sent from ods_report_schedule`,
  )).rows;
}

/** report ທີ່ enabled + ໂມງ send_time == ໂມງປັດຈຸບັນ + ຍັງບໍ່ສົ່ງມື້ນີ້ */
export async function dueReports(): Promise<string[]> {
  const rows = (await query<{ report_key: string }>(
    `select report_key from ods_report_schedule
      where enabled and split_part(send_time,':',1)::int = extract(hour from now())::int
        and (last_sent is null or last_sent < current_date)
      order by report_key`,
  )).rows;
  return rows.map((r) => r.report_key);
}

export async function markSent(keys: string[]): Promise<void> {
  if (!keys.length) return;
  await query(`update ods_report_schedule set last_sent = current_date where report_key = any($1)`, [keys]);
}
