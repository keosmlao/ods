"use client";

import { deleteMaintenance } from "@/app/actions/maintenance";
import { LoaderCircle, Pencil, Printer, Trash2 } from "lucide-react";
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
      {/* ພິມໃບງານ — ມີທຸກແຖວ ບໍ່ຂຶ້ນກັບ editable: ຊ່າງຕ້ອງພິມໃບຖືໄປໜ້າງານຫຼັງເລີ່ມງານແລ້ວນຳ */}
      <Link
        href={`/maintenance/${encodeURIComponent(code)}/print`}
        target="_blank"
        className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
        title="ພິມໃບງານ"
      >
        <Printer className="size-3.5" /> ພິມ
      </Link>
      {editable ? (
        <>
          <Link
            href={`/maintenance/${encodeURIComponent(code)}/edit`}
            className="inline-flex h-8 items-center gap-1 rounded-lg border border-brand-orange-400 bg-brand-orange-100 px-2.5 text-xs font-semibold text-brand-900 hover:bg-brand-orange-300"
            title="ແກ້ໄຂ"
          >
            <Pencil className="size-3.5" /> ແກ້ໄຂ
          </Link>
          <button
            type="button"
            onClick={remove}
            disabled={pending}
            className="inline-flex h-8 items-center gap-1 rounded-lg border border-brand-orange-400 bg-brand-orange-50 px-2.5 text-xs font-semibold text-brand-orange-700 hover:bg-brand-orange-100 disabled:opacity-50"
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
