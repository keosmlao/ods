import { redirect } from "next/navigation";

/**
 * **ເສັ້ນທາງເກົ່າ** `/dashboard/status/<ສາຍງານ>/<ຂັ້ນ>` → ຍ້າຍໄປ `/work/<ສາຍງານ>/<ຂັ້ນ>` (04-08-2026).
 * ຄົງໄວ້ເປັນ redirect ເພື່ອບໍ່ໃຫ້ລິ້ງເກົ່າ · bookmark · ລິ້ງໃນແຈ້ງເຕືອນເກົ່າ ພັງ.
 */
export default async function LegacyStatusRedirect({
  params,
}: {
  params: Promise<{ workflow: string; status: string }>;
}) {
  const { workflow, status } = await params;
  redirect(`/work/${encodeURIComponent(workflow)}/${encodeURIComponent(status)}`);
}
