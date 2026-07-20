"use client";
import { setReport } from "@/app/actions/report-schedule";
import { REPORT_META } from "@/lib/report-meta";
import type { ReportSchedule } from "@/lib/report-schedule";
import { Clock } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

export function ReportScheduleManager({ schedule }: { schedule: ReportSchedule[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const byKey: Record<string, ReportSchedule> = Object.fromEntries(schedule.map((s) => [s.report_key, s]));
  const save = (key: string, enabled: boolean, time: string) => start(async () => { await setReport(key, enabled, time); router.refresh(); });

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="mb-2 flex items-center gap-1.5 text-xs font-bold text-slate-600"><Clock className="size-4 text-teal-600" /> ເລືອກລາຍງານ + ເວລາສົ່ງ</p>
      <ul className="divide-y divide-slate-100">
        {REPORT_META.map((r) => {
          const s = byKey[r.key];
          const enabled = s?.enabled ?? false;
          const time = s?.send_time ?? "08:00";
          return (
            <li key={r.key} className="flex flex-wrap items-center gap-2 py-2 text-sm">
              <input type="checkbox" checked={enabled} disabled={pending} onChange={(e) => save(r.key, e.target.checked, time)} className="size-4 accent-teal-600" />
              <span className={`min-w-0 flex-1 ${enabled ? "font-medium text-slate-800" : "text-slate-400"}`}>{r.label}</span>
              {s?.last_sent && <span className="text-[11px] text-slate-400">ສົ່ງ {s.last_sent}</span>}
              <input type="time" value={time} disabled={pending} onChange={(e) => save(r.key, enabled, e.target.value)} className="h-8 rounded-lg border border-slate-300 px-2 text-sm outline-none focus:border-teal-500" />
            </li>
          );
        })}
      </ul>
      <p className="mt-2 text-[11px] text-slate-400">cron ຍິງ /api/cron/reports ຮາຍโมง → ສ่ง report ທີ່ຮອດເວลา (ໂມງ send_time). ຕິກ = ເปิด.</p>
    </div>
  );
}
