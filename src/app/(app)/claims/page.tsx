import { claimPagePath } from "@/lib/claim-shared";
import { redirect } from "next/navigation";

/**
 * /claims → ແຍກເປັນ 3 ໜ້າແລ້ວ (shop·supplier·reimburse). redirect ໄປໜ້າທີ່ຖືກ —
 * ຮັກສາ deep-link ເກົ່າ `?type=A/B/C`. ຄ່າເລີ່ມຕົ້ນ = ຮ້ານ (B, ໃບແມ່/ໜ້າດ່ານ).
 */
export const dynamic = "force-dynamic";

export default async function ClaimsIndex({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  const sp = await searchParams;
  const type = sp.type === "A" || sp.type === "C" ? sp.type : "B";
  redirect(claimPagePath(type));
}
