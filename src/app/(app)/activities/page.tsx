import { allActivities, myActivities } from "@/app/actions/chatter";
import { ActivityRow } from "@/components/chatter/activity-row";
import { LinkPending } from "@/components/link-pending";
import { getSession } from "@/lib/auth";
import type { Activity } from "@/lib/chatter";
import { AlertTriangle, CalendarClock, CalendarDays, Users } from "lucide-react";
import Link from "next/link";

/**
 * ກິດຈະກຳຂອງຂ້ອຍ — ກ່ອງຂາເຂົ້າແບບ Odoo.
 * ບໍ່ມີໃນ ods ເລີຍ: ລະບົບເກົ່າບໍ່ມີບ່ອນນັດວຽກລ່ວງໜ້າ ຈຶ່ງບໍ່ມີບ່ອນເບິ່ງວ່າມີຫຍັງຄ້າງ.
 *
 * ຜູ້ຈັດການ (role ≠ technical) ສະຫຼັບໄປເບິ່ງກິດຈະກຳຂອງທຸກຄົນໄດ້ — ຄືກົດເກນ ownJobsOnly.
 */

type Tab = "me" | "all";
type Props = { searchParams: Promise<{ tab?: string }> };

/** ແບ່ງເປັນ 3 ກຸ່ມຕາມກຳນົດເວລາ — ຄື Odoo (Overdue / Today / Planned) */
function group(activities: Activity[]) {
  return {
    late: activities.filter((row) => row.days_left < 0),
    today: activities.filter((row) => row.days_left === 0),
    next: activities.filter((row) => row.days_left > 0),
  };
}

export default async function ActivitiesPage({ searchParams }: Props) {
  const session = await getSession();
  const manager = session?.role !== "technical";

  const params = await searchParams;
  // ຊ່າງບໍ່ມີແທັບ "ທຸກຄົນ" — ຖ້າພິມ URL ເອງກໍ່ຕົກກັບມາຫາຂອງຕົນ
  const tab: Tab = params.tab === "all" && manager ? "all" : "me";

  const activities = tab === "all" ? await allActivities() : await myActivities();
  const groups = group(activities);

  const SECTIONS: { key: keyof ReturnType<typeof group>; label: string; icon: typeof CalendarDays; tone: string }[] = [
    { key: "late", label: "ເລີຍກຳນົດ", icon: AlertTriangle, tone: "text-red-600" },
    { key: "today", label: "ມື້ນີ້", icon: CalendarClock, tone: "text-amber-600" },
    { key: "next", label: "ຕໍ່ໄປ", icon: CalendarDays, tone: "text-emerald-600" },
  ];

  const TABS: { key: Tab; label: string; icon: typeof Users }[] = [
    { key: "me", label: "ຂອງຂ້ອຍ", icon: CalendarDays },
    { key: "all", label: "ທຸກຄົນ", icon: Users },
  ];

  return (
    <div className="w-full space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-700">ກິດຈະກຳຂອງຂ້ອຍ</h1>
        <p className="mt-0.5 text-xs text-slate-500">
          {tab === "all" ? "ກິດຈະກຳຄ້າງຂອງທຸກຄົນ" : "ກິດຈະກຳຄ້າງທີ່ມອບໃຫ້ທ່ານ"} · {activities.length.toLocaleString()} ລາຍການ
          {groups.late.length > 0 && <span className="font-semibold text-red-600"> · ເລີຍກຳນົດ {groups.late.length}</span>}
        </p>
      </div>

      {/* ແທັບ — ຊ່າງເຫັນສະເພາະຂອງຕົນ ຈຶ່ງບໍ່ສະແດງແທັບໃຫ້ */}
      {manager && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm">
          <div className="flex overflow-hidden rounded-lg border border-slate-300">
            {TABS.map(({ key, label, icon: Icon }) => (
              <Link
                key={key}
                href={key === "me" ? "/activities" : "/activities?tab=all"}
                className={`inline-flex h-9 items-center gap-1.5 border-l border-slate-300 px-3 text-xs font-medium first:border-l-0 ${
                  tab === key ? "bg-slate-900 text-white" : "bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                <Icon className="size-3.5" />
                {label}
                <LinkPending className="size-3" />
              </Link>
            ))}
          </div>
        </div>
      )}

      {activities.length === 0 ? (
        <section className="rounded-xl border border-slate-200 bg-white py-12 text-center shadow-sm">
          <p className="text-xs text-slate-400">ບໍ່ມີກິດຈະກຳຄ້າງ</p>
        </section>
      ) : (
        SECTIONS.filter((section) => groups[section.key].length > 0).map(({ key, label, icon: Icon, tone }) => (
          <section key={key} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <h2 className="flex items-center gap-1.5 border-b border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700">
              <Icon className={`size-3.5 ${tone}`} />
              {label}
              <span className="rounded bg-slate-200 px-1 text-[10px] font-bold text-slate-600">
                {groups[key].length}
              </span>
            </h2>
            <ul>
              {groups[key].map((activity) => (
                <ActivityRow key={activity.id} activity={activity} showOwner={tab === "all"} />
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
