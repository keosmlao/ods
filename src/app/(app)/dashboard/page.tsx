import { qcWorkflows } from "@/app/actions/qc";
import { Elapsed } from "@/components/elapsed";
import { DashboardAutoRefresh } from "@/components/dashboard-auto-refresh";
import { LinkPending } from "@/components/link-pending";
import { getSession } from "@/lib/auth";
import { installStatuses, pipelineOf, repairStatuses, type StatusDef } from "@/lib/dashboard-status";
import {
  type Counts,
  type DashboardData,
  getDashboard,
  type StageAge,
  type StaleJob,
  type TechLoad,
} from "@/lib/dashboard";
import { elapsedTone } from "@/lib/elapsed-tone";
import { REPEAT_DAYS, type RepeatJob } from "@/lib/repeat";
import { APPROVER_SIDE, canAccess, ROLE_LABEL, type Role, roleOf } from "@/lib/roles";
import { ownJobsOnly } from "@/lib/scope";
import {
  AlertCircle,
  ArrowRight,
  Ban,
  CalendarClock,
  CalendarDays,
  ClipboardCheck,
  Frown,
  HardHat,
  PackageCheck,
  PackageOpen,
  PackageX,
  Plus,
  Radar,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  ShoppingCart,
  Smile,
  Timer,
  TrendingDown,
  TrendingUp,
  Truck,
  UserCheck,
  Wallet,
  Users,
  Wrench,
} from "lucide-react";
import Link from "next/link";

/**
 * ໜ້າລວມ — "ມີຫຍັງຕ້ອງລົງມື" ບໍ່ແມ່ນ "ມີຫຍັງເກີດຂຶ້ນແດ່".
 *
 * ── 3 ຢ່າງທີ່ອອກແບບໃໝ່ ──
 * ① ສະແດງ**ຕາມສິດ**: ບັດຈະຂຶ້ນກໍ່ຕໍ່ເມື່ອຜູ້ນັ້ນ canAccess ໜ້າປາຍທາງຂອງມັນ.
 *    ແຕ່ກ່ອນຊ່າງເຫັນຕົວເລກ "ລໍຖ້າສະເໜີລາຄາ" ທັງທີ່ກົດເຂົ້າໄປແລ້ວເດັ້ງ /forbidden.
 * ② ກອງ**ຕາມຜູ້ໃຊ້**: ຊ່າງເຫັນສະເພາະວຽກຂອງຕົນ (ຄືກັບທຸກໜ້າອື່ນ) — ແຕ່ກ່ອນໜ້ານີ້
 *    ບໍ່ກອງເລີຍ ⇒ ຊ່າງເຫັນຍອດຂອງທັງບໍລິສັດ ແລ້ວກົດເຂົ້າໄປເຫັນແຕ່ວຽກຕົນ (ຕົວເລກຫຼົ້ນກັນ).
 * ③ ແຍກ "ຄິວຕ້ອງລົງມື" (ອາດຊ້ຳກັນໄດ້) ອອກຈາກ "ຂັ້ນໄດ" (ບໍ່ຊ້ຳ ລວມກັນໄດ້ຍອດພໍດີ)
 *    ⇒ ບໍ່ມີການນັບຊ້ຳໃນແຖບຂັ້ນໄດ.
 */
export const dynamic = "force-dynamic";

/* ── ບັດ "ຕ້ອງລົງມື" ──────────────────────────────────────────── */

type Alert = {
  label: string;
  value: number;
  detail?: string;
  href: string;
  icon: typeof Wrench;
  /** ແດງ = ຄວນລົງມືດຽວນີ້ · ເຫຼືອງ = ຄ້າງລໍ */
  tone: "red" | "amber";
};

const TONE = {
  red: { card: "border-red-200 bg-white hover:border-red-300", icon: "bg-red-50 text-red-600", value: "text-red-700", bar: "bg-red-500" },
  amber: { card: "border-amber-200 bg-white hover:border-amber-300", icon: "bg-amber-50 text-amber-700", value: "text-amber-800", bar: "bg-amber-400" },
};

