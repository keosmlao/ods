import { getCompany } from "@/components/report/print-layout";
import { query } from "@/lib/db";
import { SERVICE_TYPE_LABEL } from "@/lib/sla";
import { trackUrl } from "@/lib/track";
import { notFound } from "next/navigation";
import QRCode from "qrcode";

/**
 * ພິມໃບຮັບເຄື່ອງ.
 *
 * ແກ້ບັກ: ເກົ່າມີປຸ່ມ <button onClick={undefined}> ຢູ່ໃນ server component (ກົດບໍ່ໄດ້ ແລະ ບໍ່ຄວນເປັນປຸ່ມ)
 * ແລະ ຫົວກະດາດ hardcode ວ່າ "ODIEN SERVICE" → ດຽວນີ້ດຶງຊື່/ທີ່ຢູ່ບໍລິສັດຈາກ company_profile
 * ຄືກັບໃບພິມອື່ນທັງໝົດ ແລະ ຂໍ້ຄວາມ "ກົດ Ctrl/Cmd + P" ເປັນປ້າຍທຳມະດາທີ່ບໍ່ຖືກພິມອອກ (.no-print).
 *
 * ໃບພິມແບບທີ 2 — ?layout=anniv
 * ods ມີ 2 ເສັ້ນທາງ: /sprint (billprint/reciptpd.html) ແລະ /sprint2 (billprint/reciptpd_anniv.html).
 * ສອງ template ນັ້ນ **ຕ່າງກັນພຽງແຖວດຽວ** ຄື ຫົວຂໍ້ຂອງໃບ:
 *      reciptpd.html        → "ໃບຮັບເຄື່ອງສ້ອມແປງ"
 *      reciptpd_anniv.html  → "ໃບງານລ້າງຈັກຊັກຜ້າ"
 * (SQL, ຄໍລຳ, ຂໍ້ມູນ ແລະ ໂຄງໜ້າ ຄືກັນທຸກປະການ — bill.py:19 ກັບ bill.py:44 ໃຊ້ query ດຽວກັນ)
 * ຈຶ່ງບໍ່ສ້າງໜ້າໃໝ່ຊ້ຳກັນ ແຕ່ຮັບເປັນ ?layout= ຂອງໜ້າດຽວກັນນີ້.
 */
const LAYOUT_TITLE = {
  default: "ໃບຮັບເຄື່ອງເຂົ້າສ້ອມ",
  anniv: "ໃບງານລ້າງຈັກຊັກຜ້າ",
} as const;
type Layout = keyof typeof LAYOUT_TITLE;
const safeLayout = (value: string | string[] | undefined): Layout => (value === "anniv" ? "anniv" : "default");
type Receipt = {
  code: string;
  registered: string | null;
  customer: string | null;
  phone: string | null;
  address: string | null;
  product: string | null;
  sn: string | null;
  model: string | null;
  brand: string | null;
  accessory: string | null;
  warranty: string | null;
  service_type: string | null;
  issue: string | null;
  remark: string | null;
  technician: string | null;
  receiver: string | null;
};

