"use client";

import { deleteMaintenance } from "@/app/actions/maintenance";
import { LoaderCircle, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export function MaintenanceRowActions({ code, editable }: { code: string; editable: boolean }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  const remove = () => {
    if (!window.confirm(`ຢືນຢັນລົບງານ ${code}? ຂໍ້ມູນທີ່ລົບແລ້ວຈະກູ້ຄືນບໍ່ໄດ້.`)) return;
    setError("");
    startTransition(async () => {
      const result = await deleteMaintenance(code);
      if (result.error) {
        setError(result.error);
        window.alert(result.error);
        return;
      }
      router.refresh();
    });
  };

  return (
    <div className="flex items-center justify-end gap-1.5">
      {editable ? (
        <>
          <Link
            href={`/maintenance/${encodeURIComponent(code)}/edit`}
            className="inline-flex h-8 items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-2.5 text-xs font-semibold text-amber-700 hover:bg-amber-100"
            title="ແກ້ໄຂ"
          >
            <Pencil className="size-3.5" /> ແກ້ໄຂ
          </Link>
          <button
            type="button"
            onClick={remove}
            disabled={pending}
            className="inline-flex h-8 items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2.5 text-xs font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-50"
            title="ລົບ"
          >
            {pending ? <LoaderCircle className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />} ລົບ
          </button>
        </>
      ) : (
        <span className="text-[10px] text-slate-400">ເລີ່ມງານແລ້ວ</span>
      )}
      {error && <span className="sr-only" role="alert">{error}</span>}
    </div>
  );
}
