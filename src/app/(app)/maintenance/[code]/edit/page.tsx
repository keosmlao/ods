import { getDictionary } from "@/lib/i18n/dictionaries";
import { getLocale } from "@/lib/i18n/locale";
import { JobEditHeader } from "@/components/job-edit-header";
import { MaintenanceForm } from "@/components/maintenance/maintenance-form";
import { getSession } from "@/lib/auth";
import { maintenanceCatalog, maintenanceJob } from "@/lib/maintenance";
import { MAINTENANCE_SIDE, roleOf } from "@/lib/roles";
import { listTechnicians } from "@/lib/technicians";
import { notFound, redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function EditMaintenancePage({ params }: { params: Promise<{ code: string }> }) {
  const t = (await getDictionary(await getLocale())).jobEdit;
  const fill = (text: string, vars: Record<string, string>) =>
    Object.entries(vars).reduce((out, [k, v]) => out.replaceAll(`{${k}}`, v), text);
  const session = await getSession();
  if (!session) redirect("/login");
  if (!MAINTENANCE_SIDE.includes(roleOf(session))) redirect("/forbidden");

  const { code } = await params;
  const [data, catalog, techs] = await Promise.all([maintenanceJob(code), maintenanceCatalog(), listTechnicians()]);
  if (!data) notFound();
  if (data.job.stage > 1 || data.job.stage < 0) redirect(`/maintenance/${encodeURIComponent(code)}`);

  return (
    <div className="w-full space-y-4">
      <JobEditHeader
        back={{ href: `/maintenance/${encodeURIComponent(code)}`, label: t.backMaintenance }}
        title={fill(t.titleMaintenance, { code: data.job.code })}
        subtitle={[data.job.cust_name, data.job.cust_tel, data.job.location].filter(Boolean).join(" · ")}
        /**
         * ໜ້ານີ້ພາອອກຕັ້ງແຕ່ຂັ້ນ >1 ຢູ່ແລ້ວ (ຊ່າງຮັບງານແລ້ວ = ແກ້ບໍ່ໄດ້ — ດ່ານດຽວກັບ
         * updateMaintenance) ⇒ ຄົນທີ່ຮອດຟອມນີ້ແກ້ໄດ້ໝົດ, ບໍ່ຕ້ອງເຕືອນ.
         */
        locked={null}
      />

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
