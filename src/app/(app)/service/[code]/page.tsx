import { Chatter } from "@/components/chatter/chatter";
import { Elapsed } from "@/components/elapsed";
import { LinkPending } from "@/components/link-pending";
import { query } from "@/lib/db";
import { elapsedTone } from "@/lib/elapsed-tone";
import { SERVICE_TYPE_LABEL } from "@/lib/sla";
import { STAGE_LABEL, STAGE_SQL } from "@/lib/stage";
import { ArrowLeft, ImageIcon, Pencil, Phone, Printer } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

/**
 * ລາຍລະອຽດໃບຮັບເຄື່ອງ.
 * ຂັ້ນຂອງວຽກມາຈາກ STAGE_SQL (lib/stage.ts) — ບໍ່ຜ່ານ view tracking_tb_product.
 * ຈຳນວນຮູບ ແລະ ຈຳນວນຄັ້ງທີ່ຕິດຕໍ່ ນັບຢູ່ query ດຽວກັນ (ບໍ່ດຶງຮູບມາສະແດງທີ່ນີ້).
 */
type Job = {
  code: string;
  registered: string | null;
  elapsed_seconds: number | null;
  stage: number;
  customer_code: string | null;
  customer: string | null;
  phone: string | null;
  address: string | null;
  product: string | null;
  sn: string | null;
  model: string | null;
  brand: string | null;
  product_type: string | null;
  accessory: string | null;
  warranty: string | null;
  /** ເຫດຜົນທີ່ຊ່າງຕັດສິນວ່າໝົດຮັບປະກັນ (tb_product.warranty_reason) — ຫຼັກຖານເມື່ອລູກຄ້າຄ້ານ */
  warranty_reason: string | null;
  service_type: string | null;
  issue: string | null;
  issue_2: string | null;
  remark: string | null;
  note: string | null;
  delivery: string | null;
  supplier: string | null;
  bill_no: string | null;
  bill_date: string | null;
  technician: string | null;
  receiver: string | null;
  images: number;
  contacts: number;
};

type Props = { params: Promise<{ code: string }> };

