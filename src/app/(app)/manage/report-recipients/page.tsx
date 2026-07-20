import { RecipientManager } from "@/components/manage/recipient-manager";
import { ReportScheduleManager } from "@/components/manage/report-schedule-manager";
import { getSession } from "@/lib/auth";
import { listRecipients } from "@/lib/report-recipient";
import { listSchedule } from "@/lib/report-schedule";
import { APPROVER_SIDE, roleOf } from "@/lib/roles";
import { Mail } from "lucide-react";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function ReportRecipientsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!APPROVER_SIDE.includes(roleOf(session))) redirect("/forbidden");

  const [recipients, schedule] = await Promise.all([listRecipients(), listSchedule()]);

  return (
    <div className="w-full space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-lg font-bold text-slate-700">
          <Mail className="size-5 text-teal-600" /> ລາຍງານອັດຕະໂນມັດ
        </h1>
        <p className="mt-1 text-sm text-slate-500">ເລືອກລາຍງານ · ຕັ້ງເວລາສົ່ງ · ກຳນົດຜູ້ຮັບ (email / Line OA).</p>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <ReportScheduleManager schedule={schedule} />
        <RecipientManager initial={recipients} />
      </div>
    </div>
  );
}
