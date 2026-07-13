"use client";
import { NavTree } from "@/components/sidebar";
import type { NavFlags } from "@/lib/navigation";
import type { NavCounts } from "@/lib/nav-counts";
import type { Role } from "@/lib/roles";
import { Menu, Wrench, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

export function MobileNav({ role, navFlags, counts }: { role: Role; navFlags: NavFlags; counts: NavCounts }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <header className="no-print sticky top-0 z-20 flex h-16 items-center justify-between bg-slate-950 px-4 text-white lg:hidden">
        <Link href="/dashboard" className="flex items-center gap-2 font-bold">
          <span className="grid size-9 place-items-center rounded-lg bg-teal-500">
            <Wrench className="size-5" />
          </span>
          ODIEN SERVICE
        </Link>
        <button onClick={() => setOpen(!open)} aria-label="ເປີດເມນູ">
          {open ? <X /> : <Menu />}
        </button>
      </header>
      {open && (
        <div className="no-print fixed inset-0 z-10 flex flex-col overflow-y-auto bg-slate-950 pb-6 pt-16 text-slate-300 lg:hidden">
          <NavTree role={role} navFlags={navFlags} counts={counts} onNavigate={() => setOpen(false)} />
        </div>
      )}
    </>
  );
}
