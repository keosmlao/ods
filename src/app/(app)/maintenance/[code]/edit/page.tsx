import { MaintenanceForm } from "@/components/maintenance/maintenance-form";
import { getSession } from "@/lib/auth";
import { maintenanceCatalog, maintenanceJob } from "@/lib/maintenance";
import { MAINTENANCE_SIDE, roleOf } from "@/lib/roles";
import { listTechnicians } from "@/lib/technicians";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function EditMaintenancePage({ params }: { params: Promise<{ code: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!MAINTENANCE_SIDE.includes(roleOf(session))) redirect("/forbidden");

  const { code } = await params;
  const [data, catalog, techs] = await Promise.all([maintenanceJob(code), maintenanceCatalog(), listTechnicians()]);
  if (!data) notFound();
  if (data.job.stage > 1 || data.job.stage < 0) redirect(`/maintenance/${encodeURIComponent(code)}`);

  return (
    <div className="w-full space-y-4">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-800">ແກ້ໄຂງານ {data.job.code}</h1>
          <p className="mt-1 text-xs text-slate-400">ແກ້ໄຂຂໍ້ມູນລູກຄ້າ, ນັດໝາຍ, ຊ່າງ ແລະ ລາຍການບໍລິການ</p>
        </div>
        <Link href={`/maintenance/${encodeURIComponent(code)}`} className="text-sm font-semibold text-slate-500 hover:text-slate-700">
          ← ກັບໜ້າລາຍລະອຽດ
        </Link>
      </header>

      <MaintenanceForm
        catalog={catalog}
        technicians={techs.map((tech) => ({ code: tech.code, name: tech.name }))}
        initial={{
          code: data.job.code,
          cust_name: data.job.cust_name ?? "",
          cust_tel: data.job.cust_tel ?? "",
          location: data.job.location ?? "",
          emp_code: data.job.emp_code ?? "",
          appoint_date: data.job.appoint_date ?? "",
          remark: data.job.remark ?? "",
          lines: data.details.map((line) => ({
            service_code: line.service_code,
            name: line.name,
            qty: line.qty,
            price: line.price,
          })),
        }}
      />
    </div>
  );
}
