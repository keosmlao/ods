import { Card, Empty, PageTitle } from "@/components/ui";
import { getSession } from "@/lib/auth";
import { query } from "@/lib/db";
import { INSTALL_STAGE_LABEL_SQL, INSTALL_STAGE_SQL } from "@/lib/install-stage";
import { STAGE_LABEL_SQL, STAGE_SQL } from "@/lib/stage";
import { roleOf } from "@/lib/roles";
import { ownJobsOnly } from "@/lib/scope";
import { CalendarDays, ChevronLeft, ChevronRight, MapPin, Phone, UserRound } from "lucide-react";
import Link from "next/link";

/**
 * ຄິວງານຊ່າງປະຈຳວັນ — "ມື້ນີ້ ຊ່າງແຕ່ລະຄົນຕ້ອງໄປໃສແດ່".
 *
 * ── ເປັນຫຍັງຕ້ອງມີ ──
 * ວັນນັດ (appoint_date) ຖືກເກັບມາຕະຫຼອດ ແຕ່ **ບໍ່ມີໜ້າໃດສະແດງເປັນມື້**:
 * /installations/assign ເບິ່ງເປັນລາຍການ · /installations/work ເບິ່ງເປັນຄິວຂອງຊ່າງຄົນດຽວ
 * ⇒ ຜູ້ຈັດງານບໍ່ເຫັນພາບວ່າມື້ນຶ່ງຊ່າງຄົນນຶ່ງຖືກນັດໄວ້ຈັກບ່ອນ ແລະ ຈັດຊ້ອນກັນຫຼືບໍ່.
 *
 * ຂັ້ນ ແລະ ຊື່ຂັ້ນ ມາຈາກຂັ້ນໄດບ່ອນດຽວ (lib/install-stage) ⇒ ບໍ່ຫຼົ້ນກັບໜ້າອື່ນ.
 * ຊ່າງເປີດໜ້ານີ້ໄດ້ ແຕ່ເຫັນສະເພາະງານຂອງຕົນ (ownJobsOnly ຄືທຸກໜ້າ).
 */
export const dynamic = "force-dynamic";

type Row = {
  /** ຄິວມື້ນຶ່ງຂອງຊ່າງ **ປົນສອງຝັ່ງ** — ຕິດຕັ້ງ ແລະ ສ້ອມ (ຄົນດຽວກັນຮັບທັງສອງ) */
  workflow: "install" | "repair";
  code: string;
  tech: string | null;
  customer: string | null;
  tel: string | null;
  location: string | null;
  item: string | null;
  stage: number;
  stage_label: string;
  remark: string | null;
  lat: number | null;
  lng: number | null;
};

type Props = { searchParams: Promise<{ d?: string }> };

const ISO = /^\d{4}-\d{2}-\d{2}$/;