export default async function ServiceDetail({ params }: Props) {
  const { code } = await params;

  const job = (
    await query<Job>(
      `select a.code, to_char(a.time_register,'DD-MM-YYYY HH24:MI') registered,
         greatest(0, round(extract(epoch from (localtimestamp - a.time_register))))::int elapsed_seconds,
         (${STAGE_SQL}) stage,
         c.code customer_code, c.name_1 customer, c.tel phone, c.address,
         a.name_1 product, a.sn, a.p_model model, a.p_brand brand, a.p_type product_type, a.p_access accessory,
         a.warrunty warranty, a.warranty_reason, a.service_type, a.issue, a.issue_2, a.p_abrasion remark, a.repair_note note,
         a.p_delivery delivery, a.ap_code supplier, a.doc_def bill_no, a.doc_date_ref bill_date,
         a.emp_code technician, a.user_regis receiver,
         (select count(*) from product_image i
           where i.iteme_code = a.code and coalesce(i.product_url,'') <> '')::int images,
         (select count(*) from cust_contactor t where t.product_code = a.code)::int contacts
       from tb_product a
       left join ar_customer c on c.code = a.cust_code
       where a.code = $1 limit 1`,
      [code],
    )
  ).rows[0];
  if (!job) notFound();

  const tone = elapsedTone(job.elapsed_seconds);
  const inWarranty = job.warranty === "ຮັບປະກັນ";
  const cancelled = job.stage === -1;
  const done = job.stage === 11;

  const groups: { title: string; fields: [string, string | null][] }[] = [
    {
      title: "ຂໍ້ມູນລູກຄ້າ",
      fields: [
        ["ລະຫັດ", job.customer_code],
        ["ຊື່", job.customer],
        ["ເບີໂທ", job.phone],
        ["ທີ່ຢູ່", job.address],
      ],
    },
    {
      title: "ຂໍ້ມູນສິນຄ້າ",
      fields: [
        ["ຊື່ສິນຄ້າ", job.product],
        ["Serial Number", job.sn],
        ["Model", job.model],
        ["ຍີ່ຫໍ້", job.brand],
        ["ປະເພດ", job.product_type],
        ["ອຸປະກອນ", job.accessory],
        ["ປະກັນ", job.warranty],
        // ຫຼັກຖານທີ່ຊ່າງໃຫ້ໄວ້ຕອນຕັດສິນວ່າໝົດປະກັນ — ສະແດງຄູ່ກັບສະຖານະປະກັນສະເໝີ
        ["ເຫດຜົນໝົດຮັບປະກັນ", job.warranty_reason],
        ["ປະເພດບໍລິການ", job.service_type ? SERVICE_TYPE_LABEL[job.service_type] ?? job.service_type : null],
        ["ການສົ່ງມອບ", job.delivery],
        ["ອາການເສຍ (ລູກຄ້າແຈ້ງ)", job.issue],
        ["ອາການເສຍ (ຊ່າງກວດ)", job.issue_2],
        ["ຮ່ອງຮອຍ / ໝາຍເຫດ", job.remark],
        ["ບັນທຶກການສ້ອມ", job.note],
      ],
    },
    {
      title: "ຂໍ້ມູນວຽກ",
      fields: [
        ["ວັນທີຮັບ", job.registered],
        ["ຊ່າງ", job.technician],
        ["ຜູ້ຮັບ", job.receiver],
        ["ສະຖານະ", STAGE_LABEL[job.stage] ?? "-"],
        ["ຮ້ານຄ້າ", job.supplier],
        ["ເລກບິນ", job.bill_no],
        ["ວັນທີບິນ", job.bill_date],
      ],
    },
  ];

  const action = "inline-flex h-9 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50";

  return (
    <div className="w-full space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/service" className="mb-2 inline-flex items-center gap-1.5 text-xs font-medium text-teal-600 hover:underline">
            <ArrowLeft className="size-3.5" />
            ກັບລາຍການ
            <LinkPending className="size-3" />
          </Link>
          <h1 className="text-xl font-bold text-slate-700">ໃບຮັບເຄື່ອງ #{job.code}</h1>

          <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs">
            <span
              className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                cancelled ? "bg-red-100 text-red-700" : done ? "bg-emerald-100 text-emerald-700" : "bg-sky-100 text-sky-700"
              }`}
            >
              {STAGE_LABEL[job.stage] ?? "-"}
            </span>
            <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${inWarranty ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
              {job.warranty || "-"}
            </span>
            {/* ວຽກທີ່ຈົບ/ຍົກເລີກແລ້ວ ບໍ່ຕ້ອງນັບເວລາຕໍ່ */}
            {!done && !cancelled && (
              <>
                <span className="text-slate-400">ຮັບເຄື່ອງມາແລ້ວ</span>
                <Elapsed seconds={job.elapsed_seconds} className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${tone.chip}`} />
              </>
            )}
            <span className="text-slate-400">· {job.registered || "-"}</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/service/${code}/contacts`} className={action}>
            <Phone className="size-3.5" />
            ຕິດຕໍ່ລູກຄ້າ
            {job.contacts > 0 && (
              <span className="rounded bg-slate-100 px-1 text-[10px] font-bold text-slate-600">{job.contacts}</span>
            )}
            <LinkPending className="size-3" />
          </Link>
          <Link href={`/service/${code}/images`} className={action}>
            <ImageIcon className="size-3.5" />
            ຮູບພາບ
            {job.images > 0 && (
              <span className="rounded bg-slate-100 px-1 text-[10px] font-bold text-slate-600">{job.images}</span>
            )}
            <LinkPending className="size-3" />
          </Link>
          <Link href={`/service/${code}/edit`} className={action}>
            <Pencil className="size-3.5" />
            ແກ້ໄຂ
            <LinkPending className="size-3" />
          </Link>
          {/* ໃບພິມແບບທີ 2 (ods: /sprint2 — reciptpd_anniv.html): ໂຄງ ແລະ ຂໍ້ມູນຄືກັນ ຕ່າງກັນພຽງຫົວຂໍ້ໃບ */}
          <Link href={`/service/${code}/print?layout=anniv`} target="_blank" className={action}>
            <Printer className="size-3.5" />
            ພິມໃບງານລ້າງຈັກຊັກຜ້າ
          </Link>
          <Link
            href={`/service/${code}/print`}
            target="_blank"
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-slate-900 px-3 text-xs font-medium text-white hover:bg-slate-800"
          >
            <Printer className="size-3.5" />
            ພິມ
          </Link>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {groups.map((group, index) => (
          <section
            key={group.title}
            className={`rounded-xl border border-slate-200 bg-white p-4 shadow-sm ${index === 1 ? "lg:row-span-2" : ""}`}
          >
            <h2 className="mb-3 border-b border-slate-100 pb-2 text-sm font-bold text-slate-700">{group.title}</h2>
            <dl className="grid gap-3 sm:grid-cols-2">
              {group.fields.map(([label, value]) => (
                <div key={label} className="min-w-0 border-b border-slate-100 pb-2 last:border-0">
                  <dt className="text-[10px] text-slate-400">{label}</dt>
                  <dd className="mt-0.5 text-xs font-medium break-words text-slate-800">{value || "-"}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>

      <Chatter model="tb_product" resId={job.code} />
    </div>
  );
}
