"use client";
import { markJobClaim } from "@/app/actions/claim";
import { BadgeDollarSign, LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

/** ໝາຍງານ "ເຄມເງິນ supplier" — ຫຼັງສ່ງຄືນ ຈະຂຶ້ນ candidate CLM-C ຢູ່ /claims (type C) */
export function ClaimMarkToggle({ jobCode, marked }: { jobCode: string; marked: boolean }) {
  const router = useRouter();
  const [on, setOn] = useState(marked);
  const [pending, start] = useTransition();
  const toggle = () =>
    start(async () => {
      const next = !on;
      setOn(next);
      await markJobClaim(jobCode, next);
      router.refresh();
    });
  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      title="ໝາຍວ່າงานนี้ เก็บเงินค่าสอมนำ supplier (ไม่เก็บลูกค้า)"
      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${on ? "bg-amber-100 text-amber-800 ring-1 ring-amber-300" : "border border-slate-200 bg-white text-slate-500 hover:bg-slate-50"}`}
    >
      {pending ? <LoaderCircle className="size-4 animate-spin" /> : <BadgeDollarSign className="size-4" />}
      {on ? "ເຄມເງິນ supplier ✓" : "ໝາຍ ເຄມ supplier"}
    </button>
  );
}
