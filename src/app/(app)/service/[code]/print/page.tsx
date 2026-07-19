import { getCompany } from "@/components/report/print-layout";
import { PrintButton } from "@/components/print-button";
import { query } from "@/lib/db";
import { getErpCategories } from "@/lib/erp-master";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getLocale } from "@/lib/i18n/locale";
import { trackUrl } from "@/lib/track";
import Image from "next/image";
import { notFound } from "next/navigation";
import QRCode from "qrcode";

type PrintDict = (typeof import("@/lib/i18n/dictionaries/lo.json"))["servicePrint"];

/**
 * ພິມໃບຮັບເຄື່ອງສ້ອມແປງ — ຖອດແບບຈາກ ods/templates/billprint/reciptpd.html (ໂຄງ 2 ພາສາ ລາວ/ອັງກິດ).
 *
 * ໃບພິມແບບທີ 2 — ?layout=anniv (ໃບງານລ້າງຈັກຊັກຜ້າ) ຄື ods /sprint2 (reciptpd_anniv.html):
 * ຕ່າງກັນພຽງຫົວຂໍ້ຂອງໃບ — SQL/ຄໍລຳ/ໂຄງ ຄືກັນໝົດ ຈຶ່ງໃຊ້ໜ້າດຽວກັນ.
 *
 * "ແປງເປັນ PDF" = ໃຊ້ browser print (ປຸ່ມ "ພິມ / ບັນທຶກ PDF") → ເລືອກ Save as PDF.
 */
const layoutTitle = (t: PrintDict) =>
  ({
    default: t.receiptTitleDefault,
    anniv: t.receiptTitleAnniv,
  }) as const;
type Layout = keyof ReturnType<typeof layoutTitle>;
const safeLayout = (value: string | string[] | undefined): Layout => (value === "anniv" ? "anniv" : "default");

/** ການຈັດສົ່ງ — ເກັບເປັນລະຫັດ '1'/'2' (ຄືຟອມຮັບເຄື່ອງ) */
const deliveryLabelMap = (t: PrintDict): Record<string, string> => ({ "1": t.deliveryByOdien, "2": t.deliveryPickup });

type Receipt = {
  code: string;
  reg_date: string | null;
  reg_time: string | null;
  customer: string | null;
  phone: string | null;
  address: string | null;
  province: string | null;
  city: string | null;
  product: string | null;
  sn: string | null;
  model: string | null;
  brand: string | null;
  accessory: string | null;
  warranty: string | null;
  product_type: string | null;
  type_name: string | null;
  delivery: string | null;
  symptom: string | null;
  remark: string | null;
  receiver: string | null;
};

