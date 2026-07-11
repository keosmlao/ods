import { LinkPending } from "@/components/link-pending";
import { SelectField } from "@/components/select-field";
import { query } from "@/lib/db";
import { ArrowLeft, Search } from "lucide-react";
import Link from "next/link";

/**
 * ຕິດຕາມວຽກ — ຄົ້ນຫາດ້ວຍ Serial Number ຫຼື ເລກທີວຽກ ແລ້ວສະແດງເປັນເສັ້ນເວລາ.
 *
 * ແກ້ບັກ: ເກົ່າປຽບທຽບ SN ແບບຕົວພິມນ້ອຍ/ໃຫຍ່ຕ້ອງຕົງກັນ (sn = $1) → ພິມ sn ຕົວນ້ອຍແລ້ວຫາບໍ່ພົບ.
 * ດຽວນີ້ຕັດຊ່ອງຫວ່າງ ແລະ ບໍ່ສົນຕົວພິມ (upper) ທັງສອງຝັ່ງ.
 */
type Event = { date: string; time: string; event: string; code: string };
type Props = { searchParams: Promise<{ q?: string; type?: string }> };

/**
 * ຄູ່ (ຖັນເວລາ, ຊື່ເຫດການ) ຂອງແຕ່ລະ workflow — ຊື່ຖັນມາຈາກໂຄ້ດ ບໍ່ແມ່ນຈາກຜູ້ໃຊ້.
 *
 * ບໍ່ມີ "ໄດ້ຮັບອາໄຫຼ່ທີ່ສັ່ງຊື້" (spare_order_finish) ຢູ່ໃນເສັ້ນເວລາ ເພາະຖັນນັ້ນເປັນຊະນິດ
 * `time without time zone` ໃນຖານຂໍ້ມູນ (ເກັບແຕ່ໂມງ ບໍ່ມີວັນທີ) ຈຶ່ງເອົາມາລຽງຕາມວັນທີບໍ່ໄດ້.
 * (ບ່ອນອື່ນໃຊ້ພຽງ is not null ຈຶ່ງບໍ່ມີບັນຫາ — ຄວນແກ້ຊະນິດຖັນນີ້ໃນອະນາຄົດ)
 */
const REPAIR_EVENTS: [string, string][] = [
  ["time_register", "ຮັບເຄື່ອງເຂົ້າສ້ອມ"],
  ["time_check", "ເລີ່ມກວດເຊັກ"],
  ["time_finish_check", "ກວດເຊັກສຳເລັດ"],
  ["qt_start", "ເລີ່ມສະເໜີລາຄາ"],
  ["qt_finish", "ສະເໜີລາຄາສຳເລັດ"],
  ["spare_reg", "ເລີ່ມເບີກອາໄຫຼ່"],
  ["spare_order", "ສັ່ງຊື້ອາໄຫຼ່"],
  ["spare_finish", "ເບີກອາໄຫຼ່ສຳເລັດ"],
  ["time_repair", "ເລີ່ມສ້ອມແປງ"],
  ["time_finish_repair", "ສ້ອມແປງສຳເລັດ"],
  ["cancel_start", "ຂໍຍົກເລີກ"],
  ["cancel_finish", "ອະນຸມັດຍົກເລີກ"],
  ["return_complete", "ສົ່ງຄືນລູກຄ້າ"],
];

const INSTALL_EVENTS: [string, string][] = [
  ["time_register", "ເປີດວຽກຕິດຕັ້ງ"],
  ["tech_confirm", "ຊ່າງຮັບງານ"],
  ["reg_start", "ຂໍເບີກອາໄຫຼ່"],
  ["reg_finish", "ສາງເບີກອາໄຫຼ່"],
  ["pick_finish", "ຊ່າງຮັບອາໄຫຼ່"],
  ["start_install", "ເລີ່ມຕິດຕັ້ງ"],
  ["finish_install", "ຕິດຕັ້ງສຳເລັດ"],
  ["complain_finish", "ລູກຄ້າ feedback"],
  ["job_finish", "ປິດວຽກສຳເລັດ"],
  ["cancel_date", "ຍົກເລີກວຽກ"],
];

/**
 * ຕໍ່ union ຂອງທຸກເຫດການ — ຄ່າຈາກຜູ້ໃຊ້ຜ່ານ $1 ສະເໝີ.
 *
 * ແກ້ບັກ: ເກົ່າຂຽນ `to_char(...) time` ແລະ `'...' event` — ແຕ່ time ແລະ event ເປັນຄຳສະຫງວນ
 * ຂອງ Postgres ຮຸ່ນນີ້ ຈຶ່ງ error "syntax error at or near ..." ທຸກຄັ້ງ
 * → ໜ້າຕິດຕາມວຽກຂຶ້ນ "ຄົ້ນຫາບໍ່ສຳເລັດ" ຕະຫຼອດ, ໃຊ້ບໍ່ໄດ້ເລີຍ.
 * ຕ້ອງມີ as ຫຼື ວົງຢືມ ຈຶ່ງໃຊ້ໄດ້.
 */
