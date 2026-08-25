import { LinkPending } from "@/components/link-pending";
import { countBy, defaultFromIso, ReportShell, reportState } from "@/components/report-shell";
import { columns, fetchInstallations, one, safeDate, toTableColumns, todayIso, type Row, type SearchParams } from "@/lib/report-sql";
import { Eye, Printer } from "lucide-react";
import Link from "next/link";

/* ods: /install_pending + /install_allpd — home.py (excel: /report_pd_install) */
export default async function InstallationsReport({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const all = one(params.all) === "1";
  const from = safeDate(one(params.from), defaultFromIso());
  const to = safeDate(one(params.to), todayIso());
  const state = reportState(params);

  let rows: Row[] = [];
  let error: string | null = null;
  try {
    rows = await fetchInstallations(from, to, all);
  } catch (exception) {
    error = exception instanceof Error ? exception.message : "ດຶງຂໍ້ມູນບໍ່ສຳເລັດ";
  }

  return (
    <ReportShell
      title="ລາຍງານການຕິດຕັ້ງ"
      subtitle={all ? "ທັງໝົດ" : `ແຕ່ວັນທີ ${from} ຫາ ${to}`}
      basePath="/reports/installations"
      query={all ? { all: "1" } : { from, to }}
      omitFromForm={["all"]}
      state={state}
      dateRange={{ from, to }}
      columns={toTableColumns(columns.installations)}
      rows={rows}
      error={error}
      /* ສະຫຼຸບຕາມສະຖານະງານຕິດຕັ້ງ — ນັບຈາກແຖວຊຸດດຽວກັນກັບຕາຕະລາງ */
      summary={countBy(rows, "status_name")}
      // ຢູ່ໂໝດ "ສະແດງທັງໝົດ" ຕ້ອງສົ່ງ all=1 ໄປນຳ ບໍ່ດັ່ງນັ້ນ Excel ຈະໄດ້ແຕ່ຊ່ວງວັນທີ
      // ທັງທີ່ໜ້າຈໍສະແດງທຸກແຖວ (ຄືກັບ /reports/customer-feedback)
      exportHref={
        all ? "/api/reports/export/installations?all=1" : `/api/reports/export/installations?from=${from}&to=${to}`
      }
      minWidth={2800}
      searchPlaceholder="ຄົ້ນຫາ ລະຫັດຕິດຕັ້ງ, ລູກຄ້າ, ເບີໂທ, ເລກບີນ, SN, ຊ່າງ..."
      /**
       * ຈາກລາຍງານ ໄປໃບງານໄດ້ໂດຍບໍ່ຕ້ອງໄປຄົ້ນຫາຢູ່ໜ້າ /installations ຄືນ:
       *   ຕາ = ລາຍລະອຽດໃບງານ (ອ່ານ + chatter) · ເຄື່ອງພິມ = ໃບງານສຳລັບພິມ (ແທັບໃໝ່)
       * ສອງໜ້ານີ້ເປີດໄດ້ທຸກ role ທີ່ login (lib/roles: ກົດ "/installations/[code]" ແລະ
       * ໜ້າພິມຂອງມັນ ເປັນ EVERYONE) ⇒ ບໍ່ຕ້ອງກວດສິດຊ້ຳຢູ່ນີ້.
       */
      rowActionsLabel="ໃບງານ"
      rowActions={(row) => {
        const code = String(row.code ?? "");
        if (!code || code === "-") return null;
        return (
          <>
            <Link
              href={`/installations/${encodeURIComponent(code)}`}
              title="ເບິ່ງລາຍລະອຽດໃບງານ"
              aria-label="ເບິ່ງລາຍລະອຽດໃບງານ"
              className="grid size-8 place-items-center rounded-lg border border-slate-300 bg-white text-brand-700 transition hover:bg-brand-50"
            >
              <Eye className="size-3.5" />
            </Link>
            <Link
              href={`/installations/${encodeURIComponent(code)}/print`}
              target="_blank"
              title="ພິມໃບງານ"
              aria-label="ພິມໃບງານ"
              className="grid size-8 place-items-center rounded-lg border border-slate-300 bg-white text-[#f6921e] transition hover:bg-brand-orange-50"
            >
              <Printer className="size-3.5" />
            </Link>
          </>
        );
      }}
      actions={
        <Link
          href={all ? `/reports/installations?${new URLSearchParams({ from, to })}` : "/reports/installations?all=1"}
          className={`inline-flex h-9 items-center gap-2 rounded-lg px-3 text-xs font-medium ${
            all ? "bg-brand-500 text-white hover:bg-brand-500" : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
          }`}
        >
          ສະແດງທັງໝົດ
          <LinkPending className="size-3" />
        </Link>
      }
    />
  );
}
