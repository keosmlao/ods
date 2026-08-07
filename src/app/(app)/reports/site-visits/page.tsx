import { PageTitle } from "@/components/ui";
import { query } from "@/lib/db";
import { requireRoleOrRedirect } from "@/lib/guard";
import { MONITOR_SIDE } from "@/lib/roles";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, LogIn } from "lucide-react";

/**
 * **ລາຍງານ ຮອບເຂົ້າໜ້າງານ (check-in / check-out)** — 07-08-2026.
 *
 * ── ເປັນຫຍັງຕ້ອງມີ ──
 * ກົດເກນຄື "ທຸກຄັ້ງທີ່ຊ່າງເຂົ້າໜ້າງານ ຕ້ອງມີ check-in ແລະ check-out ຄົບຄູ່" —
 * ດ່ານຢູ່ຕອນລົງມື (ເບິ່ງ lib/job-flow) ກັນໄວ້ແລ້ວ ແຕ່ **ບໍ່ມີບ່ອນເບິ່ງວ່າຄົບຫຼືບໍ່**
 * ⇒ ຫົວໜ້າຮູ້ບໍ່ໄດ້ວ່າມີຮອບໃດຄ້າງ ຫຼື ງານໃດຈົບໄປໂດຍບໍ່ມີຫຼັກຖານ.
 *
 * ໜ້ານີ້ຕອບ 3 ຄຳຖາມ:
 *   ① **ຍັງຢູ່ໜ້າງານ** — check-in ແລ້ວຍັງບໍ່ check-out (ຄ້າງເປີດ)
 *   ② **ຈົບງານໂດຍບໍ່ມີຮອບ** — ງານໜ້າງານທີ່ປິດແລ້ວ ແຕ່ບໍ່ມີ check-in ຈັກແຖວ
 *   ③ ຮອບຫຼ້າສຸດທັງໝົດ — ໃຜ ໄປໃສ ດົນເທົ່າໃດ
 */
export const dynamic = "force-dynamic";

type OpenRow = {
  workflow: string;
  job_code: string;
  tech_code: string | null;
  checkin_at: string;
  hours: number;
};

type MissingRow = {
  workflow: string;
  job_code: string;
  tech_code: string | null;
  finished_at: string | null;
};

type RecentRow = {
  workflow: string;
  job_code: string;
  tech_code: string | null;
  checkin_at: string;
  checkout_at: string | null;
  minutes: number | null;
};

const jobHref = (workflow: string, code: string) =>
  workflow === "install" ? `/installations/${encodeURIComponent(code)}` : `/service/${encodeURIComponent(code)}`;

