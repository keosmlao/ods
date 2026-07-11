import { LinkPending } from "@/components/link-pending";
import { ContactForm } from "@/components/service-contact-form";
import { query } from "@/lib/db";
import { ArrowLeft, Phone } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

/** ຄື /htmx_update_contact/<code> ຂອງ ods — ບັນທຶກການໂທຕິດຕາມລູກຄ້າ */
type Head = { code: string; name_1: string; sn: string; cust: string | null; tel: string };
type Round = { round: number; call_day: string; call_time: string; remark: string | null };
type Props = { params: Promise<{ code: string }> };

export default async function ServiceContacts({ params }: Props) {
  const { code } = await params;

  const head = (
    await query<Head>(
      `select a.code, a.name_1, coalesce(a.sn,'') sn, b.name_1 cust, coalesce(b.tel,'') tel
       from tb_product a left join ar_customer b on b.code = a.cust_code where a.code = $1 limit 1`,
      [code],
    )
  ).rows[0];
  if (!head) notFound();

  // ຮອບຖັດໄປ ຄິດຈາກແຖວທີ່ດຶງມາແລ້ວ — ບໍ່ຕ້ອງຍິງ query ອີກອັນ (ods ຍິງ 2 ຄັ້ງ)
  const rounds = (
    await query<Round>(
      `select round, to_char(datetime,'dd-mm-yyyy') call_day, to_char(datetime,'hh24:mi:ss') call_time, remark
       from cust_contactor where product_code = $1 order by round`,
      [code],
    )
  ).rows;
  const nextRound = rounds.reduce((max, row) => Math.max(max, row.round), 0) + 1;

  return (
    <div className="mx-auto w-full max-w-4xl space-y-4">
      <div>
        <Link
          href={`/service/${code}`}
          className="mb-2 inline-flex items-center gap-1.5 text-xs font-medium text-teal-600 hover:underline"
        >
          <ArrowLeft className="size-3.5" />
          ກັບໜ້າໃບຮັບເຄື່ອງ
          <LinkPending className="size-3" />
        </Link>
        <h1 className="text-xl font-bold text-slate-700">ຕິດຕໍ່ລູກຄ້າ — ລະຫັດງານ {head.code}</h1>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-slate-500">
          <span className="font-medium text-slate-700">{head.cust ?? "-"}</span>
          {head.tel && (
            <a href={`tel:${head.tel}`} className="inline-flex items-center gap-1 hover:underline">
              <Phone className="size-3 text-slate-400" />
              {head.tel}
            </a>
          )}
          <span>
            · {head.name_1} {head.sn}
          </span>
        </p>
      </div>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <h2 className="border-b border-slate-100 px-4 py-2.5 text-sm font-bold text-slate-700">
          ປະຫວັດການຕິດຕໍ່ <span className="text-xs font-normal text-slate-400">({rounds.length} ຄັ້ງ)</span>
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px] border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-slate-600">
                <th className="whitespace-nowrap px-3 py-2.5 font-semibold">ຮອບທີ</th>
                <th className="whitespace-nowrap px-3 py-2.5 font-semibold">ວັນທີ</th>
                <th className="whitespace-nowrap px-3 py-2.5 font-semibold">ເວລາ</th>
                <th className="whitespace-nowrap px-3 py-2.5 font-semibold">ໝາຍເຫດ</th>
              </tr>
            </thead>
            <tbody>
              {rounds.map((row) => (
                <tr key={row.round} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                  <td className="whitespace-nowrap px-3 py-2.5 font-semibold text-slate-700">ຮອບທີ {row.round}</td>
                  <td className="whitespace-nowrap px-3 py-2.5">{row.call_day}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 tabular-nums text-slate-500">{row.call_time}</td>
                  <td className="px-3 py-2.5 text-slate-600">{row.remark || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {rounds.length === 0 && <p className="py-12 text-center text-xs text-slate-400">ຍັງບໍ່ມີການຕິດຕໍ່</p>}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 border-b border-slate-100 pb-2 text-sm font-bold text-slate-700">ເພີ່ມການຕິດຕໍ່</h2>
        <ContactForm code={code} nextRound={nextRound} />
      </section>
    </div>
  );
}
