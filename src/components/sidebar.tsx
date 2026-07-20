"use client";
import { LinkPending } from "@/components/link-pending";
import { navigationFor, NAV_GROUP_KEY, type NavFlags, type NavGroup, type NavItem } from "@/lib/navigation";
import type { NavCounts } from "@/lib/nav-counts";
import { homeForRole, type Role } from "@/lib/roles";
import { ChevronDown, PanelLeftClose, PanelLeftOpen, Search, Wrench, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";

/**
 * ລາຍການເມນູທີ່ **ຕົງທີ່ສຸດ** ຈຶ່ງສະຫວ່າງ — ອັນດຽວເທົ່ານັ້ນ.
 *
 * ແຕ່ກ່ອນໃຊ້ `pathname.startsWith(href)` ລ້ວນໆ ⇒ ຢູ່ໜ້າ /stock/requests/pickup
 * ທັງ "ໃບຂໍເບີກອາໄຫຼ່" (/stock/requests) ແລະ "ຮັບອາໄຫຼ່" (/stock/requests/pickup)
 * ສະຫວ່າງພ້ອມກັນ ເພາະເສັ້ນທາງນຶ່ງເປັນຄຳນຳໜ້າຂອງອີກອັນ.
 * ດຽວນີ້ຄິດຈາກ **ຄວາມຍາວທີ່ຕົງກັນ**: ອັນທີ່ຍາວກວ່າຊະນະ.
 */
/**
 * ── ລາຍການທີ່ແຍກດ້ວຍ query (ເຊັ່ນ /qc?workflow=install ກັບ ?workflow=repair) ──
 * ຖ້າທຽບແຕ່ path ທັງສອງຈະຂຶ້ນ **active ພ້ອມກັນ** ⇒ ຄົນບໍ່ຮູ້ວ່າຕົນຢູ່ສາຍງານໃດ.
 * ⇒ ມີ query = ຕ້ອງຕົງທັງ path ແລະ query ຈຶ່ງນັບວ່າ active.
 */
const queryMatches = (search: string, href: string) => {
  const query = href.split("?")[1];
  if (!query) return true;
  const wanted = new URLSearchParams(query);
  const current = new URLSearchParams(search);
  return [...wanted.entries()].every(([key, value]) => current.get(key) === value);
};

const matchLength = (pathname: string, href: string) => {
  const path = href.split("?")[0];
  if (path === "#") return -1;
  if (pathname === path) return path.length;
  return pathname.startsWith(`${path}/`) ? path.length : -1;
};

/** ຄວາມຍາວທີ່ຕົງທີ່ສຸດຂອງລາຍການ — ນັບທັງ href ແລະ ເສັ້ນທາງ match ເພີ່ມ (ໜ້າລົງມືທີ່ບໍ່ມີເມນູ) */
const itemMatchLength = (pathname: string, item: NavItem) =>
  Math.max(matchLength(pathname, item.href), ...(item.match ?? []).map((path) => matchLength(pathname, path)));

/**
 * ໃຫ້ path ທີ່ຍາວກວ່າຊະນະກ່ອນ ແລ້ວຈຶ່ງໃຫ້ລິ້ງທີ່ລະບຸ query ລະອຽດກວ່າຊະນະ.
 * ຕົວຢ່າງ: /qc?workflow=install ຕ້ອງຊະນະ /qc ທີ່ບໍ່ລະບຸ query.
 */
const itemMatchScore = (pathname: string, search: string, item: NavItem) => {
  if (!queryMatches(search, item.href)) return -1;
  const length = itemMatchLength(pathname, item);
  if (length < 0) return -1;
  const querySize = [...new URLSearchParams(item.href.split("?")[1] ?? "").entries()].length;
  return length * 1000 + querySize;
};

/** ຄະແນນທີ່ຕົງທີ່ສຸດໃນເມນູທັງໝົດ */
const bestMatch = (pathname: string, search: string, groups: NavGroup[]) =>
  Math.max(-1, ...groups.flatMap((group) => group.items.map((item) => itemMatchScore(pathname, search, item))));

/**
 * ── ໜ້າລາຍລະອຽດທີ່ເປີດມາຈາກຄິວ (`?from=`) ──
 * ທຸກຄິວຂອງສາຍງານສ້ອມພາໄປໜ້າດຽວກັນ: /service/<code> ⇒ ກົດເຂົ້າລາຍລະອຽດຈາກຄິວໃດກໍ່ຕາມ
 * ເມນູຈະໂດດໄປສະຫວ່າງທີ່ "ລາຍການຮັບສິນຄ້າເຂົ້າສ້ອມ" (/service) ເພາະມັນຄືອັນດຽວທີ່ຕົງ
 * ⇒ ຄົນເສຍບ່ອນຢືນ ບໍ່ຮູ້ວ່າຕົນມາຈາກຄິວໃດ ແລະ ກົດກັບຄືນຜິດບ່ອນ.
 *
 * ແກ້ດ້ວຍການໃຫ້**ລິ້ງບອກມາ** (`?from=<href ຂອງຄິວ>`) — ໃຊ້ກົນໄກ query ທີ່ມີຢູ່ແລ້ວ
 * ບໍ່ຕ້ອງໃຫ້ sidebar ໄປຖາມຖານຂໍ້ມູນວ່າວຽກຢູ່ຂັ້ນໃດ (ມັນເປັນ client component).
 * ບໍ່ມີ `from` (ເປີດຈາກ bookmark/ຄົ້ນຫາ) ⇒ ກັບໄປໃຊ້ກົດ "ຍາວສຸດຊະນະ" ຄືເກົ່າ.
 */
const isActive = (pathname: string, item: NavItem, best: number, search = "") => {
  const from = new URLSearchParams(search).get("from");
  if (from) return item.href === from;
  const score = itemMatchScore(pathname, search, item);
  return score >= 0 && score === best;
};

/* ---------------- ເມນູ (ໃຊ້ຮ່ວມກັບ mobile) ---------------- */

export function NavTree({
  role,
  navFlags,
  readableResources,
  counts,
  navLabels,
  onNavigate,
  collapsed = false,
  onExpand,
}: {
  /** ສິດຂອງຜູ້ໃຊ້ — ເມນູທີ່ບໍ່ມີສິດຈະບໍ່ຖືກສະແດງ */
  role: Role;
  /** ສິດທີ່ຢູ່ໃນຖານຂໍ້ມູນ ບໍ່ແມ່ນຢູ່ໃນຕາຕະລາງ RULES (ດຽວນີ້ມີແຕ່ QC — ເບິ່ງ lib/navigation) */
  navFlags: NavFlags;
  /** ເມນູທີ່ອ່ານໄດ້ຫຼັງລວມ role + override ລາຍ user. */
  readableResources: string[];
  /** ຕົວເລກຄິວຕໍ່ລາຍການ (lib/nav-counts) — ຫວ່າງໄດ້ (ຖ້າ query ລົ້ມ ເມນູຍັງໃຊ້ໄດ້) */
  counts: NavCounts;
  /** ປ້າຍກຸ່ມແປຕາມພາສາ (dictionary.nav) — key ຈາກ NAV_GROUP_KEY. ຫວ່າງ = ໃຊ້ Lao ເດີມ */
  navLabels?: Record<string, string>;
  onNavigate?: () => void;
  collapsed?: boolean;
  /** ຕອນພັບຢູ່ ກົດໄອຄອນກຸ່ມ → ຂະຫຍາຍເມນູ */
  onExpand?: () => void;
}) {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const [query, setQuery] = useState("");
  /**
   * ເປີດໄດ້ **ທີລະກຸ່ມ** (accordion) — ເປີດອັນໃໝ່ ອັນເກົ່າພັບເອງ.
   * ເມນູມີ 51 ລາຍການ ⇒ ເປີດຫຼາຍກຸ່ມພ້ອມກັນ ຕ້ອງເລື່ອນຫາຍາວ ແລະ ຫຼົງທາງ.
   * null = ຍັງບໍ່ໄດ້ກົດເອງ ⇒ ຖືເອົາກຸ່ມຂອງໜ້າທີ່ກຳລັງເປີດຢູ່.
   */
  const [openId, setOpenId] = useState<string | null>(null);

  /** ເມນູຕາມສິດ ແລ້ວຄົ້ນຫາ — ພິມແລ້ວເຫຼືອສະເພາະທີ່ຕົງ */
  const groups = useMemo(() => {
    const allowed = navigationFor(role, navFlags, readableResources);
    const text = query.trim().toLowerCase();
    if (!text) return allowed;
    return allowed
      .map((group) => ({ ...group, items: group.items.filter((item) => item.label.toLowerCase().includes(text)) }))
      .filter((group) => group.items.length > 0);
  }, [role, navFlags, readableResources, query]);

  // ຄິດຄັ້ງດຽວຕໍ່ການ render — ຢ່າຄິດຊ້ຳຢູ່ໃນ loop ຂອງແຕ່ລະລາຍການ
  const best = useMemo(() => bestMatch(pathname, search, groups), [pathname, search, groups]);

  const searching = query.trim().length > 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* ຊ່ອງຄົ້ນຫາເມນູ — ມີ 40 ກວ່າລາຍການ ຈຶ່ງຈຳເປັນ */}
      {!collapsed && (
        <div className="px-3 pb-2">
          <div className="flex h-9 items-center gap-2 rounded-lg bg-white/5 px-2.5 ring-1 ring-white/10 focus-within:ring-teal-500">
            <Search className="size-4 shrink-0 text-slate-500" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="ຄົ້ນຫາເມນູ..."
              className="w-full bg-transparent text-sm text-slate-200 outline-none placeholder:text-slate-500"
            />
            {searching && (
              <button type="button" onClick={() => setQuery("")} aria-label="ລ້າງ" className="text-slate-500 hover:text-white">
                <X className="size-3.5" />
              </button>
            )}
          </div>
        </div>
      )}

      <nav className="min-h-0 flex-1 space-y-0.5 overflow-y-auto px-2 pb-4">
        {groups.length === 0 && <p className="px-3 py-6 text-center text-xs text-slate-500">ບໍ່ພົບເມນູ</p>}

        {groups.map((group: NavGroup) => {
          const Icon = group.icon;
          const groupLabel = navLabels?.[NAV_GROUP_KEY[group.id]] ?? group.label;
          const hasActive = group.items.some((item) => isActive(pathname, item, best, search));
          // ວຽກຄ້າງລວມຂອງກຸ່ມ — ຕອນກຸ່ມປິດຢູ່ ຄົນຍັງຮູ້ວ່າຂ້າງໃນມີວຽກ
          const groupTotal = group.items.reduce(
            (sum, item) => sum + (item.count ? (counts[item.count] ?? 0) : 0),
            0,
          );
          // ຄົ້ນຫາຢູ່ → ເປີດໝົດ; ບໍ່ດັ່ງນັ້ນເປີດກຸ່ມທີ່ກຳລັງໃຊ້ ເວັ້ນແຕ່ຜູ້ໃຊ້ພັບເອງ
          const open = searching || (openId === null ? hasActive : openId === group.id);

          if (collapsed) {
            return (
              <div key={group.id} className="px-1 py-0.5">
                <button
                  type="button"
                  onClick={onExpand}
                  title={groupLabel}
                  className={`relative grid h-10 w-full place-items-center rounded-lg transition ${
                    hasActive ? "bg-teal-500 text-white" : "text-slate-400 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  <Icon className="size-5" />
                  {groupTotal > 0 && (
                    <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-red-500" />
                  )}
                </button>
              </div>
            );
          }

          return (
            <div key={group.id}>
              <button
                type="button"
                onClick={() => setOpenId(open ? "" : group.id)}
                aria-expanded={open}
                className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-semibold transition ${
                  hasActive ? "text-white" : "text-slate-400 hover:bg-white/5 hover:text-white"
                }`}
              >
                <Icon className={`size-4 shrink-0 ${hasActive ? "text-teal-400" : ""}`} />
                <span className="flex-1 text-left">{groupLabel}</span>
                {!open && groupTotal > 0 && (
                  <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] font-bold text-slate-300">
                    {groupTotal > 99 ? "99+" : groupTotal}
                  </span>
                )}
                <ChevronDown className={`size-3.5 shrink-0 text-slate-600 transition-transform ${open ? "rotate-180" : ""}`} />
              </button>

              {open && (
                <ul className="mb-1 space-y-0.5">
                  {group.items.map((item, index) => {
                    const active = isActive(pathname, item, best, search);
                    // i18n: ແປປ້າຍລາຍການ ຕາມ href (dictionary.nav) — ຫວ່າງ = ໃຊ້ Lao ເດີມ
                    // ຮັກສາເລກລຳດັບ "N. " ທີ່ຝັງໃນ label ໄວ້ ເມື່ອແປ (ຂັ້ນ pipeline ມີເລກ)
                    const translated = navLabels?.[item.labelKey ?? item.href];
                    const numberPrefix = /^\d+\.\s*/.exec(item.label)?.[0] ?? "";
                    const itemLabel = translated != null ? numberPrefix + translated : item.label;
                    return (
                      <li key={`${item.href}-${index}`}>
                        {item.divider && <hr className="my-1.5 ml-8 border-white/5" />}
                        {item.href === "#" ? (
                          // ods ເອງກໍປ່ອຍ href="#" ໄວ້ — ບໍ່ມີໜ້າປາຍທາງ
                          <span className="block cursor-not-allowed rounded-lg py-1.5 pl-9 pr-3 text-sm text-slate-600">
                            {itemLabel}
                          </span>
                        ) : (
                          <Link
                            href={item.href}
                            onClick={onNavigate}
                            className={`relative flex items-center justify-between gap-2 rounded-lg py-1.5 pl-9 pr-3 text-sm transition ${
                              active
                                ? "bg-teal-500/10 font-semibold text-teal-300"
                                : "text-slate-400 hover:bg-white/5 hover:text-white"
                            }`}
                          >
                            {/* ແຖບຂີດຊ້າຍ = ໜ້າທີ່ກຳລັງເປີດ */}
                            {active && <span className="absolute inset-y-1 left-3 w-0.5 rounded-full bg-teal-400" />}
                            <span className="truncate">{itemLabel}</span>
                            {/* ຕົວເລກຄິວ — ນັບດ້ວຍເງື່ອນໄຂອັນດຽວກັບໜ້າປາຍທາງ (lib/nav-counts) */}
                            {item.count && (counts[item.count] ?? 0) > 0 && (
                              <span
                                className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                                  active ? "bg-teal-400 text-slate-900" : "bg-white/10 text-slate-300"
                                }`}
                              >
                                {counts[item.count]! > 99 ? "99+" : counts[item.count]}
                              </span>
                            )}
                            <LinkPending className="size-3.5 shrink-0" />
                          </Link>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
      </nav>
    </div>
  );
}

/* ---------------- Sidebar (desktop) ---------------- */

export function Sidebar({
  role,
  navFlags,
  readableResources,
  counts,
  navLabels,
  collapsed,
  onToggle,
}: {
  role: Role;
  navFlags: NavFlags;
  readableResources: string[];
  counts: NavCounts;
  navLabels?: Record<string, string>;
  collapsed: boolean;
  onToggle: () => void;
}) {
  return (
    <aside
      data-collapsed={collapsed}
      className={`no-print fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-white/5 bg-slate-950 transition-[width] duration-200 lg:flex ${
        collapsed ? "w-16" : "w-64"
      }`}
    >
      <div className={`flex h-14 shrink-0 items-center border-b border-white/5 ${collapsed ? "justify-center px-2" : "gap-2.5 px-3"}`}>
        <Link href={homeForRole(role)} title="ODIEN SERVICE" className="flex items-center gap-3 overflow-hidden">
          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-teal-500 text-white">
            <Wrench className="size-4" />
          </span>
          {!collapsed && (
            <span className="whitespace-nowrap">
              <span className="block text-[13px] font-bold leading-tight text-white">ODIEN SERVICE</span>
              <span className="block text-[10px] leading-tight text-slate-500">ລະບົບບໍລິການ</span>
            </span>
          )}
        </Link>

        {!collapsed && (
          <button
            type="button"
            onClick={onToggle}
            title="ພັບເມນູ"
            className="ml-auto grid size-8 shrink-0 place-items-center rounded-lg text-slate-500 hover:bg-white/5 hover:text-white"
          >
            <PanelLeftClose className="size-4" />
          </button>
        )}
      </div>

      {collapsed && (
        <button
          type="button"
          onClick={onToggle}
          title="ຂະຫຍາຍເມນູ"
          className="mx-auto mt-2 grid size-9 place-items-center rounded-lg text-slate-500 hover:bg-white/5 hover:text-white"
        >
          <PanelLeftOpen className="size-4" />
        </button>
      )}

      <div className="flex min-h-0 flex-1 flex-col pt-3">
        <NavTree
          role={role}
          navFlags={navFlags}
          readableResources={readableResources}
          counts={counts}
          navLabels={navLabels}
          collapsed={collapsed}
          onExpand={onToggle}
        />
      </div>
    </aside>
  );
}
