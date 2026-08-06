"use client";
import { deleteClaim } from "@/app/actions/claim";
import { LoaderCircle, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useDict } from "@/lib/i18n/context";
import { useTransition } from "react";

/** ປຸ່ມ ແກ້ໄຂ (→ ໜ້າຈັດການໃບ) + ລບ (deleteClaim ພ້ອມຢືນຢັນ) ຕໍ່ແຖວ ຢູ່ລາຍການເຄມ */
export function ClaimRowActions({ claimNo }: { claimNo: string }) {
  const router = useRouter();
  const t = useDict().claimDetail;
  const [pending, start] = useTransition();

  const del = () => {
    if (!window.confirm(t.deleteAskOne.replace("{claim}", claimNo))) return;
    start(async () => {
      const r = await deleteClaim(claimNo);
      if (r.error) window.alert(r.error);
      else router.refresh();
    });
  };

  return (
    <div className="flex items-center justify-end gap-1">
      <Link
        href={`/claims/${claimNo}`}
        className="grid size-7 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-brand-700"
        title={t.manage}
      >
        <Pencil className="size-3.5" />
      </Link>
      <button
        type="button"
        disabled={pending}
        onClick={del}
        className="grid size-7 place-items-center rounded-lg text-slate-400 hover:bg-brand-orange-50 hover:text-brand-orange-700 disabled:opacity-50"
        title={t.delete}
      >
        {pending ? <LoaderCircle className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
      </button>
    </div>
  );
}
