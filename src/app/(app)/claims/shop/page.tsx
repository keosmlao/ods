import { getSession } from "@/lib/auth";
import { ClaimsView } from "@/components/claims/claims-view";
import { CLAIM_SIDE, roleOf } from "@/lib/roles";
import { redirect } from "next/navigation";

/** CLM-B — ຮັບເຄມຈາກຮ້ານ (ໃບແມ່/ໜ້າດ່ານ) */
export const dynamic = "force-dynamic";

export default async function ClaimShopPage({ searchParams }: { searchParams: Promise<{ status?: string; q?: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!CLAIM_SIDE.includes(roleOf(session))) redirect("/forbidden");
  const sp = await searchParams;
  return <ClaimsView type="B" basePath="/claims/shop" status={sp.status?.trim() || ""} q={sp.q?.trim() || ""} />;
}
