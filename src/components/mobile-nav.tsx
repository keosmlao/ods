"use client";
import { NavTree } from "@/components/sidebar";
import type { NavFlags } from "@/lib/navigation";
import type { NavCounts } from "@/lib/nav-counts";
import { homeForRole, ROLE_LABEL, type Role } from "@/lib/roles";
import { Bell, LogOut, Menu, UserRound, Wrench, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

export function MobileNav({
  role,
  navFlags,
  readableResources,
  counts,
  navLabels,
  username,
  logout,
  logoutLabel,
  notifications,
}: {
  role: Role;
  navFlags: NavFlags;
  readableResources: string[];
  counts: NavCounts;
  navLabels?: Record<string, string>;
  /** ຊື່ຜູ້ໃຊ້ — ສະແດງທ້າຍເມນູ ຄູ່ກັບປຸ່ມອອກ (topbar ຂອງ desktop ບໍ່ຂຶ້ນເທິງມືຖື) */
  username: string;
  logout: () => Promise<void>;
  logoutLabel: string;
  /** ຈຳນວນແຈ້ງເຕືອນທີ່ຍັງບໍ່ໄດ້ອ່ານ — ປ້າຍເທິງກະດິງຂອງຈໍນ້ອຍ */
  notifications: number;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <header className="no-print sticky top-0 z-20 flex h-16 items-center justify-between bg-brand-900 px-4 text-white lg:hidden">
        <Link href={homeForRole(role)} className="flex items-center gap-2 font-bold">
          <span className="grid size-9 place-items-center rounded-lg bg-brand-600">
            <Wrench className="size-5" />
          </span>
          ODIEN SERVICE
        </Link>
        <div className="flex items-center gap-1">
          {/**
            * ── ກະດິງແຈ້ງເຕືອນ **ຢູ່ຈໍນ້ອຍນຳ** (07-08-2026) ──
            * topbar ຂອງ desktop ເປັນ `hidden lg:flex` ⇒ ຄົນເປີດເວັບດ້ວຍມືຖື/ແທັບເລັດ
            * (ຜູ້ຈັດການສ່ວນຫຼາຍ) **ບໍ່ເຫັນກະດິງເລີຍ** ⇒ ນຶກວ່າລະບົບບໍ່ແຈ້ງເຕືອນ
            * ທັງທີ່ຂໍ້ມູນມາຄົບ. ລິ້ງໄປໜ້າເຕັມ (ບໍ່ແມ່ນ dropdown — ຈໍນ້ອຍບໍ່ພໍ).
            */}
          <Link
            href="/notifications"
            aria-label="ການແຈ້ງເຕືອນ"
            className="relative grid size-9 place-items-center rounded-lg hover:bg-brand-800"
          >
            <Bell className="size-5" />
            {notifications > 0 && (
              <span className="absolute right-0.5 top-0.5 min-w-4 rounded-full bg-brand-orange-500 px-1 text-center text-[10px] font-bold leading-4 text-white">
                {notifications > 99 ? "99+" : notifications}
              </span>
            )}
          </Link>
          <button onClick={() => setOpen(!open)} aria-label="ເປີດເມນູ" className="grid size-9 place-items-center">
            {open ? <X /> : <Menu />}
          </button>
        </div>
      </header>
      {open && (
        <div className="no-print fixed inset-0 z-10 flex flex-col overflow-y-auto bg-brand-900 pb-6 pt-16 text-slate-300 lg:hidden">
          <NavTree
            role={role}
            navFlags={navFlags}
            readableResources={readableResources}
            counts={counts}
            navLabels={navLabels}
            onNavigate={() => setOpen(false)}
          />

          {/**
            * ຜູ້ໃຊ້ + ປຸ່ມອອກຈາກລະບົບ — **ຢູ່ນີ້ບ່ອນດຽວສຳລັບຈໍນ້ອຍ**.
            * topbar ຂອງ desktop (app-shell) ເປັນ `hidden lg:flex` ⇒ ຄົນເປີດດ້ວຍມືຖື
            * ບໍ່ເຫັນປຸ່ມອອກເລີຍ ຈົນກວ່າຈະມີບ່ອນນີ້.
            */}
          <div className="mt-auto border-t border-brand-800 px-4 pt-4">
            <div className="flex items-center gap-2 px-2 py-1">
              <span className="grid size-8 shrink-0 place-items-center rounded-md bg-brand-700 text-white">
                <UserRound className="size-4" />
              </span>
              <span className="min-w-0 leading-tight">
                <span className="block truncate text-sm font-semibold text-white">{username}</span>
                <span className="block text-[11px] tracking-wide text-slate-500">{ROLE_LABEL[role]}</span>
              </span>
            </div>
            <form action={logout}>
              <button className="mt-2 flex h-11 w-full items-center gap-3 rounded-lg px-2 text-sm font-medium text-brand-orange-300 transition hover:bg-brand-orange-700/10 hover:text-brand-orange-300">
                <LogOut className="size-5" />
                {logoutLabel}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
