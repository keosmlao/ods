"use client";
import { LinkPending } from "@/components/link-pending";
import { navigationFor, type NavGroup } from "@/lib/navigation";
import type { Role } from "@/lib/roles";
import { ChevronDown, PanelLeftClose, PanelLeftOpen, Search, Wrench, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";

const isActive = (pathname: string, href: string) =>
  href !== "#" && (pathname === href || pathname.startsWith(`${href}/`));

/* ---------------- ເມນູ (ໃຊ້ຮ່ວມກັບ mobile) ---------------- */

export function NavTree({
  role,
  onNavigate,
  collapsed = false,
  onExpand,
}: {
  /** ສິດຂອງຜູ້ໃຊ້ — ເມນູທີ່ບໍ່ມີສິດຈະບໍ່ຖືກສະແດງ */
  role: Role;
  onNavigate?: () => void;
  collapsed?: boolean;
  /** ຕອນພັບຢູ່ ກົດໄອຄອນກຸ່ມ → ຂະຫຍາຍເມນູ */
  onExpand?: () => void;
}) {
  const pathname = usePathname();
  const [query, setQuery] = useState("");
  const [closed, setClosed] = useState<Record<string, boolean>>({});

  /** ເມນູຕາມສິດ ແລ້ວຄົ້ນຫາ — ພິມແລ້ວເຫຼືອສະເພາະທີ່ຕົງ */
  const groups = useMemo(() => {
    const allowed = navigationFor(role);
    const text = query.trim().toLowerCase();
    if (!text) return allowed;
    return allowed
      .map((group) => ({ ...group, items: group.items.filter((item) => item.label.toLowerCase().includes(text)) }))
      .filter((group) => group.items.length > 0);
  }, [role, query]);

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
          const hasActive = group.items.some((item) => isActive(pathname, item.href));
          // ຄົ້ນຫາຢູ່ → ເປີດໝົດ; ບໍ່ດັ່ງນັ້ນເປີດກຸ່ມທີ່ກຳລັງໃຊ້ ເວັ້ນແຕ່ຜູ້ໃຊ້ພັບເອງ
          const open = searching || (closed[group.id] === undefined ? hasActive : !closed[group.id]);

          if (collapsed) {
            return (
              <div key={group.id} className="px-1 py-0.5">
                <button
                  type="button"
                  onClick={onExpand}
                  title={group.label}
                  className={`grid h-10 w-full place-items-center rounded-lg transition ${
                    hasActive ? "bg-teal-500 text-white" : "text-slate-400 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  <Icon className="size-5" />
                </button>
              </div>
            );
          }

          return (
            <div key={group.id}>
              <button
                type="button"
                onClick={() => setClosed((prev) => ({ ...prev, [group.id]: open }))}
                aria-expanded={open}
                className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-semibold transition ${
                  hasActive ? "text-white" : "text-slate-400 hover:bg-white/5 hover:text-white"
                }`}
              >
                <Icon className={`size-4 shrink-0 ${hasActive ? "text-teal-400" : ""}`} />
                <span className="flex-1 text-left">{group.label}</span>
                <ChevronDown className={`size-3.5 shrink-0 text-slate-600 transition-transform ${open ? "rotate-180" : ""}`} />
              </button>

              {open && (
                <ul className="mb-1 space-y-0.5">
                  {group.items.map((item, index) => {
                    const active = isActive(pathname, item.href);
                    return (
                      <li key={`${item.href}-${index}`}>
                        {item.divider && <hr className="my-1.5 ml-8 border-white/5" />}
                        {item.href === "#" ? (
                          // ods ເອງກໍປ່ອຍ href="#" ໄວ້ — ບໍ່ມີໜ້າປາຍທາງ
                          <span className="block cursor-not-allowed rounded-lg py-1.5 pl-9 pr-3 text-sm text-slate-600">
                            {item.label}
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
                            <span className="truncate">{item.label}</span>
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

export function Sidebar({ role, collapsed, onToggle }: { role: Role; collapsed: boolean; onToggle: () => void }) {
  return (
    <aside
      data-collapsed={collapsed}
      className={`no-print fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-white/5 bg-slate-950 transition-[width] duration-200 lg:flex ${
        collapsed ? "w-16" : "w-64"
      }`}
    >
      <div className={`flex h-14 shrink-0 items-center border-b border-white/5 ${collapsed ? "justify-center px-2" : "gap-2.5 px-3"}`}>
        <Link href="/dashboard" title="ODIEN SERVICE" className="flex items-center gap-3 overflow-hidden">
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

      <div className="min-h-0 flex-1 pt-3">
        <NavTree role={role} collapsed={collapsed} onExpand={onToggle} />
      </div>
    </aside>
  );
}
