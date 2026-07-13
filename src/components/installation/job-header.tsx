import { CalendarDays, MapPin, Package, Phone, UserRound } from "lucide-react";

/**
 * ຫົວໃບງານຕິດຕັ້ງ — ໃຊ້ຮ່ວມກັນໃນໜ້າ ຂໍເບີກ / ສາງເບີກ / ຮັບອາໄຫຼ່.
 *
 * ── ອອກແບບໃໝ່ ──
 * ຮຸ່ນກ່ອນວາງ **13 ຊ່ອງນ້ຳໜັກເທົ່າກັນໝົດ** (ເລກທີ · ວັນເປີດ · ລູກຄ້າ · ເບີ · ທີ່ຢູ່ · ເລກບິນ ·
 * ລາຍການ · ຍີ່ຫໍ້ · model · ປະເພດ · ຂະໜາດ · ວັນນັດ · ຊ່າງ) ກິນເຄິ່ງໜ້າຈໍ ກ່ອນຈະຮອດ
 * ສິ່ງທີ່ຄົນມາເຮັດຈິງ (ຂໍເບີກອາໄຫຼ່).
 *
 * ຄວາມຈິງ: ຄົນເປີດໜ້ານີ້ຕ້ອງການຮູ້ **3 ຢ່າງ** — ງານໃດ · ເຄື່ອງຫຍັງ · ໄປຫາໃຜ/ມື້ໃດ.
 * ⇒ ຈັດເປັນ 3 ກຸ່ມ, ເລກທີງານເປັນຫົວ, ສ່ວນທີ່ເຫຼືອເປັນປ້າຍນ້ອຍ.
 * ເບີໂທກົດໂທໄດ້ · ມີພິກັດ ⇒ ກົດນຳທາງໄດ້ (ຢູ່ໜ້າງານກໍ່ໃຊ້ໄດ້).
 */
export type JobHead = {
  code: string;
  cust_code: string | null;
  cust_name: string | null;
  tel: string | null;
  address: string | null;
  doc_ref_1: string | null;
  time_register: string | null;
  item_name: string | null;
  pro_brand: string | null;
  pro_model: string | null;
  pro_type: string | null;
  pro_size: string | null;
  appoint_date: string | null;
  tech_code: string | null;
  location_inst?: string | null;
  location_lat?: number | null;
  location_lng?: number | null;
};

export const JOB_HEAD_COLUMNS = `a.code, a.cust_code, c.name_1 as cust_name, c.tel, c.address, a.doc_ref_1,
  to_char(a.time_register,'DD-MM-YYYY HH24:MI') as time_register, a.item_name,
  a.pro_brand, a.pro_model, a.pro_type, a.pro_size,
  to_char(a.appoint_date,'DD-MM-YYYY') as appoint_date, a.tech_code,
  a.location_inst, a.location_lat, a.location_lng`;

function Chip({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">
      <span className="text-slate-400">{label}</span>
      <b className="font-semibold text-slate-700">{value}</b>
    </span>
  );
}

export function JobHeader({ head, title = "ຂໍ້ມູນງານຕິດຕັ້ງ" }: { head: JobHead; title?: string }) {
  const place = head.location_inst || head.address;
  const hasPoint = head.location_lat != null && head.location_lng != null;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm" aria-label={title}>
      <div className="grid gap-4 md:grid-cols-3">
        {/* ① ງານໃດ */}
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md bg-slate-900 px-2 py-0.5 text-xs font-bold text-white">{head.code}</span>
            {head.doc_ref_1 && (
              <span className="text-[11px] text-slate-500">
                ບິນ <b className="font-semibold text-slate-700">{head.doc_ref_1}</b>
              </span>
            )}
          </div>
          <p className="mt-1 text-[11px] text-slate-400">ເປີດງານ {head.time_register ?? "-"}</p>
          {head.tech_code && (
            <p className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-slate-700">
              <UserRound className="size-3.5 text-teal-600" />
              ຊ່າງ {head.tech_code}
            </p>
          )}
        </div>

        {/* ② ເຄື່ອງຫຍັງ — ອັນນີ້ຄືສິ່ງທີ່ຕັດສິນວ່າຕ້ອງເບີກອາໄຫຼ່ຫຍັງ */}
        <div className="min-w-0 md:border-l md:border-slate-100 md:pl-4">
          <p className="inline-flex items-start gap-1.5 text-sm font-bold text-slate-800">
            <Package className="mt-0.5 size-4 shrink-0 text-teal-600" />
            <span className="min-w-0">{head.item_name ?? "-"}</span>
          </p>
          <div className="mt-1.5 flex flex-wrap gap-1">
            <Chip label="ຍີ່ຫໍ້" value={head.pro_brand} />
            <Chip label="Model" value={head.pro_model} />
            <Chip label="ປະເພດ" value={head.pro_type} />
            <Chip label="ຂະໜາດ" value={head.pro_size} />
          </div>
        </div>

        {/* ③ ໄປຫາໃຜ / ມື້ໃດ */}
        <div className="min-w-0 md:border-l md:border-slate-100 md:pl-4">
          <p className="truncate text-sm font-semibold text-slate-800">
            {head.cust_name ?? "-"}
            {head.cust_code && <span className="ml-1 text-xs font-normal text-slate-400">({head.cust_code})</span>}
          </p>

          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
            {head.tel && (
              <a href={`tel:${head.tel}`} className="inline-flex items-center gap-1 font-semibold text-emerald-700">
                <Phone className="size-3.5" />
                {head.tel}
              </a>
            )}
            {head.appoint_date && (
              <span className="inline-flex items-center gap-1 font-semibold text-slate-700">
                <CalendarDays className="size-3.5 text-slate-400" />
                ນັດ {head.appoint_date}
              </span>
            )}
          </div>

          {place && (
            <p className="mt-1 flex items-start gap-1 text-xs text-slate-500">
              <MapPin className="mt-0.5 size-3.5 shrink-0 text-slate-400" />
              <span className="min-w-0">{place}</span>
            </p>
          )}
          {/* ມີພິກັດ ⇒ ກົດນຳທາງໄດ້ເລີຍ (ຊ່າງເປີດໜ້ານີ້ຢູ່ໜ້າງານໄດ້) */}
          {hasPoint && (
            <a
              href={`https://www.google.com/maps/dir/?api=1&destination=${head.location_lat},${head.location_lng}`}
              target="_blank"
              rel="noreferrer"
              className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-teal-700 hover:underline"
            >
              <MapPin className="size-3.5" />
              ນຳທາງ
            </a>
          )}
        </div>
      </div>
    </section>
  );
}
