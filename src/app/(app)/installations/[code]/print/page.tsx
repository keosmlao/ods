import { getSession } from "@/lib/auth";
import { query } from "@/lib/db";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getLocale } from "@/lib/i18n/locale";
import { canViewAssignedJob } from "@/lib/scope";
import { feedbackUrl } from "@/lib/track";
import { notFound, redirect } from "next/navigation";
import QRCode from "qrcode";

/** ຖອດແບບຈາກ ods: /install_print/<id> (bill.py) + templates/install_print.html */
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ code: string }> };
type Row = Record<string, string | null>;
type Company = Record<string, string | null>;

export default async function InstallPrint({ params }: Props) {
  const session = await getSession();
  if (!session) redirect("/login");
  const { code } = await params;
  const t = (await getDictionary(await getLocale())).installPrint;

  const [job, company] = await Promise.all([
    query<Row>(
      `select to_char(a.time_register,'dd-MM-yyyy') as reg_date, to_char(a.time_register,'HH24:MI') as reg_time,
         a.code, a.cust_code || '-' || coalesce(c.name_1,'') as customer,
         coalesce(c.address,'-') as address, coalesce(c.tel,'-') as tel,
         coalesce(a.tech_code,'-') as tech_code, a.doc_ref_1,
         a.pro_brand, a.pro_model, a.pro_sn, a.pro_type, a.pro_size, a.remark, a.user_created,
         a.location_inst, to_char(a.appoint_date,'dd-MM-yyyy') as appoint_date
       from ods_tb_install a
       left join ar_customer c on c.code = a.cust_code
       where a.code = $1 limit 1`,
      [decodeURIComponent(code)],
    ),
    query<Company>("select name_1,name_2,address,tel,min,tin from company_profile limit 1"),
  ]);

  const x = job.rows[0];
  if (!x) notFound();
  if (!canViewAssignedJob(session, x.tech_code)) redirect("/forbidden");
  const co = company.rows[0];

  /**
   * QR ແບບສອບຖາມ — ຊ່າງພົກໃບນີ້ໄປໜ້າງານ ພໍຕິດຕັ້ງແລ້ວກໍ່ໃຫ້ລູກຄ້າສະແກນຕອບເລີຍ.
   * ງານຄ້າງຢູ່ຂັ້ນ "ຕິດຕັ້ງສຳເລັດ" ຈົນກວ່າລູກຄ້າຈະຕອບ ແລະ LINE ທີ່ ods ໃຊ້ສົ່ງລິ້ງ
   * ປິດບໍລິການໄປແລ້ວ (ຄືກັບ QR ຕິດຕາມສະຖານະໃນໃບຮັບເຄື່ອງສ້ອມ).
   * ໜ້າ /feedback ເອງກັນໄວ້ຢູ່ແລ້ວ: ຍັງບໍ່ຕິດຕັ້ງສຳເລັດ ຕອບບໍ່ໄດ້.
   */
  const url = await feedbackUrl(x.code ?? "");
  const qr = await QRCode.toString(url, { type: "svg", margin: 0, errorCorrectionLevel: "M", width: 96 });

  return (
    <div className="mx-auto max-w-4xl bg-white p-8 text-slate-950">
      <p className="mb-6 text-right text-sm text-slate-500 print:hidden">{t.printHint}</p>

      <header className="border-b-2 border-slate-900 pb-5 text-center">
        <h1 className="text-2xl font-bold">{co?.name_1 ?? "ODIEN SERVICE"}</h1>
        <p className="text-sm">{co?.name_2}</p>
        <p className="mt-1 text-sm">{co?.address}</p>
        <p className="text-sm">{t.tel}: {co?.tel}</p>
        <p className="mt-3 text-lg font-bold">{t.installTitle}</p>
      </header>

      <div className="mt-5 flex justify-between text-sm">
        <b>{t.docNo}: {x.code}</b>
        <span>{t.openDate}: {x.reg_date} {x.reg_time}</span>
      </div>

      <section className="mt-6">
        <h2 className="border-b bg-slate-100 p-2 font-bold">{t.customerInfo}</h2>
        <div className="grid grid-cols-2 gap-3 p-3 text-sm">
          <p>{t.customer}: {x.customer}</p>
          <p>{t.phone}: {x.tel}</p>
          <p className="col-span-2">{t.address}: {x.address}</p>
          <p className="col-span-2">{t.installLocation}: {x.location_inst || "-"}</p>
        </div>
      </section>

      <section className="mt-5">
        <h2 className="border-b bg-slate-100 p-2 font-bold">{t.installInfo}</h2>
        <div className="grid grid-cols-2 gap-3 p-3 text-sm">
          <p>{t.salesBillNo}: {x.doc_ref_1 || "-"}</p>
          <p>{t.appointDate}: {x.appoint_date || "-"}</p>
          <p>{t.brand}: {x.pro_brand || "-"}</p>
          <p>Model: {x.pro_model || "-"}</p>
          <p>{t.type}: {x.pro_type || "-"}</p>
          <p>{t.size}: {x.pro_size || "-"}</p>
          <p>S/N: {x.pro_sn || "-"}</p>
          <p>{t.technician}: {x.tech_code}</p>
          <p className="col-span-2">{t.remark}: {x.remark || "-"}</p>
        </div>
      </section>

      <section className="mt-6 flex items-center gap-4 rounded border border-slate-300 p-4">
        {/* svg ມາຈາກ qrcode ຢູ່ຝັ່ງ server — ບໍ່ແມ່ນ input ຂອງຜູ້ໃຊ້ */}
        <div className="shrink-0" dangerouslySetInnerHTML={{ __html: qr }} />
        <div className="text-sm">
          <p className="font-bold">{t.surveyTitle}</p>
          <p className="mt-1 text-slate-600">
            {t.surveyHint}
          </p>
          <p className="mt-1 break-all text-xs text-slate-400">{url}</p>
        </div>
      </section>

      <div className="mt-16 grid grid-cols-2 text-center text-sm">
        <div>
          <p>____________________</p>
          <p className="mt-2">{t.customerSign}</p>
        </div>
        <div>
          <p>____________________</p>
          <p className="mt-2">{t.creator}: {x.user_created}</p>
        </div>
      </div>
    </div>
  );
}
