import { Elapsed } from "@/components/elapsed";
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
import { APPROVER_SIDE, canAccess, ROLE_LABEL, type Role, roleOf } from "@/lib/roles";
import { ownJobsOnly } from "@/lib/scope";
import {
  AlertCircle,
  Ban,
  CalendarClock,
  ClipboardCheck,
  HardHat,
  PackageCheck,
  PackageOpen,
  PackageX,
  Radar,
  ShoppingCart,
  Smile,
  Timer,
  TrendingDown,
  TrendingUp,
  Truck,
  UserCheck,
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
  red: { card: "border-red-300 bg-red-50", icon: "bg-red-100 text-red-600", value: "text-red-700" },
  amber: { card: "border-amber-300 bg-amber-50", icon: "bg-amber-100 text-amber-700", value: "text-amber-800" },
};

function alertsFor(role: Role, data: DashboardData): Alert[] {
  const all: Alert[] = [
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
    <article className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <h2 className="border-b border-slate-100 px-4 py-2.5 text-sm font-bold text-slate-700">{title}</h2>
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
                <tr key={row.code} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
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
    <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2">
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
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
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

/* ── ໜ້າ ─────────────────────────────────────────────────────── */

export default async function Dashboard() {
  const session = await getSession();
  const role = roleOf(session);
  // ຊ່າງເຫັນສະເພາະວຽກຂອງຕົນ — ກົດເກນອັນດຽວກັບທຸກໜ້າ (lib/scope)
  const tech = ownJobsOnly(session);

  const { data, error } = await getDashboard(tech);
  const repair: Counts = data?.repair ?? {};
  const install: Counts = data?.install ?? {};
  const alerts = data ? alertsFor(role, data) : [];

  const score = data?.feedback.avg_points ?? null;
  const oldestRepair = data?.oldest.repair_seconds ?? 0;
  const oldestInstall = data?.oldest.install_seconds ?? 0;

  return (
    <div className="w-full space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-700">ໜ້າລວມ</h1>
          <p className="mt-0.5 text-xs text-slate-500">
            {ROLE_LABEL[role]}
            {tech ? " · ສະແດງສະເພາະວຽກຂອງທ່ານ" : " · ສະແດງວຽກຄ້າງທັງໝົດ"}
          </p>
        </div>
        <Link
          href="/dashboard/tracking"
          className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50"
        >
          <Radar className="size-4" />
          ຕິດຕາມວຽກ
          <LinkPending className="size-3.5" />
        </Link>
      </div>

      {error && (
        <p className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          <AlertCircle className="size-4 shrink-0" />
          ບໍ່ສາມາດໂຫຼດຂໍ້ມູນ dashboard ໄດ້
        </p>
      )}

      {/* ① ຕ້ອງລົງມື — ສະເພາະສິ່ງທີ່ຜູ້ນີ້ເຮັດໄດ້ ແລະ ມີຄ້າງຢູ່ຈິງ */}
      {alerts.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-bold text-slate-700">ຕ້ອງລົງມື</h2>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {alerts.map(({ label, value, detail, href, icon: Icon, tone }) => {
              const t = TONE[tone];
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center justify-between gap-3 rounded-xl border p-3.5 shadow-sm transition hover:shadow ${t.card}`}
                >
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-slate-700">{label}</p>
                    <p className={`mt-0.5 text-2xl font-bold ${t.value}`}>{value.toLocaleString()}</p>
                    {detail && <p className="mt-0.5 truncate text-[11px] text-slate-500">{detail}</p>}
                  </div>
                  <span className={`grid size-9 shrink-0 place-items-center rounded-lg ${t.icon}`}>
                    <Icon className="size-4" />
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
        <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
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

        <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
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
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-bold text-slate-700">ຜົນງານ 30 ມື້ຜ່ານມາ (ເປີດ ທຽບ ປິດ)</h2>
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

      {/* ③ ຄະແນນລູກຄ້າ — ມາດຕາສ່ວນກັບຫົວ (1 ດີສຸດ) ຈຶ່ງຕ້ອງບອກໃຫ້ຊັດ */}
      {score != null && (
        <section className="flex flex-wrap items-center gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-teal-50 text-teal-600">
            <Smile className="size-5" />
          </span>
          <div className="min-w-48 flex-1">
            <p className="text-sm font-bold text-slate-700">ຄະແນນແບບສອບຖາມລູກຄ້າ (ງານຕິດຕັ້ງ)</p>
            <p className="mt-0.5 text-[11px] text-slate-500">
              ຈາກ {(data?.feedback.jobs ?? 0).toLocaleString()} ງານ ·{" "}
              <b className="text-slate-700">1 = ດີສຸດ · 4 = ແຍ່ສຸດ</b> (ຕໍ່າກວ່າ = ດີກວ່າ)
            </p>
          </div>
          <div className="text-right">
            <p className={`text-3xl font-bold ${score <= 2 ? "text-emerald-600" : "text-red-600"}`}>
              {score.toFixed(2)}
            </p>
            <p className="text-[11px] text-slate-400">{score <= 2 ? "ດີ" : "ຄວນປັບປຸງ"}</p>
          </div>
        </section>
      )}

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

      <p className="text-center text-[11px] text-slate-400">
        ຕົວເລກທຸກຊ່ອງໃຊ້ເງື່ອນໄຂອັນດຽວກັນກັບໜ້າປາຍທາງ — ກົດເບິ່ງໄດ້ວ່າແມ່ນວຽກໃດແດ່
      </p>
    </div>
  );
}
