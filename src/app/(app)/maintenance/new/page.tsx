import { MaintenanceForm } from "@/components/maintenance/maintenance-form";
import { getSession } from "@/lib/auth";
import { maintenanceCatalog } from "@/lib/maintenance";
import { MAINTENANCE_SIDE, roleOf } from "@/lib/roles";
import { listTechnicians } from "@/lib/technicians";
import { SprayCan } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function NewMaintenancePage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!MAINTENANCE_SIDE.includes(roleOf(session))) redirect("/forbidden");

  const [catalog, techs] = await Promise.all([maintenanceCatalog(), listTechnicians()]);

  return (
    <div className="w-full space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="flex items-center gap-2 text-xl font-bold text-slate-700">
          <SprayCan className="size-6 text-brand-500" />
          ເປີດງານສ້ອມບໍລຸງ
        </h1>
        <Link href="/maintenance" className="text-sm font-semibold text-slate-500 hover:text-slate-700">
          ← ກັບລາຍການ
        </Link>
      </div>
      <MaintenanceForm catalog={catalog} technicians={techs.map((t) => ({ code: t.code, name: t.name }))} />
    </div>
  );
}