export default async function SiteVisitsReport() {
  await requireRoleOrRedirect(MONITOR_SIDE);

  const [open, missing, recent] = await Promise.all([
    // ① ຮອບທີ່ຍັງເປີດຄ້າງ — ຍິ່ງດົນຍິ່ງໜ້າສົງໄສ (ລືມກົດ ຫຼື ອອກໄປແລ້ວ)
    query<OpenRow>(
      `select workflow, job_code, nullif(tech_code,'') tech_code,
          to_char(checkin_at,'DD-MM-YYYY HH24:MI') checkin_at,
          round(extract(epoch from (localtimestamp - checkin_at)) / 3600)::int hours
        from ods_job_checkin
       where checkout_at is null
       order by checkin_at`,
    ),
    /**
     * ② ງານ**ໜ້າງານ**ທີ່ຈົບແລ້ວ ແຕ່ບໍ່ມີ check-in ຈັກແຖວ.
     * ຕິດຕັ້ງ = ໜ້າງານສະເໝີ · ສ້ອມ = **ສະເພາະ IH** (PS ໄປຮັບເຄື່ອງມາສ້ອມສູນ ⇒ ບໍ່ນັບ).
     * ຈຳກັດ 90 ມື້ — ກ່ອນໜ້ານັ້ນຍັງບໍ່ມີກົດເກນນີ້ ⇒ ຂຶ້ນມາກໍ່ບໍ່ມີປະໂຫຍດ.
     */
    query<MissingRow>(
      `select 'install' workflow, a.code job_code, nullif(a.tech_code,'') tech_code,
          to_char(a.finish_install,'DD-MM-YYYY HH24:MI') finished_at
         from ods_tb_install a
        where a.finish_install is not null and a.cancel_date is null
          and a.finish_install >= localtimestamp - interval '90 days'
          and not exists (select 1 from ods_job_checkin k
                           where k.workflow='install' and k.job_code=a.code)
        union all
       select 'repair', a.code, nullif(a.emp_code,''),
          to_char(a.time_finish_repair,'DD-MM-YYYY HH24:MI')
         from tb_product a
        where a.time_finish_repair is not null and a.status <> 6
          and coalesce(a.service_type,'') = 'IH'
          and a.time_finish_repair >= localtimestamp - interval '90 days'
          and not exists (select 1 from ods_job_checkin k
                           where k.workflow='repair' and k.job_code=a.code)
        order by finished_at desc nulls last
        limit 100`,
    ),
    // ③ ຮອບຫຼ້າສຸດ — ໃຫ້ເຫັນວ່າລະບົບເກັບຫຼັກຖານໄດ້ຈິງ
    query<RecentRow>(
      `select workflow, job_code, nullif(tech_code,'') tech_code,
          to_char(checkin_at,'DD-MM-YYYY HH24:MI') checkin_at,
          to_char(checkout_at,'DD-MM-YYYY HH24:MI') checkout_at,
          case when checkout_at is null then null
               else round(extract(epoch from (checkout_at - checkin_at)) / 60)::int end minutes
        from ods_job_checkin
       order by id desc
       limit 50`,
    ),
  ]);

  return (
    <div className="w-full space-y-5">
      <PageTitle sub="ທຸກຄັ້ງທີ່ຊ່າງເຂົ້າໜ້າງານ ຕ້ອງມີ check-in ແລະ check-out ຄົບຄູ່">
        ຮອບເຂົ້າໜ້າງານ (check-in / check-out)
      </PageTitle>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-brand-orange-300 bg-brand-orange-50 p-4">
          <p className="text-2xl font-bold tabular-nums text-brand-orange-700">{open.rows.length}</p>
          <p className="text-xs font-semibold text-brand-orange-700">ຍັງຢູ່ໜ້າງານ (ບໍ່ໄດ້ check-out)</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-2xl font-bold tabular-nums text-slate-700">{missing.rows.length}</p>
          <p className="text-xs font-semibold text-slate-500">ຈົບງານໂດຍບໍ່ມີຮອບ (90 ມື້)</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-2xl font-bold tabular-nums text-brand-800">{recent.rows.length}</p>
          <p className="text-xs font-semibold text-slate-500">ຮອບຫຼ້າສຸດທີ່ບັນທຶກໄວ້</p>
        </div>
      </div>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <h2 className="flex items-center gap-2 border-b border-slate-100 px-4 py-2.5 text-sm font-bold text-brand-orange-700">
          <LogIn className="size-4" /> ຍັງຢູ່ໜ້າງານ — check-in ແລ້ວຍັງບໍ່ອອກ
        </h2>
        {open.rows.length === 0 ? (
          <p className="px-4 py-6 text-center text-xs text-slate-400">ບໍ່ມີຮອບຄ້າງ — ຄົບຄູ່ໝົດ ✓</p>
        ) : (
          <table className="w-full text-xs">
            <thead className="bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="px-4 py-2 font-semibold">ໃບງານ</th>
                <th className="px-3 py-2 font-semibold">ຊ່າງ</th>
                <th className="px-3 py-2 font-semibold">ເຂົ້າເມື່ອ</th>
                <th className="px-3 py-2 font-semibold">ຄ້າງມາ</th>
              </tr>
            </thead>
            <tbody>
              {open.rows.map((row) => (
                <tr key={`${row.workflow}-${row.job_code}-${row.checkin_at}`} className="border-t border-slate-100">
                  <td className="px-4 py-2">
                    <Link href={jobHref(row.workflow, row.job_code)} className="font-bold text-brand-700 hover:underline">
                      {row.job_code}
                    </Link>
                    <span className="ml-1 text-[10px] text-slate-400">
                      {row.workflow === "install" ? "ຕິດຕັ້ງ" : "ສ້ອມ"}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-slate-600">{row.tech_code ?? "-"}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-slate-600">{row.checkin_at}</td>
                  <td className="whitespace-nowrap px-3 py-2">
                    <span
                      className={`rounded px-1.5 py-0.5 font-bold tabular-nums ${
                        row.hours >= 12
                          ? "bg-brand-orange-100 text-brand-orange-700"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {row.hours} ຊມ
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <h2 className="flex items-center gap-2 border-b border-slate-100 px-4 py-2.5 text-sm font-bold text-slate-700">
          <AlertTriangle className="size-4" /> ຈົບງານໜ້າງານໂດຍບໍ່ມີ check-in (90 ມື້)
        </h2>
        {missing.rows.length === 0 ? (
          <p className="px-4 py-6 text-center text-xs text-slate-400">ບໍ່ມີ — ທຸກງານມີຫຼັກຖານຄົບ ✓</p>
        ) : (
          <table className="w-full text-xs">
            <thead className="bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="px-4 py-2 font-semibold">ໃບງານ</th>
                <th className="px-3 py-2 font-semibold">ຊ່າງ</th>
                <th className="px-3 py-2 font-semibold">ຈົບເມື່ອ</th>
              </tr>
            </thead>
            <tbody>
              {missing.rows.map((row) => (
                <tr key={`${row.workflow}-${row.job_code}`} className="border-t border-slate-100">
                  <td className="px-4 py-2">
                    <Link href={jobHref(row.workflow, row.job_code)} className="font-bold text-brand-700 hover:underline">
                      {row.job_code}
                    </Link>
                    <span className="ml-1 text-[10px] text-slate-400">
                      {row.workflow === "install" ? "ຕິດຕັ້ງ" : "ສ້ອມ"}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-slate-600">{row.tech_code ?? "-"}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-slate-600">{row.finished_at ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <h2 className="flex items-center gap-2 border-b border-slate-100 px-4 py-2.5 text-sm font-bold text-brand-800">
          <CheckCircle2 className="size-4" /> ຮອບຫຼ້າສຸດ
        </h2>
        {recent.rows.length === 0 ? (
          <p className="px-4 py-6 text-center text-xs text-slate-400">ຍັງບໍ່ມີການ check-in</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-xs">
              <thead className="bg-slate-50 text-left text-slate-500">
                <tr>
                  <th className="px-4 py-2 font-semibold">ໃບງານ</th>
                  <th className="px-3 py-2 font-semibold">ຊ່າງ</th>
                  <th className="px-3 py-2 font-semibold">ເຂົ້າ</th>
                  <th className="px-3 py-2 font-semibold">ອອກ</th>
                  <th className="px-3 py-2 font-semibold">ໃຊ້ເວລາ</th>
                </tr>
              </thead>
              <tbody>
                {recent.rows.map((row, index) => (
                  <tr key={`${row.job_code}-${index}`} className="border-t border-slate-100">
                    <td className="px-4 py-2">
                      <Link href={jobHref(row.workflow, row.job_code)} className="font-bold text-brand-700 hover:underline">
                        {row.job_code}
                      </Link>
                      <span className="ml-1 text-[10px] text-slate-400">
                        {row.workflow === "install" ? "ຕິດຕັ້ງ" : "ສ້ອມ"}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-slate-600">{row.tech_code ?? "-"}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-slate-600">{row.checkin_at}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-slate-600">
                      {row.checkout_at ?? <span className="font-semibold text-brand-orange-700">ຍັງຢູ່ໜ້າງານ</span>}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 tabular-nums text-slate-600">
                      {row.minutes == null ? "-" : `${Math.floor(row.minutes / 60)} ຊມ ${row.minutes % 60} ນທ`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
