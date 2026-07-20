import { NewClaimForm } from "@/components/claim/new-claim-form";
import { getSession } from "@/lib/auth";
import { type ClaimType } from "@/lib/claim";
import { getErpBrands } from "@/lib/erp-master";
import { searchSuppliers } from "@/lib/erp-supplier";
import { CLAIM_SIDE, roleOf } from "@/lib/roles";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

const isType = (v: string): v is ClaimType => ["A", "B", "C"].includes(v);

type Props = { searchParams: Promise<{ type?: string }> };

export default async function NewClaimPage({ searchParams }: Props) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!CLAIM_SIDE.includes(roleOf(session))) redirect("/forbidden");

  const sp = await searchParams;
  const defaultType: ClaimType = isType(sp.type ?? "") ? (sp.type as ClaimType) : "A";
  const [suppliers, brands] = await Promise.all([
    searchSuppliers("", 1000).catch(() => []),
    getErpBrands().catch(() => []),
  ]);

  return (
    <div className="w-full space-y-4">
      <Link href="/claims" className="inline-flex items-center gap-1 text-sm font-semibold text-slate-500 hover:text-slate-700">
        <ChevronLeft className="size-4" /> ກັບລາຍการเคลม
      </Link>
      <h1 className="text-lg font-bold text-slate-700">ເປີດໃບເຄມໃໝ່</h1>
      <NewClaimForm suppliers={suppliers.map((s) => ({ code: s.code, name: s.name }))} brands={brands} defaultType={defaultType} />
    </div>
  );
}
