import { BackLink } from "@/components/back-link";
import { NewClaimForm } from "@/components/claim/new-claim-form";
import type { ServicePrefill } from "@/components/service-form";
import { ServiceIntake } from "@/components/service-intake";
import { getSession } from "@/lib/auth";
import { searchCustomers } from "@/lib/claim";
import { claimPagePath, type ClaimType } from "@/lib/claim-shared";
import { getErpBrands, getErpCategories } from "@/lib/erp-master";
import { searchSuppliers } from "@/lib/erp-supplier";
import { CLAIM_SIDE, roleOf } from "@/lib/roles";
import { technicianOptions } from "@/lib/technicians";
import { redirect } from "next/navigation";

/**
 * **ສອງໜ້າໃນ route ດຽວ — ແຍກດ້ວຍ `?type=`**:
 *   ບໍ່ມີ type      → **ຮັບເຄື່ອງເຂົ້າງານເຄມ** (intake ⇒ ອອກເລກງານ + CLM-B ອັດຕະໂນມັດ)
 *   type=A ຫຼື C    → **ຟອມເປີດໃບເຄມ** (ບໍ່ມີເຄື່ອງເຂົ້າມາ — ເປັນໃບຮຽກເກັບຕໍ່ supplier)
 *   type=B         → ພາໄປ intake (ຂອບເຂດ/ແຫຼ່ງທົດແທນຕ້ອງມາຈາກໃບຮັບເຄື່ອງ)
 *
 * ⚠️ **ເປັນຫຍັງຕ້ອງລວມຢູ່ນີ້** (ແກ້ 05-08-2026): ຕອນເຄມແຍກ route ຂອງຕົນ (e20fbd8)
 * ໜ້ານີ້ຖືກຂຽນທັບເປັນ intake ຢ່າງດຽວ ແລ້ວ**ບໍ່ອ່ານ `?type=` ອີກ** — ແຕ່ລິ້ງ 4 ບ່ອນ
 * (ປຸ່ມ "ເປີດໃບເຄມ" ຂອງ CLM-A/C · ບັດ candidate CLM-C · ໜ້າໃບຮັບເຄື່ອງ · ໜ້າໃບເຄມ)
 * ຍັງຊີ້ມາທີ່ `/claims/new?type=…&ref_job=…` ⇒ ກົດແລ້ວໄດ້ຟອມ**ຮັບເຄື່ອງ**ແທນ
 * ແລະ **CLM-A/CLM-C ເປີດບໍ່ໄດ້ເລີຍ** (ຟອມ NewClaimForm ກາຍເປັນໂຄດກຳພ້າ).
 */
export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<
    ServicePrefill & {
      type?: string;
      ref_job?: string;
      brand?: string;
      supplier?: string;
      /** ຊື່ສິນຄ້າ — ລິ້ງຝັ່ງເຄມສົ່ງມາເປັນ `product` (ຟອມຮັບເຄື່ອງໃຊ້ `proname`) */
      product?: string;
      model?: string;
      sn?: string;
    }
  >;
};

const isDocType = (v: string): v is Extract<ClaimType, "A" | "C"> => v === "A" || v === "C";

export default async function NewClaimJob({ searchParams }: Props) {
  const prefill = await searchParams;
  const type = (prefill.type ?? "").trim();

  // ── ① ໃບເຄມ A/C — ບໍ່ມີເຄື່ອງເຂົ້າສູນ ⇒ ຟອມເອກະສານ ບໍ່ແມ່ນຟອມຮັບເຄື່ອງ ──
  if (isDocType(type)) {
    const session = await getSession();
    if (!session) redirect("/login");
    if (!CLAIM_SIDE.includes(roleOf(session))) redirect("/forbidden");

    const [suppliers, customers] = await Promise.all([
      searchSuppliers("", 1000).catch(() => []),
      searchCustomers("", 2000).catch(() => []),
    ]);

    return (
      <div className="w-full space-y-4">
        <div>
          <BackLink fallback={claimPagePath(type)} label="ກັບລາຍການເຄມ" />
          <h1 className="flex items-center gap-2 text-xl font-bold text-slate-700">
            <span className="rounded bg-brand-50 px-2 py-0.5 font-mono text-sm text-brand-800">CLM-{type}</span>
            ເປີດໃບເຄມໃໝ່
          </h1>
          <p className="mt-0.5 text-xs text-slate-500">
            {type === "C"
              ? <>ຕ້ອງອ້າງອີງ <b className="text-slate-700">ເລກງານສ້ອມທີ່ສົ່ງຄືນລູກຄ້າສຳເລັດແລ້ວ</b> — ຄ່າສ້ອມຈຶ່ງເກັບນຳ supplier ໄດ້</>
              : <>ຂໍອາໄຫຼ່/ເຄຣດິດນຳ supplier — ບໍ່ມີເຄື່ອງເຂົ້າສູນ ເປັນເອກະສານຮຽກເກັບ</>}
          </p>
        </div>
        <NewClaimForm
          suppliers={suppliers.map((s) => ({ code: s.code, name: s.name }))}
          customers={customers.map((c) => ({ code: c.code, name: c.name }))}
          defaultType={type}
          initialRefJob={prefill.ref_job ?? ""}
          initialBrand={prefill.brand ?? ""}
          initialSupplier={prefill.supplier ?? ""}
          initialProduct={prefill.product ?? prefill.proname ?? ""}
          initialModel={prefill.model ?? ""}
          initialSn={prefill.sn ?? ""}
        />
      </div>
    );
  }

  // ── ② CLM-B ຕ້ອງເກີດຈາກໃບຮັບເຄື່ອງ ⇒ ຕົກລົງມາໃຊ້ຟອມ intern ດຽວກັນຂ້າງລຸ່ມ ──
  const [types, brands, techs] = await Promise.all([
    getErpCategories(),
    getErpBrands(),
    technicianOptions(),
  ]);

  return (
    <div className="w-full space-y-4">
      <div>
        <BackLink fallback="/claims/jobs" label="ກັບຄິວງານເຄມ" />
        <h1 className="text-xl font-bold text-slate-700">🛡️ ຮັບເຄື່ອງເຂົ້າງານເຄມ</h1>
        <p className="mt-0.5 text-xs text-slate-500">
          ຮ້ານຄ້າ/ລູກຄ້າສົ່ງມາເຄມ → ອອກເລກງານໃຫ້ຮ້ານ → ສ້າງໃບເຄມ CLM-B ອັດຕະໂນມັດ
        </p>
      </div>

      {/* kind=claim ບັງຄັບຈາກ route ນີ້ — ຟອມບໍ່ມີປຸ່ມສະຫຼັບໄປງານສ້ອມແລ້ວ */}
      <ServiceIntake types={types} brands={brands} techs={techs} prefill={{ ...prefill, kind: "claim" }} />
    </div>
  );
}
