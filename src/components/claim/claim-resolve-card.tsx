"use client";
import { advanceClaim, resolveClaim } from "@/app/actions/claim";
import { claimNextStatus, claimStatusLabel, type ClaimRow } from "@/lib/claim-shared";
import { ArrowRight, LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

/**
 * **ຕັດສິນ / ເລື່ອນຂັ້ນ ໃບເຄມ CLM-B** ຢູ່ໜ້າໃບງານເຄມ (/claims/jobs/detail).
 *
 * ແຕ່ກ່ອນຕ້ອງເປີດໜ້າໃບເຄມອີກໜ້າໜຶ່ງຈຶ່ງກົດໄດ້ ⇒ ຄົນເຄມເດັ້ງໄປມາລະຫວ່າງ 2 ໜ້າ.
 * ບ່ອນນີ້ເປັນ **ຂັ້ນຫຼັກຂອງເຄມ** ຈຶ່ງເອົາມາໄວ້ຄຽງກັບຜົນກວດຂອງຊ່າງ (ຂໍ້ມູນທີ່ໃຊ້ຕັດສິນ).
 * ດ່ານຈິງຢູ່ actions/claim (ກວດ status + ສິດ) — ບ່ອນນີ້ພຽງແຕ່ຢູ່ໃນ UI ຂອງເຄມ.
 */
export function ClaimResolveCard({ claim, canEdit }: { claim: ClaimRow; canEdit: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState("");

  const next = claimNextStatus(claim.claim_type, claim.status);
  const act = (fn: () => Promise<{ error?: string }>) =>
    start(async () => {
      setError("");
      const result = await fn();
      if (result?.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    });

  const button = "inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold text-white disabled:opacity-60";

  return (
    <section className="rounded-xl border border-violet-200 bg-violet-50/40 p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-sm font-bold text-slate-700">
          ໃບເຄມ {claim.claim_no} · ຂັ້ນ{" "}
          <span className="rounded-full bg-violet-600 px-2 py-0.5 text-xs text-white">
            {claimStatusLabel(claim.claim_type, claim.status)}
          </span>
        </p>
        {claim.resolution && (
          <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-violet-700 ring-1 ring-violet-200">
            ຕັດສິນແລ້ວ: {claim.resolution === "repair" ? "ສ້ອມ" : `ປ່ຽນ · ${claim.fulfillment_source ?? ""}`}
          </span>
        )}
      </div>

      {canEdit && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {/* ຂັ້ນ "ກວດ/ຕັດສິນ" ⇒ 4 ທາງ (ນິຍາມດຽວກັບ actions/claim.resolveClaim) */}
          {claim.claim_type === "B" && claim.status === "checking" ? (
            <>
              <span className="text-xs font-semibold text-slate-500">ຕັດສິນ:</span>
              <button type="button" disabled={pending} onClick={() => act(() => resolveClaim(claim.claim_no, "repair"))} className={`${button} bg-teal-600 hover:bg-teal-700`}>
                {pending ? <LoaderCircle className="size-4 animate-spin" /> : <ArrowRight className="size-4" />} ສ້ອມໃຫ້
              </button>
              <button type="button" disabled={pending} onClick={() => act(() => resolveClaim(claim.claim_no, "replace", "stock"))} className={`${button} bg-emerald-600 hover:bg-emerald-700`}>
                <ArrowRight className="size-4" /> ປ່ຽນຈາກ stock
              </button>
              <button type="button" disabled={pending} onClick={() => act(() => resolveClaim(claim.claim_no, "replace", "purchase"))} className={`${button} bg-amber-500 hover:bg-amber-600`}>
                <ArrowRight className="size-4" /> ສັ່ງຊື້ມາປ່ຽນ
              </button>
              <button type="button" disabled={pending} onClick={() => act(() => resolveClaim(claim.claim_no, "replace", "supplier"))} className={`${button} bg-violet-600 hover:bg-violet-700`}>
                <ArrowRight className="size-4" /> ເຄມ supplier
              </button>
            </>
          ) : next ? (
            <button type="button" disabled={pending} onClick={() => act(() => advanceClaim(claim.claim_no, next.status))} className={`${button} bg-violet-600 hover:bg-violet-700`}>
              {pending ? <LoaderCircle className="size-4 animate-spin" /> : <ArrowRight className="size-4" />}
              ໄປຂັ້ນ “{next.label}”
            </button>
          ) : (
            <span className="text-xs text-slate-500">ໃບເຄມນີ້ຈົບແລ້ວ</span>
          )}
        </div>
      )}

      {error && <p className="mt-2 text-xs font-semibold text-red-600">{error}</p>}
    </section>
  );
}
