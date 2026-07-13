import { Card, Empty, PageTitle, Table } from "@/components/ui";
import { installKpi, repairKpi, technicianKpi, type FlowKpi, type Period } from "@/lib/kpi";
import { HardHat, TrendingUp, TriangleAlert, Wrench } from "lucide-react";
import Link from "next/link";

/**
 * **KPI ປະສິດທິພາບ — ຕິດຕັ້ງ ແລະ ສ້ອມແປງ.**
 *
 * ຕອບ 3 ຄຳຖາມທີ່ຜູ້ຈັດການຖາມແທ້ໆ:
 *   ① ງານໄຫຼໄດ້ດີບໍ (ຮັບເຂົ້າ vs ປິດໄດ້ · ຄ້າງດຽວນີ້ · ເກີນກຳນົດ)
 *   ② **ຄ້າງຢູ່ຂັ້ນໃດ** — ເວລາຕໍ່ຂັ້ນ (ຂັ້ນທີ່ຍາວສຸດ = ຄໍຂວດ ⇒ ແກ້ບ່ອນນັ້ນຈຶ່ງໄດ້ຜົນ)
 *   ③ ໃຜເຮັດໄດ້ເທົ່າໃດ (ຕໍ່ຊ່າງ)
 *
 * ໃຊ້ **ມັດທະຍົມ** ບໍ່ແມ່ນຄ່າສະເລ່ຍ (ງານຄ້າງ 3 ເດືອນ 1 ງານ ດຶງຄ່າສະເລ່ຍໃຫ້ຜິດຮູບ)
 * ແລະ ສະແດງ p90 ຄູ່ກັນ — "ງານຊ້າສຸດ 10% ໃຊ້ເວລາເທົ່າໃດ".
 */
export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ d?: string }> };

const PERIODS: Period[] = [30, 90, 180, 365];

/** ຊົ່ວໂມງ → ຂໍ້ຄວາມທີ່ຄົນອ່ານອອກ (48.5 ຊມ = 2 ມື້ 0.5 ຊມ) */
function hours(value: number): string {
  if (!value || value <= 0) return "-";
  if (value < 24) return `${value} ຊມ`;
  const days = Math.floor(value / 24);
  const rest = Math.round(value - days * 24);
  return rest > 0 ? `${days} ມື້ ${rest} ຊມ` : `${days} ມື້`;
}

