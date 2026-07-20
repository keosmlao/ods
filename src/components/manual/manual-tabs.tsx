"use client";
import { Wrench, HardHat } from "lucide-react";
import { useState } from "react";

/**
 * ແທັບ ຄູ່ມື — ສ້ອມ / ຕິດຕັ້ງ. ຮັບເນື້ອຫາ 2 ຝັ່ງ (server-rendered) ເປັນ props ແລ້ວ toggle
 * ການເຫັນ (ບໍ່ໂຫຼດຄືນ). ໜ້າພິມ SOP/WI ຍັງແຍກ set=repair/install ຄືເກົ່າ.
 */
export function ManualTabs({
  repair,
  install,
  repairLabel,
  installLabel,
}: {
  repair: React.ReactNode;
  install: React.ReactNode;
  repairLabel: string;
  installLabel: string;
}) {
  const [tab, setTab] = useState<"repair" | "install">("repair");
  const btn = (key: "repair" | "install", label: string, Icon: typeof Wrench) => (
    <button
      type="button"
      onClick={() => setTab(key)}
      className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition ${
        tab === key ? "bg-slate-900 text-white shadow-sm" : "bg-white text-slate-500 ring-1 ring-slate-200 hover:bg-slate-50"
      }`}
    >
      <Icon className="size-4" />
      {label}
    </button>
  );

  return (
    <div>
      <div className="mt-2 flex flex-wrap gap-2">
        {btn("repair", repairLabel, Wrench)}
        {btn("install", installLabel, HardHat)}
      </div>
      <div className={tab === "repair" ? "" : "hidden"}>{repair}</div>
      <div className={tab === "install" ? "" : "hidden"}>{install}</div>
    </div>
  );
}
