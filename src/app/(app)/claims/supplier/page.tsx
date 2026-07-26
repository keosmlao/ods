import { getSession } from "@/lib/auth";
import { ClaimsView } from "@/components/claims/claims-view";
import { CLAIM_SIDE, roleOf } from "@/lib/roles";
import { redirect } from "next/navigation";

/** CLM-A — ເຄມອາໄຫຼ່ກັບ supplier */
export const dynamic = "force-dynamic";

export default async function ClaimSupplierPage({ searchParams }: { searchParams: Promise<{ status?: string; q?: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!CLAIM_SIDE.includes(roleOf(session))) redirect("/forbidden");
  const sp = await searchParams;
  return <ClaimsView type="A" basePath="/claims/supplier" status={sp.status?.trim() || ""} q={sp.q?.trim() || ""} />;
}