export default async function KpiPage({ searchParams }: Props) {
  const params = await searchParams;
  const days = (PERIODS.includes(Number(params.d) as Period) ? Number(params.d) : 90) as Period;

  const [install, repair, techs] = await Promise.all([installKpi(days), repairKpi(days), technicianKpi(days)]);

  return (
    <div className="w-full space-y-5">
      <PageTitle sub="ງານໄຫຼໄດ້ດີບໍ · ຄ້າງຢູ່ຂັ້ນໃດ · ໃຜເຮັດໄດ້ເທົ່າໃດ">KPI ປະສິດທິພາບ</PageTitle>

      {/* ໄລຍະທີ່ເບິ່ງ */}
      <div className="flex flex-wrap items-center gap-1">
        {PERIODS.map((period) => (
          <Link
            key={period}
            href={`/reports/kpi?d=${period}`}
            className={`inline-flex h-9 items-center rounded-lg px-3 text-xs font-semibold transition ${
              days === period ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            {period} ມື້
          </Link>
        ))}
        <span className="ml-2 text-[11px] text-slate-400">ນັບຈາກງານທີ່ **ປິດ** ໃນໄລຍະນີ້</span>
      </div>

      <Flow title="ຕິດຕັ້ງ" icon={<HardHat className="size-4 text-teal-600" />} kpi={install} overdueLabel="ເລີຍວັນນັດ" />
      <Flow
        title="ສ້ອມແປງ"
        icon={<Wrench className="size-4 text-teal-600" />}
        kpi={repair}
        overdueLabel="ເກີນກຳນົດກວດເຊັກ (SLA)"
      />

      {/* ③ ຕໍ່ຊ່າງ */}
      <Card
        title={
          <span className="inline-flex items-center gap-2">
            <TrendingUp className="size-4 text-teal-600" />
            ຜົນງານຕໍ່ຊ່າງ ({days} ມື້)
          </span>
        }
      >
        {techs.length === 0 ? (
          <Empty>ບໍ່ມີງານທີ່ຈົບໃນໄລຍະນີ້</Empty>
        ) : (
          <Table head={["ຊ່າງ", "ຕິດຕັ້ງ", "ສ້ອມ", "ລວມ", "ເວລາຕໍ່ງານ (ມັດທະຍົມ)", "ປະຕິເສດງານ", "QC ບໍ່ຜ່ານ"]} minWidth={800}>
            {techs.map((tech) => (
              <tr key={tech.tech} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="whitespace-nowrap px-3 py-2.5 font-semibold text-slate-800">{tech.tech}</td>
                <td className="px-3 py-2.5 text-center tabular-nums">{tech.install_done}</td>
                <td className="px-3 py-2.5 text-center tabular-nums">{tech.repair_done}</td>
                <td className="px-3 py-2.5 text-center font-bold tabular-nums text-slate-800">
                  {tech.install_done + tech.repair_done}
                </td>
                <td className="px-3 py-2.5 text-center text-slate-600">{hours(tech.median_hours)}</td>
                <td className="px-3 py-2.5 text-center tabular-nums">
                  {/* ປະຕິເສດຫຼາຍ = ຈັດງານບໍ່ຕົງຄົນ ຫຼື ຊ່າງເລືອກງານ ⇒ ຄວນຖາມ */}
                  <span className={tech.rejects > 0 ? "font-bold text-amber-700" : "text-slate-400"}>
                    {tech.rejects}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-center tabular-nums">
                  <span className={tech.qc_failed > 0 ? "font-bold text-red-600" : "text-slate-400"}>
                    {tech.qc_failed}
                  </span>
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </div>
  );
}

/** ໜຶ່ງສາຍງານ: ຕົວເລກລວມ + ເວລາຕໍ່ຂັ້ນ (ຄໍຂວດຂຶ້ນສີ) */
function Flow({
  title,
  icon,
  kpi,
  overdueLabel,
}: {
  title: string;
  icon: React.ReactNode;
  kpi: FlowKpi;
  overdueLabel: string;
}) {
  // ຂັ້ນທີ່ກິນເວລາຫຼາຍສຸດ = ຄໍຂວດ — ແກ້ຂັ້ນອື່ນໄປກໍ່ບໍ່ຊ່ວຍ
  const worst = kpi.stages.reduce((left, right) => (right.median > left.median ? right : left), kpi.stages[0]);
  const max = Math.max(...kpi.stages.map((stage) => stage.median), 1);

  return (
    <Card title={<span className="inline-flex items-center gap-2">{icon} {title}</span>}>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Stat label="ຮັບເຂົ້າ" value={kpi.opened} />
        <Stat label="ປິດໄດ້" value={kpi.closed} tone="good" />
        <Stat label="ຄ້າງດຽວນີ້" value={kpi.open_now} />
        <Stat label={overdueLabel} value={kpi.overdue} tone={kpi.overdue > 0 ? "bad" : "plain"} />
        <Stat label="ເວລາຕໍ່ງານ" text={hours(kpi.total.median)} note={`ຊ້າສຸດ 10%: ${hours(kpi.total.p90)}`} />
      </div>

      {/* ເວລາຕໍ່ຂັ້ນ — ອັນຍາວສຸດຄືບ່ອນທີ່ຕ້ອງແກ້ */}
      <div className="mt-4 space-y-2">
        <p className="text-xs font-semibold text-slate-500">
          ເວລາຕໍ່ຂັ້ນ (ມັດທະຍົມ) — ຂັ້ນທີ່ຍາວສຸດຄື <b className="text-red-600">ຄໍຂວດ</b>
        </p>
        {kpi.stages.map((stage) => {
          const bottleneck = stage.label === worst?.label && stage.median > 0;
          return (
            <div key={stage.label} className="flex items-center gap-3">
              <span className="w-56 shrink-0 truncate text-xs text-slate-600">{stage.label}</span>
              <span className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                <span
                  className={`block h-full rounded-full ${bottleneck ? "bg-red-500" : "bg-teal-500"}`}
                  style={{ width: `${Math.max(2, Math.round((stage.median / max) * 100))}%` }}
                />
              </span>
              <span
                className={`w-32 shrink-0 text-right text-xs tabular-nums ${
                  bottleneck ? "font-bold text-red-600" : "text-slate-600"
                }`}
              >
                {hours(stage.median)}
                <span className="ml-1 text-[10px] font-normal text-slate-400">p90 {hours(stage.p90)}</span>
              </span>
            </div>
          );
        })}
        {worst && worst.median > 0 && (
          <p className="flex items-center gap-1.5 rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
            <TriangleAlert className="size-3.5" />
            ຄໍຂວດ: <b>{worst.label}</b> — {hours(worst.median)} ຕໍ່ງານ (ຈາກທັງໝົດ {hours(kpi.total.median)})
          </p>
        )}
      </div>
    </Card>
  );
}

function Stat({
  label,
  value,
  text,
  note,
  tone = "plain",
}: {
  label: string;
  value?: number;
  text?: string;
  note?: string;
  tone?: "good" | "bad" | "plain";
}) {
  const color =
    tone === "good"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : tone === "bad"
        ? "border-red-200 bg-red-50 text-red-700"
        : "border-slate-200 bg-white text-slate-700";
  return (
    <div className={`rounded-xl border p-3 ${color}`}>
      <p className="text-xs font-semibold opacity-80">{label}</p>
      <p className="mt-1 text-xl font-bold tabular-nums">{text ?? (value ?? 0).toLocaleString()}</p>
      {note && <p className="text-[10px] opacity-70">{note}</p>}
    </div>
  );
}
