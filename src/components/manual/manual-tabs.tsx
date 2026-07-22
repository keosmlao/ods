"use client";
import { Wrench, HardHat, ShieldCheck, Fan, ShoppingCart } from "lucide-react";
import { useState } from "react";

/**
 * ແທັບ ຄູ່ມື — ສ້ອມ / ຕິດຕັ້ງ / ເຄມ / ສ້ອມບໍລຸງ / ສັ່ງຊື້. ຮັບເນື້ອຫາແຕ່ລະຝັ່ງ (server-rendered)
 * ເປັນ props ແລ້ວ toggle ການເຫັນ (ບໍ່ໂຫຼດຄືນ). ໜ້າພິມ SOP/WI ຍັງແຍກ set=<tab> ຄືເກົ່າ.
 */
type TabKey = "repair" | "install" | "claim" | "maintenance" | "purchase";

export function ManualTabs({
  repair,
  install,
  claim,
  maintenance,
  purchase,
  repairLabel,
  installLabel,
  claimLabel,
  maintLabel,
  purchaseLabel,
}: {
  repair: React.ReactNode;
  install: React.ReactNode;
  claim: React.ReactNode;
  maintenance: React.ReactNode;
  purchase: React.ReactNode;
  repairLabel: string;
  installLabel: string;
  claimLabel: string;
  maintLabel: string;
  purchaseLabel: string;
}) {
  const [tab, setTab] = useState<TabKey>("repair");
  const btn = (key: TabKey, label: string, Icon: typeof Wrench) => (
    <button
      type="button"
      onClick={() => setTab(key)}
      aria-pressed={tab === key}
      className={`group inline-flex min-h-10 items-center justify-center gap-2 rounded-xl px-3.5 py-2 text-sm font-bold transition-all duration-200 sm:px-4 ${
        tab === key
          ? "bg-gradient-to-r from-slate-950 to-teal-900 text-white shadow-md shadow-slate-900/15 ring-1 ring-white/10"
          : "text-slate-500 hover:-translate-y-0.5 hover:bg-white hover:text-slate-800 hover:shadow-sm"
      }`}
    >
      <span className={`grid size-7 place-items-center rounded-lg transition-colors ${tab === key ? "bg-white/10" : "bg-white ring-1 ring-slate-200 group-hover:bg-teal-50 group-hover:text-teal-700 group-hover:ring-teal-100"}`}>
        <Icon className="size-3.5" />
      </span>
      {label}
    </button>
  );

  return (
    <div>
      <div className="mt-4 flex flex-wrap gap-1.5 rounded-2xl border border-slate-200/80 bg-slate-100/80 p-1.5 shadow-inner shadow-slate-200/40 backdrop-blur">
        {btn("repair", repairLabel, Wrench)}
        {btn("install", installLabel, HardHat)}
        {btn("claim", claimLabel, ShieldCheck)}
        {btn("maintenance", maintLabel, Fan)}
        {btn("purchase", purchaseLabel, ShoppingCart)}
      </div>
      <div className={tab === "repair" ? "" : "hidden"}>{repair}</div>
      <div className={tab === "install" ? "" : "hidden"}>{install}</div>
      <div className={tab === "claim" ? "" : "hidden"}>{claim}</div>
      <div className={tab === "maintenance" ? "" : "hidden"}>{maintenance}</div>
      <div className={tab === "purchase" ? "" : "hidden"}>{purchase}</div>
    </div>
  );
}