function eventsSql(table: string, snColumn: string, events: [string, string][]) {
  const union = events
    .map(([column, label]) => `select code, ${snColumn} as sn, ${column} as event_time, '${label}' as event from ${table}`)
    .join(" union all ");
  return `select to_char(event_time,'DD-MM-YYYY') as "date", to_char(event_time,'HH24:MI') as "time", event, code
    from (${union}) x
    where event_time is not null
      and (upper(replace(sn,' ','')) = upper(replace($1,' ','')) or upper(code) = upper($1))
    order by event_time`;
}

export default async function TrackingPage({ searchParams }: Props) {
  const params = await searchParams;
  const q = (params.q ?? "").trim();
  const type = params.type === "install" ? "install" : "repair";

  let events: Event[] = [];
  let error = "";
  if (q) {
    try {
      const sql =
        type === "repair"
          ? eventsSql("tb_product", "sn", REPAIR_EVENTS)
          : eventsSql("ods_tb_install", "pro_sn", INSTALL_EVENTS);
      events = (await query<Event>(sql, [q])).rows;
    } catch (e) {
      console.error(e);
      error = "ຄົ້ນຫາບໍ່ສຳເລັດ";
    }
  }

  // ວຽກທີ່ພົບ (SN ດຽວອາດເຂົ້າສ້ອມຫຼາຍຄັ້ງ)
  const codes = [...new Set(events.map((event) => event.code))];

  return (
    <div className="mx-auto w-full max-w-4xl space-y-4">
      <div>
        <Link href="/dashboard" className="mb-2 inline-flex items-center gap-1.5 text-xs font-medium text-teal-600 hover:underline">
          <ArrowLeft className="size-3.5" />
          ກັບໜ້າລວມ
          <LinkPending className="size-3" />
        </Link>
        <h1 className="text-xl font-bold text-slate-700">ຕິດຕາມວຽກ</h1>
        <p className="mt-0.5 text-xs text-slate-500">ຄົ້ນຫາດ້ວຍ Serial Number ຫຼື ເລກທີວຽກ</p>
      </div>

      <form className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm">
        <div className="w-40">
          <SelectField
            name="type"
            defaultValue={type}
            placeholder="ປະເພດວຽກ..."
            options={[
              { value: "repair", label: "ວຽກສ້ອມ" },
              { value: "install", label: "ວຽກຕິດຕັ້ງ" },
            ]}
          />
        </div>
        <div className="flex h-9 min-w-56 flex-1 items-center gap-2 rounded-lg border border-slate-300 px-2.5">
          <Search className="size-3.5 shrink-0 text-slate-400" />
          <input
            name="q"
            defaultValue={q}
            required
            placeholder="Serial Number / ເລກທີວຽກ"
            className="w-full text-xs outline-none"
          />
        </div>
        <button className="h-9 rounded-lg bg-slate-900 px-4 text-xs font-medium text-white">ຄົ້ນຫາ</button>
      </form>

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>
      )}

      {q && (
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center gap-2 border-b border-slate-100 pb-3">
            <h2 className="text-sm font-bold text-slate-700">ການເຄື່ອນໄຫວ: {q}</h2>
            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
              {events.length} ເຫດການ
            </span>
            {codes.map((code) =>
              type === "repair" ? (
                <Link
                  key={code}
                  href={`/service/${code}`}
                  className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-[#0536a9] hover:underline"
                >
                  ໃບຮັບເຄື່ອງ {code}
                </Link>
              ) : (
                <span key={code} className="rounded bg-violet-50 px-1.5 py-0.5 text-[10px] font-semibold text-violet-700">
                  ວຽກຕິດຕັ້ງ {code}
                </span>
              ),
            )}
          </div>

          {events.length ? (
            <ol className="relative ml-2 border-l-2 border-teal-100">
              {events.map((event, index) => (
                <li key={`${event.code}-${event.event}-${index}`} className="relative mb-5 ml-6 last:mb-0">
                  <span className="absolute -left-[29px] top-1 size-2.5 rounded-full bg-teal-500 ring-4 ring-teal-50" />
                  <p className="text-xs font-semibold text-slate-800">{event.event}</p>
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    {event.date} · {event.time} · ເລກທີ {event.code}
                  </p>
                </li>
              ))}
            </ol>
          ) : (
            <p className="py-10 text-center text-xs text-slate-400">ບໍ່ພົບປະຫວັດ</p>
          )}
        </section>
      )}
    </div>
  );
}
