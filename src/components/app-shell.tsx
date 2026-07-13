"use client";
import { MobileNav } from "@/components/mobile-nav";
import { Sidebar } from "@/components/sidebar";
import type { NavFlags } from "@/lib/navigation";
import type { NavCounts } from "@/lib/nav-counts";
import { ROLE_LABEL, type Role } from "@/lib/roles";
import { Bell, BellRing, LogOut, UserRound } from "lucide-react";
import Link from "next/link";
import { useSyncExternalStore, type ReactNode } from "react";

const COLLAPSED_KEY = "ods_sidebar_collapsed";

/**
 * ຈື່ການພັບ sidebar ໄວ້ໃນ localStorage.
 * ໃຊ້ useSyncExternalStore ແທນ useEffect+setState ຈຶ່ງບໍ່ເກີດ render ຊ້ອນ
 * ແລະ ບໍ່ມີ hydration ບໍ່ຕົງກັນ (server ຄືນຄ່າ false ສະເໝີ).
 */
const listeners = new Set<() => void>();

function subscribe(callback: () => void) {
  listeners.add(callback);
  window.addEventListener("storage", callback);
  return () => {
    listeners.delete(callback);
    window.removeEventListener("storage", callback);
  };
}

const getSnapshot = () => localStorage.getItem(COLLAPSED_KEY) === "1";
const getServerSnapshot = () => false;

function setCollapsed(value: boolean) {
  localStorage.setItem(COLLAPSED_KEY, value ? "1" : "0");
  for (const listener of listeners) listener();
}

/** ໂຄງໜ້າຫຼັກ — sidebar ແລະ ເນື້ອຫາຂະຫຍັບພ້ອມກັນ */
export function AppShell({
  username,
  role,
  navFlags,
  readableResources,
  counts,
  activities,
  notifications,
  logout,
  children,
}: {
  username: string;
  /** ສິດຂອງຜູ້ໃຊ້ — ກຳນົດວ່າເຫັນເມນູໃດແດ່ */
  role: Role;
  /** ສິດທີ່ຜູ້ຈັດການກຳນົດຢູ່ຖານຂໍ້ມູນ (QC) — role ຢ່າງດຽວບອກບໍ່ໄດ້ */
  navFlags: NavFlags;
  /** ສິດ read ລາຍ menu ຫຼັງລວມ role + override ຂອງ user. */
  readableResources: string[];
  /** ຕົວເລກຄິວຂອງເມນູ (lib/nav-counts) */
  counts: NavCounts;
  /** ກິດຈະກຳຄ້າງຂອງຜູ້ໃຊ້ນີ້ — ແດງ = ມີລາຍການເລີຍກຳນົດ */
  activities: { total: number; late: number };
  /** ການແຈ້ງເຕືອນທີ່ຍັງບໍ່ໄດ້ອ່ານ — ແທນ LINE Notify ຂອງ ods */
  notifications: number;
  logout: () => Promise<void>;
  children: ReactNode;
}) {
  const collapsed = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  return (
    <div className="min-h-screen bg-slate-50">
      <Sidebar
        role={role}
        navFlags={navFlags}
        readableResources={readableResources}
        counts={counts}
        collapsed={collapsed}
        onToggle={() => setCollapsed(!collapsed)}
      />
      <MobileNav role={role} navFlags={navFlags} readableResources={readableResources} counts={counts} />

      <div className={`transition-[padding] duration-200 ${collapsed ? "lg:pl-16" : "lg:pl-64"}`}>
        {/* Topbar — ເຕ້ຍ (56px), ຄ້າງໄວ້ */}
        <header className="no-print sticky top-0 z-20 hidden h-14 items-center justify-end gap-3 border-b border-slate-200 bg-white/90 px-6 backdrop-blur lg:flex">
          {/* ການແຈ້ງເຕືອນທີ່ຍັງບໍ່ໄດ້ອ່ານ — ແທນ LINE Notify ຂອງ ods */}
          <Link
            href="/notifications"
            title="ການແຈ້ງເຕືອນ"
            className="relative grid size-8 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          >
            <BellRing className="size-4" />
            {notifications > 0 && (
              <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-teal-600 px-1 text-[10px] font-bold text-white">
                {notifications > 99 ? "99+" : notifications}
              </span>
            )}
          </Link>

          {/* ກິດຈະກຳຄ້າງ — ແດງເມື່ອມີລາຍການເລີຍກຳນົດ */}
          <Link
            href="/activities"
            title="ກິດຈະກຳຂອງຂ້ອຍ"
            className="relative grid size-8 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          >
            <Bell className="size-4" />
            {activities.total > 0 && (
              <span
                className={`absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full px-1 text-[10px] font-bold text-white ${
                  activities.late > 0 ? "bg-red-500" : "bg-teal-600"
                }`}
              >
                {activities.total > 99 ? "99+" : activities.total}
              </span>
            )}
          </Link>

          <span className="flex items-center gap-2 rounded-lg bg-slate-100 py-1 pl-1 pr-3">
            <span className="grid size-7 place-items-center rounded-md bg-teal-600 text-white">
              <UserRound className="size-4" />
            </span>
            <span className="leading-tight">
              <span className="block text-xs font-semibold text-slate-800">{username}</span>
              <span className="block text-[10px] tracking-wide text-slate-400">{ROLE_LABEL[role]}</span>
            </span>
          </span>

          <form action={logout}>
            <button
              title="ອອກຈາກລະບົບ"
              className="grid size-8 place-items-center rounded-lg text-slate-400 transition hover:bg-red-50 hover:text-red-600"
            >
              <LogOut className="size-4" />
            </button>
          </form>
        </header>

        <main className="p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
