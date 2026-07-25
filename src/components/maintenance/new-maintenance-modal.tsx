"use client";
import { MaintenanceForm } from "@/components/maintenance/maintenance-form";
import type { MaintenanceCatalogItem } from "@/lib/maintenance";
import { FilePlus2, SprayCan, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type Tech = { code: string; name: string };

/**
 * ປຸ່ມ "ເປີດງານໃໝ່" ທີ່ເປີດ **modal** (ບໍ່ນຳທາງໄປໜ້າໃໝ່) — ຢູ່ໃນ context ຂອງລາຍການ
 * ⇒ ບັນທຶກແລ້ວ ລາຍການໂຫຼດຄືນທັນທີ (router.refresh). ໜ້າ /maintenance/new ຍັງຢູ່ (ລິ້ງກົງ).
 */
export function NewMaintenanceModal({ catalog, technicians }: { catalog: MaintenanceCatalogItem[]; technicians: Tech[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  // ປິດ modal ດ້ວຍ Esc
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-9 items-center gap-2 rounded-lg bg-emerald-600 px-4 text-xs font-semibold text-white transition hover:bg-emerald-700"
      >
        <FilePlus2 className="size-4" />
        ເປີດງານໃໝ່
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 backdrop-blur-sm sm:p-6">
          {/* ກົດພື້ນຫຼັງ = ປິດ */}
          <button type="button" aria-label="ປິດ" className="absolute inset-0 cursor-default" onClick={() => setOpen(false)} />

          <div className="relative z-10 my-4 w-full max-w-5xl rounded-2xl bg-slate-50 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5">
              <h2 className="flex items-center gap-2 text-base font-bold text-slate-700">
                <SprayCan className="size-5 text-cyan-600" />
                ເປີດງານສ້ອມບໍລຸງ
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="grid size-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="p-5">
              <MaintenanceForm
                catalog={catalog}
                technicians={technicians}
                onCancel={() => setOpen(false)}
                onSuccess={() => {
                  setOpen(false);
                  router.refresh();
                }}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
