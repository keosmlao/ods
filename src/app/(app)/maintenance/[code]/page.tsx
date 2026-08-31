import { MaintenanceDetail } from "@/components/maintenance/maintenance-detail";
import { getSession } from "@/lib/auth";
import { maintenanceJob } from "@/lib/maintenance";
import { MAINTENANCE_SIDE, roleOf } from "@/lib/roles";
import { listTechnicians } from "@/lib/technicians";
import { notFound, redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function MaintenanceDetailPage({ params }: { params: Promise<{ code: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!MAINTENANCE_SIDE.includes(roleOf(session))) redirect("/forbidden");

  const { code } = await params;
  const [data, techs] = await Promise.all([maintenanceJob(code), listTechnicians()]);
  if (!data) notFound();

  /**
   * ຊ່າງ (technical) ເຫັນສະເພາະປຸ່ມທີ່ຕົນກົດໃນແອັບ — ຮັບງານ · ເລີ່ມລ້າງ · ລ້າງສຳເລັດ.
   * ຈັດຊ່າງ · QC · ເກັບເງິນ/ປິດ · ຍົກເລີກ ເປັນໜ້າທີ່ CS/ຫົວໜ້າ (ເບິ່ງ lib/maintenance-flow).
   */
  const isTech = roleOf(session) === "technical";

  return (
    <MaintenanceDetail
      job={data.job}
      details={data.details}
      steps={data.steps}
      cancelledAt={data.cancelledAt}
      technicians={techs.map((t) => ({ code: t.code, name: t.name }))}
      isTech={isTech}
    />
  );
}