type Props = {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

function Field({ label, value, wide }: { label: string; value: string | null; wide?: boolean }) {
  return (
    <p className={wide ? "col-span-2" : ""}>
      <span className="text-slate-500">{label}: </span>
      <b className="font-semibold">{value || "-"}</b>
    </p>
  );
}

export default async function PrintReceipt({ params, searchParams }: Props) {
  const { code } = await params;
  const layout = safeLayout((await searchParams).layout);

  const [receipt, company] = await Promise.all([
    query<Receipt>(
      `select a.code, to_char(a.time_register,'DD-MM-YYYY HH24:MI') registered,
         c.name_1 customer, c.tel phone, c.address,
         a.name_1 product, a.sn, a.p_model model, a.p_brand brand, a.p_access accessory,
         a.warrunty warranty, a.service_type, a.issue, a.p_abrasion remark,
         a.emp_code technician, a.user_regis receiver
       from tb_product a left join ar_customer c on c.code = a.cust_code
       where a.code = $1 limit 1`,
      [code],
    ).then((result) => result.rows[0]),
    getCompany(),
  ]);
  if (!receipt) notFound();

  /**
   * QR ໃຫ້ລູກຄ້າສະແກນຕິດຕາມເອງ → ໜ້າສາທາລະນະ /track/<ເລກທີ> (ບໍ່ຕ້ອງ login).
   * ods ຝັງ qrcode('https://www.odienmall.com/servicefuond/' + code) — ໃຊ້ code ອັນດຽວກັນ
   * ຈຶ່ງມີເສັ້ນທາງຮັບຂອງເກົ່າໄວ້ທີ່ /servicefuond/<code> ແລະ /tracking/<sn> ນຳ.
   * ຕັ້ງ PUBLIC_BASE_URL ໃນ .env ຂອງເຄື່ອງແມ່ຂ່າຍ ບໍ່ດັ່ງນັ້ນ QR ຈະຊີ້ໃສ່ host ທີ່ພິມຈາກ.
   */
  const url = await trackUrl(receipt.code);
  const qr = await QRCode.toString(url, { type: "svg", margin: 0, errorCorrectionLevel: "M", width: 88 });

  return (
    <div className="mx-auto max-w-3xl bg-white p-8 text-sm text-slate-950">
      <p className="no-print mb-4 rounded-lg bg-slate-100 px-4 py-2 text-center text-xs text-slate-600">
        ກົດ Ctrl/Cmd + P ເພື່ອພິມ
      </p>

      <header className="relative border-b-2 border-slate-900 pb-4 text-center">
        <h1 className="text-xl font-bold">{company.name_1 || "ODIEN SERVICE"}</h1>
        {company.name_2 && <p className="text-xs">{company.name_2}</p>}
        {company.address && <p className="text-xs">{company.address}</p>}
        {company.tel && <p className="text-xs">ໂທ: {company.tel}</p>}
        <p className="mt-2 text-base font-bold">{LAYOUT_TITLE[layout]}</p>
        <div className="absolute top-0 right-0 w-[88px] text-center">
          <div className="[&>svg]:h-auto [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: qr }} />
          <p className="mt-1 text-[9px] leading-tight">ສະແກນເພື່ອຕິດຕາມເຄື່ອງສ້ອມ</p>
        </div>
      </header>

      <div className="mt-4 flex justify-between text-xs">
        <b>ເລກທີ: {receipt.code}</b>
        <span>ວັນທີ: {receipt.registered || "-"}</span>
      </div>

      <section className="mt-5">
        <h2 className="border border-slate-300 bg-slate-100 px-2 py-1 text-xs font-bold">ຂໍ້ມູນລູກຄ້າ</h2>
        <div className="grid grid-cols-2 gap-2 border border-t-0 border-slate-300 p-3 text-xs">
          <Field label="ຊື່" value={receipt.customer} />
          <Field label="ເບີໂທ" value={receipt.phone} />
          <Field label="ທີ່ຢູ່" value={receipt.address} wide />
        </div>
      </section>

      <section className="mt-4">
        <h2 className="border border-slate-300 bg-slate-100 px-2 py-1 text-xs font-bold">ຂໍ້ມູນເຄື່ອງ</h2>
        <div className="grid grid-cols-2 gap-2 border border-t-0 border-slate-300 p-3 text-xs">
          <Field label="ສິນຄ້າ" value={receipt.product} />
          <Field label="SN" value={receipt.sn} />
          <Field label="ຍີ່ຫໍ້" value={receipt.brand} />
          <Field label="Model" value={receipt.model} />
          <Field label="ປະກັນ" value={receipt.warranty} />
          <Field
            label="ປະເພດບໍລິການ"
            value={receipt.service_type ? SERVICE_TYPE_LABEL[receipt.service_type] ?? receipt.service_type : null}
          />
          <Field label="ອຸປະກອນ" value={receipt.accessory} wide />
          <Field label="ອາການ" value={receipt.issue} wide />
          <Field label="ຮ່ອງຮອຍ / ໝາຍເຫດ" value={receipt.remark} wide />
          <Field label="ຊ່າງ" value={receipt.technician} />
        </div>
      </section>

      <div className="mt-20 grid grid-cols-2 text-center text-xs">
        <div>
          <p>____________________</p>
          <p className="mt-2">ຜູ້ສົ່ງເຄື່ອງ</p>
        </div>
        <div>
          <p>____________________</p>
          <p className="mt-2">ຜູ້ຮັບ: {receipt.receiver || "-"}</p>
        </div>
      </div>
    </div>
  );
}
