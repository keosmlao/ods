import { AssignTechButton, type AssignRow } from "@/components/installation/assign-tech";
import { query } from "@/lib/db";
import { SERVICE_TYPE_LABEL } from "@/lib/sla";
import { STAGE_LABEL_SQL, STAGE_SQL } from "@/lib/stage";
import { listTechnicians } from "@/lib/technicians";
import { CalendarDays, TriangleAlert, UserRound } from "lucide-react";
import Link from "next/link";

/**
 * **ຈັດຊ່າງງານສ້ອມ** — ບໍ່ມີໃນ ods ແລະ ບໍ່ເຄີຍມີໃນລະບົບນີ້ມາກ່ອນ.
 *
 * ── ຮູຮົ່ວ ──
 * ຊ່າງຂອງງານສ້ອມຖືກໃສ່ **ຕອນຮັບເຄື່ອງເທົ່ານັ້ນ** ແລ້ວ **ປ່ຽນພາຍຫຼັງບໍ່ໄດ້** —
 * ຊ່າງລາພັກ/ລາອອກ/ຕິດງານ ⇒ ໃບຄ້າງຢູ່ນຳລາວຕະຫຼອດ (ຝັ່ງຕິດຕັ້ງມີໜ້າຈັດຊ່າງມາແຕ່ຕົ້ນ).
 * ແລະ **ບໍ່ມີວັນນັດຈັກໃບ** (ຂໍ້ມູນຈິງ: 101 ໃບຄ້າງ · 0 ວັນນັດ) ທັ້ງທີ່ 75% ຂອງງານສ້ອມ
 * ຕ້ອງອອກໜ້າງານ ⇒ ຄິວປະຈຳວັນຈັດບໍ່ໄດ້ ແລະ ລູກຄ້າບໍ່ຮູ້ວ່າຊ່າງຈະມາມື້ໃດ.
 *
 * modal ຈັດຊ່າງໃຊ້ອັນດຽວກັບຝັ່ງຕິດຕັ້ງ (ພາລະງານຂອງຊ່າງນັບທັງສອງຝັ່ງຢູ່ແລ້ວ).
 */
export const dynamic = "force-dynamic";

type Row = AssignRow & {
  product: string | null;
  service_type: string | null;
  stage_label: string;
  registered: string;
  tech: string | null;
  accepted: boolean;
};

export default async function RepairAssignPage() {
  const [rows, techs] = await Promise.all([
    query<Row>(
      `select a.code,
          c.name_1 as customer,
          concat_ws(' ', a.name_1, a.p_brand, a.p_model) as product,
          nullif(a.service_type,'') as service_type,
          (${STAGE_LABEL_SQL}) as stage_label,
          to_char(a.time_register,'DD-MM-YYYY HH24:MI') as registered,
          nullif(a.emp_code,'') as tech,
          (a.repair_confirm is not null) as accepted,
          coalesce(nullif(a.location_repair,''), c.address) as location_inst,
          to_char(a.appoint_date,'YYYY-MM-DD') as appoint_date,
          nullif(a.remark,'') as remark
        from tb_product a
        left join ar_customer c on c.code = a.cust_code
       where a.return_complete is null and a.cancel_start is null
       order by (a.appoint_date is null) desc, a.appoint_date asc, a.time_register asc`,
    ),
    listTechnicians(),
  ]);

  const noAppoint = rows.rows.filter((row) => !row.appoint_date).length;
  const notAccepted = rows.rows.filter((row) => row.tech && !row.accepted).length;

  return (
    <div className="w-full space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-700">ຈັດຊ່າງງານສ້ອມ</h1>
        <p className="mt-0.5 text-xs text-slate-500">
          ປ່ຽນຊ່າງ · ຕັ້ງວັນນັດ · ໃສ່ສະຖານທີ່ໜ້າງານ · {rows.rows.length.toLocaleString()} ລາຍການ
        </p>
      </div>

      {(noAppoint > 0 || notAccepted > 0) && (
        <p className="flex flex-wrap items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
          <TriangleAlert className="size-4" />
          {noAppoint > 0 && <span>{noAppoint} ໃບ ຍັງບໍ່ມີວັນນັດ (ຈັດຄິວປະຈຳວັນບໍ່ໄດ້)</span>}
          {notAccepted > 0 && <span>· {notAccepted} ໃບ ຊ່າງຍັງບໍ່ກົດຮັບງານ</span>}
        </p>
      )}

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-slate-600">
                <th className="whitespace-nowrap px-3 py-2.5 font-semibold">ໃບຮັບເຄື່ອງ</th>
                <th className="whitespace-nowrap px-3 py-2.5 font-semibold">ລູກຄ້າ / ເຄື່ອງ</th>
                <th className="whitespace-nowrap px-3 py-2.5 font-semibold">ປະເພດ</th>
                <th className="whitespace-nowrap px-3 py-2.5 font-semibold">ຂັ້ນຕອນ</th>
                <th className="whitespace-nowrap px-3 py-2.5 text-center font-semibold">ຊ່າງ</th>
                <th className="whitespace-nowrap px-3 py-2.5 text-center font-semibold">ວັນນັດ</th>
                <th className="px-3 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {rows.rows.map((row) => (
                <tr key={row.code} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="whitespace-nowrap px-3 py-2.5">
                    <Link href={`/service/${row.code}`} className="font-bold text-[#0536a9] hover:underline">
                      {row.code}
                    </Link>
                    <span className="block text-[10px] text-slate-400">{row.registered}</span>
                  </td>
                  <td className="max-w-64 px-3 py-2.5">
                    <span className="block truncate font-medium text-slate-800">{row.customer ?? "-"}</span>
                    <span className="block truncate text-[10px] text-slate-400">{row.product ?? "-"}</span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-slate-600">
                    {row.service_type ? (SERVICE_TYPE_LABEL[row.service_type] ?? row.service_type) : "-"}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-slate-600">{row.stage_label}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-center">
                    <span className="inline-flex items-center gap-1 font-semibold text-slate-700">
                      <UserRound className="size-3.5 text-slate-400" />
                      {row.tech ?? "-"}
                    </span>
                    {/* ຊ່າງຍັງບໍ່ກົດຮັບ = ອາດບໍ່ຮູ້ວ່າມີງານ ⇒ ຄວນປ່ຽນຄົນ ຫຼື ໂທເຕືອນ */}
                    {row.tech && !row.accepted && (
                      <span className="mt-0.5 block rounded bg-amber-100 px-1 py-0.5 text-[10px] font-bold text-amber-800">
                        ຍັງບໍ່ຮັບງານ
                      </span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-center">
                    {row.appoint_date ? (
                      <span className="inline-flex items-center gap-1 font-semibold text-slate-700">
                        <CalendarDays className="size-3.5 text-slate-400" />
                        {row.appoint_date.split("-").reverse().join("-")}
                      </span>
                    ) : (
                      <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-700">ບໍ່ມີວັນນັດ</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-right">
                    <AssignTechButton row={row} techs={techs} workflow="repair" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {rows.rows.length === 0 && <p className="py-12 text-center text-xs text-slate-400">ບໍ່ມີງານສ້ອມທີ່ຄ້າງ</p>}
      </section>
    </div>
  );
}