const shift = (iso: string, days: number) => {
  const date = new Date(`${iso}T00:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
};

export default async function SchedulePage({ searchParams }: Props) {
  const params = await searchParams;
  const today = new Date().toISOString().slice(0, 10);
  const day = ISO.test(params.d ?? "") ? params.d! : today;

  const session = await getSession();
  const tech = ownJobsOnly(session); // ຊ່າງເຫັນສະເພາະຂອງຕົນ

  const rows = (
    await query<Row>(
      `select 'install' as workflow, a.code,
          nullif(a.tech_code,'') as tech,
          c.name_1 as customer, c.tel,
          coalesce(nullif(a.location_inst,''), c.address) as location,
          a.item_name as item,
          (${INSTALL_STAGE_SQL}) as stage,
          (${INSTALL_STAGE_LABEL_SQL}) as stage_label,
          nullif(a.remark,'') as remark,
          a.location_lat as lat, a.location_lng as lng
        from ods_tb_install a
        left join ar_customer c on c.code = a.cust_code
       where a.appoint_date = $1::date
         and a.cancel_date is null
         and a.job_finish is null
         ${tech ? "and a.tech_code = $2" : ""}

       union all

       -- ງານສ້ອມນັດວັນໄດ້ແລ້ວ (tb_product.appoint_date — migration 2026-07-13-repair-location)
       -- ⇒ ຄິວປະຈຳວັນຕ້ອງລວມມັນນຳ ບໍ່ດັ່ງນັ້ນ "ມື້ນີ້ຊ່າງມີ 2 ບ່ອນ" ຄວາມຈິງອາດເປັນ 5
       select 'repair' as workflow, a.code,
          nullif(a.emp_code,'') as tech,
          c.name_1 as customer, c.tel,
          coalesce(nullif(a.location_repair,''), c.address) as location,
          a.name_1 as item,
          (${STAGE_SQL}) as stage,
          (${STAGE_LABEL_SQL}) as stage_label,
          nullif(a.remark,'') as remark,
          a.location_lat as lat, a.location_lng as lng
        from tb_product a
        left join ar_customer c on c.code = a.cust_code
       where a.appoint_date = $1::date
         and a.cancel_start is null
         and a.return_complete is null
         ${tech ? "and a.emp_code = $2" : ""}

       order by tech nulls last, code`,
      tech ? [day, tech] : [day],
    )
  ).rows;

  // ຈັດເປັນກຸ່ມຕໍ່ຊ່າງ — ຜູ້ຈັດງານຕ້ອງເຫັນວ່າ "ຄົນນີ້ມື້ນີ້ 4 ບ່ອນ, ຄົນນັ້ນ 0"
  const byTech = new Map<string, Row[]>();
  for (const row of rows) {
    const key = row.tech ?? "(ຍັງບໍ່ມີຊ່າງ)";
    byTech.set(key, [...(byTech.get(key) ?? []), row]);
  }

  const isManager = roleOf(session) !== "technical";

  return (
    <div className="space-y-5">
      <PageTitle sub="ວັນນັດຂອງແຕ່ລະຊ່າງ ທັງ ຕິດຕັ້ງ ແລະ ສ້ອມ — ຈັດຊ້ອນກັນຫຼືບໍ່ ເຫັນຢູ່ນີ້">ຄິວງານຊ່າງປະຈຳວັນ</PageTitle>

      {/* ເລືອກມື້ */}
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Link
          href={`/installations/schedule?d=${shift(day, -1)}`}
          className="inline-flex h-9 items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-600 hover:bg-slate-50"
        >
          <ChevronLeft className="size-4" /> ມື້ກ່ອນ
        </Link>

        <span className="inline-flex h-9 items-center gap-2 rounded-lg bg-slate-900 px-4 text-sm font-bold text-white">
          <CalendarDays className="size-4" />
          {day.split("-").reverse().join("-")}
          {day === today && <span className="rounded bg-teal-500 px-1.5 text-[10px]">ມື້ນີ້</span>}
        </span>

        <Link
          href={`/installations/schedule?d=${shift(day, 1)}`}
          className="inline-flex h-9 items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-600 hover:bg-slate-50"
        >
          ມື້ຕໍ່ໄປ <ChevronRight className="size-4" />
        </Link>

        {day !== today && (
          <Link href="/installations/schedule" className="text-xs font-semibold text-teal-700 hover:underline">
            ກັບມື້ນີ້
          </Link>
        )}
      </div>

      {rows.length === 0 ? (
        <Empty>ບໍ່ມີງານນັດໃນມື້ນີ້</Empty>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {[...byTech.entries()].map(([who, jobs]) => (
            <Card
              key={who}
              title={
                <span className="inline-flex items-center gap-2">
                  <UserRound className="size-4 text-teal-600" />
                  {who}
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                      jobs.length >= 4 ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {jobs.length} ງານ
                  </span>
                  {/* ນັດ 4 ບ່ອນຂຶ້ນໄປໃນມື້ດຽວ = ເປັນໄປໄດ້ຍາກ ⇒ ເຕືອນຜູ້ຈັດງານ */}
                  {jobs.length >= 4 && isManager && (
                    <span className="text-xs font-semibold text-red-600">ນັດຫຼາຍເກີນ?</span>
                  )}
                </span>
              }
            >
              <ul className="space-y-2">
                {jobs.map((job) => (
                  <li key={job.code} className="rounded-xl border border-slate-200 p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={job.workflow === "install" ? `/installations/${job.code}` : `/service/${job.code}`}
                        className="font-bold text-teal-700 hover:underline"
                      >
                        {job.code}
                      </Link>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                          job.workflow === "install" ? "bg-teal-50 text-teal-700" : "bg-amber-50 text-amber-700"
                        }`}
                      >
                        {job.workflow === "install" ? "ຕິດຕັ້ງ" : "ສ້ອມ"}
                      </span>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                        {job.stage_label}
                      </span>
                    </div>

                    <p className="mt-1 text-sm font-semibold text-slate-800">{job.item ?? "-"}</p>
                    <p className="text-xs text-slate-500">{job.customer ?? "-"}</p>

                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                      {job.location && (
                        <span className="inline-flex items-center gap-1 text-slate-600">
                          <MapPin className="size-3.5 text-slate-400" />
                          {job.location}
                        </span>
                      )}
                      {job.tel && (
                        <a href={`tel:${job.tel}`} className="inline-flex items-center gap-1 font-semibold text-emerald-700">
                          <Phone className="size-3.5" />
                          {job.tel}
                        </a>
                      )}
                      {/* ມີພິກັດ ⇒ ກົດນຳທາງໄດ້ເລີຍ (ບໍ່ຕ້ອງໂທຖາມທາງ) */}
                      {job.lat != null && job.lng != null && (
                        <a
                          href={`https://www.google.com/maps/dir/?api=1&destination=${job.lat},${job.lng}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 font-semibold text-teal-700"
                        >
                          <MapPin className="size-3.5" />
                          ນຳທາງ
                        </a>
                      )}
                    </div>

                    {job.remark && <p className="mt-1 text-xs text-slate-400">{job.remark}</p>}
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