type Props = {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

/** ຫ້ອງປ້າຍ 2 ພາສາ (ລາວ / ອັງກິດ) */
function LabelCell({ lo, en, width }: { lo: string; en: string; width?: string }) {
  return (
    <td className="border border-black px-2 py-1 align-top" style={width ? { width } : undefined}>
      <div>{lo}</div>
      <div className="text-[10px] leading-tight text-slate-600">{en}</div>
    </td>
  );
}

function ValueCell({ value, colSpan }: { value: string | null; colSpan?: number }) {
  return (
    <td className="border border-black px-2 py-1 align-top font-semibold" colSpan={colSpan}>
      {value || " "}
    </td>
  );
}

export default async function PrintReceipt({ params, searchParams }: Props) {
  const { code } = await params;
  const t = (await getDictionary(await getLocale())).servicePrint;
  const layout = safeLayout((await searchParams).layout);

  const [receipt, company, categories] = await Promise.all([
    query<Receipt>(
      `select a.code, to_char(a.time_register,'DD-MM-YYYY') reg_date, to_char(a.time_register,'HH24:MI') reg_time,
         c.name_1 customer, c.tel phone, c.address,
         (select name_1 from province where code = c.provine) province,
         (select name_1 from city where code = c.city and province = c.provine) city,
         a.name_1 product, a.sn, a.p_model model, a.p_brand brand, a.p_access accessory,
         a.warrunty warranty, a.p_type product_type, a.p_delivery delivery, a.issue symptom,
         a.p_abrasion remark, a.user_regis receiver,
         (select name_1 from tb_type where code = a.p_type) type_name
       from tb_product a left join ar_customer c on c.code = a.cust_code
       where a.code = $1 limit 1`,
      [code],
    ).then((result) => result.rows[0]),
    getCompany(),
    // ປະເພດສິນຄ້າ ເກັບເປັນລະຫັດ ERP — map ເປັນຊື່. ERP ຂັດຂ້ອງກໍ່ພິມຕໍ່ໄດ້ (fallback ໃຊ້ລະຫັດ)
    getErpCategories().catch(() => []),
  ]);
  if (!receipt) notFound();

  // ປະເພດສິນຄ້າ: ງານເກົ່າ (ods) ໃຊ້ລະຫັດ tb_type · ງານໃໝ່ໃຊ້ລະຫັດ ERP ic_category · ບໍ່ພົບ = ໃຊ້ລະຫັດດິບ
  const typeLabel =
    receipt.type_name ??
    categories.find((category) => category.code === receipt.product_type)?.name_1 ??
    (receipt.product_type && receipt.product_type !== "ເລືອກ..." ? receipt.product_type : null);
  const deliveryLabel = receipt.delivery ? deliveryLabelMap(t)[receipt.delivery] ?? receipt.delivery : null;

  /**
   * QR ໃຫ້ລູກຄ້າສະແກນຕິດຕາມເອງ → ໜ້າສາທາລະນະ /track/<ເລກທີ> (ບໍ່ຕ້ອງ login).
   * ຕັ້ງ PUBLIC_BASE_URL ໃນ .env ຂອງແມ່ຂ່າຍ ບໍ່ດັ່ງນັ້ນ QR ຈະຊີ້ໃສ່ host ທີ່ພິມຈາກ.
   */
  const url = await trackUrl(receipt.code);
  const qr = await QRCode.toString(url, { type: "svg", margin: 0, errorCorrectionLevel: "M", width: 96 });

  return (
    <div className="mx-auto max-w-[210mm] bg-white p-8 text-sm text-black print:p-0">
      <style>{`@media print { @page { size: A4; margin: 12mm } .no-print { display: none !important } }`}</style>

      <div className="no-print mb-4 flex items-center justify-between rounded-lg bg-slate-100 px-4 py-2">
        <span className="text-xs text-slate-600">{t.receiptBadge} #{receipt.code}</span>
        <PrintButton />
      </div>

      {/* ຫົວກະດາດ: ໂລໂກ້ · ຂໍ້ມູນບໍລິສັດ · QR */}
      <header className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <Image src="/odm.png" alt="" width={96} height={68} priority className="h-auto w-24 object-contain" />
          <div className="text-xs leading-5">
            <p className="text-sm font-bold">{company.name_1 || "ODIEN SERVICE"}</p>
            {company.name_2 && <p>{company.name_2}</p>}
            {company.address && <p>{t.locatedAt}: {company.address}</p>}
            {company.tel && <p>{t.tel}: {company.tel}</p>}
          </div>
        </div>
        <div className="w-24 shrink-0 text-center">
          <div className="[&>svg]:h-auto [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: qr }} />
          <p className="mt-1 text-[9px] leading-tight">{t.scanToTrack}</p>
        </div>
      </header>

      <div className="mt-3 flex justify-end text-xs leading-5">
        <div>
          <p>{t.date}: {receipt.reg_date || "-"}</p>
          <p>{t.time}: {receipt.reg_time || "-"}</p>
          <p>
            {t.repairCode}: <b className="text-base">{receipt.code}</b>
          </p>
        </div>
      </div>

      <h1 className="my-3 text-center text-xl font-bold">{layoutTitle(t)[layout]}</h1>

      {/* ຂໍ້ມູນລູກຄ້າ */}
      <p className="mb-1 font-bold underline">{t.customerInfo} / Customer Information</p>
      <table className="w-full border-collapse text-xs">
        <tbody>
          <tr>
            <LabelCell lo={t.customerName} en="Customer Name" width="180px" />
            <ValueCell value={receipt.customer} colSpan={3} />
          </tr>
          <tr>
            <LabelCell lo={t.homeAddress} en="Address" />
            <ValueCell value={receipt.address} />
            <LabelCell lo={t.city} en="City" width="130px" />
            <ValueCell value={receipt.city} />
          </tr>
          <tr>
            <LabelCell lo={t.province} en="Province" />
            <ValueCell value={receipt.province} />
            <LabelCell lo={t.tel} en="Tel" width="130px" />
            <ValueCell value={receipt.phone} />
          </tr>
        </tbody>
      </table>

      {/* ຂໍ້ມູນສິນຄ້າ */}
      <p className="mb-1 mt-4 font-bold underline">{t.productInfo} / Product Information</p>
      <table className="w-full border-collapse text-xs">
        <tbody>
          <tr>
            <LabelCell lo={t.productName} en="Product Name" width="180px" />
            <ValueCell value={receipt.product} colSpan={3} />
          </tr>
          <tr>
            <LabelCell lo={t.productType} en="Product Type" />
            <ValueCell value={typeLabel} />
            <LabelCell lo={t.model} en="Product Model" width="150px" />
            <ValueCell value={receipt.model} />
          </tr>
          <tr>
            <LabelCell lo={t.brand} en="Product brand" />
            <ValueCell value={receipt.brand} />
            <LabelCell lo={t.serialNo} en="SN" width="150px" />
            <ValueCell value={receipt.sn} />
          </tr>
          <tr>
            <LabelCell lo={t.accessory} en="Accessory" />
            <ValueCell value={receipt.accessory} colSpan={3} />
          </tr>
          <tr>
            <LabelCell lo={t.symptom} en="Symptom" />
            <ValueCell value={receipt.symptom} colSpan={3} />
          </tr>
          <tr>
            <LabelCell lo={t.markRemark} en="Remark" />
            <ValueCell value={receipt.remark} colSpan={3} />
          </tr>
          <tr>
            <LabelCell lo={t.warranty} en="Warunty" />
            <ValueCell value={receipt.warranty} />
            <LabelCell lo={t.delivery} en="Delivery" width="150px" />
            <ValueCell value={deliveryLabel} />
          </tr>
        </tbody>
      </table>

      {/* ລາຍເຊັນ */}
      <div className="mt-12 grid grid-cols-3 text-center text-xs">
        <div>
          <p>................</p>
          <p className="mt-1">{t.senderSign}</p>
        </div>
        <div>
          <p>....{receipt.receiver || ""}..</p>
          <p className="mt-1">{t.receiverSign}</p>
        </div>
        <div>
          <p>................</p>
          <p className="mt-1">{t.returnReceiverSign}</p>
        </div>
      </div>

      {/* ເງື່ອນໄຂ */}
      <ol className="mt-8 space-y-1 text-[11px] leading-snug text-[#0536a9]">
        <li>1. {t.condition1}</li>
        <li>2. {t.condition2}</li>
        <li>3. {t.condition3}</li>
        <li>4. {t.condition4}</li>
      </ol>

      <p className="mt-4 text-center font-bold">{t.contactDirect}</p>
      <p className="mt-1 text-center text-base font-bold">ODIEN SERVICES 5S &quot;SPEED SMART STANDARD SURE SMILE&quot;</p>
    </div>
  );
}