function alertsFor(role: Role, data: DashboardData, canQc: boolean): Alert[] {
  const all: Alert[] = [
    /**
     * ດ່ານກວດຮັບຄຸນນະພາບ — ຂຶ້ນສະເພາະຜູ້ທີ່ **ຜູ້ຈັດການກຳນົດໃຫ້ກວດ** (ods_qc_role).
     * canAccess ບອກບໍ່ໄດ້ (ເສັ້ນທາງ /qc ເປີດໃຫ້ທຸກຄົນໃນ RULES ໂດຍເຈດຕະນາ — ເບິ່ງ lib/roles)
     * ⇒ ຖ້າບໍ່ກັນດ້ວຍ canQc ຊ່າງຈະເຫັນບັດແລ້ວກົດເຂົ້າໄປຕົກ /forbidden.
     */
    ...(canQc
      ? ([
          {
            label: "ລໍກວດຮັບຄຸນນະພາບ (ສ້ອມ)",
            value: data.repair["wait-qc"] ?? 0,
            detail: "ສ້ອມແລ້ວ ຍັງບໍ່ຜ່ານ QC — ສົ່ງຄືນບໍ່ໄດ້",
            href: "/qc",
            icon: ShieldCheck,
            tone: "amber",
          },
          {
            label: "ລໍກວດຮັບຄຸນນະພາບ (ຕິດຕັ້ງ)",
            value: data.install["wait-qc"] ?? 0,
            detail: "ຕິດຕັ້ງແລ້ວ ຍັງບໍ່ຜ່ານ QC — ປິດງານບໍ່ໄດ້",
            href: "/qc",
            icon: ShieldCheck,
            tone: "amber",
          },
        ] as Alert[])
      : []),
    {
      label: "ກວດເຊັກເກີນກຳນົດເວລາ",
      value: data.slaLate,
      detail: "ເກີນ SLA ຂອງປະເພດບໍລິການ",
      href: "/checking",
      icon: Timer,
      tone: "red",
    },
    {
      /**
       * "ໜີ້ອາໄຫຼ່" — ຂອງອອກຈາກສາງໄປແລ້ວ ງານຖືກຍົກເລີກ ແຕ່ບໍ່ມີໃບສົ່ງຄືນ.
       * ຕະຫຼອດ 3 ປີບໍ່ເຄີຍມີໃຜເຫັນເລກນີ້ ເພາະໃບເບີກປົນຢູ່ໃນລາຍການລວມ 4,600+ ໃບ.
       */
      label: "ອາໄຫຼ່ຄ້າງ — ງານທີ່ຍົກເລີກ",
      value: data.cancelledSpares.docs,
      detail: `${data.cancelledSpares.lines.toLocaleString()} ລາຍການ ຍັງບໍ່ໄດ້ສົ່ງຄືນສາງ`,
      href: "/stock/returns?tab=cancelled",
      icon: PackageX,
      tone: "red",
    },
    {
      label: "ອະນຸມັດໃບສະເໜີລາຄາ",
      value: data.approvals.quotes,
      href: "/approvals/quotations",
      icon: ClipboardCheck,
      tone: "amber",
    },
    {
      label: "ອະນຸມັດຄຳຂໍຍົກເລີກ",
      value: data.cancelRequests,
      href: "/approvals/cancellations",
      icon: Ban,
      tone: "amber",
    },
    {
      label: "ອະນຸມັດຂໍສັ່ງຊື້",
      value: data.approvals.purchases,
      href: "/approvals/purchase-requests",
      icon: ShoppingCart,
      tone: "amber",
    },
    {
      label: "ລໍລູກຄ້າຕັດສິນ (ໃບສະເໜີລາຄາ)",
      value: data.approvals.customer,
      href: "/quotations/customer-approval",
      icon: UserCheck,
      tone: "amber",
    },
    {
      /**
       * ສັນຍາວັນນັດໄວ້ກັບລູກຄ້າແລ້ວ ແຕ່ວັນນັດຜ່ານໄປ ແລະ ຍັງບໍ່ໄດ້ຕິດຕັ້ງ.
       * appoint_date ຖືກຂຽນຢູ່ຕອນຈັດຊ່າງ ແຕ່ບໍ່ເຄີຍມີໜ້າໃດເຕືອນເມື່ອມັນຜ່ານໄປ.
       */
      label: "ງານຕິດຕັ້ງເລີຍວັນນັດ",
      value: data.overdueAppointments,
      detail: "ນັດລູກຄ້າໄວ້ແລ້ວ ແຕ່ຍັງບໍ່ໄດ້ຕິດຕັ້ງ",
      href: "/installations/work",
      icon: CalendarClock,
      tone: "red",
    },
    {
      // ຂັ້ນທີ່ວຽກຕິດດົນທີ່ສຸດຂອງລະບົບ — ຈຳນວນຢ່າງດຽວບໍ່ບອກຄວາມຮ້າຍແຮງ ຈຶ່ງໃສ່ອາຍຸນຳ
      label: "ອາໄຫຼ່ສັ່ງຊື້ຍັງບໍ່ມາຮອດ",
      value: data.onOrder.n,
      detail: `ດົນສຸດ ${Math.floor(data.onOrder.max_seconds / 86400).toLocaleString()} ມື້`,
      href: "/stock/arrivals",
      icon: Truck,
      tone: "red",
    },
    {
      // ໜ້າວຽກຫຼັກຂອງສາງ — ແປກທີ່ໜ້າລວມບໍ່ເຄີຍສະແດງ (ສາງເຫັນພຽງບັດດຽວ)
      label: "ອາໄຫຼ່ລໍສາງເບີກ (ສ້ອມ)",
      value: data.warehouse.repair_lines,
      detail: "ຊ່າງຂໍມາແລ້ວ ລໍສາງເບີກອອກ",
      href: "/stock/dispatch",
      icon: PackageCheck,
      tone: "amber",
    },
    {
      label: "ໃບຂໍເບີກລໍສາງເບີກ (ຕິດຕັ້ງ)",
      value: data.warehouse.install_docs,
      href: "/installations/dispatch",
      icon: PackageCheck,
      tone: "amber",
    },
    {
      // ສາງເບີກອອກໃຫ້ແລ້ວ ແຕ່ຊ່າງຍັງບໍ່ໄປຮັບ ⇒ ອາໄຫຼ່ຢູ່ນອກສາງ ແລະ ວຽກຄ້າງລໍຢູ່
      label: "ອາໄຫຼ່ພ້ອມໃຫ້ຮັບ (ສ້ອມ)",
      value: data.pickup.repair_docs,
      detail: "ສາງເບີກແລ້ວ ຊ່າງຍັງບໍ່ໄປຮັບ",
      href: "/stock/requests/pickup",
      icon: PackageOpen,
      tone: "amber",
    },
    {
      label: "ອາໄຫຼ່ພ້ອມໃຫ້ຮັບ (ຕິດຕັ້ງ)",
      value: data.pickup.install_docs,
      href: "/installations/spare-pickup",
      icon: PackageOpen,
      tone: "amber",
    },
    {
      label: "ລໍຖ້າຊ່າງຮັບງານຕິດຕັ້ງ",
      value: data.install["wait-accept"] ?? 0,
      href: "/installations/accept",
      icon: HardHat,
      tone: "amber",
    },
    {
      label: "ວຽກສ້ອມຍັງບໍ່ມີຊ່າງ",
      value: data.unassigned.repair,
      detail: "ຕ້ອງກວດສອບ ແລະມອບໝາຍຜູ້ຮັບຜິດຊອບ",
      href: "/service",
      icon: UserCheck,
      tone: "red",
    },
    {
      label: "ວຽກຕິດຕັ້ງຍັງບໍ່ມີຊ່າງ",
      value: data.unassigned.install,
      detail: "ລໍຖ້າ CS ຈັດຊ່າງ",
      href: "/installations/assign",
      icon: UserCheck,
      tone: "red",
    },

    /* ── ຄິວຫຼັກຂອງ CS (ຝ່າຍບໍລິການ) ──
     * ບັດຂ້າງເທິງລ້ວນເປັນຂອງ ຊ່າງ · ສາງ · ຜູ້ອະນຸມັດ ⇒ CS ບໍ່ເຫັນຫຍັງເລີຍ.
     * ສາມອັນນີ້ຄືວຽກທີ່ CS ຕ້ອງລົງມືເອງ ແລະ ເປັນຄໍຂວດຖ້າບໍ່ມີໃຜເຮັດ. */
    {
      label: "ລໍຖ້າຈັດຊ່າງ (ຕິດຕັ້ງ)",
      value: data.install["wait-assign"] ?? 0,
      detail: "ເປີດງານແລ້ວ ຍັງບໍ່ມີຊ່າງ",
      href: "/installations/assign",
      icon: HardHat,
      tone: "amber",
    },
    {
      label: "ລໍຖ້າສົ່ງເຄື່ອງຄືນລູກຄ້າ",
      value: data.repair["wait-return"] ?? 0,
      detail: "ສ້ອມແລ້ວ ລໍອອກໃບຮັບເງິນ/ສົ່ງຄືນ",
      href: "/returns",
      icon: PackageCheck,
      tone: "amber",
    },
    {
      label: "ລໍຖ້າປິດງານຕິດຕັ້ງ",
      value: data.install["wait-close"] ?? 0,
      detail: "ລູກຄ້າຕອບແບບສອບຖາມແລ້ວ",
      href: "/installations/close",
      icon: ClipboardCheck,
      tone: "amber",
    },
  ];

  // ບໍ່ໂຊຕົວເລກທີ່ກົດເຂົ້າໄປບໍ່ໄດ້ ແລະ ບໍ່ໂຊສູນ (ໜ້າລວມຕ້ອງເປັນ "ວຽກທີ່ຕ້ອງເຮັດ")
  return all.filter((alert) => alert.value > 0 && canAccess(role, alert.href.split("?")[0]));
}

/* ── ແຖບຂັ້ນໄດ ─────────────────────────────────────────────── */

