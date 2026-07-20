import { RecipientManager } from "@/components/manage/recipient-manager";
import { getSession } from "@/lib/auth";
import { listRecipients } from "@/lib/report-recipient";
import { APPROVER_SIDE, roleOf } from "@/lib/roles";
import { Mail } from "lucide-react";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function ReportRecipientsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!APPROVER_SIDE.includes(roleOf(session))) redirect("/forbidden");

  const recipients = await listRecipients("claim");

  return (
    <div className="w-full space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-lg font-bold text-slate-700">
          <Mail className="size-5 text-teal-600" /> ຜູ້ຮັບລາຍງານອັດຕະໂນມັດ (ເຄມ)
        </h1>
        <p className="mt-1 text-sm text-slate-500">ກຳນົດ email / Line OA ທີ່ຮັບ ສະຫຼຸບເຄມປະຈຳວັນ + email ຕໍ່ໃບເຄມ.</p>
      </div>
      <RecipientManager initial={recipients} />
    </div>
  );
}
