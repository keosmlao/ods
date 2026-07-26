import { getSession } from "@/lib/auth";
import { ClaimsView } from "@/components/claims/claims-view";
import { CLAIM_SIDE, roleOf } from "@/lib/roles";
import { redirect } from "next/navigation";

/** CLM-C — ເກັບຄ່າສ້ອມ/ຊົດເຊີຍ ນຳ supplier */
export const dynamic = "force-dynamic";

export default async function ClaimReimbursePage({ searchParams }: { searchParams: Promise<{ status?: string; q?: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!CLAIM_SIDE.includes(roleOf(session))) redirect("/forbidden");
  const sp = await searchParams;
  return <ClaimsView type="C" basePath="/claims/reimburse" status={sp.status?.trim() || ""} q={sp.q?.trim() || ""} />;
}