/**
 * ຂັ້ນໄດ — ຂັ້ນລ້ວນໆ (ບໍ່ຫຼົ້ນກັນ) ຈຶ່ງລວມກັນໄດ້ຍອດພໍດີ ແລະ ແຖບສ່ວນແບ່ງມີຄວາມໝາຍ.
 * ຄິວທີ່ຕັດຂວາງຂັ້ນ (ເຊັ່ນ "ລໍຖ້າຊ່າງຮັບງານ") ຢູ່ໃນບັດ "ຕ້ອງລົງມື" ບໍ່ແມ່ນຢູ່ນີ້.
 */
function Pipeline({
  workflow,
  statuses,
  counts,
  ages,
  role,
}: {
  workflow: "repair" | "install";
  statuses: Record<string, StatusDef>;
  counts: Counts;
  ages: StageAge;
  role: Role;
}) {
  const stages = pipelineOf(statuses);
  const total = stages.reduce((sum, [slug]) => sum + (counts[slug] ?? 0), 0);
  const peak = Math.max(1, ...stages.map(([slug]) => counts[slug] ?? 0));

  return (
    <div className="space-y-1">
      {stages.map(([slug, def]) => {
        const value = counts[slug] ?? 0;
        const href = `/dashboard/status/${workflow}/${slug}`;
        const width = (value / peak) * 100;
        // ຄໍຂວດ = ຂັ້ນທີ່ກອງວຽກໄວ້ຫຼາຍສຸດ (ແລະ ບໍ່ແມ່ນສູນ)
        const isPeak = value > 0 && value === peak && total > 0;
        /**
         * ອາຍຸຂອງຂັ້ນ — "ວຽກທີ່ຄ້າງຢູ່ຂັ້ນນີ້ດົນສຸດ".
         * ຈຳນວນຢ່າງດຽວຫຼອກຕາ: 3 ວຽກຄ້າງ 19 ມື້ ຮ້າຍແຮງກວ່າ 29 ວຽກຄ້າງ 7 ມື້.
         */
        const age = value > 0 ? (ages[def.stage as number]?.max ?? null) : null;
        const tone = elapsedTone(age);

        const row = (
          <>
            <span className="w-36 shrink-0 truncate text-xs text-slate-600" title={def.label}>
              {def.label}
            </span>
            <span className="relative h-5 flex-1 overflow-hidden rounded bg-slate-100">
              <span
                className={`absolute inset-y-0 left-0 rounded ${isPeak ? "bg-amber-400" : "bg-teal-400"}`}
                style={{ width: `${width}%` }}
                aria-hidden
              />
            </span>
            {/* ຄ້າງດົນສຸດຢູ່ຂັ້ນນີ້ — ສີເຕືອນຕາມເກນດຽວກັນກັບທຸກໜ້າ (elapsedTone) */}
            <span className="w-24 shrink-0 text-right">
              {age != null ? (
                <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${tone.chip}`}>
                  {Math.floor(age / 86400).toLocaleString()} ມື້
                </span>
              ) : null}
            </span>
            <b
              className={`w-10 shrink-0 text-right text-xs tabular-nums ${
                value > 0 ? "text-slate-900" : "text-slate-300"
              }`}
            >
              {value.toLocaleString()}
            </b>
          </>
        );

        // ກົດເຂົ້າໄປໄດ້ກໍ່ຕໍ່ເມື່ອມີສິດເປີດໜ້າລາຍລະອຽດ
        return canAccess(role, href) ? (
          <Link
            key={slug}
            href={href}
            className="flex items-center gap-2 rounded px-1 py-0.5 transition hover:bg-slate-50"
          >
            {row}
            <LinkPending className="size-3 shrink-0 text-slate-300" />
          </Link>
        ) : (
          <div key={slug} className="flex items-center gap-2 px-1 py-0.5">
            {row}
            <span className="size-3 shrink-0" />
          </div>
        );
      })}

      <p className="border-t border-slate-100 pt-1.5 text-right text-[11px] text-slate-400">
        ປ້າຍເວລາ = ວຽກທີ່ຄ້າງຢູ່ຂັ້ນນັ້ນ<b>ດົນສຸດ</b> · ລວມ{" "}
        <b className="text-slate-700">{total.toLocaleString()}</b> ວຽກຄ້າງ
      </p>
    </div>
  );
}

/* ── ຕາຕະລາງ "ຄ້າງດົນສຸດ" ─────────────────────────────────────── */

/**
 * ວຽກທີ່ຖືກລືມ — ຮຽງ **ເກົ່າສຸດກ່ອນ**.
 * ໜ້າລວມເກົ່າຮຽງ "ໃໝ່ສຸດກ່ອນ" ເຊິ່ງເປັນວຽກທີ່ຫາກໍ່ເປີດ = ດ່ວນນ້ອຍທີ່ສຸດ.
 * ທັງສອງໜ້າລາຍລະອຽດ (/service/<code> ແລະ /installations/<code>) ເປີດໄດ້ທຸກ role.
 */
/**
 * ສ້ອມຊ້ຳ — ເຄື່ອງໜ່ວຍດຽວກັນ (serial ດຽວກັນ) ກັບມາສ້ອມອີກພາຍໃນ 30 ມື້ ນັບແຕ່ສົ່ງຄືນ.
 *
 * ນີ້ຄື "ຄຸນນະພາບການສ້ອມ" ທີ່ບໍ່ເຄີຍມີໃຜວັດ: ຄ່າຄອມຖືກຈ່າຍສອງເທື່ອ ໃຫ້ວຽກທີ່ຈິງໆແມ່ນ
 * ຄັ້ງດຽວ ແລະ ລູກຄ້າຫອບເຄື່ອງມາສອງເທື່ອ. ເບິ່ງເງື່ອນໄຂຢູ່ lib/repeat.ts
 */
function RepeatPanel({ rows }: { rows: RepeatJob[] }) {
  return (
    <article className="overflow-hidden rounded-2xl border border-amber-200 bg-white shadow-sm">
      <h2 className="flex items-center gap-2 border-b border-amber-100 bg-amber-50 px-5 py-4 text-sm font-bold text-amber-900">
        <RotateCcw className="size-4" />
        ສ້ອມຊ້ຳ — ເຄື່ອງກັບມາພາຍໃນ {REPEAT_DAYS} ມື້
        <span className="rounded-full bg-amber-200 px-2 py-0.5 text-[11px] text-amber-900">{rows.length}</span>
      </h2>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[680px] border-collapse text-xs">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left text-slate-600">
              <th className="whitespace-nowrap px-3 py-2.5 font-semibold">ໃບໃໝ່</th>
              <th className="whitespace-nowrap px-3 py-2.5 font-semibold">ໃບເກົ່າ</th>
              <th className="whitespace-nowrap px-3 py-2.5 font-semibold">ຫ່າງກັນ</th>
              <th className="whitespace-nowrap px-3 py-2.5 font-semibold">ລູກຄ້າ</th>
              <th className="whitespace-nowrap px-3 py-2.5 font-semibold">Serial</th>
              <th className="whitespace-nowrap px-3 py-2.5 font-semibold">ຊ່າງ (ໃໝ່ / ເກົ່າ)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.code} className="border-b border-slate-100 transition last:border-0 hover:bg-amber-50/40">
                <td className="px-3 py-2.5">
                  <Link href={`/service/${encodeURIComponent(row.code)}`} className="font-bold text-teal-700 hover:underline">
                    #{row.code}
                  </Link>
                </td>
                <td className="px-3 py-2.5">
                  <Link href={`/service/${encodeURIComponent(row.prev_code)}`} className="font-semibold text-slate-600 hover:underline">
                    #{row.prev_code}
                  </Link>
                  <span className="ml-1 text-slate-400">{row.prev_returned}</span>
                </td>
                <td className="whitespace-nowrap px-3 py-2.5">
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 font-semibold text-amber-800">
                    {row.days_between} ມື້
                  </span>
                </td>
                <td className="px-3 py-2.5 text-slate-600">{row.customer ?? "-"}</td>
                <td className="px-3 py-2.5 text-slate-500">{row.sn}</td>
                <td className="px-3 py-2.5 text-slate-600">
                  {row.tech ?? "-"} / {row.prev_tech ?? "-"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </article>
  );
}

function StaleTable({
  title,
  rows,
  whoLabel,
  hrefOf,
}: {
  title: string;
  rows: StaleJob[];
  whoLabel: string;
  hrefOf: (code: string) => string;
}) {
  return (
    <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <h2 className="border-b border-slate-100 px-5 py-4 text-sm font-bold text-slate-800">{title}</h2>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[620px] border-collapse text-xs">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left text-slate-600">
              <th className="whitespace-nowrap px-3 py-2.5 font-semibold">ເລກທີ</th>
              <th className="whitespace-nowrap px-3 py-2.5 font-semibold">ຄ້າງມາ</th>
              <th className="whitespace-nowrap px-3 py-2.5 font-semibold">ລູກຄ້າ</th>
              <th className="whitespace-nowrap px-3 py-2.5 font-semibold">ສິນຄ້າ</th>
              <th className="whitespace-nowrap px-3 py-2.5 font-semibold">{whoLabel}</th>
              <th className="whitespace-nowrap px-3 py-2.5 font-semibold">ຂັ້ນຕອນ</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const tone = elapsedTone(row.elapsed_seconds);
              return (
                <tr key={row.code} className="border-b border-slate-100 transition last:border-0 hover:bg-teal-50/40">
                  <td className="relative whitespace-nowrap px-3 py-2.5 font-bold text-[#0536a9]">
                    <span className={`absolute inset-y-0 left-0 w-1 ${tone.bar}`} aria-hidden />
                    <Link href={hrefOf(row.code)} className="hover:underline">
                      {row.code}
                    </Link>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5">
                    <Elapsed
                      seconds={row.elapsed_seconds}
                      className={`inline-block rounded px-1.5 py-0.5 text-[11px] font-semibold ${tone.chip}`}
                    />
                  </td>
                  <td className="max-w-40 truncate px-3 py-2.5 text-slate-600" title={row.customer ?? ""}>
                    {row.customer || "-"}
                  </td>
                  <td className="max-w-48 truncate px-3 py-2.5 text-slate-600" title={row.product ?? ""}>
                    {row.product || "-"}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-slate-600">{row.who || "-"}</td>
                  <td className="whitespace-nowrap px-3 py-2.5">
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
                      {row.stage}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {rows.length === 0 && <p className="py-10 text-center text-xs text-slate-400">ບໍ່ມີວຽກຄ້າງ</p>}
      </div>
    </article>
  );
}

/**
 * ຜົນງານ 30 ມື້ — ເປີດ vs ປິດ.
 * ຈຳນວນຄ້າງຢ່າງດຽວບອກບໍ່ໄດ້ວ່າ **ກຳລັງດີຂຶ້ນ ຫຼື ຊຸດໂຊມລົງ**: ຄ້າງ 98 ວຽກ ຈະໝາຍຄວາມ
 * ຕ່າງກັນສິ້ນເຊີງ ຖ້າເດືອນນີ້ປິດໄດ້ຫຼາຍກວ່າເປີດ (ກຳລັງລົງ) ຫຼື ໜ້ອຍກວ່າ (ກຳລັງທ້ວມ).
 */
function Throughput({ label, opened, closed }: { label: string; opened: number; closed: number }) {
  const delta = opened - closed;
  const growing = delta > 0;
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3">
      <div className="min-w-0">
        <p className="truncate text-xs font-semibold text-slate-700">{label}</p>
        <p className="mt-0.5 text-[11px] text-slate-500">
          ເປີດ <b className="text-slate-700">{opened.toLocaleString()}</b> · ປິດ{" "}
          <b className="text-slate-700">{closed.toLocaleString()}</b>
        </p>
      </div>
      <span
        className={`flex shrink-0 items-center gap-1 rounded px-2 py-1 text-xs font-bold ${
          growing ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"
        }`}
      >
        {growing ? <TrendingUp className="size-3.5" /> : <TrendingDown className="size-3.5" />}
        {delta > 0 ? "+" : ""}
        {delta.toLocaleString()}
      </span>
    </div>
  );
}

/**
 * ພາລະງານຕໍ່ຊ່າງ — **ຫົວໜ້າຊ່າງ ແລະ ຜູ້ຈັດການເທົ່ານັ້ນ** (APPROVER_SIDE).
 *
 * ບໍ່ມີໜ້າໃດໃນລະບົບບອກໄດ້ວ່າ "ໃຜຖືວຽກຄ້າງເທົ່າໃດ" ທັງທີ່ຂໍ້ມູນຈິງບໍ່ສົມດຸນຮ້າຍແຮງ:
 * ຊ່າງຄົນນຶ່ງຖື 41 ວຽກ (ດົນສຸດ 327 ມື້) ອີກຄົນຖື 4. ຫົວໜ້າຊ່າງຈຶ່ງແບ່ງງານໃໝ່ບໍ່ຖືກ.
 * ບໍ່ໂຊໃຫ້ຊ່າງທົ່ວໄປ — ບໍ່ແມ່ນຂໍ້ມູນທີ່ເຂົາຕ້ອງໃຊ້ ແລະ ເປັນການປຽບທຽບກັນເອງ.
 */
function TechLoadPanel({ rows }: { rows: TechLoad[] }) {
  if (rows.length === 0) return null;
  const peak = Math.max(1, ...rows.map((row) => row.jobs));

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-700">
        <Users className="size-4 text-slate-400" />
        ພາລະງານຕໍ່ຊ່າງ (ວຽກສ້ອມທີ່ຍັງຄ້າງ)
      </h2>
      <div className="space-y-1">
        {rows.map((row) => {
          const tone = elapsedTone(row.oldest_seconds);
          return (
            <div key={row.tech} className="flex items-center gap-2 px-1 py-0.5">
              <span className="w-28 shrink-0 truncate text-xs text-slate-600" title={row.tech}>
                {row.tech}
              </span>
              <span className="relative h-5 flex-1 overflow-hidden rounded bg-slate-100">
                <span
                  className="absolute inset-y-0 left-0 rounded bg-indigo-400"
                  style={{ width: `${(row.jobs / peak) * 100}%` }}
                  aria-hidden
                />
              </span>
              <span className="w-24 shrink-0 text-right">
                <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${tone.chip}`}>
                  {Math.floor(row.oldest_seconds / 86400).toLocaleString()} ມື້
                </span>
              </span>
              <b className="w-10 shrink-0 text-right text-xs tabular-nums text-slate-900">{row.jobs}</b>
            </div>
          );
        })}
      </div>
      <p className="mt-2 border-t border-slate-100 pt-1.5 text-right text-[11px] text-slate-400">
        ປ້າຍເວລາ = ວຽກທີ່ຊ່າງຄົນນັ້ນຖືໄວ້<b>ດົນສຸດ</b>
      </p>
    </section>
  );
}

/* ── ແບບປະເມີນລູກຄ້າ ──────────────────────────────────────────── */

/**
 * ⚠️ ມາດຕາສ່ວນ **1 = ດີສຸດ · 4 = ແຍ່ສຸດ** — **ຕໍ່າກວ່າ = ດີກວ່າ** (ກັບຫົວຈາກດາວຄະແນນ).
 * ທຸກຕົວເລກໃນແຜງນີ້ຈຶ່ງຕ້ອງບອກທິດໃຫ້ຊັດ ບໍ່ດັ່ງນັ້ນຄົນອ່ານຈະຕີຄວາມກັບກັນ.
 *
 * ຄະແນນລວມສະສົມອັນດຽວ (1.23) **ເຊື່ອງ 3 ຢ່າງທີ່ສຳຄັນກວ່າ** ໄວ້ໝົດ:
 *   · ແນວໂນ້ມ — ຂໍ້ມູນຈິງຊຸດໂຊມລົງ 1.11 → 1.42 ໃນ 3 ເດືອນ
 *   · ຂໍ້ໃດແຍ່ — ຄະແນນຕໍ່ຄຳຖາມ (ການແຕ່ງກາຍ? ຄວາມສະອາດ?)
 *   · ໃຜບໍ່ພໍໃຈ — ງານທີ່ລູກຄ້າໃຫ້ຄະແນນ ≥3 ຄວນຕິດຕາມ
 */
const scoreTone = (value: number) =>
  value >= 2.5 ? "text-red-600" : value >= 1.5 ? "text-amber-600" : "text-emerald-600";

function FeedbackPanel({ data, score }: { data: DashboardData; score: number }) {
  const trend = data.feedbackTrend;
  const peak = Math.max(1, ...data.feedbackTopics.map((topic) => topic.avg_points));
  // ຊຸດໂຊມ = ເດືອນລ່າສຸດແຍ່ກວ່າເດືອນກ່ອນ (ຕົວເລກສູງຂຶ້ນ = ແຍ່ລົງ)
  const last = trend.at(-1);
  const prev = trend.at(-2);
  const worsening = last && prev ? last.avg_points > prev.avg_points : false;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-teal-50 text-teal-600">
          <Smile className="size-4" />
        </span>
        <div className="min-w-40 flex-1">
          <h2 className="text-sm font-bold text-slate-700">ແບບປະເມີນລູກຄ້າ (ງານຕິດຕັ້ງ)</h2>
          <p className="mt-0.5 text-[11px] text-slate-500">
            ຈາກ {data.feedback.jobs.toLocaleString()} ງານ ·{" "}
            <b className="text-slate-700">1 = ດີສຸດ · 4 = ແຍ່ສຸດ</b> (ຕໍ່າກວ່າ = ດີກວ່າ)
          </p>
        </div>
        <div className="text-right">
          <p className={`text-3xl font-bold ${scoreTone(score)}`}>{score.toFixed(2)}</p>
          <p className="text-[11px] text-slate-400">ຄະແນນລວມ</p>
        </div>
      </div>

      {/* ລູກຄ້າບໍ່ພໍໃຈ — ຄວນຕິດຕາມ */}
      {data.feedback.unhappy_jobs > 0 && (
        <Link
          href="/reports/customer-feedback"
          className="mb-3 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800 transition hover:bg-red-100"
        >
          <Frown className="size-4 shrink-0" />
          <span className="flex-1">
            <b>{data.feedback.unhappy_jobs.toLocaleString()} ງານ</b> ທີ່ລູກຄ້າໃຫ້ຄະແນນແຍ່ (3 ຫຼື 4) — ຄວນຕິດຕາມ
          </span>
          <LinkPending className="size-3.5" />
        </Link>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {/* ແນວໂນ້ມ 6 ເດືອນ */}
        {trend.length > 1 && (
          <div>
            <p className="mb-2 flex items-center gap-1.5 text-xs font-bold text-slate-600">
              ແນວໂນ້ມ 6 ເດືອນ
              {worsening ? (
                <span className="flex items-center gap-0.5 rounded bg-red-50 px-1.5 py-0.5 text-[10px] font-semibold text-red-700">
                  <TrendingUp className="size-3" /> ຊຸດໂຊມລົງ
                </span>
              ) : (
                <span className="flex items-center gap-0.5 rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
                  <TrendingDown className="size-3" /> ດີຂຶ້ນ
                </span>
              )}
            </p>
            {/* ແທ່ງສູງ = ຄະແນນສູງ = ແຍ່ (ຕໍ່າ=ດີ) ⇒ ສີແດງເມື່ອສູງ */}
            <div className="flex h-24 items-end gap-1.5">
              {trend.map((month) => (
                <div key={month.month} className="flex flex-1 flex-col items-center gap-1">
                  <span className={`text-[10px] font-bold ${scoreTone(month.avg_points)}`}>
                    {month.avg_points.toFixed(2)}
                  </span>
                  <div
                    className={`w-full rounded-t ${
                      month.avg_points >= 2.5
                        ? "bg-red-400"
                        : month.avg_points >= 1.5
                          ? "bg-amber-400"
                          : "bg-emerald-400"
                    }`}
                    // ມາດຕາສ່ວນ 1-4 → ຄວາມສູງ (4 = ເຕັມ)
                    style={{ height: `${Math.max(6, (month.avg_points / 4) * 100)}%` }}
                    title={`${month.jobs} ງານ`}
                  />
                  <span className="text-[10px] text-slate-400">{month.month}</span>
                </div>
              ))}
            </div>
            <p className="mt-1 text-[10px] text-slate-400">ແທ່ງສູງ = ຄະແນນສູງ = ແຍ່ລົງ</p>
          </div>
        )}

        {/* ຄະແນນແຍກຕາມຄຳຖາມ — ຮຽງແຍ່ສຸດກ່ອນ */}
        {data.feedbackTopics.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-bold text-slate-600">ຄະແນນຕໍ່ຄຳຖາມ (ແຍ່ສຸດກ່ອນ)</p>
            <div className="space-y-1">
              {data.feedbackTopics.map((topic) => (
                <div key={topic.line_number} className="flex items-center gap-2">
                  <span className="w-40 shrink-0 truncate text-[11px] text-slate-600" title={topic.name}>
                    {topic.name}
                  </span>
                  <span className="relative h-4 flex-1 overflow-hidden rounded bg-slate-100">
                    <span
                      className={`absolute inset-y-0 left-0 rounded ${
                        topic.avg_points >= 2.5
                          ? "bg-red-400"
                          : topic.avg_points >= 1.5
                            ? "bg-amber-400"
                            : "bg-emerald-400"
                      }`}
                      style={{ width: `${(topic.avg_points / peak) * 100}%` }}
                      aria-hidden
                    />
                  </span>
                  <b className={`w-10 shrink-0 text-right text-[11px] tabular-nums ${scoreTone(topic.avg_points)}`}>
                    {topic.avg_points.toFixed(2)}
                  </b>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

/* ── ໜ້າ ─────────────────────────────────────────────────────── */

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  const params = await searchParams;
  const days = [1, 7, 30, 90].includes(Number(params.range)) ? Number(params.range) : 30;
  const session = await getSession();
  const role = roleOf(session);
  // ຊ່າງເຫັນສະເພາະວຽກຂອງຕົນ — ກົດເກນອັນດຽວກັບທຸກໜ້າ (lib/scope)
  const tech = ownJobsOnly(session);

  const [{ data, error }, qc] = await Promise.all([getDashboard(tech, days), qcWorkflows()]);
  const repair: Counts = data?.repair ?? {};
  const install: Counts = data?.install ?? {};
  const alerts = data ? alertsFor(role, data, qc.length > 0) : [];

  const score = data?.feedback.avg_points ?? null;
  const oldestRepair = data?.oldest.repair_seconds ?? 0;
  const oldestInstall = data?.oldest.install_seconds ?? 0;
  const actionTotal = alerts.reduce((sum, alert) => sum + alert.value, 0);
  const updatedAt = new Intl.DateTimeFormat("lo-LA", {
    timeZone: "Asia/Vientiane",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date());
  const kpis = [
    { label: "ວຽກສ້ອມຄ້າງ", value: repair.total ?? 0, tone: "text-sky-700", bg: "bg-sky-50" },
    { label: "ວຽກຕິດຕັ້ງຄ້າງ", value: install.total ?? 0, tone: "text-violet-700", bg: "bg-violet-50" },
    { label: "ເກີນ SLA", value: data?.sla.late ?? 0, tone: "text-red-700", bg: "bg-red-50" },
    { label: "ລາຍການຕ້ອງລົງມື", value: actionTotal, tone: "text-amber-700", bg: "bg-amber-50" },
  ];
  const criticalTotal = (data?.sla.critical ?? 0) + (data?.overdueAppointments ?? 0) + (data?.unassigned.repair ?? 0) + (data?.unassigned.install ?? 0);
  const health = criticalTotal === 0 ? { label: "ປົກກະຕິ", detail: "ບໍ່ມີຄິວວິກິດ", tone: "text-emerald-700", ring: "bg-emerald-500" }
    : criticalTotal < 10 ? { label: "ຕ້ອງຕິດຕາມ", detail: `${criticalTotal} ລາຍການສຳຄັນ`, tone: "text-amber-700", ring: "bg-amber-500" }
      : { label: "ຕ້ອງລົງມື", detail: `${criticalTotal} ລາຍການສຳຄັນ`, tone: "text-red-700", ring: "bg-red-500" };
  const quickActions = [
    { label: "ເປີດຮັບເຄື່ອງໃໝ່", href: "/service/new", icon: Plus },
    { label: "ເປີດງານຕິດຕັ້ງ", href: "/installations/new", icon: Plus },
    { label: "ກວດເຊັກ", href: "/checking", icon: ClipboardCheck },
    { label: "ວຽກສ້ອມ", href: "/repair", icon: Wrench },
    { label: "ເບີກອາໄຫຼ່", href: "/stock/dispatch", icon: PackageCheck },
    { label: "ຈັດຊ່າງ", href: "/installations/assign", icon: Users },
  ].filter((item) => canAccess(role, item.href));

  return (
    <div className="w-full space-y-6 pb-6">
      <DashboardAutoRefresh />
      <div className="relative overflow-hidden rounded-2xl bg-slate-950 px-5 py-6 text-white shadow-xl shadow-slate-200 sm:px-7 sm:py-7">
        <div className="pointer-events-none absolute -right-12 -top-24 size-64 rounded-full bg-teal-500/20 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 right-1/3 size-32 rounded-full bg-sky-500/10 blur-2xl" />
        <div className="relative flex flex-wrap items-center justify-between gap-5">
        <div>
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-teal-300">ODIEN Service Operations</p>
          <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">ສູນຄວບຄຸມວຽກ</h1>
          <p className="mt-2 text-xs text-slate-300">
            {ROLE_LABEL[role]}
            {tech ? " · ສະແດງສະເພາະວຽກຂອງທ່ານ" : " · ສະແດງວຽກຄ້າງທັງໝົດ"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] text-slate-400">ອັບເດດ {updatedAt}</span>
          <Link href={`/dashboard?range=${days}`} className="grid size-10 place-items-center rounded-xl border border-white/15 bg-white/10 text-white transition hover:bg-white/20" title="ໂຫຼດຂໍ້ມູນໃໝ່"><RefreshCw className="size-4" /></Link>
          <Link
            href="/dashboard/tracking"
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-4 text-xs font-semibold text-white backdrop-blur transition hover:bg-white/20"
          >
            <Radar className="size-4" /> ຕິດຕາມວຽກ <LinkPending className="size-3.5" />
          </Link>
        </div>
        </div>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className={`mb-3 h-1.5 w-10 rounded-full ${kpi.bg}`} />
            <p className="text-[11px] font-medium text-slate-500">{kpi.label}</p>
            <p className={`mt-1 text-3xl font-bold tracking-tight ${kpi.tone}`}>{kpi.value.toLocaleString()}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.35fr_1fr]">
        <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="pointer-events-none absolute -bottom-16 -right-12 size-40 rounded-full bg-teal-100/70 blur-3xl" />
          <div className="relative flex flex-wrap items-center gap-5">
            <div className={`grid size-16 shrink-0 place-items-center rounded-2xl ${health.ring} text-white shadow-lg shadow-slate-200`}>
              <span className="text-2xl font-black">{criticalTotal}</span>
            </div>
            <div className="min-w-48 flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Operational health</p>
              <h2 className={`mt-1 text-xl font-bold ${health.tone}`}>{health.label}</h2>
              <p className="mt-1 text-xs text-slate-500">{health.detail} · ຄິດຈາກ SLA ຮ້າຍແຮງ, ນັດເລີຍກຳນົດ ແລະວຽກບໍ່ມີຊ່າງ</p>
            </div>
            <Link href="/dashboard/tracking" className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-teal-700">ເບິ່ງພາບລວມ <ArrowRight className="size-3.5" /></Link>
          </div>
        </div>

        {quickActions.length > 0 && <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-3"><h2 className="text-sm font-bold text-slate-800">ທາງລັດປະຈຳວັນ</h2><p className="mt-0.5 text-[11px] text-slate-500">ສະແດງສະເພາະເມນູທີ່ທ່ານມີສິດ</p></div>
          <div className="grid grid-cols-2 gap-2">
            {quickActions.slice(0, 6).map(({ label, href, icon: Icon }) => <Link key={href} href={href} className="group flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2.5 text-xs font-semibold text-slate-700 transition hover:border-teal-200 hover:bg-teal-50 hover:text-teal-800"><span className="grid size-7 place-items-center rounded-lg bg-white text-slate-500 shadow-sm group-hover:text-teal-700"><Icon className="size-3.5" /></span><span className="truncate">{label}</span></Link>)}
          </div>
        </div>}
      </section>

      {data && ["/installations/work", "/checking", "/repair"].some((path) => canAccess(role, path)) && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
            <div><h2 className="text-base font-bold text-slate-900">ວຽກມື້ນີ້</h2><p className="mt-0.5 text-[11px] text-slate-500">ຄິວທີ່ກຳລັງເຮັດ ແລະນັດໝາຍຂອງມື້ນີ້</p></div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {canAccess(role, "/installations/work") && <Link href="/installations/work" className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 transition hover:border-teal-300 hover:bg-teal-50"><p className="text-xs font-semibold text-slate-600">ນັດຕິດຕັ້ງມື້ນີ້</p><p className="mt-1 text-2xl font-bold text-teal-700">{data.today.appointments.toLocaleString()}</p></Link>}
            {canAccess(role, "/checking") && <Link href="/checking" className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 transition hover:border-sky-300 hover:bg-sky-50"><p className="text-xs font-semibold text-slate-600">ກຳລັງກວດເຊັກ</p><p className="mt-1 text-2xl font-bold text-sky-700">{data.today.checking.toLocaleString()}</p></Link>}
            {canAccess(role, "/repair") && <Link href="/repair" className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 transition hover:border-violet-300 hover:bg-violet-50"><p className="text-xs font-semibold text-slate-600">ກຳລັງສ້ອມແປງ</p><p className="mt-1 text-2xl font-bold text-violet-700">{data.today.repairing.toLocaleString()}</p></Link>}
          </div>
          {(data.sla.warning > 0 || data.sla.late > 0) && canAccess(role, "/checking") && <div className="mt-3 flex flex-wrap gap-2 text-[11px]"><Link href="/checking?sla=warning&sort=elapsed&dir=desc" className="rounded-full bg-amber-100 px-2.5 py-1 font-semibold text-amber-800 hover:bg-amber-200">ໃກ້ເກີນ SLA {data.sla.warning}</Link><Link href="/checking?sla=late&sort=elapsed&dir=desc" className="rounded-full bg-red-100 px-2.5 py-1 font-semibold text-red-700 hover:bg-red-200">ເກີນ SLA {data.sla.late}</Link><Link href="/checking?sla=critical&sort=elapsed&dir=desc" className="rounded-full bg-red-700 px-2.5 py-1 font-semibold text-white hover:bg-red-800">ຮ້າຍແຮງ {data.sla.critical}</Link></div>}
        </section>
      )}

      {data && canAccess(role, "/installations/work") && data.upcomingAppointments.length > 0 && (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4">
            <span className="grid size-9 place-items-center rounded-xl bg-teal-50 text-teal-700"><CalendarDays className="size-4" /></span>
            <div className="flex-1"><h2 className="text-sm font-bold text-slate-800">ນັດຕິດຕັ້ງ 7 ມື້ຕໍ່ໜ້າ</h2><p className="text-[11px] text-slate-500">ສະແດງ 12 ນັດທຳອິດ · ປ້າຍແດງແມ່ນຊ່າງມີຫຼາຍກວ່າ 1 ນັດໃນມື້ດຽວ</p></div>
          </div>
          <div className="grid divide-y divide-slate-100 md:grid-cols-2 md:divide-x md:divide-y-0">
            {data.upcomingAppointments.map((item) => (
              <Link key={item.code} href={`/installations/${encodeURIComponent(item.code)}`} className="flex min-w-0 items-center gap-3 border-b border-slate-100 px-5 py-3 transition hover:bg-teal-50/40">
                <div className="w-20 shrink-0 text-center"><p className="text-xs font-bold text-slate-800">{item.appoint_date}</p>{item.same_day_jobs > 1 && <span className="mt-1 inline-block rounded bg-red-100 px-1.5 py-0.5 text-[9px] font-bold text-red-700">ນັດຊ້ອນ {item.same_day_jobs}</span>}</div>
                <div className="min-w-0 flex-1"><p className="truncate text-xs font-bold text-[#0536a9]">{item.code} · {item.customer || "-"}</p><p className="mt-0.5 truncate text-[11px] text-slate-500">{item.product || "-"}</p></div>
                <span className="max-w-24 truncate text-[10px] font-semibold text-slate-500">{item.tech || "ຍັງບໍ່ມີຊ່າງ"}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {error && (
        <p className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          <AlertCircle className="size-4 shrink-0" />
          ບໍ່ສາມາດໂຫຼດຂໍ້ມູນ dashboard ໄດ້
        </p>
      )}

      {/* ① ຕ້ອງລົງມື — ສະເພາະສິ່ງທີ່ຜູ້ນີ້ເຮັດໄດ້ ແລະ ມີຄ້າງຢູ່ຈິງ */}
      {alerts.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-end justify-between gap-3">
            <div><h2 className="text-base font-bold text-slate-900">ວຽກທີ່ຕ້ອງລົງມື</h2><p className="mt-0.5 text-[11px] text-slate-500">ຈັດລຳດັບສິ່ງທີ່ຄວນດຳເນີນການກ່ອນ</p></div>
            <span className="rounded-full bg-slate-900 px-2.5 py-1 text-[10px] font-bold text-white">{alerts.length} ຄິວ</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {alerts.map(({ label, value, detail, href, icon: Icon, tone }) => {
              const t = TONE[tone];
              return (
                <Link
                  key={href}
                  href={href}
                  className={`group relative flex min-h-28 items-center justify-between gap-3 overflow-hidden rounded-2xl border p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${t.card}`}
                >
                  <span className={`absolute inset-y-0 left-0 w-1 ${t.bar}`} />
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-slate-700">{label}</p>
                    <p className={`mt-1 text-3xl font-bold tracking-tight ${t.value}`}>{value.toLocaleString()}</p>
                    {detail && <p className="mt-0.5 truncate text-[11px] text-slate-500">{detail}</p>}
                  </div>
                  <span className={`grid size-11 shrink-0 place-items-center rounded-xl transition group-hover:scale-105 ${t.icon}`}>
                    <Icon className="size-5" />
                  </span>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {!error && alerts.length === 0 && (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-semibold text-emerald-800">
          ບໍ່ມີວຽກຄ້າງທີ່ຕ້ອງລົງມືດຽວນີ້
        </p>
      )}

      {/* ② ຂັ້ນໄດ — ບໍ່ຫຼົ້ນກັນ ລວມກັນໄດ້ຍອດພໍດີ */}
      <section className="grid gap-4 xl:grid-cols-2">
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <Wrench className="size-4 text-slate-400" />
            <h2 className="text-sm font-bold text-slate-700">ຂັ້ນຕອນວຽກສ້ອມແປງ</h2>
            <span className="ml-auto flex items-center gap-1 text-[11px] text-slate-400">
              ຄ້າງດົນສຸດ
              <Elapsed
                seconds={oldestRepair}
                className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${elapsedTone(oldestRepair).chip}`}
              />
            </span>
          </div>
          <Pipeline
            workflow="repair"
            statuses={repairStatuses}
            counts={repair}
            ages={data?.repairAge ?? {}}
            role={role}
          />
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <HardHat className="size-4 text-slate-400" />
            <h2 className="text-sm font-bold text-slate-700">ຂັ້ນຕອນວຽກຕິດຕັ້ງ</h2>
            <span className="ml-auto flex items-center gap-1 text-[11px] text-slate-400">
              ຄ້າງດົນສຸດ
              <Elapsed
                seconds={oldestInstall}
                className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${elapsedTone(oldestInstall).chip}`}
              />
            </span>
          </div>
          <Pipeline
            workflow="install"
            statuses={installStatuses}
            counts={install}
            ages={data?.installAge ?? {}}
            role={role}
          />
        </article>
      </section>

      {/* ພາລະງານຕໍ່ຊ່າງ — ຫົວໜ້າຊ່າງ/ຜູ້ຈັດການ ໃຊ້ແບ່ງງານ */}
      {data && APPROVER_SIDE.includes(role) && <TechLoadPanel rows={data.techLoad} />}

      {/* ຜົນງານ 30 ມື້ — ບອກທິດທາງ ບໍ່ແມ່ນແຕ່ຍອດ */}
      {data && !tech && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-bold text-slate-800">ຜົນງານ {days} ມື້ຜ່ານມາ (ເປີດ ທຽບ ປິດ)</h2>
            <div className="flex overflow-hidden rounded-lg border border-slate-200">
              {[1, 7, 30, 90].map((value) => <Link key={value} href={`/dashboard?range=${value}`} className={`px-2.5 py-1.5 text-[10px] font-semibold ${days === value ? "bg-slate-900 text-white" : "bg-white text-slate-500 hover:bg-slate-50"}`}>{value} ມື້</Link>)}
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <Throughput
              label="ວຽກສ້ອມແປງ"
              opened={data.throughput.repair_opened}
              closed={data.throughput.repair_closed}
            />
            <Throughput
              label="ວຽກຕິດຕັ້ງ"
              opened={data.throughput.install_opened}
              closed={data.throughput.install_closed}
            />
          </div>
          <p className="mt-2 text-[11px] text-slate-400">
            ເລກແດງ (+) = ເປີດຫຼາຍກວ່າປິດ ⇒ ວຽກຄ້າງກຳລັງເພີ່ມ · ເລກຂຽວ (−) = ກຳລັງລົງ
          </p>
        </section>
      )}

      {/* ຄ່າຄອມເດືອນນີ້ — ຊ່າງເຫັນຂອງຕົນ · ຄົນອື່ນເຫັນລວມ */}
      {data && canAccess(role, "/reports/technician-income") && (data.payout.assigned_thb > 0 || data.payout.orphan_thb > 0) && (
        <Link
          href="/reports/technician-income"
          className="flex flex-wrap items-center gap-4 rounded-2xl border border-emerald-200 bg-gradient-to-r from-white to-emerald-50/60 p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
        >
          <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-emerald-50 text-emerald-600">
            <Wallet className="size-5" />
          </span>
          <div className="min-w-48 flex-1">
            <p className="text-sm font-bold text-slate-700">
              {tech ? "ລາຍຮັບຂອງທ່ານ ເດືອນນີ້" : "ຄ່າຄອມຊ່າງ ເດືອນນີ້"}
            </p>
            <p className="mt-0.5 text-[11px] text-slate-500">
              ຈາກ {data.payout.jobs.toLocaleString()} ງານທີ່ປິດ · ຕົວເລກແຊ່ໄວ້ຕອນປິດງານ
            </p>
            {/* ເງິນທີ່ຍັງບໍ່ມີເຈົ້າຂອງ — ບໍ່ຢູ່ໃນຍອດຂວາ ຈຶ່ງຕ້ອງບອກ ບໍ່ດັ່ງນັ້ນຫາຍງຽບໆ */}
            {data.payout.orphan_thb > 0 && (
              <p className="mt-1 text-[11px] font-semibold text-amber-700">
                ⚠ ອີກ {data.payout.orphan_thb.toLocaleString("en-US", { minimumFractionDigits: 2 })} ບາທ
                ຍັງບໍ່ມີເຈົ້າຂອງ (ຊ່າງຍັງບໍ່ເຊື່ອມຕົວຕົນ)
              </p>
            )}
          </div>
          <div className="text-right">
            <p className="text-3xl font-bold text-slate-900">
              {data.payout.assigned_thb.toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </p>
            <p className="text-[11px] text-slate-400">ບາທ</p>
          </div>
        </Link>
      )}

      {/* ③ ແບບປະເມີນລູກຄ້າ — ມາດຕາສ່ວນກັບຫົວ (1 ດີສຸດ) ຈຶ່ງຕ້ອງບອກໃຫ້ຊັດທຸກບ່ອນ */}
      {data && score != null && <FeedbackPanel data={data} score={score} />}

      {/* ④ ວຽກທີ່ຖືກລືມ — ຄ້າງດົນສຸດ (ບໍ່ແມ່ນ "ລ່າສຸດ" ເຊິ່ງແມ່ນວຽກທີ່ດ່ວນນ້ອຍທີ່ສຸດ) */}
      <section className="grid gap-4 xl:grid-cols-2">
        <StaleTable
          title="ວຽກສ້ອມແປງທີ່ຄ້າງດົນສຸດ"
          rows={data?.staleRepairs ?? []}
          whoLabel="ຊ່າງ"
          hrefOf={(code) => `/service/${encodeURIComponent(code)}`}
        />
        <StaleTable
          title="ວຽກຕິດຕັ້ງທີ່ຄ້າງດົນສຸດ"
          rows={data?.staleInstalls ?? []}
          whoLabel="ຊ່າງ"
          hrefOf={(code) => `/installations/${encodeURIComponent(code)}`}
        />
      </section>

      {/* ⑤ ສ້ອມຊ້ຳ — ເຄື່ອງໜ່ວຍດຽວກັນກັບມາພາຍໃນ 30 ມື້ = ຄັ້ງກ່ອນສ້ອມບໍ່ຈົບ */}
      {(data?.repeats.length ?? 0) > 0 && <RepeatPanel rows={data!.repeats} />}

      <p className="text-center text-[11px] text-slate-400">
        ຕົວເລກທຸກຊ່ອງໃຊ້ເງື່ອນໄຂອັນດຽວກັນກັບໜ້າປາຍທາງ — ກົດເບິ່ງໄດ້ວ່າແມ່ນວຽກໃດແດ່
      </p>
    </div>
  );
}
